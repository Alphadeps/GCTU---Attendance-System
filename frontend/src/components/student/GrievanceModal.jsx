import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../ToastProvider';

const GrievanceModal = ({ indexNumber, fullName, courses, onClose, onSubmitted }) => {
  const toast = useToast();

  // Grievance form state
  const [grievanceType, setGrievanceType] = useState('ABSENCE_EXCUSE');
  const [grievanceSubject, setGrievanceSubject] = useState('');
  const [grievanceMessage, setGrievanceMessage] = useState('');
  const [grievanceCourse, setGrievanceCourse] = useState('');
  const [grievanceAnonymous, setGrievanceAnonymous] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [submittingGrievance, setSubmittingGrievance] = useState(false);

  const handleGrievanceSubmit = async (e) => {
    e.preventDefault();
    if (!grievanceSubject.trim() || !grievanceMessage.trim()) {
      toast.error('Please fill in both subject and description.');
      return;
    }

    setSubmittingGrievance(true);
    const formData = new FormData();
    formData.append('type', grievanceType);
    formData.append('subject', grievanceSubject.trim());
    formData.append('message', grievanceMessage.trim());
    formData.append('anonymous', grievanceAnonymous ? 'true' : 'false');

    if (!grievanceAnonymous) {
      formData.append('studentIndex', indexNumber);
      formData.append('studentName', fullName);
    }

    if (grievanceCourse) {
      formData.append('courseCode', grievanceCourse);
    }

    if (evidenceFile) {
      formData.append('evidence', evidenceFile);
    }

    try {
      await api.post('/grievances/submit', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Support request submitted successfully!');
      onClose();
      onSubmitted();
    } catch (err) {
      console.error('Grievance submission error:', err);
      const errMsg = err.response?.data?.error || 'Failed to submit support case.';
      toast.error(errMsg);
    } finally {
      setSubmittingGrievance(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#00122c] border-t border-[#002a63] w-full max-w-[430px] rounded-t-[32px] p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] shadow-2xl relative">
        <div className="flex justify-between items-center pb-2 border-b border-[#002a63]/40">
          <h3 className="text-lg font-black text-white">New Support Case</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/40 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleGrievanceSubmit} className="space-y-4 text-left">
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</label>
            <select
              value={grievanceType}
              onChange={(e) => {
                const selectedType = e.target.value;
                setGrievanceType(selectedType);
                // Reset anonymity flag if switching to categories that don't support it
                if (selectedType !== 'INTEGRITY_REPORT' && selectedType !== 'GENERAL_COMPLAINT') {
                  setGrievanceAnonymous(false);
                }
              }}
              className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-[#D4A017] font-semibold"
            >
              <option value="ABSENCE_EXCUSE">Absence / Sickness Excuse</option>
              <option value="SYSTEM_ISSUE">System / GPS / WiFi Issue</option>
              <option value="INTEGRITY_REPORT">Academic Integrity Report</option>
              <option value="GENERAL_COMPLAINT">General Complaint / Feedback</option>
            </select>
          </div>

          {/* Course Selector (Optional) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Associated Course (Optional)</label>
            <select
              value={grievanceCourse}
              onChange={(e) => setGrievanceCourse(e.target.value)}
              className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-[#D4A017] font-medium"
            >
              <option value="">No specific course</option>
              {courses.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subject</label>
            <input
              type="text"
              required
              placeholder="e.g. GPS Coordinate Error, Sick Leave Request"
              value={grievanceSubject}
              onChange={(e) => setGrievanceSubject(e.target.value)}
              className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</label>
            <textarea
              required
              rows={4}
              placeholder="Describe your issue in detail. If reporting cheating, please provide dates and details..."
              value={grievanceMessage}
              onChange={(e) => setGrievanceMessage(e.target.value)}
              className="w-full bg-[#000a18] border border-[#002a63] rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-[#D4A017] resize-none"
            />
          </div>

          {/* File evidence */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Evidence Attachment (PDF/Images - Optional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setEvidenceFile(e.target.files[0])}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#002a63] file:text-[#D4A017] hover:file:bg-[#001c44] cursor-pointer"
            />
          </div>

          {/* Anonymous Checkbox (Only allowed for Integrity Reports or Complaints) */}
          {(grievanceType === 'INTEGRITY_REPORT' || grievanceType === 'GENERAL_COMPLAINT') && (
            <div className="flex items-center gap-2 py-2 bg-rose-950/15 border border-rose-500/10 px-3.5 rounded-xl">
              <input
                type="checkbox"
                id="anonymousCheck"
                checked={grievanceAnonymous}
                onChange={(e) => setGrievanceAnonymous(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-[#000a18] border-[#002a63] cursor-pointer"
              />
              <label htmlFor="anonymousCheck" className="text-xs text-rose-400 font-bold select-none cursor-pointer">
                Submit anonymously (Hides name/index number)
              </label>
            </div>
          )}

          {/* Submit / Cancel Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submittingGrievance}
              className="flex-1 bg-[#D4A017] hover:bg-[#b88a14] disabled:opacity-50 text-slate-950 font-extrabold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              {submittingGrievance ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                'Submit Ticket'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GrievanceModal;
