import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import StudentLoginPage from './pages/StudentLoginPage';
import JoinClassPage from './pages/JoinClassPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import RepDashboard from './pages/RepDashboard';
import SessionManager from './pages/SessionManager';
import StudentPortal from './pages/StudentPortal';
import LecturerPortal from './pages/LecturerPortal';
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { token, role, needsPasswordChange } = useAuth();

  if (!token) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace state={{ accessDenied: true }} />;
  }
  // Reps on a temporary password must set their own before using the app
  if (needsPasswordChange && (role === 'REP' || role === 'ADMIN')) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

// Change-password screen: any logged-in staff member
const ChangePasswordRoute = () => {
  const { token, role } = useAuth();
  if (!token || !['REP', 'ADMIN', 'SUPERADMIN', 'LECTURER'].includes(role)) return <Navigate to="/" replace />;
  return <ChangePasswordPage />;
};

// Public Route Component - redirects authenticated users to their dashboard
const PublicRoute = ({ children }) => {
  const { token, role } = useAuth();

  if (token && role) {
    // Redirect authenticated users to appropriate dashboard
    if (role === 'SUPERADMIN') {
      return <Navigate to="/admin" replace />;
    } else if (role === 'LECTURER') {
      return <Navigate to="/lecturer" replace />;
    } else if (role === 'REP' || role === 'ADMIN') {
      return <Navigate to="/rep/dashboard" replace />;
    } else if (role === 'STUDENT') {
      return <Navigate to="/student" replace />;
    }
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      {/* Students join a class with the code their rep shares (public, no login) */}
      <Route path="/join" element={<JoinClassPage />} />
      <Route path="/join/:code" element={<JoinClassPage />} />
      <Route
        path="/student-login"
        element={
          <PublicRoute>
            <StudentLoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <StudentPortal />
          </ProtectedRoute>
        }
      />

      {/* SUPERADMIN Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['SUPERADMIN']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/change-password"
        element={<ChangePasswordRoute />}
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
