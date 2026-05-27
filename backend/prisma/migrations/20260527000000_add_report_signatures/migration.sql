-- AlterTable
ALTER TABLE "OfficialReport" ADD COLUMN "repSignature" TEXT;
ALTER TABLE "OfficialReport" ADD COLUMN "repSignedAt" TIMESTAMP(3);
ALTER TABLE "OfficialReport" ADD COLUMN "lecturerSignature" TEXT;
ALTER TABLE "OfficialReport" ADD COLUMN "submittedToDeptAt" TIMESTAMP(3);

-- Update existing records: change SIGNED to APPROVED
UPDATE "OfficialReport" SET status = 'APPROVED' WHERE status = 'SIGNED';

