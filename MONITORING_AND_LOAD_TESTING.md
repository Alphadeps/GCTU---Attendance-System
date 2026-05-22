# System Monitoring & Load Testing Guide

## Overview
This document covers the monitoring, load testing, and performance tracking systems implemented to ensure system reliability and identify capacity limits.

---

## 1. REAL-TIME MONITORING ✅

### Features Implemented

#### Request Tracking
- **Automatic tracking** of all API requests
- **Response time monitoring** for every endpoint
- **Success/error rate tracking**
- **Status code distribution**
- **Endpoint performance analysis**

#### Performance Metrics
- **Average response time** across all requests
- **95th and 99th percentile** response times
- **Slow query detection** (>3 seconds)
- **Memory usage monitoring**
- **Uptime tracking**

#### Error Tracking
- **Automatic error logging** with stack traces
- **Error rate calculation**
- **Last error details** for quick debugging
- **Error count per endpoint**

#### System Health
- **Automatic health assessment** every 5 minutes
- **Health status**: healthy, degraded, or unhealthy
- **Issue detection** and reporting
- **Memory leak detection**

### Monitoring Endpoints

All monitoring endpoints require SUPERADMIN authentication except `/health`.

#### Public Health Check
```
GET /api/monitoring/health
```

**Response:**
```json
{
  "status": "healthy",
  "issues": [],
  "metrics": {
    "uptime": 3600,
    "requests": 1250,
    "errorRate": "0.80%",
    "avgResponseTime": "145.23ms",
    "memory": "156.45 MB"
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```

**Status Values:**
- `healthy`: System operating normally (error rate <5%, response time <2s)
- `degraded`: System under stress (error rate 5-20%, response time 2-5s)
- `unhealthy`: System failing (error rate >20%, response time >5s)

#### Detailed Metrics
```
GET /api/monitoring/metrics
Authorization: Bearer <superadmin-token>
```

**Response:**
```json
{
  "uptime": {
    "milliseconds": 3600000,
    "seconds": 3600,
    "minutes": 60,
    "hours": 1
  },
  "requests": {
    "total": 1250,
    "success": 1240,
    "errors": 10,
    "errorRate": "0.80%",
    "statusCodes": {
      "200": 1100,
      "201": 50,
      "400": 5,
      "404": 3,
      "500": 2
    }
  },
  "performance": {
    "avgResponseTime": "145.23ms",
    "slowQueries": [...],
    "recentResponseTimes": [...]
  },
  "endpoints": [
    {
      "endpoint": "GET /api/admin/classes",
      "count": 150,
      "avgTime": "234.56",
      "errors": 2,
      "errorRate": "1.33"
    }
  ],
  "system": {
    "memory": {
      "used": "156.45 MB",
      "total": "512.00 MB",
      "external": "12.34 MB"
    },
    "lastError": {...},
    "totalErrors": 10
  }
}
```

#### Database Health
```
GET /api/monitoring/database
Authorization: Bearer <superadmin-token>
```

**Response:**
```json
{
  "status": "connected",
  "queryTime": "45ms",
  "stats": {
    "users": 125,
    "students": 2500,
    "classes": 45,
    "sessions": 320
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```

#### Cache Health
```
GET /api/monitoring/cache
Authorization: Bearer <superadmin-token>
```

**Response:**
```json
{
  "enabled": true,
  "connected": true,
  "info": "...",
  "keyspace": "..."
}
```

#### Security Monitoring - Blocked IPs
```
GET /api/monitoring/security/blocked-ips
Authorization: Bearer <superadmin-token>
```

**Response:**
```json
{
  "count": 3,
  "ips": [
    {
      "ip": "192.168.1.100",
      "blockedAt": "2026-05-22T10:00:00.000Z",
      "expiresAt": "2026-05-22T10:30:00.000Z",
      "remainingSeconds": 1200
    }
  ]
}
```

#### Security Monitoring - Suspicious IPs
```
GET /api/monitoring/security/suspicious-ips
Authorization: Bearer <superadmin-token>
```

**Response:**
```json
{
  "count": 5,
  "ips": [
    {
      "ip": "192.168.1.101",
      "violations": 3,
      "firstSeen": "2026-05-22T09:45:00.000Z",
      "lastSeen": "2026-05-22T10:15:00.000Z"
    }
  ]
}
```

#### Unblock IP Address
```
POST /api/monitoring/security/unblock-ip
Authorization: Bearer <superadmin-token>
Content-Type: application/json

{
  "ip": "192.168.1.100"
}
```

#### System Information
```
GET /api/monitoring/system
Authorization: Bearer <superadmin-token>
```

**Response:**
```json
{
  "node": {
    "version": "v18.17.0",
    "platform": "win32",
    "arch": "x64"
  },
  "memory": {
    "heapUsed": "156.45 MB",
    "heapTotal": "512.00 MB",
    "external": "12.34 MB",
    "rss": "234.56 MB"
  },
  "cpu": {
    "user": "1234.56ms",
    "system": "567.89ms"
  },
  "uptime": {
    "process": "60.00 minutes",
    "system": "24.50 hours"
  }
}
```

#### Reset Metrics
```
POST /api/monitoring/metrics/reset
Authorization: Bearer <superadmin-token>
```

---

## 2. LOAD TESTING ✅

### Load Test Script

Located at: `backend/load-test.js`

### Test Types

#### 1. Light Load (Normal Usage)
```bash
node load-test.js light
```
- **Concurrent Users**: 10
- **Total Requests**: 100
- **Ramp-up Time**: 5 seconds
- **Use Case**: Normal daily usage

#### 2. Medium Load (Peak Hours)
```bash
node load-test.js medium
```
- **Concurrent Users**: 50
- **Total Requests**: 500
- **Ramp-up Time**: 10 seconds
- **Use Case**: Peak attendance marking hours

#### 3. Heavy Load (High Traffic)
```bash
node load-test.js heavy
```
- **Concurrent Users**: 100
- **Total Requests**: 1000
- **Ramp-up Time**: 15 seconds
- **Use Case**: Multiple classes marking attendance simultaneously

#### 4. Stress Test (Finding Limits)
```bash
node load-test.js stress
```
- **Concurrent Users**: 200
- **Total Requests**: 2000
- **Ramp-up Time**: 20 seconds
- **Use Case**: Identify system breaking point

#### 5. Spike Test (Sudden Traffic Burst)
```bash
node load-test.js spike
```
- **Concurrent Users**: 500
- **Total Requests**: 500
- **Ramp-up Time**: 1 second
- **Use Case**: Sudden traffic spike (e.g., exam attendance)

### Load Test Output

```
============================================================
🚀 Starting Load Test: Medium load - Peak hours
============================================================
Concurrent Users: 50
Total Requests: 500
Ramp-up Time: 10000ms
Target: http://localhost:5000/api
============================================================

📊 Ramped up 10/50 users...
📊 Ramped up 20/50 users...
📊 Ramped up 30/50 users...
📊 Ramped up 40/50 users...
📊 Ramped up 50/50 users...

⏳ All users active. Waiting for completion...

============================================================
📊 LOAD TEST RESULTS
============================================================

📈 Overall Performance:
   Total Duration: 45.23s
   Total Requests: 500
   Successful: 495 (99.00%)
   Failed: 5
   Throughput: 11.05 req/s

⏱️  Response Times:
   Min: 45.23ms
   Max: 2345.67ms
   Average: 234.56ms
   Median: 189.34ms
   95th Percentile: 567.89ms
   99th Percentile: 1234.56ms

📊 Status Codes:
   200: 450 (90.00%)
   201: 40 (8.00%)
   429: 5 (1.00%)
   500: 5 (1.00%)

❌ Errors (showing first 10):
   1. POST /api/auth/login - 429 - Too many requests
   2. GET /api/admin/stats - 500 - Internal server error

============================================================

🎯 Performance Assessment:
   ✅ EXCELLENT - System handling load very well

============================================================
```

### Performance Assessment Criteria

| Status | Success Rate | 95th Percentile | Description |
|--------|-------------|-----------------|-------------|
| ✅ EXCELLENT | ≥99% | <1000ms | System handling load very well |
| ✅ GOOD | ≥95% | <2000ms | System performing adequately |
| ⚠️ ACCEPTABLE | ≥90% | <3000ms | System under stress but functional |
| ⚠️ DEGRADED | ≥80% | Any | System struggling, optimization needed |
| ❌ CRITICAL | <80% | Any | System failing under load |

### Custom Load Test Configuration

You can modify the test configurations in `load-test.js`:

```javascript
const TEST_CONFIGS = {
  custom: {
    concurrentUsers: 150,
    totalRequests: 1500,
    rampUpTime: 12000,
    description: 'Custom test configuration'
  }
};
```

Then run:
```bash
node load-test.js custom
```

---

## 3. ENHANCED RATE LIMITING ✅

### Rate Limiter Types

#### 1. Login Limiter (Exponential Backoff)
- **Window**: 15 minutes
- **Max Attempts**: 5
- **Backoff**: 1, 2, 4, 8, 16, 30 minutes
- **Features**: 
  - Tracks failed login attempts
  - Exponential backoff on violations
  - IP blocking after 4+ violations

#### 2. Student Auth Limiter
- **Window**: 15 minutes
- **Max Attempts**: 10
- **Use Case**: First-time student login/password setup

#### 3. Check-in Limiter
- **Window**: 1 minute
- **Max Attempts**: 3
- **Use Case**: Prevent QR code scanning spam

#### 4. Unauthenticated Limiter
- **Window**: 15 minutes
- **Max Requests**: 100
- **Use Case**: Public endpoints without authentication

#### 5. Authenticated Limiter
- **Window**: 15 minutes
- **Max Requests**: 1000
- **Use Case**: Protected endpoints with valid JWT

#### 6. Admin Limiter
- **Window**: 15 minutes
- **Max Requests**: 500
- **Use Case**: Administrative operations

#### 7. Upload Limiter
- **Window**: 1 hour
- **Max Uploads**: 20
- **Use Case**: File uploads (CSV, Excel, PDF)

#### 8. Report Limiter
- **Window**: 15 minutes
- **Max Reports**: 30
- **Use Case**: Report generation (resource intensive)

### IP Blocking System

#### Automatic Blocking
- **Trigger**: 5 rate limit violations within 10 minutes
- **Duration**: 30 minutes
- **Action**: All requests from IP blocked with 403 status

#### Manual Unblocking
```bash
curl -X POST http://localhost:5000/api/monitoring/security/unblock-ip \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.100"}'
```

### Suspicious Activity Tracking
- Tracks IPs with multiple rate limit violations
- Automatically blocks after threshold
- Cleans up old entries after 1 hour

---

## 4. PERFORMANCE BENCHMARKS

### Expected Performance (After Optimizations)

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| Average Response Time | <200ms | <500ms | >1000ms |
| 95th Percentile | <500ms | <1000ms | >2000ms |
| Error Rate | <1% | <5% | >10% |
| Throughput | >50 req/s | >20 req/s | <10 req/s |
| Database Query Time | <100ms | <300ms | >1000ms |
| Memory Usage | <300MB | <500MB | >700MB |

### Capacity Estimates

| Load Level | Concurrent Users | Requests/Second | Expected Status |
|------------|-----------------|-----------------|-----------------|
| Light | 10-20 | 5-10 | ✅ Excellent |
| Medium | 50-100 | 20-40 | ✅ Good |
| Heavy | 100-200 | 40-80 | ⚠️ Acceptable |
| Stress | 200-300 | 80-120 | ⚠️ Degraded |
| Critical | 300+ | 120+ | ❌ Failing |

---

## 5. MONITORING BEST PRACTICES

### Daily Monitoring
1. Check `/api/monitoring/health` endpoint
2. Review error rate (should be <1%)
3. Check average response time (should be <200ms)
4. Monitor memory usage (should be <300MB)

### Weekly Monitoring
1. Review slow queries (>3 seconds)
2. Check blocked/suspicious IPs
3. Analyze endpoint performance
4. Review error logs

### Monthly Monitoring
1. Run load tests to verify capacity
2. Review and optimize slow endpoints
3. Check database query performance
4. Plan for scaling if needed

### Alerts to Set Up

#### Critical Alerts (Immediate Action)
- Error rate >10%
- Average response time >2 seconds
- Database connection failures
- Memory usage >500MB
- System status: unhealthy

#### Warning Alerts (Monitor Closely)
- Error rate >5%
- Average response time >1 second
- Slow queries detected
- Memory usage >400MB
- System status: degraded

#### Info Alerts (Track Trends)
- High traffic periods
- Unusual endpoint usage
- Suspicious IP activity
- Cache hit rate changes

---

## 6. TROUBLESHOOTING

### High Response Times
1. Check database query performance
2. Review slow query log
3. Verify cache is working
4. Check for memory leaks
5. Review endpoint code for optimization

### High Error Rate
1. Check error logs for patterns
2. Verify database connection
3. Check for rate limiting issues
4. Review recent code changes
5. Check external service dependencies

### Memory Issues
1. Check for memory leaks
2. Review cache size
3. Check for unclosed connections
4. Monitor garbage collection
5. Consider increasing memory limits

### Database Performance
1. Verify indexes are applied
2. Check connection pool usage
3. Review slow queries
4. Check for lock contention
5. Consider read replicas

---

## 7. INTEGRATION WITH FRONTEND

### Health Check Display
Add a system health indicator to the admin dashboard:

```javascript
// Fetch health status
const response = await fetch('/api/monitoring/health');
const health = await response.json();

// Display status
if (health.status === 'healthy') {
  // Show green indicator
} else if (health.status === 'degraded') {
  // Show yellow indicator with issues
} else {
  // Show red indicator with issues
}
```

### Metrics Dashboard
Create an admin page to display:
- Real-time request count
- Average response time
- Error rate
- Active sessions
- Blocked IPs
- System memory usage

---

## 8. NEXT STEPS

### Immediate
- ✅ Monitoring middleware implemented
- ✅ Load testing script created
- ✅ Enhanced rate limiting deployed
- ✅ Security monitoring active

### Short-term (1-2 weeks)
- [ ] Set up automated alerts
- [ ] Create admin monitoring dashboard
- [ ] Run baseline load tests
- [ ] Document performance benchmarks

### Long-term (1-3 months)
- [ ] Implement distributed tracing
- [ ] Set up log aggregation
- [ ] Add APM (Application Performance Monitoring)
- [ ] Create automated performance regression tests

---

**Status**: ✅ COMPLETE - Monitoring and load testing system ready
**Date**: May 22, 2026
**Impact**: Full visibility into system performance and capacity
