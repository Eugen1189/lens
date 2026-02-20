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
    '!src/utils/analyzer.js',
    // Exclude heavy/API-dependent modules (covered by integration or manual tests)
    '!src/core/auto-fix.js',
    '!src/core/code-generator.js',
    '!src/core/context-builder.js',
    '!src/core/context-engine.js',
    '!src/core/engines.js',
    '!src/core/semantic-indexer.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 15000,
  verbose: true,
  moduleNameMapper: {
    '^marked$': '<rootDir>/__mocks__/marked.js'
  }
};
