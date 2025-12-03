# Saarthi Clinical Platform - Deployment & Testing Guide

## Table of Contents
1. [Setting Up Roles & Authentication](#1-setting-up-roles--authentication)
2. [Production Deployment](#2-production-deployment)
3. [Testing RAG (Vector Search)](#3-testing-rag-vector-search)

---

## 1. Setting Up Roles & Authentication

### Current Status
- ✅ Firebase Authentication implemented
- ✅ Auth middleware with role checking (`requireRole`)
- ⚠️ **Missing:** Users and doctors tables in `schema.sql`

### Step 1: Add Auth Tables to Schema

First, add these tables to your `schema.sql` file:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'doctor', 'admin', 'case_manager')),
  is_verified INTEGER DEFAULT 0,
  profile_completed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- Doctors table (for healthcare providers)
CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  specialization TEXT,
  specializations TEXT, -- JSON array of specializations
  hospital TEXT,
  license_number TEXT,
  years_of_experience INTEGER,
  consultation_fee REAL,
  is_verified INTEGER DEFAULT 0,
  bio TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctors_specialization ON doctors(specialization);
CREATE INDEX idx_doctors_is_verified ON doctors(is_verified);
```

### Step 2: Apply Schema Updates

**Local Development:**
```bash
npx wrangler d1 execute saarthi-clinical-dev --local --file=schema.sql
```

**Production:**
```bash
npx wrangler d1 execute saarthi-clinical-prod --remote --file=schema.sql
```

### Step 3: Configure Firebase

1. **Get Firebase Service Account:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

2. **Set Environment Variables:**

```bash
# Development (.dev.vars file - already exists)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project",...}'
FIREBASE_API_KEY='AIzaSy...'
GEMINI_API_KEY='your-gemini-key'
OPENAI_API_KEY='your-openai-key'

# Production (set as secrets)
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --env production
npx wrangler secret put FIREBASE_API_KEY --env production
npx wrangler secret put GEMINI_API_KEY --env production
npx wrangler secret put OPENAI_API_KEY --env production
```

### Step 4: Understanding Roles

**Available Roles:**
- `user` - Default role for new signups (patients, family members)
- `doctor` - Healthcare providers who can view/edit patient data
- `admin` - Full system access
- `case_manager` - Can manage patient cases and documents

**Manually Set Role (via D1):**
```bash
# Promote user to doctor
npx wrangler d1 execute saarthi-clinical-prod --remote --command="UPDATE users SET role = 'doctor' WHERE email = 'doctor@example.com'"

# Create doctor profile
npx wrangler d1 execute saarthi-clinical-prod --remote --command="INSERT INTO doctors (id, user_id, specialization, hospital, created_at, updated_at) VALUES ('doc_123', 'usr_456', 'Oncology', 'City Hospital', 1638360000, 1638360000)"
```

### Step 5: Protect Routes with Role Middleware

Example in your route files:

```javascript
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';

// Require authentication
patients.get('/', createAuthMiddleware(), async (c) => {
  const user = c.get('user'); // Access authenticated user
  // ... route logic
});

// Require specific role
patients.post('/', createAuthMiddleware(), requireRole(['doctor', 'admin']), async (c) => {
  // Only doctors and admins can create patients
});
```

---

## 2. Production Deployment

### Prerequisites
- Cloudflare account with Workers paid plan (for D1, R2, Vectorize)
- Domain configured in Cloudflare (optional, for custom domain)
- Firebase project configured

### Step 1: Create Production Resources

**Create Production D1 Database:**
```bash
npx wrangler d1 create saarthi-clinical-prod
```

**Create Production R2 Bucket:**
```bash
npx wrangler r2 bucket create saarthi-documents-prod
```

**Create Production KV Namespace:**
```bash
npx wrangler kv:namespace create CACHE --env production
```

**Create Vectorize Index:**
```bash
npx wrangler vectorize create medical-documents --dimensions=768 --metric=cosine
```

### Step 2: Update wrangler.toml

Your `wrangler.toml` already has production config! Just verify the IDs match:

```toml
[env.production]
name = "saarthi-clinical-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "saarthi-clinical-prod"
database_id = "<your-production-db-id>"  # From step 1

[[env.production.r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "saarthi-documents-prod"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "<your-production-kv-id>"  # From step 1

[[env.production.vectorize]]
binding = "VECTORIZE"
index_name = "medical-documents"
```

### Step 3: Apply Production Schema

```bash
# Apply full schema to production
npx wrangler d1 execute saarthi-clinical-prod --remote --file=schema.sql

# Verify tables were created
npx wrangler d1 execute saarthi-clinical-prod --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Step 4: Set Production Secrets

```bash
# Firebase credentials
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --env production
npx wrangler secret put FIREBASE_API_KEY --env production

# AI API Keys
npx wrangler secret put GEMINI_API_KEY --env production
npx wrangler secret put OPENAI_API_KEY --env production
```

### Step 5: Deploy to Production

```bash
# Deploy to production
npx wrangler deploy --env production

# Check deployment status
npx wrangler deployments list --env production

# View live logs
npx wrangler tail --env production
```

### Step 6: Verify Production Deployment

```bash
# Test health endpoint
curl https://process.saarthihq.com/api/v1/health

# Expected response:
{
  "success": true,
  "message": "Saarthi Clinical Platform is running",
  "environment": "production",
  "services": {
    "database": true,
    "storage": true,
    "cache": true,
    "gemini": true,
    "openai": true
  }
}
```

### Production URLs

- **API Base:** `https://process.saarthihq.com/api/v1`
- **Workers URL:** `https://saarthi-clinical-prod.jdr-rohan.workers.dev`
- **Dashboard:** https://dash.cloudflare.com

---

## 3. Testing RAG (Vector Search)

### What is RAG?
RAG (Retrieval-Augmented Generation) lets you semantically search through document content using natural language queries. When documents are uploaded, they're:
1. Processed by AI to extract text
2. Chunked into ~1500 character segments
3. Converted to embeddings using Workers AI
4. Stored in Vectorize for fast similarity search

### Prerequisites
- Documents must be processed first
- Vectorize must be enabled (only works remotely, not locally)

### Step 1: Upload & Process Documents

```bash
# Upload a document with immediate processing
curl -X POST "https://process.saarthihq.com/api/v1/patients/{patientId}/documents" \
  -H "Authorization: Bearer {firebase-id-token}" \
  -F "files=@pathology_report.pdf" \
  -F "category=pathology" \
  -F "document_date=2025-09-22" \
  -F "process_immediately=true"

# Response:
{
  "success": true,
  "documents_uploaded": 1,
  "processing_status": "processing",
  "data": [{
    "id": "doc_abc123",
    "processing_status": "pending",
    "vectorize_status": "pending"
  }]
}
```

### Step 2: Check Processing Status

```bash
# Wait a few seconds, then check status
curl "https://process.saarthihq.com/api/v1/patients/{patientId}/documents/doc_abc123" \
  -H "Authorization: Bearer {firebase-id-token}"

# Look for:
{
  "data": {
    "processing_status": "completed",  # ✅ Document processed
    "vectorize_status": "completed"    # ✅ Ready for search
  }
}
```

### Step 3: Test Semantic Search

```bash
# Search documents with natural language
curl -X POST "https://process.saarthihq.com/api/v1/patients/{patientId}/documents/search" \
  -H "Authorization: Bearer {firebase-id-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What was the HER2 status on biopsy?",
    "top_k": 5
  }'

# Response:
{
  "success": true,
  "data": {
    "results": [
      {
        "document_id": "doc_abc123",
        "filename": "pathology_report.pdf",
        "chunk_text": "HER2 status: Negative (Score 1+). IHC performed on tumor tissue...",
        "relevance_score": 0.92,
        "document_date": "2025-09-22",
        "metadata": {
          "document_type": "pathology",
          "category": "pathology",
          "chunk_index": 2
        }
      }
    ]
  }
}
```

### Step 4: Advanced Search Examples

**Search by category:**
```bash
curl -X POST "https://process.saarthihq.com/api/v1/patients/{patientId}/documents/search" \
  -H "Authorization: Bearer {firebase-id-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "chemotherapy regimen and doses",
    "top_k": 10,
    "category_filter": ["discharge_summary", "treatment_plan"]
  }'
```

**Timeline queries:**
```bash
curl -X POST "https://process.saarthihq.com/api/v1/patients/{patientId}/documents/search" \
  -H "Authorization: Bearer {firebase-id-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "when did the patient start chemotherapy?",
    "top_k": 3
  }'
```

**Lab results:**
```bash
curl -X POST "https://process.saarthihq.com/api/v1/patients/{patientId}/documents/search" \
  -H "Authorization: Bearer {firebase-id-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest hemoglobin and platelet counts",
    "top_k": 5
  }'
```

### Step 5: Manual Vectorization (if needed)

If a document was processed but not vectorized:

```bash
curl -X POST "https://process.saarthihq.com/api/v1/patients/{patientId}/documents/doc_abc123/vectorize" \
  -H "Authorization: Bearer {firebase-id-token}"

# Response:
{
  "success": true,
  "message": "Vectorization executed",
  "data": {
    "status": "completed",
    "chunks": 5  # Number of chunks created
  }
}
```

### Troubleshooting RAG

**Issue: "Vectorize binding not configured"**
- Solution: RAG only works in production/staging (not local)
- Ensure `wrangler.toml` has `[[vectorize]]` binding

**Issue: No search results**
- Check document has `vectorize_status: "completed"`
- Try reprocessing: `POST /documents/{docId}/reprocess`
- Verify chunks were created in logs

**Issue: Irrelevant results**
- Be specific in queries ("HER2 status" vs "tell me about HER2")
- Increase `top_k` for more results
- Use category filters to narrow scope

**Check Vectorize Stats:**
```bash
npx wrangler vectorize get medical-documents
```

---

## Quick Reference Commands

### Local Development
```bash
# Start dev server
npx wrangler dev --local --persist-to .wrangler/state

# Apply schema locally
npx wrangler d1 execute saarthi-clinical-dev --local --file=schema.sql

# Query local DB
npx wrangler d1 execute saarthi-clinical-dev --local --command="SELECT * FROM patients LIMIT 5"
```

### Production
```bash
# Deploy
npx wrangler deploy --env production

# Apply schema
npx wrangler d1 execute saarthi-clinical-prod --remote --file=schema.sql

# View logs
npx wrangler tail --env production

# Set secrets
npx wrangler secret put SECRET_NAME --env production
```

### Database Management
```bash
# Backup production DB
npx wrangler d1 export saarthi-clinical-prod --remote --output=backup.sql

# Import to local
npx wrangler d1 execute saarthi-clinical-dev --local --file=backup.sql

# List all tables
npx wrangler d1 execute saarthi-clinical-prod --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

---

## Monitoring & Analytics

### View Metrics
- **Dashboard:** https://dash.cloudflare.com → Workers & Pages → saarthi-clinical-prod
- **Metrics:** Requests, Errors, CPU time, Duration
- **Logs:** Real-time with `npx wrangler tail --env production`

### Set Up Alerts
1. Go to Cloudflare Dashboard → Notifications
2. Create alerts for:
   - High error rate (>5%)
   - High CPU usage (>50ms avg)
   - D1 query errors

---

## Security Best Practices

1. **Never commit secrets** - Use `.dev.vars` (gitignored) and Wrangler secrets
2. **Validate all inputs** - Already implemented in Document and Patient models
3. **Use role-based access** - Protect sensitive endpoints with `requireRole()`
4. **Enable Firebase App Check** - Prevent abuse of API endpoints
5. **Regular backups** - Export D1 database weekly
6. **Monitor logs** - Watch for suspicious activity

---

## Support

**Issues:** https://github.com/anthropics/claude-code/issues
**Cloudflare Docs:** https://developers.cloudflare.com/workers/
**Firebase Docs:** https://firebase.google.com/docs/auth

**Questions?** Check logs first:
```bash
npx wrangler tail --env production --format=pretty
```
