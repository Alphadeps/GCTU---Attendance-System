-- One-time password reset codes for students
ALTER TABLE "Student" ADD COLUMN "resetCodeHash" TEXT;
ALTER TABLE "Student" ADD COLUMN "resetCodeExpires" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "resetCodeTries" INTEGER NOT NULL DEFAULT 0;
