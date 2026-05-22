import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from './ToastProvider';

const AdminGrievancePanel = () => {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'RESOLVED' | 'REJECTED'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'ABSENCE_EXCUSE' | 'SYSTEM_ISSUE' | 'INTEGRITY_REPORT' | 'GENERAL_COMPLAINT'
  
  // Selected Grievance for Drawer
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [adminReply, setAdminReply] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Global toast hook
  const toast = useToast();

  const fetchGrievances = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/grievances/list';
      const params = [];
      if (statusFilter !== 'ALL') params.push(`status=${statusFilter}`);
      if (typeFilter !== 'ALL') params.push(`type=${typeFilter}`);
      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      const response = await api.get(url);
      setGrievances(response.data || []);
    } catch (err) {
      console.error('Fetch admin grievances error:', err);
      toast.error('Could not load grievances list');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  const handleResolve = async (id, status) => {
    if (!adminReply.trim()) {
      toast.error('Please provide a response comment for the student.');
      return;
    }

    setSubmittingReply(true);
    try {
      await api.post(`/grievances/${id}/resolve`, {
        status,
        adminResponse: adminReply.trim()
      });

      toast.success(`Support case marked as ${status}.`);
      setAdminReply('');
      setSelectedGrievance(null);
      fetchGrievances();
    } catch (err) {
      console.error('Resolve grievance error:', err);
      toast.error(err.response?.data?.error || 'Failed to update ticket.');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-[#001c44] border border-[#002a63] p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Student Support & Grievance Desk</h2>
          <p className="text-xs text-slate-400 mt-1">Review sickness excuses, track classroom integrity reports, and resolve system anomalies.</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {/* Status Filter */}
          <div className="space-y-1">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#000a18] border border-[#002a63] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4A017] font-semibold"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="space-y-1">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide">Category</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#000a18] border border-[#002a63] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4A017] font-semibold"
            >
              <option value="ALL">All Categories</option>
              <option value="ABSENCE_EXCUSE">Absence Excuse</option>
              <option value="SYSTEM_ISSUE">System Issue</option>
              <option value="INTEGRITY_REPORT">Academic Integrity</option>
              <option value="GENERAL_COMPLAINT">General Complaint</option>
            </select>
          </div>
        </div>
      </div>

      {/* Split view: Tickets list and selected ticket details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Ticket List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-24 bg-[#001c44]/40 border border-[#002a63]/40 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : grievances.length === 0 ? (
            <div className="bg-[#001c44]/20 border border-dashed border-[#002a63] p-12 text-center rounded-2xl text-slate-500 text-xs">
              No matching tickets found. Good job!
            </div>
          ) : (
            <div className="space-y-3">
              {grievances.map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    setSelectedGrievance(g);
                    setAdminReply(g.adminResponse || '');
                  }}
                  className={`bg-[#001c44] border rounded-2xl p-4 cursor-pointer transition-all hover:border-[#D4A017]/40 ${
                    selectedGrievance?.id === g.id ? 'border-[#D4A017] shadow-[#D4A017]/5 shadow-lg' : 'border-[#002a63]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                        g.type === 'ABSENCE_EXCUSE' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        g.type === 'SYSTEM_ISSUE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        g.type === 'INTEGRITY_REPORT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {g.type.replace('_', ' ')}
                      </span>
                      <h3 className="font-extrabold text-sm text-white leading-snug pt-1">{g.subject}</h3>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                        <span className="font-semibold">
                          {g.anonymous ? '🤫 Anonymous' : `${g.studentName} (${g.studentIndex})`}
                        </span>
                        {g.courseCode && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-[#D4A017] font-mono">{g.courseCode}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded ${
                        g.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' :
                        g.status === 'RESOLVED' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                        'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                      }`}>
                        {g.status}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(g.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Ticket Drawer/Card (1 col) */}
        <div className="lg:col-span-1">
          {selectedGrievance ? (
            <div className="bg-[#001c44] border border-[#002a63] rounded-2xl p-5 space-y-5 shadow-xl animate-[fadeIn_0.2s_ease-out]">
              <div className="flex justify-between items-start pb-3 border-b border-[#002a63]/40">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Inspecting Ticket</span>
                  <h4 className="font-extrabold text-sm text-white">{selectedGrievance.subject}</h4>
                </div>
                <button
                  onClick={() => setSelectedGrievance(null)}
                  className="p-1 rounded-lg bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sender Details */}
              <div className="bg-[#000a18]/40 p-3 rounded-xl border border-[#002a63]/50 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sender:</span>
                  <span className="font-bold text-white">
                    {selectedGrievance.anonymous ? '🤫 Anonymous Student' : selectedGrievance.studentName}
                  </span>
                </div>
                {!selectedGrievance.anonymous && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Index Number:</span>
                    <span className="font-mono text-[#D4A017]">{selectedGrievance.studentIndex}</span>
                  </div>
                )}
                {selectedGrievance.courseCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Course:</span>
                    <span className="font-semibold text-[#D4A017]">{selectedGrievance.courseCode}</span>
                  </div>
                )}
              </div>

              {/* Message content */}
              <div className="space-y-1.5">
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Report Description</span>
                <p className="text-xs text-slate-200 bg-[#000a18]/25 p-3.5 border border-[#002a63]/40 rounded-xl leading-relaxed whitespace-pre-wrap">
                  {selectedGrievance.message}
                </p>
              </div>

              {/* Attachment Preview */}
              {selectedGrievance.evidenceUrl && (
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Evidence Attachment</span>
                  <div className="bg-[#000a18]/40 p-3 border border-[#002a63]/40 rounded-xl flex items-center justify-between text-xs">
                    <span className="truncate text-slate-400 font-mono pr-4 text-[10px]">
                      {selectedGrievance.evidenceUrl.split('/').pop()}
                    </span>
                    <a
                      href={`http://localhost:5000${selectedGrievance.evidenceUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#D4A017] hover:bg-[#b88a14] text-slate-950 font-extrabold px-3 py-1.5 rounded-lg text-[10px] transition-colors"
                    >                      View Link
                    </a>
                  </div>
                </div>
              )}

              {/* Resolution Form */}
              {selectedGrievance.status === 'PENDING' ? (
                <div className="space-y-4 pt-2 border-t border-[#002a63]/40">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Official Response / Comments</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Excused. Attendance override processed. Or GPS issue noted..."
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#D4A017] resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(selectedGrievance.id, 'RESOLVED')}
                      disabled={submittingReply}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs transition-colors"
                    >
                      Approve & Resolve
                    </button>
                    <button
                      onClick={() => handleResolve(selectedGrievance.id, 'REJECTED')}
                      disabled={submittingReply}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#000a18]/60 p-4 border border-[#002a63]/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold text-[#D4A017] uppercase tracking-wider">
                    <span>Official Response Log</span>
                    <span className="text-[8px] text-slate-500">
                      by: {selectedGrievance.resolvedBy?.username} ({selectedGrievance.resolvedBy?.role})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic">
                    "{selectedGrievance.adminResponse || 'No feedback left'}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:block bg-[#001c44]/20 border border-dashed border-[#002a63] p-12 text-center rounded-2xl text-slate-500 text-xs">
              Select a support ticket from the list to view files and resolve.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminGrievancePanel;
