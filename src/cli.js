#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scanProject, toMarkdown } = require('./scanner');
const { GROUPS } = require('./checks');

function usage() {
  console.log(`DuoReady — iPhone Duo optimizer scanner

Usage:
  duoready scan <path-to-react-or-react-native-project> [--json] [--md <file>] [--fail-below <score>]

Options:
  --json            Print the machine-readable JSON report to stdout
  --md <file>       Also write a Markdown report to <file>
  --fail-below <n>  Exit 1 if the score is below <n> or the iOS 27.1 hard gate fails

The scan reports source signals only. Only a real Xcode 27.1 build submitted
through App Store Connect proves Optimized for iPhone Duo badge eligibility.`);
}

function printConsole(r) {
  const icon = { pass: '✓ PASS  ', fail: '✗ FAIL  ', manual: '? MANUAL', na: '– N/A   ' };
  console.log(`\nDuoReady scan — ${r.projectName}`);
  console.log(`Files scanned: ${r.filesScanned}`);
  console.log(`Duo Readiness Score: ${r.score}/100  (${r.passed}/${r.autoChecks} auto-checks pass, ${r.manual} manual${r.na ? `, ${r.na} not applicable` : ''})`);
  console.log(`Verdict: ${r.verdict}`);
  console.log(`Hard gate: ${r.hardGate.message}`);
  for (const group of GROUPS) {
    console.log(`\n${group}`);
    for (const c of r.groups[group]) {
      console.log(`  ${icon[c.status]} ${c.name}`);
      console.log(`           ${c.message}`);
      if (c.status === 'fail') {
        for (const ev of c.evidence) console.log(`           evidence: ${ev.file}:${ev.line}  ${ev.text}`);
        console.log(`           fix: ${c.fix}`);
      }
    }
  }
  console.log(`\n${r.badgeNote}\n`);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    usage();
    return 0;
  }
  if (args[0] !== 'scan' || !args[1] || args[1].startsWith('--')) {
    usage();
    return 2;
  }
  const projectPath = args[1];
  let json = false;
  let mdFile = null;
  let failBelow = null;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--json') json = true;
    else if (args[i] === '--md') mdFile = args[++i];
    else if (args[i] === '--fail-below') failBelow = parseInt(args[++i], 10);
    else {
      console.error(`Unknown option: ${args[i]}`);
      return 2;
    }
  }

  let report;
  try {
    report = scanProject(projectPath);
  } catch (err) {
    console.error(`duoready: ${err.message}`);
    return 2;
  }

  if (mdFile) {
    fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true });
    fs.writeFileSync(mdFile, toMarkdown(report));
    if (!json) console.log(`Markdown report written to ${mdFile}`);
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printConsole(report);
  }

  if (failBelow !== null && (report.score < failBelow || report.hardGate.failed)) return 1;
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = { main };
