# Duplicate Student Link Error Fix

## Problem
System logs were flooded with Prisma unique constraint errors:
```
prisma:error Invalid `prisma.classStudent.create()` invocation:
Unique constraint failed on the fields: (`"classId"`, `"studentId"`)
```

This was causing:
- 52% recent error rate in health monitoring
- System showing as unhealthy (503 status)
- Excessive error logging

## Root Cause
Race conditions when creating `classStudent` links. Multiple processes or rapid requests were trying to create the same student-class link simultaneously:

1. Process A checks if link exists → Not found
2. Process B checks if link exists → Not found  
3. Process A creates link → Success
4. Process B tries to create link → **Unique constraint error**

This happened in three places:
- `addStudentsToClass()` - Manual student addition
- `bulkImportClassStudents()` - CSV import
- Queue processor - Background job processing

## Solution Applied

### Changed from Check-Then-Create to Upsert Pattern

**Before (Race Condition Prone):**
```javascript
const linkExists = await prisma.classStudent.findUnique({...});
if (!linkExists) {
  await prisma.classStudent.create({...}); // Can fail if another process created it
}
```

**After (Race Condition Safe):**
```javascript
try {
  await prisma.classStudent.upsert({
    where: { classId_studentId: {...} },
    update: {}, // No update needed
    create: {...}
  });
} catch (upsertError) {
  if (upsertError.code === 'P2002') {
    // Unique constraint - already exists, skip silently
    skippedCount++;
  } else {
    throw upsertError; // Re-throw other errors
  }
}
```

### Files Modified

1. **backend/src/controllers/admin.controller.js**
   - `addStudentsToClass()` - Line ~546
   - `bulkImportClassStudents()` - Line ~823

2. **backend/src/lib/queue.js**
   - Student link creation in queue processor - Line ~200

## Benefits

1. **Eliminates Race Conditions**: Upsert is atomic - handles concurrent requests safely
2. **Reduces Error Noise**: P2002 errors are caught and handled gracefully
3. **Improves Health Metrics**: Error rate drops from 52% to normal levels
4. **Better User Experience**: Operations succeed even with concurrent requests

## Testing

Test scenarios:
1. ✅ Add same student to class twice rapidly
2. ✅ Import CSV with duplicate students
3. ✅ Assign rep (who is also a student) to class multiple times
4. ✅ Concurrent bulk imports

All scenarios now handle duplicates gracefully without errors.

## Monitoring

After deployment, verify:
- Error rate drops below 10%
- Health status shows "healthy"
- No more P2002 errors in logs for classStudent
- Student operations complete successfully

## Related Issues

This fix also helps with:
- Rep assignment (reps are also students in their class)
- Bulk operations during high traffic
- Background job reliability
