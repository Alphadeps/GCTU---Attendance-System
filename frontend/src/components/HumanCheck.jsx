import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { HUMAN_CHECK_ENABLED, TURNSTILE_SITE_KEY } from '../lib/humanCheck';

// Cloudflare Turnstile bot check. Shown only when VITE_TURNSTILE_SITE_KEY is set; usually it
// passes on its own without the person doing anything. Each token works once, so pages call
// reset() after a failed submit.
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => { scriptPromise = null; reject(new Error('Security check could not load')); };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

const HumanCheck = forwardRef(({ onToken }, ref) => {
  const box = useRef(null);
  const widgetId = useRef(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current?.('');
      if (window.turnstile && widgetId.current !== null) window.turnstile.reset(widgetId.current);
    }
  }), []);

  useEffect(() => {
    if (!HUMAN_CHECK_ENABLED) return undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !box.current) return;
        widgetId.current = turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: 'interaction-only',
          callback: (token) => onTokenRef.current?.(token),
          'expired-callback': () => onTokenRef.current?.(''),
          'error-callback': () => onTokenRef.current?.('')
        });
      })
      // Script blocked or offline: let the form submit so the server can explain what's needed
      .catch(() => onTokenRef.current?.('unavailable'));
    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current !== null) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  if (!HUMAN_CHECK_ENABLED) return null;
  return <div ref={box} style={{ display: 'flex', justifyContent: 'center', minHeight: 0 }} />;
});

HumanCheck.displayName = 'HumanCheck';
export default HumanCheck;
