import { useState, useEffect } from 'react';
import api from '../../../services/api';

export default function EditRepModal({ rep, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    username: '',
    indexNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (rep) {
      setFormData({
        username: rep.username || '',
        indexNumber: rep.indexNumber || ''
      });
    }
  }, [rep]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    try {
      const response = await api.patch(`/admin/reps/${rep.id}`, {
        username: formData.username,
        indexNumber: formData.indexNumber || null
      });
      onSaved(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update representative');
    } finally {
      setLoading(false);
    }
  };

  if (!rep) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-up">
        <h3 className="text-lg font-bold text-white mb-4">Edit Class Rep</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              placeholder="e.g. johndoe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Index Number
            </label>
            <input
              type="text"
              value={formData.indexNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, indexNumber: e.target.value }))}
              className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              placeholder="e.g. 10912345"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Required for rep to check in to their own sessions
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
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
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
