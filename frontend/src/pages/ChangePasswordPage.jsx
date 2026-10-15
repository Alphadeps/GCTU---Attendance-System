import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Shown after a rep logs in with a password an admin set (e.g. the default "rep123").
// Every other screen is blocked by the API until a personal password is chosen.
const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords don't match");
      return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      auth.login({ needsPasswordChange: false });
      navigate(auth.role === 'SUPERADMIN' ? '/admin' : '/rep/dashboard', { replace: true });
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not change your password. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    auth.logout();
    navigate('/');
  };

  return (
    <div className="login-root" style={{ justifyContent: 'center' }}>
      <div className="login-right" style={{ flex: 1 }}>
        <div className="login-right-inner animate-fade-in-up">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img src="/logo2.png" alt="GCTU" style={{ width: 56, height: 56, objectFit: 'contain', display: 'block', margin: '0 auto' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--sip-text-heading)', margin: '0.75rem 0 4px' }}>Set your own password</h2>
            <p style={{ fontSize: 13, color: 'var(--sip-text-footer)', margin: 0 }}>
              {auth.username ? <>Welcome, <strong>{auth.username}</strong>. </> : null}
              You signed in with a temporary password. Choose a new one to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="sip-label" htmlFor="cp-current">Temporary password</label>
              <input id="cp-current" type="password" className="sip-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" placeholder="The password you just used" />
            </div>
            <div>
              <label className="sip-label" htmlFor="cp-new">New password</label>
              <input id="cp-new" type="password" className="sip-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="sip-label" htmlFor="cp-confirm">Confirm new password</label>
              <input id="cp-confirm" type="password" className="sip-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>

            {errorMsg && <div className="sip-alert sip-alert-error">{errorMsg}</div>}

            <button type="submit" className="sip-btn-dark" disabled={saving}>
              {saving ? 'Saving…' : 'Save and continue'}
            </button>
            <button type="button" onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--sip-text-footer)', cursor: 'pointer' }}>
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
