'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scanProject } = require('../src/scanner');

const ROOT = path.join(__dirname, '..');
const BAD = path.join(ROOT, 'examples', 'bad-app');
const GOOD = path.join(ROOT, 'examples', 'good-app');
const BADWEB = path.join(ROOT, 'examples', 'bad-web');
const GOODWEB = path.join(ROOT, 'examples', 'good-web');
const CLI = path.join(ROOT, 'src', 'cli.js');

function check(report, id) {
  const found = report.checks.find((c) => c.id === id);
  assert.ok(found, `check ${id} missing from report`);
  return found;
}

test('there are exactly 27 checks in 8 groups', () => {
  const report = scanProject(GOOD);
  assert.strictEqual(report.checks.length, 27);
  assert.strictEqual(Object.keys(report.groups).length, 8);
});

test('bad-app scores materially lower than good-app', () => {
  const bad = scanProject(BAD);
  const good = scanProject(GOOD);
  assert.ok(good.score >= 90, `expected good-app >= 90, got ${good.score}`);
  assert.ok(bad.score <= 30, `expected bad-app <= 30, got ${bad.score}`);
  assert.ok(good.score - bad.score >= 60, `expected a gap of >= 60, got ${good.score - bad.score}`);
});

test('bad-app triggers the named failures with file evidence', () => {
  const bad = scanProject(BAD);
  for (const id of ['no-one-time-dimensions', 'no-fixed-screen-width', 'no-fixed-container-size', 'use-window-dimensions', 'safe-area-handling']) {
    const c = check(bad, id);
    assert.strictEqual(c.status, 'fail', `${id} should fail on bad-app`);
  }
  const dims = check(bad, 'no-one-time-dimensions');
  assert.ok(dims.evidence.length >= 2, 'expected Dimensions.get and UIScreen.main.bounds evidence');
  assert.ok(dims.evidence.some((e) => e.file === 'App.js'), 'expected evidence in App.js');
  assert.ok(dims.evidence.some((e) => e.file.endsWith('.swift')), 'expected evidence in the Swift file');
  assert.ok(dims.evidence.every((e) => typeof e.line === 'number' && e.line >= 1));

  const fixed = check(bad, 'no-fixed-screen-width');
  assert.ok(fixed.evidence.some((e) => e.file === 'App.js'), 'expected fixed-width evidence in App.js');
});

test('good-app does NOT trigger the Dimensions / fixed-width failures', () => {
  const good = scanProject(GOOD);
  assert.strictEqual(check(good, 'no-one-time-dimensions').status, 'pass');
  assert.strictEqual(check(good, 'no-fixed-screen-width').status, 'pass');
  assert.strictEqual(check(good, 'no-fixed-container-size').status, 'pass');
  assert.strictEqual(check(good, 'use-window-dimensions').status, 'pass');
  assert.strictEqual(check(good, 'two-column-layout').status, 'pass');
});

test('hard gate verdict appears when no iOS 27.1 evidence exists', () => {
  const bad = scanProject(BAD);
  assert.strictEqual(bad.hardGate.failed, true);
  assert.match(bad.verdict, /Not Badge-Ready/);
  assert.match(bad.verdict, /letterbox risk/);

  const good = scanProject(GOOD);
  assert.strictEqual(good.hardGate.failed, false);
  assert.doesNotMatch(good.verdict, /Not Badge-Ready/);
});

test('manual checks are never auto-passed and are excluded from the score', () => {
  const report = scanProject(GOOD);
  const manuals = report.checks.filter((c) => c.status === 'manual');
  assert.ok(manuals.length >= 8, `expected at least 8 manual checks, got ${manuals.length}`);
  // good-app has no web files, so the 5 Safari checks report 'na' and,
  // like manual checks, stay out of the score: 14 auto + 8 manual + 5 na = 27.
  assert.strictEqual(report.autoChecks + report.manual + report.na, 27);
  assert.strictEqual(report.manual, manuals.length);
});

test('CLI --json produces a parseable report matching the library result', () => {
  const stdout = execFileSync(process.execPath, [CLI, 'scan', BAD, '--json'], { encoding: 'utf8' });
  const parsed = JSON.parse(stdout);
  const direct = scanProject(BAD);
  assert.strictEqual(parsed.score, direct.score);
  assert.strictEqual(parsed.verdict, direct.verdict);
  assert.strictEqual(parsed.projectName, 'bad-app');
});

test('CLI --md writes a markdown report with the score and verdict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duoready-test-'));
  const mdPath = path.join(dir, 'report.md');
  execFileSync(process.execPath, [CLI, 'scan', BAD, '--md', mdPath], { encoding: 'utf8' });
  const md = fs.readFileSync(mdPath, 'utf8');
  assert.match(md, /Duo Readiness Score/);
  assert.match(md, /Not Badge-Ready/);
  assert.match(md, /App\.js:\d+/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('CLI --fail-below exits 1 for a gated, low-scoring project', () => {
  assert.throws(() => {
    execFileSync(process.execPath, [CLI, 'scan', BAD, '--fail-below', '80'], { encoding: 'utf8' });
  });
});

test('bad-web fails the four-edge insets check, naming every missing edge', () => {
  const report = scanProject(BADWEB);
  const insets = check(report, 'safari-four-edge-insets');
  assert.strictEqual(insets.status, 'fail');
  // bad-web sets viewport-fit=cover with NO insets — Apple's exact failure
  // mode — so the message must warn about the side controls and name all
  // four missing edges.
  assert.match(insets.message, /side controls/);
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    assert.match(insets.message, new RegExp(edge), `message should name missing edge ${edge}`);
  }
  // viewport-fit itself is present, so that check passes; the fixed-width
  // container and the UA sniffing must fail with evidence.
  assert.strictEqual(check(report, 'safari-viewport-fit').status, 'pass');
  assert.strictEqual(check(report, 'safari-fluid-range').status, 'fail');
  assert.ok(check(report, 'safari-fluid-range').evidence.some((e) => e.file === 'styles.css'));
  assert.strictEqual(check(report, 'safari-no-ua-sniffing').status, 'fail');
  assert.strictEqual(check(report, 'safari-posture-segments').status, 'manual');
});

test('good-web passes all Safari auto checks', () => {
  const report = scanProject(GOODWEB);
  for (const id of ['safari-viewport-fit', 'safari-four-edge-insets', 'safari-no-ua-sniffing', 'safari-fluid-range']) {
    assert.strictEqual(check(report, id).status, 'pass', `${id} should pass on good-web`);
  }
  assert.strictEqual(check(report, 'safari-posture-segments').status, 'manual');
  assert.strictEqual(report.na, 0);
});

test('an RN-only project reports the Safari group as not applicable and excludes it from the score', () => {
  for (const dir of [BAD, GOOD]) {
    const report = scanProject(dir);
    const safari = report.checks.filter((c) => c.group === 'Safari on Duo (Web)');
    assert.strictEqual(safari.length, 5);
    assert.ok(safari.every((c) => c.status === 'na'), 'all Safari checks should be na without web files');
    assert.strictEqual(report.na, 5);
    // Excluded exactly like manual checks: auto + manual + na = all checks.
    assert.strictEqual(report.autoChecks + report.manual + report.na, report.checks.length);
  }
  // The shipped fixtures keep their scores.
  assert.strictEqual(scanProject(BAD).score, 0);
  assert.strictEqual(scanProject(GOOD).score, 100);
});
