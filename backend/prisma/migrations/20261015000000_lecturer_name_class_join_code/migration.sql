-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN "lecturerName" TEXT;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN "joinCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Class_joinCode_key" ON "Class"("joinCode");
