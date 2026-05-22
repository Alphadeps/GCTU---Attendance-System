/**
 * Load Testing Script
 * 
 * Tests system capacity and identifies breaking points
 * 
 * Usage:
 *   node load-test.js [test-type] [options]
 * 
 * Test Types:
 *   - light: 10 concurrent users, 100 requests
 *   - medium: 50 concurrent users, 500 requests
 *   - heavy: 100 concurrent users, 1000 requests
 *   - stress: 200 concurrent users, 2000 requests
 *   - spike: Sudden burst of 500 concurrent users
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const TEST_TYPE = process.argv[2] || 'light';

// Test configurations
const TEST_CONFIGS = {
  light: {
    concurrentUsers: 10,
    totalRequests: 100,
    rampUpTime: 5000, // 5 seconds
    description: 'Light load - Normal usage'
  },
  medium: {
    concurrentUsers: 50,
    totalRequests: 500,
    rampUpTime: 10000, // 10 seconds
    description: 'Medium load - Peak hours'
  },
  heavy: {
    concurrentUsers: 100,
    totalRequests: 1000,
    rampUpTime: 15000, // 15 seconds
    description: 'Heavy load - High traffic'
  },
  stress: {
    concurrentUsers: 200,
    totalRequests: 2000,
    rampUpTime: 20000, // 20 seconds
    description: 'Stress test - Finding limits'
  },
  spike: {
    concurrentUsers: 500,
    totalRequests: 500,
    rampUpTime: 1000, // 1 second - sudden spike
    description: 'Spike test - Sudden traffic burst'
  }
};

// Test endpoints (mix of read and write operations)
const ENDPOINTS = [
  { method: 'GET', path: '/health', weight: 10 },
  { method: 'POST', path: '/auth/login', weight: 5, data: { username: 'testuser', password: 'test123' } },
  { method: 'GET', path: '/admin/stats', weight: 8, requiresAuth: true },
  { method: 'GET', path: '/admin/classes', weight: 8, requiresAuth: true },
  { method: 'GET', path: '/admin/programmes', weight: 7, requiresAuth: true },
  { method: 'GET', path: '/admin/reps', weight: 6, requiresAuth: true }
];

// Results tracking
const results = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  statusCodes: {},
  startTime: null,
  endTime: null
};

/**
 * Weighted random endpoint selection
 */
function selectEndpoint() {
  const totalWeight = ENDPOINTS.reduce((sum, ep) => sum + ep.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const endpoint of ENDPOINTS) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }
  
  return ENDPOINTS[0];
}

/**
 * Make a single request
 */
async function makeRequest(endpoint, token = null) {
  const startTime = Date.now();
  
  try {
    const config = {
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.path}`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: endpoint.data || undefined,
      timeout: 30000 // 30 second timeout
    };
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    results.successfulRequests++;
    results.responseTimes.push(duration);
    results.statusCodes[response.status] = (results.statusCodes[response.status] || 0) + 1;
    
    return { success: true, duration, status: response.status };
  } catch (error) {
    const duration = Date.now() - startTime;
    results.failedRequests++;
    
    const status = error.response?.status || 'TIMEOUT';
    results.statusCodes[status] = (results.statusCodes[status] || 0) + 1;
    
    results.errors.push({
      endpoint: `${endpoint.method} ${endpoint.path}`,
      error: error.message,
      status,
      duration
    });
    
    return { success: false, duration, status, error: error.message };
  }
}

/**
 * Simulate a single user
 */
async function simulateUser(userId, requestsPerUser) {
  const userResults = [];
  
  for (let i = 0; i < requestsPerUser; i++) {
    const endpoint = selectEndpoint();
    const result = await makeRequest(endpoint);
    userResults.push(result);
    
    // Random delay between requests (100-500ms)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
  }
  
  return userResults;
}

/**
 * Run load test
 */
async function runLoadTest(config) {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 Starting Load Test: ${config.description}`);
  console.log('='.repeat(60));
  console.log(`Concurrent Users: ${config.concurrentUsers}`);
  console.log(`Total Requests: ${config.totalRequests}`);
  console.log(`Ramp-up Time: ${config.rampUpTime}ms`);
  console.log(`Target: ${BASE_URL}`);
  console.log('='.repeat(60) + '\n');
  
  results.startTime = Date.now();
  results.totalRequests = config.totalRequests;
  
  const requestsPerUser = Math.ceil(config.totalRequests / config.concurrentUsers);
  const delayBetweenUsers = config.rampUpTime / config.concurrentUsers;
  
  const userPromises = [];
  
  // Ramp up users gradually
  for (let i = 0; i < config.concurrentUsers; i++) {
    await new Promise(resolve => setTimeout(resolve, delayBetweenUsers));
    
    userPromises.push(simulateUser(i + 1, requestsPerUser));
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`📊 Ramped up ${i + 1}/${config.concurrentUsers} users...`);
    }
  }
  
  console.log(`\n⏳ All users active. Waiting for completion...\n`);
  
  // Wait for all users to complete
  await Promise.all(userPromises);
  
  results.endTime = Date.now();
  
  // Print results
  printResults(config);
}

/**
 * Calculate statistics
 */
function calculateStats(values) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

/**
 * Print test results
 */
function printResults(config) {
  const duration = results.endTime - results.startTime;
  const durationSeconds = duration / 1000;
  const requestsPerSecond = results.totalRequests / durationSeconds;
  const successRate = (results.successfulRequests / results.totalRequests * 100).toFixed(2);
  const stats = calculateStats(results.responseTimes);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log('\n📈 Overall Performance:');
  console.log(`   Total Duration: ${durationSeconds.toFixed(2)}s`);
  console.log(`   Total Requests: ${results.totalRequests}`);
  console.log(`   Successful: ${results.successfulRequests} (${successRate}%)`);
  console.log(`   Failed: ${results.failedRequests}`);
  console.log(`   Throughput: ${requestsPerSecond.toFixed(2)} req/s`);
  
  console.log('\n⏱️  Response Times:');
  console.log(`   Min: ${stats.min.toFixed(2)}ms`);
  console.log(`   Max: ${stats.max.toFixed(2)}ms`);
  console.log(`   Average: ${stats.avg.toFixed(2)}ms`);
  console.log(`   Median: ${stats.median.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${stats.p95.toFixed(2)}ms`);
  console.log(`   99th Percentile: ${stats.p99.toFixed(2)}ms`);
  
  console.log('\n📊 Status Codes:');
  Object.entries(results.statusCodes)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([code, count]) => {
      const percentage = (count / results.totalRequests * 100).toFixed(2);
      console.log(`   ${code}: ${count} (${percentage}%)`);
    });
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors (showing first 10):');
    results.errors.slice(0, 10).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.endpoint} - ${err.status} - ${err.error}`);
    });
    
    if (results.errors.length > 10) {
      console.log(`   ... and ${results.errors.length - 10} more errors`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Performance assessment
  console.log('\n🎯 Performance Assessment:');
  
  if (successRate >= 99 && stats.p95 < 1000) {
    console.log('   ✅ EXCELLENT - System handling load very well');
  } else if (successRate >= 95 && stats.p95 < 2000) {
    console.log('   ✅ GOOD - System performing adequately');
  } else if (successRate >= 90 && stats.p95 < 3000) {
    console.log('   ⚠️  ACCEPTABLE - System under stress but functional');
  } else if (successRate >= 80) {
    console.log('   ⚠️  DEGRADED - System struggling, optimization needed');
  } else {
    console.log('   ❌ CRITICAL - System failing under load');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main execution
 */
async function main() {
  const config = TEST_CONFIGS[TEST_TYPE];
  
  if (!config) {
    console.error(`❌ Invalid test type: ${TEST_TYPE}`);
    console.log('\nAvailable test types:');
    Object.entries(TEST_CONFIGS).forEach(([name, cfg]) => {
      console.log(`  - ${name}: ${cfg.description}`);
    });
    process.exit(1);
  }
  
  try {
    await runLoadTest(config);
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
main();
