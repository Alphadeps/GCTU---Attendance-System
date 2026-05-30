/**
 * Shared k6 helpers — import in every load test script
 *
 * Usage:
 *   import { BASE_URL, buildMarkPayload, login, markAttendance } from './shared/helpers.js';
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

// ── Configuration ──────────────────────────────────────────────────────────
// Override with k6 env vars:  k6 run -e BASE_URL=https://your-api.onrender.com script.js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:10000';

// Classroom coordinates (GCTU Tesano campus approximation)
const CLASS_LAT = 5.5913;
const CLASS_LON = -0.2359;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Return coordinates jittered ±jitterMetres around the classroom centre */
export function jitteredCoords(jitterMetres = 10) {
  const degreesPerMetre = 1 / 111320;
  const jitter = () => (Math.random() - 0.5) * 2 * jitterMetres * degreesPerMetre;
  return { latitude: CLASS_LAT + jitter(), longitude: CLASS_LON + jitter() };
}

/** Log in as a student; returns the accessToken string or null on failure */
export function login(indexNumber, password) {
  const res = http.post(
    `${BASE_URL}/api/student-auth/login`,
    JSON.stringify({ indexNumber, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) return null;
  return res.json('accessToken');
}

/** Build the attendance mark payload for a given student and session */
export function buildMarkPayload(indexNumber, studentName, sessionId, deviceFingerprint, coordsOverride) {
  const coords = coordsOverride || jitteredCoords(5);
  return {
    indexNumber,
    name: studentName,
    deviceFingerprint,
    sessionId,
    latitude: coords.latitude,
    longitude: coords.longitude
  };
}

/**
 * Mark attendance for a student.
 * @param {object} payload  - attendance payload
 * @param {string} [token]  - optional Bearer token (not used by the public endpoint but useful for extended tests)
 * @returns {Response}
 */
export function markAttendance(payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return http.post(
    `${BASE_URL}/api/attendance/mark`,
    JSON.stringify(payload),
    { headers }
  );
}

/** Tiny random sleep between minMs and maxMs to simulate human behaviour */
export function humanDelay(minMs = 500, maxMs = 3000) {
  sleep((minMs + Math.random() * (maxMs - minMs)) / 1000);
}
