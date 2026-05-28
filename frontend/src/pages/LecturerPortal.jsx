import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AttendanceTable from '../components/AttendanceTable';
import SignatureCanvas from '../components/SignatureCanvas';
import NotificationPanel from '../components/NotificationPanel';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../context/AuthContext';

const LecturerPortal = () => {
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' or 'reports'

  const [sessions, setSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Session States
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Selected Report States
  const [selectedReport, setSelectedReport] = useState(null);

  // Signature & Approval states
  const [signature, setSignature] = useState('');
  const [approving, setApproving] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const { username, deptName, deptLogo } = auth;

  // Use defaults if not set
  const displayUsername = username || 'Lecturer';
  const displayDeptName = deptName || 'Class Attendance System';
  const displayDeptLogo = deptLogo || '/logo.svg';

  const fetchMyClasses = async () => {
    setLoadingClasses(true);
    try {
      const res = await api.get('/lecturer/my-classes');
      setAssignedClasses(res.data || []);
    } catch (err) {
      console.error('Fetch my classes error:', err);
      toast.error('Failed to load your class assignments');
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchPendingData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (activeTab === 'sessions') {
        setSessions([]); // Clear stale data before fetching
        // TODO: replace with /lecturer/pending-sessions when endpoint is available
        // Currently using /stats and filtering for status === 'CLOSED'
        const statsRes = await api.get('/stats');
        const allRecent = statsRes.data.recentSessions || [];
        const closed = allRecent.filter(s => s.status === 'CLOSED');
        setSessions(closed);
      } else {
        setReports([]); // Clear stale data before fetching
        const repRes = await api.get('/reports/pending');
        console.log('📊 Fetched reports:', repRes.data);
        console.log('📊 Number of reports:', repRes.data?.length);
        setReports(repRes.data || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to load pending items. Ensure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyClasses();
  }, []);

  useEffect(() => {
    fetchPendingData();
    setSelectedSession(null);
    setSelectedReport(null);
    setSignature('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Clientside filtering by selected course-class assignment
  const getFilteredSessions = () => {
    if (!selectedClass) return sessions;
    return sessions.filter(s => s.classId === selectedClass.classId && s.courseId === selectedClass.courseId);
  };

  const getFilteredReports = () => {
    console.log('🔍 Filtering reports...');
    console.log('  Total reports:', reports.length);
    console.log('  Selected class:', selectedClass);
    if (!selectedClass) {
      console.log('  ✅ No class selected, returning all reports');
      return reports;
    }
    const filtered = reports.filter(r => {
      const match = r.classId === selectedClass.classId && r.courseId === selectedClass.courseId;
      console.log(`  Report ${r.id}: classId=${r.classId}, courseId=${r.courseId}, match=${match}`);
      return match;
    });
    console.log('  📋 Filtered reports:', filtered.length);
    return filtered;
  };

  const handleSelectSession = async (session) => {
    setSelectedSession(session);
    setLoadingDetails(true);
    setSignature('');
    try {
      const response = await api.get(`/sessions/${session.id}`);
      setAttendances(response.data.attendances || []);
    } catch (err) {
      console.error('Fetch session details error:', err);
      toast.error(err.response?.data?.error || 'Failed to load session details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleApproveSession = async () => {
    if (!signature) {
      toast.warning('Please sign on the canvas before approving.', 'Signature Required');
      return;
    }

    setApproving(true);
    try {
      await api.patch(`/sessions/${selectedSession.id}/approve`, {
        lecturerSignature: signature
      });
      toast.success('Session approved and signed successfully!', 'Done!');
      setSelectedSession(null);
      setAttendances([]);
      setSignature('');
      fetchPendingData();
    } catch (err) {
      console.error('Approve error:', err);
      toast.error(err.response?.data?.error || 'Failed to approve session');
    } finally {
      setApproving(false);
    }
  };

  const handleSelectReport = (report) => {
    setSelectedReport(report);
    setSignature('');
  };

  const handleApproveReport = async () => {
    if (!signature) {
      toast.warning('Please sign on the canvas before approving.', 'Signature Required');
      return;
    }
    setApproving(true);
    try {
      await api.patch(`/reports/${selectedReport.id}/sign`, {
        lecturerSignature: signature
      });
      toast.success('Official Report signed and archived successfully!', 'Archived!');
      setSelectedReport(null);
      setSignature('');
      fetchPendingData();
    } catch (err) {
      console.error('Approve report error:', err);
      toast.error(err.response?.data?.error || 'Failed to approve report');
    } finally {
      setApproving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    auth.logout();
    navigate('/');
  };

  const navItems = [
    {
      id: 'sessions',
      label: 'Pending Sessions',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'classes',
      label: 'My Classes',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex relative">

      {/* Mobile overlay */}
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
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-[#f0f2f5] flex items-center justify-center shrink-0">
            <img src={displayDeptLogo} alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-[#344767] truncate leading-tight">{displayDeptName}</p>
            <p className="text-[10px] text-[#8392ab] font-medium uppercase tracking-wider">Lecturer Portal</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 rounded-lg text-[#8392ab] hover:text-[#344767] hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E5A93C] to-[#b5821c] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              {(displayUsername)[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-[#344767] truncate">{displayUsername}</p>
              <p className="text-[10px] text-[#8392ab] uppercase tracking-wider">Lecturer</p>
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
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-[#8392ab]">Lecturer</span>
              <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-bold text-[#344767]">
                {activeTab === 'sessions' && 'Pending Sessions'}
                {activeTab === 'reports' && 'Official Reports'}
                {activeTab === 'classes' && 'My Classes'}
              </span>
              {(selectedSession || selectedReport) && (
                <>
                  <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-semibold text-[#E5A93C] truncate max-w-[160px]">
                    {selectedSession?.courseName || selectedReport?.course?.name}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationPanel />
            <span className="hidden sm:block text-[11px] text-[#8392ab]">
              Logged in as <span className="font-bold text-[#344767]">{displayUsername}</span>
            </span>
          </div>
        </header>

        <div className="flex-1 p-5 md:p-6 pb-20 md:pb-6">

          {/* Error */}
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-[12px]">
              {errorMsg}
            </div>
          )}

          {/* ── TAB: SESSIONS (pending) ── */}
          {(activeTab === 'sessions' || activeTab === 'reports') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Left: list */}
              <div className="lg:col-span-1 space-y-4 animate-slide-left">

                {/* Class filter chips */}
                <div className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,.08)]">
                  <p className="text-[11px] font-bold text-[#8392ab] uppercase tracking-wider mb-3">
                    Filter by Class
                  </p>
                  {loadingClasses ? (
                    <div className="flex gap-2">
                      <div className="skeleton h-8 w-20 rounded-xl" />
                      <div className="skeleton h-8 w-28 rounded-xl" />
                    </div>
                  ) : assignedClasses.length === 0 ? (
                    <p className="text-[11px] text-[#8392ab]">No classes assigned. Contact the administrator.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedClass(null)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all
                          ${!selectedClass
                            ? 'bg-gradient-to-r from-[#0c2340] to-[#1a3c6d] text-white border-transparent shadow-md'
                            : 'bg-[#f8f9fa] border-gray-200 text-[#67748e] hover:border-[#E5A93C]'
                          }`}
                      >
                        All
                      </button>
                      {assignedClasses.map((ac) => (
                        <button
                          key={ac.assignmentId}
                          onClick={() => setSelectedClass(ac)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all text-left leading-tight
                            ${selectedClass?.assignmentId === ac.assignmentId
                              ? 'bg-gradient-to-r from-[#0c2340] to-[#1a3c6d] text-white border-transparent shadow-md'
                              : 'bg-[#f8f9fa] border-gray-200 text-[#67748e] hover:border-[#E5A93C]'
                            }`}
                        >
                          <span className="font-bold block">{ac.courseCode}</span>
                          <span className={`text-[9px] ${selectedClass?.assignmentId === ac.assignmentId ? 'text-blue-200' : 'text-[#8392ab]'}`}>
                            {ac.classDisplayName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending items list */}
                <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.08)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
                    <p className="text-[12px] font-bold text-[#8392ab] uppercase tracking-wider">
                      Pending Approvals
                    </p>
                    <span className="badge badge-warning">
                      {activeTab === 'sessions' ? getFilteredSessions().length : getFilteredReports().length}
                    </span>
                  </div>

                  {loading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {activeTab === 'sessions' && getFilteredSessions().length === 0 && (
                        <div className="flex flex-col items-center py-10 text-center">
                          <svg className="w-9 h-9 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <p className="text-[12px] font-semibold text-[#8392ab]">No pending sessions</p>
                          <p className="text-[11px] text-[#8392ab] mt-1">All sessions have been reviewed.</p>
                        </div>
                      )}
                      {activeTab === 'reports' && getFilteredReports().length === 0 && (
                        <div className="flex flex-col items-center py-10 text-center">
                          <svg className="w-9 h-9 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-[12px] font-semibold text-[#8392ab]">No pending reports</p>
                          <p className="text-[11px] text-[#8392ab] mt-1">All reports have been signed.</p>
                        </div>
                      )}

                      {activeTab === 'sessions' && getFilteredSessions().map((s, idx) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSession(s)}
                          className={`p-3.5 rounded-xl cursor-pointer border transition-all hover-lift
                            ${selectedSession?.id === s.id
                              ? 'bg-[#fffdf5] border-[#E5A93C] shadow-sm'
                              : 'bg-[#f8f9fa] border-gray-100 hover:border-[#E5A93C]'
                            }`}
                          style={{ animationDelay: `${idx * 60}ms` }}
                        >
                          <div className="flex items-start justify-between">
                            <p className="text-[13px] font-bold text-[#344767]">{s.courseName}</p>
                            <span className="badge badge-dark font-mono text-[10px]">{s.courseCode}</span>
                          </div>
                          {s.classDisplayName && (
                            <p className="text-[11px] text-[#b5821c] font-semibold mt-1">{s.classDisplayName}</p>
                          )}
                          <p className="text-[11px] text-[#8392ab] mt-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {s.endTime
                              ? `Closed: ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : `Started: ${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                        </div>
                      ))}

                      {activeTab === 'reports' && getFilteredReports().map((r, idx) => (
                        <div
                          key={r.id}
                          onClick={() => handleSelectReport(r)}
                          className={`p-3.5 rounded-xl cursor-pointer border transition-all hover-lift
                            ${selectedReport?.id === r.id
                              ? 'bg-[#fffdf5] border-[#E5A93C] shadow-sm'
                              : 'bg-[#f8f9fa] border-gray-100 hover:border-[#E5A93C]'
                            }`}
                          style={{ animationDelay: `${idx * 60}ms` }}
                        >
                          <p className="text-[13px] font-bold text-[#344767]">{r.course.name}</p>
                          <p className="text-[11px] text-[#b5821c] font-semibold mt-1">{r.class.displayName}</p>
                          <p className="text-[10px] text-[#8392ab] mt-1.5">
                            Generated by: {r.generatedBy?.username}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: details + signature */}
              <div className="lg:col-span-2 animate-fade-in-up delay-100">
                {!selectedSession && !selectedReport ? (
                  <div className="bg-white rounded-2xl p-10 shadow-[0_1px_3px_rgba(0,0,0,.08)] flex flex-col items-center justify-center text-center min-h-[400px]">
                    <div className="w-16 h-16 rounded-2xl bg-[#f8f9fa] border border-gray-100 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-[15px] font-bold text-[#344767]">No Item Selected</p>
                    <p className="text-[12px] text-[#8392ab] mt-1.5 max-w-xs">Select a pending item from the left list to review and sign off.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.08)] overflow-hidden animate-scale-in">
                    {/* Detail header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-[#f8f9fa]">
                      <div>
                        <p className="text-[15px] font-bold text-[#344767]">
                          {activeTab === 'sessions' ? selectedSession?.courseName : selectedReport?.course?.name}
                        </p>
                        <p className="text-[11px] text-[#8392ab] mt-0.5">
                          {activeTab === 'sessions'
                            ? `Session ID: ${selectedSession?.id}`
                            : `Report ID: ${selectedReport?.id}`}
                        </p>
                      </div>
                      <span className="badge badge-warning">Awaiting Signature</span>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* SESSION DETAIL */}
                      {activeTab === 'sessions' && (
                        <>
                          {loadingDetails ? (
                            <div className="flex flex-col items-center py-14 gap-3">
                              <div className="w-8 h-8 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin" />
                              <span className="text-[12px] text-[#8392ab]">Loading attendance records…</span>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div>
                                <p className="text-[12px] font-bold text-[#8392ab] uppercase tracking-wider mb-3">Attendance Summary</p>
                                <AttendanceTable attendances={attendances} />
                              </div>

                              <div className="border-t border-gray-100 pt-5">
                                <p className="text-[12px] font-bold text-[#8392ab] uppercase tracking-wider mb-3">Lecturer Signature</p>
                                <div className="bg-[#f8f9fa] rounded-xl border border-gray-200 p-4">
                                  <SignatureCanvas onSave={setSignature} label="Lecturer Signature" />
                                </div>
                                <p className="text-[11px] text-[#8392ab] mt-2">Draw your signature above to enable the approve button.</p>
                              </div>

                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSession(null)}
                                  className="flex-1 py-3 bg-[#f8f9fa] hover:bg-gray-100 text-[#344767] font-semibold rounded-xl border border-gray-200 transition-all text-[13px]"
                                >
                                  Close Review
                                </button>
                                <button
                                  onClick={handleApproveSession}
                                  disabled={approving || !signature}
                                  className="sip-btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                                >
                                  {approving
                                    ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    : 'Approve & Sign Session'
                                  }
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* REPORT DETAIL */}
                      {activeTab === 'reports' && selectedReport && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 bg-[#f8f9fa] rounded-xl border border-gray-200">
                            <div>
                              <p className="text-[13px] font-bold text-[#344767]">Generated Document Ready</p>
                              <p className="text-[11px] text-[#8392ab] mt-0.5">Please review the document before signing.</p>
                            </div>
                            <a
                              href={selectedReport.fileUrl}
                              download
                              className="sip-btn-dark text-[11px] py-2 px-4"
                            >
                              Download .docx
                            </a>
                          </div>

                          <div className="border-t border-gray-100 pt-5">
                            <p className="text-[12px] font-bold text-[#8392ab] uppercase tracking-wider mb-1">Lecturer Signature</p>
                            <p className="text-[11px] text-amber-500 font-medium mb-3">Sign below to authorize archiving of this official report.</p>
                            <div className="bg-[#f8f9fa] rounded-xl border border-gray-200 p-4">
                              <SignatureCanvas onSave={setSignature} label="Lecturer Signature" />
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedReport(null)}
                              className="flex-1 py-3 bg-[#f8f9fa] hover:bg-gray-100 text-[#344767] font-semibold rounded-xl border border-gray-200 transition-all text-[13px]"
                            >
                              Close Review
                            </button>
                            <button
                              onClick={handleApproveReport}
                              disabled={approving || !signature}
                              className="sip-btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                            >
                              {approving
                                ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                : 'Approve & Archive Report'
                              }
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: MY CLASSES ── */}
          {activeTab === 'classes' && (
            <div className="space-y-4 animate-slide-left">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#344767]">My Taught Classes</p>
                <span className="badge badge-info">{assignedClasses.length} assignment{assignedClasses.length !== 1 ? 's' : ''}</span>
              </div>

              {loadingClasses ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
                </div>
              ) : assignedClasses.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,.08)]">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" />
                  </svg>
                  <p className="text-[13px] font-semibold text-[#8392ab]">No classes assigned</p>
                  <p className="text-[11px] text-[#8392ab] mt-1">Contact your administrator to upload the class distribution.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignedClasses.map((ac, idx) => (
                    <div
                      key={ac.assignmentId}
                      className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,.08)] hover-lift animate-fade-in-up"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="badge badge-info font-mono">{ac.courseCode}</span>
                      </div>
                      <p className="text-[14px] font-bold text-[#344767]">{ac.courseName}</p>
                      <p className="text-[12px] text-[#8392ab] mt-1">{ac.classDisplayName}</p>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                        <button
                          onClick={() => { setActiveTab('sessions'); setSelectedClass(ac); }}
                          className="sip-btn-primary flex-1 text-[11px] py-2"
                        >
                          View Sessions
                        </button>
                        <button
                          onClick={() => { setActiveTab('reports'); setSelectedClass(ac); }}
                          className="sip-btn-dark flex-1 text-[11px] py-2"
                        >
                          View Reports
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
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
    </div>
  );
};

export default LecturerPortal;
