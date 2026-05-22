import { useState, useEffect } from 'react';
import axios from 'axios';

const SecurityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'audit', 'security'
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { 
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit: pagination.limit,
          offset: pagination.offset,
          search: search,
          type: filter
        }
      };

      const response = await axios.get('http://localhost:5000/api/monitoring/logs/all', config);
      
      setLogs(response.data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total || 0
      }));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.offset, pagination.limit, filter]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, offset: 0 }));
    fetchLogs();
  };

  const handleNextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
    }
  };

  const getLogIcon = (log) => {
    if (log.type === 'security') {
      if (log.event?.includes('FAILED') || log.event?.includes('BLOCKED')) {
        return '🔴';
      }
      if (log.event?.includes('SUCCESS')) {
        return '🟢';
      }
      return '🔒';
    }
    
    if (log.type === 'audit') {
      if (log.action?.includes('DELETE')) {
        return '🗑️';
      }
      if (log.action?.includes('CREATE') || log.action?.includes('ADD')) {
        return '➕';
      }
      if (log.action?.includes('UPDATE') || log.action?.includes('EDIT')) {
        return '✏️';
      }
      if (log.action?.includes('UPLOAD')) {
        return '📤';
      }
      if (log.action?.includes('APPROVE')) {
        return '✅';
      }
      return '📋';
    }
    
    return '📝';
  };

  const getLogColor = (log) => {
    if (log.type === 'security') {
      if (log.event?.includes('FAILED') || log.event?.includes('BLOCKED')) {
        return 'bg-red-50 border-red-200';
      }
      if (log.event?.includes('SUCCESS')) {
        return 'bg-green-50 border-green-200';
      }
      return 'bg-yellow-50 border-yellow-200';
    }
    
    if (log.type === 'audit') {
      if (log.action?.includes('DELETE')) {
        return 'bg-red-50 border-red-200';
      }
      return 'bg-blue-50 border-blue-200';
    }
    
    return 'bg-gray-50 border-gray-200';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLogTitle = (log) => {
    if (log.type === 'security') {
      return log.event || 'Security Event';
    }
    if (log.type === 'audit') {
      return log.action || 'Audit Action';
    }
    return 'Log Entry';
  };

  const getLogDetails = (log) => {
    const details = [];
    
    if (log.user) details.push(`User: ${log.user}`);
    if (log.username) details.push(`User: ${log.username}`);
    if (log.ip) details.push(`IP: ${log.ip}`);
    if (log.method) details.push(`Method: ${log.method}`);
    if (log.url) details.push(`URL: ${log.url}`);
    if (log.statusCode) details.push(`Status: ${log.statusCode}`);
    if (log.reason) details.push(`Reason: ${log.reason}`);
    if (log.message) details.push(`Message: ${log.message}`);
    
    return details;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Security & Audit Logs</h2>
          <p className="text-sm text-gray-600 mt-1">
            Monitor system activities, login attempts, and critical operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700">Auto-refresh</span>
          </label>
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
            </select>
          )}
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Type Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Logs
            </button>
            <button
              onClick={() => setFilter('audit')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filter === 'audit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Audit Trail
            </button>
            <button
              onClick={() => setFilter('security')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filter === 'security'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Security Events
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs (user, IP, action, event)..."
              className="flex-1 px-4 py-2 border rounded-lg text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm font-semibold"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600 mb-1">Total Logs</div>
          <div className="text-2xl font-bold text-gray-800">{pagination.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600 mb-1">Showing</div>
          <div className="text-2xl font-bold text-gray-800">{logs.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600 mb-1">Current Page</div>
          <div className="text-2xl font-bold text-gray-800">{currentPage} / {totalPages}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600 mb-1">Filter</div>
          <div className="text-2xl font-bold text-gray-800 capitalize">{filter}</div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-semibold mb-2">No logs found</p>
            <p className="text-sm">Try adjusting your filters or search criteria</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`p-4 hover:bg-gray-50 transition border-l-4 ${getLogColor(log)}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-2xl flex-shrink-0 mt-1">
                    {getLogIcon(log)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-800 text-sm">
                          {getLogTitle(log)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(log.timestamp)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.type === 'security' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {log.type?.toUpperCase()}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      {getLogDetails(log).map((detail, idx) => (
                        <span key={idx} className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {detail}
                        </span>
                      ))}
                    </div>

                    {/* Additional Data */}
                    {(log.body || log.params) && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify({ body: log.body, params: log.params }, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-between items-center bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">
            Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} logs
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={pagination.offset === 0}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={pagination.offset + pagination.limit >= pagination.total}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityLogs;
