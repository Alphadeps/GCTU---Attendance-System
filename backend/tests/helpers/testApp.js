'use strict';
/**
 * Minimal Express app for integration tests.
 * Uses real routes and middleware but skips heavy production setup
 * (monitoring, compression, seed, server.listen).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.test') });

const express = require('express');
const cookieParser = require('cookie-parser');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Mount only the routes exercised by integration tests
  app.use('/api/student-auth', require('../../src/routes/student-auth.routes'));
  app.use('/api/attendance', require('../../src/routes/attendance.routes'));

  // Minimal error handler
  app.use((err, req, res, next) => {
    const status = err.statusCode || (err.code === 'P2002' ? 409 : 500);
    res.status(status).json({ error: err.message || 'Internal error' });
  });

  return app;
}

module.exports = { createTestApp };
