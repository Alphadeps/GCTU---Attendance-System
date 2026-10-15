const prisma = require('./prisma');

/**
 * Make sure a rep is also a student of their own class, so their own attendance is counted.
 * Reuses the student record for the rep's index number if there is one (e.g. they joined
 * with the class link) and never changes its details; otherwise creates one with no password,
 * which the rep can set later through the join link. Returns the student, or null if the rep
 * has no index number.
 */
async function ensureRepStudent({ id, indexNumber, fullName, username }, classId, db = prisma) {
  if (!indexNumber) return null;

  let student = await db.student.findUnique({ where: { indexNumber } });
  if (!student) {
    student = await db.student.create({
      data: {
        indexNumber,
        name: fullName || username,
        email: `${indexNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}.${id.slice(0, 8)}@rep.gctu.edu.gh`
      }
    });
  }

  await db.classStudent.upsert({
    where: { classId_studentId: { classId, studentId: student.id } },
    update: {},
    create: { classId, studentId: student.id }
  });
  return student;
}

module.exports = { ensureRepStudent };
