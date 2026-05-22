# Redis Setup Guide for Class Attendance System

## Overview

Redis provides a high-performance caching layer that can reduce database load by 70-80% and significantly improve response times for frequently accessed data.

## Benefits of Redis Caching

- **Faster Response Times**: Cached data is retrieved from memory instead of database
- **Reduced Database Load**: Fewer queries to PostgreSQL
- **Better Scalability**: Handle more concurrent users
- **Improved User Experience**: Faster page loads and API responses

## What Gets Cached

The system caches:
- User profiles and authentication data
- Class lists and student rosters
- Course information
- Active attendance sessions
- Statistics and reports
- Notification counts

## Setup on Render

### Step 1: Create Redis Instance

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Redis"**
3. Configure your Redis instance:
   - **Name**: `class-attendance-redis`
   - **Region**: Choose the **same region** as your backend (important for low latency)
   - **Plan Options**:
     - **Free**: 25MB storage, good for testing
     - **Starter ($7/month)**: 256MB storage, recommended for production
     - **Standard ($15/month)**: 1GB storage, for larger deployments

4. Click **"Create Redis"**

### Step 2: Get Redis Connection URL

After creation, you'll see two URLs:

- **Internal Redis URL** (recommended): `redis://red-xxxxx:6379`
  - Use this for services in the same Render region
  - Lower latency, no external traffic charges
  
- **External Redis URL**: `rediss://red-xxxxx.oregon-postgres.render.com:6379`
  - Use this only if connecting from outside Render

**Copy the Internal Redis URL** - you'll need it in the next step.

### Step 3: Add Redis URL to Backend Environment

1. Go to your backend service on Render
2. Click on **"Environment"** in the left sidebar
3. Click **"Add Environment Variable"**
4. Add:
   - **Key**: `REDIS_URL`
   - **Value**: Paste the **Internal Redis URL** from Step 2
5. Click **"Save Changes"**

Render will automatically redeploy your backend with Redis enabled.

### Step 4: Verify Redis Connection

After deployment completes, check the logs:

✅ **Success** - You should see:
```
✅ Redis: Connected successfully
```

❌ **If you see connection errors**:
```
❌ Redis: Failed to connect: Connection refused
```

**Troubleshooting**:
- Verify the Redis URL is correct
- Ensure both services are in the same region
- Check that the Redis instance is running (green status on Render)

## Local Development Setup

### Option 1: Use Docker (Recommended)

```bash
# Start Redis in Docker
docker run -d -p 6379:6379 --name redis redis:alpine

# Set environment variable
# In backend/.env file:
REDIS_URL=redis://localhost:6379
```

### Option 2: Install Redis Locally

**Windows (using WSL2)**:
```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
# Should return: PONG
```

**macOS**:
```bash
# Install via Homebrew
brew install redis

# Start Redis
brew services start redis

# Test connection
redis-cli ping
```

**Linux**:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Test connection
redis-cli ping
```

### Option 3: Skip Redis Locally

The system works without Redis - it just won't have caching. Simply don't set `REDIS_URL` in your `.env` file.

## Testing Redis

### 1. Check Cache Statistics

```bash
# Make a request to the monitoring endpoint
curl https://your-backend-url.onrender.com/api/monitoring/cache/stats
```

### 2. Monitor Redis Usage

In Render Dashboard:
1. Go to your Redis instance
2. Click **"Metrics"** tab
3. Monitor:
   - Memory usage
   - Commands per second
   - Connected clients

### 3. Test Cache Performance

```bash
# First request (cache miss - slower)
time curl https://your-backend-url.onrender.com/api/classes

# Second request (cache hit - faster)
time curl https://your-backend-url.onrender.com/api/classes
```

The second request should be significantly faster.

## Cache Configuration

### Cache TTL (Time To Live)

Different data types have different cache durations:

- **User data**: 5 minutes
- **Class lists**: 10 minutes
- **Course data**: 15 minutes
- **Statistics**: 5 minutes
- **Active sessions**: 2 minutes
- **Notifications**: 1 minute

### Cache Invalidation

The system automatically invalidates cache when data changes:

- Creating/updating a class → Clears class cache
- Adding students → Clears student and class cache
- Starting a session → Clears session cache
- Marking attendance → Clears attendance cache

## Monitoring and Maintenance

### View Cache Stats

```javascript
// Endpoint: GET /api/monitoring/cache/stats
// Response:
{
  "enabled": true,
  "connected": true,
  "keyspace": "db0:keys=42,expires=38",
  "hitRate": "85%"
}
```

### Clear All Cache

```javascript
// Endpoint: POST /api/monitoring/cache/flush
// Requires: SUPERADMIN role
// Response:
{
  "message": "Cache flushed successfully"
}
```

### Common Redis Commands

```bash
# Connect to Redis CLI
redis-cli -u redis://your-redis-url:6379

# View all keys
KEYS *

# Get a specific value
GET user:123

# Check memory usage
INFO memory

# Monitor commands in real-time
MONITOR

# Clear all data (use with caution!)
FLUSHDB
```

## Cost Optimization

### Free Tier (25MB)
- Good for: Testing, small deployments (<100 users)
- Limitations: Limited storage, may need frequent cache clearing

### Starter Tier ($7/month, 256MB)
- Good for: Production use, 500-1000 users
- Recommended for most deployments

### When to Upgrade
- Memory usage consistently >80%
- Frequent cache evictions
- Growing user base (>1000 active users)

## Troubleshooting

### Issue: "Redis connection timeout"
**Solution**: 
- Check that Redis instance is running
- Verify both services are in the same region
- Use Internal Redis URL, not External

### Issue: "Out of memory"
**Solution**:
- Upgrade Redis plan
- Reduce cache TTL values
- Clear old cache: `POST /api/monitoring/cache/flush`

### Issue: "Cache not working"
**Solution**:
- Verify `REDIS_URL` environment variable is set
- Check logs for Redis connection errors
- Test Redis connection: `redis-cli -u $REDIS_URL ping`

### Issue: "Slow performance even with Redis"
**Solution**:
- Check cache hit rate (should be >70%)
- Verify Redis and backend are in same region
- Monitor Redis metrics for bottlenecks

## Security Best Practices

1. **Use Internal URLs**: Always use Internal Redis URL for services in the same region
2. **No Public Access**: Redis should not be accessible from the internet
3. **Regular Backups**: Render provides automatic backups for paid plans
4. **Monitor Access**: Check Redis logs for unusual activity
5. **Rotate Credentials**: If you suspect a security issue, regenerate Redis URL

## Performance Benchmarks

With Redis enabled, you should see:

- **API Response Time**: 50-80% faster
- **Database Load**: 70-80% reduction
- **Concurrent Users**: 3-5x more capacity
- **Page Load Time**: 40-60% improvement

## Next Steps

After setting up Redis:

1. ✅ Monitor cache hit rates
2. ✅ Adjust TTL values based on usage patterns
3. ✅ Set up alerts for high memory usage
4. ✅ Plan for scaling as user base grows

## Support

If you encounter issues:
1. Check Render status page: https://status.render.com
2. Review Redis logs in Render dashboard
3. Check backend logs for connection errors
4. Contact Render support for Redis-specific issues

---

**Last Updated**: May 22, 2026
**System Version**: 1.0.0
