import React, { useState, useEffect } from 'react';
import api from '../services/api';
import QRScanner from '../components/QRScanner';
import NotificationPanel from '../components/NotificationPanel';

const StudentPortal = () => {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'history' | 'profile'
  
  // Auth/Identity States
  const [isIdentified, setIsIdentified] = useState(
    !!localStorage.getItem('studentIndex') && !!localStorage.getItem('studentName')
  );
  const [indexNumber, setIndexNumber] = useState(localStorage.getItem('studentIndex') || '');
  const [fullName, setFullName] = useState(localStorage.getItem('studentName') || '');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('remember_student') === 'true');

  // Data States
  const [activeSessions, setActiveSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Filter chips for history
  const [filter, setFilter] = useState('All'); // 'All' | 'Present' | 'Late' | 'Absent'

  // Toast Notification State
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

  // Modal / Check-in Bottom Sheet States
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [checkInStep, setCheckInStep] = useState(1); // 1: QR/Manual Input, 2: Location, 3: Success, 4: Error
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsCoords, setGpsCoords] = useState({ lat: null, lng: null });
  const [scannedCodeToken, setScannedCodeToken] = useState('');
  const [successDetails, setSuccessDetails] = useState({ status: '', time: '', courseName: '' });
  const [submitErrorMsg, setSubmitErrorMsg] = useState('');

  // Department Branding
  const deptName = localStorage.getItem('dept_name') || 'GCTU Attendance';
  const deptLogo = localStorage.getItem('dept_logo') || '/logo.svg';

  useEffect(() => {
    fetchActiveSessions();
    if (isIdentified) {
      fetchStudentHistory();
    }
  }, [isIdentified]);

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const fetchActiveSessions = async () => {
    setLoadingActive(true);
    try {
      const response = await api.get('/sessions/active');
      setActiveSessions(Array.isArray(response.data) ? response.data : response.data ? [response.data] : []);
    } catch (err) {
      console.error('Fetch active sessions error:', err);
      showToast('Could not load active sessions');
    } finally {
      setLoadingActive(false);
    }
  };

  const fetchStudentHistory = async () => {
    if (!indexNumber) return;
    setLoadingHistory(true);
    try {
      const response = await api.get(`/attendance/student/${indexNumber}`);
      setHistory(response.data.history || []);
    } catch (err) {
      console.error('Fetch student history error:', err);
      showToast('Could not load attendance history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Student Identification Submission
  const handleIdentifySubmit = (e) => {
    e.preventDefault();
    if (!indexNumber.trim() || !fullName.trim()) {
      showToast('Please fill in both fields');
      return;
    }

    localStorage.setItem('studentIndex', indexNumber);
    localStorage.setItem('studentName', fullName);
    if (rememberMe) {
      localStorage.setItem('remember_student', 'true');
    } else {
      localStorage.removeItem('remember_student');
    }

    setIsIdentified(true);
    showToast('Signed in successfully!', 'success');
  };

  // Log Out / Reset Data
  const handleClearData = () => {
    if (window.confirm('This will sign you out and clear all local data. Continue?')) {
      localStorage.removeItem('studentIndex');
      localStorage.removeItem('studentName');
      localStorage.removeItem('remember_student');
      setIndexNumber('');
      setFullName('');
      setHistory([]);
      setIsIdentified(false);
      setActiveTab('home');
      showToast('Data cleared.', 'success');
    }
  };

  // Generate unique device fingerprint
  const getDeviceFingerprint = () => {
    const fingerprintString = `${navigator.userAgent}_${window.screen.width}_${window.screen.height}`;
    return btoa(fingerprintString).substring(0, 32);
  };

  // Trigger mark attendance sheet
  const handleStartCheckIn = (session) => {
    setSelectedSession(session);
    setCheckInStep(1);
    setManualCode('');
    setShowManualInput(false);
    setScannedCodeToken('');
    setGpsVerified(false);
    setGpsError('');
    setGpsCoords({ lat: null, lng: null });
    setSubmitErrorMsg('');
    setShowBottomSheet(true);
  };

  // QR Code scanned successfully
  const handleQRScanSuccess = (scannedToken) => {
    setScannedCodeToken(scannedToken);
    showToast('QR code scanned!', 'success');
    advanceToLocation(scannedToken);
  };

  // Manual code confirm submit
  const handleManualCodeSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      showToast('Please enter a valid token');
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

  // Perform backend submit API
  const submitAttendanceCheckIn = async (codeToken, lat, lng, isLocationOnly = false) => {
    setSubmitting(true);
    const fingerprint = getDeviceFingerprint();
    const deviceInfo = `${navigator.platform} (${navigator.language})`;

    try {
      const payload = {
        indexNumber,
        name: fullName,
        deviceFingerprint: fingerprint,
        latitude: lat,
        longitude: lng,
        deviceInfo
      };

      if (isLocationOnly) {
        payload.sessionId = selectedSession?.id;
      } else {
        payload.qrCode = codeToken;
      }

      const response = await api.post('/attendance/mark', payload);

      setSuccessDetails({
        status: response.data.attendance?.status || 'PRESENT',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        courseName: selectedSession?.courseName || 'Class'
      });

      setCheckInStep(3); // Success Screen
      fetchActiveSessions();
      fetchStudentHistory();
    } catch (err) {
      console.error('Submit check-in error:', err);
      const errMsg = err.response?.data?.error || 'Check-in failed. Please check your location/QR code.';
      setSubmitErrorMsg(errMsg);
      setCheckInStep(4); // Error Screen
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0] ? parts[0][0].toUpperCase() : 'S';
  };

  const getTimeDiffText = (startTime) => {
    const diffMs = Date.now() - new Date(startTime).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Started just now';
    if (diffMins < 60) return `Started ${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `Started ${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  };

  const totalClasses = history.length;
  const presentCount = history.filter(h => h.status === 'PRESENT').length;
  const lateCount = history.filter(h => h.status === 'LATE').length;
  const absentCount = history.filter(h => h.status === 'ABSENT').length;
  const attendanceRate = totalClasses > 0 ? Math.round(((presentCount + lateCount) / totalClasses) * 100) : 0;

  const filteredHistory = history.filter(record => {
    if (filter === 'All') return true;
    return record.status.toUpperCase() === filter.toUpperCase();
  });

  const groupedHistory = filteredHistory.reduce((acc, record) => {
    const courseCode = record.session?.course?.code || 'CS-XXXX';
    const courseName = record.session?.course?.name || 'General Course';
    if (!acc[courseCode]) {
      acc[courseCode] = {
        name: courseName,
        code: courseCode,
        records: []
      };
    }
    acc[courseCode].records.push(record);
    return acc;
  }, {});

  if (!isIdentified) {
    return (
      <div className="min-h-screen bg-[#00122c] text-slate-100 flex flex-col justify-center px-6 py-12 relative overflow-hidden">
        {/* Subtle Watermark School Crest */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
          <img src="/logo.jfif" alt="School Crest Watermark" className="w-[300px] h-[300px] object-contain filter grayscale" />
        </div>

        {/* Background Mesh decoration */}
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[50%] rounded-full bg-[#D4A017]/5 blur-[120px] pointer-events-none"></div>

        {/* Dynamic Toast */}
        {toast.show && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-[380px] bg-[#001c44] border border-rose-500/20 text-rose-400 p-4 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        )}

        <div className="max-w-[380px] w-full mx-auto space-y-8 relative z-10">
          <div className="text-center">
            {/* Large Gold Crest */}
            <div className="w-20 h-20 bg-[#D4A017]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#D4A017]/20 shadow-lg shadow-[#D4A017]/5">
              <svg className="w-12 h-12 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 14l9-5-9-5-9 5 9 5z" strokeWidth={1.5} />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-black text-white tracking-tight">Mark Your Attendance</h2>
            <p className="text-sm text-slate-400 mt-2">Enter your details to continue</p>
          </div>

          <form onSubmit={handleIdentifySubmit} className="space-y-5 bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Index Number</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                placeholder="e.g. 10892837"
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-3.5 text-white text-lg font-mono focus:outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-3.5 text-white text-lg focus:outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-all"
              />
            </div>

            {/* Remember Me Switch */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">Remember Me</span>
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                  rememberMe ? 'bg-[#D4A017]' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 transform ${
                    rememberMe ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-[#D4A017] hover:bg-[#b88a14] active:scale-[0.97] text-slate-950 font-extrabold py-4 rounded-xl transition-all shadow-lg shadow-[#D4A017]/10 text-base"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#00122c] text-slate-100 flex flex-col max-w-[430px] mx-auto shadow-2xl border-x border-[#002a63] relative">
      {/* Subtle Watermark School Crest */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <img src="/logo.jfif" alt="School Crest Watermark" className="w-[300px] h-[300px] object-contain filter grayscale" />
      </div>

      {/* Toast Overlay */}
      {toast.show && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-[380px] p-4 rounded-xl border shadow-2xl flex items-center gap-2 transition-all ${
          toast.type === 'success' ? 'bg-[#001c44] border-[#D4A017]/20 text-[#D4A017]' : 'bg-[#001c44] border-rose-500/20 text-rose-400'
        }`}>
          <span className={`w-2 h-2 rounded-full inline-block ${toast.type === 'success' ? 'bg-[#D4A017]' : 'bg-rose-500'}`}></span>
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="bg-[#000a18]/80 backdrop-blur-md border-b border-[#002a63] sticky top-0 z-30 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src={deptLogo} alt="Logo" className="w-8 h-8 object-contain bg-[#000a18]/40 rounded border border-[#002a63] p-0.5" />
          <span className="text-xs font-extrabold text-white truncate max-w-[160px]">{deptName}</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationPanel studentIndex={indexNumber} />
          <div className="text-right">
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Welcome</span>
            <span className="text-xs font-bold text-[#D4A017]">Hi, {fullName.split(' ')[0]}</span>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto relative z-10">
        
        {/* TAB 1: HOME (Active Sessions) */}
        {activeTab === 'home' && (
          <div className="space-y-5 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black text-white">Active Sessions</h2>
              <button
                onClick={fetchActiveSessions}
                disabled={loadingActive}
                className="p-2 rounded-lg bg-[#000a18] border border-[#002a63] hover:bg-[#001c44] text-slate-400 hover:text-[#D4A017] transition-colors"
                title="Refresh sessions"
              >
                <svg className={`w-4 h-4 ${loadingActive ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                </svg>
              </button>
            </div>

            {loadingActive ? (
              <div className="space-y-4">
                <div className="bg-[#001c44]/40 border border-[#002a63] p-5 rounded-2xl space-y-4 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-800 rounded w-1/3"></div>
                  <div className="h-10 bg-slate-800 rounded-xl"></div>
                </div>
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="text-center py-16 px-4 flex flex-col items-center">
                <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-bold text-slate-300">No active sessions right now</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-[240px]">Check back when your class rep opens a session</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <div key={session.id} className="bg-[#001c44] border border-[#002a63] rounded-2xl overflow-hidden shadow-xl flex flex-col">
                    {/* Top Type Indicator bar - Gold for physical, blue for online */}
                    <div className={`h-1.5 ${session.sessionType === 'PHYSICAL' ? 'bg-[#D4A017]' : 'bg-blue-500'}`} />
                    
                    <div className="p-5 flex-1 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                          session.sessionType === 'PHYSICAL' ? 'bg-[#D4A017]/10 text-[#D4A017] border border-[#D4A017]/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {session.sessionType === 'PHYSICAL' ? '📍 Physical' : '💻 Online'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {getTimeDiffText(session.startTime)}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-white text-base leading-snug">{session.courseName}</h4>
                        <p className="text-xs font-mono text-slate-500 mt-1">{session.courseCode}</p>
                      </div>
                      
                      <button
                        onClick={() => handleStartCheckIn(session)}
                        className="w-full mt-2 bg-[#D4A017] hover:bg-[#b88a14] active:scale-[0.97] text-slate-950 font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        Mark Attendance
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HISTORY (My Attendance) */}
        {activeTab === 'history' && (
          <div className="space-y-5 animate-[fadeIn_0.2s_ease-out]">
            <h2 className="text-lg font-black text-white">My Attendance</h2>

            {/* Horizontal Scrollable stats */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              <div className="flex-shrink-0 bg-[#001c44] border border-[#002a63] p-3.5 rounded-xl text-center min-w-[80px]">
                <span className="block text-lg font-bold text-slate-300 font-mono">{totalClasses}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Total</span>
              </div>
              <div className="flex-shrink-0 bg-[#001c44] border border-[#002a63] p-3.5 rounded-xl text-center min-w-[80px]">
                <span className="block text-lg font-bold text-[#D4A017] font-mono">{presentCount}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Present</span>
              </div>
              <div className="flex-shrink-0 bg-[#001c44] border border-[#002a63] p-3.5 rounded-xl text-center min-w-[80px]">
                <span className="block text-lg font-bold text-amber-400 font-mono">{lateCount}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Late</span>
              </div>
              <div className="flex-shrink-0 bg-[#001c44] border border-[#002a63] p-3.5 rounded-xl text-center min-w-[80px]">
                <span className="block text-lg font-bold text-rose-400 font-mono">{absentCount}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Absent</span>
              </div>
              
              {/* Circular Progress Ring */}
              <div className="flex-shrink-0 bg-[#001c44] border border-[#002a63] p-2 px-3 rounded-xl flex items-center gap-2">
                <div className="relative w-11 h-11 flex items-center justify-center">
                  <svg className="w-11 h-11 transform -rotate-90">
                    <circle cx="22" cy="22" r="18" stroke="#334155" strokeWidth="3" fill="transparent" />
                    <circle cx="22" cy="22" r="18" stroke="#D4A017" strokeWidth="3" fill="transparent"
                            strokeDasharray={113.1} strokeDashoffset={113.1 - (113.1 * attendanceRate) / 100} />
                  </svg>
                  <span className="absolute text-[9px] font-bold text-white">{attendanceRate}%</span>
                </div>
                <div className="leading-none">
                  <span className="block text-[8px] text-slate-500 font-bold uppercase">Rate</span>
                  <span className="text-[10px] font-bold text-[#D4A017]">Standard</span>
                </div>
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-2">
              {['All', 'Present', 'Late', 'Absent'].map(chip => (
                <button
                  key={chip}
                  onClick={() => setFilter(chip)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    filter === chip
                      ? 'bg-[#D4A017] text-slate-950 border-[#D4A017]'
                      : 'bg-[#000a18] text-slate-400 border-[#002a63] hover:border-slate-700'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {loadingHistory ? (
              <div className="space-y-4">
                <div className="h-10 bg-[#001c44] rounded-xl animate-pulse"></div>
              </div>
            ) : totalClasses === 0 ? (
              <div className="text-center py-10 bg-[#001c44]/20 border border-dashed border-[#002a63] rounded-xl text-xs text-slate-500">
                No attendance logs found.
              </div>
            ) : Object.keys(groupedHistory).length === 0 ? (
              <div className="text-center py-10 bg-[#001c44]/20 border border-dashed border-[#002a63] rounded-xl text-xs text-slate-500">
                No logs matching filter selection.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedHistory).map(code => (
                  <div key={code} className="bg-[#001c44]/40 border border-[#002a63] rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-[#002a63]/60 pb-2">
                      <h4 className="font-extrabold text-sm text-slate-200">{groupedHistory[code].name}</h4>
                      <span className="font-mono text-[10px] text-slate-500">{code}</span>
                    </div>

                    <div className="space-y-2">
                      {groupedHistory[code].records.map(record => (
                        <div key={record.id} className="flex justify-between items-center bg-[#000a18]/40 p-2.5 rounded-lg border border-[#002a63]/40 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500">
                              {new Date(record.checkInTime || record.createdAt).toLocaleDateString()}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {record.status === 'ABSENT' ? '-' : new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${
                            record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            record.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {record.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6 text-center animate-[fadeIn_0.2s_ease-out]">
            <h2 className="text-lg font-black text-white text-left">Student Profile</h2>

            {/* Avatar & Initials */}
            <div className="bg-[#001c44] border border-[#002a63] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="w-20 h-20 bg-[#D4A017] text-slate-950 text-2xl font-black rounded-full flex items-center justify-center mx-auto shadow-lg shadow-[#D4A017]/10 border-4 border-[#00122c]">
                {getInitials(fullName)}
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{fullName}</h3>
                <p className="text-xs text-slate-500 font-mono mt-1">Index: {indexNumber}</p>
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-[#001c44] border border-[#002a63] p-4 rounded-2xl shadow-xl">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Summary Statistics</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#000a18]/40 rounded-xl border border-[#002a63]/80">
                  <span className="block text-base font-bold text-[#D4A017] font-mono">{presentCount}</span>
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Present</span>
                </div>
                <div className="p-3 bg-[#000a18]/40 rounded-xl border border-[#002a63]/80">
                  <span className="block text-base font-bold text-amber-400 font-mono">{lateCount}</span>
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Late</span>
                </div>
                <div className="p-3 bg-[#000a18]/40 rounded-xl border border-[#002a63]/80">
                  <span className="block text-base font-bold text-rose-400 font-mono">{absentCount}</span>
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Absent</span>
                </div>
              </div>
            </div>

            {/* Operations */}
            <div className="space-y-4">
              <button
                onClick={handleClearData}
                className="w-full py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Clear My Data & Logout
              </button>
              
              <div className="text-[10px] text-slate-600 font-mono pt-4">
                Class Attendance System v1.0
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-40 max-w-[430px] w-full bg-[#000a18]/95 backdrop-blur-md border-t border-[#002a63] px-6 py-2 pb-safe flex justify-between items-center shadow-2xl">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1.5 transition-colors py-1 flex-1 ${
            activeTab === 'home' ? 'text-[#D4A017] font-extrabold' : 'text-slate-500 font-medium'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1.5 transition-colors py-1 flex-1 ${
            activeTab === 'history' ? 'text-[#D4A017] font-extrabold' : 'text-slate-500 font-medium'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-[10px] tracking-tight">History</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1.5 transition-colors py-1 flex-1 ${
            activeTab === 'profile' ? 'text-[#D4A017] font-extrabold' : 'text-slate-500 font-medium'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] tracking-tight">Profile</span>
        </button>
      </nav>

      {/* MARK ATTENDANCE BOTTOM SHEET MODAL */}
      {showBottomSheet && selectedSession && (
        <div className="fixed inset-0 bg-[#000a18]/80 backdrop-blur-sm z-50 flex items-end justify-center">
          {!submitting && (
            <div className="absolute inset-0" onClick={() => setShowBottomSheet(false)} />
          )}

          {/* Sheet */}
          <div className="w-full max-w-[430px] bg-[#001c44] border-t border-[#002a63] rounded-t-3xl p-6 shadow-2xl relative z-10 space-y-6 animate-[slideUp_0.25s_ease-out]">
            <div className="w-12 h-1 bg-[#002a63] rounded-full mx-auto" />

            <div className="text-center">
              <h3 className="font-extrabold text-white text-base leading-snug">{selectedSession.courseName}</h3>
              <p className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wider">
                {selectedSession.sessionType} Session
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

                      {selectedSession?.sessionType === 'PHYSICAL' && (
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
                  onClick={() => setShowBottomSheet(false)}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
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
                  <div className="flex justify-center items-center gap-2 text-xs text-slate-400">
                    <div className="w-4 h-4 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin"></div>
                    Submitting check-in report...
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
                  onClick={() => setShowBottomSheet(false)}
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
                    onClick={() => setShowBottomSheet(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default StudentPortal;
