/**
 * Soak Test — 100 concurrent users for 2 hours
 *
 * Detects:
 *   - Node.js heap growth (memory leaks)
 *   - Connection pool exhaustion over time
 *   - Session cache bloat in securityCache.js
 *   - Gradual latency degradation
 *
 * Run:
 *   k6 run -e BASE_URL=https://your-api.onrender.com \
 *           -e SESSION_ID=<uuid> \
 *           -e STUDENTS='[...]' \
 *           tests/load/soak-test.js
 *
 * During the run, monitor:
 *   GET /api/health  → check memory.heapUsed in response
 *   GET /api/monitoring/metrics  → check active DB connections
 */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { buildMarkPayload, markAttendance, login, jitteredCoords, BASE_URL } from './shared/helpers.js';

export const options = {
  vus: 100,
  duration: '2h',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<5000'],
    // Latency should not degrade over time — compare early vs late p95
  },
};

const STUDENTS = JSON.parse(__ENV.STUDENTS || '[]');
const SESSION_ID = __ENV.SESSION_ID;

export function setup() {
  const tokenMap = {};
  for (const student of STUDENTS) {
    const token = login(student.indexNumber, student.password);
    if (token) tokenMap[student.indexNumber] = token;
  }
  return { tokenMap };
}

export default function ({ tokenMap }) {
  const student = STUDENTS[(__VU - 1) % STUDENTS.length];
  if (!student) return;

  // 80% of iterations: mark attendance
  if (Math.random() < 0.8) {
    const payload = buildMarkPayload(
      student.indexNumber,
      student.name,
      SESSION_ID,
      student.deviceFingerprint,
      jitteredCoords(5)
    );
    const res = markAttendance(payload, tokenMap?.[student.indexNumber]);

    check(res, {
      'attendance ok or duplicate': (r) => [201, 400, 409].includes(r.status),
      'no server error': (r) => r.status < 500,
    });
  }

  // 15% of iterations: check health endpoint (simulates monitoring)
  if (Math.random() < 0.15) {
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, {
      'health ok': (r) => r.status === 200,
      'db connected': (r) => {
        try { return r.json('database') === 'CONNECTED'; } catch { return false; }
      },
    });
  }

  // 5% of iterations: re-login (simulates token expiry)
  if (Math.random() < 0.05) {
    const newToken = login(student.indexNumber, student.password);
    check(newToken, { 'relogin ok': (t) => t !== null });
    if (newToken) tokenMap[student.indexNumber] = newToken;
  }

  // Think time: 2–8 seconds between iterations (realistic mobile usage)
  sleep(2 + Math.random() * 6);
}
