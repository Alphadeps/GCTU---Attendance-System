-- Migration: Add unique constraint on Attendance(sessionId, studentId)
-- This prevents duplicate check-in records at the database level.
-- The unique constraint also serves as the index, so we drop the old non-unique index first.

-- Drop old non-unique composite index (if it exists)
DROP INDEX IF EXISTS "Attendance_sessionId_studentId_idx";

-- Add unique constraint — a single student can only appear once per session
ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_sessionId_studentId_key"
  UNIQUE ("sessionId", "studentId");
