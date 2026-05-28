-- Manual fix for production database
-- Run this if the migration hasn't been applied automatically

-- Add the missing column
ALTER TABLE "OfficialReport" ADD COLUMN IF NOT EXISTS "submittedToDeptAt" TIMESTAMP(3);

-- Update existing SIGNED reports to APPROVED and set submittedToDeptAt
UPDATE "OfficialReport" 
SET 
  status = 'APPROVED',
  "submittedToDeptAt" = "signedAt"
WHERE status = 'SIGNED' AND "signedAt" IS NOT NULL;

-- Verify the changes
SELECT 
  id, 
  status, 
  "signedAt", 
  "submittedToDeptAt",
  "createdAt"
FROM "OfficialReport"
ORDER BY "createdAt" DESC
LIMIT 10;
