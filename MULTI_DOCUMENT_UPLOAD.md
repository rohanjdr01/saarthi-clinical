# Multi-Document Upload with Case-Packs

## Overview

This update introduces multi-document upload capability (Typeform-style), medical highlight extraction, and case-pack document cataloging to the Saarthi Clinical Platform.

## New Features

### 1. **Multi-Document Upload**
Upload multiple documents in a single request instead of one at a time.

**Endpoint:** `POST /api/v1/patients/:patientId/documents/`

**Form Data:**
- `files` (File[], required) - Multiple files to upload
- `document_type` (string, optional) - Type of documents (pathology, imaging, lab, consultation, gp_notes, other)
- `document_date` (string, optional) - Date in YYYY-MM-DD format
- `process_immediately` (boolean, optional) - Set to `true` to process documents immediately

**Example Request (cURL):**
```bash
curl -X POST http://localhost:8787/api/v1/patients/pt_abc123/documents/ \
  -F "files=@report1.pdf" \
  -F "files=@report2.pdf" \
  -F "files=@scan1.jpg" \
  -F "document_type=pathology" \
  -F "process_immediately=true"
```

**Response:**
```json
{
  "success": true,
  "case_pack_id": "cp_xyz789",
  "documents_uploaded": 3,
  "processing_status": "processing",
  "message": "3 document(s) uploaded successfully. Processing started.",
  "data": {
    "case_pack_id": "cp_xyz789",
    "documents": [
      {
        "id": "doc_123",
        "filename": "report1.pdf",
        "document_type": "pathology",
        "processing_status": "pending",
        ...
      },
      ...
    ]
  }
}
```

### 2. **Medical Highlight Extraction**
Each processed document automatically gets a one-line medical highlight summarizing the most significant finding.

**Examples:**
- "CT scan shows 2.5cm lesion in right upper lobe, suspicious for malignancy"
- "Biopsy confirms invasive ductal carcinoma, Grade 2, ER+/PR+/HER2-"
- "PET scan indicates complete metabolic response to chemotherapy"

**Highlight is extracted during document processing and stored in the `medical_highlight` field.**

### 3. **Case-Pack Catalog**
A case-pack is automatically created for each patient to serve as a catalog of all their documents with highlights.

**Endpoints:**

#### Get Case-Pack with All Documents
```bash
GET /api/v1/patients/:patientId/case-pack/
```

**Response:**
```json
{
  "success": true,
  "data": {
    "case_pack": {
      "id": "cp_xyz789",
      "patient_id": "pt_abc123",
      "title": "pt_abc123 - Case Documents",
      "description": "Auto-generated case pack for patient documents",
      "created_at": 1638360000,
      "updated_at": 1638360000
    },
    "documents": [
      {
        "id": "doc_123",
        "filename": "pathology_report.pdf",
        "document_type": "pathology",
        "document_date": "2025-01-15",
        "medical_highlight": "Biopsy confirms invasive ductal carcinoma, Grade 2, ER+/PR+/HER2-",
        "processing_status": "completed",
        "file_size": 245678,
        "created_at": 1638360000,
        "added_to_case_pack": 1638360000
      },
      ...
    ],
    "total_documents": 5
  }
}
```

#### Update Case-Pack Metadata
```bash
PUT /api/v1/patients/:patientId/case-pack/
Content-Type: application/json

{
  "title": "Lung Cancer Diagnosis - January 2025",
  "description": "Complete diagnostic workup for lung cancer"
}
```

#### Remove Document from Case-Pack
```bash
DELETE /api/v1/patients/:patientId/case-pack/:docId
```

#### Reorder Documents
```bash
POST /api/v1/patients/:patientId/case-pack/reorder
Content-Type: application/json

{
  "document_ids": ["doc_123", "doc_456", "doc_789"]
}
```

## Database Changes

### New Tables

#### `case_packs`
Stores case-pack metadata for each patient.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (e.g., cp_xyz789) |
| patient_id | TEXT | Foreign key to patients |
| title | TEXT | Case-pack title |
| description | TEXT | Case-pack description |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

#### `case_pack_documents`
Junction table linking documents to case-packs.

| Column | Type | Description |
|--------|------|-------------|
| case_pack_id | TEXT | Foreign key to case_packs |
| document_id | TEXT | Foreign key to documents |
| display_order | INTEGER | Order for display (default: 0) |
| added_at | INTEGER | Unix timestamp |

### Modified Tables

#### `documents`
Added `medical_highlight` column:

| Column | Type | Description |
|--------|------|-------------|
| medical_highlight | TEXT | One-line medical summary |

## Migration

### For Existing Databases
Run the migration to add new tables and columns:

```bash
npm run d1:migrate
```

This will execute: `/migrations/001_add_case_packs_and_medical_highlights.sql`

### For New Databases
Use the updated schema:

```bash
npm run d1:init
```

## Processing Flow

### Without `process_immediately` flag (default):
1. Upload documents → saved to R2 and D1
2. Case-pack auto-created if doesn't exist
3. Documents added to case-pack
4. Documents remain in `pending` status
5. Process later via: `POST /api/v1/patients/:patientId/processing/documents/:docId/process`

### With `process_immediately=true`:
1. Upload documents → saved to R2 and D1
2. Case-pack auto-created if doesn't exist
3. Documents added to case-pack
4. **Processing triggered in background:**
   - Extract medical highlight
   - Extract structured data
   - Update clinical sections
   - Extract timeline events
5. Documents transition to `processing` → `completed`

## Updated Processing Pipeline

When a document is processed (via manual trigger or `process_immediately`):

1. **Extract Medical Highlight** (NEW)
   - Uses Gemini AI to generate 1-line summary
   - Stored in `documents.medical_highlight`

2. **Extract Structured Data**
   - Existing functionality
   - Extracts full clinical information

3. **Update Clinical Sections**
   - Existing functionality

4. **Extract Timeline Events**
   - Existing functionality

## API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/patients/:patientId/documents/` | Upload multiple documents |
| GET | `/api/v1/patients/:patientId/case-pack/` | Get case-pack with all documents |
| PUT | `/api/v1/patients/:patientId/case-pack/` | Update case-pack metadata |
| DELETE | `/api/v1/patients/:patientId/case-pack/:docId` | Remove document from case-pack |
| POST | `/api/v1/patients/:patientId/case-pack/reorder` | Reorder documents in case-pack |

## Key Benefits

1. **Faster Uploads**: Upload multiple documents at once like Typeform
2. **Quick Overview**: Medical highlights provide instant understanding of document contents
3. **Organized Catalog**: Case-packs keep all patient documents organized in one place
4. **Flexible Processing**: Choose immediate or deferred processing based on needs
5. **Token Efficiency**: Only process when needed to save AI tokens

## Example Workflow

```bash
# 1. Upload multiple documents with immediate processing
curl -X POST http://localhost:8787/api/v1/patients/pt_abc123/documents/ \
  -F "files=@biopsy_report.pdf" \
  -F "files=@ct_scan.pdf" \
  -F "files=@blood_work.pdf" \
  -F "document_type=pathology" \
  -F "process_immediately=true"

# 2. Wait for processing to complete
# (Processing happens in background)

# 3. Get case-pack with all documents and highlights
curl http://localhost:8787/api/v1/patients/pt_abc123/case-pack/

# 4. See medical highlights for each document:
# - "Biopsy confirms stage IIA adenocarcinoma"
# - "CT shows 3.2cm mass in right upper lobe with mediastinal lymph nodes"
# - "Labs show mild anemia, otherwise within normal limits"
```

## Notes

- **Auto-Creation**: Case-packs are automatically created when first documents are uploaded
- **One Per Patient**: Each patient has one case-pack that serves as their document catalog
- **Backwards Compatible**: Existing single-file uploads still work (just use `file` instead of `files`)
- **Token Usage**: Medical highlight extraction adds minimal token usage (~100-200 tokens per document)
- **Storage**: All documents remain in R2 storage with case-pack providing organizational layer

## File Changes Summary

### New Files:
- `src/models/case-pack.js` - CasePack model
- `src/routes/case-packs.js` - Case-pack API endpoints
- `migrations/001_add_case_packs_and_medical_highlights.sql` - Database migration

### Modified Files:
- `schema.sql` - Added case-pack tables and medical_highlight column
- `src/models/document.js` - Added medical_highlight field
- `src/routes/documents.js` - Updated to accept multiple files
- `src/services/gemini/client.js` - Added extractMedicalHighlight method
- `src/services/processing/processor.js` - Added highlight extraction to pipeline
- `src/index.js` - Registered case-pack routes
- `package.json` - Added d1:migrate script
