'use strict';
/**
 * One-command load test runner
 *
 *   node tests/production/run-load-test.js
 *
 * Steps:
 *   1. Warm up the server — ping /api/health until it responds (Render free tier
 *      spins down after 15 min of inactivity; cold start takes ~30-60 s).
 *   2. Run setup-prod.js → enroll students, open session, write students/session JSON.
 *   3. Spawn k6 with the right env vars pointing at the live API.
 */

const { execFileSync, spawnSync } = require('child_process');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const K6      = 'C:\\tools\\k6\\k6-v0.55.0-windows-amd64\\k6.exe';
const ROOT    = path.join(__dirname);
const BASE    = process.env.PROD_API_URL || 'https://class-attendance-backend-o80x.onrender.com';
const HEALTH  = `${BASE}/api/health`;

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          GCTU Real-Infrastructure Load Test Runner          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ── Phase 0: Warm-up ─────────────────────────────────────────────────────────
// Render free tier sleeps after 15 min of inactivity. If the server is cold
// when k6 starts ramping, every request in the first 30-60 s will timeout,
// making the results look like 0% success even though the server is fine.
// We ping /api/health and block until we get an HTTP 200 (or give up at 2 min).

function pingHealth() {
  return new Promise((resolve) => {
    const req = https.get(HEALTH, { timeout: 10_000 }, (res) => {
      res.resume(); // drain
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function warmUp() {
  const deadline = Date.now() + 120_000; // 2 min max
  let attempt = 0;
  process.stdout.write('PHASE 0: Waking up server');
  while (Date.now() < deadline) {
    attempt++;
    const ok = await pingHealth();
    if (ok) {
      console.log(` ✓  (${attempt} ping${attempt > 1 ? 's' : ''})\n`);
      return;
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 3000));
  }
  console.error('\n\n❌ Server did not respond within 2 minutes. Is it deployed?');
  process.exit(1);
}

// ── Phase 1: Setup ────────────────────────────────────────────────────────────

async function main() {
  await warmUp();

  console.log('PHASE 1: Creating production test data...\n');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'setup-prod.js')], {
      stdio: 'inherit',
      env: { ...process.env }
    });
  } catch {
    console.error('\n❌ Setup phase failed. Aborting.');
    process.exit(1);
  }

  // ── Phase 2: Read outputs ─────────────────────────────────────────────────
  const session  = JSON.parse(fs.readFileSync(path.join(ROOT, 'session.json'),  'utf8'));
  const students = JSON.parse(fs.readFileSync(path.join(ROOT, 'students.json'), 'utf8'));

  console.log('\nPHASE 2: Starting k6 load test...');
  console.log(`  Session ID  : ${session.sessionId}`);
  console.log(`  Manual code : ${session.manualCode}`);
  console.log(`  Students    : ${students.length}`);
  console.log(`  API         : ${BASE}\n`);

  // ── Phase 3: Run k6 ───────────────────────────────────────────────────────
  const result = spawnSync(K6, [
    'run',
    '--out', `json=${path.join(ROOT, 'results.json')}`,
    '-e', `BASE_URL=${BASE}`,
    '-e', `SESSION_ID=${session.sessionId}`,
    '-e', `MANUAL_CODE=${session.manualCode}`,
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
}

main();
