import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NotificationPanel from '../components/NotificationPanel';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import ExcusedAbsencesManager from '../components/ExcusedAbsencesManager';

const RepDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal / Form States
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessionType, setSessionType] = useState('PHYSICAL');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [networkSSID, setNetworkSSID] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [gpsLoading, setGpsLoading] = useState(false);

  // Sidebar / Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Analytics
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Class info (from localStorage — populated at login)
  const [classStudentCount, setClassStudentCount] = useState(0);

  // Students list
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });

  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const { role, username, assignedClass, deptName, deptLogo } = auth;

  // Use defaults if not set
  const displayDeptName = deptName || 'Class Attendance System';
  const displayDeptLogo = deptLogo || '/logo2.png';

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Always fetch recent sessions
      const statsRes = await api.get('/stats');
      // Filter sessions to only show those belonging to the rep's assigned class
      setSessions((statsRes.data.recentSessions || []).filter(s => s.classId === assignedClass?.id));

      // Fetch courses SCOPED to assigned class
      if (assignedClass?.id) {
        // Backend scopes this to the rep's assigned class via JWT
        const courseRes = await api.get(`/courses`);
        const classCourses = courseRes.data || [];
        setCourses(classCourses);
        if (classCourses.length > 0) {
          setSelectedCourseId(classCourses[0].id);
        }

        // Just use the pre-calculated count from login
        setClassStudentCount(assignedClass.studentCount ?? 0);
      } else {
        // No class assigned — nothing to load
        setCourses([]);
        setClassStudentCount(0);
      }
    } catch (err) {
      console.error('Fetch dashboard data error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to load data. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!assignedClass?.id) return;

    setStudentsLoading(true);
    try {
      const response = await api.get('/admin/rep/my-class-students');
      setStudents(response.data || []);
    } catch (err) {
      console.error('Fetch students error:', err);
      toast.error('Failed to load students list');
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    auth.logout();
    navigate('/');
  };

  const getGPSLocation = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGpsLoading(false);
      },
      (error) => {
        console.error('GPS error:', error);
        toast.error(`Error getting location: ${error.message}`, 'GPS Error');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedCourseId) {
      toast.warning('Please select a course first.', 'No Course Selected');
      return;
    }
    const endTime = new Date(Date.now() + parseInt(durationMinutes) * 60 * 1000).toISOString();
    try {
      const response = await api.post('/sessions', {
        courseId: selectedCourseId,
        sessionType,
        endTime,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        networkSSID: networkSSID || null,
      });
      setShowSessionModal(false);
      navigate(`/rep/session/${response.data.id}`);
    } catch (err) {
      console.error('Create session error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to create session');
    }
  };

  const handleRepSelfCheckIn = async (sessionId) => {
    try {
      const response = await api.post('/attendance/rep-self-checkin', { sessionId });
      toast.success(response.data.message || 'Successfully checked in!');
      // Refresh sessions to update UI
      fetchData();
    } catch (err) {
      console.error('Rep self check-in error:', err);
      toast.error(err.response?.data?.error || 'Failed to check in');
    }
  };

  const [generatingReportId, setGeneratingReportId] = useState(null);
  const handleGenerateReport = async (courseId) => {
    setGeneratingReportId(courseId);
    try {
      await api.post('/reports/generate', { courseId });
      toast.success('Official report generated and sent to lecturers for signature!', 'Report Generated');
    } catch (err) {
      console.error('Generate report error:', err);
      toast.error(err.response?.data?.error || 'Failed to generate report', 'Generation Failed');
    } finally {
      setGeneratingReportId(null);
    }
  };

  const handleOpenAnalytics = async (courseId) => {
    setAnalyticsLoading(true);
    setAnalyticsSearch('');
    setShowAnalyticsModal(true);
    try {
      const response = await api.get(`/courses/${courseId}/analytics`);
      setAnalyticsData(response.data);
    } catch (err) {
      console.error('Fetch analytics error:', err);
      toast.error('Failed to load course analytics.');
      setShowAnalyticsModal(false);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleSendWarnings = (courseId) => {
    setConfirmState({
      open: true,
      message: 'Broadcast warning notifications to all students with attendance below 75%?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        setBroadcasting(true);
        try {
          const response = await api.post(`/courses/${courseId}/warn-at-risk`);
          toast.success(`Warnings sent to ${response.data.warningsSent} at-risk students.`, 'Broadcast Sent!');
          const refreshRes = await api.get(`/courses/${courseId}/analytics`);
          setAnalyticsData(refreshRes.data);
        } catch (err) {
          console.error('Broadcast warnings error:', err);
          toast.error(err.response?.data?.error || 'Failed to send warnings.');
        } finally {
          setBroadcasting(false);
        }
      }
    });
  };

  // Setup checks
  const hasNoCourses = courses.length === 0;
  const hasNoStudents = classStudentCount === 0;
  const isSetupIncomplete = hasNoCourses || hasNoStudents;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      id: 'courses',
      label: 'Courses',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      id: 'students',
      label: 'Students',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'excused',
      label: 'Attendance',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex relative">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={`fixed top-0 left-0 h-screen w-[240px] bg-white z-40 flex flex-col
          shadow-[1px_0_0_0_rgba(0,0,0,.06)]
          transition-transform duration-300
          md:sticky md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo + name */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-[#f0f2f5] flex items-center justify-center shrink-0">
            <img src={displayDeptLogo} alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#344767] truncate leading-tight">{displayDeptName}</p>
            <p className="text-[10px] text-[#8392ab] font-medium uppercase tracking-wider">Rep Portal</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto md:hidden p-1 rounded-lg text-[#8392ab] hover:text-[#344767] hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Class info pill */}
        {assignedClass && (
          <div className="mx-4 mt-4 px-3 py-2.5 rounded-xl bg-[#f8f9fa] border border-gray-100">
            <p className="text-[9px] font-bold text-[#8392ab] uppercase tracking-wider mb-1">My Class</p>
            <p className="text-[12px] font-bold text-[#344767] truncate">{assignedClass.displayName}</p>
            <div className="flex gap-3 mt-1.5">
              <span className="text-[10px] text-[#E5A93C] font-semibold">{classStudentCount} students</span>
              <span className="text-[10px] text-[#8392ab]">•</span>
              <span className="text-[10px] text-[#E5A93C] font-semibold">{courses.length} courses</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all
                ${activeTab === item.id
                  ? 'bg-gradient-to-r from-[#0c2340] to-[#1a3c6d] text-white shadow-md'
                  : 'text-[#67748e] hover:bg-[#f8f9fa] hover:text-[#344767]'
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E5A93C] to-[#C59B27] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              {(username || 'R')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-[#344767] truncate">{username}</p>
              <p className="text-[10px] text-[#8392ab] uppercase tracking-wider">{role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-[#8392ab] hover:text-rose-500 hover:bg-rose-50 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top header */}
        <header className="bg-white sticky top-0 z-20 px-5 py-3.5 flex items-center justify-between border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg text-[#8392ab] hover:text-[#344767]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-[15px] font-bold text-[#344767] leading-tight">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'courses' && 'Class Courses'}
                {activeTab === 'students' && 'Class Students'}
                {activeTab === 'excused' && 'Excused Absences'}
              </h1>
              {assignedClass && (
                <p className="text-[11px] text-[#8392ab]">{assignedClass.displayName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationPanel />
            <span className="hidden sm:inline text-[11px] bg-[#f8f9fa] border border-gray-200 text-[#67748e] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider">
              {role}
            </span>
          </div>
        </header>

        {/* Page body */}
        <div className="flex-1 p-5 md:p-6 space-y-5 max-w-5xl w-full mx-auto pb-24 md:pb-6">

          {/* Error */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm">
              {errorMsg}
            </div>
          )}

          {/* Setup warning */}
          {!loading && assignedClass && isSetupIncomplete && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-fade-in">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-[13px] font-bold text-amber-700">Class setup incomplete</p>
                <ul className="text-[12px] text-amber-600 mt-1 space-y-0.5">
                  {hasNoCourses && <li>• No courses have been linked to your class yet</li>}
                  {hasNoStudents && <li>• No student list has been uploaded for your class yet</li>}
                </ul>
              </div>
            </div>
          )}

          {/* No class assigned */}
          {!loading && !assignedClass && (
            <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,.08)]">
              <svg className="w-10 h-10 text-[#8392ab] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              <p className="text-[14px] font-bold text-[#344767]">No Class Assigned</p>
              <p className="text-[12px] text-[#8392ab] mt-1">Contact your administrator.</p>
            </div>
          )}

          {/* ── TAB: DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card-teal animate-fade-in-up">
                  <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Total Students</p>
                  <p className="text-3xl font-extrabold mt-1">{classStudentCount}</p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,.08)] animate-fade-in-up delay-100">
                  <p className="text-[11px] font-semibold text-[#8392ab] uppercase tracking-wider">Active Courses</p>
                  <p className="text-3xl font-extrabold text-[#344767] mt-1">{courses.length}</p>
                   <div className="mt-2 w-8 h-1 rounded-full bg-[#E5A93C]" />
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,.08)] animate-fade-in-up delay-200">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold text-[#8392ab] uppercase tracking-wider">Live Sessions</p>
                    {sessions.filter(s => s.status === 'OPEN').length > 0 && (
                      <span className="pulse-dot" />
                    )}
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-500 mt-1">
                    {sessions.filter(s => s.status === 'OPEN').length}
                  </p>
                  <div className="mt-2 w-8 h-1 rounded-full bg-emerald-400" />
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,.08)] animate-fade-in-up delay-300">
                  <p className="text-[11px] font-semibold text-[#8392ab] uppercase tracking-wider">Total Sessions</p>
                  <p className="text-3xl font-extrabold text-[#E5A93C] mt-1">{sessions.length}</p>
                  <div className="mt-2 w-8 h-1 rounded-full bg-[#E5A93C]" />
                </div>
              </div>

              {/* Action bar */}
              <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap gap-3 items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,.08)] animate-fade-in-up delay-200">
                <div>
                  <p className="text-[13px] font-bold text-[#344767]">Attendance Operations</p>
                  <p className="text-[11px] text-[#8392ab] mt-0.5">Open a session for your class to begin taking attendance.</p>
                </div>
                <button
                  onClick={() => {
                    if (!assignedClass) { toast.warning('You are not assigned to a class yet.'); return; }
                    if (hasNoCourses) { toast.warning('No courses have been added to your class. Contact your administrator.'); return; }
                    setShowSessionModal(true);
                  }}
                  disabled={!assignedClass || hasNoCourses}
                  className="sip-btn-dark flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Open New Session
                </button>
              </div>

              {/* Sessions list */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.08)] overflow-hidden animate-fade-in-up delay-300">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <p className="text-[12px] font-bold text-[#8392ab] uppercase tracking-wider">Recent Sessions</p>
                  <button
                    onClick={fetchData}
                    className="text-[11px] text-[#E5A93C] hover:text-[#b5821c] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                    </svg>
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton h-16 rounded-xl" />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[13px] font-semibold text-[#8392ab]">No sessions yet</p>
                    <p className="text-[11px] text-[#8392ab] mt-1">Click "Open New Session" to start.</p>
                  </div>
                ) : (
                  <table className="sip-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th className="hidden sm:table-cell">Date</th>
                        <th className="hidden md:table-cell">Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <p className="font-semibold text-[#344767] text-[13px]">{s.courseName}</p>
                            <p className="text-[11px] text-[#8392ab] font-mono">{s.courseCode}</p>
                          </td>
                          <td className="hidden sm:table-cell text-[12px] text-[#8392ab]">
                            {new Date(s.startTime).toLocaleDateString()}
                            <span className="block text-[11px]">{new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="hidden md:table-cell">
                            <span className="badge badge-info">{s.sessionType}</span>
                          </td>
                          <td>
                            <span className={`badge ${s.status === 'OPEN' ? 'badge-success' : 'badge-dark'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {s.status === 'OPEN' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRepSelfCheckIn(s.id); }}
                                  className="text-[11px] text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                                >
                                  Check In
                                </button>
                              )}
                              <button
                                onClick={() => navigate(`/rep/session/${s.id}`)}
                                className="text-[11px] text-[#E5A93C] hover:text-[#b5821c] transition-colors"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: COURSES ── */}
          {activeTab === 'courses' && (
            <div className="space-y-5 animate-slide-left">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#344767]">Class Courses</p>
                <span className="badge badge-info">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
                </div>
              ) : courses.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,.08)]">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 5s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-[13px] font-semibold text-[#8392ab]">No courses assigned yet</p>
                  <p className="text-[11px] text-[#8392ab] mt-1 max-w-xs mx-auto">Your administrator needs to link courses to your class.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((c, idx) => (
                    <div
                      key={c.id}
                      className={`bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,.08)] hover-lift animate-fade-in-up`}
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="badge badge-info font-mono">{c.code}</span>
                        {c.level && <span className="badge badge-dark">{c.level}</span>}
                      </div>
                      <p className="text-[14px] font-bold text-[#344767] leading-snug">{c.name}</p>
                      {c.type && <p className="text-[11px] text-[#8392ab] mt-1">{c.type}</p>}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleGenerateReport(c.id)}
                          disabled={generatingReportId === c.id}
                          className="sip-btn-primary flex-1 text-[11px] py-2 px-3 disabled:opacity-50"
                        >
                          {generatingReportId === c.id ? 'Generating...' : 'Generate Report'}
                        </button>
                        <button
                          onClick={() => handleOpenAnalytics(c.id)}
                          className="sip-btn-dark flex-1 text-[11px] py-2 px-3"
                        >
                          Analytics
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: STUDENTS ── */}
          {activeTab === 'students' && (
            <div className="space-y-5 animate-slide-left">
              <div className="bg-white rounded-2xl px-5 py-4 flex flex-wrap gap-3 items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,.08)]">
                <div>
                  <p className="text-[13px] font-bold text-[#344767]">Class Students</p>
                  <p className="text-[11px] text-[#8392ab]">All enrolled students in your class</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search name or index..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="sip-input w-52 text-[12px] py-2"
                  />
                  <span className="badge badge-dark">{students.length}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.08)] overflow-hidden">
                {studentsLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
                  </div>
                ) : students.length === 0 ? (
                  <div className="flex flex-col items-center py-14">
                    <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-[13px] font-semibold text-[#8392ab]">No students enrolled yet</p>
                  </div>
                ) : (
                  <>
                    <table className="sip-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Index Number</th>
                          <th>Name</th>
                          <th className="hidden md:table-cell">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students
                          .filter(student =>
                            student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                            student.indexNumber.includes(studentSearch)
                          )
                          .map((student, index) => (
                            <tr key={student.id}>
                              <td className="text-[#8392ab] text-[12px]">{index + 1}</td>
                              <td><span className="font-mono text-[12px] font-bold text-[#344767]">{student.indexNumber}</span></td>
                              <td><span className="text-[13px] font-semibold text-[#344767]">{student.name}</span></td>
                              <td className="hidden md:table-cell text-[12px] text-[#8392ab]">{student.email || 'N/A'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {students.filter(student =>
                      student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                      student.indexNumber.includes(studentSearch)
                    ).length === 0 && (
                      <div className="py-8 text-center text-[12px] text-[#8392ab]">No students match your search.</div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: EXCUSED ABSENCES ── */}
          {activeTab === 'excused' && (
            <div className="animate-slide-left">
              <ExcusedAbsencesManager />
            </div>
          )}
        </div>
      </main>

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex md:hidden shadow-[0_-1px_4px_rgba(0,0,0,.07)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors
              ${activeTab === item.id ? 'text-[#E5A93C]' : 'text-[#8392ab]'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* ─── SESSION CREATION MODAL ─── */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <div className="mb-5">
              <h3 className="text-[16px] font-bold text-[#344767]">Open New Attendance Session</h3>
              {assignedClass && (
                <p className="text-[11px] text-[#8392ab] mt-1">{assignedClass.displayName}</p>
              )}
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-[12px]">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#344767] mb-1.5">Select Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="sip-input w-full"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#344767] mb-1.5">Session Type</label>
                <div className="flex gap-4">
                  {['PHYSICAL', 'ONLINE'].map(type => (
                    <label key={type} className="flex items-center gap-2 text-[13px] text-[#344767] cursor-pointer">
                      <input
                        type="radio"
                        name="sessionType"
                        checked={sessionType === type}
                        onChange={() => setSessionType(type)}
                        className="accent-[#E5A93C]"
                      />
                      {type === 'PHYSICAL' ? 'Physical' : 'Online'}
                    </label>
                  ))}
                </div>
              </div>

              {sessionType === 'PHYSICAL' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#8392ab] font-semibold mb-1">Latitude</label>
                      <input type="number" step="0.000001" placeholder="5.6037" value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className="sip-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#8392ab] font-semibold mb-1">Longitude</label>
                      <input type="number" step="0.000001" placeholder="-0.1870" value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className="sip-input w-full"
                      />
                    </div>
                  </div>
                  <button type="button" onClick={getGPSLocation}
                    className="w-full py-2 bg-[#f8f9fa] hover:bg-gray-100 text-[#344767] font-semibold rounded-xl border border-gray-200 text-[12px] transition-all flex items-center justify-center gap-2"
                  >
                    {gpsLoading ? (
                      <div className="w-4 h-4 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-[#E5A93C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Get Current GPS Location
                      </>
                    )}
                  </button>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#344767] mb-1">Wi-Fi SSID (Optional)</label>
                    <input type="text" placeholder="e.g. LectureHall_A" value={networkSSID}
                      onChange={(e) => setNetworkSSID(e.target.value)}
                      className="sip-input w-full"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#344767] mb-1.5">Duration</label>
                <select value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
                  className="sip-input w-full"
                >
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="120">2 Hours</option>
                  <option value="180">3 Hours</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSessionModal(false)}
                  className="flex-1 py-2.5 bg-[#f8f9fa] hover:bg-gray-100 text-[#344767] font-semibold rounded-xl border border-gray-200 transition-all text-[13px]"
                >
                  Cancel
                </button>
                <button type="submit" className="sip-btn-dark flex-1 py-2.5">
                  Create & Open
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ANALYTICS MODAL ─── */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[88vh] flex flex-col animate-scale-in">
            <div className="flex justify-between items-start pb-4 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#344767]">Course Attendance Analytics</h3>
                {analyticsData && (
                  <p className="text-[11px] text-[#8392ab] font-mono mt-0.5">{analyticsData.course.name} ({analyticsData.course.code})</p>
                )}
              </div>
              <button
                onClick={() => { setShowAnalyticsModal(false); setAnalyticsData(null); }}
                className="p-1.5 rounded-lg text-[#8392ab] hover:text-[#344767] hover:bg-gray-100 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {analyticsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px] text-[#8392ab]">Loading attendance metrics…</span>
              </div>
            ) : analyticsData ? (
              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#f8f9fa] rounded-xl p-4 text-center">
                    <span className="block text-2xl font-bold text-[#344767] font-mono">{analyticsData.totalSessionsCount}</span>
                    <span className="text-[10px] text-[#8392ab] font-semibold uppercase">Concluded</span>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-xl p-4 text-center">
                    <span className="block text-2xl font-bold text-rose-500 font-mono">
                      {analyticsData.analytics.filter(s => s.isAtRisk).length}
                    </span>
                    <span className="text-[10px] text-rose-400 font-semibold uppercase">At-Risk (&lt;75%)</span>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-xl p-4 flex items-center justify-center">
                    <button
                      onClick={() => handleSendWarnings(analyticsData.course.id)}
                      disabled={broadcasting || analyticsData.totalSessionsCount === 0}
                      className="w-full py-2 px-3 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {broadcasting
                        ? <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.003 6.003 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                      }
                      Broadcast Warnings
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Search by student name or index number..."
                  value={analyticsSearch}
                  onChange={(e) => setAnalyticsSearch(e.target.value)}
                  className="sip-input w-full"
                />

                <table className="sip-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Lectures</th>
                      <th>Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.analytics
                      .filter(s =>
                        s.name.toLowerCase().includes(analyticsSearch.toLowerCase()) ||
                        s.indexNumber.includes(analyticsSearch)
                      )
                      .map((student) => {
                        const rate = student.attendanceRate ?? 0;
                        const barColor = rate >= 75 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-rose-500';
                        const badgeClass = rate >= 75 ? 'badge-success' : rate >= 60 ? 'badge-warning' : 'badge-danger';
                        return (
                          <tr key={student.id}>
                            <td>
                              <p className="font-semibold text-[#344767] text-[13px]">{student.name}</p>
                              <p className="text-[10px] text-[#8392ab] font-mono">{student.indexNumber}</p>
                            </td>
                            <td className="text-[12px] text-[#344767] font-mono">{student.presentCount} / {student.totalConcluded}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                  <div className={`h-full ${barColor}`} style={{ width: `${rate}%` }} />
                                </div>
                                <span className="text-[12px] font-bold font-mono text-[#344767]">{rate}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${badgeClass}`}>
                                {rate >= 75 ? 'SAFE' : rate >= 60 ? 'WARNING' : 'AT RISK'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-[12px] text-[#8392ab]">No analytics data available.</div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmState.open && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState({ open: false, message: '', onConfirm: null })}
        />
      )}
    </div>
  );
};

export default RepDashboard;
