-- Drop device fingerprint index and column
DROP INDEX IF EXISTS "Student_deviceFingerprint_key";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "deviceFingerprint";

-- Add proxy attendance tracking fields
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "markedBy" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "markReason" TEXT;
