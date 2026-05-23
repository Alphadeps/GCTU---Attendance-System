import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ─── Icon helpers ────────────────────────────────────────────────────────── */
const QrIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01M14 22h.01M22 14h.01M22 18h.01M22 22h.01"/>
  </svg>
);
const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="12 8 12 12 14 14"/>
    <path d="M3.05 11a9 9 0 1 0 .5-4.5M3 3v4h4"/>
  </svg>
);
const SupportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
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
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

/* ─── Feature card data ───────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <QrIcon />,
    title: 'QR Check-in',
    desc: 'Scan your QR code to mark attendance instantly',
    delay: 'delay-200',
  },
  {
    icon: <HistoryIcon />,
    title: 'Attendance History',
    desc: 'View your full attendance record per course',
    delay: 'delay-300',
  },
  {
    icon: <SupportIcon />,
    title: 'Grievance Support',
    desc: 'Raise concerns about attendance discrepancies',
    delay: 'delay-400',
  },
];

/* ─────────────────────────────────────────────────────────────────────────── */

const StudentLoginPage = () => {
  const [indexNumber, setIndexNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const auth = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const response = await api.post('/student-auth/login', { indexNumber, password });
      const { token, student } = response.data;
      auth.login({
        token,
        role: 'STUDENT',
        username: student.name,
        indexNumber: student.indexNumber,
        email: student.email,
        classes: student.classes,
      });
      localStorage.setItem('user', JSON.stringify({
        role: 'STUDENT',
        indexNumber: student.indexNumber,
        name: student.name,
        email: student.email,
        classes: student.classes,
      }));
      navigate('/student');
    } catch (err) {
      if (err.response?.data?.requiresPasswordSetup) {
        setRequiresPasswordSetup(true);
        setErrorMsg('');
      } else {
        setErrorMsg(err.response?.data?.error || 'Invalid credentials or connection error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSetup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (newPassword !== confirmPassword) { setErrorMsg('Passwords do not match'); return; }
    if (newPassword.length < 6) { setErrorMsg('Password must be at least 6 characters long'); return; }
    setLoading(true);
    try {
      await api.post('/student-auth/set-password', { indexNumber, password: newPassword, confirmPassword });
      alert('Password set successfully! Please login with your new password.');
      setRequiresPasswordSetup(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">

      {/* ══════════════════════ LEFT PANEL ══════════════════════ */}
      <div
        className="login-left animate-slide-left"
        style={{ background: 'linear-gradient(135deg, #11cdef 0%, #1171ef 100%)' }}
      >
        {/* Decorative background blobs */}
        <div
          className="login-blob"
          style={{
            width: 360, height: 360,
            background: 'rgba(255,255,255,0.07)',
            top: -100, right: -100,
          }}
        />
        <div
          className="login-blob"
          style={{
            width: 220, height: 220,
            background: 'rgba(255,255,255,0.06)',
            bottom: 40, left: -70,
          }}
        />
        <div
          className="login-blob"
          style={{
            width: 130, height: 130,
            background: 'rgba(17,193,239,0.15)',
            bottom: 220, right: 30,
          }}
        />

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 340,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem',
        }}>

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
              textShadow: '0 2px 16px rgba(0,0,0,.2)',
            }}>
              Student Portal
            </h1>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.70)',
              margin: 0,
              letterSpacing: '.3px',
              fontWeight: 500,
            }}>
              Check in your attendance
            </p>
          </div>

          {/* Feature cards */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            gap: '12px', width: '100%', alignItems: 'center',
          }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`login-feature-card animate-float ${f.delay}`}
              >
                <div className="login-feature-icon">{f.icon}</div>
                <div className="login-feature-text">
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
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

        {/* Mobile compact header */}
        <div className="login-mobile-header" style={{ marginBottom: '1.5rem', width: '100%', maxWidth: 380 }}>
          <img
            src="/logo2.png"
            alt="GCTU"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h2>GCTU Student Portal</h2>
            <p>Attendance Check-in &amp; History</p>
          </div>
        </div>

        <div className="login-right-inner animate-fade-in-up">

          {/* ── Normal login form ── */}
          {!requiresPasswordSetup ? (
            <>
              {/* Heading */}
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: 'var(--sip-text-heading)',
                  margin: '0 0 6px 0',
                  letterSpacing: '-0.3px',
                }}>
                  Student Sign In
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--sip-text-footer)', margin: 0 }}>
                  Sign in with your index number and password
                </p>
              </div>

              {/* Error alert */}
              {errorMsg && (
                <div className="sip-alert sip-alert-error animate-fade-in" style={{ marginBottom: '1.25rem' }}>
                  <AlertIcon />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                <div>
                  <label className="sip-label" htmlFor="slp-index">Index Number</label>
                  <div className="sip-input-group">
                    <span className="sip-input-icon"><UserIcon /></span>
                    <input
                      id="slp-index"
                      type="text"
                      required
                      autoComplete="username"
                      value={indexNumber}
                      onChange={(e) => setIndexNumber(e.target.value)}
                      placeholder="e.g. CS/2021/001"
                      className="sip-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="sip-label" htmlFor="slp-password">Password</label>
                  <div className="sip-input-group">
                    <span className="sip-input-icon"><KeyIcon /></span>
                    <input
                      id="slp-password"
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
            </>
          ) : (
            /* ── Password setup form ── */
            <>
              {/* Heading */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: 'var(--sip-text-heading)',
                  margin: '0 0 6px 0',
                  letterSpacing: '-0.3px',
                }}>
                  Create Your Password
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--sip-text-footer)', margin: 0 }}>
                  First-time login — set a secure password for your account
                </p>
              </div>

              {/* Info banner */}
              <div className="sip-alert sip-alert-info animate-fade-in" style={{ marginBottom: '1.25rem' }}>
                <ShieldIcon />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>First Time Login</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.85 }}>
                    Please create a secure password of at least 6 characters.
                  </p>
                </div>
              </div>

              {/* Error alert */}
              {errorMsg && (
                <div className="sip-alert sip-alert-error animate-fade-in" style={{ marginBottom: '1.25rem' }}>
                  <AlertIcon />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handlePasswordSetup} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                <div>
                  <label className="sip-label">Index Number</label>
                  <input
                    type="text"
                    disabled
                    value={indexNumber}
                    className="sip-input"
                  />
                </div>

                <div>
                  <label className="sip-label" htmlFor="slp-newpw">New Password</label>
                  <div className="sip-input-group">
                    <span className="sip-input-icon"><KeyIcon /></span>
                    <input
                      id="slp-newpw"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="sip-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="sip-label" htmlFor="slp-confirmpw">Confirm Password</label>
                  <div className="sip-input-group">
                    <span className="sip-input-icon"><KeyIcon /></span>
                    <input
                      id="slp-confirmpw"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="sip-input"
                    />
                  </div>
                </div>

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
                  ) : 'Set Password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequiresPasswordSetup(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setErrorMsg('');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    background: 'none', border: 'none', padding: '4px 0',
                    color: 'var(--sip-text-footer)', fontSize: '13px', cursor: 'pointer',
                    transition: 'color 150ms ease', width: '100%',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sip-text-heading)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sip-text-footer)'; }}
                >
                  <ArrowLeftIcon /> Back to Login
                </button>
              </form>
            </>
          )}

          {/* Divider */}
          <hr className="divider" style={{ margin: '1.5rem 0' }} />

          {/* Footer links */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--sip-text-footer)', margin: 0 }}>
              Staff or Admin?{' '}
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--sip-text-heading)', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => { e.target.style.color = '#1171ef'; }}
                onMouseLeave={(e) => { e.target.style.color = 'var(--sip-text-heading)'; }}
              >
                Login here
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

export default StudentLoginPage;
