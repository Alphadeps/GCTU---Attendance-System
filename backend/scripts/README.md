# Database Management Scripts

This folder contains scripts for managing the Class Attendance System database.

## Available Scripts

### 1. `create-db.js` - Create Database
Creates the PostgreSQL database if it doesn't exist.

```bash
node scripts/create-db.js
```

### 2. `clear-all-data.js` - Clear All Data (Complete Reset)
**⚠️ WARNING: This will delete ALL data including admin accounts!**

Deletes all records from all tables in the database. Use this when you want a completely fresh start.

```bash
node scripts/clear-all-data.js
```

**What it deletes:**
- All students and their attendance records
- All lecturers and their assignments
- All admins and reps
- All courses and classes
- All attendance sessions
- All notifications
- All grievances
- All reports
- System settings

**After running this script:**
- You will need to create a new superadmin account
- The database will be completely empty
- You'll need to set up all data from scratch

### 3. `clear-data-keep-admin.js` - Clear Data (Keep Superadmin)
**⚠️ WARNING: This will delete most data but keeps superadmin accounts!**

Deletes all data except SUPERADMIN accounts. This is the **recommended** option for starting fresh while maintaining system access.

```bash
node scripts/clear-data-keep-admin.js
```

**What it deletes:**
- All students and their attendance records
- All lecturers and their assignments
- All admins (except SUPERADMIN) and reps
- All courses and classes
- All attendance sessions
- All notifications
- All grievances
- All reports

**What it keeps:**
- SUPERADMIN accounts (so you can still log in)

**What it creates:**
- Default system settings
- If no superadmin exists, creates one with:
  - Username: `superadmin`
  - Password: `admin123`
  - ⚠️ **Change this password immediately after first login!**

### 4. `backup-database.js` - Backup Database
Creates a backup of the entire database.

```bash
node scripts/backup-database.js
```

### 5. `restore-database.js` - Restore Database
Restores the database from a backup file.

```bash
node scripts/restore-database.js
```

## Recommended Workflow for Fresh Start

### Option A: Keep Your Admin Account (Recommended)

1. **Backup first** (optional but recommended):
   ```bash
   node scripts/backup-database.js
   ```

2. **Clear data while keeping superadmin**:
   ```bash
   node scripts/clear-data-keep-admin.js
   ```

3. **Log in with your existing superadmin account** and start setting up:
   - Create programmes
   - Create classes
   - Add courses
   - Import students
   - Create lecturers and reps

### Option B: Complete Fresh Start

1. **Backup first** (optional but recommended):
   ```bash
   node scripts/backup-database.js
   ```

2. **Clear all data**:
   ```bash
   node scripts/clear-all-data.js
   ```

3. **Run migrations** to recreate tables:
   ```bash
   npx prisma migrate deploy
   ```

4. **Create a new superadmin account** through your application's registration or use a seed script

## Safety Tips

1. **Always backup before clearing data** - You can't undo these operations!
2. **Run in development first** - Test the scripts in a development environment
3. **Verify your DATABASE_URL** - Make sure you're connected to the right database
4. **Check the output** - The scripts show what they're deleting
5. **Use `clear-data-keep-admin.js`** - This is safer as you won't lose access to the system

## Troubleshooting

### "Cannot delete records due to foreign key constraint"
The scripts delete data in the correct order to handle foreign keys. If you still see this error:
- Make sure you're using the latest version of the script
- Check if there are any custom constraints in your database

### "No superadmin found after clearing"
If using `clear-data-keep-admin.js` and no superadmin exists:
- The script will automatically create one with username `superadmin` and password `admin123`
- Change this password immediately after logging in

### "Database connection error"
- Check your `.env` file has the correct `DATABASE_URL`
- Ensure PostgreSQL is running
- Verify network connectivity to the database

## Environment Variables

Make sure your `.env` file contains:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

## Need Help?

If you encounter issues:
1. Check the error message carefully
2. Verify your database connection
3. Ensure all dependencies are installed (`npm install`)
4. Check that Prisma client is generated (`npx prisma generate`)
