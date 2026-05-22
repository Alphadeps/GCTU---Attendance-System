/**
 * Caching Middleware
 * 
 * Provides route-level caching to reduce database queries
 */

const { cache } = require('../lib/redis');

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in seconds
 * @param {function} keyGenerator - Function to generate cache key from req
 */
function cacheMiddleware(ttl = 300, keyGenerator = null) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `route:${req.originalUrl}`;

      // Try to get from cache
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        // Cache hit
        return res.json(cachedData);
      }

      // Cache miss - store original res.json
      const originalJson = res.json.bind(res);
      
      // Override res.json to cache the response
      res.json = function(data) {
        // Cache the response
        cache.set(cacheKey, data, ttl).catch(err => {
          console.error('Failed to cache response:', err.message);
        });
        
        // Send response
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error.message);
      next();
    }
  };
}

/**
 * Invalidate cache for specific patterns
 * @param {string|string[]} patterns - Cache key patterns to invalidate
 */
function invalidateCache(...patterns) {
  return async (req, res, next) => {
    try {
      // Store original json function
      const originalJson = res.json.bind(res);
      
      // Override res.json to invalidate cache after successful response
      res.json = function(data) {
        // Only invalidate on successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          Promise.all(
            patterns.map(pattern => cache.delPattern(pattern))
          ).catch(err => {
            console.error('Failed to invalidate cache:', err.message);
          });
        }
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache invalidation middleware error:', error.message);
      next();
    }
  };
}

module.exports = {
  cacheMiddleware,
  invalidateCache
};
