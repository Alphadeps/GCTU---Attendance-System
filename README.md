# 🎓 GCTU Class Attendance System

A premium, state-of-the-art **Class Attendance System** designed specifically for university environments (e.g., Ghana Communication Technology University). The system is built with robust security mechanisms to prevent student proxy attendance, track live locations, verify classroom-specific Wi-Fi networks, and handle automated administrative notifications and report generation.

---

## 🚀 System Overview

The Class Attendance System enables Class Representatives (REPs) to open secure, location-fenced, and network-restricted attendance sessions. Students scan dynamically rotating QR codes (JWT-encoded) or check in using their GPS coordinates. The session is closed automatically or manually, and absent students are auto-marked. Lecturers then review the session and sign off digitally. Administrators (SUPERADMIN/ADMIN) manage programmes, classes, courses, student lists (with CSV import), reps, and universal system settings.

```mermaid
flowchain
    Rep[Class Representative] -->|1. Opens Session| API[Backend API]
    API -->|2. Generates dynamic QR code| RepPortal[Rep Dashboard]
    Student[Student Mobile Device] -->|3. Scans QR / Verifies GPS & SSID| API
    Student -->|4. Checks Device Fingerprint| API
    Rep -->|5. Closes Session| API
    API -->|6. Auto-marks Absent Students| DB[(PostgreSQL)]
    Lecturer[Lecturer Portal] -->|7. Reviews & Digitally Signs| API
    Admin[Admin Panel] -->|Configures Rules / System settings| API
```

---

## 🔒 Security & Anti-Proxy Architecture

To prevent students from marking attendance for their absent peers (proxying), the system implements four layers of verification:

1. **Device Fingerprinting**
   - Every student device generates a unique device fingerprint upon check-in.
   - The fingerprint is bound to the student's index number on their first check-in.
   - If a student tries to log in or check in from a device already used by another student, the system blocks the request.
   - If a student's current device fingerprint doesn't match their registered fingerprint, the check-in is rejected (requiring an administrator to reset it).

2. **Dynamic JWT QR Codes**
   - Rather than static QR codes, the system generates JWT-encoded QR code tokens that rotate dynamically at a configured interval (e.g., every 25–30 seconds).
   - Students must scan the live, active QR code. Shared screenshots or photos taken minutes earlier will be rejected as expired.

3. **Geofencing (Haversine Formula Verification)**
   - For physical sessions, the system captures the student's GPS location via their browser.
   - The backend uses the **Haversine formula** to calculate the exact distance (in meters) between the classroom's coordinates and the student's coordinates.
   - If the student is outside the allowed radius (e.g., 100 meters), check-in is denied.

4. **Wi-Fi SSID Matching**
   - Administrators or Reps can specify the target classroom Wi-Fi Network Name (SSID).
   - The student's device must be connected to the specified Wi-Fi network to check in, adding a layer of physical proof of presence.

---

## ✨ Features

### 👥 Multi-Role User Management
- **SUPERADMIN / ADMIN**: Full read/write access to system parameters. Manage programs, classes, reps, courses, and view sitewide analytics.
- **LECTURER**: Review concluced attendance sheets, inspect student attendance rates, sign off and approve sessions digitally.
- **REP (Class Representative)**: Open new sessions, refresh QR codes, close active sessions, monitor check-ins in real-time, and view class-specific course analytics.
- **STUDENT**: Access the public portal to scan QR codes, check in using location/SSID, view personal attendance logs, and receive alerts.

### 📊 Course Analytics & The 75% Rule
- Concluded courses track each student's attendance percentage.
- Students whose attendance falls below the university-mandated **75% threshold** are flagged as "At Risk."
- Reps and admins can broadcast warning notifications directly to all "At-Risk" students via the system notification system.

### 📑 Document & Report Exports
- Export complete, audited attendance sheets to **PDF** (complete with course info, metadata, and the Lecturer's digital signature).
- Export attendance metrics to **Excel (XLSX)** for institutional archiving.

### 🔔 Real-Time Notifications
- Background notification dispatch when:
  - A session is successfully opened.
  - A student checks in (notifying both the student and the Rep).
  - A session is closed (notifying the Rep of statistics, and alerting Lecturers that approvals are pending).
  - A session is signed/approved by a Lecturer (notifying the Rep).
  - An at-risk student is warned about low attendance.

---

## 🛠️ Technology Stack

### Backend
- **Node.js** with **Express.js** (API framework)
- **Prisma Client** (ORM for database communications)
- **PostgreSQL** (Relational Database)
- **JWT (JsonWebTokens)** (Securing API routes and verifying rotating QR codes)
- **Bcrypt.js** (Hashing user passwords)
- **Multer** (Handling multipart file uploads like logos)
- **Nodemon** (Development hot-reloader)

### Frontend
- **React.js** (UI library)
- **Vite** (Next-generation frontend tooling and bundler)
- **Tailwind CSS** (Utility-first styling framework)
- **React Router Dom** (Client-side routing)
- **jsQR** (Frontend QR code decoding from video feed/camera streams)
- **jsPDF & jsPDF-AutoTable** (Client-side PDF compilation)
- **XLSX (SheetJS)** (Client-side Excel workbook parsing and creation)
- **Axios** (HTTP client)

---

## 🗄️ Database Schema (Prisma Models)

The relational schema is configured in `backend/prisma/schema.prisma` and contains the following core models:

### 1. `User`
Tracks administrators, lecturers, and class representatives.
- `id` (UUID, Primary Key)
- `username` (Unique String)
- `password` (Hashed String)
- `role` (Enum: `SUPERADMIN`, `ADMIN`, `REP`, `LECTURER`)
- `isActive` (Boolean, default true)
- Relations: `createdSessions`, `approvedSessions`, `notifications`, `assignedClass`.

### 2. `Student`
Tracks student identification and device security lock.
- `id` (UUID, Primary Key)
- `indexNumber` (Unique String)
- `name` (String)
- `email` (Unique String)
- `deviceFingerprint` (Nullable String, binds device to index number)
- Relations: `attendances`, `classes`.

### 3. `Course`
System-wide academic modules.
- `id` (UUID, Primary Key)
- `name` (Unique String)
- `code` (Unique String)
- Relations: `sessions`, `classes` (through ClassCourse join table).

### 4. `Class`
Academic group groupings (e.g. "BIT Level 300 Evening Group B").
- `id` (UUID, Primary Key)
- `programmeId` (Relations to `Programme`)
- `level` (e.g., "100", "200", "300", "400")
- `type` (e.g., "REGULAR", "TOP-UP")
- `group` (e.g., "A", "B")
- `session` (e.g., "MORNING", "EVENING", "WEEKEND")
- `displayName` (Auto-generated representation string)
- `repId` (Nullable Unique reference to a `User` of role `REP`)
- Relations: `students`, `courses`, `sessions`.

### 5. `AttendanceSession`
Created whenever a class starts tracking attendance.
- `id` (UUID, Primary Key)
- `courseId` (References `Course`)
- `repId` (References `User` who opened it)
- `classId` (Nullable Reference to `Class`)
- `sessionType` (Enum: `PHYSICAL`, `ONLINE`)
- `startTime` (DateTime)
- `endTime` (DateTime)
- `status` (Enum: `OPEN`, `CLOSED`, `APPROVED`)
- `latitude` / `longitude` (Nullable Float coordinates of classroom)
- `qrCode` (String token)
- `qrCodeExpiry` (DateTime expiry timestamp)
- `networkSSID` (Nullable String name of Wi-Fi)
- `lecturerSignature` (Nullable Base64 data URI of signature)
- `approvedByLecturerId` (Nullable Reference to `User` who approved)
- `approvedAt` (Nullable DateTime of approval)

### 6. `Attendance`
Check-in records for students.
- `id` (UUID, Primary key)
- `sessionId` (References `AttendanceSession`)
- `studentId` (References `Student`)
- `checkInTime` (DateTime)
- `status` (Enum: `PRESENT`, `ABSENT`, `LATE`)
- `ipAddress` (String)
- `deviceInfo` (String browser details)
- `locationData` (Nullable JSON containing check-in coordinates)

### 7. `SystemSettings`
Globally defined operation parameters.
- `id` (UUID, Primary Key)
- `deptName` (String name of institution)
- `deptLogoUrl` (Nullable String)
- `lateWindowMinutes` (Grace period before student is marked LATE, default 15)
- `qrExpirySeconds` (Rotating QR interval, default 30)
- `geofenceRadiusMeters` (Allowed distance radius, default 100)

---

## 📡 API Documentation

### 🔐 Authentication Routes (`/api/auth`)
- **`POST /api/auth/register`** (Public) - Create user accounts (Admin/Lecturer/Rep).
- **`POST /api/auth/login`** (Public) - Authenticate user, yields JWT access token.
- **`GET /api/auth/me`** (Protected) - Retrieves current logged-in user profile details.

### ⏱️ Session Routes (`/api/sessions`)
- **`POST /api/sessions`** (Protected, Role: REP/ADMIN) - Open a new attendance session.
- **`GET /api/sessions/active`** (Public) - Retrieve currently active `OPEN` sessions.
- **`GET /api/sessions/:id`** (Protected, Role: REP/LECTURER/ADMIN) - Retrieve session metadata along with list of checked-in student attendances.
- **`PATCH /api/sessions/:id/close`** (Protected, Role: REP/ADMIN) - Terminate active session and auto-mark eligible students who failed to check in as `ABSENT`.
- **`POST /api/sessions/:id/refresh-qr`** (Protected, Role: REP/ADMIN) - Manually generate a new JWT QR code token and expiry timestamp for the session.
- **`PATCH /api/sessions/:id/approve`** (Protected, Role: LECTURER/ADMIN) - Approve and close a session using a base64 digital signature.

### 📝 Attendance Routes (`/api/attendance`)
- **`POST /api/attendance/mark`** (Public) - Check in a student. Inspects device fingerprint, QR code expiration, geofence coordinates, Wi-Fi SSID, and grace period window to log attendance.
- **`GET /api/attendance/session/:sessionId`** (Protected) - Fetch checking list for session.
- **`GET /api/attendance/student/:indexNumber`** (Protected) - Retrieve personal check-in history.
- **`PATCH /api/attendance/:id/status`** (Protected) - Manually override attendance status (`PRESENT`, `ABSENT`, `LATE`).

### 📚 Course Routes (`/api/courses`)
- **`POST /api/courses`** (Protected, Role: REP/ADMIN/SUPERADMIN) - Register a new course module.
- **`GET /api/courses`** (Protected) - Fetch all registered courses (Scoped to REP's class if applicable).
- **`GET /api/courses/:id/analytics`** (Protected) - Retrieve attendance metrics for all class students, identifying safe or at-risk rates.
- **`POST /api/courses/:id/warn-at-risk`** (Protected, Role: REP/ADMIN/SUPERADMIN) - Broadcast warning notifications to students below the 75% attendance threshold.
- **`DELETE /api/courses/:id`** (Protected, Role: ADMIN/SUPERADMIN) - Delete a course.

### ⚙️ Admin Routes (`/api/admin`)
- **`GET /api/admin/settings`** (Protected) - Get universal settings parameters.
- **`PATCH /api/admin/settings`** (Protected, Role: SUPERADMIN) - Save settings adjustments.
- **`POST /api/admin/settings/logo`** (Protected, Role: SUPERADMIN) - Upload logo file.
- **`GET /api/admin/stats`** (Protected, Role: SUPERADMIN) - Retrieve system-wide count indicators.
- **`POST /api/admin/programmes`** / **`GET`** / **`DELETE`** (Protected, Role: SUPERADMIN) - Programme administration.
- **`POST`** / **`GET`** / **`PATCH`** / **`DELETE /api/admin/classes`** (Protected, Role: SUPERADMIN) - Class administration.
- **`POST /api/admin/classes/:id/assign-rep`** (Protected, Role: SUPERADMIN) - Link a Class Representative user to a class.
- **`POST /api/admin/classes/:id/students/bulk-import`** (Protected, Role: SUPERADMIN) - Parse and import student records from a CSV file to a class.

---

## 🖥️ Frontend Architecture & Pages

The client application includes interactive dashboards tailored for each user role:

- **Login Page (`/`)**: Core access panel with roles separation.
- **Student Portal (`/student`)**: Scan QR codes utilizing the device camera, toggle physical check-ins, verify locations/SSIDs, and view check-in history.
- **Rep Dashboard (`/rep/dashboard`)**: Monitor active sessions, open new sessions, browse assigned courses, view student analytics graphs, and trigger warning broadcasts.
- **Session Manager (`/rep/session/:id`)**: Displays the live dynamically rotating QR code (with remaining seconds counter), shows real-time check-in stats, lists present students, and contains the "Close Session" trigger.
- **Lecturer Portal (`/lecturer`)**: Search for closed classes, review student lists, download PDF/Excel sheets, and sign on a digital signature pad to lock and approve reports.
- **SuperAdmin Dashboard (`/admin`)**: A comprehensive configuration hub split into panels:
  - *Dashboard Stats*: Displays active courses, classes, registered students, and active sessions.
  - *Programmes & Classes*: Define degrees and create level groups.
  - *Courses Management*: Add and bind courses to levels.
  - *Representatives*: Register Rep accounts, reset passwords, or deactivate logins.
  - *Student Import*: Manage student registers and import via CSV files.
  - *Settings*: Update logo, grace times, geofencing radii, and rotating QR durations.

---

## ⚙️ Setup and Configuration

### Prerequisites
- Node.js installed (v18 or higher recommended)
- PostgreSQL database server running locally or hosted online

### 📦 Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Alphadeps/GCTU---Attendance-System.git
   cd GCTU---Attendance-System
   ```

2. **Backend Configuration**
   - Navigate to the `backend` directory:
     ```bash
     cd backend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Create a `.env` file in the root of the `backend` folder and add your connection variables:
     ```env
     PORT=5000
     DATABASE_URL="postgresql://user:password@localhost:5432/attendance_db?schema=public"
     JWT_SECRET="your_secure_jwt_secret_key"
     ```

3. **Prisma Setup**
   - Generate the Prisma Client and run database migrations:
     ```bash
     npx prisma migrate dev --name init
     ```

4. **Seed the Database**
   - Load pre-configured dummy data (programs, classes, courses, students, and default users):
     ```bash
     npm run seed
     ```

5. **Frontend Configuration**
   - Open a new terminal and navigate to the `frontend` directory:
     ```bash
     cd ../frontend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Build or run in development mode:
     ```bash
     npm run dev
     ```

---

## 🔑 Default Credentials (from Seeder)

Once you seed the database, you can log in immediately using these configurations:

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `admin123` | System settings, DB administration, user/class creation |
| **Lecturer** | `lecturer1` | `password123` | Reviews completed attendance lists and digitally signs them |
| **Class Rep** | `rep1` | `password123` | Assigned to *BIT Level 300 Group B*. Opens and manages active sessions |
| **Demo Student** | Index: `2526430213` | *N/A (Public)* | Used to check in via the public student check-in portal |
