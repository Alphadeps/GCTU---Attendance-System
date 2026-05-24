import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ─── Icon helpers ────────────────────────────────────────────────────────── */
const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>
);
const LightningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────── */

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const accessDenied = location.state?.accessDenied === true;

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;
      auth.login({
        token,
        role: user.role,
        username: user.username,
        needsPasswordChange: user.needsPasswordChange,
        assignedClass: user.assignedClass || null,
        dept_name: user.dept_name || null,
        dept_logo: user.dept_logo || null,
      });
      if (user.role === 'SUPERADMIN') navigate('/admin');
      else if (user.role === 'LECTURER') navigate('/lecturer');
      else if (user.role === 'REP' || user.role === 'ADMIN') navigate('/rep/dashboard');
      else setErrorMsg('Unauthorized role. Contact support.');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid credentials or connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">

      {/* ══════════════════════ LEFT PANEL ══════════════════════ */}
      <div
        className="login-left animate-slide-left"
        style={{ background: 'linear-gradient(135deg, #0c2340 0%, #1a3c6d 100%)' }}
      >
        {/* Decorative background blobs */}
        <div
          className="login-blob"
          style={{
            width: 340, height: 340,
            background: 'rgba(255,255,255,0.05)',
            top: -80, right: -80,
          }}
        />
        <div
          className="login-blob"
          style={{
            width: 200, height: 200,
            background: 'rgba(255,255,255,0.07)',
            bottom: 60, left: -60,
          }}
        />
        <div
          className="login-blob"
          style={{
            width: 120, height: 120,
            background: 'rgba(229,169,60,0.10)',
            bottom: 200, right: 40,
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>

          {/* Logo */}
          <div className="animate-fade-in-down" style={{ textAlign: 'center' }}>
            <img
              src="/logo2.png"
              alt="GCTU Logo"
              style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: '1rem' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* Heading */}
          <div className="animate-fade-in-up" style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#fff',
              margin: '0 0 8px 0',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
              textShadow: '0 2px 16px rgba(0,0,0,.3)',
            }}>
              Welcome Back
            </h1>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.65)',
              margin: 0,
              letterSpacing: '.3px',
              fontWeight: 500,
            }}>
              GCTU Smart Attendance System
            </p>
          </div>

          {/* Admin Login Bot Image */}
          <div className="animate-float" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <img
              src="/admin login bot.png"
              alt="Admin Login Bot"
              style={{ width: '80%', maxWidth: '280px', height: 'auto', objectFit: 'contain' }}
            />
          </div>

          {/* Bottom caption */}
          <p className="animate-fade-in delay-600" style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
            margin: 0,
            letterSpacing: '.3px',
          }}>
            Ghana Communication Technology University
          </p>
        </div>
      </div>

      {/* ══════════════════════ RIGHT PANEL ══════════════════════ */}
      <div className="login-right">

        {/* Mobile compact header (only visible below 768px) */}
        <div className="login-mobile-header" style={{ marginBottom: '1.5rem', width: '100%', maxWidth: 380 }}>
          <img
            src="/logo2.png"
            alt="GCTU"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h2>GCTU Attendance</h2>
            <p>Staff / Admin Sign In</p>
          </div>
        </div>

        <div className="login-right-inner animate-fade-in-up">

          {/* Heading */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--sip-text-heading)',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px',
            }}>
              Sign In
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--sip-text-footer)', margin: 0 }}>
              Staff &amp; Admin access — enter your credentials below
            </p>
          </div>

          {/* Access denied alert */}
          {accessDenied && (
            <div className="sip-alert sip-alert-warning animate-fade-in" style={{ marginBottom: '1.25rem' }}>
              <AlertIcon />
              <span>Access denied — insufficient permissions for that page.</span>
            </div>
          )}

          {/* Error alert */}
          {errorMsg && (
            <div className="sip-alert sip-alert-error animate-fade-in" style={{ marginBottom: '1.25rem' }}>
              <AlertIcon />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

            {/* Username */}
            <div>
              <label className="sip-label" htmlFor="lp-username">Username</label>
              <div className="sip-input-group">
                <span className="sip-input-icon"><UserIcon /></span>
                <input
                  id="lp-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="sip-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="sip-label" htmlFor="lp-password">Password</label>
              <div className="sip-input-group">
                <span className="sip-input-icon"><KeyIcon /></span>
                <input
                  id="lp-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="sip-input"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="sip-btn-dark"
              style={{ marginTop: '0.4rem' }}
            >
              {loading ? (
                <span
                  style={{
                    width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spinSlow 0.7s linear infinite',
                  }}
                />
              ) : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <hr className="divider" style={{ margin: '1.5rem 0' }} />

          {/* Footer links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--sip-text-footer)', margin: 0 }}>
              Are you a student?{' '}
              <button
                onClick={() => navigate('/student-login')}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--sip-text-heading)', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => { e.target.style.color = 'var(--sip-primary)'; }}
                onMouseLeave={(e) => { e.target.style.color = 'var(--sip-text-heading)'; }}
              >
                Student Login
              </button>
            </p>
            <p style={{ fontSize: '13px', color: 'var(--sip-text-footer)', margin: 0 }}>
              Just checking in?{' '}
              <button
                onClick={() => navigate('/student')}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--sip-text-heading)', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => { e.target.style.color = 'var(--sip-primary)'; }}
                onMouseLeave={(e) => { e.target.style.color = 'var(--sip-text-heading)'; }}
              >
                Go to Check-In Portal
              </button>
            </p>
          </div>

          {/* Copyright */}
          <p style={{
            fontSize: '11px',
            color: 'var(--sip-text-footer)',
            textAlign: 'center',
            marginTop: '2rem',
            opacity: 0.7,
          }}>
            &copy; {new Date().getFullYear()} Software Unit | Msquare | GCTU
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
