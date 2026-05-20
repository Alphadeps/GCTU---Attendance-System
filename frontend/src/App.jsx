import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import Pages
import LoginPage from './pages/LoginPage';
import RepDashboard from './pages/RepDashboard';
import SessionManager from './pages/SessionManager';
import StudentPortal from './pages/StudentPortal';
import LecturerPortal from './pages/LecturerPortal';
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/student" element={<StudentPortal />} />

      {/* SUPERADMIN Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['SUPERADMIN']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Protected REP Routes */}
      <Route
        path="/rep/dashboard"
        element={
          <ProtectedRoute allowedRoles={['REP', 'ADMIN']}>
            <RepDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rep/session/:id"
        element={
          <ProtectedRoute allowedRoles={['REP', 'ADMIN']}>
            <SessionManager />
          </ProtectedRoute>
        }
      />

      {/* Protected LECTURER Routes */}
      <Route
        path="/lecturer"
        element={
          <ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}>
            <LecturerPortal />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
