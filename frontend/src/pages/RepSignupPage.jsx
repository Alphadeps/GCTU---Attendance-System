import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ClassPicker from '../components/rep/ClassPicker';
import { EMPTY_CLASS } from '../components/rep/classDefaults';

// Public page: a class rep creates their own account and their class.
// The account can't sign in until the administrator approves it.
const RepSignupPage = () => {
  const [form, setForm] = useState({ fullName: '', indexNumber: '', password: '', confirmPassword: '' });
  const [cls, setCls] = useState(EMPTY_CLASS);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (form.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrorMsg("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const { fullName, indexNumber, password } = form;
      const res = await api.post('/auth/rep-signup', { fullName, indexNumber, password, ...cls });
      setSuccessMsg(res.data.message);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not create your account. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-root" style={{ justifyContent: 'center' }}>
      <div className="login-right" style={{ flex: 1 }}>
        <div className="login-right-inner animate-fade-in-up">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img src="/logo2.png" alt="GCTU" style={{ width: 56, height: 56, objectFit: 'contain', display: 'block', margin: '0 auto' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--sip-text-heading)', margin: '0.75rem 0 4px' }}>Class rep sign-up</h2>
            <p style={{ fontSize: 13, color: 'var(--sip-text-footer)', margin: 0 }}>
              Create your account and your class. The administrator approves it before you can sign in.
            </p>
          </div>

          {successMsg ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="sip-alert sip-alert-info">{successMsg}</div>
              <p style={{ fontSize: 12, color: 'var(--sip-text-footer)', margin: 0, textAlign: 'center' }}>
                Your username is your index number: <strong>{form.indexNumber.trim()}</strong>
              </p>
              <Link to="/login" className="sip-btn-dark" style={{ textDecoration: 'none' }}>Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="sip-label" htmlFor="rs-name">Full name</label>
                <input id="rs-name" className="sip-input" value={form.fullName} onChange={set('fullName')} required maxLength={100} autoComplete="name" placeholder="e.g. Ama Owusu" />
              </div>
              <div>
                <label className="sip-label" htmlFor="rs-index">Index number</label>
                <input id="rs-index" className="sip-input" value={form.indexNumber} onChange={set('indexNumber')} required autoComplete="username" placeholder="This will be your username" />
              </div>

              <ClassPicker value={cls} onChange={setCls} idPrefix="rs" />

              <div>
                <label className="sip-label" htmlFor="rs-password">Password</label>
                <input id="rs-password" type="password" className="sip-input" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="sip-label" htmlFor="rs-confirm">Confirm password</label>
                <input id="rs-confirm" type="password" className="sip-input" value={form.confirmPassword} onChange={set('confirmPassword')} required minLength={8} autoComplete="new-password" />
              </div>

              {errorMsg && <div className="sip-alert sip-alert-error">{errorMsg}</div>}

              <button type="submit" className="sip-btn-dark" disabled={submitting || !cls.programmeId}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
              <p style={{ fontSize: 12, textAlign: 'center', color: 'var(--sip-text-footer)', margin: 0 }}>
                Already have an account? <Link to="/login" style={{ color: '#1a3c6d', fontWeight: 600 }}>Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepSignupPage;
