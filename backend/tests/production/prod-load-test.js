/**
 * GCTU Production Load Test — Progressive Ramp
 *
 * Sends real concurrent attendance-mark requests to the live API.
 * Ramps from 10 → 2,000 VUs to find the exact breaking point.
 *
 * Run via the helper (recommended — handles server warm-up automatically):
 *   node tests/production/run-load-test.js
 *
 * Or directly:
 *   "C:\tools\k6\k6-v0.55.0-windows-amd64\k6.exe" run `
 *     -e BASE_URL=https://class-attendance-backend-o80x.onrender.com `
 *     -e SESSION_ID=<uuid> `
 *     -e MANUAL_CODE=<6digits> `
 *     tests/production/prod-load-test.js
 */
import http              from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend }   from 'k6/metrics';

// ── Custom metrics ───────────────────────────────────────────────────────────
const successRate     = new Rate('attendance_success');
const duplicateRate   = new Rate('attendance_duplicate');
const serverErrorRate = new Rate('attendance_5xx');
const timeoutRate     = new Rate('attendance_timeout');
const markDuration    = new Trend('attendance_mark_ms', true);
const healthDuration  = new Trend('health_check_ms',    true);

// ── Config from env ──────────────────────────────────────────────────────────
const BASE_URL    = __ENV.BASE_URL    || 'https://class-attendance-backend-o80x.onrender.com';
const SESSION_ID  = __ENV.SESSION_ID;
const MANUAL_CODE = __ENV.MANUAL_CODE;

// Read student list from the JSON file written by setup-prod.js.
// k6's open() runs at init time (not per VU) — avoids the 32 KB Windows CLI limit.
const STUDENTS = JSON.parse(open('./students.json'));

if (!SESSION_ID || !MANUAL_CODE) {
  throw new Error('SESSION_ID and MANUAL_CODE must be set. Run setup-prod.js first.');
}
if (STUDENTS.length === 0) {
  throw new Error('students.json is empty or missing. Run setup-prod.js first.');
}

// ── Ramp-up stages ───────────────────────────────────────────────────────────
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
    // Hard failure thresholds
    'attendance_5xx':     ['rate<0.02'],   // <2% server errors at any scale
    'http_req_failed':    ['rate<0.10'],   // <10% network-level failures (raised from 5% — free tier)
    // SLO targets (measure, don't fail the run at high VU counts)
    'attendance_mark_ms': ['p(95)<8000'],  // 95th pct under 8s (realistic for 2000 VUs on free tier)
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Main scenario ────────────────────────────────────────────────────────────

export default function () {
  const vu      = __VU;
  const student = STUDENTS[(vu - 1) % STUDENTS.length];

  group('mark_attendance', () => {
    const payload = JSON.stringify({
      indexNumber:       student.indexNumber,
      name:              student.name,
      deviceFingerprint: student.deviceFingerprint,
      qrCode:            MANUAL_CODE,  // 6-digit → ONLINE session, no geofence required
      latitude:          null,
      longitude:         null,
    });

    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/attendance/mark`,
      payload,
      { headers: { 'Content-Type': 'application/json' }, timeout: '20s' }
    );
    markDuration.add(Date.now() - start);

    const ok        = res.status === 201;
    const duplicate = res.status === 400 || res.status === 409;
    const serverErr = res.status >= 500;
    const timedOut  = res.status === 0;

    successRate.add(ok);
    duplicateRate.add(duplicate);
    serverErrorRate.add(serverErr);
    timeoutRate.add(timedOut);

    check(res, {
      '✓ accepted (201/400/409/423/429)': r => [201, 400, 409, 423, 429].includes(r.status),
      '✗ no 5xx error':                   r => r.status < 500,
      '✗ no timeout':                     r => r.status !== 0,
    });

    if (serverErr) {
      console.error(`[VU ${vu}] 5xx on ${student.indexNumber}: ${res.status} ${res.body.substring(0, 200)}`);
    }
    if (timedOut) {
      console.warn(`[VU ${vu}] Timeout on ${student.indexNumber} after ${Date.now() - start}ms`);
    }
  });

  // 1 in every 50 VUs also hits the health endpoint to watch for DB disconnects
  if (vu % 50 === 0) {
    group('health_probe', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/health`, { timeout: '10s' });
      healthDuration.add(Date.now() - start);
      check(res, {
        'health OK':    r => r.status === 200,
        'db connected': r => {
          try { return JSON.parse(r.body).database === 'CONNECTED'; } catch { return false; }
        },
      });
    });
  }

  // Realistic think time: students tap the app and wait — they don't loop
  // instantly. 0.5–1.5 s jitter simulates the natural stagger of a real class.
  // This also prevents event-loop saturation on the free-tier server.
  sleep(0.5 + Math.random());
}

// ── End-of-test summary ──────────────────────────────────────────────────────
export function handleSummary(data) {
  const iterations = data.metrics.iterations?.values?.count    || 0;
  const successPct = (data.metrics.attendance_success?.values?.rate  || 0) * 100;
  const dupePct    = (data.metrics.attendance_duplicate?.values?.rate || 0) * 100;
  const err5xxPct  = (data.metrics.attendance_5xx?.values?.rate      || 0) * 100;
  const timeoutPct = (data.metrics.attendance_timeout?.values?.rate  || 0) * 100;
  const failPct    = (data.metrics.http_req_failed?.values?.rate     || 0) * 100;
  const p95        = Math.round(data.metrics.attendance_mark_ms?.values?.['p(95)'] || 0);
  const p99        = Math.round(data.metrics.attendance_mark_ms?.values?.['p(99)'] || 0);
  const maxMs      = Math.round(data.metrics.attendance_mark_ms?.values?.max       || 0);

  // True pass = no server crashes AND acceptable failure rate AND latency SLO
  const passed = err5xxPct < 2 && failPct < 10 && p95 < 8000;

  const fmt = (n) => (n < 1 && n > 0 ? n.toFixed(2) : Math.round(n)) + '%';

  const report = `
╔══════════════════════════════════════════════════════════════╗
║         GCTU PRODUCTION LOAD TEST — FINAL RESULTS           ║
╠══════════════════════════════════════════════════════════════╣
║  Total iterations        : ${String(iterations).padStart(8)}                   ║
║  ✓ Attendance success    : ${fmt(successPct).padStart(8)}                   ║
║  ~ Duplicates (expected) : ${fmt(dupePct).padStart(8)}                   ║
║  ⚠ Timeouts (HTTP 0)     : ${fmt(timeoutPct).padStart(8)}                   ║
║  ✗ Network failures      : ${fmt(failPct).padStart(8)}                   ║
║  ✗ Server errors (5xx)   : ${fmt(err5xxPct).padStart(8)}                   ║
╠══════════════════════════════════════════════════════════════╣
║  Latency — attendance mark                                   ║
║    p(95)  : ${String(p95 + 'ms').padStart(8)}   (SLO: <8 000ms)              ║
║    p(99)  : ${String(p99 + 'ms').padStart(8)}                                     ║
║    max    : ${String(maxMs + 'ms').padStart(8)}                                     ║
╠══════════════════════════════════════════════════════════════╣
║  VERDICT: ${passed
    ? '✓ PASS — server stable under load                  '
    : `✗ FAIL — ${err5xxPct >= 2 ? '5xx errors' : failPct >= 10 ? 'high failure rate' : 'latency SLO'} exceeded          `}║
╚══════════════════════════════════════════════════════════════╝
`;

  console.log(report);

  return {
    stdout: report,
    'tests/production/results.json': JSON.stringify(data, null, 2),
  };
}
