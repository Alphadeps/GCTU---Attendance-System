/**
 * Smoke Test — 5 virtual users, 30 seconds
 *
 * Purpose: verify the system is healthy before scaling up to load tests.
 *
 * Run:
 *   k6 run -e BASE_URL=https://your-api.onrender.com \
 *           -e SESSION_ID=<uuid> \
 *           -e STUDENTS='[{"indexNumber":"...","name":"...","password":"...","deviceFingerprint":"..."}]' \
 *           tests/load/smoke-test.js
 */
import { check } from 'k6';
import { login, buildMarkPayload, markAttendance } from './shared/helpers.js';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const STUDENTS = JSON.parse(__ENV.STUDENTS || '[]');
const SESSION_ID = __ENV.SESSION_ID;

export default function () {
  const student = STUDENTS[__VU % STUDENTS.length];

  const token = login(student.indexNumber, student.password);
  check(token, { 'login succeeded': (t) => t !== null });

  const payload = buildMarkPayload(
    student.indexNumber,
    student.name,
    SESSION_ID,
    student.deviceFingerprint
  );
  const res = markAttendance(payload);

  check(res, {
    'attendance: 201 or already-in (400/409)': (r) => [201, 400, 409].includes(r.status),
    'no server errors': (r) => r.status < 500,
  });
}
