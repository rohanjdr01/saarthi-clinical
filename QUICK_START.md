# Quick Start Guide - Deployment & Testing

## ✅ What's Done
1. ✅ **Schema updated** with users and doctors tables
2. ✅ **Consistent extraction schema** implemented for all AI providers
3. ✅ **Treatment sync** fixed with consistent field mapping
4. ✅ **Local database** ready with auth tables

## 🚀 Next Steps

### 1. Deploy to Production (5 minutes)

```bash
# 1. Set production secrets (one-time setup)
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --env production
npx wrangler secret put FIREBASE_API_KEY --env production
npx wrangler secret put GEMINI_API_KEY --env production
npx wrangler secret put OPENAI_API_KEY --env production

# 2. Apply schema to production database
npx wrangler d1 execute saarthi-clinical-prod --remote --file=schema.sql

# 3. Deploy!
npx wrangler deploy --env production

# 4. Verify deployment
curl https://process.saarthihq.com/api/v1/health
```

**Expected Response:**
```json
{
  "success": true,
  "environment": "production",
  "services": {
    "database": true,
    "storage": true,
    "gemini": true,
    "openai": true
  }
}
```

### 2. Set Up Your First User (2 minutes)

**Option A: Using Firebase Console**
1. Go to Firebase Console → Authentication
2. Add a test user with email/phone
3. Copy the UID

**Option B: Authenticate via API**
```bash
# Send OTP (client-side in production)
curl -X POST "https://process.saarthihq.com/api/v1/auth/phone/send" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+91XXXXXXXXXX"}'

# Verify OTP and get token
curl -X POST "https://process.saarthihq.com/api/v1/auth/phone/verify" \
  -H "Content-Type: application/json" \
  -d '{"sessionInfo": "...", "code": "123456"}'

# Response includes:
{
  "data": {
    "user": {"id": "usr_...", "role": "user"},
    "idToken": "eyJhbG..." // Use this for API calls
  }
}
```

### 3. Promote User to Doctor (1 minute)

```bash
# Update role to doctor
npx wrangler d1 execute saarthi-clinical-prod --remote \
  --command="UPDATE users SET role = 'doctor' WHERE firebase_uid = 'YOUR_FIREBASE_UID'"

# Create doctor profile
npx wrangler d1 execute saarthi-clinical-prod --remote \
  --command="INSERT INTO doctors (id, user_id, specialization, hospital, created_at, updated_at) VALUES ('doc_$(date +%s)', 'usr_XXX', 'Oncology', 'Test Hospital', $(date +%s)000, $(date +%s)000)"
```

### 4. Test RAG (Vector Search) - 3 minutes

**Step 1: Create a patient**
```bash
curl -X POST "https://process.saarthihq.com/api/v1/patients" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Patient",
    "age": 65,
    "sex": "male",
    "patient_id_uhid": "TEST001"
  }'

# Save the patient ID from response
```

**Step 2: Upload & process a document**
```bash
curl -X POST "https://process.saarthihq.com/api/v1/patients/PATIENT_ID/documents" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -F "files=@your_medical_document.pdf" \
  -F "category=pathology" \
  -F "process_immediately=true" \
  -F "provider=openai"

# Wait 30-60 seconds for processing
```

**Step 3: Check processing status**
```bash
curl "https://process.saarthihq.com/api/v1/patients/PATIENT_ID/documents/DOC_ID" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# Look for:
# "processing_status": "completed" ✅
# "vectorize_status": "completed" ✅
```

**Step 4: Search with natural language!**
```bash
curl -X POST "https://process.saarthihq.com/api/v1/patients/PATIENT_ID/documents/search" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What was the diagnosis?",
    "top_k": 5
  }'

# You'll get semantically relevant chunks with relevance scores!
```

## 📊 Example Queries to Try

Once you have documents processed:

```bash
# Find diagnosis information
"What was the primary diagnosis?"

# Treatment details
"What chemotherapy regimen was used?"

# Lab results
"What were the latest hemoglobin and WBC counts?"

# Timeline questions
"When did the patient start treatment?"

# Biomarker info
"What was the HER2 status?"

# Staging
"What is the TNM staging?"
```

## 🔧 Troubleshooting

### RAG not working?
```bash
# Check if Vectorize is configured
npx wrangler vectorize list

# Check document status
curl "https://process.saarthihq.com/api/v1/patients/PATIENT_ID/documents/DOC_ID"

# Manually trigger vectorization
curl -X POST "https://process.saarthihq.com/api/v1/patients/PATIENT_ID/documents/DOC_ID/vectorize" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Auth not working?
```bash
# Check if tables exist
npx wrangler d1 execute saarthi-clinical-prod --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table'"

# Check user exists
npx wrangler d1 execute saarthi-clinical-prod --remote \
  --command="SELECT * FROM users LIMIT 5"
```

### View production logs
```bash
# Real-time logs
npx wrangler tail --env production

# Filter for errors only
npx wrangler tail --env production --format=pretty | grep ERROR
```

## 📖 Full Documentation

See `DEPLOYMENT_GUIDE.md` for:
- Complete role setup instructions
- Security best practices
- Advanced RAG queries
- Monitoring & analytics
- Database management commands

## 🎯 What's New

### Consistent Extraction Schema
All documents now extract to the same structure:
```json
{
  "patient_demographics": {...},
  "diagnosis": {...},
  "treatment": {
    "regimen_name": "FOLFOX-6",
    "drugs": ["5-FU", "Leucovorin", "Oxaliplatin"],
    "start_date": "2025-10-03"
  },
  "medications": [{...}],
  "labs": {...},
  "pathology": {...},
  "imaging": {...}
}
```

**Benefits:**
- ✅ Predictable field names
- ✅ Works identically with Gemini and OpenAI
- ✅ No more treatment sync issues
- ✅ Easier to debug extractions

### OpenAI Structured Output
OpenAI now uses `response_format` with strict JSON schema enforcement:
- Guaranteed valid JSON
- Required fields always present
- Type safety (numbers as numbers, not strings)

## 🚨 Important Notes

1. **RAG only works in production/staging** - Vectorize requires remote mode
2. **Firebase tokens expire** - Refresh tokens client-side
3. **Secrets are environment-specific** - Set separately for production
4. **Schema migrations** - Always backup before applying to production
5. **Rate limits** - Gemini/OpenAI have API rate limits

## 📞 Support

**Having issues?** Run diagnostics:
```bash
# Health check
curl https://process.saarthihq.com/api/v1/health

# Check bindings
npx wrangler tail --env production --format=pretty

# Verify secrets
npx wrangler secret list --env production
```

**Common Issues:**
- ❌ 401 Unauthorized → Check Firebase token
- ❌ 404 Not Found → Verify patient/document IDs
- ❌ 500 Server Error → Check logs with `wrangler tail`
- ❌ "Vectorize not configured" → Only works remotely

---

**Ready to deploy?** Run:
```bash
npx wrangler deploy --env production
```

Then visit: https://process.saarthihq.com/api/v1/health
