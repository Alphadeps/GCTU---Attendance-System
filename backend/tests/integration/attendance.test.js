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
  // Remove any attendance records created during the test
  if (fixture?.session) {
    await prisma.attendance.deleteMany({ where: { sessionId: fixture.session.id } });
  }
});

function basePayload(overrides = {}) {
  return {
    indexNumber: fixture.student.indexNumber,
    name: fixture.student.name,
    deviceFingerprint: fixture.student.deviceFingerprint,
    sessionId: fixture.session.id,
    latitude: 5.5913,   // within 100m of classroom
    longitude: -0.2359,
    ...overrides
  };
}

// ─── Happy Path ───────────────────────────────────────────────────────────────

describe('POST /api/attendance/mark — happy path', () => {
  test('valid student marks attendance → 201 with attendance record', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload());

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Check-in successful/i);
    expect(res.body.attendance).toBeDefined();
    expect(res.body.attendance.sessionId).toBe(fixture.session.id);
    expect(res.body.attendance.studentId).toBe(fixture.student.id);

    // Exactly 1 record in DB
    const count = await prisma.attendance.count({ where: { sessionId: fixture.session.id, studentId: fixture.student.id } });
    expect(count).toBe(1);
  });

  test('student within 5m of classroom (GPS jitter) → 201', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ latitude: 5.5913 + 0.00004, longitude: -0.2359 + 0.00004 }));
    expect(res.status).toBe(201);
  });
});

// ─── Duplicate Check-in ───────────────────────────────────────────────────────

describe('POST /api/attendance/mark — duplicate prevention', () => {
  test('second sequential check-in → 400 already checked in', async () => {
    await request(app).post('/api/attendance/mark').send(basePayload());

    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload());

    expect([400, 409]).toContain(res.status);
    expect(res.body.error).toMatch(/already checked in/i);
  });

  test('10 CONCURRENT requests for same student → exactly 1 success, rest rejected', async () => {
    const payload = basePayload();
    const requests = Array.from({ length: 10 }, () =>
      request(app).post('/api/attendance/mark').send(payload)
    );

    const results = await Promise.all(requests);
    const successes = results.filter(r => r.status === 201);
    const rejections = results.filter(r => [400, 409, 423].includes(r.status));

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(9);

    // DB must contain exactly 1 record
    const dbCount = await prisma.attendance.count({
      where: { sessionId: fixture.session.id, studentId: fixture.student.id }
    });
    expect(dbCount).toBe(1);
  });
});

// ─── Geofence ────────────────────────────────────────────────────────────────

describe('POST /api/attendance/mark — geofencing', () => {
  test('student 500m away → 400 out of range', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ latitude: 5.5913 + 0.0045, longitude: -0.2359 })); // ~500m north

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/out of range/i);
  });

  test('missing GPS coordinates for PHYSICAL session → 400', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ latitude: null, longitude: null }));

    expect(res.status).toBe(400);
  });
});

// ─── Validation ──────────────────────────────────────────────────────────────

describe('POST /api/attendance/mark — input validation', () => {
  test('missing indexNumber → 400', async () => {
    const { indexNumber, ...rest } = basePayload();
    const res = await request(app).post('/api/attendance/mark').send(rest);
    expect(res.status).toBe(400);
  });

  test('missing sessionId and qrCode → 400', async () => {
    const payload = basePayload();
    delete payload.sessionId;
    const res = await request(app).post('/api/attendance/mark').send(payload);
    expect(res.status).toBe(400);
  });

  test('non-existent student → 400', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ indexNumber: 'NONEXISTENT9999' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('wrong device fingerprint → 400 device mismatch', async () => {
    const res = await request(app)
      .post('/api/attendance/mark')
      .send(basePayload({ deviceFingerprint: 'wrong_device_fingerprint_xyz' }));
    expect([400, 423]).toContain(res.status);
  });
});
