#!/bin/bash
# Test Commands - Quick Reference
# Individual test commands you can run

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="tests/test-results"
mkdir -p "$RESULTS_DIR"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Test Commands - Quick Reference${NC}"
echo ""
echo "Run any of these commands:"
echo ""
echo -e "${GREEN}# Run all tests${NC}"
echo "npm test"
echo ""
echo -e "${GREEN}# Run all tests and save results${NC}"
echo "npm test > $RESULTS_DIR/all-tests-\$(date +%Y%m%d-%H%M%S).txt 2>&1"
echo ""
echo -e "${GREEN}# Run unit tests only${NC}"
echo "npm run test:unit"
echo ""
echo -e "${GREEN}# Run unit tests and save results${NC}"
echo "npm run test:unit > $RESULTS_DIR/unit-tests-\$(date +%Y%m%d-%H%M%S).txt 2>&1"
echo ""
echo -e "${GREEN}# Run API tests${NC}"
echo "npx vitest run tests/src/api/"
echo ""
echo -e "${GREEN}# Run API tests and save results${NC}"
echo "npx vitest run tests/src/api/ > $RESULTS_DIR/api-tests-\$(date +%Y%m%d-%H%M%S).txt 2>&1"
echo ""
echo -e "${GREEN}# Run integration tests${NC}"
echo "npx vitest run tests/src/integration/"
echo ""
echo -e "${GREEN}# Run integration tests and save results${NC}"
echo "npx vitest run tests/src/integration/ > $RESULTS_DIR/integration-tests-\$(date +%Y%m%d-%H%M%S).txt 2>&1"
echo ""
echo -e "${GREEN}# Run with coverage${NC}"
echo "npm run test:coverage"
echo ""
echo -e "${GREEN}# Run with coverage and save results${NC}"
echo "npm run test:coverage > $RESULTS_DIR/coverage-\$(date +%Y%m%d-%H%M%S).txt 2>&1"
echo ""
echo -e "${GREEN}# Run specific test file${NC}"
echo "npx vitest run tests/src/api/document-endpoints.test.js"
echo ""
echo -e "${GREEN}# Run tests in watch mode${NC}"
echo "npm run test:watch"
echo ""
echo -e "${GREEN}# Run tests with UI${NC}"
echo "npm run test:ui"
echo ""
echo -e "${GREEN}# View latest test results${NC}"
echo "./tests/view-latest.sh"
echo ""
echo -e "${GREEN}# Run all tests and save (full suite)${NC}"
echo "./tests/run-tests.sh"
echo ""

