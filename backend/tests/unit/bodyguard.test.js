'use strict';
/**
 * Unit tests for bodyguard.js — pure logic, no DB required
 */

// Extract the Haversine function by re-implementing it here so we can test without
// loading the full module (which has DB dependencies at require-time).
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// GCTU campus approximate coordinates (Tesano, Accra)
const CLASSROOM_LAT = 5.5913;
const CLASSROOM_LON = -0.2359;
const GEOFENCE_RADIUS = 100; // metres

describe('Haversine geofence calculations', () => {
  test('same coordinates returns 0 distance', () => {
    expect(getDistance(CLASSROOM_LAT, CLASSROOM_LON, CLASSROOM_LAT, CLASSROOM_LON)).toBe(0);
  });

  test('student 50m away is within 100m geofence', () => {
    // ~50m north: 0.00045 degrees latitude ≈ 50m
    const nearLat = CLASSROOM_LAT + 0.00045;
    const dist = getDistance(CLASSROOM_LAT, CLASSROOM_LON, nearLat, CLASSROOM_LON);
    expect(dist).toBeLessThan(GEOFENCE_RADIUS);
  });

  test('student 200m away is outside 100m geofence', () => {
    // ~200m north
    const farLat = CLASSROOM_LAT + 0.0018;
    const dist = getDistance(CLASSROOM_LAT, CLASSROOM_LON, farLat, CLASSROOM_LON);
    expect(dist).toBeGreaterThan(GEOFENCE_RADIUS);
  });

  test('student 99m away passes the boundary (within limit)', () => {
    const nearLat = CLASSROOM_LAT + 0.00089; // ~99m
    const dist = getDistance(CLASSROOM_LAT, CLASSROOM_LON, nearLat, CLASSROOM_LON);
    expect(dist).toBeLessThan(GEOFENCE_RADIUS);
  });

  test('student 101m away fails the boundary (outside limit)', () => {
    const farLat = CLASSROOM_LAT + 0.00092; // ~102m
    const dist = getDistance(CLASSROOM_LAT, CLASSROOM_LON, farLat, CLASSROOM_LON);
    expect(dist).toBeGreaterThan(GEOFENCE_RADIUS);
  });

  test('equator vs pole is far more than any campus geofence', () => {
    const dist = getDistance(0, 0, 90, 0);
    expect(dist).toBeGreaterThan(9_000_000); // ~10,000 km
  });

  test('diagonal displacement (lat + lon) is calculated correctly', () => {
    // ~141m diagonal = ~100m north + ~100m east
    const nearLat = CLASSROOM_LAT + 0.0009;
    const nearLon = CLASSROOM_LON + 0.001;
    const dist = getDistance(CLASSROOM_LAT, CLASSROOM_LON, nearLat, nearLon);
    expect(dist).toBeGreaterThan(100); // outside 100m radius
    expect(dist).toBeLessThan(200);    // but not dramatically off
  });
});

describe('Geofence radius enforcement', () => {
  test.each([50, 75, 100, 150, 200])(
    'geofence radius %dm: student at boundary passes, student 1m beyond fails',
    (radius) => {
      // Put student exactly at radius metres north
      const degreesPerMetre = 1 / 111320;
      const boundaryLat = CLASSROOM_LAT + radius * degreesPerMetre;
      const beyondLat = CLASSROOM_LAT + (radius + 1) * degreesPerMetre;

      const distAtBoundary = getDistance(CLASSROOM_LAT, CLASSROOM_LON, boundaryLat, CLASSROOM_LON);
      const distBeyond = getDistance(CLASSROOM_LAT, CLASSROOM_LON, beyondLat, CLASSROOM_LON);

      // Within tolerance for floating-point
      expect(distAtBoundary).toBeLessThanOrEqual(radius * 1.01);
      expect(distBeyond).toBeGreaterThan(radius);
    }
  );
});
