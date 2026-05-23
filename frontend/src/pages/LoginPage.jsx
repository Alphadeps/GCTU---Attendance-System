import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

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
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5', fontFamily: "'Open Sans', sans-serif" }}>

      {/* ── Hero banner ────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          background: 'linear-gradient(310deg, #141727, #3A416F)',
          minHeight: '280px',
          borderRadius: '0 0 12px 12px',
          margin: '0 0 -100px 0',
        }}
      >
        {/* Watermark */}
        <img
          src="/logo2.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain opacity-[0.06] pointer-events-none"
          style={{ objectPosition: 'center' }}
        />
        <div className="relative z-10 text-center px-6 pb-16">
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.8px',
              lineHeight: 1.2,
              margin: 0,
              textShadow: '0 2px 12px rgba(0,0,0,.3)',
            }}
          >
            Welcome!
          </h1>
          <p className="mt-3 text-slate-300 text-sm font-semibold tracking-wide">
            GCTU Smart Attendance System
          </p>
        </div>
      </div>

      {/* ── Login card ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center px-4 pb-12">
        <div
          className="w-full max-w-md relative z-10"
          style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 20px 27px 0 rgba(0,0,0,.08)',
            padding: '32px',
          }}
        >
          {/* Logo + Name */}
          <div className="text-center mb-8">
            <img
              src="/logo2.png"
              alt="GCTU Crest"
              className="mx-auto mb-4 object-contain"
              style={{ width: '72px', height: '72px' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <h5
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'rgb(52,71,103)',
                margin: 0,
              }}
            >
              Staff / Admin Sign In
            </h5>
            <p
              style={{
                fontSize: '13px',
                color: 'rgb(131,146,171)',
                marginTop: '4px',
              }}
            >
              Ghana Communication Technology University
            </p>
          </div>

          {/* Alerts */}
          {accessDenied && (
            <div
              className="mb-5 p-3 rounded-lg flex gap-2 items-center text-sm"
              style={{ background: 'rgba(251,207,51,.1)', border: '1px solid rgba(251,207,51,.3)', color: '#b45309' }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Access denied — insufficient permissions
            </div>
          )}
          {errorMsg && (
            <div
              className="mb-5 p-3 rounded-lg flex gap-2 items-center text-sm"
              style={{ background: 'rgba(234,6,6,.07)', border: '1px solid rgba(234,6,6,.2)', color: '#ea0606' }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="sip-input"
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="sip-input"
              />
            </div>

            <button type="submit" disabled={loading} className="sip-btn-dark flex items-center justify-center gap-2">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Links */}
          <div
            className="mt-6 pt-5 text-center space-y-2"
            style={{ borderTop: '1px solid #e9ecef' }}
          >
            <p style={{ fontSize: '13px', color: 'rgb(131,146,171)' }}>
              Are you a student?{' '}
              <button
                onClick={() => navigate('/student-login')}
                style={{ color: 'rgb(52,71,103)', fontWeight: 700 }}
                className="hover:underline transition-all"
              >
                Student Login
              </button>
            </p>
            <p style={{ fontSize: '13px', color: 'rgb(131,146,171)' }}>
              Just checking in?{' '}
              <button
                onClick={() => navigate('/student')}
                style={{ color: 'rgb(52,71,103)', fontWeight: 700 }}
                className="hover:underline transition-all"
              >
                Go to Check-In Portal
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="text-center pb-6 px-4">
        <nav className="flex flex-wrap justify-center gap-4 mb-2">
          {['GCTU', 'Learning Platform', 'Library', 'Programmes'].map((l) => (
            <span
              key={l}
              style={{ fontSize: '14px', color: 'rgb(131,146,171)', cursor: 'default' }}
            >
              {l}
            </span>
          ))}
        </nav>
        <p style={{ fontSize: '13px', color: 'rgb(131,146,171)' }}>
          Copyright © {new Date().getFullYear()} Software Unit | Msquare | GCTU.
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;
