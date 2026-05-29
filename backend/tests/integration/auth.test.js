'use strict';
/**
 * Integration tests — student authentication
 *
 * Requires: real PostgreSQL test DB specified in backend/.env.test
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.test') });

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createTestApp } = require('../helpers/testApp');
const { prisma, disconnectPrisma } = require('../helpers/dbHelpers');

const app = createTestApp();

let testStudent;

beforeAll(async () => {
  testStudent = await prisma.student.create({
    data: {
      indexNumber: 'AUTH_TEST_001',
      name: 'Auth Test Student',
      email: 'auth_test_001@test.gctu.edu.gh',
      password: await bcrypt.hash('Correct@Pass1', 10),
      isFirstLogin: false
    }
  });
});

afterAll(async () => {
  await prisma.student.deleteMany({ where: { indexNumber: 'AUTH_TEST_001' } });
  await disconnectPrisma();
});

describe('POST /api/student-auth/login', () => {
  test('valid credentials → 200 with accessToken', async () => {
    const res = await request(app)
      .post('/api/student-auth/login')
      .send({ indexNumber: 'AUTH_TEST_001', password: 'Correct@Pass1' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    // Refresh token should be set as httpOnly cookie
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('wrong password → 401', async () => {
    const res = await request(app)
      .post('/api/student-auth/login')
      .send({ indexNumber: 'AUTH_TEST_001', password: 'WrongPassword' });

    expect(res.status).toBe(401);
  });

  test('non-existent student → 404 or 401', async () => {
    const res = await request(app)
      .post('/api/student-auth/login')
      .send({ indexNumber: 'GHOST_99999', password: 'anything' });

    expect([401, 404]).toContain(res.status);
  });

  test('missing password field → 400', async () => {
    const res = await request(app)
      .post('/api/student-auth/login')
      .send({ indexNumber: 'AUTH_TEST_001' });

    expect(res.status).toBe(400);
  });

  test('missing indexNumber field → 400', async () => {
    const res = await request(app)
      .post('/api/student-auth/login')
      .send({ password: 'Correct@Pass1' });

    expect(res.status).toBe(400);
  });
});
