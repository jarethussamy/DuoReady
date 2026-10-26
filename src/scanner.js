'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { GROUPS, CHECKS } = require('./checks');

const SOURCE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.swift']);
const WEB_EXTS = new Set(['.html', '.htm', '.css']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'Pods', '.expo', 'dist', 'build', 'vendor', '.next']);

function isConfigFile(name) {
  return (
    name === 'Podfile' ||
    name === 'app.json' ||
    name === 'Info.plist' ||
    name.endsWith('.pbxproj') ||
    name.endsWith('.xcconfig')
  );
}

function collectFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTS.has(ext) || WEB_EXTS.has(ext) || isConfigFile(entry.name)) {
          let text = '';
          try {
            text = fs.readFileSync(full, 'utf8');
          } catch {
            text = '';
          }
          out.push({
            rel: path.relative(root, full).split(path.sep).join('/'),
            name: entry.name,
            kind: isConfigFile(entry.name) ? 'config' : (WEB_EXTS.has(ext) ? 'web' : 'source'),
            text,
            lines: text.split(/\r?\n/),
          });
        }
      }
    }
  }
  walk(root);
  return out;
}

// Line-based evidence search. predicate(text, line) -> bool, or a RegExp.
function findEvidence(files, matcher) {
  const evidence = [];
  for (const file of files) {
    file.lines.forEach((lineText, i) => {
      let hit = false;
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0;
        hit = matcher.test(lineText);
      } else {
        hit = matcher(lineText);
      }
      if (hit) {
        evidence.push({ file: file.rel, line: i + 1, text: lineText.trim().slice(0, 160) });
      }
    });
  }
  return evidence;
}

function result(meta, status, message, evidence = []) {
  return { id: meta.id, group: meta.group, kind: meta.kind, name: meta.name, fix: meta.fix, status, message, evidence };
}

function scanProject(rootInput) {
  const root = path.resolve(rootInput);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Project path not found or not a directory: ${rootInput}`);
  }
  const files = collectFiles(root);
  const sources = files.filter((f) => f.kind === 'source');
  const configs = files.filter((f) => f.kind === 'config');
  const webs = files.filter((f) => f.kind === 'web');
  const all = files.filter((f) => f.kind !== 'web');

  const byId = new Map(CHECKS.map((c) => [c.id, c]));
  const out = [];
  const push = (id, status, message, evidence) => out.push(result(byId.get(id), status, message, evidence));

  // ---- SDK & Build -------------------------------------------------------
  const sdkEvidence = [
    ...findEvidence(configs, /27\.1/),
    ...findEvidence(all, /Xcode\s*27\.1|iOS\s*27\.1\s*SDK/),
  ];
  const sdkPass = sdkEvidence.length > 0;
  push('sdk-ios-27-1', sdkPass ? 'pass' : 'fail',
    sdkPass ? 'Found an iOS 27.1 / Xcode 27.1 signal in project config.' : 'No evidence the project targets the iOS 27.1 SDK / Xcode 27.1.',
    sdkEvidence);

  let maxTarget = null;
  const targetEvidence = [];
  for (const file of configs) {
    file.lines.forEach((lineText, i) => {
      const pbx = lineText.match(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([0-9]+(?:\.[0-9]+)?)/);
      const pod = lineText.match(/platform\s+:ios,\s*['"]([0-9]+(?:\.[0-9]+)?)['"]/);
      const m = pbx || pod;
      if (m) {
        const v = parseFloat(m[1]);
        if (maxTarget === null || v > maxTarget) maxTarget = v;
        targetEvidence.push({ file: file.rel, line: i + 1, text: lineText.trim().slice(0, 160) });
      }
    });
  }
  if (maxTarget === null) {
    push('deployment-target', 'fail', 'No IPHONEOS_DEPLOYMENT_TARGET or Podfile platform :ios found.', []);
  } else {
    push('deployment-target', maxTarget >= 15 ? 'pass' : 'fail',
      `Highest iOS deployment target found: ${maxTarget}.`, targetEvidence);
  }

  const hermesEv = findEvidence(all, /hermes_enabled|hermesEnabled|enableHermes|:hermes\b/);
  push('hermes-enabled', hermesEv.length ? 'pass' : 'fail',
    hermesEv.length ? 'Hermes signal found.' : 'No Hermes signal found in source or config.', hermesEv);

  const archEv = findEvidence(all, /newArchEnabled|fabric_enabled|RCT_NEW_ARCH_ENABLED/);
  push('new-architecture', archEv.length ? 'pass' : 'fail',
    archEv.length ? 'New Architecture signal found.' : 'No New Architecture / Fabric signal found.', archEv);

  // ---- Adaptive Layout ---------------------------------------------------
  const uwdEv = findEvidence(sources, /useWindowDimensions\s*\(/);
  push('use-window-dimensions', uwdEv.length ? 'pass' : 'fail',
    uwdEv.length ? 'useWindowDimensions is used.' : 'useWindowDimensions is not used anywhere.', uwdEv);

  const oneTimeEv = findEvidence(sources, /Dimensions\.get\s*\(|UIScreen\.main\.bounds/);
  push('no-one-time-dimensions', oneTimeEv.length ? 'fail' : 'pass',
    oneTimeEv.length ? 'One-time / device-screen layout reads found.' : 'No Dimensions.get or UIScreen.main.bounds layout reads found.', oneTimeEv);

  const fixedWidthEv = findEvidence(sources, (line) => {
    const cmp = line.match(/(?:\bwidth\b|\bSCREEN_WIDTH\b|\bscreenWidth\b)\s*(?:===|!==|==|!=|>=|<=|>|<)\s*(\d{3,4})/);
    if (cmp) {
      const n = parseInt(cmp[1], 10);
      if (n >= 320 && n <= 500) return true;
    }
    return /(?:const\s+)?SCREEN_WIDTH\s*=\s*(?:3\d{2}|4\d{2})\b/.test(line);
  });
  push('no-fixed-screen-width', fixedWidthEv.length ? 'fail' : 'pass',
    fixedWidthEv.length ? 'Fixed phone-width comparisons / constants found.' : 'No fixed phone-width comparisons found.', fixedWidthEv);

  const fixedSizeEv = findEvidence(sources, (line) =>
    /(?:^|[,{\s])(?:width|height)\s*:\s*[3-9]\d{2}\b/.test(line) ||
    /\.frame\(\s*(?:width|height)\s*:\s*[3-9]\d{2}\b/.test(line));
  push('no-fixed-container-size', fixedSizeEv.length ? 'fail' : 'pass',
    fixedSizeEv.length ? 'Hardcoded fixed container/modal sizes (>= 300) found.' : 'No hardcoded fixed container sizes >= 300 found.', fixedSizeEv);

  // ---- Fold & Posture ----------------------------------------------------
  const safeEv = findEvidence(sources, /SafeAreaView|useSafeAreaInsets|SafeAreaProvider|safeAreaInset/);
  push('safe-area-handling', safeEv.length ? 'pass' : 'fail',
    safeEv.length ? 'Safe-area handling found.' : 'No SafeAreaView / insets handling found.', safeEv);

  push('hinge-aware-layout', 'manual', 'Manual: verify hinge / foldState behaviour in Device Hub across open, closed, tent, portrait and landscape.', []);
  push('posture-transition-testing', 'manual', 'Manual: fold, unfold and rotate on every main screen in the iPhone Duo Simulator.', []);

  // ---- State Continuity --------------------------------------------------
  const persistenceEv = findEvidence(all, /AsyncStorage|MMKV|redux-persist|@SceneStorage/);
  const formStateEv = findEvidence(sources, /useState\s*\(/);
  if (persistenceEv.length) {
    push('persisted-form-state', 'pass', 'A state-persistence signal was found.', persistenceEv);
  } else if (formStateEv.length) {
    push('persisted-form-state', 'fail', 'State is held in useState with no persistence signal, so a fold change can lose it.', formStateEv.slice(0, 5));
  } else {
    // No form state at all: downgrade this auto check to manual for this project.
    const meta = byId.get('persisted-form-state');
    out.push({ ...result(meta, 'manual', 'Manual for this project: no useState form state and no persistence signal found to judge.', []), kind: 'manual' });
  }
  push('scroll-position-preserved', 'manual', 'Manual: fold mid-scroll in the simulator and confirm the scroll position survives.', []);
  push('playback-upload-continuity', 'manual', 'Manual: fold during playback, an upload and a payment flow and confirm nothing restarts.', []);

  // ---- Split View & Multitasking ----------------------------------------
  const splitEv = findEvidence(all, /NavigationSplitView|DuoSplitView|useDuoLayout|columns\s*[:=]\s*2/);
  push('two-column-layout', splitEv.length ? 'pass' : 'fail',
    splitEv.length ? 'A two-column / split layout signal was found.' : 'No two-column layout signal found.', splitEv);

  const lockEv = findEvidence(configs, /"orientation"\s*:\s*"portrait"/);
  const freeEv = findEvidence(configs, /"orientation"\s*:\s*"(default|responsive)"/);
  if (lockEv.length) {
    push('no-orientation-lock', 'fail', 'app.json locks orientation to portrait.', lockEv);
  } else if (freeEv.length) {
    push('no-orientation-lock', 'pass', 'Orientation is not locked to a single value.', freeEv);
  } else {
    const meta = byId.get('no-orientation-lock');
    out.push({ ...result(meta, 'manual', 'Manual for this project: no orientation setting found in app.json / Info.plist to judge.', []), kind: 'manual' });
  }
  push('split-view-testing', 'manual', 'Manual: test Split View at several widths, two windows of the app, and saved app pairs.', []);

  // ---- Outer Display ------------------------------------------------------
  push('outer-display-preview', 'manual', 'Manual: preview the 5.4-inch outer display separately in Xcode canvas alternative-display previews.', []);
  push('camera-outer-display', 'manual', 'Manual: if the app uses the camera, verify outer-display camera experiences (CameraCaptureAccessory) on device / Device Hub.', []);

  // ---- Performance --------------------------------------------------------
  let scrollMapEv = [];
  for (const file of sources) {
    if (/<ScrollView/.test(file.text) && /\.map\s*\(/.test(file.text)) {
      scrollMapEv = scrollMapEv.concat(findEvidence([file], /\.map\s*\(|<ScrollView/));
    }
  }
  const flatEv = findEvidence(sources, /FlatList/);
  if (scrollMapEv.length) {
    push('virtualized-lists', 'fail', 'A ScrollView rendering rows with .map() was found.', scrollMapEv.slice(0, 5));
  } else if (flatEv.length) {
    push('virtualized-lists', 'pass', 'FlatList is used for lists.', flatEv);
  } else {
    const meta = byId.get('virtualized-lists');
    out.push({ ...result(meta, 'manual', 'Manual for this project: no list rendering found to judge.', []), kind: 'manual' });
  }

  const memoEv = findEvidence(sources, /React\.memo|\bmemo\s*\(|useMemo\s*\(|useCallback\s*\(/);
  push('memoization', memoEv.length ? 'pass' : 'fail',
    memoEv.length ? 'Memoization signals found.' : 'No React.memo / useMemo / useCallback signals found.', memoEv);
  push('instruments-profiling', 'manual', 'Manual: profile launch and fold/unfold transitions with Instruments.', []);

  // ---- Safari on Duo (Web) -------------------------------------------------
  // This group only applies when the project ships web files (HTML/CSS).
  // Without them the checks are reported 'na' (not applicable) and, like
  // manual checks, are excluded from the score denominator.
  const htmlFiles = webs.filter((f) => /\.html?$/i.test(f.name));
  const cssFiles = webs.filter((f) => /\.css$/i.test(f.name));
  const hasWeb = webs.length > 0;
  const naMsg = 'Not applicable: this project contains no HTML/CSS web files, so the Safari on Duo (Web) checks do not apply.';

  // safari-viewport-fit: a viewport meta declaring viewport-fit=cover.
  const viewportFitEv = findEvidence(htmlFiles, /<meta[^>]*name\s*=\s*["']viewport["'][^>]*viewport-fit\s*=\s*["']?cover/i);
  const viewportFit = viewportFitEv.length > 0;
  if (!hasWeb) {
    push('safari-viewport-fit', 'na', naMsg, []);
  } else {
    push('safari-viewport-fit', viewportFit ? 'pass' : 'fail',
      viewportFit
        ? 'A viewport meta with viewport-fit=cover was found, so the page can paint beside the Duo outer display\'s side controls.'
        : 'No viewport meta with viewport-fit=cover found in any HTML file. On the Duo outer display (382 CSS px wide) Safari keeps content in a narrower strip and the page background fills the rest.',
      viewportFitEv);
  }

  // safari-four-edge-insets: env(safe-area-inset-*) for all four edges.
  const EDGES = ['top', 'right', 'bottom', 'left'];
  const edgesFound = {};
  const insetEv = [];
  for (const edge of EDGES) {
    const ev = findEvidence(webs, new RegExp(`env\\(\\s*safe-area-inset-${edge}\\b`, 'i'));
    edgesFound[edge] = ev.length > 0;
    insetEv.push(...ev.slice(0, 2));
  }
  const missingEdges = EDGES.filter((e) => !edgesFound[e]);
  if (!hasWeb) {
    push('safari-four-edge-insets', 'na', naMsg, []);
  } else if (missingEdges.length === 0) {
    push('safari-four-edge-insets', 'pass',
      'env(safe-area-inset-*) is used for all four edges (top, right, bottom, left), so content stays clear of the Duo\'s side controls and bars.',
      insetEv);
  } else if (insetEv.length === 0 && viewportFit) {
    push('safari-four-edge-insets', 'fail',
      'viewport-fit=cover is set but NO safe-area insets are used at all: page content will extend under the Duo\'s side controls and can be hidden there. This is the exact failure mode Apple\'s research found. Missing edges: top, right, bottom, left.',
      []);
  } else {
    push('safari-four-edge-insets', 'fail',
      `Safe-area insets are missing for ${missingEdges.length} of 4 edges — missing: ${missingEdges.join(', ')}. Content on those edges can be hidden under the Duo's side controls or browser bars.`,
      insetEv);
  }

  // safari-no-ua-sniffing: conservative heuristic — flag only lines that
  // BOTH read navigator.userAgent AND test it against a device/browser
  // token on the same line (the classic layout-branch pattern). Merely
  // reading the UA (analytics, support strings) is not flagged.
  const uaEv = findEvidence([...sources, ...htmlFiles], (line) => {
    if (!/navigator\.userAgent/.test(line)) return false;
    const deviceTest = /(?:\.test\s*\(|\.match\s*\(|\.includes\s*\(|===|!==|==|!=)/.test(line) &&
      /(iPhone|iPad|iPod|Android|Mobile|Windows Phone|Macintosh|SamsungBrowser|CriOS|FxiOS)/.test(line);
    const literalTest = /\/[^/\n]*(iPhone|iPad|Android|Mobile)[^/\n]*\/\s*\.\s*test\s*\(\s*navigator\.userAgent/.test(line);
    return deviceTest || literalTest;
  });
  if (!hasWeb) {
    push('safari-no-ua-sniffing', 'na', naMsg, []);
  } else {
    push('safari-no-ua-sniffing', uaEv.length ? 'fail' : 'pass',
      uaEv.length
        ? 'User-agent sniffing for device/layout branching found. Apple advises feature detection instead of UA checks.'
        : 'No user-agent device/layout branching found (heuristic: navigator.userAgent tested against device names on one line).',
      uaEv);
  }

  // safari-fluid-range: signal only, not proof — flag bare `width: Npx`
  // declarations wider than 382px (the narrowest Duo Safari viewport) in
  // CSS. max-width/min-width are the fluid tools and are not flagged.
  const fluidEv = [];
  for (const file of cssFiles) {
    file.lines.forEach((lineText, i) => {
      const re = /(?:^|[;{])\s*width\s*:\s*(\d+(?:\.\d+)?)px/g;
      let m;
      while ((m = re.exec(lineText)) !== null) {
        if (parseFloat(m[1]) > 382) {
          fluidEv.push({ file: file.rel, line: i + 1, text: lineText.trim().slice(0, 160) });
        }
      }
    });
  }
  if (!hasWeb) {
    push('safari-fluid-range', 'na', naMsg, []);
  } else {
    push('safari-fluid-range', fluidEv.length ? 'fail' : 'pass',
      fluidEv.length
        ? 'Fixed pixel widths wider than 382px (the narrowest Duo Safari viewport) found in CSS — a signal the layout is not fluid across the 382–951 CSS px Duo range.'
        : 'No fixed pixel widths wider than 382px found in CSS (signal only — fluidity still needs a real resize test).',
      fluidEv);
  }

  if (!hasWeb) {
    push('safari-posture-segments', 'na', naMsg, []);
  } else {
    push('safari-posture-segments', 'manual', 'Manual: in Safari 27.1 on the Duo, test with the Device Posture and Viewport Segments feature flags (Settings > Apps > Safari > Advanced > Feature Flags) ON for the enhanced layout, then OFF to confirm the fluid CSS + safe-area fallback still works.', []);
  }

  // ---- Scoring -------------------------------------------------------------
  const auto = out.filter((c) => c.status === 'pass' || c.status === 'fail');
  const passed = auto.filter((c) => c.status === 'pass').length;
  const score = auto.length ? Math.round((100 * passed) / auto.length) : 0;
  const hardGateFailed = !sdkPass;
  let verdict;
  if (hardGateFailed) {
    verdict = 'Not Badge-Ready — letterbox risk';
  } else if (score >= 85) {
    verdict = 'Strong source signals — ready for Device Hub testing and a real Xcode 27.1 build';
  } else if (score >= 60) {
    verdict = 'Partial — fix the failed checks, then test in Device Hub';
  } else {
    verdict = 'Early — major Duo work remains';
  }

  const grouped = {};
  for (const group of GROUPS) grouped[group] = out.filter((c) => c.group === group);

  return {
    tool: 'duoready',
    version: '0.2.0',
    project: root,
    projectName: path.basename(root),
    filesScanned: files.length,
    score,
    autoChecks: auto.length,
    passed,
    failed: auto.length - passed,
    manual: out.filter((c) => c.status === 'manual').length,
    na: out.filter((c) => c.status === 'na').length,
    hardGate: {
      check: 'sdk-ios-27-1',
      failed: hardGateFailed,
      message: hardGateFailed
        ? 'No iOS 27.1 SDK / Xcode 27.1 evidence: this build would letterbox on the 7.6-inch display and cannot earn the Optimized for iPhone Duo badge.'
        : 'iOS 27.1 SDK signal present. This scan still does NOT prove badge eligibility — only a real Xcode 27.1 build submitted through App Store Connect proves that.',
    },
    verdict,
    badgeNote: 'A scan gives source signals only. Only a real build compiled with Xcode 27.1 / the iOS 27.1 SDK and submitted through App Store Connect proves Duo badge eligibility.',
    checks: out,
    groups: grouped,
  };
}

function toMarkdown(r) {
  const icon = { pass: 'PASS', fail: 'FAIL', manual: 'MANUAL', na: 'N/A' };
  const lines = [];
  lines.push(`# DuoReady scan — ${r.projectName}`);
  lines.push('');
  lines.push(`**Duo Readiness Score: ${r.score}/100** (over ${r.autoChecks} auto-checkable checks: ${r.passed} pass, ${r.failed} fail, ${r.manual} manual${r.na ? `, ${r.na} not applicable` : ''})`);
  lines.push('');
  lines.push(`**Verdict: ${r.verdict}**`);
  lines.push('');
  lines.push(`> ${r.hardGate.message}`);
  lines.push('');
  lines.push(`> ${r.badgeNote}`);
  lines.push('');
  for (const group of GROUPS) {
    lines.push(`## ${group}`);
    lines.push('');
    for (const c of r.groups[group]) {
      lines.push(`- **${icon[c.status]}** — ${c.name}`);
      lines.push(`  - ${c.message}`);
      for (const ev of c.evidence) lines.push(`  - Evidence: \`${ev.file}:${ev.line}\` — \`${ev.text}\``);
      if (c.status === 'fail') lines.push(`  - Fix: ${c.fix}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('DuoReady is a working title (web search-clean Oct 21, 2026), not attorney-cleared. USPTO + VA SCC checks are required before a public launch under this name.');
  return lines.join('\n') + '\n';
}

module.exports = { scanProject, toMarkdown, collectFiles };
