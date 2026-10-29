import { useState } from 'react';

// Shows the one-time code a rep gives a student who forgot their password
const ResetCodeModal = ({ reset, onClose }) => {
  const [copied, setCopied] = useState(false);
  const pretty = `${reset.code.slice(0, 3)} ${reset.code.slice(3)}`;
  const until = new Date(reset.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const message =
    `Hi ${reset.name}, your GCTU Attendance reset code is ${reset.code}. ` +
    `It works once, until ${until}. Open the student sign-in page, tap "Forgot password?", ` +
    `and enter your index number, this code and a new password: ${window.location.origin}/student-login`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="reset-code-title">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
        <h3 id="reset-code-title" className="text-base font-bold text-[#344767] mb-1 text-center">Reset code for {reset.name}</h3>
        <p className="text-[12px] text-[#67748e] text-center mb-4">{reset.indexNumber}</p>

        <div className="rounded-xl bg-[#f0f2f5] py-4 mb-3 text-center">
          <p className="font-mono text-3xl font-extrabold tracking-[0.2em] text-[#344767]" aria-label={`Code ${reset.code.split('').join(' ')}`}>{pretty}</p>
          <p className="text-[11px] text-[#67748e] mt-1">Works once, until {until}</p>
        </div>

        <p className="text-[12px] text-[#67748e] leading-relaxed mb-4">
          Give this code only to {reset.name.split(' ')[0]}, in person or in a private chat. They tap
          <b> Forgot password?</b> on the student sign-in page and choose their own new password. You never see it.
        </p>

        <div className="flex flex-col gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sip-btn-dark text-center text-sm"
            style={{ padding: '10px 16px', textDecoration: 'none' }}
          >
            Send on WhatsApp
          </a>
          <button
            type="button"
            onClick={copy}
            className="bg-[#f0f2f5] hover:bg-[#e9ecef] text-[#344767] font-semibold py-2.5 px-4 rounded-xl transition-all text-sm"
          >
            {copied ? 'Copied ✓' : 'Copy message'}
          </button>
          <button type="button" onClick={onClose} className="text-[13px] text-[#67748e] hover:text-[#344767] py-1">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetCodeModal;
