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
    if (!selectedClass) return reports;
    return reports.filter(r => r.classId === selectedClass.classId && r.courseId === selectedClass.courseId);
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
        signature // The backend doesn't strictly save the signature image for reports right now, just the fact it was signed by the user. But we send it.
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

  return (
    <div className="min-h-screen bg-[#00122c] text-slate-100 p-6 relative overflow-hidden">
      {/* Background logo watermark */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none flex items-center justify-center">
        <img src="/logo2.png" alt="GCTU Crest Watermark" className="w-[450px] h-[450px] object-contain" />
      </div>

      <div className="absolute top-[-30%] right-[-10%] w-[70%] h-[70%] rounded-full bg-[#D4A017]/5 blur-[150px] pointer-events-none"></div>

      {/* Nav */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-6 pb-6 border-b border-[#002a63] relative z-10">
        <div className="flex items-center gap-3">
          <img src={displayDeptLogo} alt="Logo" className="w-12 h-12 object-contain bg-[#000a18]/40 rounded-xl p-1 border border-[#002a63]" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {displayDeptName}
            </h1>
            <p className="text-xs text-slate-400">Lecturer Portal • Review and sign documents</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NotificationPanel />
          <span className="text-slate-400 text-sm hidden md:inline">Logged in as: <span className="font-semibold text-[#D4A017]">{displayUsername}</span></span>
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-lg border border-slate-700 transition-all text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto mb-6 flex gap-4 relative z-10">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition ${activeTab === 'sessions' ? 'bg-[#D4A017] text-slate-900 shadow-lg shadow-[#D4A017]/20' : 'bg-[#001c44] text-slate-400 hover:bg-[#002a63] border border-[#002a63]'}`}
        >
          Daily Sessions
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition ${activeTab === 'reports' ? 'bg-[#D4A017] text-slate-900 shadow-lg shadow-[#D4A017]/20' : 'bg-[#001c44] text-slate-400 hover:bg-[#002a63] border border-[#002a63]'}`}
        >
          Official Class Reports
        </button>
      </div>

      {/* My Taught Classes Selector */}
      <div className="max-w-6xl mx-auto mb-6 bg-[#001c44]/40 border border-[#002a63] p-4 rounded-xl relative z-10">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          My Taught Classes ({assignedClasses.length})
        </h3>
        {loadingClasses ? (
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-[#002a63]/40 animate-pulse rounded-lg"></div>
            <div className="h-10 w-32 bg-[#002a63]/40 animate-pulse rounded-lg"></div>
          </div>
        ) : assignedClasses.length === 0 ? (
          <p className="text-xs text-slate-500">No courses or classes currently assigned. Please contact the Administrator to upload your class distribution.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedClass(null)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                !selectedClass
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-[#000a18]/60 border-[#002a63] text-slate-400 hover:border-[#003b8e]'
              }`}
            >
              All Classes
            </button>
            {assignedClasses.map((ac) => (
              <button
                key={ac.assignmentId}
                onClick={() => setSelectedClass(ac)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left flex flex-col justify-center leading-tight ${
                  selectedClass?.assignmentId === ac.assignmentId
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-[#000a18]/60 border-[#002a63] text-slate-400 hover:border-[#003b8e]'
                }`}
              >
                <span className="font-bold">{ac.courseCode} • {ac.courseName}</span>
                <span className={`text-[10px] mt-0.5 font-medium ${selectedClass?.assignmentId === ac.assignmentId ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {ac.classDisplayName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        {/* Left Side: Pending Items */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl min-h-[300px]">
            <h2 className="text-lg font-bold text-white mb-4">
              Pending Approvals ({activeTab === 'sessions' ? getFilteredSessions().length : getFilteredReports().length})
            </h2>
            
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : errorMsg ? (
              <p className="text-sm text-rose-400 text-center py-10">{errorMsg}</p>
            ) : activeTab === 'sessions' && getFilteredSessions().length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-10">
                No class registers are currently waiting for your signature.
              </div>
            ) : activeTab === 'reports' && getFilteredReports().length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-10">
                No official reports are waiting for your signature.
              </div>
            ) : (
              <div className="space-y-3">
                {activeTab === 'sessions' && getFilteredSessions().map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={`p-4 border rounded-xl transition-all cursor-pointer text-left ${
                      selectedSession?.id === s.id
                        ? 'bg-[#000a18] border-[#D4A017] shadow-md shadow-[#D4A017]/5'
                        : 'bg-[#000a18]/40 border-[#002a63] hover:border-[#003b8e]'
                    }`}
                  >
                    <p className="font-bold text-slate-200 text-sm">{s.courseName}</p>
                    <p className="font-mono text-xs text-slate-500 mt-1">{s.courseCode}</p>
                    {s.classDisplayName && (
                      <p className="text-xs text-indigo-400 mt-1 font-semibold">{s.classDisplayName}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {s.endTime ? `Closed: ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Started: ${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                ))}
                
                {activeTab === 'reports' && getFilteredReports().map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleSelectReport(r)}
                    className={`p-4 border rounded-xl transition-all cursor-pointer text-left ${
                      selectedReport?.id === r.id
                        ? 'bg-[#000a18] border-[#D4A017] shadow-md shadow-[#D4A017]/5'
                        : 'bg-[#000a18]/40 border-[#002a63] hover:border-[#003b8e]'
                    }`}
                  >
                    <p className="font-bold text-slate-200 text-sm">{r.course.name}</p>
                    <p className="text-xs font-semibold text-indigo-400 mt-1">Class: {r.class.displayName}</p>
                    <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                      Generated by Rep: {r.generatedBy?.username}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Details & Signature */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedSession && !selectedReport ? (
            <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center min-h-[450px]">
              <div className="p-4 rounded-full bg-[#000a18]/60 border border-[#002a63] text-slate-500 mb-4">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Item Selected</h3>
              <p className="text-sm text-slate-400 max-w-sm">Select a pending item from the left list to review and sign off.</p>
            </div>
          ) : (
            <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-[#002a63] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {activeTab === 'sessions' ? selectedSession?.courseName : selectedReport?.course?.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeTab === 'sessions' ? `Session ID: ${selectedSession?.id}` : `Report ID: ${selectedReport?.id}`}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Awaiting Signature
                </span>
              </div>

              {activeTab === 'sessions' && (
                <>
                  {loadingDetails ? (
                    <div className="flex justify-center items-center py-20">
                      <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Attendance Report Summary</h4>
                        <AttendanceTable attendances={attendances} />
                      </div>
                      
                      <div className="border-t border-[#002a63] pt-6">
                        <SignatureCanvas onSave={setSignature} label="Lecturer Signature" />
                      </div>
                      
                      <div className="flex gap-4">
                        <button type="button" onClick={() => setSelectedSession(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all text-sm">
                          Close Review
                        </button>
                        <button onClick={handleApproveSession} disabled={approving || !signature} className="flex-1 bg-[#D4A017] hover:bg-[#b88a14] disabled:bg-[#000a18] disabled:text-slate-500 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2">
                          {approving ? <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div> : 'Approve & Sign Session'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'reports' && selectedReport && (
                <div className="space-y-6">
                  <div className="bg-[#000a18] p-5 rounded-xl border border-[#002a63] flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold text-sm mb-1">Generated Document Ready</p>
                      <p className="text-xs text-slate-400">Please review the document before signing.</p>
                    </div>
                    <a href={selectedReport.fileUrl} download className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow transition">
                      Download & Review .docx
                    </a>
                  </div>

                  <div className="border-t border-[#002a63] pt-6">
                    <p className="text-xs text-amber-400 mb-3 font-semibold">Sign below to authorize the archiving of this official report.</p>
                    <SignatureCanvas onSave={setSignature} label="Lecturer Signature" />
                  </div>
                  
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setSelectedReport(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all text-sm">
                      Close Review
                    </button>
                    <button onClick={handleApproveReport} disabled={approving || !signature} className="flex-1 bg-[#D4A017] hover:bg-[#b88a14] disabled:bg-[#000a18] disabled:text-slate-500 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2">
                      {approving ? <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div> : 'Approve & Archive Report'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LecturerPortal;
