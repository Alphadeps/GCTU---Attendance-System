-- AlterTable
ALTER TABLE "OfficialReport" ADD COLUMN "repSignature" TEXT;
ALTER TABLE "OfficialReport" ADD COLUMN "repSignedAt" TIMESTAMP(3);
ALTER TABLE "OfficialReport" ADD COLUMN "lecturerSignature" TEXT;
