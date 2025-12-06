#!/bin/bash
# Quick script to view latest test results

echo "=== Latest Test Results ==="
echo ""

echo "📊 Unit Tests:"
ls -t tests/test-results/unit-tests-*.txt 2>/dev/null | head -1 | xargs tail -n 30
echo ""

echo "🌐 API Tests:"
ls -t tests/test-results/api-tests-*.txt 2>/dev/null | head -1 | xargs cat
echo ""

echo "🔗 Integration Tests:"
ls -t tests/test-results/integration-tests-*.txt 2>/dev/null | head -1 | xargs tail -n 30
echo ""

echo "📈 Coverage Summary:"
grep -A 15 "Coverage" tests/test-results/coverage-*.txt 2>/dev/null | head -n 20
echo ""

echo "✅ Test Status:"
grep -E "(Test Files|Tests|PASS|FAIL)" tests/test-results/all-tests-*.txt 2>/dev/null | tail -n 10
