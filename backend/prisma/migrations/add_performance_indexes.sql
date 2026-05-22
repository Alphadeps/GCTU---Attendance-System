-- Performance Optimization: Add Indexes to Frequently Queried Fields
-- This migration adds indexes to improve query performance across the system
-- Run this manually on your production database

-- User table indexes
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
CREATE INDEX IF NOT EXISTS "User_username_role_idx" ON "User"("username", "role");

-- Student table indexes
CREATE INDEX IF NOT EXISTS "Student_indexNumber_idx" ON "Student"("indexNumber");
CREATE INDEX IF NOT EXISTS "Student_email_idx" ON "Student"("email");
CREATE INDEX IF NOT EXISTS "Student_isFirstLogin_idx" ON "Student"("isFirstLogin");

-- AttendanceSession table indexes
CREATE INDEX IF NOT EXISTS "AttendanceSession_courseId_idx" ON "AttendanceSession"("courseId");
CREATE INDEX IF NOT EXISTS "AttendanceSession_repId_idx" ON "AttendanceSession"("repId");
CREATE INDEX IF NOT EXISTS "AttendanceSession_classId_idx" ON "AttendanceSession"("classId");
CREATE INDEX IF NOT EXISTS "AttendanceSession_status_idx" ON "AttendanceSession"("status");
CREATE INDEX IF NOT EXISTS "AttendanceSession_startTime_idx" ON "AttendanceSession"("startTime");
CREATE INDEX IF NOT EXISTS "AttendanceSession_approvedByLecturerId_idx" ON "AttendanceSession"("approvedByLecturerId");
CREATE INDEX IF NOT EXISTS "AttendanceSession_courseId_classId_status_idx" ON "AttendanceSession"("courseId", "classId", "status");
CREATE INDEX IF NOT EXISTS "AttendanceSession_repId_status_idx" ON "AttendanceSession"("repId", "status");

-- Attendance table indexes
CREATE INDEX IF NOT EXISTS "Attendance_sessionId_idx" ON "Attendance"("sessionId");
CREATE INDEX IF NOT EXISTS "Attendance_studentId_idx" ON "Attendance"("studentId");
CREATE INDEX IF NOT EXISTS "Attendance_status_idx" ON "Attendance"("status");
CREATE INDEX IF NOT EXISTS "Attendance_checkInTime_idx" ON "Attendance"("checkInTime");
CREATE INDEX IF NOT EXISTS "Attendance_sessionId_studentId_idx" ON "Attendance"("sessionId", "studentId");
CREATE INDEX IF NOT EXISTS "Attendance_studentId_status_idx" ON "Attendance"("studentId", "status");

-- Notification table indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_studentIndex_idx" ON "Notification"("studentIndex");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- Class table indexes
CREATE INDEX IF NOT EXISTS "Class_programmeId_idx" ON "Class"("programmeId");
CREATE INDEX IF NOT EXISTS "Class_level_idx" ON "Class"("level");
CREATE INDEX IF NOT EXISTS "Class_repId_idx" ON "Class"("repId");
CREATE INDEX IF NOT EXISTS "Class_programmeId_level_idx" ON "Class"("programmeId", "level");
CREATE INDEX IF NOT EXISTS "Class_level_type_session_idx" ON "Class"("level", "type", "session");

-- ClassStudent table indexes
CREATE INDEX IF NOT EXISTS "ClassStudent_classId_idx" ON "ClassStudent"("classId");
CREATE INDEX IF NOT EXISTS "ClassStudent_studentId_idx" ON "ClassStudent"("studentId");

-- Grievance table indexes
CREATE INDEX IF NOT EXISTS "Grievance_studentIndex_idx" ON "Grievance"("studentIndex");
CREATE INDEX IF NOT EXISTS "Grievance_status_idx" ON "Grievance"("status");
CREATE INDEX IF NOT EXISTS "Grievance_type_idx" ON "Grievance"("type");
CREATE INDEX IF NOT EXISTS "Grievance_resolvedById_idx" ON "Grievance"("resolvedById");
CREATE INDEX IF NOT EXISTS "Grievance_createdAt_idx" ON "Grievance"("createdAt");
CREATE INDEX IF NOT EXISTS "Grievance_status_type_idx" ON "Grievance"("status", "type");

-- OfficialReport table indexes
CREATE INDEX IF NOT EXISTS "OfficialReport_classId_idx" ON "OfficialReport"("classId");
CREATE INDEX IF NOT EXISTS "OfficialReport_courseId_idx" ON "OfficialReport"("courseId");
CREATE INDEX IF NOT EXISTS "OfficialReport_generatedById_idx" ON "OfficialReport"("generatedById");
CREATE INDEX IF NOT EXISTS "OfficialReport_signedById_idx" ON "OfficialReport"("signedById");
CREATE INDEX IF NOT EXISTS "OfficialReport_status_idx" ON "OfficialReport"("status");
CREATE INDEX IF NOT EXISTS "OfficialReport_classId_courseId_idx" ON "OfficialReport"("classId", "courseId");
CREATE INDEX IF NOT EXISTS "OfficialReport_status_createdAt_idx" ON "OfficialReport"("status", "createdAt");

-- LecturerAssignment table indexes
CREATE INDEX IF NOT EXISTS "LecturerAssignment_lecturerId_idx" ON "LecturerAssignment"("lecturerId");
CREATE INDEX IF NOT EXISTS "LecturerAssignment_classId_idx" ON "LecturerAssignment"("classId");
CREATE INDEX IF NOT EXISTS "LecturerAssignment_courseId_idx" ON "LecturerAssignment"("courseId");
CREATE INDEX IF NOT EXISTS "LecturerAssignment_lecturerId_classId_idx" ON "LecturerAssignment"("lecturerId", "classId");
CREATE INDEX IF NOT EXISTS "LecturerAssignment_classId_courseId_idx" ON "LecturerAssignment"("classId", "courseId");

-- Analyze tables to update statistics for query planner
ANALYZE "User";
ANALYZE "Student";
ANALYZE "AttendanceSession";
ANALYZE "Attendance";
ANALYZE "Notification";
ANALYZE "Class";
ANALYZE "ClassStudent";
ANALYZE "Grievance";
ANALYZE "OfficialReport";
ANALYZE "LecturerAssignment";
