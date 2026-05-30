/**
 * Single Class Rush — PRIMARY load test
 *
 * Simulates one class of up to 300 students all marking attendance within
 * the first 30 seconds of a session opening — the most common real-world failure scenario.
 *
 * Run:
 *   k6 run -e BASE_URL=https://your-api.onrender.com \
 *           -e SESSION_ID=<uuid> \
 *           -e STUDENTS='[...]' \
 *           tests/load/single-class-rush.js
 *
 * Pass criteria (thresholds below):
 *   - http_req_failed < 2%        (only valid: geofence misses, duplicates — never 5xx)
 *   - p(99) response time < 5s
 *   - check "attendance created"  >= 98%
 */
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { login, buildMarkPayload, markAttendance, jitteredCoords } from './shared/helpers.js';

export const options = {
  scenarios: {
    class_rush: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 300 },   // ramp up: all students opening phones
        { duration: '30s', target: 300 },   // hold: everyone marking simultaneously
        { duration: '10s', target: 0 },     // ramp down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],          // <2% failures (5xx + network errors)
    http_req_duration: ['p(99)<5000'],       // 99th percentile under 5 seconds
    'checks{type:attendance_created}': ['rate>=0.98'],  // ≥98% succeed
  },
};

const STUDENTS = JSON.parse(__ENV.STUDENTS || '[]');
const SESSION_ID = __ENV.SESSION_ID;

// Track each VU's token so we don't re-login on every iteration
const tokens = {};

export function setup() {
  // Pre-login all students so the rush test only measures mark latency
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

  // Stagger start slightly to simulate real human behaviour (0–3s random delay)
  sleep(Math.random() * 3);

  const coords = jitteredCoords(8); // ±8m GPS jitter
  const payload = buildMarkPayload(
    student.indexNumber,
    student.name,
    SESSION_ID,
    student.deviceFingerprint,
    coords
  );

  const res = markAttendance(payload, tokenMap?.[student.indexNumber]);

  const created = check(res, {
    'attendance_created': (r) => r.status === 201,
  }, { type: 'attendance_created' });

  check(res, {
    'not a server error': (r) => r.status < 500,
    'no duplicate in db': (r) => r.status !== 500,  // P2002 should be 409, never 500
  });

  // 15% retry simulation (mobile network drop)
  if (!created && Math.random() < 0.15) {
    sleep(0.5);
    const retryRes = markAttendance(payload);
    check(retryRes, { 'retry not 5xx': (r) => r.status < 500 });
  }
}
