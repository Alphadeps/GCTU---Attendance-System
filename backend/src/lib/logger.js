/**
 * Comprehensive Logging System
 * 
 * Features:
 * - Multiple log levels (error, warn, info, debug)
 * - Daily rotating log files
 * - Separate files for different log types
 * - JSON formatting for easy parsing
 * - Console output in development
 * - Audit trail for critical operations
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists (skip in production if filesystem is read-only)
const logsDir = path.join(__dirname, '../../logs');
let logsEnabled = true;

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.warn('Unable to create logs directory (read-only filesystem). File logging disabled.');
  logsEnabled = false;
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  })
);

// File transports (only if logs directory is writable)
if (logsEnabled) {
  // Error log file (all errors)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  );

  // Combined log file (all logs)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  );
}

// Audit log file (critical operations) - only if logs enabled
const auditTransport = logsEnabled ? new DailyRotateFile({
  filename: path.join(logsDir, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  format: fileFormat,
  maxSize: '20m',
  maxFiles: '90d', // Keep audit logs for 90 days
  zippedArchive: true
}) : null;

// Security log file (security events) - only if logs enabled
const securityTransport = logsEnabled ? new DailyRotateFile({
  filename: path.join(logsDir, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  format: fileFormat,
  maxSize: '20m',
  maxFiles: '90d',
  zippedArchive: true
}) : null;

// Create main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
  exitOnError: false
});

// Create audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  transports: auditTransport ? [auditTransport] : [new winston.transports.Console({ format: consoleFormat })],
  exitOnError: false
});

// Create security logger
const securityLogger = winston.createLogger({
  level: 'info',
  transports: securityTransport ? [securityTransport] : [new winston.transports.Console({ format: consoleFormat })],
  exitOnError: false
});

/**
 * Log levels:
 * - error: Error messages
 * - warn: Warning messages
 * - info: Informational messages
 * - debug: Debug messages
 */

/**
 * Audit logging for critical operations
 */
function logAudit(action, details) {
  auditLogger.info({
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Security event logging
 */
function logSecurity(event, details) {
  securityLogger.info({
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
}

/**
 * HTTP request logging middleware
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    user: req.user?.username || 'anonymous'
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('HTTP Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      user: req.user?.username || 'anonymous'
    });
  });
  
  next();
}

/**
 * Audit trail middleware for critical operations
 */
function auditMiddleware(action) {
  return (req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    
    // Override send to log after response
    res.send = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAudit(action, {
          user: req.user?.username || 'anonymous',
          userId: req.user?.id,
          ip: req.ip,
          method: req.method,
          url: req.url,
          body: sanitizeBody(req.body),
          params: req.params,
          statusCode: res.statusCode
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Sanitize request body (remove sensitive data)
 */
function sanitizeBody(body) {
  if (!body) return {};
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Database query logging
 */
function logDatabaseQuery(query, duration, error = null) {
  if (error) {
    logger.error('Database Query Failed', {
      query: query.substring(0, 200), // Limit query length
      duration: `${duration}ms`,
      error: error.message
    });
  } else if (duration > 1000) {
    // Log slow queries
    logger.warn('Slow Database Query', {
      query: query.substring(0, 200),
      duration: `${duration}ms`
    });
  } else {
    logger.debug('Database Query', {
      query: query.substring(0, 200),
      duration: `${duration}ms`
    });
  }
}

/**
 * Authentication event logging
 */
function logAuthEvent(event, details) {
  const logData = {
    event,
    ...details,
    timestamp: new Date().toISOString()
  };
  
  // Log to both security and audit logs
  logSecurity(event, details);
  
  if (event === 'LOGIN_SUCCESS' || event === 'LOGIN_FAILED') {
    logger.info(`Authentication: ${event}`, logData);
  }
}

/**
 * Error logging with context
 */
function logError(error, context = {}) {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    ...context,
    timestamp: new Date().toISOString()
  });
}

/**
 * Performance logging
 */
function logPerformance(operation, duration, metadata = {}) {
  const logLevel = duration > 5000 ? 'warn' : 'info';
  
  logger[logLevel]('Performance', {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
}

/**
 * Business event logging
 */
function logBusinessEvent(event, details) {
  logger.info('Business Event', {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get log statistics
 */
async function getLogStats() {
  const stats = {
    logFiles: [],
    totalSize: 0
  };
  
  try {
    const files = fs.readdirSync(logsDir);
    
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stat = fs.statSync(filePath);
      
      stats.logFiles.push({
        name: file,
        size: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
        modified: stat.mtime
      });
      
      stats.totalSize += stat.size;
    }
    
    stats.totalSize = `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`;
  } catch (error) {
    logger.error('Failed to get log stats:', error);
  }
  
  return stats;
}

/**
 * Clean old log files
 */
async function cleanOldLogs(daysToKeep = 30) {
  try {
    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stat = fs.statSync(filePath);
      
      if (now - stat.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.info(`Deleted old log file: ${file}`);
      }
    }
    
    return { deletedCount, message: `Deleted ${deletedCount} old log files` };
  } catch (error) {
    logger.error('Failed to clean old logs:', error);
    return { error: error.message };
  }
}

// Export loggers and functions
module.exports = {
  logger,
  auditLogger,
  securityLogger,
  logAudit,
  logSecurity,
  requestLogger,
  auditMiddleware,
  logDatabaseQuery,
  logAuthEvent,
  logError,
  logPerformance,
  logBusinessEvent,
  getLogStats,
  cleanOldLogs
};
