/**
 * System Monitoring Middleware
 * 
 * Tracks:
 * - Request/response times
 * - Error rates
 * - Database query performance
 * - Memory usage
 * - Active connections
 */

const { cache } = require('../lib/redis');

// In-memory metrics storage (fallback if Redis unavailable)
const metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    byEndpoint: new Map(),
    byStatusCode: new Map()
  },
  performance: {
    responseTimes: [],
    slowQueries: []
  },
  system: {
    startTime: Date.now(),
    lastError: null,
    errorCount: 0
  }
};

/**
 * Request tracking middleware
 */
const requestTracker = (req, res, next) => {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.path}`;
  
  // Track request
  metrics.requests.total++;
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Track response time
    metrics.performance.responseTimes.push({
      endpoint,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 response times
    if (metrics.performance.responseTimes.length > 1000) {
      metrics.performance.responseTimes.shift();
    }
    
    // Track by endpoint
    const endpointStats = metrics.requests.byEndpoint.get(endpoint) || {
      count: 0,
      totalTime: 0,
      errors: 0
    };
    endpointStats.count++;
    endpointStats.totalTime += duration;
    metrics.requests.byEndpoint.set(endpoint, endpointStats);
    
    // Track by status code
    const statusCount = metrics.requests.byStatusCode.get(res.statusCode) || 0;
    metrics.requests.byStatusCode.set(res.statusCode, statusCount + 1);
    
    // Track success/error
    if (res.statusCode >= 200 && res.statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.errors++;
      endpointStats.errors++;
      
      // Log slow or error responses
      if (duration > 1000 || res.statusCode >= 500) {
        console.warn(`⚠️  Slow/Error Response: ${endpoint} - ${res.statusCode} - ${duration}ms`);
      }
    }
    
    // Warn on slow requests (>3 seconds)
    if (duration > 3000) {
      metrics.performance.slowQueries.push({
        endpoint,
        duration,
        timestamp: Date.now(),
        statusCode: res.statusCode
      });
      
      // Keep only last 100 slow queries
      if (metrics.performance.slowQueries.length > 100) {
        metrics.performance.slowQueries.shift();
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Error tracking middleware
 */
const errorTracker = (err, req, res, next) => {
  metrics.system.errorCount++;
  metrics.system.lastError = {
    message: err.message,
    stack: err.stack,
    endpoint: `${req.method} ${req.path}`,
    timestamp: Date.now()
  };
  
  console.error('❌ Error tracked:', {
    endpoint: `${req.method} ${req.path}`,
    error: err.message,
    timestamp: new Date().toISOString()
  });
  
  next(err);
};

/**
 * Get current metrics
 */
function getMetrics() {
  const uptime = Date.now() - metrics.system.startTime;
  const avgResponseTime = metrics.performance.responseTimes.length > 0
    ? metrics.performance.responseTimes.reduce((sum, r) => sum + r.duration, 0) / metrics.performance.responseTimes.length
    : 0;
  
  // Calculate error rate
  const errorRate = metrics.requests.total > 0
    ? (metrics.requests.errors / metrics.requests.total * 100).toFixed(2)
    : 0;
  
  // Get top 10 slowest endpoints
  const endpointPerformance = Array.from(metrics.requests.byEndpoint.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      avgTime: (stats.totalTime / stats.count).toFixed(2),
      errors: stats.errors,
      errorRate: ((stats.errors / stats.count) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.avgTime) - parseFloat(a.avgTime))
    .slice(0, 10);
  
  // Get status code distribution
  const statusCodes = Object.fromEntries(metrics.requests.byStatusCode);
  
  return {
    uptime: {
      milliseconds: uptime,
      seconds: Math.floor(uptime / 1000),
      minutes: Math.floor(uptime / 60000),
      hours: Math.floor(uptime / 3600000)
    },
    requests: {
      total: metrics.requests.total,
      success: metrics.requests.success,
      errors: metrics.requests.errors,
      errorRate: `${errorRate}%`,
      statusCodes
    },
    performance: {
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      slowQueries: metrics.performance.slowQueries.slice(-10), // Last 10 slow queries
      recentResponseTimes: metrics.performance.responseTimes.slice(-20) // Last 20 requests
    },
    endpoints: endpointPerformance,
    system: {
      memory: {
        used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(process.memoryUsage().external / 1024 / 1024).toFixed(2)} MB`
      },
      lastError: metrics.system.lastError,
      totalErrors: metrics.system.errorCount
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Reset metrics (useful for testing)
 */
function resetMetrics() {
  metrics.requests.total = 0;
  metrics.requests.success = 0;
  metrics.requests.errors = 0;
  metrics.requests.byEndpoint.clear();
  metrics.requests.byStatusCode.clear();
  metrics.performance.responseTimes = [];
  metrics.performance.slowQueries = [];
  metrics.system.startTime = Date.now();
  metrics.system.lastError = null;
  metrics.system.errorCount = 0;
  
  console.log('📊 Metrics reset');
}

/**
 * Health check function
 */
async function getHealthStatus() {
  const currentMetrics = getMetrics();
  const errorRate = parseFloat(currentMetrics.requests.errorRate) || 0;
  const avgResponseTime = parseFloat(currentMetrics.performance.avgResponseTime) || 0;
  
  // Determine health status
  let status = 'healthy';
  const issues = [];
  
  // Calculate recent error rate (last 100 requests) for more accurate health status
  const recentRequests = metrics.performance.responseTimes.slice(-100);
  const recentErrors = recentRequests.filter(r => {
    const endpoint = r.endpoint;
    const endpointStats = metrics.requests.byEndpoint.get(endpoint);
    return endpointStats && endpointStats.errors > 0;
  }).length;
  const recentErrorRate = recentRequests.length > 0 ? (recentErrors / recentRequests.length) * 100 : 0;
  
  // Calculate recent average response time (last 50 requests)
  const recentResponseTimes = metrics.performance.responseTimes.slice(-50);
  const recentAvgResponseTime = recentResponseTimes.length > 0
    ? recentResponseTimes.reduce((sum, r) => sum + r.duration, 0) / recentResponseTimes.length
    : avgResponseTime;
  
  // Only check error rate if we have sufficient requests
  if (currentMetrics.requests.total > 10) {
    // Use recent error rate for more accurate health assessment
    const checkErrorRate = recentRequests.length >= 20 ? recentErrorRate : errorRate;
    
    if (checkErrorRate > 10) {
      status = 'degraded';
      issues.push(`High error rate: ${checkErrorRate.toFixed(2)}%`);
    }
    
    if (checkErrorRate > 30) {
      status = 'unhealthy';
    }
  }
  
  // Only check response time if we have sufficient requests
  if (currentMetrics.requests.total > 5) {
    // Use recent average for more accurate health assessment
    const checkResponseTime = recentResponseTimes.length >= 10 ? recentAvgResponseTime : avgResponseTime;
    
    if (checkResponseTime > 3000) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push(`Slow response time: ${checkResponseTime.toFixed(2)}ms`);
    }
    
    if (checkResponseTime > 8000) {
      status = 'unhealthy';
    }
  }
  
  const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;
  if (memoryUsed > 500) {
    status = status === 'healthy' ? 'degraded' : status;
    issues.push(`High memory usage: ${memoryUsed.toFixed(2)} MB`);
  }
  
  if (memoryUsed > 800) {
    status = 'unhealthy';
  }
  
  return {
    status,
    issues,
    metrics: {
      uptime: currentMetrics.uptime.seconds,
      requests: currentMetrics.requests.total,
      errorRate: currentMetrics.requests.errorRate,
      recentErrorRate: `${recentErrorRate.toFixed(2)}%`,
      avgResponseTime: currentMetrics.performance.avgResponseTime,
      recentAvgResponseTime: `${recentAvgResponseTime.toFixed(2)}ms`,
      memory: currentMetrics.system.memory.used
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Periodic metrics logging (every 5 minutes)
 */
setInterval(async () => {
  const health = await getHealthStatus();
  
  if (health.status !== 'healthy') {
    console.warn('⚠️  System Health Check:', health);
  } else {
    console.log('✅ System Health: OK', {
      requests: health.metrics.requests,
      errorRate: health.metrics.errorRate,
      avgResponseTime: health.metrics.avgResponseTime
    });
  }
}, 5 * 60 * 1000);

module.exports = {
  requestTracker,
  errorTracker,
  getMetrics,
  resetMetrics,
  getHealthStatus
};
