/**
 * Spike Test — Instant 500-user burst
 *
 * Models the worst case: a lecturer announces "mark attendance NOW" and all
 * 500 students tap at exactly the same millisecond.
 *
 * Run:
 *   k6 run -e BASE_URL=https://your-api.onrender.com \
 *           -e SESSION_ID=<uuid> \
 *           -e STUDENTS='[...]' \
 *           tests/load/spike-test.js
 */
import { check } from 'k6';
import { buildMarkPayload, markAttendance, login, jitteredCoords } from './shared/helpers.js';

export const options = {
  scenarios: {
    instant_spike: {
      executor: 'shared-iterations',
      vus: 500,
      iterations: 500,       // each VU runs exactly once — simulates a one-shot burst
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],         // allow up to 5% failure under extreme spike
    http_req_duration: ['p(95)<10000'],     // 10s is acceptable for a 500-user instant spike
    'checks{type:no_5xx}': ['rate>=0.98'],  // server must not crash
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

  const payload = buildMarkPayload(
    student.indexNumber,
    student.name,
    SESSION_ID,
    student.deviceFingerprint,
    jitteredCoords(5)
  );

  const res = markAttendance(payload, tokenMap?.[student.indexNumber]);

  check(res, {
    'no_5xx': (r) => r.status < 500,
    'responded': (r) => r.status > 0,
  }, { type: 'no_5xx' });
}
