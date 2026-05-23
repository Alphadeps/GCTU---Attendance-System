import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationPanel from '../components/NotificationPanel';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import CheckInSheet from '../components/student/CheckInSheet';
import GrievanceModal from '../components/student/GrievanceModal';

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

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const StudentPortal = () => {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'history' | 'grievances' | 'profile'

  // Auth/Identity States
  const [isIdentified, setIsIdentified] = useState(
    !!localStorage.getItem('studentIndex') && !!localStorage.getItem('studentName')
  );
  const [indexNumber, setIndexNumber] = useState(localStorage.getItem('studentIndex') || '');
  const [fullName, setFullName] = useState(localStorage.getItem('studentName') || '');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('remember_student') === 'true');

  // Network Status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Data States
  const [activeSessions, setActiveSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Filter chips for history
  const [filter, setFilter] = useState('All'); // 'All' | 'Present' | 'Late' | 'Absent'

  // Global toast hook
  const toast = useToast();

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });

  // Grievance States
  const [grievances, setGrievances] = useState([]);
  const [loadingGrievances, setLoadingGrievances] = useState(false);
  const [showGrievanceModal, setShowGrievanceModal] = useState(false);
  const [grievanceCourse, setGrievanceCourse] = useState('');

  // Check-in Bottom Sheet States
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // Department Branding
  const deptName = localStorage.getItem('dept_name') || 'GCTU Attendance';
  const deptLogo = localStorage.getItem('dept_logo') || '/logo.svg';

  const fetchActiveSessions = async () => {
    setLoadingActive(true);
    try {
      const response = await api.get('/sessions/active');
      setActiveSessions(Array.isArray(response.data) ? response.data : response.data ? [response.data] : []);
    } catch (err) {
      console.error('Fetch active sessions error:', err);
      toast.error('Could not load active sessions');
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
      toast.error('Could not load attendance history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchStudentGrievances = async () => {
    if (!indexNumber) return;
    setLoadingGrievances(true);
    try {
      const response = await api.get(`/grievances/student/${indexNumber}`);
      setGrievances(response.data || []);
    } catch (err) {
      console.error('Fetch student grievances error:', err);
    } finally {
      setLoadingGrievances(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    if (isIdentified) {
      fetchStudentHistory();
      fetchStudentGrievances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIdentified]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Network connection restored!');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are currently offline.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Student Identification Submission
  const handleIdentifySubmit = (e) => {
    e.preventDefault();
    if (!indexNumber.trim() || !fullName.trim()) {
      toast.error('Please fill in both fields');
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
    toast.success('Signed in successfully!');
  };

  // Log Out / Reset Data
  const handleClearData = () => {
    setConfirmState({
      open: true,
      message: 'This will sign you out and clear all local data. Continue?',
      onConfirm: () => {
        localStorage.removeItem('studentIndex');
        localStorage.removeItem('studentName');
        localStorage.removeItem('remember_student');
        setIndexNumber('');
        setFullName('');
        setHistory([]);
        setIsIdentified(false);
        setActiveTab('home');
        toast.success('Data cleared.');
        setConfirmState({ open: false, message: '', onConfirm: null });
      }
    });
  };

  // Trigger mark attendance sheet
  const handleStartCheckIn = (session) => {
    setSelectedSession(session);
    setShowBottomSheet(true);
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

  // Pre-calculate unique courses from student history
  const uniqueCourses = (() => {
    const codes = Array.from(new Set(history.map(h => h.session?.courseCode).filter(Boolean)));
    return codes.map(code => {
      const match = history.find(h => h.session?.courseCode === code);
      return {
        code,
        name: match?.session?.course?.name || code
      };
    });
  })();

  // ── IDENTIFICATION SCREEN ──
  if (!isIdentified) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-[#17c1e8]/10 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-[#cb0c9f]/8 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-[380px] relative z-10 space-y-6 animate-fade-in-up">
          {/* Logo + heading */}
          <div className="text-center">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,.1)] flex items-center justify-center mx-auto mb-5 border border-gray-100">
              <img src={deptLogo} alt="Logo" className="w-12 h-12 object-contain" />
            </div>
            <h1 className="text-[22px] font-black text-[#344767] tracking-tight">Who are you?</h1>
            <p className="text-[13px] text-[#8392ab] mt-1">Enter your details to mark attendance</p>
          </div>

          {/* Identification card */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,.08)] border border-gray-100">
            <form onSubmit={handleIdentifySubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#8392ab] uppercase tracking-wider mb-2">
                  Index Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  placeholder="e.g. 10892837"
                  value={indexNumber}
                  onChange={(e) => setIndexNumber(e.target.value)}
                  className="sip-input w-full text-[16px] font-mono py-3.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8392ab] uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="sip-input w-full text-[16px] py-3.5"
                />
              </div>

              {/* Remember Me toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-[13px] text-[#344767] font-medium">Remember Me</span>
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                    rememberMe ? 'bg-[#17c1e8]' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      rememberMe ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                className="sip-btn-primary w-full py-4 text-[15px] mt-2"
              >
                Confirm Identity
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-[#8392ab]">{deptName}</p>
        </div>
      </div>
    );
  }

  // ── MAIN APP SHELL (identified) ──
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col max-w-[430px] mx-auto relative">

      {/* ── STICKY TOP HEADER ── */}
      <header className="bg-white sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#f8f9fa] flex items-center justify-center">
            <img src={deptLogo} alt="Logo" className="w-5 h-5 object-contain" />
          </div>
          <span className="text-[13px] font-bold text-[#344767] truncate max-w-[140px]">Attendance</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Online indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
            <span className={`text-[10px] font-semibold ${isOnline ? 'text-emerald-500' : 'text-rose-400'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <NotificationPanel studentIndex={indexNumber} />
        </div>
      </header>

      {/* Welcome banner (when identified) */}
      {isIdentified && (activeTab === 'home') && (
        <div className="bg-gradient-to-r from-[#14172B] to-[#3A416F] px-5 py-4 animate-fade-in">
          <p className="text-[11px] text-blue-200 font-medium">{getGreeting()},</p>
          <p className="text-[16px] font-black text-white mt-0.5 truncate">{fullName.split(' ')[0]}</p>
          <p className="text-[10px] text-blue-300 font-mono mt-0.5">{indexNumber}</p>
        </div>
      )}

      {/* ── TAB CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-20">

        {/* ── HOME TAB ── */}
        {activeTab === 'home' && (
          <div className="p-4 space-y-4">

            {/* Active sessions header */}
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-[#344767]">Active Sessions</p>
              <button
                onClick={fetchActiveSessions}
                disabled={loadingActive}
                className="p-2 rounded-xl bg-white border border-gray-100 text-[#8392ab] hover:text-[#17c1e8] transition-colors shadow-[0_1px_3px_rgba(0,0,0,.06)]"
              >
                <svg className={`w-4 h-4 ${loadingActive ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                </svg>
              </button>
            </div>

            {/* Loading skeleton */}
            {loadingActive && (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton h-36 rounded-2xl" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loadingActive && activeSessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in-up">
                <div className="w-16 h-16 rounded-3xl bg-white border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,.08)] flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[14px] font-bold text-[#344767]">No active sessions</p>
                <p className="text-[12px] text-[#8392ab] mt-1 max-w-[220px]">Check back when your class rep opens a session</p>
              </div>
            )}

            {/* Session cards */}
            {!loadingActive && activeSessions.map((session, idx) => (
              <div
                key={session.id}
                className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.08)] hover-lift animate-fade-in-up"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {/* Type indicator bar */}
                <div className={`h-1 ${session.sessionType === 'PHYSICAL' ? 'bg-gradient-to-r from-[#17c1e8] to-[#0ea5c9]' : 'bg-gradient-to-r from-[#cb0c9f] to-[#e91e8c]'}`} />
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`badge ${session.sessionType === 'PHYSICAL' ? 'badge-info' : 'badge-primary'}`}>
                      {session.sessionType === 'PHYSICAL' ? 'Physical' : 'Online'}
                    </span>
                    <span className="text-[11px] text-[#8392ab]">{getTimeDiffText(session.startTime)}</span>
                  </div>
                  <div>
                    <p className="text-[15px] font-extrabold text-[#344767] leading-snug">{session.courseName}</p>
                    <p className="text-[11px] font-mono text-[#8392ab] mt-0.5">{session.courseCode}</p>
                  </div>
                  <button
                    onClick={() => handleStartCheckIn(session)}
                    className="sip-btn-primary w-full py-3.5 text-[13px] flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark Attendance
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="p-4 space-y-4 animate-fade-in">

            <p className="text-[14px] font-bold text-[#344767]">My Attendance</p>

            {/* Stats row */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
              <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 text-center min-w-[76px] shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <span className="block text-[18px] font-bold text-[#344767] font-mono">{totalClasses}</span>
                <span className="text-[9px] text-[#8392ab] font-bold uppercase">Total</span>
              </div>
              <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 text-center min-w-[76px] shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <span className="block text-[18px] font-bold text-emerald-500 font-mono">{presentCount}</span>
                <span className="text-[9px] text-[#8392ab] font-bold uppercase">Present</span>
              </div>
              <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 text-center min-w-[76px] shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <span className="block text-[18px] font-bold text-amber-500 font-mono">{lateCount}</span>
                <span className="text-[9px] text-[#8392ab] font-bold uppercase">Late</span>
              </div>
              <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 text-center min-w-[76px] shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <span className="block text-[18px] font-bold text-rose-500 font-mono">{absentCount}</span>
                <span className="text-[9px] text-[#8392ab] font-bold uppercase">Absent</span>
              </div>
              {/* Progress ring */}
              <div className="flex-shrink-0 bg-white rounded-2xl px-3 py-2 flex items-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <div className="relative w-11 h-11 flex items-center justify-center">
                  <svg className="w-11 h-11 -rotate-90">
                    <circle cx="22" cy="22" r="18" stroke="#e2e8f0" strokeWidth="3" fill="transparent" />
                    <circle cx="22" cy="22" r="18" stroke="#17c1e8" strokeWidth="3" fill="transparent"
                      strokeDasharray={113.1} strokeDashoffset={113.1 - (113.1 * attendanceRate) / 100} />
                  </svg>
                  <span className="absolute text-[9px] font-bold text-[#344767]">{attendanceRate}%</span>
                </div>
                <div>
                  <span className="block text-[8px] text-[#8392ab] font-bold uppercase">Rate</span>
                </div>
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2">
              {['All', 'Present', 'Late', 'Absent'].map(chip => (
                <button
                  key={chip}
                  onClick={() => setFilter(chip)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all
                    ${filter === chip
                      ? 'bg-[#17c1e8] text-white border-[#17c1e8]'
                      : 'bg-white text-[#8392ab] border-gray-200 hover:border-[#17c1e8]'
                    }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Records */}
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
              </div>
            ) : totalClasses === 0 ? (
              <div className="flex flex-col items-center py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <svg className="w-9 h-9 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-[12px] font-semibold text-[#8392ab]">No attendance logs found.</p>
              </div>
            ) : Object.keys(groupedHistory).length === 0 ? (
              <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-[12px] text-[#8392ab] shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                No logs match the selected filter.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.keys(groupedHistory).map((code, idx) => (
                  <div
                    key={code}
                    className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,.06)] animate-fade-in-up"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3">
                      <p className="text-[13px] font-bold text-[#344767]">{groupedHistory[code].name}</p>
                      <span className="badge badge-dark font-mono">{code}</span>
                    </div>
                    <div className="space-y-2">
                      {groupedHistory[code].records.map(record => (
                        <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-[12px] font-semibold text-[#344767]">
                              {new Date(record.checkInTime || record.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-[#8392ab] mt-0.5">
                              {record.status === 'ABSENT' ? '—' : new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className={`badge ${
                            record.status === 'PRESENT' ? 'badge-success' :
                            record.status === 'LATE' ? 'badge-warning' :
                            'badge-danger'
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

        {/* ── GRIEVANCES TAB ── */}
        {activeTab === 'grievances' && (
          <div className="p-4 space-y-4 animate-fade-in">

            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-[#344767]">My Grievances</p>
              <button
                onClick={fetchStudentGrievances}
                disabled={loadingGrievances}
                className="p-2 rounded-xl bg-white border border-gray-100 text-[#8392ab] hover:text-[#17c1e8] transition-colors shadow-[0_1px_3px_rgba(0,0,0,.06)]"
              >
                <svg className={`w-4 h-4 ${loadingGrievances ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                </svg>
              </button>
            </div>

            <p className="text-[12px] text-[#8392ab] leading-relaxed">
              Report GPS failures, request attendance overrides for excusable absences, or flag academic dishonesty.
            </p>

            {/* Grievance list */}
            {loadingGrievances ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
              </div>
            ) : grievances.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <svg className="w-9 h-9 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-[12px] font-semibold text-[#8392ab]">No grievances logged yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {grievances.map((g, idx) => (
                  <div
                    key={g.id}
                    className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,.06)] animate-fade-in-up"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`badge ${
                        g.type === 'ABSENCE_EXCUSE' ? 'badge-info' :
                        g.type === 'SYSTEM_ISSUE' ? 'badge-warning' :
                        g.type === 'INTEGRITY_REPORT' ? 'badge-danger' :
                        'badge-dark'
                      }`}>
                        {g.type.replace('_', ' ')}
                      </span>
                      <span className={`badge ${
                        g.status === 'PENDING' ? 'badge-warning' :
                        g.status === 'RESOLVED' ? 'badge-success' :
                        'badge-danger'
                      }`}>
                        {g.status}
                      </span>
                    </div>
                    <p className="text-[13px] font-bold text-[#344767]">{g.subject}</p>
                    {g.courseCode && <p className="text-[10px] font-mono text-[#8392ab] mt-0.5">{g.courseCode}</p>}
                    <p className="text-[11px] text-[#8392ab] mt-2 leading-relaxed line-clamp-2">{g.message}</p>
                    {g.adminResponse && (
                      <div className="mt-3 bg-[#f8f9fa] rounded-xl p-3 border border-gray-100">
                        <p className="text-[9px] font-bold text-[#344767] uppercase tracking-wider mb-1">Department Reply</p>
                        <p className="text-[11px] text-[#344767] italic">"{g.adminResponse}"</p>
                      </div>
                    )}
                    {g.evidenceUrl && (
                      <div className="mt-2 flex justify-end">
                        <a href={`http://localhost:5000${g.evidenceUrl}`} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[#17c1e8] font-semibold hover:underline">
                          View Evidence
                        </a>
                      </div>
                    )}
                    <p className="text-[9px] text-[#8392ab] mt-2 text-right font-mono">
                      {new Date(g.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Spacer so FAB doesn't overlap last card */}
            <div className="h-4" />
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div className="p-4 space-y-4 animate-fade-in">

            <p className="text-[14px] font-bold text-[#344767]">My Profile</p>

            {/* Avatar card */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,.08)] flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#17c1e8] to-[#0ea5c9] text-white text-2xl font-black flex items-center justify-center shadow-lg shadow-[#17c1e8]/30 mb-3">
                {getInitials(fullName)}
              </div>
              <p className="text-[16px] font-extrabold text-[#344767]">{fullName}</p>
              <p className="text-[12px] text-[#8392ab] font-mono mt-0.5">Index: {indexNumber}</p>
            </div>

            {/* Quick stats */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,.08)]">
              <p className="text-[11px] font-bold text-[#8392ab] uppercase tracking-wider mb-4">Attendance Summary</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#f8f9fa] rounded-xl p-3 text-center">
                  <span className="block text-[18px] font-bold text-emerald-500 font-mono">{presentCount}</span>
                  <span className="text-[9px] text-[#8392ab] uppercase font-semibold">Present</span>
                </div>
                <div className="bg-[#f8f9fa] rounded-xl p-3 text-center">
                  <span className="block text-[18px] font-bold text-amber-500 font-mono">{lateCount}</span>
                  <span className="text-[9px] text-[#8392ab] uppercase font-semibold">Late</span>
                </div>
                <div className="bg-[#f8f9fa] rounded-xl p-3 text-center">
                  <span className="block text-[18px] font-bold text-rose-500 font-mono">{absentCount}</span>
                  <span className="text-[9px] text-[#8392ab] uppercase font-semibold">Absent</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[12px] text-[#8392ab]">Overall Attendance Rate</p>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${attendanceRate >= 75 ? 'bg-emerald-500' : attendanceRate >= 60 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${attendanceRate}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-bold text-[#344767]">{attendanceRate}%</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleClearData}
                className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 text-[13px] font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out &amp; Clear Data
              </button>
              <p className="text-center text-[10px] text-[#8392ab] font-mono">Class Attendance System v1.0</p>
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM TAB NAVIGATION ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-[430px] w-full z-40 bg-white border-t border-gray-100 shadow-[0_-1px_4px_rgba(0,0,0,.07)]">
        <div className="flex items-center">
          {/* Home */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors
              ${activeTab === 'home' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className={`text-[10px] font-semibold ${activeTab === 'home' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}>Home</span>
          </button>

          {/* History */}
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors
              ${activeTab === 'history' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-[10px] font-semibold ${activeTab === 'history' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}>History</span>
          </button>

          {/* Grievances */}
          <button
            onClick={() => { setActiveTab('grievances'); fetchStudentGrievances(); }}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors
              ${activeTab === 'grievances' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className={`text-[10px] font-semibold ${activeTab === 'grievances' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}>Grievances</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors
              ${activeTab === 'profile' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className={`text-[10px] font-semibold ${activeTab === 'profile' ? 'text-[#17c1e8]' : 'text-[#8392ab]'}`}>Profile</span>
          </button>
        </div>
      </nav>

      {/* ── GRIEVANCE FAB ── */}
      {activeTab === 'grievances' && (
        <button
          onClick={() => {
            const codes = Array.from(new Set(history.map(h => h.session?.courseCode).filter(Boolean)));
            const list = codes.map(code => {
              const match = history.find(h => h.session?.courseCode === code);
              return { code, name: match?.session?.course?.name || code };
            });
            if (list.length > 0 && !grievanceCourse) {
              setGrievanceCourse(list[0].code);
            }
            setShowGrievanceModal(true);
          }}
          className="fixed bottom-[72px] right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#17c1e8] to-[#0ea5c9] text-white shadow-lg shadow-[#17c1e8]/30 flex items-center justify-center hover-lift transition-all animate-scale-in"
          title="New Grievance"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* ── MARK ATTENDANCE BOTTOM SHEET ── */}
      {showBottomSheet && selectedSession && (
        <CheckInSheet
          session={selectedSession}
          indexNumber={indexNumber}
          fullName={fullName}
          onClose={() => setShowBottomSheet(false)}
          onSuccess={() => {
            fetchActiveSessions();
            fetchStudentHistory();
          }}
        />
      )}

      {/* ── GRIEVANCE MODAL ── */}
      {showGrievanceModal && (
        <GrievanceModal
          indexNumber={indexNumber}
          fullName={fullName}
          courses={uniqueCourses}
          onClose={() => setShowGrievanceModal(false)}
          onSubmitted={fetchStudentGrievances}
        />
      )}

      {/* ── CONFIRM MODAL ── */}
      {confirmState.open && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState({ open: false, message: '', onConfirm: null })}
        />
      )}

      {/* Credit footer */}
      <div className="fixed bottom-[72px] left-4 z-10 pointer-events-none">
        <p className="text-[#8392ab] text-[9px] font-mono">
          Built by{' '}
          <a
            href="https://alphagroupofdevelopers.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#344767] pointer-events-auto"
          >
            Alpha Group
          </a>
        </p>
      </div>
    </div>
  );
};

export default StudentPortal;
