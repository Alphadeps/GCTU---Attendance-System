/**
 * Queue System for Heavy Operations
 * 
 * Uses Bull queue for background job processing
 * Handles:
 * - Bulk student uploads
 * - Bulk rep uploads
 * - Report generation
 * - Email notifications (future)
 * - Data exports (future)
 */

const Queue = require('bull');
const prisma = require('./prisma');

// Queue configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create queues
const queues = {
  bulkUpload: null,
  reportGeneration: null,
  notifications: null,
  dataExport: null
};

/**
 * Initialize queues
 */
function initializeQueues() {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not configured. Queue system disabled.');
    console.warn('   Heavy operations will run synchronously (slower).');
    return false;
  }

  try {
    // Bulk Upload Queue
    queues.bulkUpload = new Queue('bulk-upload', REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200 // Keep last 200 failed jobs
      }
    });

    // Report Generation Queue
    queues.reportGeneration = new Queue('report-generation', REDIS_URL, {
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000
        },
        removeOnComplete: 50,
        removeOnFail: 100
      }
    });

    // Notifications Queue
    queues.notifications = new Queue('notifications', REDIS_URL, {
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 200,
        removeOnFail: 500
      }
    });

    // Data Export Queue
    queues.dataExport = new Queue('data-export', REDIS_URL, {
      defaultJobOptions: {
        attempts: 2,
        timeout: 300000, // 5 minutes
        removeOnComplete: 20,
        removeOnFail: 50
      }
    });

    console.log('✅ Queue system initialized successfully');
    
    // Set up processors
    setupProcessors();
    
    // Set up event listeners
    setupEventListeners();
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize queue system:', error.message);
    return false;
  }
}

/**
 * Setup job processors
 */
function setupProcessors() {
  // Bulk Upload Processor
  if (queues.bulkUpload) {
    queues.bulkUpload.process('students', 5, async (job) => {
      return await processBulkStudentUpload(job.data);
    });

    queues.bulkUpload.process('reps', 3, async (job) => {
      return await processBulkRepUpload(job.data);
    });
  }

  // Report Generation Processor
  if (queues.reportGeneration) {
    queues.reportGeneration.process(2, async (job) => {
      return await processReportGeneration(job.data);
    });
  }

  // Notifications Processor
  if (queues.notifications) {
    queues.notifications.process(10, async (job) => {
      return await processNotification(job.data);
    });
  }

  // Data Export Processor
  if (queues.dataExport) {
    queues.dataExport.process(1, async (job) => {
      return await processDataExport(job.data);
    });
  }
}

/**
 * Setup event listeners for monitoring
 */
function setupEventListeners() {
  Object.entries(queues).forEach(([name, queue]) => {
    if (!queue) return;

    queue.on('completed', (job, result) => {
      console.log(`✅ Job completed: ${name} - ${job.id}`);
    });

    queue.on('failed', (job, err) => {
      console.error(`❌ Job failed: ${name} - ${job.id}`, err.message);
    });

    queue.on('stalled', (job) => {
      console.warn(`⚠️  Job stalled: ${name} - ${job.id}`);
    });
  });
}

/**
 * Process bulk student upload
 */
async function processBulkStudentUpload(data) {
  const { classId, students, userId } = data;
  
  let addedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const item of students) {
    try {
      const { indexNumber, name, email } = item;
      
      if (!indexNumber || !name) {
        skippedCount++;
        errors.push(`Missing indexNumber or name for: ${JSON.stringify(item)}`);
        continue;
      }

      const studentEmail = email || `${indexNumber}@student.gctu.edu.gh`;

      // Upsert student
      const student = await prisma.student.upsert({
        where: { indexNumber },
        update: { name, email: studentEmail },
        create: { indexNumber, name, email: studentEmail }
      });

      // Link student via ClassStudent
      const linkExists = await prisma.classStudent.findUnique({
        where: {
          classId_studentId: {
            classId,
            studentId: student.id
          }
        }
      });

      if (!linkExists) {
        await prisma.classStudent.create({
          data: {
            classId,
            studentId: student.id
          }
        });
        addedCount++;
      } else {
        skippedCount++;
      }
    } catch (e) {
      skippedCount++;
      errors.push(e.message);
    }
  }

  return { addedCount, skippedCount, errors: errors.slice(0, 20) };
}

/**
 * Process bulk rep upload
 */
async function processBulkRepUpload(data) {
  const { reps, userId } = data;
  
  let createdCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const rep of reps) {
    try {
      const { indexNumber, name, email, programme, level, type, group, session } = rep;
      
      if (!indexNumber || !name) {
        skippedCount++;
        errors.push(`Missing required fields for: ${JSON.stringify(rep)}`);
        continue;
      }

      // Create rep user account
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('rep123', 10);

      const newRep = await prisma.user.create({
        data: {
          username: name,
          indexNumber,
          password: hashedPassword,
          role: 'REP',
          isActive: true
        }
      });

      // Create student record
      await prisma.student.upsert({
        where: { indexNumber },
        update: { name, email },
        create: { indexNumber, name, email }
      });

      createdCount++;
    } catch (e) {
      skippedCount++;
      errors.push(e.message);
    }
  }

  return { createdCount, skippedCount, errors: errors.slice(0, 20) };
}

/**
 * Process report generation
 */
async function processReportGeneration(data) {
  const { classId, courseId, userId } = data;
  
  // Placeholder for report generation logic
  // This would integrate with the existing report generation code
  
  return {
    success: true,
    reportId: 'generated-report-id',
    generatedAt: new Date()
  };
}

/**
 * Process notification
 */
async function processNotification(data) {
  const { userId, studentIndex, message, type } = data;
  
  await prisma.notification.create({
    data: {
      userId,
      studentIndex,
      message,
      type: type || 'INFO',
      isRead: false
    }
  });

  return { success: true };
}

/**
 * Process data export
 */
async function processDataExport(data) {
  const { type, filters, userId } = data;
  
  // Placeholder for data export logic
  // This would generate CSV/Excel files for download
  
  return {
    success: true,
    downloadUrl: '/exports/data-export.csv',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
}

/**
 * Add job to queue
 */
async function addJob(queueName, jobType, data, options = {}) {
  const queue = queues[queueName];
  
  if (!queue) {
    console.warn(`⚠️  Queue ${queueName} not available. Processing synchronously.`);
    return null;
  }

  try {
    const job = await queue.add(jobType, data, options);
    return {
      jobId: job.id,
      queue: queueName,
      type: jobType
    };
  } catch (error) {
    console.error(`❌ Failed to add job to ${queueName}:`, error.message);
    throw error;
  }
}

/**
 * Get job status
 */
async function getJobStatus(queueName, jobId) {
  const queue = queues[queueName];
  
  if (!queue) {
    return { error: 'Queue not available' };
  }

  try {
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return { error: 'Job not found' };
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      state,
      progress,
      result,
      failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get queue statistics
 */
async function getQueueStats(queueName) {
  const queue = queues[queueName];
  
  if (!queue) {
    return { error: 'Queue not available' };
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Clean old jobs
 */
async function cleanQueue(queueName, grace = 24 * 60 * 60 * 1000) {
  const queue = queues[queueName];
  
  if (!queue) {
    return { error: 'Queue not available' };
  }

  try {
    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    
    return { success: true, message: `Cleaned jobs older than ${grace}ms` };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Graceful shutdown
 */
async function closeQueues() {
  console.log('🔄 Closing queue connections...');
  
  for (const [name, queue] of Object.entries(queues)) {
    if (queue) {
      try {
        await queue.close();
        console.log(`✅ Closed queue: ${name}`);
      } catch (error) {
        console.error(`❌ Error closing queue ${name}:`, error.message);
      }
    }
  }
}

// Initialize queues on module load
const queuesEnabled = initializeQueues();

// Graceful shutdown
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);

module.exports = {
  queues,
  queuesEnabled,
  addJob,
  getJobStatus,
  getQueueStats,
  cleanQueue,
  closeQueues
};
