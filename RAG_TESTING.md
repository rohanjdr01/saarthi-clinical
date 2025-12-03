# RAG Testing Guide - Production

## Quick Test Flow

```
1. Get Firebase Token → 2. Create Patient → 3. Upload Document → 4. Search! 🎉
```

---

## Step 1: Get Authentication Token

### Option A: Use Existing Firebase User

If you already have a Firebase user, get a token from the client:

```bash
# In your frontend/client app using Firebase SDK:
const token = await firebase.auth().currentUser.getIdToken();
```

### Option B: Create Test User via Firebase Console

1. Go to Firebase Console → Authentication → Add User
2. Add email/password user
3. Use this script to get a token:

```bash
# Install firebase-tools if needed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Get ID token (replace with your project)
firebase auth:export users.json --project YOUR_PROJECT_ID
```

### Option C: Quick Test Without Auth (Temporarily Disable Auth)

For testing, you can temporarily bypass auth by commenting out the middleware in your routes. **DO NOT do this in production long-term!**

---

## Step 2: Create a Test Patient

```bash
# Set your base URL
export API_URL="https://process.saarthihq.com/api/v1"
export TOKEN="your-firebase-id-token"

# Create patient
curl -X POST "$API_URL/patients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RAG Test Patient",
    "age": 65,
    "sex": "male",
    "patient_id_uhid": "RAG-TEST-001"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "pt_abc123",  # ← SAVE THIS!
    "name": "RAG Test Patient"
  }
}

# Save the patient ID
export PATIENT_ID="pt_abc123"
```

---

## Step 3: Upload & Process Document

### Prepare a Test Document

Use any medical document (PDF, image). For testing, you can use:
- Pathology report
- Discharge summary
- Lab report
- Imaging report

### Upload with Immediate Processing

```bash
# Upload document (replace with your file path)
curl -X POST "$API_URL/patients/$PATIENT_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/path/to/your/medical_document.pdf" \
  -F "category=pathology" \
  -F "subcategory=biopsy" \
  -F "document_date=2025-11-21" \
  -F "process_immediately=true" \
  -F "provider=openai"

# Response (202 Accepted):
{
  "success": true,
  "documents_uploaded": 1,
  "processing_status": "processing",
  "data": [{
    "id": "doc_xyz789",  # ← SAVE THIS!
    "filename": "medical_document.pdf",
    "processing_status": "pending",
    "vectorize_status": "pending"
  }]
}

# Save the document ID
export DOC_ID="doc_xyz789"
```

---

## Step 4: Wait for Processing

Document processing has two stages:
1. **AI Extraction** (20-60 seconds) - Extract structured data
2. **Vectorization** (10-30 seconds) - Create embeddings for search

### Check Status

```bash
# Check processing status
curl "$API_URL/patients/$PATIENT_ID/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN"

# Response shows status:
{
  "success": true,
  "data": {
    "id": "doc_xyz789",
    "processing_status": "completed",     # ✅ Extraction done
    "vectorize_status": "completed",      # ✅ Ready for RAG!
    "extracted_data": {...},              # AI-extracted data
    "medical_highlight": "...",
    "tokens_used": 1892
  }
}
```

**Wait until both are "completed"** (usually 30-90 seconds total)

### Monitor in Real-Time

```bash
# Watch logs in another terminal
npx wrangler tail --env production --format=pretty

# You'll see:
# 📄 OpenAI document processing...
# ✅ Document processed
# 🔍 Vectorizing document...
# ✅ Vectorization completed (5 chunks)
```

---

## Step 5: Test RAG Search! 🎉

### Basic Search

```bash
# Search with natural language
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What was the diagnosis?",
    "top_k": 5
  }'

# Response:
{
  "success": true,
  "data": {
    "results": [
      {
        "document_id": "doc_xyz789",
        "filename": "medical_document.pdf",
        "chunk_text": "Primary diagnosis: Adenocarcinoma of the stomach with focal signet ring cell features. Biopsy performed on...",
        "relevance_score": 0.89,  # Higher = more relevant
        "document_date": "2025-11-21",
        "metadata": {
          "document_type": "pathology",
          "category": "pathology",
          "chunk_index": 1,
          "patient_id": "pt_abc123"
        }
      },
      {
        "document_id": "doc_xyz789",
        "chunk_text": "Clinical diagnosis of gastric cancer was confirmed...",
        "relevance_score": 0.82,
        "chunk_index": 3
      }
    ]
  }
}
```

### Example Queries to Try

```bash
# Treatment information
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "What chemotherapy regimen was used?", "top_k": 3}'

# Biomarkers
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "HER2 status and score", "top_k": 3}'

# Staging
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "TNM staging classification", "top_k": 3}'

# Labs
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "hemoglobin and platelet counts", "top_k": 5}'

# Timeline
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "when did treatment start?", "top_k": 3}'

# Medications
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "list of current medications", "top_k": 5}'
```

---

## Advanced RAG Features

### 1. Category Filtering

Search only specific document types:

```bash
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "diagnosis",
    "top_k": 5,
    "category_filter": ["pathology", "radiology"]
  }'
```

### 2. Adjust Result Count

```bash
# Get more results
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "treatment history",
    "top_k": 10  # More results, lower relevance threshold
  }'
```

### 3. Manual Vectorization

If a document wasn't automatically vectorized:

```bash
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/$DOC_ID/vectorize" \
  -H "Authorization: Bearer $TOKEN"

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

---

## Testing Multiple Documents

Upload several documents to test cross-document search:

```bash
# Upload multiple documents
for file in pathology.pdf radiology.pdf discharge.pdf; do
  curl -X POST "$API_URL/patients/$PATIENT_ID/documents" \
    -H "Authorization: Bearer $TOKEN" \
    -F "files=@$file" \
    -F "process_immediately=true" \
    -F "provider=openai"
  sleep 2
done

# Wait 2-3 minutes for all to process

# Search across all documents
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "complete treatment timeline",
    "top_k": 10
  }'
```

---

## Troubleshooting

### Issue: "Vectorize binding not configured"

```bash
# Check Vectorize is created
npx wrangler vectorize list

# Should show:
# medical-documents (768 dimensions, cosine)

# If not, create it:
npx wrangler vectorize create medical-documents --dimensions=768 --metric=cosine
```

### Issue: Search returns no results

```bash
# 1. Check document is vectorized
curl "$API_URL/patients/$PATIENT_ID/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN" | grep vectorize_status

# Should be: "vectorize_status": "completed"

# 2. If not, manually trigger:
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/$DOC_ID/vectorize" \
  -H "Authorization: Bearer $TOKEN"

# 3. Check logs for errors:
npx wrangler tail --env production | grep -i vector
```

### Issue: Processing stuck at "pending"

```bash
# Check logs for errors
npx wrangler tail --env production --format=pretty

# Common issues:
# - OpenAI API key not set: Check secrets
# - Gemini API key not set: Check secrets
# - File too large: Max ~10MB

# Retry processing:
curl -X POST "$API_URL/patients/$PATIENT_ID/documents/$DOC_ID/reprocess?provider=openai" \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: 401 Unauthorized

```bash
# Your Firebase token expired (valid for 1 hour)
# Get a new token from your client app

# Or temporarily disable auth middleware for testing
# (Edit src/routes/documents.js - remove createAuthMiddleware())
```

---

## Understanding Relevance Scores

- **0.9 - 1.0**: Excellent match (exact answer)
- **0.8 - 0.9**: Very relevant
- **0.7 - 0.8**: Relevant
- **0.6 - 0.7**: Somewhat relevant
- **< 0.6**: May not be relevant

Adjust `top_k` based on score distribution.

---

## Performance Tips

### Optimize Queries

**Good queries** (specific):
- "HER2 status and IHC score"
- "Chemotherapy start date and regimen"
- "Latest hemoglobin value"

**Poor queries** (too broad):
- "Tell me about the patient"
- "Everything about treatment"
- "Cancer"

### Chunking Strategy

Documents are chunked at ~1500 characters:
- **1 page PDF** → ~1-2 chunks
- **5 page report** → ~5-8 chunks
- **20 page case pack** → ~25-30 chunks

Each chunk is indexed independently.

---

## Complete Test Script

Save this as `test_rag.sh`:

```bash
#!/bin/bash

# Configuration
API_URL="https://process.saarthihq.com/api/v1"
TOKEN="your-firebase-token"
DOCUMENT_PATH="./medical_document.pdf"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Creating patient...${NC}"
PATIENT_RESPONSE=$(curl -s -X POST "$API_URL/patients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "RAG Test", "age": 65, "sex": "male"}')

PATIENT_ID=$(echo $PATIENT_RESPONSE | jq -r '.data.id')
echo -e "${GREEN}✓ Patient created: $PATIENT_ID${NC}"

echo -e "\n${YELLOW}Step 2: Uploading document...${NC}"
DOC_RESPONSE=$(curl -s -X POST "$API_URL/patients/$PATIENT_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@$DOCUMENT_PATH" \
  -F "process_immediately=true" \
  -F "provider=openai")

DOC_ID=$(echo $DOC_RESPONSE | jq -r '.data[0].id')
echo -e "${GREEN}✓ Document uploaded: $DOC_ID${NC}"

echo -e "\n${YELLOW}Step 3: Waiting for processing (60s)...${NC}"
sleep 60

echo -e "\n${YELLOW}Step 4: Checking status...${NC}"
STATUS=$(curl -s "$API_URL/patients/$PATIENT_ID/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN")

PROCESSING_STATUS=$(echo $STATUS | jq -r '.data.processing_status')
VECTORIZE_STATUS=$(echo $STATUS | jq -r '.data.vectorize_status')

echo "Processing: $PROCESSING_STATUS"
echo "Vectorize: $VECTORIZE_STATUS"

echo -e "\n${YELLOW}Step 5: Testing search...${NC}"
SEARCH_RESULT=$(curl -s -X POST "$API_URL/patients/$PATIENT_ID/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "diagnosis", "top_k": 3}')

echo $SEARCH_RESULT | jq '.data.results[] | {score: .relevance_score, text: .chunk_text[0:100]}'

echo -e "\n${GREEN}✓ RAG test complete!${NC}"
```

Run it:
```bash
chmod +x test_rag.sh
./test_rag.sh
```

---

## Next Steps

Once RAG is working:

1. **Integrate in your frontend**: Use the search endpoint for intelligent document Q&A
2. **Build a chat interface**: Combine RAG results with LLM for conversational queries
3. **Add filters**: Use category filters to narrow searches
4. **Monitor performance**: Track query latency and relevance scores

---

**Happy testing! 🎉**

Questions? Check logs: `npx wrangler tail --env production`
