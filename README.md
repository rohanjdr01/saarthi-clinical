# Saarthi Clinical Platform

AI-powered clinical dashboard for oncology patient management, featuring document processing, semantic search (RAG), and structured data extraction.

## Overview

Saarthi Clinical is a Cloudflare Workers-based platform that processes medical documents using AI (Gemini and OpenAI), extracts structured clinical data, and provides semantic search capabilities through vector embeddings. It's designed for healthcare providers managing oncology patients with complex medical histories.

## Key Features

- **Document Categorization**: Intelligent 7-category system (pathology, imaging, laboratory, clinical, treatment, surgical, admin) with 40+ subcategories
- **Facility Normalization**: Automatic hospital/lab name normalization (TMH → Tata Memorial Hospital)
- **Category-Based Filtering**: Filter documents by category/subcategory for efficient triage
- **Extraction Priority**: P0/P1/P2/P3 priority levels control extraction depth
- **Document Processing**: Upload and process medical documents (PDFs, images) with AI extraction
- **Semantic Search (RAG)**: Natural language search across all patient documents using Gemini filesearch (fall back: Cloudflare Vectorize)
- **Structured Data Extraction**: Automatically extract diagnosis, staging, treatment, medications, labs, and more
- **Version History**: Track all manual edits with full audit trail
- **Field-Level Source Tracking**: Know whether data came from documents or AI inference
- **Multi-Document Upload**: Upload multiple documents at once with case-pack organization
- **Real-Time Processing**: Fast mode for immediate searchability, full mode for complete extraction

## Architecture

### Technology Stack

- **Runtime**: Cloudflare Workers (Edge computing)
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite-based)
- **Storage**: Cloudflare R2 (object storage for documents)
- **Vector Search**: Cloudflare Vectorize (semantic search)
- **AI Providers**: Google Gemini, OpenAI
- **Authentication**: Firebase Authentication
- **Queue**: Cloudflare Queues (async document processing)

### System Architecture

```
┌─────────────┐
│   Client    │
│  (Frontend) │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│      Cloudflare Workers             │
│  ┌───────────────────────────────┐  │
│  │      Hono Application         │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │   Route Handlers        │  │  │
│  │  │  - Patients             │  │  │
│  │  │  - Documents            │  │  │
│  │  │  - Diagnosis/Staging    │  │  │
│  │  │  - Treatment            │  │  │
│  │  │  - Medications          │  │  │
│  │  │  - Labs/Alerts          │  │  │
│  │  └─────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │   Services Layer       │  │  │
│  │  │  - DocumentProcessor   │  │  │
│  │  │  - VectorizeIndexer    │  │  │
│  │  │  - GeminiClient        │  │  │
│  │  │  - OpenAIClient         │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       ├──► D1 Database (SQLite)
       ├──► R2 Storage (Documents)
       ├──► Vectorize (Embeddings)
       ├──► KV Cache
       └──► Queues (Async Processing)
```

### Data Flow

#### Document Upload & Processing

1. **Upload**: Client uploads document(s) → Stored in R2 → Metadata saved to D1
2. **Fast Mode** (default):
   - Extract medical highlight (1-line summary)
   - Chunk document text
   - Generate embeddings via Workers AI
   - Store in Vectorize
   - Document searchable immediately (~5-10 seconds)
3. **Full Mode**:
   - Complete AI extraction (diagnosis, staging, treatment, etc.)
   - Sync extracted data to patient profile
   - Update timeline events
   - Then vectorize for search (~30-60 seconds)

#### Semantic Search (RAG)

1. User submits natural language query
2. Query converted to embedding via Workers AI
3. Vectorize similarity search across all patient document chunks
4. Return top-k most relevant chunks with relevance scores
5. Optionally generate answer using LLM

### Design Decisions

#### 1. Edge-First Architecture

**Decision**: Use Cloudflare Workers for all compute

**Rationale**:
- Low latency (global edge network)
- No cold starts (always-on workers)
- Cost-effective for variable workloads
- Built-in integrations (D1, R2, Vectorize, Queues)

**Trade-offs**:
- CPU time limits (30s for free tier, 50ms CPU time per request)
- Requires async processing for long operations (Queues)
- Limited local development capabilities for some features

#### 2. Multi-Provider AI Strategy

**Decision**: Support both Gemini and OpenAI

**Rationale**:
- Redundancy and failover
- Cost optimization (choose cheaper provider)
- Feature diversity (Gemini File Search vs OpenAI structured outputs)
- Provider-specific strengths

**Implementation**:
- Provider selected per request via `provider` parameter
- Consistent extraction schema across providers
- Fallback logic for API failures

#### 3. Two-Tier Processing Modes

**Decision**: Fast mode (highlight + vectorize) vs Full mode (complete extraction)

**Rationale**:
- Fast mode enables immediate searchability without waiting for full extraction
- Full mode provides comprehensive data sync but takes longer
- Users can choose based on use case
- Reduces token costs for documents that only need search

**Trade-offs**:
- Two code paths to maintain
- Users must understand when to use each mode

#### 4. Field-Level Source Tracking

**Decision**: Track data source at field level (document_id vs "ai_inferred")

**Rationale**:
- Clinical data provenance is critical
- Enables audit trails
- Helps identify which documents contributed to which fields
- Supports manual review workflows

**Implementation**:
- Metadata stored in JSON fields: `{field_name: {value, source, timestamp}}`
- Source can be document ID or "ai_inferred"
- Version history tracks source changes

#### 5. Version History System

**Decision**: Full version history for all manual edits

**Rationale**:
- Clinical data edits require audit trails
- Supports rollback capabilities
- Enables compliance requirements
- Tracks who made changes and why

**Implementation**:
- `data_versions` table stores all field changes
- Links to original source (document or AI)
- Admin-only edit endpoints create version entries
- Supports rollback to previous versions

#### 6. Case-Pack Merged into Documents

**Decision**: Remove separate case-pack endpoints, merge into documents table

**Rationale**:
- Simplifies API surface
- Documents naturally form a case-pack per patient
- Reduces database joins
- `case_pack_order` field provides ordering

**Trade-offs**:
- Less explicit case-pack management
- Ordering handled at document level

#### 7. Queue-Based Async Processing

**Decision**: Use Cloudflare Queues for full-mode processing

**Rationale**:
- Full extraction takes 30-60 seconds (exceeds Worker CPU limits)
- Queues provide reliable async processing
- Automatic retries on failure
- Better user experience (immediate response)

**Implementation**:
- Fast mode: synchronous (within Worker limits)
- Full mode: enqueue job, process asynchronously
- Queue consumer handles batch processing
- Status tracked in database

#### 8. Consistent Extraction Schema

**Decision**: Same extraction schema regardless of AI provider

**Rationale**:
- Predictable data structure
- Easier frontend integration
- Consistent field names
- Works identically with Gemini and OpenAI

**Implementation**:
- `extraction-schema.js` defines unified schema
- Provider-specific adapters convert to schema
- Validation ensures consistency

#### 9. Document Categorization Framework

**Decision**: 7-category system with 40+ subcategories for Indian oncology documents

**Rationale**:
- Enables category-based filtering and triage
- Supports extraction priority (P0/P1/P2/P3)
- Facility normalization improves data quality
- Tailored for Indian healthcare context

**Categories**:
- **pathology**: biopsy, histopathology, ihc, cytology, molecular
- **imaging**: ct, mri, pet, xray, ultrasound, mammography
- **laboratory**: cbc, lft, kft, tumor_markers, coagulation, serology
- **clinical**: consultation, discharge, opd, emergency, followup
- **treatment**: chemotherapy, radiation, immunotherapy, targeted_therapy
- **surgical**: operative_notes, discharge_summary, postop
- **admin**: prescription, referral, insurance, consent

**Implementation**:
- AI classification extracts category, subcategory, facility, and document_date
- `document_categories` reference table stores valid combinations
- Facility names normalized (e.g., "TMH" → "Tata Memorial Hospital")
- Extraction priority assigned based on category/subcategory
- Triage queue groups by category for efficient review

## Project Structure

```
saarthi-clinical/
├── src/
│   ├── index.js                 # Main entry point (Hono app + queue consumer)
│   ├── routes/                  # API route handlers
│   │   ├── patients.js         # Patient CRUD
│   │   ├── documents.js        # Document upload, search, vectorize
│   │   ├── diagnosis.js        # Diagnosis & staging
│   │   ├── treatment.js        # Treatment & cycles
│   │   ├── medications.js      # Medications
│   │   ├── alerts.js           # Clinical alerts
│   │   ├── labs.js             # Lab results
│   │   ├── timeline.js         # Timeline events
│   │   ├── history.js          # Medical/surgical/family/social history
│   │   ├── decisions.js        # Clinical decisions & MDT
│   │   └── auth.js             # Authentication
│   ├── models/                 # Data models
│   │   ├── patient.js
│   │   ├── document.js
│   │   ├── diagnosis.js
│   │   ├── staging.js
│   │   ├── treatment.js
│   │   └── data-version.js     # Version history
│   ├── repositories/           # Data access layer
│   │   ├── patient.repository.js
│   │   ├── document.repository.js
│   │   └── ...
│   ├── services/               # Business logic
│   │   ├── processing/
│   │   │   ├── processor.js    # Document processing orchestration
│   │   │   └── extraction-schema.js  # Unified extraction schema
│   │   ├── vectorize/
│   │   │   └── indexer.js      # Vectorize integration
│   │   ├── gemini/
│   │   │   ├── client.js       # Gemini API client
│   │   │   └── file-search.js # Gemini File Search integration
│   │   └── openai/
│   │       └── client.js       # OpenAI API client
│   ├── middleware/
│   │   ├── auth.js             # Firebase auth middleware
│   │   └── logger.js           # Request logging
│   └── utils/
│       ├── data-source.js      # Field-level source tracking
│       └── errors.js           # Error handling
├── migrations/                 # Database migrations
├── schema.sql                  # Database schema
├── wrangler.toml               # Cloudflare configuration
└── package.json
```

## Database Schema

### Core Tables

- **patients**: Patient demographics and identifiers
- **documents**: Document metadata and processing status
- **diagnosis**: Cancer diagnosis details
- **staging**: TNM staging information
- **treatment**: Treatment regimens
- **treatment_cycles**: Individual cycle details
- **medications**: Patient medications
- **alerts**: Clinical alerts and risk factors
- **lab_results**: Lab test results
- **tumor_markers**: Tumor marker values
- **data_versions**: Version history for all edits

### Key Design Patterns

1. **Soft Deletes**: Records marked as archived, not deleted
2. **Timestamps**: Unix timestamps (INTEGER) for all dates
3. **JSON Fields**: Flexible JSON storage for complex nested data
4. **Foreign Keys**: Referential integrity with CASCADE deletes
5. **Indexes**: Optimized for common query patterns

## Authentication & Authorization

### Firebase Authentication

- **Provider**: Firebase Authentication
- **Methods**: Phone OTP, Google OAuth, Email/Password
- **Token Flow**: Client gets Firebase ID token → Backend verifies → Creates/updates user in D1
- **Token Usage**: Include in `Authorization: Bearer <token>` header

### Role-Based Access Control

- **Roles**: `user`, `doctor`, `admin`, `case_manager`
- **Default**: New users get `user` role
- **Admin Edits**: Only admins can edit clinical data (creates version history)
- **Middleware**: `requireRole(['doctor', 'admin'])` for protected endpoints

## Development

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account
- Firebase project

### Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Authenticate with Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Create local database:**
   ```bash
   npm run d1:init
   ```

4. **Set up environment variables:**
   Create `.dev.vars`:
   ```bash
   GEMINI_API_KEY=your-key
   OPENAI_API_KEY=your-key
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
   FIREBASE_API_KEY=your-key
   ```

5. **Start dev server:**
   ```bash
   npm run dev
   ```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## Deployment

### Production Deployment

1. **Set production secrets:**
   ```bash
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --env production
   npx wrangler secret put GEMINI_API_KEY --env production
   npx wrangler secret put OPENAI_API_KEY --env production
   ```

2. **Apply schema:**
   ```bash
   npx wrangler d1 execute saarthi-clinical-prod --remote --file=schema.sql
   ```

3. **Deploy:**
   ```bash
   npm run deploy:production
   ```

### Environments

- **Development**: Default (local or dev workers)
- **Staging**: `--env staging`
- **Production**: `--env production`

See `wrangler.toml` for environment-specific configuration.

## API Documentation

- **Quick Start**: See [QUICK_START.md](./QUICK_START.md) for endpoint usage
- **Full API Reference**: See `refactored_api_endpoints.md` for complete endpoint documentation
- **Postman Collection**: Import `postman_collection.json`

## Performance Considerations

### Processing Times

- **Fast Mode**: 5-10 seconds (highlight + vectorize)
- **Full Mode**: 30-60 seconds (complete extraction + sync)

### Vectorize Search

- **Latency**: <100ms for queries
- **Throughput**: Handles high query volumes
- **Limitations**: Only works in production/staging (not local)

### Database Queries

- **D1 Performance**: Fast for most queries (<10ms)
- **Optimization**: Indexes on common query fields
- **Limitations**: No complex joins, use denormalization where needed

## Security

### Best Practices

1. **Secrets Management**: Use Wrangler secrets, never commit to git
2. **Token Validation**: All Firebase tokens verified server-side
3. **Role-Based Access**: Protected endpoints require appropriate roles
4. **Input Validation**: All inputs validated before processing
5. **CORS**: Restricted to known origins
6. **Rate Limiting**: Consider implementing for production

### Data Privacy

- **PHI Handling**: Medical documents contain PHI - ensure compliance
- **Storage**: Documents stored in R2 (encrypted at rest)
- **Access Control**: Role-based access to patient data
- **Audit Trails**: Version history provides audit capability

## Monitoring & Debugging

### Logs

```bash
# Production logs
npx wrangler tail --env production

# Filter for errors
npx wrangler tail --env production --format=pretty | grep ERROR
```

### Health Checks

```bash
# Basic health
GET /api/v1/health

# Database diagnostic
GET /api/v1/health/db
```

### Common Issues

- **Processing stuck**: Check queue consumer logs
- **RAG not working**: Verify Vectorize index exists and document is vectorized
- **Auth failures**: Check Firebase token expiration (1 hour)
- **Database errors**: Verify schema is applied correctly

## Contributing

1. Follow existing code structure
2. Add tests for new features
3. Update documentation
4. Use consistent error handling patterns

## License

ISC

## Support

- **Issues**: Check logs first with `wrangler tail`
- **Documentation**: See [QUICK_START.md](./QUICK_START.md) and [UPCOMING_FEATURES.md](./UPCOMING_FEATURES.md)
- **Cloudflare Docs**: https://developers.cloudflare.com/workers/

