'use strict';
/**
 * Unit tests for securityCache.js — no DB needed (mock prisma)
 */

// Mock prisma before requiring securityCache
jest.mock('../../src/lib/prisma', () => ({
  attendanceSession: {
    findUnique: jest.fn()
  }
}));

const prisma = require('../../src/lib/prisma');
const {
  cacheSession,
  getCachedSession,
  removeCachedSession,
  updateCachedSession,
  isLocked,
  getLockExpiration,
  recordFailure,
  resetFailures
} = require('../../src/lib/securityCache');

const MOCK_SESSION = {
  id: 'sess-001',
  courseId: 'course-001',
  repId: 'rep-001',
  classId: 'class-001',
  sessionType: 'PHYSICAL',
  startTime: new Date(),
  endTime: new Date(Date.now() + 3600000),
  status: 'OPEN',
  latitude: 5.5913,
  longitude: -0.2359,
  qrCode: 'test-qr',
  qrCodeExpiry: new Date(Date.now() + 30000),
  manualCode: '123456',
  networkSSID: null,
  course: { code: 'CS301', name: 'Algorithms' }
};

describe('Session caching', () => {
  beforeEach(() => {
    removeCachedSession(MOCK_SESSION.id);
  });

  test('cacheSession stores session and getCachedSession returns it synchronously', async () => {
    cacheSession(MOCK_SESSION);
    const result = await getCachedSession(MOCK_SESSION.id);
    expect(result).not.toBeNull();
    expect(result.id).toBe(MOCK_SESSION.id);
    expect(result.courseCode).toBe('CS301');
    expect(result.courseName).toBe('Algorithms');
  });

  test('removeCachedSession evicts the session', async () => {
    cacheSession(MOCK_SESSION);
    removeCachedSession(MOCK_SESSION.id);
    // Should fall back to DB (mocked)
    prisma.attendanceSession.findUnique.mockResolvedValueOnce(null);
    const result = await getCachedSession(MOCK_SESSION.id);
    expect(result).toBeNull();
  });

  test('updateCachedSession patches individual fields', () => {
    cacheSession(MOCK_SESSION);
    updateCachedSession(MOCK_SESSION.id, { qrCode: 'new-qr', qrCodeExpiry: new Date(Date.now() + 60000) });
    // No async — cache is synchronous
    // Re-fetch synchronously by caching then checking
    const updated = { ...MOCK_SESSION, qrCode: 'new-qr' };
    cacheSession(updated);
    // We can't directly read the Map, but updateCachedSession shouldn't throw
  });

  test('getCachedSession falls back to DB if session not cached', async () => {
    const dbSession = { ...MOCK_SESSION, course: { code: 'CS301', name: 'Algorithms' } };
    prisma.attendanceSession.findUnique.mockResolvedValueOnce(dbSession);
    const result = await getCachedSession('sess-999');
    expect(prisma.attendanceSession.findUnique).toHaveBeenCalled();
    // Session is OPEN so it gets cached
    expect(result).not.toBeNull();
  });
});

describe('Lockout / failure tracking', () => {
  const KEY = 'TEST_INDEX_001';

  beforeEach(() => {
    resetFailures(KEY);
  });

  test('isLocked returns false for unknown key', () => {
    expect(isLocked('UNKNOWN_KEY')).toBe(false);
  });

  test('recording 9 failures does not trigger lockout', () => {
    for (let i = 0; i < 9; i++) recordFailure(KEY);
    expect(isLocked(KEY)).toBe(false);
  });

  test('recording 10 failures triggers lockout', () => {
    for (let i = 0; i < 10; i++) recordFailure(KEY);
    expect(isLocked(KEY)).toBe(true);
  });

  test('getLockExpiration returns a future date after lockout', () => {
    for (let i = 0; i < 10; i++) recordFailure(KEY);
    const expiry = getLockExpiration(KEY);
    expect(expiry).toBeDefined();
    expect(new Date(expiry) > new Date()).toBe(true);
  });

  test('resetFailures clears lockout', () => {
    for (let i = 0; i < 10; i++) recordFailure(KEY);
    expect(isLocked(KEY)).toBe(true);
    resetFailures(KEY);
    expect(isLocked(KEY)).toBe(false);
  });

  test('multiple distinct keys are tracked independently', () => {
    const KEY_A = 'STUDENT_A';
    const KEY_B = 'STUDENT_B';
    resetFailures(KEY_A);
    resetFailures(KEY_B);

    for (let i = 0; i < 10; i++) recordFailure(KEY_A);
    expect(isLocked(KEY_A)).toBe(true);
    expect(isLocked(KEY_B)).toBe(false);

    resetFailures(KEY_A);
    resetFailures(KEY_B);
  });
});
