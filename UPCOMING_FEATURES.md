# Upcoming Features

This document tracks planned features and improvements for the Saarthi Clinical Platform.

## 1. Evaluation Framework (Evals)

### Overview

Implement a comprehensive evaluation framework to measure and improve AI extraction accuracy, search relevance, and overall system performance.

### Goals

- **Extraction Accuracy**: Measure how accurately AI extracts structured data from documents
- **Search Relevance**: Evaluate semantic search result quality
- **End-to-End Testing**: Test complete workflows with real-world scenarios
- **Continuous Improvement**: Use eval results to refine prompts and models

### Implementation Plan

#### Phase 1: Extraction Eval Framework

**Components:**
- Test dataset of annotated medical documents
- Ground truth data (manually verified extractions)
- Comparison logic (extracted vs ground truth)
- Metrics calculation (precision, recall, F1-score per field)

**Metrics:**
- Field-level accuracy (diagnosis, staging, treatment, etc.)
- Provider comparison (Gemini vs OpenAI)
- Document type performance (pathology vs radiology vs discharge summaries)
- Error categorization (missing fields, incorrect values, type mismatches)

**Implementation:**
```javascript
// src/services/evaluation/extraction-eval.js
class ExtractionEvaluator {
  async evaluateDocument(documentId, groundTruth) {
    // Run extraction
    // Compare with ground truth
    // Calculate metrics
  }
  
  async evaluateProvider(provider, testSet) {
    // Run extraction for all test documents
    // Aggregate metrics
    // Generate report
  }
}
```

#### Phase 2: Search Eval Framework

**Components:**
- Query-document relevance pairs
- Expected results for each query
- Relevance scoring (MRR, NDCG, precision@k)

**Metrics:**
- Mean Reciprocal Rank (MRR)
- Normalized Discounted Cumulative Gain (NDCG)
- Precision@k (top-k results)
- Query type performance (diagnosis queries vs treatment queries)

**Implementation:**
```javascript
// src/services/evaluation/search-eval.js
class SearchEvaluator {
  async evaluateQuery(query, expectedResults) {
    // Run search
    // Compare results with expected
    // Calculate relevance metrics
  }
  
  async evaluateSearchSystem(testQueries) {
    // Run all test queries
    // Aggregate metrics
    // Generate report
  }
}
```

#### Phase 3: Eval Infrastructure

**Components:**
- Eval dataset management (store test cases)
- Eval execution engine (run evals on schedule)
- Eval results dashboard (visualize metrics over time)
- Automated regression testing (fail builds on metric degradation)

**Endpoints:**
```bash
POST /api/v1/eval/extraction/run      # Run extraction eval
POST /api/v1/eval/search/run           # Run search eval
GET  /api/v1/eval/results              # Get eval results
GET  /api/v1/eval/results/:id          # Get specific eval run
```

### Benefits

- **Data-Driven Improvements**: Know which areas need improvement
- **Provider Selection**: Choose best AI provider for each document type
- **Quality Assurance**: Catch regressions before production
- **Continuous Learning**: Improve prompts based on eval results

### Timeline

- **Phase 1**: 2-3 weeks (extraction eval framework)
- **Phase 2**: 2-3 weeks (search eval framework)
- **Phase 3**: 2-3 weeks (infrastructure and automation)

---

## 2. Input Validation with Zod

### Overview

Implement comprehensive input validation using Zod schemas across all API endpoints to ensure data integrity and type safety.

### Goals

- **Type Safety**: Validate all request bodies, query parameters, and path parameters
- **Error Messages**: Provide clear, actionable validation errors
- **Documentation**: Auto-generate API docs from Zod schemas
- **Runtime Safety**: Catch invalid data before processing

### Implementation Plan

#### Phase 1: Core Validation Schemas

**Create Zod schemas for all data models:**

```typescript
// src/schemas/patient.schema.js
import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(1).max(200),
  age: z.number().int().min(0).max(150),
  age_unit: z.enum(['years', 'months', 'days']).optional(),
  sex: z.enum(['male', 'female', 'other']),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  patient_id_uhid: z.string().max(100).optional(),
  patient_id_ipd: z.string().max(100).optional(),
  primary_oncologist: z.string().max(200).optional(),
  primary_center: z.string().max(200).optional(),
  current_status: z.enum(['active', 'on_treatment', 'follow_up', 'archived']).optional(),
  caregiver: z.object({
    name: z.string().min(1),
    relation: z.string(),
    contact: z.string()
  }).optional()
});

export const updatePatientSchema = createPatientSchema.partial();
```

**Apply to all endpoints:**
- Patients (create, update)
- Documents (upload metadata)
- Diagnosis (create, update)
- Staging (create, update)
- Treatment (create, update)
- Medications (create, update)
- Labs (create)
- Alerts (create, update)

#### Phase 2: Validation Middleware

**Create reusable validation middleware:**

```javascript
// src/middleware/validation.js
import { z } from 'zod';

export function validateBody(schema) {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set('validatedBody', validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors
        }, 400);
      }
      throw error;
    }
  };
}

export function validateQuery(schema) {
  return async (c, next) => {
    try {
      const query = Object.fromEntries(c.req.query());
      const validated = schema.parse(query);
      c.set('validatedQuery', validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors
        }, 400);
      }
      throw error;
    }
  };
}
```

**Usage in routes:**
```javascript
// src/routes/patients.js
import { validateBody } from '../middleware/validation.js';
import { createPatientSchema } from '../schemas/patient.schema.js';

patients.post('/', 
  createAuthMiddleware(),
  validateBody(createPatientSchema),
  async (c) => {
    const data = c.get('validatedBody'); // Type-safe, validated data
    // ... route logic
  }
);
```

#### Phase 3: Advanced Validation

**Custom validators for clinical data:**
- Date ranges (diagnosis_date must be before treatment_start_date)
- Numeric ranges (age, lab values within reasonable bounds)
- Enum validation (staging values, medication routes)
- Cross-field validation (if treatment exists, diagnosis must exist)

**File upload validation:**
- File type validation (PDF, images)
- File size limits
- MIME type verification

#### Phase 4: Schema Documentation

**Auto-generate API documentation from Zod schemas:**
- OpenAPI/Swagger spec generation
- Request/response examples
- Validation rules documentation

### Benefits

- **Type Safety**: Catch errors at request time, not during processing
- **Better Errors**: Clear validation messages help frontend developers
- **Documentation**: Schemas serve as living documentation
- **Maintainability**: Single source of truth for data shapes
- **Security**: Prevent injection attacks through strict validation

### Example Error Response

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid request data",
  "details": [
    {
      "path": ["age"],
      "message": "Expected number, received string",
      "code": "invalid_type"
    },
    {
      "path": ["sex"],
      "message": "Invalid enum value. Expected 'male' | 'female' | 'other', received 'M'",
      "code": "invalid_enum_value"
    }
  ]
}
```

### Migration Strategy

1. **Add Zod dependency** (already in package.json)
2. **Create schemas incrementally** (start with most-used endpoints)
3. **Add validation middleware** to routes one by one
4. **Update error handling** to return validation errors consistently
5. **Add tests** for validation edge cases

### Timeline

- **Phase 1**: 1-2 weeks (core schemas for all models)
- **Phase 2**: 1 week (validation middleware)
- **Phase 3**: 1-2 weeks (advanced validation rules)
- **Phase 4**: 1 week (documentation generation)

---

## Future Considerations

### Additional Features to Consider

1. **Multi-Language Support**: Support for documents in multiple languages
2. **Advanced Analytics**: Patient outcome tracking, treatment effectiveness metrics
3. **Integration APIs**: HL7 FHIR integration, EMR system connectors
4. **Mobile App**: Native mobile app for document capture
5. **Real-Time Collaboration**: Multiple doctors editing same patient record
6. **Advanced Search**: Multi-modal search (text + images), temporal queries
7. **AI Assistants**: Chat interface for clinical questions using RAG
8. **Automated Alerts**: Rule-based alerting for critical findings

### Technical Debt

1. **Test Coverage**: Increase unit and integration test coverage
2. **Error Handling**: Standardize error responses across all endpoints
3. **Logging**: Structured logging with correlation IDs
4. **Monitoring**: Add metrics and alerting for production
5. **Performance**: Optimize slow queries, add caching where appropriate

---

**Last Updated**: 2025-01-XX
**Status**: Planning Phase

