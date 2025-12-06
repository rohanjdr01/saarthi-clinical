# Test Suite - Document Categorization

This directory contains comprehensive tests for the new document categorization framework.

## Test Structure

```
tests/
├── unit/
│   ├── classification.test.js          # Classification service unit tests
│   └── document-categories.test.js     # Reference data validation tests
├── api/
│   ├── triage-categories.test.js      # Triage endpoint with categories
│   └── documents-filter.test.js       # Document list filtering tests
└── integration/
    └── classification-flow.test.js    # End-to-end classification flow
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run with Watch Mode
```bash
npm run test:watch
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npx vitest run src/tests/unit/classification.test.js
```

## Test Coverage

### 1. Classification Service (`unit/classification.test.js`)
- ✅ Prompt generation with 7 categories
- ✅ Subcategory inclusion
- ✅ Facility normalization (TMH → Tata Memorial Hospital)
- ✅ Response parsing (category/subcategory/facility/is_handwritten)
- ✅ Category validation
- ✅ Backward compatibility (document_category mapping)

### 2. Reference Data (`unit/document-categories.test.js`)
- ✅ All 7 primary categories exist
- ✅ Pathology subcategories (biopsy, fnac, ihc, etc.)
- ✅ Imaging subcategories (ct, pet, mri, etc.)
- ✅ Extraction priorities (P0/P1/P2/P3)
- ✅ Display names for all entries
- ✅ Primary key constraints

### 3. Triage Endpoint (`api/triage-categories.test.js`)
- ✅ `by_category` summary in response
- ✅ Category/subcategory in document objects
- ✅ `category_display` from join
- ✅ `extraction_priority` field
- ✅ Facility field
- ✅ Grouping by classification with category info

### 4. Document List Filtering (`api/documents-filter.test.js`)
- ✅ Filter by category (`?category=pathology`)
- ✅ Filter by category + subcategory (`?category=pathology&subcategory=biopsy`)
- ✅ Combined filters (category + date range)
- ✅ Response format validation
- ✅ Empty results handling

### 5. Integration Flow (`integration/classification-flow.test.js`)
- ✅ Full classification flow
- ✅ Facility normalization during classification
- ✅ Category validation
- ✅ Error handling
- ✅ Bulk classification

## Test Data

Tests use mocked data to avoid requiring:
- Real database connections
- Actual AI API calls
- R2 storage access

## Manual Testing Checklist

For E2E verification, test these scenarios:

1. **Re-classify existing document**
   ```bash
   POST /api/v1/patients/{id}/documents/{docId}/classify
   ```
   Verify response includes: `category`, `subcategory`, `facility`

2. **Check triage endpoint**
   ```bash
   GET /api/v1/patients/{id}/documents/triage
   ```
   Verify `summary.by_category` exists and has counts

3. **Filter documents**
   ```bash
   GET /api/v1/patients/{id}/documents?category=pathology&subcategory=biopsy
   ```
   Verify only matching documents returned

4. **Check database**
   ```sql
   SELECT category, subcategory, facility FROM documents WHERE id = 'doc_xxx';
   ```
   Verify columns populated correctly

## Notes

- Tests use Vitest framework
- Mocked environment to avoid external dependencies
- Coverage threshold: 50% (configurable in `vitest.config.js`)
- Test timeout: 30 seconds

