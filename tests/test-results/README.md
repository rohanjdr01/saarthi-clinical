# Test Results Directory

This directory contains test execution results for the Document Categorization Framework.

## Files

- **`unit-tests-*.txt`** - Unit test results (classification service, reference data)
- **`api-tests-*.txt`** - API endpoint test results (triage, document list)
- **`integration-tests-*.txt`** - Integration test results (end-to-end flows)
- **`all-tests-*.txt`** - Complete test suite results
- **`coverage-*.txt`** - Code coverage reports
- **`test-summary-*.md`** - Summary reports with test status

## Viewing Results

### Quick Status Check

```bash
# View latest unit test results
tail -n 50 test-results/unit-tests-*.txt | tail -n 30

# View latest API test results
cat test-results/api-tests-*.txt

# View latest integration test results
tail -n 50 test-results/integration-tests-*.txt | tail -n 30

# Check test pass/fail summary
grep -E "(PASS|FAIL|✓|✗)" test-results/all-tests-*.txt | tail -n 20

# Check coverage summary
grep -A 10 "Coverage" test-results/coverage-*.txt | head -n 30
```

### View Specific Test File

```bash
# Find latest test result file
ls -t test-results/unit-tests-*.txt | head -1 | xargs cat

# View with less (scrollable)
ls -t test-results/all-tests-*.txt | head -1 | xargs less
```

## Running Tests and Saving Results

```bash
# Run all tests and save results
npm test > test-results/all-tests-$(date +%Y%m%d-%H%M%S).txt 2>&1

# Run unit tests only
npm run test:unit > test-results/unit-tests-$(date +%Y%m%d-%H%M%S).txt 2>&1

# Run with coverage
npm run test:coverage > test-results/coverage-$(date +%Y%m%d-%H%M%S).txt 2>&1

# Run API tests
npx vitest run src/tests/api/ > test-results/api-tests-$(date +%Y%m%d-%H%M%S).txt 2>&1

# Run integration tests
npx vitest run src/tests/integration/ > test-results/integration-tests-$(date +%Y%m%d-%H%M%S).txt 2>&1
```

## Test Categories

### Unit Tests
- Classification prompt generation
- Category/subcategory parsing
- Facility normalization
- Reference data validation

### API Tests
- Triage endpoint with `by_category` summary
- Document list filtering by category/subcategory
- Response format validation

### Integration Tests
- Full classification flow
- Error handling
- Bulk classification

## Notes

- Test results are timestamped for easy tracking
- All output (stdout and stderr) is captured
- Coverage reports include line, function, and branch coverage
- Failed tests will show detailed error messages in the output files

