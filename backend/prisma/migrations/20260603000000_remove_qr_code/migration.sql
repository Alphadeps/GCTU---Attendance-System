-- Remove QR code columns from AttendanceSession (replaced by geofencing + manual code fallback)
ALTER TABLE "AttendanceSession" DROP COLUMN IF EXISTS "qrCode";
ALTER TABLE "AttendanceSession" DROP COLUMN IF EXISTS "qrCodeExpiry";

-- Remove QR expiry setting from SystemSettings
ALTER TABLE "SystemSettings" DROP COLUMN IF EXISTS "qrExpirySeconds";
