import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0c2340 0%, #1a3c6d 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'inherit',
    }}>
      {/* Logo + Title */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <img
          src="/logo2.png"
          alt="GCTU Logo"
          style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: '1rem' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <h1 style={{
          fontSize: '26px',
          fontWeight: 800,
          color: '#fff',
          margin: '0 0 6px 0',
          letterSpacing: '-0.5px',
        }}>
          GCTU Smart Attendance
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
          Ghana Communication Technology University
        </p>
      </div>

      {/* Role cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        maxWidth: 360,
      }}>
        {/* Student card */}
        <button
          onClick={() => navigate('/student-login')}
          style={{
            background: '#fff',
            border: 'none',
            borderRadius: '14px',
            padding: '1.5rem 1.75rem',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0c2340, #1a3c6d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0c2340', marginBottom: 2 }}>
              I'm a Student
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Sign in with your index number
            </div>
          </div>
          <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Staff / Admin card */}
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '14px',
            padding: '1.5rem 1.75rem',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'background 120ms ease, transform 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.16)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: 2 }}>
              Staff / Admin
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
              Lecturers, reps &amp; administrators
            </div>
          </div>
          <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <p style={{
        marginTop: '2.5rem',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.3)',
        textAlign: 'center',
      }}>
        &copy; {new Date().getFullYear()} Software Unit | Msquare | GCTU
      </p>
    </div>
  );
};

export default LandingPage;
