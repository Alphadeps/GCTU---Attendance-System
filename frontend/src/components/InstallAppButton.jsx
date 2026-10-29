import { useEffect, useState } from 'react';
import { canPromptInstall, isInstalled, isIosSafari, onInstallChange, promptInstall } from '../lib/installPrompt';

// "Install app" button for the phone home screen. Hidden once installed or where the browser can't install.
const InstallAppButton = ({ dark = false }) => {
  const [canInstall, setCanInstall] = useState(canPromptInstall);
  const [installed, setInstalled] = useState(isInstalled);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => onInstallChange(() => {
    setCanInstall(canPromptInstall());
    setInstalled(isInstalled());
  }), []);

  const ios = isIosSafari();
  if (installed || (!canInstall && !ios)) return null;

  const colors = dark
    ? { bg: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', text: '#fff', sub: 'rgba(255,255,255,0.65)' }
    : { bg: '#fff', border: '1px solid #e9ecef', text: '#0c2340', sub: '#67748e' };

  const handleClick = async () => {
    if (canInstall) await promptInstall();
    else setShowIosHelp(v => !v);
  };

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={handleClick}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.1rem',
          background: colors.bg, border: colors.border, borderRadius: 12, cursor: 'pointer', textAlign: 'left'
        }}
      >
        <img src="/icons/icon-192.png" alt="" width={32} height={32} style={{ borderRadius: 8, flexShrink: 0 }} />
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: colors.text }}>Install the app</span>
          <span style={{ display: 'block', fontSize: 11, color: colors.sub }}>Add GCTU Attendance to your home screen</span>
        </span>
      </button>
      {showIosHelp && (
        <p style={{ fontSize: 12, color: colors.sub, margin: '0.6rem 0.25rem 0', lineHeight: 1.5 }}>
          On iPhone: tap the <strong style={{ color: colors.text }}>Share</strong> button at the bottom of Safari,
          then <strong style={{ color: colors.text }}>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
};

export default InstallAppButton;
