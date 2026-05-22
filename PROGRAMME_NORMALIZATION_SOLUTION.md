# Programme Name Normalization & Duplicate Cleanup Solution

## Problem Statement

When bulk uploading class representatives, the system was auto-creating programme records for every variation of programme names found in the Excel file. This resulted in 15+ duplicate programmes instead of the intended 3 official programmes.

### Example Duplicates Found:
- **BIT variations**: "BIT", "BSc Information Technology", "Bsc. Information Technology", "BSc.Information Technology"
- **BNSA variations**: "BNSA", "BSc.Network &System Admin", "BSc. Networking And Systems Administration"
- **DIT variations**: "DIT", "Diploma in Information Technology", "Diploma Information Technology"

## Solution Overview

The solution consists of three main components:

### 1. Programme Name Mapper (`backend/src/lib/programmeMapper.js`)
A normalization library that:
- Defines 3 official programme names
- Maps all variations to official names (case-insensitive, punctuation-insensitive)
- Provides validation and suggestion functions

**Official Programme Names:**
- `Bachelor of Information Technology (BIT)`
- `BSc Networking and Systems Administration (BNSA)`
- `Diploma in Information Technology (DIT)`

### 2. Enhanced Bulk Upload (`backend/src/controllers/admin.controller.js`)
Updated the `bulkUploadReps` function to:
- Normalize programme names before creating/finding programmes
- Validate programme names against official list
- Provide helpful error messages with suggestions for invalid names
- Prevent creation of duplicate programmes

**Changes:**
```javascript
// Before: Auto-created any programme name
let programme = await prisma.programme.findUnique({ where: { name: programmeName } });
if (!programme && programmeName) {
  programme = await prisma.programme.create({ data: { name: programmeName } });
}

// After: Normalizes and validates first
const normalizedProgrammeName = normalizeProgrammeName(programmeName);
if (!normalizedProgrammeName) {
  // Skip with error message and suggestions
  continue;
}
let programme = await prisma.programme.findUnique({ where: { name: normalizedProgrammeName } });
if (!programme) {
  programme = await prisma.programme.create({ data: { name: normalizedProgrammeName } });
}
```

### 3. Duplicate Cleanup Tool (`POST /admin/programmes/cleanup-duplicates`)
A one-time cleanup endpoint that:
- Identifies all duplicate programmes
- Creates official programmes if they don't exist
- Merges classes from duplicates to official programmes
- Updates class displayNames to use official programme names
- Deletes duplicate programme records
- Returns detailed report of actions taken

**Cleanup Process:**
1. Scan all programmes and identify duplicates
2. Create official programmes if missing
3. Reassign all classes from duplicates to official programmes
4. Update class displayNames with official programme names
5. Delete duplicate programme records
6. Return detailed report

### 4. Frontend UI (`frontend/src/pages/admin/SuperAdminDashboard.jsx`)
Added a "Cleanup Duplicates" button in the Programmes tab that:
- Only appears when there are more than 3 programmes
- Shows confirmation dialog before cleanup
- Displays progress and results
- Refreshes programmes and classes lists after cleanup

## How to Use

### For Existing Database (Cleanup Required):

1. **Login as SuperAdmin**
2. **Navigate to "Programmes" tab**
3. **Click "Cleanup Duplicates" button** (appears if you have more than 3 programmes)
4. **Confirm the action**
5. **Review the results**

The system will:
- Merge all duplicate programmes into 3 official ones
- Reassign all classes to the correct programmes
- Update all class names to use official programme names
- Show a detailed report of what was merged

### For Future Bulk Uploads:

The system now automatically:
- Normalizes programme names from Excel files
- Maps variations to official names
- Rejects invalid programme names with suggestions
- Prevents creation of duplicate programmes

**Example:**
- Excel has "Bsc. Information Technology" → System creates/uses "Bachelor of Information Technology (BIT)"
- Excel has "BSc.Network &System Admin" → System creates/uses "BSc Networking and Systems Administration (BNSA)"
- Excel has "Invalid Programme" → System rejects with error message

## Technical Details

### Programme Mapper Functions:

```javascript
// Normalize a programme name
normalizeProgrammeName("Bsc. Information Technology")
// Returns: "Bachelor of Information Technology (BIT)"

// Check if valid
isValidProgramme("BIT")
// Returns: true

// Get suggestions
getSuggestions("information tech")
// Returns: ["Bachelor of Information Technology (BIT)"]

// Get official programmes
getOfficialProgrammes()
// Returns: ["Bachelor of Information Technology (BIT)", "BSc Networking and Systems Administration (BNSA)", "Diploma in Information Technology (DIT)"]
```

### API Endpoints:

**Cleanup Duplicates:**
```
POST /admin/programmes/cleanup-duplicates
Authorization: Bearer <superadmin-token>

Response:
{
  "success": true,
  "message": "Cleanup complete: 12 duplicates merged, 12 deleted",
  "report": {
    "totalProgrammes": 15,
    "officialProgrammes": [...],
    "duplicates": [...],
    "merged": [...],
    "errors": [],
    "summary": {
      "officialProgrammesCount": 3,
      "duplicatesFound": 12,
      "duplicatesMerged": 12,
      "duplicatesDeleted": 12,
      "errorsCount": 0
    }
  }
}
```

## Benefits

1. **Data Consistency**: All programmes use official, standardized names
2. **No More Duplicates**: Bulk uploads can't create duplicate programmes
3. **Better Organization**: Only 3 programmes instead of 15+
4. **Accurate Reporting**: Stats and reports show correct programme counts
5. **User-Friendly**: Helpful error messages guide users to correct programme names
6. **One-Click Cleanup**: Easy to fix existing duplicate issues

## Files Modified

### Backend:
- `backend/src/lib/programmeMapper.js` (NEW) - Normalization library
- `backend/src/controllers/admin.controller.js` - Updated bulk upload + added cleanup function
- `backend/src/routes/admin.routes.js` - Added cleanup route

### Frontend:
- `frontend/src/pages/admin/SuperAdminDashboard.jsx` - Added cleanup button and handler

## Testing Checklist

- [ ] Bulk upload with various programme name formats
- [ ] Verify programmes are normalized correctly
- [ ] Test cleanup button appears when >3 programmes exist
- [ ] Run cleanup and verify duplicates are merged
- [ ] Verify classes are reassigned correctly
- [ ] Check class displayNames are updated
- [ ] Verify old duplicate programmes are deleted
- [ ] Test with invalid programme names in bulk upload
- [ ] Verify error messages and suggestions work

## Future Enhancements

1. **Admin UI for Programme Mapping**: Allow admins to add custom mappings
2. **Preview Before Cleanup**: Show what will be merged before confirming
3. **Undo Functionality**: Allow reverting cleanup if needed
4. **Audit Log**: Track all programme merges and changes
5. **Bulk Edit**: Allow editing multiple programme names at once

---

**Status**: ✅ COMPLETE - Ready for testing and deployment
**Date**: May 22, 2026
**Task**: Programme Normalization & Duplicate Cleanup
