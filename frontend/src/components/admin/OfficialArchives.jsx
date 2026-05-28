import { useState, useEffect } from 'react';
import api from '../../services/api';

const ChartBarIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
  </svg>
);

export default function OfficialArchives() {
  const [groupedReports, setGroupedReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedProgrammes, setExpandedProgrammes] = useState({});
  const [expandedLevels, setExpandedLevels] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [previewReport, setPreviewReport] = useState(null);
  const [previewHTML, setPreviewHTML] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchArchives = async () => {
    try {
      const res = await api.get('/reports/archived');
      const data = res.data || {};
      setGroupedReports(data);
      // Expand first programme by default
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        setExpandedProgrammes({ [firstKey]: true });
      }
    } catch (err) {
      console.error('Failed to fetch archives', err);
      setGroupedReports({});
    } finally {
      setLoading(false);
    }
  };

  const openPreview = async (report) => {
    setPreviewReport(report);
    setLoadingPreview(true);
    
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(
        `${baseUrl}/reports/${report.id}/file?token=${token}`
      );
      
      if (response.ok) {
        const html = await response.text();
        setPreviewHTML(html);
      } else {
        setPreviewHTML('<div style="padding: 20px; text-align: center; color: #e74c3c;">Failed to load report preview</div>');
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewHTML('<div style="padding: 20px; text-align: center; color: #e74c3c;">Error loading preview</div>');
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewReport(null);
    setPreviewHTML('');
  };

  useEffect(() => {
    fetchArchives();
  }, []);

  const toggleProgramme = (programme) => {
    setExpandedProgrammes(prev => ({ ...prev, [programme]: !prev[programme] }));
  };

  const toggleLevel = (programmeLevel) => {
    setExpandedLevels(prev => ({ ...prev, [programmeLevel]: !prev[programmeLevel] }));
  };

  // Count total reports in a programme
  const countProgrammeReports = (levels) => {
    if (!levels) return 0;
    return Object.values(levels).reduce((sum, groups) => {
      if (!groups) return sum;
      return sum + Object.values(groups).reduce((gSum, reports) => gSum + (reports || []).length, 0);
    }, 0);
  };

  // Count total reports in a level
  const countLevelReports = (groups) => {
    if (!groups) return 0;
    return Object.values(groups).reduce((sum, reports) => sum + (reports || []).length, 0);
  };

  // Filter reports based on search and filters
  const getFilteredReports = () => {
    let filtered = { ...(groupedReports || {}) };

    // Filter by programme
    if (filterProgramme) {
      filtered = { [filterProgramme]: filtered[filterProgramme] || {} };
    }

    // Filter by level
    if (filterLevel) {
      filtered = Object.fromEntries(
        Object.entries(filtered).map(([prog, levels]) => [
          prog,
          { [filterLevel]: (levels || {})[filterLevel] }
        ]).filter(([, levels]) => Object.keys(levels || {}).length > 0)
      );
    }

    // Filter by search query (course name or code)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = Object.fromEntries(
        Object.entries(filtered).map(([prog, levels]) => [
          prog,
          Object.fromEntries(
            Object.entries(levels || {}).map(([level, groups]) => [
              level,
              Object.fromEntries(
                Object.entries(groups || {}).map(([group, reports]) => [
                  group,
                  (reports || []).filter(r =>
                    r.course?.name?.toLowerCase().includes(query) ||
                    r.course?.code?.toLowerCase().includes(query)
                  )
                ]).filter(([, reports]) => (reports || []).length > 0)
              )
            ]).filter(([, groups]) => Object.keys(groups || {}).length > 0)
          )
        ]).filter(([, levels]) => Object.keys(levels || {}).length > 0)
      );
    }

    return filtered;
  };

  const filteredReports = getFilteredReports();
  const programmes = Object.keys(groupedReports || {});
  const allLevels = [...new Set(Object.values(groupedReports || {}).flatMap(levels => Object.keys(levels || {})))].sort();

  if (loading) {
    return <div className="text-[#8392ab] text-center py-10">Loading archives...</div>;
  }

  if (Object.keys(groupedReports).length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
        <div className="flex justify-center mb-4">
          <svg className="w-16 h-16 text-[#0c2340]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#0c2340] mb-2">No Reports Archived Yet</h3>
        <p className="text-[#8392ab]">Archived reports will appear here once generated by reps and signed by lecturers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-black text-[#0c2340] tracking-tight flex items-center gap-2">
            <ChartBarIcon className="w-7 h-7 text-[#0c2340]" />
            <span>Official Archives</span>
          </h2>
          <p className="text-sm text-[#8392ab] mt-1">Digitally signed course attendance reports organized by programme and level.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#8392ab] mb-1.5">Search Reports</label>
            <input
              type="text"
              placeholder="Course name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f8f9fa] border border-gray-250 rounded-xl px-4 py-2 text-sm text-[#344767] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#0c2340]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8392ab] mb-1.5">Programme</label>
            <select
              value={filterProgramme}
              onChange={(e) => setFilterProgramme(e.target.value)}
              className="w-full bg-[#f8f9fa] border border-gray-250 rounded-xl px-4 py-2 text-sm text-[#344767] focus:outline-none focus:bg-white focus:border-[#0c2340]"
            >
              <option value="">All Programmes</option>
              {programmes.map(prog => (
                <option key={prog} value={prog}>{prog}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8392ab] mb-1.5">Level</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full bg-[#f8f9fa] border border-gray-250 rounded-xl px-4 py-2 text-sm text-[#344767] focus:outline-none focus:bg-white focus:border-[#0c2340]"
            >
              <option value="">All Levels</option>
              {allLevels.map(level => (
                <option key={level} value={level}>Level {level}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterProgramme('');
                setFilterLevel('');
              }}
              className="w-full bg-gray-200 hover:bg-gray-300 text-[#344767] text-sm font-semibold px-4 py-2 rounded-xl transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Hierarchical View */}
      <div className="space-y-4">
        {Object.entries(filteredReports).map(([programmeName, levels]) => {
          const totalProgrammeReports = countProgrammeReports(levels);
          const programmeKey = programmeName;

          return (
            <div key={programmeName} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Programme Level */}
              <button
                onClick={() => toggleProgramme(programmeKey)}
                className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-[#0c2340]/5 to-gray-50 hover:from-[#0c2340]/10 hover:to-gray-100 transition border-b border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-7 h-7 text-[#E5A93C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-[#0c2340]">{programmeName}</h3>
                    <p className="text-xs text-[#8392ab]">Programme</p>
                  </div>
                  <span className="text-xs bg-[#0c2340]/10 text-[#0c2340] px-3 py-1 rounded-full font-bold">
                    {totalProgrammeReports} report{totalProgrammeReports !== 1 ? 's' : ''}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-[#8392ab] transition-transform ${expandedProgrammes[programmeKey] ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Levels */}
              {expandedProgrammes[programmeKey] && (
                <div className="p-5 space-y-4 bg-gray-50/50">
                  {Object.entries(levels || {}).map(([level, groups]) => {
                    const totalLevelReports = countLevelReports(groups);
                    const levelKey = `${programmeKey}-${level}`;

                    return (
                      <div key={level} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Level Header */}
                        <button
                          onClick={() => toggleLevel(levelKey)}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100/70 transition border-b border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <h4 className="text-md font-bold text-[#0c2340]">Level {level}</h4>
                            <span className="text-xs bg-[#0c2340]/10 text-[#0c2340] px-2 py-0.5 rounded-full font-mono font-bold">
                              {totalLevelReports} report{totalLevelReports !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <svg
                            className={`w-4 h-4 text-[#8392ab] transition-transform ${expandedLevels[levelKey] ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Groups */}
                        {expandedLevels[levelKey] && (
                          <div className="p-4 space-y-4">
                            {Object.entries(groups || {}).map(([groupKey, reports]) => (
                              <div key={groupKey} className="pl-4 border-l-2 border-[#E5A93C]/40">
                                <h5 className="text-sm font-bold text-[#0c2340] mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-[#E5A93C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  Group {groupKey}
                                  <span className="text-xs text-[#8392ab] font-normal">({(reports || []).length} report{(reports || []).length !== 1 ? 's' : ''})</span>
                                </h5>
                                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                  {(reports || []).map(report => (
                                    <div 
                                      key={report.id} 
                                      onClick={() => openPreview(report)}
                                      className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-[#E5A93C] hover:shadow-lg transition duration-200 cursor-pointer group"
                                    >
                                      <div>
                                        <div className="flex justify-between items-start mb-2">
                                          <span className="text-xs font-bold px-2 py-1 bg-[#0c2340]/10 text-[#0c2340] rounded-lg group-hover:bg-[#E5A93C]/20 group-hover:text-[#E5A93C] transition">
                                            {report.course?.code || 'N/A'}
                                          </span>
                                          <span className="text-[10px] text-[#8392ab] font-bold">
                                            {report.signedAt ? new Date(report.signedAt).toLocaleDateString() : 'N/A'}
                                          </span>
                                        </div>
                                        <h6 className="text-[#344767] font-semibold text-sm line-clamp-2 mb-1 group-hover:text-[#0c2340] transition">{report.course?.name || 'Unknown Course'}</h6>
                                        <p className="text-xs text-[#8392ab]">Signed by: {report.signedBy?.username || 'Unknown'}</p>
                                      </div>

                                      <div className="mt-4 flex items-center justify-center gap-2 py-2 bg-gray-50 group-hover:bg-[#E5A93C]/10 text-[#8392ab] group-hover:text-[#E5A93C] text-xs font-bold rounded-lg border border-gray-200 group-hover:border-[#E5A93C]/30 transition">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        Click to Preview
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State for Filtered Results */}
      {Object.keys(filteredReports).length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
          <svg className="w-16 h-16 text-[#0c2340] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-bold text-[#0c2340] mb-2">No Reports Found</h3>
          <p className="text-[#8392ab] text-sm">Try adjusting your filters or search query.</p>
        </div>
      )}

      {/* Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#0c2340] to-[#1a3c6d]">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-[#E5A93C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <h3 className="text-lg font-bold text-white">{previewReport.course?.name || 'Report Preview'}</h3>
                  <p className="text-xs text-gray-300">
                    {previewReport.course?.code} • Signed by {previewReport.signedBy?.username}
                  </p>
                </div>
              </div>
              <button
                onClick={closePreview}
                className="text-white hover:text-[#E5A93C] transition p-2 rounded-lg hover:bg-white/10"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Report Preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#0c2340] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[#8392ab] font-semibold">Loading report preview...</p>
                  </div>
                </div>
              ) : (
                <div 
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: previewHTML }}
                />
              )}
            </div>

            {/* Modal Footer - Action Buttons */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closePreview}
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-[#344767] text-sm font-bold rounded-xl transition"
              >
                Close
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const token = localStorage.getItem('token');
                    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                    const url = `${baseUrl}/reports/${previewReport.id}/file`;
                    window.open(url + `?token=${token}`, '_blank');
                  }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </button>
                <button
                  onClick={() => {
                    const token = localStorage.getItem('token');
                    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                    const url = `${baseUrl}/reports/${previewReport.id}/pdf`;
                    window.open(url + `?token=${token}`, '_blank');
                  }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
