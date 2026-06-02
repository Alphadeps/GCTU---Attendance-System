import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../ToastProvider';

const CheckInSheet = ({ session, indexNumber, fullName, onClose, onSuccess }) => {
  const toast = useToast();

  const [mode, setMode] = useState('self'); // 'self' | 'proxy'
  const [inputMode, setInputMode] = useState('gps'); // 'gps' | 'code'
  const [manualCode, setManualCode] = useState('');
  const [proxyIndex, setProxyIndex] = useState('');
  const [proxyReason, setProxyReason] = useState('');
  const [step, setStep] = useState(1); // 1: main, 2: loading, 3: success, 4: error
  const [submitting, setSubmitting] = useState(false);
  const [successDetails, setSuccessDetails] = useState({ status: '', time: '', courseName: '' });
  const [submitErrorMsg, setSubmitErrorMsg] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState('');

  const deviceInfo = `${navigator.platform} (${navigator.language})`;

  const collectGPS = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({ lat: null, lng: null }); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const submitSelf = async (codeToken, useSessionId = false) => {
    setSubmitting(true);
    setStep(2);
    setSubmittingStatus('Getting your location...');

    const { lat, lng } = await collectGPS();
    setSubmittingStatus('Submitting attendance...');

    const payload = {
      indexNumber,
      name: fullName,
      latitude: lat,
      longitude: lng,
      deviceInfo
    };

    if (useSessionId) {
      payload.sessionId = session?.id;
    } else {
      payload.qrCode = codeToken;
    }

    const maxRetries = 3;
    let attempt = 0;

    const execute = async () => {
      attempt++;
      try {
        if (!navigator.onLine) throw new Error('Offline');
        const response = await api.post('/attendance/mark', payload);
        setSuccessDetails({
          status: response.data.attendance?.status || 'PRESENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          courseName: session?.courseName || 'Class'
        });
        setStep(3);
        onSuccess();
      } catch (err) {
        if (err.response) {
          setSubmitErrorMsg(err.response.data?.error || 'Check-in failed.');
          setStep(4);
          return;
        }
        if (attempt >= maxRetries) {
          setSubmitErrorMsg('Network error. Check your connection and try again.');
          setStep(4);
          return;
        }
        const delay = attempt * 3000;
        setSubmittingStatus(`Retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
        await execute();
      }
    };

    await execute();
    setSubmitting(false);
  };

  const submitProxy = async () => {
    if (!proxyIndex.trim()) { toast.error('Enter the classmate\'s index number'); return; }
    if (!proxyReason.trim()) { toast.error('Enter a reason for marking'); return; }

    setSubmitting(true);
    setStep(2);
    setSubmittingStatus('Getting your location...');

    const { lat, lng } = await collectGPS();
    setSubmittingStatus('Submitting proxy attendance...');

    const payload = {
      submitterIndexNumber: indexNumber,
      targetIndexNumber: proxyIndex.trim(),
      reason: proxyReason.trim(),
      sessionId: session?.id,
      latitude: lat,
      longitude: lng
    };

    try {
      const response = await api.post('/attendance/mark-proxy', payload);
      setSuccessDetails({
        status: response.data.attendance?.status || 'PRESENT',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        courseName: session?.courseName || 'Class'
      });
      setStep(3);
      onSuccess();
    } catch (err) {
      setSubmitErrorMsg(err.response?.data?.error || 'Proxy check-in failed.');
      setStep(4);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) { toast.error('Enter a valid code'); return; }
    submitSelf(manualCode.trim(), false);
  };

  const handleRetry = () => {
    setSubmitErrorMsg('');
    setStep(1);
  };

  if (!session) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
      {!submitting && <div className="absolute inset-0" onClick={onClose} />}

      <div className="w-full max-w-[430px] bg-white border-t border-gray-200 rounded-t-3xl p-6 shadow-2xl relative z-10 space-y-5 animate-[slideUp_0.25s_ease-out]">
        <div className="w-12 h-1 bg-[#002a63] rounded-full mx-auto" />

        {/* Header */}
        <div className="text-center">
          <h3 className="font-extrabold text-[#344767] text-base leading-snug">{session.courseName}</h3>
          <p className="text-xs text-[#8392ab] mt-1 uppercase font-semibold tracking-wider">
            {session.sessionType} Session
          </p>
        </div>

        {/* STEP 1: Main check-in UI */}
        {step === 1 && (
          <div className="space-y-4">

            {/* Mode toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => { setMode('self'); setInputMode('gps'); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'self' ? 'bg-white shadow text-[#344767]' : 'text-[#8392ab]'}`}
              >
                My Attendance
              </button>
              <button
                onClick={() => setMode('proxy')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'proxy' ? 'bg-white shadow text-[#344767]' : 'text-[#8392ab]'}`}
              >
                For Classmate
              </button>
            </div>

            {/* Self check-in */}
            {mode === 'self' && (
              <div className="space-y-3">
                {inputMode === 'gps' && (
                  <>
                    <button
                      onClick={() => submitSelf('', true)}
                      className="w-full bg-gradient-to-br from-[#14172B] to-[#3A416F] hover:opacity-90 text-white font-extrabold py-4 rounded-xl text-sm transition-colors shadow-lg"
                    >
                      Mark
                      <span className="block text-[10px] font-normal opacity-70 mt-0.5">Tap to check in via GPS</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[10px] text-[#8392ab] font-bold uppercase">or</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <button
                      onClick={() => setInputMode('code')}
                      className="w-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-[#344767] font-bold py-3 rounded-xl text-xs transition-colors"
                    >
                      Use Code
                      <span className="block text-[10px] font-normal text-[#8392ab] mt-0.5">Enter the attendance code manually</span>
                    </button>
                  </>
                )}

                {inputMode === 'code' && (
                  <form onSubmit={handleManualSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[#8392ab] text-xs font-semibold mb-1.5">Attendance Code</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter code from your rep..."
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[#344767] text-sm focus:outline-none focus:border-[#344767] font-mono"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-br from-[#14172B] to-[#3A416F] text-white font-extrabold py-3.5 rounded-xl text-xs hover:opacity-90"
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('gps')}
                      className="w-full text-xs text-[#8392ab] hover:text-[#344767] font-semibold py-1"
                    >
                      Back
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Proxy check-in */}
            {mode === 'proxy' && (
              <div className="space-y-3">
                <p className="text-xs text-[#8392ab] text-center">
                  You must be physically present in class to mark for a classmate.
                </p>
                <div>
                  <label className="block text-[#8392ab] text-xs font-semibold mb-1.5">Classmate's Index Number</label>
                  <input
                    type="text"
                    placeholder="e.g. CS/2021/002"
                    value={proxyIndex}
                    onChange={(e) => setProxyIndex(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[#344767] text-sm focus:outline-none focus:border-[#344767]"
                  />
                </div>
                <div>
                  <label className="block text-[#8392ab] text-xs font-semibold mb-1.5">Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. At the clinic, flight delay..."
                    value={proxyReason}
                    onChange={(e) => setProxyReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[#344767] text-sm focus:outline-none focus:border-[#344767]"
                  />
                </div>
                <button
                  onClick={submitProxy}
                  disabled={!proxyIndex.trim() || !proxyReason.trim()}
                  className="w-full bg-gradient-to-br from-[#14172B] to-[#3A416F] hover:opacity-90 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-xl text-xs transition-colors"
                >
                  Mark
                  <span className="block text-[10px] font-normal opacity-70 mt-0.5">Mark attendance for classmate</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              disabled={submitting}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-[#344767] font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* STEP 2: Loading */}
        {step === 2 && (
          <div className="space-y-6 text-center py-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 bg-[#344767]/10 rounded-full animate-ping" />
              <div className="w-10 h-10 bg-gradient-to-br from-[#14172B] to-[#3A416F] rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-[#344767]">
              <div className="w-4 h-4 border-2 border-[#344767] border-t-transparent rounded-full animate-spin" />
              <span className="font-semibold">{submittingStatus || 'Submitting...'}</span>
            </div>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 3 && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 bg-[#344767]/10 border border-[#344767]/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-9 h-9 text-[#344767]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-[#344767]">Marked!</h3>
              <p className="text-xs text-[#8392ab] mt-1">{successDetails.courseName}</p>
            </div>
            <div className="bg-gray-50 p-4 border border-gray-200 rounded-2xl flex justify-between items-center text-xs">
              <div className="text-left space-y-1">
                <span className="block text-[10px] text-[#8392ab] font-bold uppercase">Time</span>
                <span className="text-[#344767] font-bold font-mono">{successDetails.time}</span>
              </div>
              <span className={`px-3 py-1 text-xs font-black rounded-full border ${
                successDetails.status === 'PRESENT'
                  ? 'bg-[#344767]/10 text-[#344767] border-[#344767]/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }`}>
                {successDetails.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-br from-[#14172B] to-[#3A416F] hover:opacity-90 text-white font-extrabold py-3.5 rounded-xl text-xs"
            >
              Done
            </button>
          </div>
        )}

        {/* STEP 4: Error */}
        {step === 4 && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-[#344767]">Failed</h3>
              <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 p-3 rounded-xl max-w-[290px] mx-auto leading-relaxed">
                {submitErrorMsg || 'Something went wrong. Please try again.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 bg-gradient-to-br from-[#14172B] to-[#3A416F] hover:opacity-90 text-white font-extrabold py-3.5 rounded-xl text-xs"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#344767] font-bold py-3.5 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckInSheet;
