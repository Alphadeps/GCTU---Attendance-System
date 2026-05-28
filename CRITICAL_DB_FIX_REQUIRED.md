# 🔴 CRITICAL: Production Database Fix Required

**Date:** May 28, 2026  
**Status:** URGENT - Reports endpoints down  
**Severity:** HIGH

---

## Problem

Production database is missing the `submittedToDeptAt` column in the `OfficialReport` table, causing all report endpoints to fail with 500 errors.

### Error Message
```
PrismaClientKnownRequestError: Invalid `prisma.officialReport.findMany()` invocation:
The column `OfficialReport.submittedToDeptAt` does not exist in the current database.
Code: P2022
```

### Affected Endpoints
- ❌ `GET /api/reports/pending` - 500 errors
- ❌ All report-related endpoints

### Evidence from Logs
```
2026-05-28 00:19:59 [error]: Get pending reports error: PrismaClientKnownRequestError
2026-05-28 00:20:01 ⚠️  Slow/Error Response: GET /api/reports/pending - 500 - 752ms
2026-05-28 00:20:03 ⚠️  Slow/Error Response: GET /api/reports/pending - 500 - 662ms
```

---

## Solution

### Step 1: Connect to Production Database

```bash
# Use your Render PostgreSQL connection string
psql $DATABASE_URL
```

### Step 2: Execute Migration SQL

The fix is already prepared in: `backend/prisma/migrations/MANUAL_FIX_submittedToDeptAt.sql`

```sql
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
```

### Step 3: Verify Column Exists

```sql
-- Check the table structure
\d "OfficialReport"

-- Should show submittedToDeptAt column
```

### Step 4: Restart Application

On Render:
1. Go to your service dashboard
2. Click "Manual Deploy" → "Clear build cache & deploy"
3. Or wait for automatic restart (may take a few minutes)

### Step 5: Test the Fix

```bash
# Test the endpoint
curl https://class-attendance-backend-o80x.onrender.com/api/reports/pending

# Should return 200 OK with report data (or empty array)
```

---

## Root Cause

The migration file exists but was never executed on the production database. This likely happened because:

1. The migration was created as a manual SQL file (not a Prisma migration)
2. It wasn't included in the automated deployment process
3. The schema was updated in code but not in the database

---

## Prevention

### 1. Add to Deployment Script

Update your deployment process to run migrations:

```json
// package.json
{
  "scripts": {
    "deploy": "prisma migrate deploy && node src/index.js"
  }
}
```

### 2. Pre-Deployment Check

Create a script to verify schema matches database:

```javascript
// scripts/verify-schema.js
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function verifySchema() {
  try {
    // Try to query with all expected columns
    await prisma.officialReport.findFirst({
      select: { submittedToDeptAt: true }
    });
    console.log('✅ Schema verification passed');
  } catch (error) {
    console.error('❌ Schema mismatch:', error.message);
    process.exit(1);
  }
}

verifySchema();
```

### 3. CI/CD Pipeline Check

Add to your CI/CD:

```yaml
# .github/workflows/deploy.yml
- name: Verify Database Schema
  run: npm run verify-schema
```

---

## Timeline

- **2026-05-27**: Migration file created
- **2026-05-28 00:19:59**: First error detected in production
- **2026-05-28 00:20:03**: Multiple failed requests confirmed
- **2026-05-28**: Issue documented, fix prepared

---

## Next Steps

1. ✅ Execute the SQL migration on production database
2. ✅ Restart the application
3. ✅ Verify endpoints are working
4. ✅ Add schema verification to deployment process
5. ✅ Monitor logs for any related issues

---

## Contact

If you need help executing this fix:
1. Access Render dashboard
2. Go to your PostgreSQL database
3. Use the "Connect" button to get connection details
4. Run the SQL commands above

**This is a simple, safe fix that only adds a missing column and updates existing data.**
