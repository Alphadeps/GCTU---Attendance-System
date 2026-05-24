import { useState } from 'react';
import api from '../../../services/api';

const AddCourseModal = ({ onClose, onSaved }) => {
  const [newCourse, setNewCourse] = useState({ name: '', code: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/courses', newCourse);
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
        <h3 className="text-lg font-bold text-[#344767] mb-4">Add Global Course</h3>
        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-[#8392ab] mb-1.5">Course Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Web Development"
              value={newCourse.name}
              onChange={(e) => setNewCourse(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#0c2340] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#8392ab] mb-1.5">Course Code</label>
            <input
              type="text"
              required
              placeholder="e.g. BIT 302"
              value={newCourse.code}
              onChange={(e) => setNewCourse(prev => ({ ...prev, code: e.target.value }))}
              className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#0c2340] font-mono transition-colors"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-semibold text-[#8392ab] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-[#0c2340] hover:bg-[#1a3c6d] rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCourseModal;
