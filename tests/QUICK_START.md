# Quick Start - Running Tests

## 🚀 Run All Tests (Recommended)

```bash
./tests/run-tests.sh
```

This will:
- Run all test suites
- Save results to `tests/test-results/`
- Show summary of all tests

## 📋 Individual Test Commands

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run API Tests Only
```bash
npm run test:api
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run test:watch
```

### Run with UI
```bash
npm run test:ui
```

## 📊 View Results

### View Latest Results
```bash
./tests/view-latest.sh
```

### View All Test Commands
```bash
./tests/test-commands.sh
```

### Browse Results Directory
```bash
cd tests/test-results/
ls -lh
```

## 📁 Test Structure

- `tests/src/unit/` - Unit tests
- `tests/src/api/` - API endpoint tests
- `tests/src/integration/` - Integration tests
- `tests/test-results/` - Test execution results
