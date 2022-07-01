/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  testTimeout: 30000, // 30 secs
  // maxWorkers: 1, // same as runInBand
  roots: ['<rootDir>/src/api/v1/__tests__'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['dotenv-safe/config'],
};