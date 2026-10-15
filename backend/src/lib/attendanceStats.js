const prisma = require('./prisma');

/**
 * Count PRESENT/LATE attendances per student across the given sessions in a single query.
 * Returns a Map of studentId -> count (students with no matching rows are absent from the map).
 *
 * Replaces the old pattern of one prisma.attendance.count() per student inside Promise.all,
 * which fired N concurrent queries and exhausted the database connection limit.
 */
async function countPresentByStudent(sessionIds) {
  const counts = new Map();
  if (!sessionIds || sessionIds.length === 0) return counts;

  const rows = await prisma.attendance.groupBy({
    by: ['studentId'],
    where: {
      sessionId: { in: sessionIds },
      status: { in: ['PRESENT', 'LATE'] }
    },
    _count: { _all: true }
  });

  for (const row of rows) counts.set(row.studentId, row._count._all);
  return counts;
}

module.exports = { countPresentByStudent };
