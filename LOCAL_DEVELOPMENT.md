# Local Development Guide

## Prerequisites

- Node.js 18+ installed
- Wrangler CLI installed (`npm install -g wrangler`)
- Cloudflare account (free tier works)

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create Local Database

```bash
# Create a local D1 database for development
wrangler d1 execute saarthi-clinical-dev --local --file=schema.sql
```

### 4. Set Up Environment Variables

Create a `.dev.vars` file in the root directory:

```bash
# .dev.vars (for local development)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
FIREBASE_API_KEY=your_firebase_api_key_here

# Optional - for production Firebase features
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

## Running Locally

### Start Development Server

```bash
npm run dev
# or
wrangler dev --local --persist
```

The API will be available at: `http://localhost:8787`

### Key Flags Explained

- `--local`: Runs everything locally (no cloud resources)
- `--persist`: Persists data between restarts (saves to `.wrangler/state`)

## Testing with Postman

### Option 1: Import Phase 2-3 Additions Collection

1. Open Postman
2. Click **Import**
3. Select `postman_collection_phase2_additions.json`
4. Set the `baseUrl` variable to `http://localhost:8787/api/v1`

### Option 2: Import Full Collection

1. Import `postman_collection.backup.json` for all endpoints
2. Import `postman_collection_phase2_additions.json` for Phase 2-3 endpoints
3. Set environment variables:
   - `baseUrl`: `http://localhost:8787/api/v1`
   - `patientId`: (will be auto-populated after creating a patient)
   - `documentId`: (will be auto-populated after uploading a document)

## Common Workflows

### 1. Create a Patient

```bash
curl -X POST http://localhost:8787/api/v1/patients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Patient",
    "age": 65,
    "sex": "male",
    "blood_type": "O+",
    "ecog_status": 1
  }'
```

### 2. Upload Documents

```bash
curl -X POST http://localhost:8787/api/v1/patients/{patientId}/documents \
  -F "files=@/path/to/document.pdf" \
  -F "category=pathology" \
  -F "process_immediately=true"
```

### 3. Create Diagnosis

```bash
curl -X PUT http://localhost:8787/api/v1/patients/{patientId}/diagnosis \
  -H "Content-Type: application/json" \
  -d '{
    "primary_cancer_type": "Breast Cancer",
    "diagnosis_date": "2024-01-15",
    "tumor_size_cm": 2.5
  }'
```

### 4. Search Documents (RAG)

```bash
curl -X POST http://localhost:8787/api/v1/patients/{patientId}/documents/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "breast cancer diagnosis",
    "top_k": 5
  }'
```

## Database Management

### View Database Contents

```bash
# List all patients
wrangler d1 execute saarthi-clinical-dev --local --command "SELECT * FROM patients"

# List all documents
wrangler d1 execute saarthi-clinical-dev --local --command "SELECT id, filename, category, processing_status FROM documents"

# Check vectorize status
wrangler d1 execute saarthi-clinical-dev --local --command "SELECT id, filename, vectorize_status FROM documents WHERE vectorize_status != 'pending'"
```

### Reset Database

```bash
# Drop all tables and recreate
wrangler d1 execute saarthi-clinical-dev --local --file=schema.sql
```

## Vectorize (Semantic Search)

### Local Development

In local mode, Vectorize uses deterministic hashing (no Workers AI):
- Vectors are 768D but generated deterministically
- Search still works, but quality is lower than production
- No API calls or costs

### Enable Workers AI Locally

To test with real Workers AI embeddings locally:

```bash
# Run with remote mode (uses cloud Vectorize + Workers AI)
wrangler dev --persist
```

**Note:** This will use your Cloudflare account and may incur minimal costs.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 8787
lsof -ti:8787 | xargs kill -9

# Or use a different port
wrangler dev --local --persist --port 8788
```

### Database Not Found

```bash
# Recreate the database
wrangler d1 execute saarthi-clinical-dev --local --file=schema.sql
```

### Vectorize Not Working

```bash
# Check if index exists
wrangler vectorize list

# If not, create it
wrangler vectorize create medical-documents --dimensions=768 --metric=cosine
```

### Clear Persisted State

```bash
# Delete local data
rm -rf .wrangler/state

# Restart dev server
npm run dev
```

## Running Tests

### Unit Tests

```bash
npm test
```

### API Integration Tests

```bash
# Start dev server in one terminal
npm run dev

# Run tests in another terminal
npm run test:api
```

### Test with Vitest Watch Mode

```bash
npm run test:watch
```

## Hot Reloading

Wrangler automatically hot-reloads when you change files:
- Routes: `src/routes/*.js`
- Models: `src/models/*.js`
- Services: `src/services/**/*.js`

Just save your changes and test immediately!

## Project Structure

```
saarthi-clinical/
├── src/
│   ├── index.js              # Main entry point
│   ├── routes/               # API route handlers
│   │   ├── patients.js       # Patient CRUD
│   │   ├── documents.js      # Document upload, vectorize, search
│   │   ├── diagnosis.js      # Diagnosis & Staging
│   │   ├── treatment.js      # Treatment & Cycles
│   │   └── ...
│   ├── models/               # Data models
│   │   ├── patient.js
│   │   ├── document.js
│   │   ├── diagnosis.js
│   │   ├── treatment.js
│   │   └── data-version.js   # Version history
│   ├── services/             # Business logic
│   │   ├── processing/       # Document AI processing
│   │   └── vectorize/        # Vectorize integration
│   │       └── indexer.js    # Embedding + search
│   ├── utils/                # Utilities
│   │   ├── data-source.js    # Field-level tracking
│   │   └── errors.js
│   └── middleware/           # Auth, logging, etc.
├── schema.sql                # Database schema
├── wrangler.toml             # Cloudflare config
├── package.json
└── LOCAL_DEVELOPMENT.md      # This file
```

## New Phase 2-3 Endpoints

### Diagnosis & Staging
- `GET /api/v1/patients/:id/diagnosis` - Get diagnosis
- `PUT /api/v1/patients/:id/diagnosis` - Update diagnosis (creates version)
- `GET /api/v1/patients/:id/staging` - Get staging
- `PUT /api/v1/patients/:id/staging` - Update staging

### Treatment
- `GET /api/v1/patients/:id/treatment` - Get treatment
- `PUT /api/v1/patients/:id/treatment` - Update treatment
- `GET /api/v1/patients/:id/treatment/cycles` - List cycles
- `POST /api/v1/patients/:id/treatment/cycles` - Add cycle
- `GET /api/v1/patients/:id/treatment/cycles/:num` - Get cycle
- `PUT /api/v1/patients/:id/treatment/cycles/:num` - Update cycle

### Vectorize & Search
- `POST /api/v1/patients/:id/documents/:docId/vectorize` - Vectorize document
- `POST /api/v1/patients/:id/documents/search` - Semantic search (RAG)
- `POST /api/v1/patients/:id/documents/reorder` - Reorder case-pack
- `POST /api/v1/patients/:id/documents/:docId/reprocess` - Reprocess document

## Next Steps

1. **Deploy to Production:**
   ```bash
   wrangler deploy --env production
   ```

2. **Run Database Migrations:**
   ```bash
   wrangler d1 execute saarthi-clinical-prod --file=schema.sql
   ```

3. **Monitor Logs:**
   ```bash
   wrangler tail --env production
   ```

## Need Help?

- Check the API tests: `src/tests/api.test.js`
- Review the plan: `new_plan.md`
- Postman collection: `postman_collection_phase2_additions.json`
