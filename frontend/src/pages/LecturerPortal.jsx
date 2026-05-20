import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AttendanceTable from '../components/AttendanceTable';
import SignatureCanvas from '../components/SignatureCanvas';
import NotificationPanel from '../components/NotificationPanel';

const LecturerPortal = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [username, setUsername] = useState('');
  
  // Selected Session States
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Signature & Approval states
  const [signature, setSignature] = useState('');
  const [approving, setApproving] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setUsername(localStorage.getItem('username') || 'Lecturer');
    fetchClosedSessions();
  }, []);

  const fetchClosedSessions = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Fetch stats to get recent sessions. Or let's fetch active and closed sessions.
      // Wait, we can fetch all sessions from stats, or fetch active, or fetch stats and filter!
      // In backend/src/index.js, stats endpoint returns recentSessions.
      // Let's call /stats and filter for CLOSED sessions.
      const statsRes = await api.get('/stats');
      const allRecent = statsRes.data.recentSessions || [];
      const closed = allRecent.filter(s => s.status === 'CLOSED');
      setSessions(closed);
    } catch (err) {
      console.error('Fetch closed sessions error:', err);
      setErrorMsg('Failed to load pending sessions. Ensure you are logged in.');
    } finally {
      setLoading(false);
    }
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
      alert('Failed to load session details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleApprove = async () => {
    if (!signature) {
      alert('Please sign on the canvas before approving.');
      return;
    }

    setApproving(true);
    try {
      await api.patch(`/sessions/${selectedSession.id}/approve`, {
        lecturerSignature: signature
      });
      alert('Session approved and signed successfully!');
      setSelectedSession(null);
      setAttendances([]);
      setSignature('');
      fetchClosedSessions();
    } catch (err) {
      console.error('Approve error:', err);
      alert(err.response?.data?.error || 'Failed to approve session');
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
    localStorage.clear();
    navigate('/');
  };

  // Custom Branding
  const deptName = localStorage.getItem('dept_name') || 'Class Attendance System';
  const deptLogo = localStorage.getItem('dept_logo') || '/logo.svg';

  return (
    <div className="min-h-screen bg-[#00122c] text-slate-100 p-6 relative overflow-hidden">
      {/* Background logo watermark */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <img src="/logo.jfif" alt="GCTU Crest Watermark" className="w-[450px] h-[450px] object-contain filter grayscale" />
      </div>

      {/* Background radial gradient */}
      <div className="absolute top-[-30%] right-[-10%] w-[70%] h-[70%] rounded-full bg-[#D4A017]/5 blur-[150px] pointer-events-none"></div>

      {/* Nav */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10 pb-6 border-b border-[#002a63] relative z-10">
        <div className="flex items-center gap-3">
          <img src={deptLogo} alt="Logo" className="w-12 h-12 object-contain bg-[#000a18]/40 rounded-xl p-1 border border-[#002a63]" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {deptName}
            </h1>
            <p className="text-xs text-slate-400">Lecturer Portal • Review and sign attendance sheets</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NotificationPanel />
          <span className="text-slate-400 text-sm hidden md:inline">Logged in as: <span className="font-semibold text-[#D4A017]">{username}</span></span>
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-lg border border-slate-700 transition-all text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        {/* Left Side: Pending Sessions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl min-h-[300px]">
            <h2 className="text-lg font-bold text-white mb-4">Pending Approvals ({sessions.length})</h2>
            
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : errorMsg ? (
              <p className="text-sm text-rose-400 text-center py-10">{errorMsg}</p>
            ) : sessions.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-10">
                No class registers are currently waiting for your signature.
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
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
                    <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Closed: {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Details & Signature */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedSession ? (
            <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center min-h-[450px]">
              <div className="p-4 rounded-full bg-[#000a18]/60 border border-[#002a63] text-slate-500 mb-4">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Session Selected</h3>
              <p className="text-sm text-slate-400 max-w-sm">Select a pending class register from the left list to review attendance and sign off.</p>
            </div>
          ) : (
            <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-[#002a63] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedSession.courseName}</h2>
                  <p className="text-xs text-slate-400 mt-1">Session ID: <span className="font-mono">{selectedSession.id}</span></p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Awaiting Signature
                </span>
              </div>

              {loadingDetails ? (
                <div className="flex justify-center items-center py-20">
                  <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Attendance Log Table */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">Attendance Report Summary</h4>
                    <AttendanceTable attendances={attendances} />
                  </div>

                  {/* Signature pad */}
                  <div className="border-t border-[#002a63] pt-6">
                    <SignatureCanvas onSave={setSignature} />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedSession(null)}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-all text-sm"
                    >
                      Close Review
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={approving || !signature}
                      className="flex-1 bg-[#D4A017] hover:bg-[#b88a14] disabled:bg-[#000a18] disabled:text-slate-500 active:scale-[0.98] text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                    >
                      {approving ? (
                        <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Approve & Sign Class'
                      )}
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
