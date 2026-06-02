import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../ToastProvider';

const CheckInSheet = ({ session, indexNumber, fullName, onClose, onSuccess }) => {
  const toast = useToast();

  const [mode, setMode] = useState('self');      // 'self' | 'proxy'
  const [inputMode, setInputMode] = useState('gps'); // 'gps' | 'code'
  const [manualCode, setManualCode] = useState('');

  // Proxy search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedClassmate, setSelectedClassmate] = useState(null); // { name, indexNumber }
  const [proxyReason, setProxyReason] = useState('');
  const searchTimeout = useRef(null);

  // Flow state
  const [step, setStep] = useState(1); // 1: main, 2: loading, 3: success, 4: error
  const [submitting, setSubmitting] = useState(false);
  const [successDetails, setSuccessDetails] = useState({ status: '', time: '', courseName: '', markedFor: '' });
  const [submitErrorMsg, setSubmitErrorMsg] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState('');

  const deviceInfo = `${navigator.platform} (${navigator.language})`;

  // Cleanup search debounce on unmount
  useEffect(() => () => clearTimeout(searchTimeout.current), []);

  const collectGPS = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({ lat: null, lng: null }); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  // Real-time classmate search
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setSearchResults([]);
    clearTimeout(searchTimeout.current);

    if (value.trim().length < 2) { setSearching(false); return; }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/attendance/session/${session.id}/classmates`, {
          params: { q: value.trim(), submitterIndex: indexNumber }
        });
        setSearchResults(res.data.students || []);
      } catch (_) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const selectClassmate = (student) => {
    setSelectedClassmate(student);
    setProxyReason('');
  };

  const clearSelection = () => {
    setSelectedClassmate(null);
    setProxyReason('');
  };

  // Submit own attendance
  const submitSelf = async (codeToken, useSessionId = false) => {
    setSubmitting(true);
    setStep(2);
    setSubmittingStatus('Getting your location...');

    const { lat, lng } = await collectGPS();
    setSubmittingStatus('Submitting attendance...');

    const payload = { indexNumber, name: fullName, latitude: lat, longitude: lng, deviceInfo };
    if (useSessionId) payload.sessionId = session?.id;
    else payload.qrCode = codeToken;

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
          courseName: session?.courseName || 'Class',
          markedFor: ''
        });
        setStep(3);
        onSuccess();
      } catch (err) {
        if (err.response) { setSubmitErrorMsg(err.response.data?.error || 'Check-in failed.'); setStep(4); return; }
        if (attempt >= maxRetries) { setSubmitErrorMsg('Network error. Check your connection and try again.'); setStep(4); return; }
        setSubmittingStatus(`Retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, attempt * 3000));
        await execute();
      }
    };
    await execute();
    setSubmitting(false);
  };

  // Submit proxy attendance
  const submitProxy = async () => {
    if (!selectedClassmate) { toast.error('Select a classmate first'); return; }
    if (!proxyReason.trim()) { toast.error('Enter a reason'); return; }

    setSubmitting(true);
    setStep(2);
    setSubmittingStatus('Getting your location...');

    const { lat, lng } = await collectGPS();
    setSubmittingStatus('Submitting attendance...');

    try {
      const response = await api.post('/attendance/mark-proxy', {
        submitterIndexNumber: indexNumber,
        targetIndexNumber: selectedClassmate.indexNumber,
        reason: proxyReason.trim(),
        sessionId: session?.id,
        latitude: lat,
        longitude: lng
      });
      setSuccessDetails({
        status: response.data.attendance?.status || 'PRESENT',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        courseName: session?.courseName || 'Class',
        markedFor: selectedClassmate.name
      });
      setStep(3);
      onSuccess();
    } catch (err) {
      setSubmitErrorMsg(err.response?.data?.error || 'Could not mark attendance.');
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
    setSelectedClassmate(null);
    setStep(1);
  };

  // Avatar initial circle
  const Avatar = ({ name, size = 'md' }) => {
    const s = size === 'lg'
      ? 'w-14 h-14 text-lg'
      : 'w-9 h-9 text-sm';
    return (
      <div className={`${s} rounded-full bg-gradient-to-br from-[#14172B] to-[#3A416F] flex items-center justify-center text-white font-black flex-shrink-0`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
    );
  };

  if (!session) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
      {!submitting && <div className="absolute inset-0" onClick={onClose} />}

      <div className="w-full max-w-[430px] bg-white border-t border-gray-200 rounded-t-3xl shadow-2xl relative z-10 animate-[slideUp_0.25s_ease-out] overflow-hidden">

        {/* Drag handle */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="text-center px-6 pb-4">
          <h3 className="font-extrabold text-[#344767] text-base leading-snug">{session.courseName}</h3>
          <p className="text-xs text-[#8392ab] mt-1 uppercase font-semibold tracking-wider">
            {session.sessionType} Session
          </p>
        </div>

        {/* ── STEP 1: Main UI ── */}
        {step === 1 && (
          <div className="px-6 pb-6 space-y-4">

            {/* Mode toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => { setMode('self'); setInputMode('gps'); clearSelection(); setSearchQuery(''); setSearchResults([]); }}
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

            {/* ── Self check-in ── */}
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
                    <button type="submit" className="w-full bg-gradient-to-br from-[#14172B] to-[#3A416F] text-white font-extrabold py-3.5 rounded-xl text-xs hover:opacity-90">
                      Verify
                    </button>
                    <button type="button" onClick={() => setInputMode('gps')} className="w-full text-xs text-[#8392ab] hover:text-[#344767] font-semibold py-1">
                      Back
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── Proxy check-in: Search ── */}
            {mode === 'proxy' && (
              <div className="space-y-3">
                {/* Search input */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8392ab]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search classmate by name..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-[#344767] text-sm focus:outline-none focus:border-[#344767]"
                    autoFocus
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-[#344767] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-52 overflow-y-auto rounded-xl border border-gray-100">
                    {searchResults.map((student) => (
                      <button
                        key={student.indexNumber}
                        onClick={() => selectClassmate(student)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                      >
                        <Avatar name={student.name} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#344767] truncate">{student.name}</p>
                          <p className="text-xs text-[#8392ab] font-mono">{student.indexNumber}</p>
                        </div>
                        <svg className="w-4 h-4 text-[#8392ab] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results state */}
                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-[#8392ab] text-center py-4">No classmates found for "{searchQuery}"</p>
                )}

                {/* Hint */}
                {searchQuery.trim().length < 2 && (
                  <p className="text-xs text-[#8392ab] text-center py-2">Type at least 2 letters to search</p>
                )}
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

        {/* ── STEP 2: Loading ── */}
        {step === 2 && (
          <div className="px-6 pb-8 space-y-6 text-center py-6">
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

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <div className="px-6 pb-6 space-y-5 text-center py-4">
            <div className="w-16 h-16 bg-[#344767]/10 border border-[#344767]/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-9 h-9 text-[#344767]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-[#344767]">Marked!</h3>
              <p className="text-xs text-[#8392ab] mt-1">
                {successDetails.markedFor ? `${successDetails.markedFor} · ` : ''}{successDetails.courseName}
              </p>
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
            <button onClick={onClose} className="w-full bg-gradient-to-br from-[#14172B] to-[#3A416F] hover:opacity-90 text-white font-extrabold py-3.5 rounded-xl text-xs">
              Done
            </button>
          </div>
        )}

        {/* ── STEP 4: Error ── */}
        {step === 4 && (
          <div className="px-6 pb-6 space-y-5 text-center py-4">
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
              <button onClick={handleRetry} className="flex-1 bg-gradient-to-br from-[#14172B] to-[#3A416F] hover:opacity-90 text-white font-extrabold py-3.5 rounded-xl text-xs">
                Retry
              </button>
              <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#344767] font-bold py-3.5 rounded-xl text-xs">
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Classmate confirmation overlay (slides up over step 1) ── */}
        {step === 1 && selectedClassmate && (
          <div className="absolute inset-0 bg-white rounded-t-3xl flex flex-col animate-[slideUp_0.2s_ease-out]">

            {/* Drag handle */}
            <div className="flex justify-center pt-4 pb-2">
              <div className="w-12 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex-1 px-6 pb-6 flex flex-col space-y-5 overflow-y-auto">

              {/* Back */}
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 text-xs text-[#8392ab] hover:text-[#344767] font-semibold self-start"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {/* Classmate card */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#14172B] to-[#3A416F] flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                  {selectedClassmate.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[#344767] text-base leading-tight truncate">{selectedClassmate.name}</p>
                  <p className="text-xs text-[#8392ab] font-mono mt-0.5">{selectedClassmate.indexNumber}</p>
                  <p className="text-xs text-[#8392ab] mt-1">{session.courseName}</p>
                </div>
              </div>

              {/* Reason input */}
              <div className="flex-1">
                <label className="block text-[#344767] text-xs font-bold mb-2">
                  Why are you marking for them?
                </label>
                <input
                  type="text"
                  placeholder="e.g. At the clinic, missed transport..."
                  value={proxyReason}
                  onChange={(e) => setProxyReason(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[#344767] text-sm focus:outline-none focus:border-[#344767]"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && proxyReason.trim()) submitProxy(); }}
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={submitProxy}
                  disabled={!proxyReason.trim()}
                  className="w-full bg-gradient-to-br from-[#14172B] to-[#3A416F] hover:opacity-90 disabled:opacity-40 text-white font-extrabold py-4 rounded-xl text-sm transition-colors shadow-lg"
                >
                  Mark
                  <span className="block text-[10px] font-normal opacity-70 mt-0.5">GPS · duplicate check · geofence</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-[#344767] font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CheckInSheet;
