import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

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
        <img src="/logo2.png" alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain opacity-[0.06] pointer-events-none"
        />
        <div className="relative z-10 text-center px-6 pb-16">
          <h1
            style={{
              fontSize: '48px', fontWeight: 700, color: '#fff',
              letterSpacing: '-0.8px', lineHeight: 1.2, margin: 0,
              textShadow: '0 2px 12px rgba(0,0,0,.3)',
            }}
          >
            {requiresPasswordSetup ? 'Set Password' : 'Student Portal'}
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
              src="/logo2.png" alt="GCTU Crest"
              className="mx-auto mb-4 object-contain"
              style={{ width: '72px', height: '72px' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <h5 style={{ fontSize: '20px', fontWeight: 700, color: 'rgb(52,71,103)', margin: 0 }}>
              {requiresPasswordSetup ? 'Create Your Password' : 'Student Sign In'}
            </h5>
            <p style={{ fontSize: '13px', color: 'rgb(131,146,171)', marginTop: '4px' }}>
              {requiresPasswordSetup
                ? 'First-time login — set a secure password'
                : 'Sign in with your index number'}
            </p>
          </div>

          {/* Alerts */}
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

          {!requiresPasswordSetup ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <input
                type="text" required value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                placeholder="Index Number"
                className="sip-input"
              />
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="sip-input"
              />
              <button type="submit" disabled={loading} className="sip-btn-dark flex items-center justify-center gap-2">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSetup} className="space-y-5">
              <div
                className="p-3 rounded-lg text-sm"
                style={{ background: 'rgba(23,193,232,.08)', border: '1px solid rgba(23,193,232,.25)', color: '#0c9abf' }}
              >
                <p className="font-semibold">First Time Login</p>
                <p className="text-xs mt-0.5">Please create a secure password for your account.</p>
              </div>
              <input
                type="text" disabled value={indexNumber}
                className="sip-input"
                style={{ background: '#f8f9fa', color: '#8392ab', cursor: 'not-allowed' }}
              />
              <input
                type="password" required value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 6 characters)"
                className="sip-input"
              />
              <input
                type="password" required value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="sip-input"
              />
              <button type="submit" disabled={loading} className="sip-btn-dark flex items-center justify-center gap-2">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : 'Set Password'}
              </button>
              <button
                type="button"
                onClick={() => { setRequiresPasswordSetup(false); setNewPassword(''); setConfirmPassword(''); setErrorMsg(''); }}
                style={{ color: 'rgb(131,146,171)', fontSize: '13px', width: '100%', textAlign: 'center', paddingTop: '4px' }}
                className="hover:underline block"
              >
                Back to Login
              </button>
            </form>
          )}

          {/* Links */}
          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid #e9ecef' }}>
            <p style={{ fontSize: '13px', color: 'rgb(131,146,171)' }}>
              Staff or Admin?{' '}
              <button
                onClick={() => navigate('/login')}
                style={{ color: 'rgb(52,71,103)', fontWeight: 700 }}
                className="hover:underline"
              >
                Login here
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="text-center pb-6 px-4">
        <nav className="flex flex-wrap justify-center gap-4 mb-2">
          {['GCTU', 'Learning Platform', 'Library', 'Programmes'].map((l) => (
            <span key={l} style={{ fontSize: '14px', color: 'rgb(131,146,171)', cursor: 'default' }}>{l}</span>
          ))}
        </nav>
        <p style={{ fontSize: '13px', color: 'rgb(131,146,171)' }}>
          Copyright © {new Date().getFullYear()} Software Unit | Msquare | GCTU.
        </p>
      </footer>
    </div>
  );
};

export default StudentLoginPage;
