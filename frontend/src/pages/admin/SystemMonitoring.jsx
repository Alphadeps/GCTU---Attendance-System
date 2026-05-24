import { useState, useEffect } from 'react';
import axios from 'axios';

const SystemMonitoring = () => {
  const [healthData, setHealthData] = useState(null);
  const [metricsData, setMetricsData] = useState(null);
  const [databaseData, setDatabaseData] = useState(null);
  const [cacheData, setCacheData] = useState(null);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [suspiciousIPs, setSuspiciousIPs] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  const fetchAllData = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const [health, metrics, database, cache, blocked, suspicious, system] = await Promise.all([
        axios.get(`${API_BASE_URL}/monitoring/health`, config),
        axios.get(`${API_BASE_URL}/monitoring/metrics`, config),
        axios.get(`${API_BASE_URL}/monitoring/database`, config),
        axios.get(`${API_BASE_URL}/monitoring/cache`, config),
        axios.get(`${API_BASE_URL}/monitoring/security/blocked-ips`, config),
        axios.get(`${API_BASE_URL}/monitoring/security/suspicious-ips`, config),
        axios.get(`${API_BASE_URL}/monitoring/system`, config)
      ]);

      setHealthData(health.data);
      setMetricsData(metrics.data);
      setDatabaseData(database.data);
      setCacheData(cache.data);
      setBlockedIPs(blocked.data.ips || []);
      setSuspiciousIPs(suspicious.data.ips || []);
      setSystemInfo(system.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleUnblockIP = async (ip) => {
    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      await axios.post(
        `${API_BASE_URL}/monitoring/security/unblock-ip`,
        { ip },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`IP ${ip} has been unblocked`);
      fetchAllData();
    } catch (error) {
      alert('Failed to unblock IP: ' + error.response?.data?.error);
    }
  };

  const getHealthColor = (status) => {
    if (status === 'healthy') return 'bg-green-500';
    if (status === 'degraded') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getHealthText = (status) => {
    if (status === 'healthy') return 'Healthy';
    if (status === 'degraded') return 'Degraded';
    return 'Unhealthy';
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">System Monitoring</h2>
        <div className="flex items-center gap-4">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg"
          >
            <option value={10000}>Refresh: 10s</option>
            <option value={30000}>Refresh: 30s</option>
            <option value={60000}>Refresh: 1m</option>
            <option value={300000}>Refresh: 5m</option>
          </select>
          <button
            onClick={fetchAllData}
            className="px-4 py-2 bg-[#0c2340] text-white font-bold rounded-lg hover:bg-[#1a3c6d] transition-colors"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Health Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">System Health</h3>
        <div className="flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full ${getHealthColor(healthData?.status)} animate-pulse`}></div>
          <span className="text-2xl font-bold">{getHealthText(healthData?.status)}</span>
        </div>
        {healthData?.issues && healthData.issues.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="font-semibold text-yellow-800">Issues Detected:</p>
            <ul className="list-disc list-inside mt-2 text-yellow-700">
              {healthData.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Uptime */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Uptime</div>
          <div className="text-2xl font-bold text-gray-800">
            {metricsData?.uptime?.hours || 0}h {metricsData?.uptime?.minutes % 60 || 0}m
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Total Requests</div>
          <div className="text-2xl font-bold text-gray-800">
            {metricsData?.requests?.total?.toLocaleString() || 0}
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Error Rate</div>
          <div className={`text-2xl font-bold ${parseFloat(metricsData?.requests?.errorRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
            {metricsData?.requests?.errorRate || '0%'}
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600 mb-2">Avg Response Time</div>
          <div className={`text-2xl font-bold ${parseFloat(metricsData?.performance?.avgResponseTime) > 1000 ? 'text-red-600' : 'text-green-600'}`}>
            {metricsData?.performance?.avgResponseTime || '0ms'}
          </div>
        </div>
      </div>

      {/* Database & Cache Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Database Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold ${databaseData?.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {databaseData?.status === 'connected' ? '✓ Connected' : '✗ Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Query Time:</span>
              <span className="font-semibold">{databaseData?.queryTime || 'N/A'}</span>
            </div>
            {databaseData?.stats && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">Users:</span>
                  <span className="font-semibold">{databaseData.stats.users}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Students:</span>
                  <span className="font-semibold">{databaseData.stats.students}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Classes:</span>
                  <span className="font-semibold">{databaseData.stats.classes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sessions:</span>
                  <span className="font-semibold">{databaseData.stats.sessions}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cache Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Redis Cache Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold ${cacheData?.enabled ? (cacheData?.connected ? 'text-green-600' : 'text-yellow-600') : 'text-gray-600'}`}>
                {cacheData?.enabled ? (cacheData?.connected ? '✓ Connected' : '⚠ Disconnected') : 'Disabled'}
              </span>
            </div>
            {!cacheData?.enabled && (
              <div className="text-sm text-gray-500 italic">
                Redis is not configured. System will work but slower.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Information */}
      {systemInfo && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">System Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Node Version</div>
              <div className="font-semibold">{systemInfo.node?.version}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Platform</div>
              <div className="font-semibold">{systemInfo.node?.platform}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Architecture</div>
              <div className="font-semibold">{systemInfo.node?.arch}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Memory Used</div>
              <div className="font-semibold">{systemInfo.memory?.heapUsed}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Memory Total</div>
              <div className="font-semibold">{systemInfo.memory?.heapTotal}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Process Uptime</div>
              <div className="font-semibold">{systemInfo.uptime?.process}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Endpoints Performance */}
      {metricsData?.endpoints && metricsData.endpoints.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Top Endpoints (by avg response time)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Endpoint</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Requests</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Avg Time</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Errors</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Error Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metricsData.endpoints.slice(0, 10).map((endpoint, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-800">{endpoint.endpoint}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{endpoint.count}</td>
                    <td className={`px-4 py-2 text-sm font-semibold ${parseFloat(endpoint.avgTime) > 1000 ? 'text-red-600' : 'text-green-600'}`}>
                      {endpoint.avgTime}ms
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{endpoint.errors}</td>
                    <td className={`px-4 py-2 text-sm font-semibold ${parseFloat(endpoint.errorRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                      {endpoint.errorRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blocked IPs */}
      {blockedIPs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 text-red-600">Blocked IP Addresses ({blockedIPs.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">IP Address</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Blocked At</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Expires At</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Remaining</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {blockedIPs.map((blocked, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono text-gray-800">{blocked.ip}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(blocked.blockedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(blocked.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {Math.ceil(blocked.remainingSeconds / 60)} min
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleUnblockIP(blocked.ip)}
                        className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors font-semibold"
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suspicious IPs */}
      {suspiciousIPs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 text-yellow-600">Suspicious IP Addresses ({suspiciousIPs.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-yellow-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">IP Address</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Violations</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">First Seen</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suspiciousIPs.map((suspicious, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono text-gray-800">{suspicious.ip}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-red-600">{suspicious.violations}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(suspicious.firstSeen).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(suspicious.lastSeen).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Issues Message */}
      {blockedIPs.length === 0 && suspiciousIPs.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800 font-semibold">✓ No security issues detected</p>
          <p className="text-green-600 text-sm mt-2">All IP addresses are behaving normally</p>
        </div>
      )}
    </div>
  );
};

export default SystemMonitoring;
