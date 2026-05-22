/**
 * Redis Cache Client Configuration
 * 
 * Provides caching layer to reduce database load by 70-80%
 * Caches frequently accessed data like class lists, student lists, and statistics
 */

const Redis = require('ioredis');

let redis = null;

// Initialize Redis client
function initRedis() {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('⚠️  WARNING: REDIS_URL not configured. Caching disabled.');
    console.warn('   System will work but will be slower without caching.');
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      enableReadyCheck: true,
      lazyConnect: true,
    });

    // Handle connection events
    redis.on('connect', () => {
      console.log('✅ Redis: Connected successfully');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis Error:', err.message);
    });

    redis.on('close', () => {
      console.log('🔌 Redis: Connection closed');
    });

    // Connect to Redis
    redis.connect().catch((err) => {
      console.error('❌ Redis: Failed to connect:', err.message);
      redis = null;
    });

    return redis;
  } catch (error) {
    console.error('❌ Redis: Initialization failed:', error.message);
    return null;
  }
}

// Cache helper functions
const cache = {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} - Cached value or null
   */
  async get(key) {
    if (!redis) return null;
    
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache GET error for key "${key}":`, error.message);
      return null;
    }
  },

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 5 minutes)
   */
  async set(key, value, ttl = 300) {
    if (!redis) return;
    
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache SET error for key "${key}":`, error.message);
    }
  },

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  async del(key) {
    if (!redis) return;
    
    try {
      await redis.del(key);
    } catch (error) {
      console.error(`Cache DEL error for key "${key}":`, error.message);
    }
  },

  /**
   * Delete multiple keys matching a pattern
   * @param {string} pattern - Key pattern (e.g., "user:*")
   */
  async delPattern(pattern) {
    if (!redis) return;
    
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error(`Cache DEL PATTERN error for "${pattern}":`, error.message);
    }
  },

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (!redis) return false;
    
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache EXISTS error for key "${key}":`, error.message);
      return false;
    }
  },

  /**
   * Increment a counter in cache
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<number>} - New value
   */
  async incr(key, ttl = 3600) {
    if (!redis) return 0;
    
    try {
      const value = await redis.incr(key);
      if (value === 1) {
        await redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error(`Cache INCR error for key "${key}":`, error.message);
      return 0;
    }
  },

  /**
   * Get cache statistics
   * @returns {Promise<object>}
   */
  async stats() {
    if (!redis) return { enabled: false };
    
    try {
      const info = await redis.info('stats');
      const keyspace = await redis.info('keyspace');
      
      return {
        enabled: true,
        connected: redis.status === 'ready',
        info,
        keyspace
      };
    } catch (error) {
      return { enabled: true, connected: false, error: error.message };
    }
  },

  /**
   * Clear all cache
   */
  async flush() {
    if (!redis) return;
    
    try {
      await redis.flushdb();
      console.log('🗑️  Cache: Flushed all keys');
    } catch (error) {
      console.error('Cache FLUSH error:', error.message);
    }
  }
};

// Cache key generators
const cacheKeys = {
  // User keys
  user: (id) => `user:${id}`,
  userByUsername: (username) => `user:username:${username}`,
  userByIndex: (indexNumber) => `user:index:${indexNumber}`,
  reps: () => `reps:all`,
  
  // Student keys
  student: (id) => `student:${id}`,
  studentByIndex: (indexNumber) => `student:index:${indexNumber}`,
  
  // Class keys
  class: (id) => `class:${id}`,
  classes: () => `classes:all`,
  classStudents: (classId) => `class:${classId}:students`,
  classCourses: (classId) => `class:${classId}:courses`,
  
  // Programme keys
  programmes: () => `programmes:all`,
  
  // Course keys
  courses: () => `courses:all`,
  
  // Session keys
  session: (id) => `session:${id}`,
  activeSessions: (classId) => `sessions:active:${classId}`,
  repSessions: (repId) => `sessions:rep:${repId}`,
  
  // Attendance keys
  sessionAttendance: (sessionId) => `attendance:session:${sessionId}`,
  studentAttendance: (studentId) => `attendance:student:${studentId}`,
  
  // Statistics keys
  stats: () => `stats:admin`,
  classStats: (classId) => `stats:class:${classId}`,
  
  // Notification keys
  userNotifications: (userId) => `notifications:user:${userId}`,
  unreadCount: (userId) => `notifications:unread:${userId}`,
  
  // Report keys
  reports: (classId, courseId) => `reports:${classId}:${courseId}`,
  pendingReports: (lecturerId) => `reports:pending:${lecturerId}`,
};

// Initialize Redis on module load
initRedis();

// Graceful shutdown
process.on('beforeExit', async () => {
  if (redis) {
    await redis.quit();
  }
});

module.exports = {
  redis,
  cache,
  cacheKeys,
  initRedis
};
