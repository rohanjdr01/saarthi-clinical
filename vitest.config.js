import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/src/setup.js'],
    testTimeout: 30000,
    include: [
      'tests/src/**/*.test.js',
      'tests/src/unit/**/*.test.js',
      'tests/src/api/**/*.test.js',
      'tests/src/integration/**/*.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/services/**/*.js',
        'src/utils/**/*.js',
        'src/models/**/*.js'
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.js',
        'tests/**'
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50
      }
    }
  }
});
