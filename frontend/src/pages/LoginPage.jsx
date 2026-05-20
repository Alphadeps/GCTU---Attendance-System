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

      // Use auth context to store user data
      auth.login({
        token,
        role: user.role,
        username: user.username,
        needsPasswordChange: user.needsPasswordChange,
        assignedClass: user.assignedClass || null,
        dept_name: user.dept_name || null,
        dept_logo: user.dept_logo || null
      });

      // Redirect based on role
      if (user.role === 'SUPERADMIN') {
        navigate('/admin');
      } else if (user.role === 'LECTURER') {
        navigate('/lecturer');
      } else if (user.role === 'REP' || user.role === 'ADMIN') {
        navigate('/rep/dashboard');
      } else {
        setErrorMsg('Unauthorized role. Contact support.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.response?.data?.error || 'Invalid credentials or connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#00122c] text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background logo watermark */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none flex items-center justify-center">
        <img src="/logo2.png" alt="GCTU Crest Watermark" className="w-[380px] h-[380px] object-contain" onError={(e) => console.error('Logo failed to load:', e)} />
      </div>

      {/* Background mesh/gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#D4A017]/5 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#003B8E]/10 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-[#D4A017]/10 text-[#D4A017] mb-4 border border-[#D4A017]/20">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">GCTU Attendance & Reports</h1>
          <p className="text-slate-400 mt-2 text-sm">Sign in to manage classes and records</p>
        </div>

        {accessDenied && (
          <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex gap-2 items-center">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>Access denied — insufficient permissions</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-2 items-center">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-[#000a18]/60 border border-[#002a63] rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#000a18]/60 border border-[#002a63] rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4A017] hover:bg-[#b88a14] active:scale-[0.98] text-slate-950 font-bold py-3 px-4 rounded-lg shadow-lg shadow-[#D4A017]/20 hover:shadow-[#D4A017]/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-[#002a63] pt-6 text-center">
          <p className="text-slate-500 text-xs">
            Student checking in?{' '}
            <button
              onClick={() => navigate('/student')}
              className="text-[#D4A017] hover:text-[#b88a14] font-semibold underline transition-colors"
            >
              Go to Student Portal
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
