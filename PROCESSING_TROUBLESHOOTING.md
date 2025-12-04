# Document Processing Troubleshooting Guide

## Issue: "Document not found" errors in queue processing

### Problem
When documents are uploaded and processed via the queue, you may encounter errors like:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Document not found"
  }
}
```

### Root Causes

1. **Database Timing Race Condition**: The queue message may be sent before the database INSERT transaction fully commits
2. **R2 Upload Race Condition**: The queue may try to process a document before the R2 upload completes
3. **Missing R2 Bindings**: Queue consumer doesn't have access to the DOCUMENTS R2 bucket
4. **Incorrect Storage Keys**: Mismatch between the storage key in DB and actual R2 object key
5. **R2 Upload Failures**: Silent failures during R2 upload that aren't caught

### Fixes Applied

#### 1. Enhanced Queue Consumer Logging (`src/index.js`)

Added comprehensive diagnostics to the queue consumer:

```javascript
// Environment binding checks
console.log(`🔍 Queue environment check:`, {
  hasDB: !!env.DB,
  hasDocuments: !!env.DOCUMENTS,
  hasVectorize: !!env.VECTORIZE,
  hasAI: !!env.AI,
  hasGeminiKey: !!env.GEMINI_API_KEY,
  hasOpenAIKey: !!env.OPENAI_API_KEY
});

// Document metadata verification
console.log(`📄 Document metadata:`, {
  id: doc.id,
  patient_id: doc.patient_id,
  filename: doc.filename,
  storage_key: doc.storage_key,
  mime_type: doc.mime_type,
  processing_status: doc.processing_status
});

// R2 object verification
const r2Object = await env.DOCUMENTS.get(doc.storage_key);
if (!r2Object) {
  throw new Error(`Document file not found in R2 at key: ${doc.storage_key}`);
}
```

#### 2. Database Verification Before Queueing (`src/routes/documents.js`)

Before sending messages to the queue, verify all documents exist in the database:

```javascript
// Verify all documents are in DB before queueing
const docIds = processingTasks.map(t => t.id);
const verifyQuery = await c.env.DB.prepare(`
  SELECT id FROM documents WHERE id IN (${docIds.map(() => '?').join(',')})
`).bind(...docIds).all();

const foundIds = new Set(verifyQuery.results.map(r => r.id));

// Skip queueing for any documents not found in DB
for (const { id: docId, mode } of processingTasks) {
  if (!foundIds.has(docId)) {
    console.error(`❌ Skipping queue for ${docId} - not found in DB`);
    continue;
  }
  // ... proceed with queueing
}
```

This prevents queueing documents that weren't successfully saved to the database.

#### 3. Added Queue Delay (`src/routes/documents.js`)

For full-mode processing, added a 3-second delay (increased from 2) before queue processing:

```javascript
// Verify document exists one more time before queueing
const docCheck = await c.env.DB.prepare(
  'SELECT id, filename, storage_key FROM documents WHERE id = ?'
).bind(docId).first();

if (!docCheck) {
  console.error(`❌ Cannot queue ${docId} - document disappeared from DB`);
  continue;
}

await c.env.DOCUMENT_PROCESSING_QUEUE.send({
  documentId: docId,
  mode: 'full',
  provider: provider
}, {
  delaySeconds: 3  // Wait 3 seconds before processing
});
```

This ensures both R2 uploads AND database transactions have time to complete before the queue consumer tries to retrieve the file.

#### 4. Graceful Handling of Missing Documents in Queue Consumer (`src/index.js`)

If a document isn't found on the first attempt, retry. If still not found after retries, acknowledge to prevent infinite loops:

```javascript
if (!doc) {
  // On first attempt, this might be a timing issue - retry
  if ((message.attempts || 0) === 0) {
    console.warn(`⚠️ Document ${job.documentId} not found in database on first attempt - will retry`);
    throw new Error(`Document ${job.documentId} not found in database (timing issue - retrying)`);
  }
  
  // After retries, acknowledge to prevent infinite loop
  console.error(`❌ Document ${job.documentId} not found in database after retries - acknowledging`);
  message.ack();
  continue;
}
```

#### 5. Enhanced Processor Error Handling (`src/services/processing/processor.js`)

Added detailed logging and error messages:

```javascript
console.log(`🔍 Processing document:`, {
  id: doc.id,
  filename: doc.filename,
  storage_key: doc.storage_key,
  patient_id: doc.patient_id,
  status: doc.processing_status
});

console.log(`📥 Fetching from R2: ${doc.storage_key}`);
const object = await this.env.DOCUMENTS.get(doc.storage_key);
if (!object) {
  console.error(`❌ Document not found in R2:`, {
    storage_key: doc.storage_key,
    document_id: documentId,
    patient_id: doc.patient_id
  });
  throw new Error(`Document file not found in R2 storage at key: ${doc.storage_key}`);
}

console.log(`✅ Retrieved from R2: ${object.size} bytes`);
```

#### 4. New R2 Storage Health Check Endpoint

Added `/api/v1/health/storage` endpoint to verify R2 connectivity:

```bash
curl http://localhost:8787/api/v1/health/storage
```

This returns:
- Whether R2 binding is available
- List of recent documents from DB
- For each document: whether it exists in R2, file sizes, processing status

### Testing the Fixes

#### 1. Check Current Storage Status

```bash
# Check if R2 is properly connected
curl http://localhost:8787/api/v1/health/storage | jq

# Check overall system health
curl http://localhost:8787/api/v1/health | jq
```

#### 2. Upload a Test Document

```bash
# Upload a document in FAST mode (should work immediately)
curl -X POST http://localhost:8787/api/v1/patients/PATIENT_ID/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@test-document.pdf" \
  -F "process_mode=fast" \
  -F "category=labs"

# Upload a document in FULL mode (will use queue with 2s delay)
curl -X POST http://localhost:8787/api/v1/patients/PATIENT_ID/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@test-document.pdf" \
  -F "process_mode=full" \
  -F "category=pathology"
```

#### 3. Monitor Queue Processing

Watch the wrangler dev logs for:

```
📥 Processing queue job: { documentId: 'doc_xxx', mode: 'full', provider: 'gemini' }
🔍 Queue environment check: { hasDB: true, hasDocuments: true, ... }
📄 Document metadata: { id: 'doc_xxx', filename: 'test.pdf', storage_key: '...' }
📥 Fetching from R2: patient_id/doc_id/filename.pdf
✅ Retrieved from R2: 12345 bytes
📄 Full processing test.pdf (application/pdf) with gemini
```

#### 4. Check Document Status

```bash
# Get document details
curl http://localhost:8787/api/v1/patients/PATIENT_ID/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" | jq

# Look for processing_status field:
# - "pending" - not yet processed
# - "processing" - currently being processed
# - "completed" - successfully processed
# - "failed" - processing failed (check processing_error field)
```

### Common Issues and Solutions

#### Issue: "Document not found in database" in queue processing

**Symptoms:**
```
❌ Error processing queue message: {
  error: 'Document doc_xxx not found in database',
  documentId: 'doc_xxx',
  mode: 'full',
  attempt: 1
}
🔄 Retrying message (attempt 2/3)
```

**Root Cause:**
Database INSERT transaction hasn't committed before the queue message is processed.

**Solutions:**

1. **The fixes are now automatic** - with the new verification steps, this should rarely happen
2. **If it still occurs**, check the logs for:
   ```
   ⚠️ Documents not found in DB before queueing: ['doc_xxx']
   ❌ Skipping queue for doc_xxx - not found in DB
   ```
   This indicates a database write failure during upload

3. **Manual verification**:
```bash
# Check if document exists in database
curl http://localhost:8787/api/v1/patients/PATIENT_ID/documents | jq '.data.documents[] | select(.id=="doc_xxx")'

# If found, manually trigger reprocessing
curl -X POST http://localhost:8787/api/v1/patients/PATIENT_ID/processing/documents/doc_xxx/process \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **If document truly doesn't exist**, re-upload the file

#### Issue: Queue consumer doesn't have R2 access

**Symptoms:**
```
🔍 Queue environment check: { hasDB: true, hasDocuments: false, ... }
```

**Solution:**
The `wrangler.toml` already defines the DOCUMENTS binding globally. Restart wrangler dev:
```bash
cd saarthi-clinical
wrangler dev
```

#### Issue: R2 object not found even after delay

**Symptoms:**
```
❌ Document not found in R2: { storage_key: 'patient_id/doc_id/file.pdf', ... }
```

**Solutions:**

1. Check if R2 upload succeeded:
```bash
# List R2 objects (requires wrangler)
wrangler r2 object list saarthi-documents-dev --prefix="patient_id/"
```

2. Verify storage key format in DB:
```bash
# Check document records
curl http://localhost:8787/api/v1/health/storage | jq '.diagnostic.recentDocuments'
```

3. Increase queue delay if needed (in `src/routes/documents.js`):
```javascript
delaySeconds: 5  // Increase from 2 to 5 seconds
```

#### Issue: Processing fails with timeout

**Symptoms:**
```
❌ Error processing queue message: { error: 'CPU time limit exceeded', ... }
```

**Solution:**
This is expected for very large PDFs or complex processing. The queue has higher limits than regular Workers. If it still times out:

1. Use fast mode instead of full mode for large documents
2. Process documents in smaller batches
3. Consider splitting large PDFs into smaller files

### Monitoring Best Practices

1. **Always check storage health before uploading**:
   ```bash
   curl http://localhost:8787/api/v1/health/storage
   ```

2. **Monitor queue processing in real-time**:
   - Keep wrangler dev logs visible
   - Watch for error patterns

3. **Verify successful processing**:
   ```bash
   # Check document status after upload
   curl http://localhost:8787/api/v1/patients/PATIENT_ID/documents | jq '.data.documents[] | {filename, processing_status, processing_error}'
   ```

4. **Use the frontend upload modal**:
   - Navigate to `/dashboard.html?patientId=PATIENT_ID`
   - Click "Documents" tab
   - Use the upload button
   - Choose "Upload (fast)" for immediate processing
   - Choose "Upload and process (full)" for comprehensive extraction

### Configuration Files

All queue and R2 configuration is in `wrangler.toml`:

```toml
# R2 Bucket for document storage
[[r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "saarthi-documents-dev"

# Queue for async processing
[[queues.producers]]
queue = "document-processing-dev"
binding = "DOCUMENT_PROCESSING_QUEUE"

[[queues.consumers]]
queue = "document-processing-dev"
max_batch_size = 10
max_batch_timeout = 30
```

### Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

### Getting Help

If issues persist:

1. Check wrangler dev logs for error messages
2. Run the health check endpoints
3. Verify R2 bucket permissions in Cloudflare dashboard
4. Check if documents table in D1 has correct storage_key values
5. Review the queue consumer logs in wrangler output

### Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `src/routes/documents.js` | **Pre-queue DB verification** | Verify all documents exist in DB before queueing |
| `src/routes/documents.js` | **Double-check before queueing** | Verify each document exists before sending to queue |
| `src/routes/documents.js` | Increased delay from 2s to 3s | Ensure DB and R2 operations complete |
| `src/index.js` | **Graceful missing document handling** | Retry on first attempt, acknowledge after retries |
| `src/index.js` | Enhanced queue consumer diagnostics | Better error messages and debugging |
| `src/index.js` | Added `/api/v1/health/storage` endpoint | Verify R2 connectivity and document storage |
| `src/services/processing/processor.js` | Enhanced logging in both processing modes | Track document retrieval from R2 |
| `src/services/processing/processor.js` | Improved error messages | Specify exact storage key when file not found |

All changes are backward compatible and add observability without breaking existing functionality.

**Key Improvements:**
- ✅ Prevents queueing documents that don't exist in database
- ✅ Double verification before queueing eliminates most race conditions
- ✅ Graceful handling of timing issues with automatic retry
- ✅ Increased delay gives more time for transactions to commit
- ✅ Comprehensive logging for easier debugging

