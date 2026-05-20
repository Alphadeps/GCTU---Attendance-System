import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NotificationPanel from '../components/NotificationPanel';

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

  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const username = localStorage.getItem('username');
  const deptName = localStorage.getItem('dept_name') || 'Class Attendance System';
  const deptLogo = localStorage.getItem('dept_logo') || '/logo.jfif';

  // Parse assigned class
  const assignedClassStr = localStorage.getItem('assignedClass');
  let assignedClass = null;
  try {
    assignedClass = assignedClassStr ? JSON.parse(assignedClassStr) : null;
  } catch (e) {
    console.error(e);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Always fetch recent sessions
      const statsRes = await api.get('/stats');
      setSessions(statsRes.data.recentSessions || []);

      // Fetch courses SCOPED to assigned class
      if (assignedClass?.id) {
        const courseRes = await api.get(`/admin/classes/${assignedClass.id}/courses`);
        const classCourses = courseRes.data || [];
        setCourses(classCourses);
        if (classCourses.length > 0) {
          setSelectedCourseId(classCourses[0].id);
        }

        // Also refresh student count from API (in case it changed after login)
        try {
          const studentsRes = await api.get(`/admin/classes/${assignedClass.id}/students`);
          setClassStudentCount(Array.isArray(studentsRes.data) ? studentsRes.data.length : 0);
        } catch {
          // fallback to localStorage count
          setClassStudentCount(assignedClass.studentCount ?? 0);
        }
      } else {
        // No class assigned — nothing to load
        setCourses([]);
        setClassStudentCount(0);
      }
    } catch (err) {
      console.error('Fetch dashboard data error:', err);
      setErrorMsg('Failed to load data. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.clear();
    navigate('/');
  };

  const getGPSLocation = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
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
        alert(`Error getting location: ${error.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedCourseId) {
      alert('Please select a course first');
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
      alert(err.response?.data?.error || 'Failed to create session');
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
      alert('Failed to load course analytics.');
      setShowAnalyticsModal(false);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleSendWarnings = async (courseId) => {
    if (!window.confirm('Broadcast warning notifications to all students with attendance below 75%?')) return;
    setBroadcasting(true);
    try {
      const response = await api.post(`/courses/${courseId}/warn-at-risk`);
      alert(`Broadcast successful! Warnings sent to ${response.data.warningsSent} at-risk students.`);
      const refreshRes = await api.get(`/courses/${courseId}/analytics`);
      setAnalyticsData(refreshRes.data);
    } catch (err) {
      console.error('Broadcast warnings error:', err);
      alert(err.response?.data?.error || 'Failed to send warnings.');
    } finally {
      setBroadcasting(false);
    }
  };

  // Setup checks
  const hasNoCourses = courses.length === 0;
  const hasNoStudents = classStudentCount === 0;
  const isSetupIncomplete = hasNoCourses || hasNoStudents;

  return (
    <div className="min-h-screen bg-[#00122c] text-slate-100 flex relative overflow-hidden">
      {/* Mesh gradients */}
      <div className="absolute top-[-30%] right-[-10%] w-[70%] h-[70%] rounded-full bg-[#D4A017]/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-30%] left-[-10%] w-[70%] h-[70%] rounded-full bg-[#003B8E]/10 blur-[150px] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <img src="/logo.jfif" alt="" className="w-[450px] h-[450px] object-contain filter grayscale" />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#001c44]/95 border-r border-[#002a63] z-40 transition-transform duration-300 md:translate-x-0 flex flex-col justify-between ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 space-y-8 flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <img src={deptLogo} alt="Logo" className="w-10 h-10 object-contain bg-[#000a18]/40 rounded-xl p-1 border border-[#002a63]" />
            <div className="truncate">
              <h2 className="text-sm font-bold text-white truncate">{deptName}</h2>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Class Representative</span>
            </div>
          </div>

          {/* Class Info card */}
          {assignedClass ? (
            <div className="bg-[#000a18]/50 border border-[#002a63] rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">My Class</p>
              <p className="text-xs font-bold text-[#D4A017] leading-snug">{assignedClass.displayName}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="text-center">
                  <span className={`block text-lg font-black font-mono ${hasNoStudents ? 'text-rose-400' : 'text-white'}`}>
                    {classStudentCount}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Students</span>
                </div>
                <div className="text-center">
                  <span className={`block text-lg font-black font-mono ${hasNoCourses ? 'text-rose-400' : 'text-white'}`}>
                    {courses.length}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Courses</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
              <p className="text-xs text-rose-400 font-semibold">No class assigned yet.</p>
              <p className="text-[10px] text-slate-500 mt-1">Contact your administrator to assign you to a class.</p>
            </div>
          )}

          {/* Navigation */}
          <nav className="space-y-1.5 flex-1">
            {[
              { id: 'dashboard', label: 'Dashboard & Sessions', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z' },
              { id: 'courses', label: 'My Class Courses', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === item.id
                    ? 'bg-[#003B8E] text-[#D4A017] border-l-4 border-[#D4A017] shadow-lg shadow-[#003B8E]/20'
                    : 'text-slate-300 hover:bg-[#002a63]/40 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className="p-6 border-t border-[#002a63] bg-[#001432]/60">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{username}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase font-mono">{role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
              title="Sign Out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen relative z-10 overflow-y-auto">
        {/* Top Header */}
        <header className="bg-[#001c44]/65 backdrop-blur-md border-b border-[#002a63] px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg md:hidden"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                {activeTab === 'dashboard' && 'Dashboard & Sessions'}
                {activeTab === 'courses' && 'My Class Courses'}
              </h1>
              {assignedClass && (
                <span className="text-xs text-[#D4A017] font-bold">{assignedClass.displayName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationPanel />
            <span className="text-xs bg-[#D4A017]/10 text-[#D4A017] px-3 py-1.5 rounded-full font-semibold border border-[#D4A017]/20 uppercase tracking-wider">
              {role} Account
            </span>
          </div>
        </header>

        {/* Body */}
        <div className="p-6 flex-1 space-y-6 max-w-6xl w-full mx-auto">
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm">
              {errorMsg}
            </div>
          )}

          {/* Setup Warning Banner */}
          {!loading && assignedClass && isSetupIncomplete && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-4 items-start">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-amber-400 font-bold text-sm">Class setup incomplete</p>
                <ul className="text-xs text-slate-400 mt-1 space-y-0.5">
                  {hasNoCourses && <li>• No courses have been linked to your class yet</li>}
                  {hasNoStudents && <li>• No student list has been uploaded for your class yet</li>}
                </ul>
                <p className="text-xs text-slate-500 mt-1.5">Contact your administrator to complete the setup before you can open sessions.</p>
              </div>
            </div>
          )}

          {/* No class assigned warning */}
          {!loading && !assignedClass && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-rose-400/40 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              <h3 className="text-sm font-bold text-slate-300">No Class Assigned</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">You are not assigned to any class yet. Please contact your administrator.</p>
            </div>
          )}

          {/* TAB 1: DASHBOARD & SESSIONS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-[#001c44]/55 border border-[#002a63] p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Sessions</p>
                    <p className="text-3xl font-extrabold text-white mt-1.5">{sessions.length}</p>
                  </div>
                  <div className="p-3 bg-[#003B8E]/30 rounded-xl border border-[#002a63]">
                    <svg className="w-6 h-6 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="bg-[#001c44]/55 border border-[#002a63] p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Sessions</p>
                    <p className="text-3xl font-extrabold text-white mt-1.5">{sessions.filter(s => s.status === 'OPEN').length}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <svg className="w-6 h-6 text-emerald-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.828a5 5 0 117.07 0M12 11a1 1 0 100-2 1 1 0 000 2z" />
                    </svg>
                  </div>
                </div>
                <div className="bg-[#001c44]/55 border border-[#002a63] p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Class Courses</p>
                    <p className={`text-3xl font-extrabold mt-1.5 ${hasNoCourses ? 'text-rose-400' : 'text-white'}`}>{courses.length}</p>
                  </div>
                  <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Action ribbon */}
              <div className="bg-[#001c44]/55 border border-[#002a63] p-5 rounded-2xl flex flex-wrap gap-4 items-center justify-between shadow-xl">
                <div>
                  <h3 className="font-bold text-white text-sm">Attendance Operations</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Start a new session for your class.</p>
                </div>
                <button
                  onClick={() => {
                    if (!assignedClass) { alert('You are not assigned to a class yet.'); return; }
                    if (hasNoCourses) { alert('No courses have been added to your class. Contact your administrator.'); return; }
                    setShowSessionModal(true);
                  }}
                  disabled={!assignedClass || hasNoCourses}
                  className="bg-[#D4A017] hover:bg-[#b88a14] disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-md shadow-[#D4A017]/10"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Open New Session
                </button>
              </div>

              {/* Recent Sessions */}
              <div className="bg-[#001c44]/55 border border-[#002a63] p-6 rounded-2xl shadow-xl min-h-[300px]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Recent Sessions</h2>
                  <button onClick={fetchData} className="text-xs text-slate-500 hover:text-[#D4A017] transition-colors flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                    </svg>
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 bg-[#000a18]/10 rounded-xl border border-dashed border-[#002a63] text-sm">
                    No sessions yet. Click "Open New Session" to start.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => navigate(`/rep/session/${s.id}`)}
                        className="p-4 bg-[#000a18]/30 hover:bg-[#000a18]/70 border border-[#002a63]/80 hover:border-[#003b8e] rounded-xl transition-all cursor-pointer flex justify-between items-center group"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-200 text-sm group-hover:text-[#D4A017] transition-colors">{s.courseName}</span>
                            <span className="font-mono text-xs text-slate-500">({s.courseCode})</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                            <span>{new Date(s.startTime).toLocaleDateString()} {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">{s.sessionType}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            s.status === 'OPEN' ? 'bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/20 animate-pulse' :
                            s.status === 'CLOSED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {s.status}
                          </span>
                          <svg className="w-4 h-4 text-slate-500 group-hover:text-[#D4A017] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MY CLASS COURSES */}
          {activeTab === 'courses' && (
            <div className="space-y-6">
              <div className="bg-[#001c44]/55 border border-[#002a63] p-5 rounded-2xl flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-sm">Class Courses</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Courses assigned to your class by the administrator.</p>
                </div>
                <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full">
                  {courses.length} course{courses.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="bg-[#001c44]/55 border border-[#002a63] p-6 rounded-2xl shadow-xl">
                {loading ? (
                  <div className="flex justify-center items-center py-16">
                    <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <svg className="w-12 h-12 text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-sm font-bold text-slate-400">No courses assigned yet</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">Your administrator needs to link courses to your class before you can run sessions.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courses.map((c) => (
                      <div key={c.id} className="p-4 bg-[#000a18]/40 rounded-xl border border-[#002a63]/80 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-200 text-sm">{c.name}</p>
                          <p className="font-mono text-xs text-slate-500 mt-1">{c.code}</p>
                        </div>
                        <button
                          onClick={() => handleOpenAnalytics(c.id)}
                          className="bg-[#D4A017]/10 hover:bg-[#D4A017] hover:text-slate-950 text-[#D4A017] font-bold py-1.5 px-3 rounded-lg border border-[#D4A017]/20 transition-all text-[11px]"
                        >
                          📊 Analytics
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* SESSION CREATION MODAL */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-[#000a18]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#001c44] border border-[#002a63] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Open New Attendance Session</h3>
            {assignedClass && (
              <p className="text-xs text-[#D4A017] font-semibold mb-4">{assignedClass.displayName}</p>
            )}
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Select Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-[#000a18] border border-[#002a63] rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-[#D4A017]"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Session Type</label>
                <div className="flex gap-4">
                  {['PHYSICAL', 'ONLINE'].map(type => (
                    <label key={type} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="sessionType"
                        checked={sessionType === type}
                        onChange={() => setSessionType(type)}
                        className="accent-[#D4A017]"
                      />
                      {type === 'PHYSICAL' ? 'Physical Class' : 'Online Class'}
                    </label>
                  ))}
                </div>
              </div>

              {sessionType === 'PHYSICAL' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs font-semibold mb-1">Latitude</label>
                      <input type="number" step="0.000001" placeholder="5.6037" value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className="w-full bg-[#000a18] border border-[#002a63] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-[#D4A017]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs font-semibold mb-1">Longitude</label>
                      <input type="number" step="0.000001" placeholder="-0.1870" value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className="w-full bg-[#000a18] border border-[#002a63] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-[#D4A017]"
                      />
                    </div>
                  </div>
                  <button type="button" onClick={getGPSLocation}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-[#D4A017] font-semibold rounded-lg border border-slate-700 text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {gpsLoading ? (
                      <div className="w-4 h-4 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Get Current GPS Location
                      </>
                    )}
                  </button>
                  <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-1">Network Wi-Fi SSID (Optional)</label>
                    <input type="text" placeholder="e.g. LectureHall_A" value={networkSSID}
                      onChange={(e) => setNetworkSSID(e.target.value)}
                      className="w-full bg-[#000a18] border border-[#002a63] rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-[#D4A017]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Duration</label>
                <select value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full bg-[#000a18] border border-[#002a63] rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-[#D4A017]"
                >
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="120">2 Hours</option>
                  <option value="180">3 Hours</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowSessionModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-all text-sm"
                >
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-[#D4A017] hover:bg-[#b88a14] text-slate-950 font-bold rounded-xl transition-all text-sm"
                >
                  Create & Open
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COURSE ANALYTICS MODAL */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 bg-[#000a18]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#001c44] border border-[#002a63] rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start pb-4 border-b border-[#002a63]/40">
              <div>
                <h3 className="text-lg font-bold text-white">Course Attendance Analytics</h3>
                {analyticsData && (
                  <p className="text-xs text-[#D4A017] font-mono mt-0.5">{analyticsData.course.name} ({analyticsData.course.code})</p>
                )}
              </div>
              <button onClick={() => { setShowAnalyticsModal(false); setAnalyticsData(null); }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {analyticsLoading ? (
              <div className="flex-1 flex flex-col justify-center items-center py-20">
                <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs text-slate-400">Loading student attendance metrics...</span>
              </div>
            ) : analyticsData ? (
              <div className="flex-1 overflow-y-auto space-y-6 pt-4 pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#000a18]/30 border border-[#002a63]/60 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-bold text-white font-mono">{analyticsData.totalSessionsCount}</span>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Concluded Lectures</span>
                  </div>
                  <div className="bg-[#000a18]/30 border border-[#002a63]/60 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-bold text-rose-400 font-mono">
                      {analyticsData.analytics.filter(s => s.isAtRisk).length}
                    </span>
                    <span className="text-[10px] text-rose-400/80 font-semibold uppercase tracking-wider">At-Risk (&lt;75%)</span>
                  </div>
                  <div className="bg-[#000a18]/30 border border-[#002a63]/60 p-4 rounded-xl flex items-center justify-center">
                    <button
                      onClick={() => handleSendWarnings(analyticsData.course.id)}
                      disabled={broadcasting || analyticsData.totalSessionsCount === 0}
                      className="w-full bg-rose-500/10 hover:bg-rose-500/20 disabled:bg-[#000a18]/10 text-rose-400 disabled:text-slate-500 border border-rose-500/20 disabled:border-transparent py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {broadcasting ? (
                        <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.003 6.003 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      )}
                      Broadcast Warnings
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Search by student name or index number..."
                  value={analyticsSearch}
                  onChange={(e) => setAnalyticsSearch(e.target.value)}
                  className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-2.5 text-slate-200 text-xs focus:outline-none focus:border-[#D4A017]"
                />

                <div className="border border-[#002a63]/40 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#001c44] text-[10px] font-extrabold uppercase text-slate-400 border-b border-[#002a63]">
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Lectures</th>
                        <th className="p-3">Attendance Rate</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#002a63]/20">
                      {analyticsData.analytics
                        .filter(s =>
                          s.name.toLowerCase().includes(analyticsSearch.toLowerCase()) ||
                          s.indexNumber.includes(analyticsSearch)
                        )
                        .map((student) => {
                          const rate = student.attendanceRate;
                          const barColor = rate >= 75 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-500' : 'bg-rose-500';
                          const textColor = rate >= 75 ? 'text-emerald-400' : rate >= 60 ? 'text-amber-400' : 'text-rose-400';
                          const badgeBg = rate >= 75 ? 'bg-emerald-500/10 border-emerald-500/20' : rate >= 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';
                          return (
                            <tr key={student.id} className="hover:bg-[#002a63]/10 text-xs transition-colors">
                              <td className="p-3">
                                <div className="font-bold text-white">{student.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{student.indexNumber}</div>
                              </td>
                              <td className="p-3 text-slate-300 font-mono">{student.presentCount} / {student.totalConcluded}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full ${barColor}`} style={{ width: `${rate}%` }} />
                                  </div>
                                  <span className={`font-bold font-mono ${textColor}`}>{rate}%</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <span className={`inline-block px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${badgeBg} ${textColor}`}>
                                  {rate >= 75 ? 'SAFE' : rate >= 60 ? 'WARNING' : 'AT RISK'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 text-xs">No analytics data available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RepDashboard;
