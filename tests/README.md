# Tests Directory

All test-related files are organized in this directory.

## Directory Structure

```
tests/
├── src/                          # Test source files
│   ├── unit/                     # Unit tests
│   │   ├── classification.test.js
│   │   ├── document-categories.test.js
│   │   └── ...
│   ├── api/                      # API endpoint tests
│   │   ├── triage-categories.test.js
│   │   ├── documents-filter.test.js
│   │   └── document-endpoints.test.js
│   ├── integration/              # Integration tests
│   │   └── classification-flow.test.js
│   └── setup.js                  # Test setup file
├── test-results/                 # Test execution results
│   ├── all-tests-*.txt
│   ├── unit-tests-*.txt
│   ├── api-tests-*.txt
│   ├── integration-tests-*.txt
│   ├── coverage-*.txt
│   └── *.md                      # Summary reports
├── run-tests.sh                  # Run all tests and save results
├── test-commands.sh              # Quick reference for test commands
├── view-latest.sh                # View latest test results
└── README.md                     # This file
```

## Quick Start

### Run All Tests
```bash
./tests/run-tests.sh
```

### View Test Commands
```bash
./tests/test-commands.sh
```

### View Latest Results
```bash
./tests/view-latest.sh
```

## Test Commands

### Using npm scripts
```bash
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:api           # Run API tests only
npm run test:integration   # Run integration tests only
npm run test:watch         # Run in watch mode
npm run test:ui            # Run with UI
npm run test:coverage      # Run with coverage
```

### Using vitest directly
```bash
# Run specific test file
npx vitest run tests/src/api/document-endpoints.test.js

# Run all tests in a directory
npx vitest run tests/src/api/

# Run with watch mode
npx vitest tests/src/
```

## Test Results

All test results are saved to `tests/test-results/` with timestamps:
- `all-tests-YYYYMMDD-HHMMSS.txt` - Complete test suite
- `unit-tests-YYYYMMDD-HHMMSS.txt` - Unit tests only
- `api-tests-YYYYMMDD-HHMMSS.txt` - API tests only
- `integration-tests-YYYYMMDD-HHMMSS.txt` - Integration tests
- `coverage-YYYYMMDD-HHMMSS.txt` - Coverage report

## Test Categories

### Unit Tests
- Classification service
- Document categories reference data
- Facility normalization
- Category validation

### API Tests
- Triage endpoint with categories
- Document list filtering
- Single document retrieval
- Document metadata updates
- Classification endpoints
- Batch operations

### Integration Tests
- Full classification flow
- Error handling
- Bulk classification

## Configuration

Test configuration is in `vitest.config.js` at the project root.

## Notes

- Tests use mocked data (no real database/API calls)
- Test timeout: 30 seconds
- Coverage threshold: 50% (configurable)

