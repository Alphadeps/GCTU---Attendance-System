/**
 * GCTU Production Load Test — Progressive Ramp
 *
 * Sends real concurrent attendance-mark requests to the live API.
 * Ramps from 10 → 2,000 VUs to find the exact breaking point.
 *
 * Run:
 *   "C:\tools\k6\k6-v0.55.0-windows-amd64\k6.exe" run `
 *     -e BASE_URL=https://class-attendance-backend-o80x.onrender.com `
 *     -e SESSION_ID=<uuid> `
 *     -e MANUAL_CODE=<6digits> `
 *     -e STUDENTS_FILE=tests/production/students.json `
 *     tests/production/prod-load-test.js
 *
 * Or use the helper script:  node tests/production/run-load-test.js
 */
import http    from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ───────────────────────────────────────────────────────────
const successRate      = new Rate('attendance_success');
const duplicateRate    = new Rate('attendance_duplicate');
const serverErrorRate  = new Rate('attendance_5xx');
const markDuration     = new Trend('attendance_mark_ms', true);
const healthDuration   = new Trend('health_check_ms',    true);

// ── Config from env ──────────────────────────────────────────────────────────
const BASE_URL    = __ENV.BASE_URL    || 'https://class-attendance-backend-o80x.onrender.com';
const SESSION_ID  = __ENV.SESSION_ID;
const MANUAL_CODE = __ENV.MANUAL_CODE;

// Read student list from the JSON file written by setup-prod.js.
// k6's open() runs at init time (not per VU) — avoids 32 KB Windows CLI limit.
const STUDENTS = JSON.parse(open('./students.json'));

if (!SESSION_ID || !MANUAL_CODE) {
  throw new Error('SESSION_ID and MANUAL_CODE must be set. Run setup-prod.js first.');
}
if (STUDENTS.length === 0) {
  throw new Error('students.json is empty or missing. Run setup-prod.js first.');
}

// ── Ramp-up stages ───────────────────────────────────────────────────────────
// Progressive ramp: find the exact point where latency degrades or errors appear
export const options = {
  scenarios: {
    progressive_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10   },  // warm-up: 10 students
        { duration: '30s', target: 10   },  // hold at 10 — baseline
        { duration: '20s', target: 50   },  // ramp to 50
        { duration: '30s', target: 50   },  // hold at 50
        { duration: '20s', target: 100  },  // ramp to 100 (one small class)
        { duration: '30s', target: 100  },  // hold
        { duration: '20s', target: 200  },  // ramp to 200
        { duration: '30s', target: 200  },  // hold
        { duration: '30s', target: 500  },  // ramp to 500 (large lecture)
        { duration: '60s', target: 500  },  // hold
        { duration: '30s', target: 1000 },  // ramp to 1000
        { duration: '60s', target: 1000 },  // hold
        { duration: '30s', target: 2000 },  // ramp to 2000 (full university peak)
        { duration: '60s', target: 2000 },  // hold at peak
        { duration: '30s', target: 0    },  // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },

  thresholds: {
    // Hard failure thresholds — test fails if these are breached
    'attendance_5xx':            ['rate<0.02'],     // <2% server errors at any scale
    'http_req_failed':           ['rate<0.05'],     // <5% network-level failures
    // SLO targets — measure but don't fail the run
    'attendance_mark_ms':        ['p(95)<5000'],    // 95th pct under 5s
    'attendance_mark_ms{vu:10}': ['p(95)<1000'],    // at 10 VUs: under 1s
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Main scenario ────────────────────────────────────────────────────────────

export default function () {
  const vu      = __VU;
  const student = STUDENTS[(vu - 1) % STUDENTS.length];

  // ── Mark attendance ────────────────────────────────────────────────────────
  group('mark_attendance', () => {
    const payload = JSON.stringify({
      indexNumber:       student.indexNumber,
      name:              student.name,
      deviceFingerprint: student.deviceFingerprint,
      qrCode:            MANUAL_CODE,  // 6-digit manual code → ONLINE session, no geofence
      latitude:          null,
      longitude:         null,
    });

    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/attendance/mark`,
      payload,
      { headers: { 'Content-Type': 'application/json' }, timeout: '15s' }
    );
    markDuration.add(Date.now() - start);

    const ok        = res.status === 201;
    const duplicate = res.status === 400 || res.status === 409;
    const serverErr = res.status >= 500;

    successRate.add(ok);
    duplicateRate.add(duplicate);
    serverErrorRate.add(serverErr);

    check(res, {
      '✓ 201 created or 400/409 duplicate': r => [201, 400, 409, 423].includes(r.status),
      '✗ no 5xx error':                     r => r.status < 500,
    });

    // Log server errors for debugging
    if (serverErr) {
      console.error(`[VU ${vu}] 5xx on ${student.indexNumber}: ${res.status} ${res.body.substring(0, 200)}`);
    }
  });

  // 1 in every 50 VUs also hits the health endpoint to watch for DB disconnects
  if (vu % 50 === 0) {
    group('health_probe', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/health`, { timeout: '5s' });
      healthDuration.add(Date.now() - start);
      check(res, {
        'health OK': r => r.status === 200,
        'db connected': r => {
          try { return JSON.parse(r.body).database === 'CONNECTED'; } catch { return false; }
        },
      });
    });
  }

  // No sleep — we want to measure pure throughput
}

// ── End-of-test summary ──────────────────────────────────────────────────────
export function handleSummary(data) {
  const iterations = data.metrics.iterations?.values?.count || 0;
  const success    = Math.round((data.metrics.attendance_success?.values?.rate || 0) * 100);
  const dupes      = Math.round((data.metrics.attendance_duplicate?.values?.rate || 0) * 100);
  const errors5xx  = Math.round((data.metrics.attendance_5xx?.values?.rate || 0) * 100);
  const p95        = Math.round(data.metrics.attendance_mark_ms?.values?.['p(95)'] || 0);
  const p99        = Math.round(data.metrics.attendance_mark_ms?.values?.['p(99)'] || 0);
  const maxMs      = Math.round(data.metrics.attendance_mark_ms?.values?.max || 0);

  const report = `
╔══════════════════════════════════════════════════════════════╗
║         GCTU PRODUCTION LOAD TEST — FINAL RESULTS           ║
╠══════════════════════════════════════════════════════════════╣
║  Total requests          : ${String(iterations).padStart(8)}                   ║
║  ✓ Attendance success    : ${String(success + '%').padStart(8)}                   ║
║  ~ Duplicates (expected) : ${String(dupes + '%').padStart(8)}                   ║
║  ✗ Server errors (5xx)   : ${String(errors5xx + '%').padStart(8)}                   ║
╠══════════════════════════════════════════════════════════════╣
║  Latency (attendance mark)                                   ║
║    p(95)  : ${String(p95 + 'ms').padStart(8)}                                     ║
║    p(99)  : ${String(p99 + 'ms').padStart(8)}                                     ║
║    max    : ${String(maxMs + 'ms').padStart(8)}                                     ║
╠══════════════════════════════════════════════════════════════╣
║  VERDICT: ${errors5xx < 2 ? '✓ PASS — system handled the load' : '✗ FAIL — server errors detected'}                       ║
╚══════════════════════════════════════════════════════════════╝
`;

  console.log(report);

  // Write JSON results for programmatic analysis
  return {
    stdout: report,
    'tests/production/results.json': JSON.stringify(data, null, 2),
  };
}
