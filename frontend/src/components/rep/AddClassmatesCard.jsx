import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../ToastProvider';

// Rep tools for getting classmates into the system:
// 1) share a join code/link (students register themselves), 2) upload a class list file.
const COMPACT_BTN = { width: 'auto', padding: '9px 16px', fontSize: 11 };

const AddClassmatesCard = ({ onStudentsChanged, onConfirm }) => {
  const toast = useToast();
  const [joinCode, setJoinCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);

  const joinLink = joinCode ? `${window.location.origin}/join/${joinCode}` : '';

  useEffect(() => {
    api.get('/admin/rep/join-code')
      .then(res => setJoinCode(res.data.joinCode))
      .catch(err => toast.error(err.response?.data?.error || 'Could not load your class join code'))
      .finally(() => setCodeLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      toast.success('Join link copied. Paste it in your class group.', 'Copied');
    } catch {
      toast.warning(`Copy this link: ${joinLink}`);
    }
  };

  const shareOnWhatsApp = () => {
    const text = `Join our class on the GCTU attendance system: ${joinLink} (join code: ${joinCode})`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const regenerate = () => {
    onConfirm('Create a new join code? The old code and link will stop working. Students already in your class are not affected.', async () => {
      setRegenerating(true);
      try {
        const res = await api.post('/admin/rep/join-code/regenerate');
        setJoinCode(res.data.joinCode);
        toast.success('New join code created. Share the new link with your class.');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not create a new code');
      } finally {
        setRegenerating(false);
      }
    });
  };

  const parseFile = async (selected) => {
    setFile(selected);
    setPreview([]);
    if (!selected) return;
    setParsing(true);
    const formData = new FormData();
    formData.append('file', selected);
    try {
      const res = await api.post('/admin/rep/parse-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const students = res.data.students || [];
      setPreview(students);
      if (students.length === 0) toast.warning('No students found in that file. Check it has index numbers and names.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not read that file');
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const importStudents = async () => {
    setImporting(true);
    try {
      const res = await api.post('/admin/rep/students', { students: preview });
      const { addedCount = 0, skippedCount = 0 } = res.data;
      toast.success(
        skippedCount > 0 ? `${addedCount} added, ${skippedCount} skipped (check the file for errors).` : `${addedCount} students added to your class.`,
        'Class List Uploaded'
      );
      setPreview([]);
      setFile(null);
      onStudentsChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add students');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Join code */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,.08)]">
        <p className="text-[13px] font-bold text-[#344767]">Invite classmates</p>
        <p className="text-[11px] text-[#8392ab] mb-4">Share this link in your class group. Classmates open it and register with their index number.</p>
        {codeLoading ? (
          <div className="skeleton h-12 rounded-xl" />
        ) : joinCode ? (
          <>
            <div className="flex items-center justify-between bg-[#f8f9fa] border border-gray-100 rounded-xl px-4 py-3 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8392ab]">Join code</span>
              <span className="font-mono text-xl font-black tracking-[0.3em] text-[#344767]">{joinCode}</span>
            </div>
            <p className="text-[11px] text-[#8392ab] break-all mb-3">{joinLink}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={shareOnWhatsApp} className="sip-btn-primary" style={COMPACT_BTN}>Share on WhatsApp</button>
              <button type="button" onClick={copyLink} className="sip-btn-dark" style={COMPACT_BTN}>Copy link</button>
              <button type="button" onClick={regenerate} disabled={regenerating} className="px-3 py-2 text-[12px] font-semibold text-[#8392ab] hover:text-[#344767]">
                {regenerating ? 'Creating…' : 'New code'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-[12px] text-red-500">Join code unavailable.</p>
        )}
      </div>

      {/* Class list upload */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,.08)]">
        <p className="text-[13px] font-bold text-[#344767]">Upload class list</p>
        <p className="text-[11px] text-[#8392ab] mb-4">Have the list from the department? Upload an Excel, CSV or PDF file with index numbers and names.</p>
        <label
          htmlFor="rep-class-list"
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-colors ${
            file ? 'border-emerald-400 bg-emerald-50' : 'border-[#e9ecef] hover:border-[#E5A93C] bg-[#f8f9fa]'
          }`}
        >
          <input
            id="rep-class-list"
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            className="hidden"
            onChange={(e) => parseFile(e.target.files?.[0] || null)}
          />
          <span className="text-[12px] font-semibold text-[#344767] break-all text-center">
            {parsing ? 'Reading file…' : file ? file.name : 'Tap to choose a file'}
          </span>
          <span className="text-[10px] text-[#8392ab] mt-1">.xlsx, .xls, .csv or .pdf · max 5 MB</span>
        </label>
        {preview.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[12px] text-[#344767]"><strong>{preview.length}</strong> students found</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPreview([]); setFile(null); }} className="px-3 py-2 text-[12px] font-semibold text-[#8392ab] hover:text-[#344767]">Cancel</button>
              <button type="button" onClick={importStudents} disabled={importing} className="sip-btn-dark" style={COMPACT_BTN}>
                {importing ? 'Adding…' : `Add ${preview.length} students`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddClassmatesCard;
