import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const StudentLoginPage = () => {
  const [indexNumber, setIndexNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await api.post('/student-auth/login', { 
        indexNumber, 
        password 
      });
      
      const { token, student } = response.data;

      // Store token and student data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({
        role: 'STUDENT',
        indexNumber: student.indexNumber,
        name: student.name,
        email: student.email,
        classes: student.classes
      }));

      // Redirect to student portal
      navigate('/student');
    } catch (err) {
      console.error('Student login error:', err);
      
      // Check if first-time login
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

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      await api.post('/student-auth/set-password', {
        indexNumber,
        password: newPassword,
        confirmPassword
      });

      alert('Password set successfully! Please login with your new password.');
      
      // Reset form
      setRequiresPasswordSetup(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password setup error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#00122c] text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background logo watermark */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none flex items-center justify-center">
        <img 
          src="/logo2.png" 
          alt="GCTU Crest Watermark" 
          className="w-[380px] h-[380px] object-contain" 
        />
      </div>

      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#D4A017]/5 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#003B8E]/10 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-[#D4A017]/10 text-[#D4A017] mb-4 border border-[#D4A017]/20">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {requiresPasswordSetup ? 'Set Your Password' : 'Student Portal'}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {requiresPasswordSetup 
              ? 'Create a password for your first login' 
              : 'Sign in with your index number'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-2 items-center">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {!requiresPasswordSetup ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">Index Number</label>
              <input
                type="text"
                required
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                placeholder="Enter your index number"
                className="w-full px-4 py-3 bg-[#002a63]/40 border border-[#003B8E]/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4A017]/50 focus:border-[#D4A017]/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-[#002a63]/40 border border-[#003B8E]/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4A017]/50 focus:border-[#D4A017]/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#D4A017] to-[#FFD700] text-[#00122c] font-bold rounded-lg hover:from-[#FFD700] hover:to-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:ring-offset-2 focus:ring-offset-[#00122c] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#D4A017]/20"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSetup} className="space-y-6">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-4">
              <p className="font-semibold mb-1">First Time Login</p>
              <p className="text-xs">Please create a secure password for your account.</p>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">Index Number</label>
              <input
                type="text"
                disabled
                value={indexNumber}
                className="w-full px-4 py-3 bg-[#002a63]/20 border border-[#003B8E]/30 rounded-lg text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a password (min 6 characters)"
                className="w-full px-4 py-3 bg-[#002a63]/40 border border-[#003B8E]/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4A017]/50 focus:border-[#D4A017]/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 bg-[#002a63]/40 border border-[#003B8E]/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4A017]/50 focus:border-[#D4A017]/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#D4A017] to-[#FFD700] text-[#00122c] font-bold rounded-lg hover:from-[#FFD700] hover:to-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:ring-offset-2 focus:ring-offset-[#00122c] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#D4A017]/20"
            >
              {loading ? 'Setting Password...' : 'Set Password'}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequiresPasswordSetup(false);
                setNewPassword('');
                setConfirmPassword('');
                setErrorMsg('');
              }}
              className="w-full py-2 px-4 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Back to Login
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-[#002a63]">
          <p className="text-center text-slate-400 text-sm">
            Staff or Admin?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-[#D4A017] hover:text-[#FFD700] font-semibold transition-colors"
            >
              Login here
            </button>
          </p>
        </div>
      </div>

      <p className="mt-8 text-slate-500 text-xs text-center max-w-md">
        © {new Date().getFullYear()} Ghana Communication Technology University. All rights reserved.
      </p>
    </div>
  );
};

export default StudentLoginPage;
