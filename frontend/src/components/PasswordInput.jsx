import { useState } from 'react';

// A password box with an eye button to show or hide what was typed.
// Takes the same props as <input>; `type` is managed here.
const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const PasswordInput = ({ style, ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        style={{ ...style, paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#67748e',
        }}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
};

export default PasswordInput;
