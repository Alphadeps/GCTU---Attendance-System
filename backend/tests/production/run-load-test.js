'use strict';
/**
 * One-command load test runner
 *
 *   node tests/production/run-load-test.js
 *
 * Steps:
 *   1. Run setup-prod.js  → creates test data on production, writes students.json / session.json
 *   2. Read the output files
 *   3. Spawn k6 with the right env vars pointing at the live API
 */

const { execFileSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const K6   = 'C:\\tools\\k6\\k6-v0.55.0-windows-amd64\\k6.exe';
const ROOT = path.join(__dirname);

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          GCTU Real-Infrastructure Load Test Runner          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Step 1 — setup
console.log('PHASE 1: Creating production test data...\n');
try {
  execFileSync(process.execPath, [path.join(ROOT, 'setup-prod.js')], {
    stdio: 'inherit',
    env: { ...process.env }
  });
} catch (err) {
  console.error('\n❌ Setup phase failed. Aborting.');
  process.exit(1);
}

// Step 2 — read outputs
const session  = JSON.parse(fs.readFileSync(path.join(ROOT, 'session.json'),  'utf8'));
const students = JSON.parse(fs.readFileSync(path.join(ROOT, 'students.json'), 'utf8'));

console.log(`\nPHASE 2: Starting k6 load test...`);
console.log(`  Session ID  : ${session.sessionId}`);
console.log(`  Manual code : ${session.manualCode}`);
console.log(`  Students    : ${students.length}`);
console.log(`  API         : https://class-attendance-backend-o80x.onrender.com\n`);

// Step 3 — run k6
const result = spawnSync(K6, [
  'run',
  '--out', `json=${path.join(ROOT, 'results.json')}`,
  '-e', `BASE_URL=https://class-attendance-backend-o80x.onrender.com`,
  '-e', `SESSION_ID=${session.sessionId}`,
  '-e', `MANUAL_CODE=${session.manualCode}`,
  '-e', `STUDENTS=${JSON.stringify(students)}`,
  path.join(ROOT, 'prod-load-test.js')
], {
  stdio: 'inherit',
  windowsHide: false
});

if (result.status !== 0) {
  console.error('\n⚠️  k6 exited with non-zero status. Check results above.');
  process.exit(result.status);
}

console.log('\n✓ Load test complete. Results saved to tests/production/results.json');
