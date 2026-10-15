import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const LEVELS = ['100', '200', '300', '400'];
const GROUPS = 'ABCDEFGHIJK'.split('');
const SESSIONS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'WEEKEND', label: 'Weekend' }
];

// Public page: a class rep creates their own account and their class.
// The account can't sign in until the administrator approves it.
const RepSignupPage = () => {
  const [programmes, setProgrammes] = useState([]);
  const [programmesLoading, setProgrammesLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: '', indexNumber: '', password: '', confirmPassword: '',
    programmeId: '', level: '100', type: 'REGULAR', group: 'A', session: 'MORNING'
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    api.get('/auth/programmes')
      .then(res => setProgrammes(res.data || []))
      .catch(() => setErrorMsg('Could not load programmes. Check your connection and refresh.'))
      .finally(() => setProgrammesLoading(false));
  }, []);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const classPreview = useMemo(() => {
    const programme = programmes.find(p => p.id === form.programmeId);
    if (!programme) return '';
    return `${programme.name} LEVEL ${form.level} ${form.type} GROUP ${form.group} (${form.session})`;
  }, [programmes, form.programmeId, form.level, form.type, form.group, form.session]);

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
      const { fullName, indexNumber, password, programmeId, level, type, group, session } = form;
      const res = await api.post('/auth/rep-signup', { fullName, indexNumber, password, programmeId, level, type, group, session });
      setSuccessMsg(res.data.message);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not create your account. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle = { appearance: 'auto' };

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

              <div>
                <label className="sip-label" htmlFor="rs-programme">Programme</label>
                <select id="rs-programme" className="sip-input" style={selectStyle} value={form.programmeId} onChange={set('programmeId')} required disabled={programmesLoading}>
                  <option value="">{programmesLoading ? 'Loading…' : programmes.length ? 'Choose your programme' : 'No programmes yet — ask the administrator'}</option>
                  {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="sip-label" htmlFor="rs-level">Level</label>
                  <select id="rs-level" className="sip-input" style={selectStyle} value={form.level} onChange={set('level')}>
                    {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="sip-label" htmlFor="rs-type">Type</label>
                  <select id="rs-type" className="sip-input" style={selectStyle} value={form.type} onChange={set('type')}>
                    <option value="REGULAR">Regular</option>
                    <option value="TOP-UP">Top-Up</option>
                  </select>
                </div>
                <div>
                  <label className="sip-label" htmlFor="rs-group">Group</label>
                  <select id="rs-group" className="sip-input" style={selectStyle} value={form.group} onChange={set('group')}>
                    {GROUPS.map(g => <option key={g} value={g}>Group {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="sip-label" htmlFor="rs-session">Session</label>
                  <select id="rs-session" className="sip-input" style={selectStyle} value={form.session} onChange={set('session')}>
                    {SESSIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {classPreview && (
                <p style={{ fontSize: 12, color: '#15803d', fontWeight: 600, margin: 0 }}>Your class: {classPreview}</p>
              )}

              <div>
                <label className="sip-label" htmlFor="rs-password">Password</label>
                <input id="rs-password" type="password" className="sip-input" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="sip-label" htmlFor="rs-confirm">Confirm password</label>
                <input id="rs-confirm" type="password" className="sip-input" value={form.confirmPassword} onChange={set('confirmPassword')} required minLength={8} autoComplete="new-password" />
              </div>

              {errorMsg && <div className="sip-alert sip-alert-error">{errorMsg}</div>}

              <button type="submit" className="sip-btn-dark" disabled={submitting || !form.programmeId}>
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
