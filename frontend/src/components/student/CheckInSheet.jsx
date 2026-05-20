import { useState } from 'react';
import api from '../../services/api';
import QRScanner from '../QRScanner';
import { useToast } from '../ToastProvider';

const CheckInSheet = ({ session, indexNumber, fullName, onClose, onSuccess }) => {
  const toast = useToast();

  // Check-in state
  const [checkInStep, setCheckInStep] = useState(1); // 1: QR/Manual Input, 2: Location, 3: Success, 4: Error
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [scannedCodeToken, setScannedCodeToken] = useState('');
  const [gpsVerified, setGpsVerified] = useState(false);
  const [gpsCoords, setGpsCoords] = useState({ lat: null, lng: null });
  const [successDetails, setSuccessDetails] = useState({ status: '', time: '', courseName: '' });
  const [submitErrorMsg, setSubmitErrorMsg] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState('');

  // Generate unique device fingerprint
  const getDeviceFingerprint = () => {
    const fingerprintString = `${navigator.userAgent}_${window.screen.width}_${window.screen.height}`;
    return btoa(fingerprintString).substring(0, 32);
  };

  // QR Code scanned successfully
  const handleQRScanSuccess = (scannedToken) => {
    setScannedCodeToken(scannedToken);
    toast.success('QR code scanned!');
    advanceToLocation(scannedToken);
  };

  // Manual code confirm submit
  const handleManualCodeSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error('Please enter a valid token');
      return;
    }
    setScannedCodeToken(manualCode);
    advanceToLocation(manualCode);
  };

  // Transition to Location Step (Step 2)
  const advanceToLocation = (codeToken, isLocationOnly = false) => {
    setCheckInStep(2);
    triggerGPSLocation(codeToken, isLocationOnly);
  };

  // Geolocation trigger
  const triggerGPSLocation = (codeToken, isLocationOnly = false) => {
    setGpsVerified(false);
    setGpsError('');

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device');
      setCheckInStep(4);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        setGpsVerified(true);
        submitAttendanceCheckIn(codeToken, latitude, longitude, isLocationOnly);
      },
      (err) => {
        console.error('Location capture error:', err);
        setGpsError('Could not verify location. Make sure GPS location is enabled.');
        submitAttendanceCheckIn(codeToken, null, null, isLocationOnly);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Perform backend submit API with retry logic and offline support
  const submitAttendanceCheckIn = async (codeToken, lat, lng, isLocationOnly = false) => {
    setSubmitting(true);
    setCheckInStep(2);
    setSubmittingStatus('Initializing connection to check-in server...');

    const fingerprint = getDeviceFingerprint();
    const deviceInfo = `${navigator.platform} (${navigator.language})`;

    const payload = {
      indexNumber,
      name: fullName,
      deviceFingerprint: fingerprint,
      latitude: lat,
      longitude: lng,
      deviceInfo
    };

    if (isLocationOnly) {
      payload.sessionId = session?.id;
    } else {
      payload.qrCode = codeToken;
    }

    const maxRetries = 3;
    let attempt = 0;

    const executeRequest = async () => {
      attempt++;
      try {
        if (!navigator.onLine) {
          throw new Error('Offline');
        }

        setSubmittingStatus('Transmitting check-in report...');
        const response = await api.post('/attendance/mark', payload);

        setSuccessDetails({
          status: response.data.attendance?.status || 'PRESENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          courseName: session?.courseName || 'Class'
        });

        setCheckInStep(3); // Success Screen
        onSuccess(); // Trigger parent refresh
      } catch (err) {
        console.warn(`[Resilience] Check-in submission attempt ${attempt} failed:`, err);

        // Do not retry if the backend specifically rejected the submission (e.g. 400, 403, 401, 429)
        if (err.response) {
          const errMsg = err.response.data?.error || 'Check-in failed. Please verify credentials/fingerprint.';
          setSubmitErrorMsg(errMsg);
          setCheckInStep(4); // Error Screen
          return;
        }

        // If we ran out of retries, present the network failure message
        if (attempt >= maxRetries) {
          setSubmitErrorMsg('Network connection lost. Please verify your internet connection and try again.');
          setCheckInStep(4); // Error Screen
          return;
        }

        // Wait with exponential backoff before the next attempt
        const delayMs = attempt * 3000;
        setSubmittingStatus(`Network failure. Retrying check-in (Attempt ${attempt + 1}/${maxRetries}) in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        await executeRequest();
      }
    };

    await executeRequest();
    setSubmitting(false);
  };

  if (!session) return null;

  return (
    <div className="fixed inset-0 bg-[#000a18]/80 backdrop-blur-sm z-50 flex items-end justify-center">
      {!submitting && (
        <div className="absolute inset-0" onClick={onClose} />
      )}

      {/* Sheet */}
      <div className="w-full max-w-[430px] bg-[#001c44] border-t border-[#002a63] rounded-t-3xl p-6 shadow-2xl relative z-10 space-y-6 animate-[slideUp_0.25s_ease-out]">
        <div className="w-12 h-1 bg-[#002a63] rounded-full mx-auto" />

        <div className="text-center">
          <h3 className="font-extrabold text-white text-base leading-snug">{session.courseName}</h3>
          <p className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wider">
            {session.sessionType} Session
          </p>
          
          {(checkInStep === 1 || checkInStep === 2) && (
            <div className="text-[10px] text-[#D4A017] font-bold uppercase tracking-wider mt-2.5">
              Step {checkInStep} of 2
            </div>
          )}
        </div>

        {/* STEP 1: SCAN QR / ENTER MANUAL CODE */}
        {checkInStep === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-400">
                Scan the QR code displayed by your Class Rep
              </p>
            </div>

            {!showManualInput ? (
              <div className="space-y-4">
                <div className="w-full aspect-square max-w-[240px] mx-auto overflow-hidden rounded-2xl border-2 border-dashed border-[#D4A017]/40 relative bg-slate-950">
                  <QRScanner onScan={handleQRScanSuccess} />
                </div>
                <div className="text-center space-y-3">
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="text-xs text-[#D4A017] hover:text-[#b88a14] font-bold underline block mx-auto"
                  >
                    Enter code manually
                  </button>

                  {session?.sessionType === 'PHYSICAL' && (
                    <div className="pt-2 border-t border-[#002a63]">
                      <button
                        onClick={() => advanceToLocation('', true)}
                        className="w-full bg-[#003B8E] hover:bg-[#002a63] text-[#D4A017] border border-[#002a63] font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#D4A017]/5"
                      >
                        <svg className="w-4 h-4 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        Check In via GPS Location (No Scan)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleManualCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">Manual Token Code</label>
                  <input
                    type="text"
                    required
                    placeholder="Paste code from representative..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#D4A017] font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#D4A017] text-slate-950 font-extrabold py-3.5 rounded-xl text-xs hover:bg-[#b88a14] transition-colors"
                >
                  Verify Code
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowManualInput(false)}
                    className="text-xs text-slate-500 hover:text-slate-400"
                  >
                    Switch back to camera scanner
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={onClose}
              disabled={submitting}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* STEP 2: LOCATION CAPTURE / WAITING SUBMISSION */}
        {checkInStep === 2 && (
          <div className="space-y-6 text-center py-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 bg-[#D4A017]/20 rounded-full animate-ping" />
              <div className="w-10 h-10 bg-[#D4A017] rounded-full flex items-center justify-center shadow-lg shadow-[#D4A017]/10">
                <svg className="w-5 h-5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-white">Verifying location...</h4>
              <p className="text-xs text-slate-500 px-4">
                Fetching your GPS coordinates. Ensure browser location settings are enabled.
              </p>
            </div>

            {submitting && (
              <div className="flex flex-col items-center gap-3 text-xs text-slate-400 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-semibold text-slate-300">
                    {submittingStatus || 'Submitting check-in report...'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: SUCCESS ANIMATION & INFO */}
        {checkInStep === 3 && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-[#D4A017]/10 border border-[#D4A017]/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-9 h-9 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Attendance Marked!</h3>
              <p className="text-xs text-slate-400 mt-1">{successDetails.courseName}</p>
            </div>

            <div className="bg-slate-950/40 p-4 border border-[#002a63] rounded-2xl flex justify-between items-center text-xs">
              <div className="text-left space-y-1">
                <span className="block text-[10px] text-slate-500 font-bold uppercase">Time Marked</span>
                <span className="text-slate-300 font-bold font-mono">{successDetails.time}</span>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 text-xs font-black rounded-full border ${
                  successDetails.status === 'PRESENT' ? 'bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {successDetails.status}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-[#D4A017] hover:bg-[#b88a14] text-slate-950 font-extrabold py-3.5 rounded-xl text-xs transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* STEP 4: ERROR DISPLAY & RETRY BUTTON */}
        {checkInStep === 4 && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">Verification Failed</h3>
              <p className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl max-w-[290px] mx-auto leading-relaxed">
                {submitErrorMsg || gpsError || 'Location coordinate check or dynamic QR code validation failed.'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (scannedCodeToken) {
                    advanceToLocation(scannedCodeToken);
                  } else {
                    setCheckInStep(1);
                  }
                }}
                className="flex-1 bg-[#D4A017] hover:bg-[#b88a14] text-slate-950 font-extrabold py-3.5 rounded-xl text-xs transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors"
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
