const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const { getMetrics, resetMetrics, getHealthStatus } = require('../middleware/monitoring');
const { getBlockedIPs, getSuspiciousIPs, unblockIP } = require('../middleware/rateLimiter');
const { cache } = require('../lib/redis');
const prisma = require('../lib/prisma');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const router = express.Router();

/**
 * Public health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Detailed metrics (admin only)
 */
router.get('/metrics', protect, authorizeRoles('SUPERADMIN'), (req, res) => {
  try {
    const metrics = getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset metrics (admin only)
 */
router.post('/metrics/reset', protect, authorizeRoles('SUPERADMIN'), (req, res) => {
  try {
    resetMetrics();
    res.json({ message: 'Metrics reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Database health check
 */
router.get('/database', protect, authorizeRoles('SUPERADMIN'), async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    const queryTime = Date.now() - startTime;
    
    // Get database stats
    const [
      userCount,
      studentCount,
      classCount,
      sessionCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.student.count(),
      prisma.class.count(),
      prisma.attendanceSession.count()
    ]);
    
    res.json({
      status: 'connected',
      queryTime: `${queryTime}ms`,
      stats: {
        users: userCount,
        students: studentCount,
        classes: classCount,
        sessions: sessionCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Cache health check
 */
router.get('/cache', protect, authorizeRoles('SUPERADMIN'), async (req, res) => {
  try {
    const stats = await cache.stats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      enabled: false,
      error: error.message
    });
  }
});

/**
 * Security monitoring - blocked IPs
 */
router.get('/security/blocked-ips', protect, authorizeRoles('SUPERADMIN'), (req, res) => {
  try {
    const blockedIPs = getBlockedIPs();
    res.json({
      count: blockedIPs.length,
      ips: blockedIPs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Security monitoring - suspicious IPs
 */
router.get('/security/suspicious-ips', protect, authorizeRoles('SUPERADMIN'), (req, res) => {
  try {
    const suspiciousIPs = getSuspiciousIPs();
    res.json({
      count: suspiciousIPs.length,
      ips: suspiciousIPs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Unblock an IP address
 */
router.post('/security/unblock-ip', protect, authorizeRoles('SUPERADMIN'), (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    unblockIP(ip);
    res.json({ message: `IP ${ip} has been unblocked` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * System information
 */
router.get('/system', protect, authorizeRoles('SUPERADMIN'), (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      memory: {
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`
      },
      cpu: {
        user: `${(cpuUsage.user / 1000).toFixed(2)}ms`,
        system: `${(cpuUsage.system / 1000).toFixed(2)}ms`
      },
      uptime: {
        process: `${(process.uptime() / 60).toFixed(2)} minutes`,
        system: `${(require('os').uptime() / 3600).toFixed(2)} hours`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get audit logs (paginated)
 */
router.get('/logs/audit', protect, authorizeRoles('SUPERADMIN'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, search = '' } = req.query;
    const logsDir = path.join(__dirname, '../../logs');
    
    // Get today's audit log file
    const today = new Date().toISOString().split('T')[0];
    const auditFile = path.join(logsDir, `audit-${today}.log`);
    
    if (!fs.existsSync(auditFile)) {
      return res.json({ logs: [], total: 0, message: 'No audit logs for today' });
    }
    
    const logs = await readLogFile(auditFile, parseInt(limit), parseInt(offset), search);
    
    res.json({
      logs: logs.entries,
      total: logs.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get security logs (paginated)
 */
router.get('/logs/security', protect, authorizeRoles('SUPERADMIN'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, search = '' } = req.query;
    const logsDir = path.join(__dirname, '../../logs');
    
    // Get today's security log file
    const today = new Date().toISOString().split('T')[0];
    const securityFile = path.join(logsDir, `security-${today}.log`);
    
    if (!fs.existsSync(securityFile)) {
      return res.json({ logs: [], total: 0, message: 'No security logs for today' });
    }
    
    const logs = await readLogFile(securityFile, parseInt(limit), parseInt(offset), search);
    
    res.json({
      logs: logs.entries,
      total: logs.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get combined logs (audit + security)
 */
router.get('/logs/all', protect, authorizeRoles('SUPERADMIN'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, search = '', type = 'all' } = req.query;
    const logsDir = path.join(__dirname, '../../logs');
    const today = new Date().toISOString().split('T')[0];
    
    let allLogs = [];
    
    // Read audit logs if requested
    if (type === 'all' || type === 'audit') {
      const auditFile = path.join(logsDir, `audit-${today}.log`);
      if (fs.existsSync(auditFile)) {
        const auditLogs = await readLogFile(auditFile, 1000, 0, search);
        allLogs = allLogs.concat(auditLogs.entries.map(log => ({ ...log, type: 'audit' })));
      }
    }
    
    // Read security logs if requested
    if (type === 'all' || type === 'security') {
      const securityFile = path.join(logsDir, `security-${today}.log`);
      if (fs.existsSync(securityFile)) {
        const securityLogs = await readLogFile(securityFile, 1000, 0, search);
        allLogs = allLogs.concat(securityLogs.entries.map(log => ({ ...log, type: 'security' })));
      }
    }
    
    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply pagination
    const total = allLogs.length;
    const paginatedLogs = allLogs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      logs: paginatedLogs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to read log file
 */
async function readLogFile(filePath, limit, offset, search) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let lineCount = 0;
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      try {
        const logEntry = JSON.parse(line);
        
        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          const logString = JSON.stringify(logEntry).toLowerCase();
          if (!logString.includes(searchLower)) {
            return;
          }
        }
        
        entries.push(logEntry);
        lineCount++;
      } catch (err) {
        // Skip invalid JSON lines
      }
    });
    
    rl.on('close', () => {
      // Reverse to get newest first
      entries.reverse();
      
      // Apply pagination
      const paginatedEntries = entries.slice(offset, offset + limit);
      
      resolve({
        entries: paginatedEntries,
        total: entries.length
      });
    });
    
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = router;
