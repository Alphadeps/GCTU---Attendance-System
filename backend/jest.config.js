/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  // Suppress noisy console output from production modules during tests
  silent: false,
  // Load .env.test before running any test
  globalSetup: './tests/helpers/globalSetup.js',
  globalTeardown: './tests/helpers/globalTeardown.js',
};
