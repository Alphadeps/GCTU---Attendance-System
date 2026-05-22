# Scalability Planning Guide

## Overview
This document outlines the scalability strategy for the Class Attendance System, including horizontal scaling, load balancing, database optimization, and queue systems.

---

## 1. CURRENT ARCHITECTURE

### Single Server Setup
```
[Client] → [Load Balancer] → [Node.js Server] → [PostgreSQL Database]
                                    ↓
                              [Redis Cache]
```

**Capacity**: ~200-300 concurrent users

---

## 2. HORIZONTAL SCALING STRATEGY

### Multi-Server Architecture
```
                    [Load Balancer]
                          |
        +-----------------+-----------------+
        |                 |                 |
   [Server 1]        [Server 2]        [Server 3]
        |                 |                 |
        +-----------------+-----------------+
                          |
                    [Redis Cluster]
                          |
                [PostgreSQL Primary]
                    |         |
            [Read Replica 1] [Read Replica 2]
```

**Capacity**: 1000+ concurrent users

### Implementation Steps

#### Step 1: Stateless Application
✅ **Already Implemented**
- JWT tokens (no server-side sessions)
- Redis for shared cache
- Redis for rate limiting
- Redis for queue system

#### Step 2: Load Balancer Configuration

**Option A: Nginx**
```nginx
upstream backend {
    least_conn;  # Use least connections algorithm
    server server1.example.com:5000 weight=1;
    server server2.example.com:5000 weight=1;
    server server3.example.com:5000 weight=1;
    
    # Health check
    keepalive 32;
}

server {
    listen 80;
    server_name api.attendance.gctu.edu.gh;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.attendance.gctu.edu.gh;
    
    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Proxy settings
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static files (if served by backend)
    location /uploads/ {
        proxy_pass http://backend;
        proxy_cache static_cache;
        proxy_cache_valid 200 1h;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

**Option B: AWS Application Load Balancer**
```yaml
# ALB Configuration
Type: application
Scheme: internet-facing
IP address type: ipv4

Listeners:
  - Port: 80
    Protocol: HTTP
    Default action: Redirect to HTTPS
  
  - Port: 443
    Protocol: HTTPS
    SSL Certificate: arn:aws:acm:...
    Default action: Forward to target group

Target Group:
  Protocol: HTTP
  Port: 5000
  Health check:
    Path: /api/health
    Interval: 30 seconds
    Timeout: 5 seconds
    Healthy threshold: 2
    Unhealthy threshold: 3
  
  Stickiness: Disabled (stateless app)
  
  Targets:
    - Instance 1 (server1)
    - Instance 2 (server2)
    - Instance 3 (server3)
```

#### Step 3: Database Read Replicas

**PostgreSQL Replication Setup**
```sql
-- On Primary Server
-- postgresql.conf
wal_level = replica
max_wal_senders = 3
wal_keep_size = 64

-- pg_hba.conf
host replication replicator replica1_ip/32 md5
host replication replicator replica2_ip/32 md5

-- Create replication user
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'strong_password';
```

**Prisma Configuration for Read Replicas**
```javascript
// prisma.config.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL // Primary (write)
    }
  }
});

// Read replica client
const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL // Read replica
    }
  }
});

// Use read replica for read-only queries
async function getClasses() {
  return await prismaRead.class.findMany();
}

// Use primary for writes
async function createClass(data) {
  return await prisma.class.create({ data });
}
```

---

## 3. QUEUE SYSTEM FOR HEAVY OPERATIONS

### Implemented Queues

#### Bulk Upload Queue
- **Purpose**: Process large CSV/Excel uploads
- **Concurrency**: 5 workers
- **Retry**: 3 attempts with exponential backoff
- **Use Cases**:
  - Bulk student uploads (1000+ students)
  - Bulk rep uploads (100+ reps)

#### Report Generation Queue
- **Purpose**: Generate attendance reports
- **Concurrency**: 2 workers
- **Retry**: 2 attempts
- **Use Cases**:
  - PDF report generation
  - Excel export generation

#### Notifications Queue
- **Purpose**: Send notifications
- **Concurrency**: 10 workers
- **Retry**: 5 attempts
- **Use Cases**:
  - Email notifications (future)
  - Push notifications (future)
  - In-app notifications

#### Data Export Queue
- **Purpose**: Export large datasets
- **Concurrency**: 1 worker
- **Timeout**: 5 minutes
- **Use Cases**:
  - Full database exports
  - Attendance history exports
  - Student records exports

### Usage Example

```javascript
const { addJob, getJobStatus } = require('./lib/queue');

// Add bulk upload job
const job = await addJob('bulkUpload', 'students', {
  classId: 'class-id',
  students: [...], // Array of students
  userId: 'user-id'
});

// Check job status
const status = await getJobStatus('bulkUpload', job.jobId);
console.log(status); // { state: 'completed', result: {...} }
```

---

## 4. CDN FOR STATIC ASSETS

### Recommended CDN Providers
1. **Cloudflare** (Free tier available)
2. **AWS CloudFront**
3. **Vercel Edge Network** (for frontend)

### CDN Configuration

**Cloudflare Setup**
```
1. Add domain to Cloudflare
2. Update DNS records
3. Enable caching rules:
   - Cache images: 1 month
   - Cache CSS/JS: 1 week
   - Cache API responses: No cache
4. Enable Brotli compression
5. Enable HTTP/2
6. Enable Auto Minify (HTML, CSS, JS)
```

**Cache Rules**
```nginx
# Static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1M;
    add_header Cache-Control "public, immutable";
}

# Uploaded files
location /uploads/ {
    expires 1w;
    add_header Cache-Control "public";
}

# API responses
location /api/ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

## 5. REDIS CLUSTER FOR HIGH AVAILABILITY

### Redis Sentinel Setup
```bash
# Install Redis Sentinel
sudo apt-get install redis-sentinel

# sentinel.conf
sentinel monitor mymaster 127.0.0.1 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000
```

### Redis Cluster Configuration
```javascript
// For production with Redis Cluster
const Redis = require('ioredis');

const redis = new Redis.Cluster([
  { host: 'redis1.example.com', port: 6379 },
  { host: 'redis2.example.com', port: 6379 },
  { host: 'redis3.example.com', port: 6379 }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD
  }
});
```

---

## 6. AUTO-SCALING CONFIGURATION

### AWS Auto Scaling
```yaml
# Auto Scaling Group
Min instances: 2
Max instances: 10
Desired capacity: 3

Scaling Policies:
  Scale Up:
    Metric: CPU Utilization
    Threshold: > 70%
    Action: Add 2 instances
    Cooldown: 300 seconds
  
  Scale Down:
    Metric: CPU Utilization
    Threshold: < 30%
    Action: Remove 1 instance
    Cooldown: 600 seconds
```

### Docker Swarm Auto-Scaling
```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    image: attendance-backend:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## 7. MONITORING & ALERTING

### Metrics to Monitor
- **Application**:
  - Request rate (req/s)
  - Response time (p50, p95, p99)
  - Error rate (%)
  - Active connections

- **Database**:
  - Query execution time
  - Connection pool usage
  - Replication lag
  - Disk usage

- **Cache**:
  - Hit rate (%)
  - Memory usage
  - Eviction rate

- **Queue**:
  - Job processing rate
  - Queue length
  - Failed jobs
  - Processing time

### Recommended Tools
1. **Prometheus + Grafana** (Open source)
2. **Datadog** (Commercial)
3. **New Relic** (Commercial)
4. **AWS CloudWatch** (AWS)

---

## 8. DISASTER RECOVERY

### Backup Strategy
- **Database**: Daily automated backups (30-day retention)
- **Files**: Daily backup to S3/Cloud Storage
- **Configuration**: Version controlled in Git

### Recovery Time Objectives
- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 24 hours

### Failover Procedures
1. **Database Failover**: Promote read replica to primary
2. **Application Failover**: Load balancer redirects to healthy instances
3. **Cache Failover**: Redis Sentinel automatic failover

---

## 9. CAPACITY PLANNING

### Current Capacity (Single Server)
- **Users**: 200-300 concurrent
- **Requests**: 50 req/s
- **Database**: 100 queries/s
- **Storage**: 10GB

### Target Capacity (Scaled)
- **Users**: 1000+ concurrent
- **Requests**: 500 req/s
- **Database**: 1000 queries/s
- **Storage**: 100GB

### Growth Projections
| Metric | Current | 6 Months | 1 Year | 2 Years |
|--------|---------|----------|--------|---------|
| Students | 2,500 | 5,000 | 10,000 | 20,000 |
| Classes | 50 | 100 | 200 | 400 |
| Sessions/Day | 100 | 200 | 400 | 800 |
| Storage | 10GB | 25GB | 50GB | 100GB |

---

## 10. COST OPTIMIZATION

### Infrastructure Costs (Estimated)

**Small Scale (Current)**
- Server: $20/month
- Database: $25/month
- Redis: $10/month
- **Total**: ~$55/month

**Medium Scale (3 servers)**
- Servers (3x): $60/month
- Database + Replicas: $75/month
- Redis Cluster: $30/month
- Load Balancer: $20/month
- **Total**: ~$185/month

**Large Scale (10 servers)**
- Servers (10x): $200/month
- Database + Replicas: $150/month
- Redis Cluster: $60/month
- Load Balancer: $40/month
- CDN: $20/month
- **Total**: ~$470/month

---

## 11. DEPLOYMENT CHECKLIST

### Pre-Scaling
- [ ] Enable Redis for caching
- [ ] Enable Redis for queues
- [ ] Configure database connection pooling
- [ ] Set up monitoring
- [ ] Create backup strategy
- [ ] Load test current system

### During Scaling
- [ ] Set up load balancer
- [ ] Deploy additional servers
- [ ] Configure database replicas
- [ ] Set up Redis cluster
- [ ] Configure CDN
- [ ] Update DNS records

### Post-Scaling
- [ ] Verify load distribution
- [ ] Test failover procedures
- [ ] Monitor performance metrics
- [ ] Adjust auto-scaling policies
- [ ] Document new architecture

---

**Status**: ✅ Scalability plan ready for implementation
**Date**: May 22, 2026
**Next Review**: August 22, 2026
