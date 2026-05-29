const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });

module.exports = async () => {
  // Ensure tests use the test database, not production
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set. Create backend/.env.test with TEST_DATABASE_URL.');
  }
};
