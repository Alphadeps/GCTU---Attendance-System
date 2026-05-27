# How to Clear All Data and Start Fresh

This guide explains how to clear all data from your Class Attendance System and start with a clean slate.

## 🎯 Quick Start (Recommended Method)

If you want to clear all data but **keep your admin access**, run this command:

```bash
cd backend
npm run db:clear:keep-admin
```

This will:
- ✅ Delete all students, lecturers, reps, courses, classes, attendance records
- ✅ Keep your SUPERADMIN account(s) so you can still log in
- ✅ Create default system settings
- ✅ Create a default superadmin if none exists (username: `superadmin`, password: `admin123`)

## 📋 Available Commands

### 1. Clear Data (Keep Admin) - **RECOMMENDED**
```bash
npm run db:clear:keep-admin
```
Deletes everything except SUPERADMIN accounts.

### 2. Clear All Data (Complete Reset)
```bash
npm run db:clear
```
⚠️ **WARNING**: Deletes EVERYTHING including admin accounts!

### 3. Backup Database
```bash
npm run db:backup
```
Creates a backup before clearing (recommended).

### 4. Restore Database
```bash
npm run db:restore
```
Restores from a previous backup.

## 🔄 Step-by-Step Process

### Method A: Safe Clear (Keeps Admin Access)

1. **Navigate to backend folder**:
   ```bash
   cd backend
   ```

2. **Optional: Create a backup first**:
   ```bash
   npm run db:backup
   ```

3. **Clear the data**:
   ```bash
   npm run db:clear:keep-admin
   ```

4. **Verify the output** - You should see:
   ```
   ✅ Deleted X students
   ✅ Deleted X lecturers
   ✅ Deleted X attendance records
   ... etc
   ✅ Kept 1 existing superadmin account(s)
   ```

5. **Log in to your system** with your existing superadmin credentials

6. **Start fresh setup**:
   - Create programmes (BIT, BSc CS, etc.)
   - Create classes (levels, groups, sessions)
   - Add courses
   - Import students
   - Create lecturer and rep accounts

### Method B: Complete Reset (No Admin)

1. **Navigate to backend folder**:
   ```bash
   cd backend
   ```

2. **Optional: Create a backup first**:
   ```bash
   npm run db:backup
   ```

3. **Clear all data**:
   ```bash
   npm run db:clear
   ```

4. **The database is now completely empty**

5. **Create a new superadmin account** through your application's setup process

## 🔐 Default Superadmin Credentials

If no superadmin exists after running `db:clear:keep-admin`, the script creates one:

- **Username**: `superadmin`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change this password immediately after first login!

## 📊 What Gets Deleted

When you run the clear scripts, the following data is removed:

| Data Type | Deleted? |
|-----------|----------|
| Students | ✅ Yes |
| Lecturers | ✅ Yes (except SUPERADMIN in keep-admin mode) |
| Admins | ✅ Yes (except SUPERADMIN in keep-admin mode) |
| Reps | ✅ Yes |
| Courses | ✅ Yes |
| Classes | ✅ Yes |
| Programmes | ✅ Yes |
| Attendance Sessions | ✅ Yes |
| Attendance Records | ✅ Yes |
| Notifications | ✅ Yes |
| Grievances | ✅ Yes |
| Reports | ✅ Yes |
| System Settings | ✅ Yes (recreated with defaults) |
| SUPERADMIN accounts | ❌ No (in keep-admin mode) |

## ⚠️ Important Warnings

1. **This action cannot be undone** - Always backup first if you might need the data later
2. **All student attendance history will be lost** - Make sure you've exported any reports you need
3. **All uploaded files remain** - The scripts only clear database records, not uploaded files in `public/uploads/`
4. **Test in development first** - Don't run this on production without testing

## 🛠️ Troubleshooting

### "Cannot find module '../generated/prisma'"
Run:
```bash
npm run build
```

### "Database connection error"
Check your `.env` file has the correct `DATABASE_URL`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

### "Permission denied"
Make sure PostgreSQL is running and you have the correct credentials.

### Script runs but no data is deleted
- Check that you're connected to the correct database
- Verify the DATABASE_URL in your `.env` file
- Check the console output for any error messages

## 📝 After Clearing Data

Once you've cleared the data, here's what you need to set up:

1. **Log in as superadmin**
2. **Configure system settings** (if needed)
3. **Create programmes** (BIT, BSc CS, etc.)
4. **Create classes** for each programme
5. **Add courses** to the system
6. **Assign courses to classes**
7. **Import students** (bulk upload via Excel)
8. **Create lecturer accounts**
9. **Assign lecturers to courses**
10. **Create rep accounts** and assign to classes

## 🔗 Related Documentation

- [Database Management Scripts README](./backend/scripts/README.md)
- [Backup and Restore Guide](./backend/scripts/README.md#4-backup-databasejs---backup-database)

## 💡 Tips

- **Backup regularly** - Set up automated backups before clearing data
- **Export reports first** - Generate and download any attendance reports you need
- **Document your setup** - Keep notes on your programme/class structure for easy recreation
- **Use Excel templates** - Prepare student import files in advance
- **Test the process** - Try clearing and setting up in a development environment first

## 🆘 Need Help?

If you encounter issues:
1. Check the error message in the console
2. Verify your database connection
3. Ensure all dependencies are installed (`npm install`)
4. Check the [scripts README](./backend/scripts/README.md) for more details
