'use strict';
/**
 * Integration tests — attendance marking
 *
 * Requires: real PostgreSQL test DB specified in backend/.env.test
 * Run: npm run test:integration
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.test') });

const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { createTestFixture, cleanupTestFixture, disconnectPrisma, prisma } = require('../helpers/dbHelpers');
const { resetFailures } = require('../../src/lib/securityCache');

const app = createTestApp();

let fixture;

beforeAll(async () => {
  fixture = await createTestFixture();
});

afterAll(async () => {
  await cleanupTestFixture(fixture);
  await disconnectPrisma();
});

afterEach(async () => {
  // Remove attendance records so each test starts with a clean slate
  if (fixture?.session) {
    await prisma.attendance.deleteMany({ where: { sessionId: fixture.session.id } });
  }

  // Reset in-memory securityCache failure counters.
  // Without this, geofence / device-mismatch failures from one test accumulate
  // across the suite and eventually flip expected 400 responses to 423 (lockout).
  if (fixture?.student) {
    resetFailures(fixture.student.indexNumber);
  }
  // Supertest hits the server on localhost; reset all common forms of that IP.
  ['::1', '127.0.0.1', '::ffff:127.0.0.1'].forEach(ip => resetFailures(ip));
});

// Builds the base check-in payload for the fixture student.
// Uses sessionId (no QR code) so the bodyguard does a direct session lookup.
// GPS coordinates are inside the 100 m geofence around GCTU campus (Tesano, Accra).
function basePayload(overrides = {}) {
  return {
    indexNumber:       fixture.student.indexNumber,
    name:              fixture.student.name,
    deviceFingerprint: fixture.student.deviceFingerprint,
    sessionId:         fixture.session.id,
    latitude:          5.5913,   // within 100 m of classroom
    longitude:         -0.2359,
    ...overrides,
  };
}

// ─── Happy Path ───────────────────────────────────────────────────────────────

describe('POST /api/attendance/mark — happy path', () => {
  test('valid student marks attendance → 201 with attendance record', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload());

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/check-in successful/i);
    expect(res.body.attendance).toBeDefined();
    expect(res.body.attendance.sessionId).toBe(fixture.session.id);
    expect(res.body.attendance.studentId).toBe(fixture.student.id);

    // Exactly one record in DB
    const count = await prisma.attendance.count({
      where: { sessionId: fixture.session.id, studentId: fixture.student.id },
    });
    expect(count).toBe(1);
  });

  test('student within GPS jitter (5 m) of classroom → 201', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ latitude: 5.5913 + 0.00004, longitude: -0.2359 + 0.00004 }));
    expect(res.status).toBe(201);
  });
});

// ─── Duplicate / Race-condition Prevention ────────────────────────────────────

describe('POST /api/attendance/mark — duplicate prevention', () => {
  test('second sequential check-in returns 400 already-checked-in', async () => {
    await request(app).post('/api/attendance/mark').send(basePayload());

    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload());

    // Bodyguard fast-path duplicate check → 400,
    // or DB unique constraint race survivor → 409
    expect([400, 409]).toContain(res.status);
    expect(res.body.error).toMatch(/already checked in/i);
  });

  test('10 concurrent requests for the same student → exactly 1 success, 9 rejected', async () => {
    // All 10 requests hit bodyguard simultaneously.  Because the existingAttendance
    // check runs in parallel for all 10, they all pass bodyguard before the first
    // INSERT commits.  The controller then:
    //   – 1 request inserts successfully          → 201
    //   – 9 requests hit the @@unique constraint  → P2002 caught → 409
    // (If the first INSERT commits fast enough, some may instead be caught by
    //  bodyguard's existingAttendance check on the next await cycle → 400.)
    const payload = basePayload();
    const requests = Array.from({ length: 10 }, () =>
      request(app).post('/api/attendance/mark').send(payload)
    );

    const results    = await Promise.all(requests);
    const successes  = results.filter(r => r.status === 201);
    const rejections = results.filter(r => [400, 409, 423].includes(r.status));

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(9);

    // DB must contain exactly one record — no duplicates regardless of which path
    // caught the race (bodyguard fast-path or DB unique constraint).
    const dbCount = await prisma.attendance.count({
      where: { sessionId: fixture.session.id, studentId: fixture.student.id },
    });
    expect(dbCount).toBe(1);
  });
});

// ─── Geofencing ───────────────────────────────────────────────────────────────

describe('POST /api/attendance/mark — geofencing (PHYSICAL session)', () => {
  test('student 500 m away → 400 out of range', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ latitude: 5.5913 + 0.0045, longitude: -0.2359 })); // ~500 m north

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/out of range/i);
  });

  test('null GPS coordinates for PHYSICAL session → 400 location required', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ latitude: null, longitude: null }));

    // No qrCode → isQrCheckIn=false → geofencing applies → GPS required → 400
    expect(res.status).toBe(400);
  });
});

// ─── Input Validation ─────────────────────────────────────────────────────────

describe('POST /api/attendance/mark — input validation', () => {
  test('missing indexNumber → 400', async () => {
    const { indexNumber, ...rest } = basePayload();
    const res = await request(app).post('/api/attendance/mark').send(rest);
    expect(res.status).toBe(400);
  });

  test('missing both sessionId and qrCode → 400 (Zod refine)', async () => {
    const payload = basePayload();
    delete payload.sessionId;
    // No qrCode either → Zod .refine() fails
    const res = await request(app).post('/api/attendance/mark').send(payload);
    expect(res.status).toBe(400);
  });

  test('non-existent student → 400 student not found', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ indexNumber: 'GHOST99999' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('wrong device fingerprint → 400 device mismatch (or 423 if already locked)', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ deviceFingerprint: 'wrong_device_fingerprint_xyz' }));

    // 400 normally; 423 if prior test run left failure state (afterEach resets this)
    expect([400, 423]).toContain(res.status);
  });
});
