import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ─── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

// ─── Icons ──────────────────────────────────────────────────────────────────
const icons = {
  success: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
    </svg>
  ),
};

const styles = {
  success: {
    border: 'border-emerald-200',
    bg: 'bg-white',
    icon: 'text-emerald-500',
    bar: 'bg-emerald-500',
    title: 'text-emerald-700',
  },
  error: {
    border: 'border-rose-200',
    bg: 'bg-white',
    icon: 'text-rose-500',
    bar: 'bg-rose-500',
    title: 'text-rose-700',
  },
  warning: {
    border: 'border-amber-200',
    bg: 'bg-white',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
    title: 'text-amber-700',
  },
  info: {
    border: 'border-sky-200',
    bg: 'bg-white',
    icon: 'text-sky-500',
    bar: 'bg-sky-500',
    title: 'text-sky-700',
  },
};

// ─── Single Toast ────────────────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const s = styles[toast.type] || styles.info;
  const duration = toast.duration || 5000;

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10);

    // Progress bar
    const interval = setInterval(() => {
      setProgress(p => {
        const next = p - (100 / (duration / 100));
        return next < 0 ? 0 : next;
      });
    }, 100);

    // Auto dismiss
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 350);
    }, duration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, [toast.id, toast.duration, duration, onDismiss]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 350);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border backdrop-blur-xl shadow-2xl max-w-sm w-full
        transition-all duration-350 ease-in-out
        ${s.border} ${s.bg}
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span className={`mt-0.5 ${s.icon}`}>{icons[toast.type]}</span>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={`text-sm font-bold mb-0.5 ${s.title}`}>{toast.title}</p>
          )}
          <p className="text-sm text-[#344767] leading-relaxed break-words">{toast.message}</p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-[#8392ab] hover:text-[#344767] transition-colors mt-0.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-white/5">
        <div
          className={`h-full ${s.bar} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// ─── Provider + Container ────────────────────────────────────────────────────
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type, message, title = null, duration = 5000) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message, title, duration }]);
    return id;
  }, []);

  // Convenience methods
  const success = useCallback((msg, title) => toast('success', msg, title), [toast]);
  const error = useCallback((msg, title) => toast('error', msg, title || 'Error', 7000), [toast]);
  const warning = useCallback((msg, title) => toast('warning', msg, title), [toast]);
  const info = useCallback((msg, title) => toast('info', msg, title), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
