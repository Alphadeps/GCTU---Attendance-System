import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function ReportSettings() {
  const [template, setTemplate] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchActiveTemplate = async () => {
    try {
      const res = await api.get('/reports/template');
      setTemplate(res.data);
    } catch (err) {
      console.error('Failed to fetch template', err);
    }
  };

  useEffect(() => {
    fetchActiveTemplate();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('template', file);

    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/reports/template', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTemplate(res.data);
      setMessage('Template uploaded successfully!');
      setFile(null);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-[#0c2340] mb-2">Master Report Template</h2>
        <p className="text-[#8392ab] text-sm mb-6">
          Upload a `.docx` file containing specific placeholders for the class attendance reports.
        </p>

        {template && (
          <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <h3 className="text-emerald-800 font-bold mb-1">Active Template</h3>
            <p className="text-[#344767] text-sm flex items-center gap-2 font-medium">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {template.name} (Uploaded: {new Date(template.createdAt).toLocaleDateString()})
            </p>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#E5A93C] transition">
            <input
              type="file"
              accept=".docx"
              id="template-upload"
              className="hidden"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <label htmlFor="template-upload" className="cursor-pointer flex flex-col items-center">
              <svg className="w-10 h-10 text-[#0c2340] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-[#344767] font-medium">{file ? file.name : 'Click to browse for .docx file'}</span>
            </label>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm font-semibold border ${message.includes('success') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full bg-[#0c2340] hover:bg-[#113057] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
          >
            {loading ? 'Uploading...' : 'Upload Master Template'}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-[#0c2340] mb-4">Tagging Guide</h3>
        <ul className="text-sm text-[#344767] space-y-3 list-disc pl-5">
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{courseName}"}</code> - Name of the course</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{courseCode}"}</code> - Course Code</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{className}"}</code> - Full Class Name</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{level}"}</code> - Class Level</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{group}"}</code> - Class Group</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{repName}"}</code> - Name of the Class Rep</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{totalSessions}"}</code> - Total number of lectures</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{#students}"}</code> - Starts the student table loop</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{name}"}</code>, <code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{indexNumber}"}</code>, <code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{rate}"}</code>, <code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{status}"}</code> - Student row data</li>
          <li><code className="bg-gray-100 text-[#0c2340] px-1.5 py-0.5 rounded font-mono">{"{/students}"}</code> - Ends the student table loop</li>
        </ul>
      </div>
    </div>
  );
}
