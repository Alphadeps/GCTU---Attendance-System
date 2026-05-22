/**
 * Performance Optimization Middleware
 * 
 * Features:
 * - Response compression (gzip)
 * - Pagination helpers
 * - Query optimization
 * - Response caching headers
 */

const compression = require('compression');

/**
 * Compression middleware with custom filter
 */
const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  
  // Compression level (0-9, 6 is default)
  level: 6,
  
  // Filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Use compression filter
    return compression.filter(req, res);
  }
});

/**
 * Pagination middleware
 * Adds pagination helpers to request object
 */
const paginationMiddleware = (req, res, next) => {
  // Get pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const maxLimit = 100; // Maximum items per page
  
  // Validate and sanitize
  req.pagination = {
    page: Math.max(1, page),
    limit: Math.min(Math.max(1, limit), maxLimit),
    skip: (Math.max(1, page) - 1) * Math.min(Math.max(1, limit), maxLimit)
  };
  
  // Helper function to create paginated response
  req.pagination.createResponse = (data, total) => {
    const totalPages = Math.ceil(total / req.pagination.limit);
    
    return {
      data,
      pagination: {
        page: req.pagination.page,
        limit: req.pagination.limit,
        total,
        totalPages,
        hasNext: req.pagination.page < totalPages,
        hasPrev: req.pagination.page > 1
      }
    };
  };
  
  next();
};

/**
 * Cache control headers for static resources
 */
const cacheControl = (duration = 3600) => {
  return (req, res, next) => {
    // Set cache headers
    res.set('Cache-Control', `public, max-age=${duration}`);
    res.set('Expires', new Date(Date.now() + duration * 1000).toUTCString());
    next();
  };
};

/**
 * No-cache headers for dynamic content
 */
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

/**
 * ETag support for conditional requests
 */
const etagSupport = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Generate ETag from response data
    if (data && typeof data === 'object') {
      const etag = require('crypto')
        .createHash('md5')
        .update(JSON.stringify(data))
        .digest('hex');
      
      res.set('ETag', `"${etag}"`);
      
      // Check if client has cached version
      if (req.headers['if-none-match'] === `"${etag}"`) {
        return res.status(304).end();
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Query optimization helper
 * Provides common query patterns
 */
const queryOptimization = {
  /**
   * Select only necessary fields
   */
  selectFields: (fields) => {
    const select = {};
    fields.forEach(field => {
      select[field] = true;
    });
    return select;
  },
  
  /**
   * Common pagination query
   */
  paginatedQuery: (req, additionalOptions = {}) => {
    return {
      skip: req.pagination.skip,
      take: req.pagination.limit,
      ...additionalOptions
    };
  },
  
  /**
   * Search query builder
   */
  searchQuery: (searchTerm, fields) => {
    if (!searchTerm) return {};
    
    return {
      OR: fields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      }))
    };
  },
  
  /**
   * Date range query
   */
  dateRangeQuery: (field, startDate, endDate) => {
    const query = {};
    
    if (startDate) {
      query.gte = new Date(startDate);
    }
    
    if (endDate) {
      query.lte = new Date(endDate);
    }
    
    return query.gte || query.lte ? { [field]: query } : {};
  }
};

/**
 * Response time tracking
 */
const responseTimeHeader = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.send to set header before sending
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    // Only set header if headers haven't been sent yet
    if (!res.headersSent) {
      res.set('X-Response-Time', `${duration}ms`);
    }
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Lazy loading helper for large datasets
 */
const lazyLoadingSupport = (req, res, next) => {
  // Add cursor-based pagination support
  req.cursor = {
    after: req.query.after,
    before: req.query.before,
    limit: parseInt(req.query.limit) || 50
  };
  
  // Helper to create cursor-based response
  req.cursor.createResponse = (data, hasMore) => {
    const response = {
      data,
      hasMore
    };
    
    if (data.length > 0) {
      response.nextCursor = data[data.length - 1].id;
    }
    
    return response;
  };
  
  next();
};

/**
 * Batch request support
 */
const batchRequestSupport = async (req, res, next) => {
  // Check if this is a batch request
  if (!req.body.batch || !Array.isArray(req.body.batch)) {
    return next();
  }
  
  // Process batch requests
  const results = [];
  
  for (const request of req.body.batch) {
    try {
      // Execute each request
      // This is a simplified version - implement based on your needs
      results.push({
        success: true,
        data: request
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message
      });
    }
  }
  
  return res.json({ results });
};

/**
 * Field filtering support
 * Allows clients to request specific fields only
 */
const fieldFilteringSupport = (req, res, next) => {
  // Parse fields parameter
  if (req.query.fields) {
    req.fields = req.query.fields.split(',').map(f => f.trim());
  }
  
  // Helper to filter response data
  req.filterFields = (data) => {
    if (!req.fields || req.fields.length === 0) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => filterObject(item, req.fields));
    }
    
    return filterObject(data, req.fields);
  };
  
  next();
};

/**
 * Filter object to include only specified fields
 */
function filterObject(obj, fields) {
  const filtered = {};
  
  fields.forEach(field => {
    if (obj.hasOwnProperty(field)) {
      filtered[field] = obj[field];
    }
  });
  
  return filtered;
}

/**
 * Database connection pooling optimization
 */
const optimizeConnectionPool = (prisma) => {
  // Middleware to ensure connections are released
  return async (req, res, next) => {
    res.on('finish', async () => {
      // Prisma handles connection pooling automatically
      // This is just a placeholder for custom cleanup if needed
    });
    
    next();
  };
};

/**
 * Memory usage monitoring
 */
const memoryMonitoring = (req, res, next) => {
  const memUsage = process.memoryUsage();
  
  // Warn if memory usage is high
  if (memUsage.heapUsed > 400 * 1024 * 1024) { // 400MB
    console.warn('⚠️  High memory usage:', {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
    });
  }
  
  next();
};

module.exports = {
  // Compression
  compressionMiddleware,
  
  // Pagination
  paginationMiddleware,
  
  // Caching
  cacheControl,
  noCache,
  etagSupport,
  
  // Query optimization
  queryOptimization,
  
  // Performance tracking
  responseTimeHeader,
  
  // Advanced features
  lazyLoadingSupport,
  batchRequestSupport,
  fieldFilteringSupport,
  
  // Monitoring
  memoryMonitoring,
  
  // Database
  optimizeConnectionPool
};
