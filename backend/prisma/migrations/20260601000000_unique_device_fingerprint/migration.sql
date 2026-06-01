-- Clear duplicate deviceFingerprint values before adding unique constraint.
-- For each fingerprint shared by more than one student, null all of them out
-- so the constraint can be applied and affected students can re-register.
WITH duplicates AS (
  SELECT "deviceFingerprint"
  FROM "Student"
  WHERE "deviceFingerprint" IS NOT NULL
  GROUP BY "deviceFingerprint"
  HAVING COUNT(*) > 1
)
UPDATE "Student"
SET "deviceFingerprint" = NULL
WHERE "deviceFingerprint" IN (SELECT "deviceFingerprint" FROM duplicates);

-- Add unique constraint on deviceFingerprint
CREATE UNIQUE INDEX IF NOT EXISTS "Student_deviceFingerprint_key"
  ON "Student"("deviceFingerprint");
