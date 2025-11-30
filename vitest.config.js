import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.js'],
    testTimeout: 30000,
    include: [
      'src/tests/**/*.test.js',
      'src/tests/unit/**/*.test.js'
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
        'src/tests/**'
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
