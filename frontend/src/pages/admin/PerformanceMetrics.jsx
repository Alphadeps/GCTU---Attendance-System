import { useState, useEffect } from 'react';
import axios from 'axios';

const PerformanceMetrics = () => {
  const [metricsData, setMetricsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await axios.get(`${API_BASE_URL}/monitoring/metrics`, config);
      setMetricsData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceColor = (avgTime) => {
    const time = parseFloat(avgTime);
    if (time < 100) return 'text-green-600';
    if (time < 500) return 'text-yellow-600';
    if (time < 1000) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPerformanceBg = (avgTime) => {
    const time = parseFloat(avgTime);
    if (time < 100) return 'bg-green-50 border-green-200';
    if (time < 500) return 'bg-yellow-50 border-yellow-200';
    if (time < 1000) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E5A93C]"></div>
      </div>
    );
  }

  if (!metricsData) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No performance metrics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Performance Metrics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Monitor endpoint performance, response times, and system efficiency
          </p>
        </div>
        <div className="flex items-center gap-4">
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
            onClick={fetchMetrics}
            className="px-4 py-2 bg-[#0c2340] text-white rounded-lg hover:bg-[#1a3c6d] text-sm font-semibold transition-colors"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Avg Response Time</div>
          <div className={`text-3xl font-bold ${getPerformanceColor(metricsData.performance.avgResponseTime)}`}>
            {metricsData.performance.avgResponseTime}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {parseFloat(metricsData.performance.avgResponseTime) < 500 ? '✓ Excellent' : 
             parseFloat(metricsData.performance.avgResponseTime) < 1000 ? '⚠ Acceptable' : '✗ Needs Attention'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Total Requests</div>
          <div className="text-3xl font-bold text-gray-800">
            {metricsData.requests.total.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {metricsData.requests.success.toLocaleString()} successful
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Error Rate</div>
          <div className={`text-3xl font-bold ${parseFloat(metricsData.requests.errorRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
            {metricsData.requests.errorRate}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {metricsData.requests.errors} errors
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">System Uptime</div>
          <div className="text-3xl font-bold text-gray-800">
            {metricsData.uptime.hours}h {metricsData.uptime.minutes % 60}m
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {metricsData.uptime.seconds.toLocaleString()} seconds
          </div>
        </div>
      </div>

      {/* Slowest Endpoints */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🐌</span>
          Slowest Endpoints (Top 10)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Endpoint</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Requests</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Avg Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Errors</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metricsData.endpoints.map((endpoint, index) => (
                <tr key={index} className={`hover:bg-gray-50 ${getPerformanceBg(endpoint.avgTime)}`}>
                  <td className="px-4 py-3 text-sm font-bold text-gray-600">#{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-800">{endpoint.endpoint}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{endpoint.count}</td>
                  <td className={`px-4 py-3 text-sm font-bold ${getPerformanceColor(endpoint.avgTime)}`}>
                    {endpoint.avgTime}ms
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{endpoint.errors}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${parseFloat(endpoint.errorRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                    {endpoint.errorRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most Used Endpoints */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          Most Used Endpoints (Top 10)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Endpoint</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Requests</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Avg Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Usage %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...metricsData.endpoints]
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
                .map((endpoint, index) => {
                  const usagePercent = ((endpoint.count / metricsData.requests.total) * 100).toFixed(2);
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-gray-600">#{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-800">{endpoint.endpoint}</td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{endpoint.count}</td>
                      <td className={`px-4 py-3 text-sm font-semibold ${getPerformanceColor(endpoint.avgTime)}`}>
                        {endpoint.avgTime}ms
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{usagePercent}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Slow Queries */}
      {metricsData.performance.slowQueries && metricsData.performance.slowQueries.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            Recent Slow Queries (Last 10)
          </h3>
          <div className="space-y-2">
            {metricsData.performance.slowQueries.map((query, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm text-gray-800 font-semibold">{query.endpoint}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(query.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">{formatDuration(query.duration)}</div>
                    <div className="text-xs text-gray-500">Response Time</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    query.statusCode >= 500 ? 'bg-red-100 text-red-700' :
                    query.statusCode >= 400 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {query.statusCode}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Time Distribution */}
      {metricsData.performance.recentResponseTimes && metricsData.performance.recentResponseTimes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Recent Response Times (Last 20 Requests)
          </h3>
          <div className="space-y-2">
            {metricsData.performance.recentResponseTimes.map((response, index) => {
              const barWidth = Math.min((response.duration / 2000) * 100, 100);
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-32 text-xs text-gray-600 font-mono truncate" title={response.endpoint}>
                    {response.endpoint}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        response.duration < 100 ? 'bg-green-500' :
                        response.duration < 500 ? 'bg-yellow-500' :
                        response.duration < 1000 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span className="text-xs font-semibold text-gray-700">
                        {response.duration}ms
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Code Distribution */}
      {metricsData.requests.statusCodes && Object.keys(metricsData.requests.statusCodes).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Status Code Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metricsData.requests.statusCodes)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([code, count]) => {
                const percentage = ((count / metricsData.requests.total) * 100).toFixed(1);
                const codeNum = parseInt(code);
                const colorClass = 
                  codeNum >= 500 ? 'bg-red-100 border-red-300 text-red-700' :
                  codeNum >= 400 ? 'bg-yellow-100 border-yellow-300 text-yellow-700' :
                  codeNum >= 300 ? 'bg-blue-100 border-blue-300 text-blue-700' :
                  'bg-green-100 border-green-300 text-green-700';
                
                return (
                  <div key={code} className={`rounded-lg border-2 p-4 ${colorClass}`}>
                    <div className="text-2xl font-bold">{code}</div>
                    <div className="text-sm font-semibold mt-1">{count} requests</div>
                    <div className="text-xs mt-1">{percentage}%</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* System Memory */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">💾</span>
          Memory Usage
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Heap Used</div>
            <div className="text-2xl font-bold text-gray-800">{metricsData.system.memory.used}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Heap Total</div>
            <div className="text-2xl font-bold text-gray-800">{metricsData.system.memory.total}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">External</div>
            <div className="text-2xl font-bold text-gray-800">{metricsData.system.memory.external}</div>
          </div>
        </div>
      </div>

      {/* Last Error */}
      {metricsData.system.lastError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-red-700 flex items-center gap-2">
            <span className="text-2xl">❌</span>
            Last Error
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Endpoint:</span>
              <span className="font-mono text-sm font-semibold text-gray-800">{metricsData.system.lastError.endpoint}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Time:</span>
              <span className="text-sm text-gray-800">{new Date(metricsData.system.lastError.timestamp).toLocaleString()}</span>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-1">Message:</div>
              <div className="bg-white border border-red-300 rounded p-3 text-sm text-red-700 font-mono">
                {metricsData.system.lastError.message}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMetrics;
