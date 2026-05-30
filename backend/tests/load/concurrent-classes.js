/**
 * Concurrent Classes — University-wide peak load
 *
 * Simulates 20 classes starting simultaneously (typical 8am Monday):
 *   - 20 × 100 students = 2,000 virtual users
 *   - Each class gets its own session ID
 *   - Students distributed across classes
 *   - Mixed workload: login + mark + session view
 *
 * Run:
 *   k6 run -e BASE_URL=https://your-api.onrender.com \
 *           -e SESSIONS='["uuid1","uuid2",...]'  (20 session UUIDs) \
 *           -e STUDENTS='[...]'                  (2000 student objects) \
 *           tests/load/concurrent-classes.js
 */
import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { login, buildMarkPayload, markAttendance, jitteredCoords, BASE_URL } from './shared/helpers.js';

export const options = {
  scenarios: {
    university_peak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 2000 },  // 2 minutes to ramp up all 20 classes
        { duration: '8m', target: 2000 },  // 8 minutes at peak (window stays open)
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<8000'],     // wider window for university-wide load
    'checks{scenario:login}': ['rate>=0.95'],
    'checks{scenario:mark}': ['rate>=0.95'],
  },
};

const SESSIONS = JSON.parse(__ENV.SESSIONS || '[]');  // array of 20 session UUIDs
const STUDENTS = JSON.parse(__ENV.STUDENTS || '[]');

export function setup() {
  const tokenMap = {};
  for (const student of STUDENTS) {
    const token = login(student.indexNumber, student.password);
    if (token) tokenMap[student.indexNumber] = token;
  }
  return { tokenMap };
}

export default function ({ tokenMap }) {
  const vuIndex = __VU - 1;
  const student = STUDENTS[vuIndex % STUDENTS.length];
  const sessionId = SESSIONS[vuIndex % SESSIONS.length];
  if (!student || !sessionId) return;

  // Group A: Login (first iteration only — token already fetched in setup, but include for latency tracking)
  group('login', () => {
    check(tokenMap?.[student.indexNumber], {
      'has token': (t) => !!t,
    });
  });

  // Small delay — students arrive at the classroom over 5 minutes
  sleep(Math.random() * 30);

  // Group B: Mark Attendance
  group('mark', () => {
    const payload = buildMarkPayload(
      student.indexNumber,
      student.name,
      sessionId,
      student.deviceFingerprint,
      jitteredCoords(10)
    );
    const res = markAttendance(payload, tokenMap?.[student.indexNumber]);

    check(res, {
      'mark succeeded or already in': (r) => [201, 400, 409].includes(r.status),
      'no 5xx': (r) => r.status < 500,
    });
  });

  // Group C: Check session status (REPs / lecturers viewing attendance)
  if (vuIndex % 20 === 0 && tokenMap?.[student.indexNumber]) {
    group('session_view', () => {
      const res = http.get(`${BASE_URL}/api/attendance/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${tokenMap[student.indexNumber]}` }
      });
      check(res, { 'session view ok': (r) => r.status === 200 || r.status === 403 });
    });
  }
}
