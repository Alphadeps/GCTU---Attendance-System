/**
 * Error Recovery Middleware
 * 
 * Features:
 * - Database transaction management
 * - Automatic rollback on errors
 * - Retry logic for transient failures
 * - User-friendly error messages
 * - Error logging and tracking
 */

const prisma = require('../lib/prisma');

/**
 * Transaction wrapper with automatic rollback
 */
async function withTransaction(callback) {
  return await prisma.$transaction(async (tx) => {
    try {
      return await callback(tx);
    } catch (error) {
      // Transaction will automatically rollback
      console.error('Transaction failed, rolling back:', error.message);
      throw error;
    }
  }, {
    maxWait: 5000, // Maximum time to wait for a transaction slot (5s)
    timeout: 30000, // Maximum time for transaction to complete (30s)
    isolationLevel: 'ReadCommitted' // Isolation level
  });
}

/**
 * Retry wrapper for transient failures
 */
async function withRetry(operation, options = {}) {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = 'exponential', // 'exponential' or 'linear'
    retryableErrors = ['P2034', 'P2024', 'P1001', 'P1002'] // Prisma error codes
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = retryableErrors.some(code => 
        error.code === code || error.message.includes(code)
      );
      
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }
      
      // Calculate delay
      const delay = backoff === 'exponential' 
        ? delayMs * Math.pow(2, attempt - 1)
        : delayMs * attempt;
      
      console.warn(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`, error.message);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Idempotency key middleware
 * Prevents duplicate operations
 */
const idempotencyKeys = new Map();

function idempotencyMiddleware(req, res, next) {
  // Only apply to POST, PUT, PATCH, DELETE
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  
  const idempotencyKey = req.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }
  
  // Check if we've seen this key before
  const cached = idempotencyKeys.get(idempotencyKey);
  
  if (cached) {
    // Return cached response
    return res.status(cached.status).json(cached.data);
  }
  
  // Store original send function
  const originalSend = res.send;
  
  // Override send to cache response
  res.send = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyKeys.set(idempotencyKey, {
        status: res.statusCode,
        data: typeof data === 'string' ? JSON.parse(data) : data,
        timestamp: Date.now()
      });
      
      // Clean up old keys after 1 hour
      setTimeout(() => {
        idempotencyKeys.delete(idempotencyKey);
      }, 60 * 60 * 1000);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Error message mapper
 * Converts technical errors to user-friendly messages
 */
function getUserFriendlyError(error) {
  // Prisma errors
  if (error.code) {
    const errorMap = {
      'P2002': 'This record already exists. Please use a different value.',
      'P2003': 'This operation cannot be completed because it references data that doesn\'t exist.',
      'P2025': 'The record you\'re trying to access doesn\'t exist.',
      'P2014': 'The operation failed due to a relationship constraint.',
      'P2034': 'The operation failed due to a database conflict. Please try again.',
      'P1001': 'Cannot connect to the database. Please try again later.',
      'P1002': 'Database connection timed out. Please try again.',
      'P1008': 'Operation timed out. Please try again.',
      'P2024': 'Connection pool timeout. The system is busy, please try again.'
    };
    
    return errorMap[error.code] || 'An unexpected error occurred. Please try again.';
  }
  
  // Validation errors
  if (error.name === 'ValidationError') {
    return 'Invalid input data. Please check your information and try again.';
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return 'Authentication failed. Please log in again.';
  }
  
  if (error.name === 'TokenExpiredError') {
    return 'Your session has expired. Please log in again.';
  }
  
  // File upload errors
  if (error.message.includes('File too large')) {
    return 'The file you\'re trying to upload is too large. Maximum size is 10MB.';
  }
  
  if (error.message.includes('Invalid file type')) {
    return 'The file type is not supported. Please upload a valid file.';
  }
  
  // Rate limiting
  if (error.message.includes('Too many requests')) {
    return 'You\'re making too many requests. Please slow down and try again later.';
  }
  
  // Default message
  return 'Something went wrong. Please try again later.';
}

/**
 * Global error handler middleware
 */
function globalErrorHandler(err, req, res, next) {
  // Log error details
  console.error('❌ Error:', {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    user: req.user?.username || 'anonymous',
    timestamp: new Date().toISOString()
  });
  
  // Determine status code
  let statusCode = err.statusCode || 500;
  
  if (err.code === 'P2002') statusCode = 409; // Conflict
  if (err.code === 'P2025') statusCode = 404; // Not found
  if (err.name === 'ValidationError') statusCode = 400; // Bad request
  if (err.name === 'UnauthorizedError') statusCode = 401; // Unauthorized
  if (err.name === 'ForbiddenError') statusCode = 403; // Forbidden
  
  // Get user-friendly message
  const userMessage = getUserFriendlyError(err);
  
  // Send response
  res.status(statusCode).json({
    error: userMessage,
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      code: err.code,
      stack: err.stack
    })
  });
}

/**
 * Async error wrapper
 * Catches async errors and passes to error handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Circuit breaker pattern
 * Prevents cascading failures
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.warn(`⚠️  Circuit breaker opened. Will retry after ${this.resetTimeout}ms`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: new Date(this.nextAttempt)
    };
  }
}

/**
 * Database health check with circuit breaker
 */
const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000 // 30 seconds
});

async function checkDatabaseHealth() {
  return await dbCircuitBreaker.execute(async () => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  });
}

/**
 * Graceful degradation middleware
 * Returns cached data if database is unavailable
 */
function gracefulDegradation(cacheKey, fallbackData = null) {
  return async (req, res, next) => {
    try {
      // Check database health
      await checkDatabaseHealth();
      next();
    } catch (error) {
      console.warn('⚠️  Database unavailable, using fallback');
      
      // Try to get cached data
      const { cache } = require('../lib/redis');
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return res.json({
          data: cached,
          warning: 'Using cached data due to temporary service issues'
        });
      }
      
      if (fallbackData) {
        return res.json({
          data: fallbackData,
          warning: 'Using fallback data due to temporary service issues'
        });
      }
      
      // No fallback available
      res.status(503).json({
        error: 'Service temporarily unavailable. Please try again later.'
      });
    }
  };
}

/**
 * Compensation transaction helper
 * For complex multi-step operations
 */
class CompensationTransaction {
  constructor() {
    this.steps = [];
    this.compensations = [];
  }
  
  addStep(operation, compensation) {
    this.steps.push(operation);
    this.compensations.push(compensation);
  }
  
  async execute() {
    const results = [];
    let stepIndex = 0;
    
    try {
      for (const step of this.steps) {
        const result = await step();
        results.push(result);
        stepIndex++;
      }
      
      return results;
    } catch (error) {
      console.error(`❌ Step ${stepIndex} failed, compensating...`);
      
      // Run compensations in reverse order
      for (let i = stepIndex - 1; i >= 0; i--) {
        try {
          await this.compensations[i](results[i]);
          console.log(`✅ Compensated step ${i}`);
        } catch (compError) {
          console.error(`❌ Compensation failed for step ${i}:`, compError.message);
        }
      }
      
      throw error;
    }
  }
}

/**
 * Example: Complex operation with compensation
 */
async function createClassWithStudentsAndRep(data) {
  const transaction = new CompensationTransaction();
  
  // Step 1: Create class
  transaction.addStep(
    async () => {
      const classRecord = await prisma.class.create({ data: data.classData });
      return classRecord;
    },
    async (classRecord) => {
      await prisma.class.delete({ where: { id: classRecord.id } });
    }
  );
  
  // Step 2: Add students
  transaction.addStep(
    async () => {
      const students = await prisma.classStudent.createMany({
        data: data.students.map(s => ({ classId: data.classData.id, studentId: s.id }))
      });
      return students;
    },
    async () => {
      await prisma.classStudent.deleteMany({ where: { classId: data.classData.id } });
    }
  );
  
  // Step 3: Assign rep
  transaction.addStep(
    async () => {
      const updated = await prisma.class.update({
        where: { id: data.classData.id },
        data: { repId: data.repId }
      });
      return updated;
    },
    async () => {
      await prisma.class.update({
        where: { id: data.classData.id },
        data: { repId: null }
      });
    }
  );
  
  return await transaction.execute();
}

module.exports = {
  withTransaction,
  withRetry,
  idempotencyMiddleware,
  getUserFriendlyError,
  globalErrorHandler,
  asyncHandler,
  CircuitBreaker,
  dbCircuitBreaker,
  checkDatabaseHealth,
  gracefulDegradation,
  CompensationTransaction,
  createClassWithStudentsAndRep
};
