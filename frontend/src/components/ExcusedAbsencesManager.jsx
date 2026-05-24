import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from './ToastProvider';

const ExcusedAbsencesManager = () => {
  const [excusedRequests, setExcusedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING'); // 'PENDING', 'RESOLVED', 'REJECTED', 'ALL'
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const toast = useToast();

  const fetchExcusedRequests = async () => {
    setLoading(true);
    try {
      const params = {
        type: 'ABSENCE_EXCUSE'
      };
      
      if (filter !== 'ALL') {
        params.status = filter;
      }

      const response = await api.get('/grievances', { params });
      setExcusedRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching excused requests:', error);
      toast.error('Failed to load excused absence requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExcusedRequests();
  }, [filter]);

  const handleApprove = async (request) => {
    if (!adminResponse.trim()) {
      toast.error('Please provide a response/comment');
      return;
    }

    setProcessing(true);
    try {
      await api.patch(`/grievances/${request.id}/resolve`, {
        status: 'RESOLVED',
        adminResponse: adminResponse.trim()
      });

      toast.success('Excused absence approved successfully');
      setShowDetailsModal(false);
      setSelectedRequest(null);
      setAdminResponse('');
      fetchExcusedRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error(error.response?.data?.error || 'Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request) => {
    if (!adminResponse.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      await api.patch(`/grievances/${request.id}/resolve`, {
        status: 'REJECTED',
        adminResponse: adminResponse.trim()
      });

      toast.success('Excused absence rejected');
      setShowDetailsModal(false);
      setSelectedRequest(null);
      setAdminResponse('');
      fetchExcusedRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error(error.response?.data?.error || 'Failed to reject request');
    } finally {
      setProcessing(false);
    }
  };

  const openDetailsModal = (request) => {
    setSelectedRequest(request);
    setAdminResponse(request.adminResponse || '');
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedRequest(null);
    setAdminResponse('');
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      RESOLVED: 'bg-green-100 text-green-800 border-green-300',
      REJECTED: 'bg-red-100 text-red-800 border-red-300'
    };
    return badges[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusIcon = (status) => {
    const icons = {
      PENDING: '⏳',
      RESOLVED: '✅',
      REJECTED: '❌'
    };
    return icons[status] || '📋';
  };

  const filteredRequests = excusedRequests.filter(request => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      request.studentName?.toLowerCase().includes(searchLower) ||
      request.studentIndex?.toLowerCase().includes(searchLower) ||
      request.subject?.toLowerCase().includes(searchLower) ||
      request.courseCode?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: excusedRequests.length,
    pending: excusedRequests.filter(r => r.status === 'PENDING').length,
    resolved: excusedRequests.filter(r => r.status === 'RESOLVED').length,
    rejected: excusedRequests.filter(r => r.status === 'REJECTED').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E5A93C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-5 rounded-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#344767] text-sm">Manage Excused Absences</h3>
            <p className="text-xs text-[#8392ab] mt-0.5">
              Review and approve/reject student absence excuse requests
            </p>
          </div>
          <button
            onClick={fetchExcusedRequests}
            className="px-4 py-2 bg-[#0c2340] hover:bg-[#1a3c6d] text-white text-xs font-bold rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-[#8392ab] mb-1">Total Requests</div>
          <div className="text-2xl font-bold text-[#344767]">{stats.total}</div>
        </div>
        <div className="bg-white border border-yellow-500/30 rounded-xl p-4">
          <div className="text-xs text-yellow-400 mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-white border border-green-500/30 rounded-xl p-4">
          <div className="text-xs text-green-400 mb-1">Approved</div>
          <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
        </div>
        <div className="bg-white border border-red-500/30 rounded-xl p-4">
          <div className="text-xs text-red-400 mb-1">Rejected</div>
          <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Status Filter */}
          <div className="flex gap-2">
            {['ALL', 'PENDING', 'RESOLVED', 'REJECTED'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  filter === status
                    ? 'bg-[#0c2340] text-white'
                    : 'bg-gray-100 text-[#8392ab] hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, index, subject, or course..."
            className="flex-1 px-4 py-2 bg-[#f8f9fa] border border-[#e9ecef] rounded-lg text-[#344767] text-xs placeholder-slate-500 focus:outline-none focus:border-[#0c2340] transition-colors"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-[#8392ab] text-sm">
              {search ? 'No requests match your search' : `No ${filter.toLowerCase()} requests found`}
            </p>
          </div>
        ) : (
          filteredRequests.map(request => (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-500/30 transition"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Request Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getStatusIcon(request.status)}</span>
                    <div>
                      <h4 className="font-bold text-[#344767] text-sm">{request.subject}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {!request.anonymous && (
                          <>
                            <span className="text-xs text-[#8392ab]">
                              {request.studentName} ({request.studentIndex})
                            </span>
                            <span className="text-[#8392ab]">•</span>
                          </>
                        )}
                        {request.anonymous && (
                          <>
                            <span className="text-xs text-[#8392ab] italic">Anonymous</span>
                            <span className="text-[#8392ab]">•</span>
                          </>
                        )}
                        {request.courseCode && (
                          <>
                            <span className="text-xs text-blue-400">{request.courseCode}</span>
                            <span className="text-[#8392ab]">•</span>
                          </>
                        )}
                        <span className="text-xs text-[#8392ab]">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#344767] line-clamp-2 mb-3">
                    {request.message}
                  </p>

                  {request.adminResponse && (
                    <div className="bg-[#f8f9fa] border border-[#e9ecef] rounded-lg p-3 mb-3">
                      <div className="text-xs text-[#8392ab] mb-1">Response:</div>
                      <p className="text-xs text-[#344767]">{request.adminResponse}</p>
                      {request.resolvedBy && (
                        <div className="text-xs text-[#8392ab] mt-2">
                          — {request.resolvedBy.username} ({request.resolvedBy.role})
                        </div>
                      )}
                    </div>
                  )}

                  {request.evidenceUrl && (
                    <a
                      href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${request.evidenceUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      View Evidence
                    </a>
                  )}
                </div>

                {/* Right: Status & Actions */}
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(request.status)}`}>
                    {request.status}
                  </span>

                  <button
                    onClick={() => openDetailsModal(request)}
                    className="px-4 py-2 bg-[#E5A93C] hover:bg-[#b5821c] text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    {request.status === 'PENDING' ? 'Review' : 'View Details'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-100 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#344767]">Excused Absence Request</h3>
              <button
                onClick={closeDetailsModal}
                className="text-[#8392ab] hover:text-[#0c2340] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Student Info */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-[#8392ab] mb-2">Student Information</div>
                {!selectedRequest.anonymous ? (
                  <div className="space-y-1">
                    <div className="text-sm text-[#344767] font-semibold">{selectedRequest.studentName}</div>
                    <div className="text-xs text-[#8392ab]">Index: {selectedRequest.studentIndex}</div>
                  </div>
                ) : (
                  <div className="text-sm text-[#8392ab] italic">Anonymous Request</div>
                )}
              </div>

              {/* Request Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-[#8392ab] mb-2">Subject</div>
                <div className="text-sm text-[#344767] font-semibold mb-3">{selectedRequest.subject}</div>
                
                {selectedRequest.courseCode && (
                  <>
                    <div className="text-xs text-[#8392ab] mb-2">Course</div>
                    <div className="text-sm text-blue-400 mb-3">{selectedRequest.courseCode}</div>
                  </>
                )}

                <div className="text-xs text-[#8392ab] mb-2">Reason for Absence</div>
                <div className="text-sm text-[#344767] whitespace-pre-wrap">{selectedRequest.message}</div>
              </div>

              {/* Evidence */}
              {selectedRequest.evidenceUrl && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-[#8392ab] mb-2">Evidence Attached</div>
                  <a
                    href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${selectedRequest.evidenceUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    View/Download Evidence
                  </a>
                </div>
              )}

              {/* Response Section */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-[#8392ab] mb-2">
                  {selectedRequest.status === 'PENDING' ? 'Your Response' : 'Response Given'}
                </div>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  disabled={selectedRequest.status !== 'PENDING'}
                  placeholder="Provide your decision and comments..."
                  rows={4}
                  className="w-full px-4 py-3 bg-[#f8f9fa] border border-[#e9ecef] rounded-lg text-[#344767] text-sm placeholder-slate-500 focus:outline-none focus:border-[#0c2340] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-[#8392ab]">
                <span>Submitted: {new Date(selectedRequest.createdAt).toLocaleString()}</span>
                <span className={`px-3 py-1 rounded-full font-bold border ${getStatusBadge(selectedRequest.status)}`}>
                  {selectedRequest.status}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            {selectedRequest.status === 'PENDING' && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 flex gap-3">
                <button
                  onClick={closeDetailsModal}
                  disabled={processing}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-[#8392ab] text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(selectedRequest)}
                  disabled={processing || !adminResponse.trim()}
                  className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={processing || !adminResponse.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcusedAbsencesManager;
