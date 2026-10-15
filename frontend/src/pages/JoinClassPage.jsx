import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import InstallAppButton from '../components/InstallAppButton';

// Public page a student opens from the join link their class rep shares.
const JoinClassPage = () => {
  const { code: codeFromLink } = useParams();
  const navigate = useNavigate();

  const [code, setCode] = useState((codeFromLink || '').toUpperCase());
  const [className, setClassName] = useState('');
  const [checkingCode, setCheckingCode] = useState(Boolean(codeFromLink));
  const [codeError, setCodeError] = useState('');

  const [indexNumber, setIndexNumber] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const checkCode = async (value) => {
    const cleaned = value.trim().toUpperCase();
    if (cleaned.length !== 6) return;
    setCheckingCode(true);
    setCodeError('');
    try {
      const res = await api.get(`/student-auth/join/${encodeURIComponent(cleaned)}`);
      setClassName(res.data.className);
    } catch (err) {
      setClassName('');
      setCodeError(err.response?.data?.error || 'Could not check that code');
    } finally {
      setCheckingCode(false);
    }
  };

  // Check the code from the shared link once on load (state is only set when the request settles)
  useEffect(() => {
    if (!codeFromLink) return undefined;
    let cancelled = false;
    api.get(`/student-auth/join/${encodeURIComponent(codeFromLink.trim().toUpperCase())}`)
      .then(res => { if (!cancelled) setClassName(res.data.className); })
      .catch(err => { if (!cancelled) setCodeError(err.response?.data?.error || 'Could not check that code'); })
      .finally(() => { if (!cancelled) setCheckingCode(false); });
    return () => { cancelled = true; };
  }, [codeFromLink]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (password !== confirmPassword) {
      setErrorMsg("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/student-auth/join', {
        code: code.trim().toUpperCase(),
        indexNumber: indexNumber.trim(),
        name: name.trim(),
        email: email.trim(),
        password
      });
      setSuccessMsg(res.data.message);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not join the class. Try again.');
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
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--sip-text-heading)', margin: '0.75rem 0 4px' }}>Join your class</h2>
            <p style={{ fontSize: 13, color: 'var(--sip-text-footer)', margin: 0 }}>Register once, then sign in to mark attendance.</p>
          </div>

          {successMsg ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="sip-alert sip-alert-info">{successMsg}</div>
              <button type="button" className="sip-btn-dark" onClick={() => navigate('/student-login')}>Go to student sign in</button>
              <InstallAppButton />
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="sip-label" htmlFor="join-code">Class join code</label>
                <input
                  id="join-code"
                  className="sip-input"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                    setCode(v);
                    setClassName('');
                    setCodeError('');
                    if (v.length === 6) checkCode(v);
                  }}
                  placeholder="6-character code from your rep"
                  autoComplete="off"
                  required
                  style={{ fontFamily: 'monospace', letterSpacing: '0.25em', textTransform: 'uppercase' }}
                />
                {checkingCode && <p style={{ fontSize: 12, color: 'var(--sip-text-footer)', marginTop: 6 }}>Checking code…</p>}
                {className && <p style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginTop: 6 }}>Class: {className}</p>}
                {codeError && <p style={{ fontSize: 12, color: '#c00', marginTop: 6 }}>{codeError}</p>}
              </div>

              <div>
                <label className="sip-label" htmlFor="join-index">Index number</label>
                <input id="join-index" className="sip-input" value={indexNumber} onChange={(e) => setIndexNumber(e.target.value)} required autoComplete="username" placeholder="Your student index number" />
              </div>
              <div>
                <label className="sip-label" htmlFor="join-name">Full name</label>
                <input id="join-name" className="sip-input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="As it appears on your student ID" maxLength={100} />
              </div>
              <div>
                <label className="sip-label" htmlFor="join-email">Email</label>
                <input id="join-email" type="email" className="sip-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
              </div>
              <div>
                <label className="sip-label" htmlFor="join-password">Create a password</label>
                <input id="join-password" type="password" className="sip-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" />
              </div>
              <div>
                <label className="sip-label" htmlFor="join-confirm">Confirm password</label>
                <input id="join-confirm" type="password" className="sip-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>

              {errorMsg && <div className="sip-alert sip-alert-error">{errorMsg}</div>}

              <button type="submit" className="sip-btn-dark" disabled={submitting || !className}>
                {submitting ? 'Joining…' : 'Join class'}
              </button>
              <p style={{ fontSize: 12, textAlign: 'center', color: 'var(--sip-text-footer)', margin: 0 }}>
                Already registered? <Link to="/student-login" style={{ color: '#1a3c6d', fontWeight: 600 }}>Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinClassPage;
