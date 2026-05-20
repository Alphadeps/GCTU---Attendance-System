import { useState } from 'react';
import api from '../../../services/api';

const AddProgrammeModal = ({ onClose, onSaved }) => {
  const [progName, setProgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!progName.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/programmes', { name: progName.trim() });
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add programme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
        <h3 className="text-lg font-bold text-white mb-4">Add Academic Programme</h3>
        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Programme Name</label>
            <input
              type="text"
              required
              placeholder="e.g. BSc Computer Science"
              value={progName}
              onChange={(e) => setProgName(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Programme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProgrammeModal;
