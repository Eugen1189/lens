module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    'legacylens-cli.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    // Exclude CLI entry points and AI client (require integration tests with API mocks)
    '!src/cli.js',
    '!legacylens-cli.js',
    '!src/core/ai-client.js',
    '!src/utils/analyzer.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  verbose: true,
  moduleNameMapper: {
    '^marked$': '<rootDir>/__mocks__/marked.js'
  }
};
