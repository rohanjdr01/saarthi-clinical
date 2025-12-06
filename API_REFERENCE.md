# Saarthi Clinical Platform - API Reference Manual

> **Version**: 2.1  
> **Last Updated**: 2025-12-06  
> **Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Base URLs & Authentication](#base-urls--authentication)
3. [Health Check](#health-check)
4. [Authentication](#authentication)
5. [Patients](#patients)
6. [Documents](#documents)
7. [Document Triage & Classification](#document-triage--classification)
8. [Document Workflow & Approval Process](#document-workflow--approval-process)
9. [Document Processing](#document-processing)
10. [Diagnosis & Staging](#diagnosis--staging)
11. [Treatment](#treatment)
12. [Medications](#medications)
13. [Alerts](#alerts)
14. [Clinical Decisions](#clinical-decisions)
15. [Timeline](#timeline)
16. [Medical History](#medical-history)
17. [Case Packs](#case-packs)
18. [Patient Intake](#patient-intake)
19. [Error Handling](#error-handling)

---

## Overview

The Saarthi Clinical Platform API provides a comprehensive REST interface for managing cancer patient records, clinical documents, diagnosis, staging, treatment, and related medical data. The API follows RESTful principles and returns JSON responses.

### Key Features

- **Document Management**: Upload, classify, and process medical documents
- **Document Triage**: AI-powered classification with GP review workflow
- **Data Provenance**: Field-level source tracking for diagnosis and staging
- **Patient Records**: Complete patient demographics and clinical data
- **Treatment Tracking**: Regimens, cycles, and treatment history
- **Semantic Search**: Vector-based document search using RAG
- **Version History**: Track changes to critical clinical data

---

## Base URLs & Authentication

### Base URLs

- **Production:** `https://process.saarthihq.com/api/v1`
- **Staging:** `https://staging.saarthihq.com/api/v1`
- **Local Development:** `http://localhost:8787/api/v1`

### Authentication

Most endpoints require Firebase authentication. Include the Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

Some endpoints require admin privileges (indicated in documentation).

---

## Health Check

### Check API Status

```
GET /api/v1/health
```

**Response:**
```json
{
  "success": true,
  "message": "Saarthi Clinical Platform is running",
  "timestamp": "2025-12-03T10:00:00.000Z",
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

### Database Diagnostic

```
GET /api/v1/health/db
```

Returns database connection status and diagnostic information.

### Storage Diagnostic

```
GET /api/v1/health/storage
```

Returns R2 storage status and recent document checks.

---

## Authentication

### Verify Firebase Token

```
POST /api/v1/auth/verify
```

**Request Body:**
```json
{
  "idToken": "firebase-id-token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "usr_abc123",
      "name": "Dr. John Doe",
      "email": "doctor@example.com",
      "phone": "+1234567890",
      "role": "doctor",
      "is_verified": true
    },
    "firebase_uid": "firebase_uid_here"
  }
}
```

### Get Current User

```
GET /api/v1/auth/me
Authorization: Bearer <firebase-token>
```

Returns the authenticated user's profile.

### Send Phone OTP (Backend - Limited)

```
POST /api/v1/auth/phone/send
```

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Note:** In production, OTP sending should happen on the client side using Firebase SDK.

### Verify Phone OTP

```
POST /api/v1/auth/phone/verify
```

**Request Body:**
```json
{
  "sessionInfo": "session-info-from-send",
  "code": "123456"
}
```

---

## Patients

### Create Patient

```
POST /api/v1/patients
```

**Request Body:**
```json
{
  "name": "John Doe",
  "age": 45,
  "gender": "male",
  "phone": "+1234567890",
  "email": "patient@example.com",
  "date_of_birth": "1978-05-15",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "caregiver_name": "Jane Doe",
  "caregiver_relation": "spouse",
  "caregiver_contact": "+1234567891"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "patient_id": "pat_abc123",
  "message": "Patient created successfully",
  "data": {
    "id": "pat_abc123",
    "name": "John Doe",
    "age": 45,
    "gender": "male",
    ...
  }
}
```

### List Patients

```
GET /api/v1/patients?limit=20&offset=0&status=active&current_status=on_treatment
```

**Query Parameters:**
- `limit` (default: 20) - Number of results per page
- `offset` (default: 0) - Pagination offset
- `status` - Filter by patient status
- `current_status` - Filter by current clinical status
- `oncologist` - Filter by assigned oncologist

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pat_abc123",
      "name": "John Doe",
      "age": 45,
      "current_status": "on_treatment",
      ...
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150
  }
}
```

### Get Patient by ID

```
GET /api/v1/patients/:id
```

Returns complete patient record including demographics, diagnosis, treatment status, etc.

### Get Patient Demographics Only

```
GET /api/v1/patients/:id/demographics
```

Returns only demographic information.

### Update Patient

```
PATCH /api/v1/patients/:id
```

**Request Body:** (partial update - only include fields to update)
```json
{
  "phone": "+1234567890",
  "current_status": "on_treatment"
}
```

### Delete Patient (Soft Delete)

```
DELETE /api/v1/patients/:id
```

Archives the patient record (soft delete).

---

## Documents

### Upload Documents

```
POST /api/v1/patients/:patientId/documents
Content-Type: multipart/form-data
```

**Form Data:**
- `files` (required) - One or more files
- `category` (optional) - Document category (will be inferred if not provided)
- `subcategory` (optional) - Document subcategory
- `document_date` (optional) - Date of document (YYYY-MM-DD)
- `process_mode` (optional) - `fast` (default) or `full`
- `provider` (optional) - AI provider: `gemini` or `openai`

**Response:** `202 Accepted`
```json
{
  "success": true,
  "documents_uploaded": 2,
  "processing_mode": "fast",
  "processing_status": "processing",
  "message": "2 document(s) uploaded successfully. Processing in fast mode.",
  "data": [
    {
      "id": "doc_xxx",
      "filename": "biopsy_report.pdf",
      "patient_id": "pat_abc123",
      "processing_status": "processing",
      ...
    }
  ]
}
```

**Processing Modes:**
- `fast`: Quick highlight extraction + vectorization (default)
- `full`: Complete extraction + patient profile sync

### List Documents

```
GET /api/v1/patients/:patientId/documents?category=pathology&start_date=2025-01-01&end_date=2025-12-31&reviewed_status=reviewed&sort=created_at&order=desc
```

**Query Parameters:**
- `category` - Filter by document category
- `start_date` - Filter by start date (YYYY-MM-DD)
- `end_date` - Filter by end date (YYYY-MM-DD)
- `reviewed_status` - Filter by review status: `pending`, `reviewed`, `approved`
- `sort` - Sort field: `created_at`, `document_date`, `case_pack_order`, `category`
- `order` - Sort order: `asc` or `desc`

### Get Document Metadata

```
GET /api/v1/patients/:patientId/documents/:docId
```

Returns document metadata including processing status, classification, medical highlights, etc.

### Update Document Metadata

```
PATCH /api/v1/patients/:patientId/documents/:docId
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "category": "pathology",
  "subcategory": "biopsy",
  "reviewed_status": "reviewed",
  "document_date": "2025-09-29",
  "case_pack_order": 1
}
```

### Download Document

```
GET /api/v1/patients/:patientId/documents/:docId/download
```

Returns the document file with appropriate `Content-Type` and `Content-Disposition` headers.

### Delete Document

```
DELETE /api/v1/patients/:patientId/documents/:docId
```

Deletes document from storage (R2), vector store, and database.

### Reorder Case-Pack Documents

```
POST /api/v1/patients/:patientId/documents/reorder
```

**Request Body:**
```json
{
  "document_orders": [
    { "document_id": "doc_123", "order": 1 },
    { "document_id": "doc_456", "order": 2 }
  ]
}
```

### Semantic Search (RAG)

```
POST /api/v1/patients/:patientId/documents/search
```

**Request Body:**
```json
{
  "query": "What was the patient's initial diagnosis?",
  "top_k": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_xxx",
      "score": 0.95,
      "metadata": {
        "document_name": "biopsy_report.pdf",
        "document_id": "doc_xxx",
        "source": "file_search"
      },
      "text": "The patient was diagnosed with adenocarcinoma...",
      "answer": "The patient was diagnosed with adenocarcinoma..."
    }
  ],
  "answer": "The patient was diagnosed with adenocarcinoma...",
  "citations": [...],
  "method": "file_search"
}
```

**Search Methods:**
- **File Search** (preferred): Uses Gemini File Search API
- **Vectorize** (fallback): Uses Cloudflare Vectorize

### Bulk Reprocess Documents

```
POST /api/v1/patients/:patientId/documents/reprocess
```

**Request Body (optional):**
```json
{
  "process_mode": "full",
  "provider": "gemini"
}
```

Reprocesses all documents for the patient.

### Reprocess Single Document

```
POST /api/v1/patients/:patientId/documents/:docId/reprocess
```

**Request Body (optional):**
```json
{
  "process_mode": "full",
  "provider": "gemini"
}
```

---

## Document Triage & Classification

### Classify Single Document

```
POST /api/v1/patients/:patientId/documents/:documentId/classify
```

**Request Body (optional):**
```json
{
  "force": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document_id": "doc_xxx",
    "classification": "cancer_core",
    "confidence": 0.92,
    "reason": "Pathology report showing adenocarcinoma diagnosis",
    "document_category": "biopsy",
    "document_date": "2025-09-29"
  }
}
```

**Classifications:**
- `cancer_core`: Directly about cancer diagnosis/treatment
- `cancer_adjacent`: May be relevant (labs, discharge summaries)
- `non_cancer`: Unrelated to cancer journey
- `pending`: Not yet classified

### Bulk Classify Documents

```
POST /api/v1/patients/:patientId/documents/classify
```

**Request Body (optional):**
```json
{
  "force": false,
  "document_ids": ["doc_xxx", "doc_yyy"]
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "total_documents": 42,
    "classified": 38,
    "already_classified": 4,
    "results": [
      {
        "document_id": "doc_xxx",
        "classification": "cancer_core",
        "confidence": 0.95
      }
    ]
  }
}
```

### Get Triage Queue

```
GET /api/v1/patients/:patientId/documents/triage?status=pending
```

**Query Parameters:**
- `status`: `pending` (default) | `reviewed` | `all`

**Response:**
```json
{
  "success": true,
  "data": {
    "patient_id": "pat_xxx",
    "summary": {
      "total": 42,
      "pending_review": 38,
      "reviewed": 4,
      "by_classification": {
        "cancer_core": 14,
        "cancer_adjacent": 18,
        "non_cancer": 10,
        "uncertain": 2,
        "pending": 0
      }
    },
    "documents": {
      "cancer_core": [
        {
          "id": "doc_xxx",
          "filename": "biopsy_report_sep2025.pdf",
          "document_category": "biopsy",
          "classification_confidence": 0.95,
          "classification_reason": "Pathology report with adenocarcinoma diagnosis",
          "document_date": "2025-09-29",
          "gp_reviewed": false
        }
      ],
      "cancer_adjacent": [...],
      "non_cancer": [...],
      "uncertain": [...]
    }
  }
}
```

### Update Document Classification (GP Review)

```
PATCH /api/v1/patients/:patientId/documents/:documentId/classification
```

**Request Body:**
```json
{
  "classification": "cancer_core",
  "approved_for_extraction": true,
  "notes": "Relevant biopsy from initial diagnosis"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document_id": "doc_xxx",
    "classification": "cancer_core",
    "previous_classification": "cancer_adjacent",
    "gp_reviewed": true,
    "gp_approved_for_extraction": true,
    "gp_reviewed_at": 1733328000
  }
}
```

### Bulk Update Classifications (GP Batch Review)

```
POST /api/v1/patients/:patientId/documents/triage/batch
```

**Request Body:**
```json
{
  "updates": [
    {
      "document_id": "doc_xxx",
      "classification": "cancer_core",
      "approved_for_extraction": true
    },
    {
      "document_id": "doc_yyy",
      "classification": "cancer_adjacent",
      "approved_for_extraction": false
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updated": 2,
    "approved_for_extraction": 1,
    "results": [
      { "document_id": "doc_xxx", "status": "updated" },
      { "document_id": "doc_yyy", "status": "updated" }
    ]
  }
}
```

### Process Approved Documents

```
POST /api/v1/patients/:patientId/documents/process-approved
```

**Request Body (optional):**
```json
{
  "process_mode": "full",
  "provider": "gemini"
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "queued": 12,
    "documents": [
      { "id": "doc_xxx", "status": "processing" }
    ]
  }
}
```

Processes all documents where `gp_approved_for_extraction = 1` and `processing_status != 'processed'`.

---

## Document Workflow & Approval Process

### Overview

The document lifecycle follows a structured workflow from upload through classification, review, approval, and finally full extraction. This section explains the complete process and the endpoints involved at each stage.

### Workflow Stages

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: DOCUMENT UPLOAD                                        │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─► POST /api/v1/patients/:patientId/documents
   │   • Upload document(s) with multipart/form-data
   │   • process_mode: "fast" (default) or "full"
   │
   ├─► AUTOMATIC PROCESSING (Parallel)
   │   ├─► Classification (First Page Only)
   │   │   • AI analyzes first page only
   │   │   • Assigns: cancer_core | cancer_adjacent | non_cancer
   │   │   • Sets confidence score and reason
   │   │
   │   └─► Fast Processing (Whole Document)
   │       • Extracts medical highlight
   │       • Vectorizes for search
   │       • Uploads to File Search OR Vectorize
   │       • Document becomes searchable immediately
   │
   ▼

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: TRIAGE & REVIEW                                        │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─► GET /api/v1/patients/:patientId/documents/triage
   │   • Get documents grouped by classification
   │   • Filter by status: pending | reviewed | all
   │   • Review AI classification results
   │
   ├─► Classification States:
   │   • cancer_core: Directly cancer-related (pathology, imaging, chemo)
   │   • cancer_adjacent: Possibly relevant (labs, discharge summaries)
   │   • non_cancer: Unrelated to cancer journey
   │   • pending: Not yet classified
   │
   ▼

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: MANUAL CLASSIFICATION (GP Review)                      │
└─────────────────────────────────────────────────────────────────┘
   │
   ├─► Single Document Classification Update
   │   PATCH /api/v1/patients/:patientId/documents/:docId/classification
   │   Body: {
   │     "classification": "cancer_core",
   │     "approved_for_extraction": true,  // ← Key flag
   │     "notes": "Relevant biopsy from initial diagnosis"
   │   }
   │
   └─► Batch Classification Update
       POST /api/v1/patients/:patientId/documents/triage/batch
       Body: {
         "updates": [
           {
             "document_id": "doc_xxx",
             "classification": "cancer_core",
             "approved_for_extraction": true  // ← Key flag
           }
         ]
       }
   │
   ├─► Sets: gp_reviewed = 1
   ├─► Sets: gp_approved_for_extraction = 0 or 1
   │
   ▼

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: FULL EXTRACTION (Approved Documents Only)              │
└─────────────────────────────────────────────────────────────────┘
   │
   └─► POST /api/v1/patients/:patientId/documents/process-approved
       • Processes only documents with gp_approved_for_extraction = 1
       • Performs full medical data extraction
       • Updates patient profile:
         ├─► Diagnosis & Staging
         ├─► Treatment Plans & Cycles
         ├─► Medications
         ├─► Lab Results & Tumor Markers
         ├─► Medical History
         └─► Timeline Events
```

### Key Points

#### 1. Upload Phase
- **Endpoint**: `POST /api/v1/patients/:patientId/documents`
- **What Happens**:
  - Document uploaded to R2 storage
  - Classification triggered (first page only) - fast & cheap
  - Fast processing triggered (whole document) - vectorization
  - Document becomes immediately searchable
  - No full extraction yet

#### 2. Classification
- **Automatic**: AI classifies on upload using first page only
- **Classifications**:
  - `cancer_core`: Direct cancer documents (pathology, chemo protocols, tumor imaging)
  - `cancer_adjacent`: Potentially relevant (blood work, discharge summaries)
  - `non_cancer`: Unrelated (dental records, pre-diagnosis checkups)

#### 3. Manual Review & Approval
- **Endpoints**:
  - View triage queue: `GET /documents/triage`
  - Update single: `PATCH /documents/:docId/classification`
  - Batch update: `POST /documents/triage/batch`
- **Critical Flag**: `approved_for_extraction`
  - `true` = Approved for full extraction
  - `false` = Classified but not approved
- **Purpose**: Human verification before expensive full extraction

#### 4. Full Extraction
- **Endpoint**: `POST /documents/process-approved`
- **Trigger**: Only processes documents where `gp_approved_for_extraction = 1`
- **Processing**: Whole document extraction
  - Extracts all medical data fields
  - Updates diagnosis, staging, treatment, medications
  - Creates timeline events
  - Links data to source documents (provenance)

### Workflow Example

```bash
# 1. Upload document (auto-classifies & vectorizes)
curl -X POST http://localhost:8787/api/v1/patients/pt_xxx/documents \
  -F "files=@biopsy_report.pdf" \
  -F "process_mode=fast"

# Response: { "documents_uploaded": 1, "processing_status": "processing" }

# 2. Check triage queue
curl http://localhost:8787/api/v1/patients/pt_xxx/documents/triage?status=pending

# Response: Shows documents grouped by classification
# {
#   "documents": {
#     "cancer_core": [
#       {
#         "id": "doc_xxx",
#         "classification": "cancer_core",
#         "confidence": 0.95,
#         "gp_reviewed": false
#       }
#     ]
#   }
# }

# 3. Approve for extraction (single document)
curl -X PATCH http://localhost:8787/api/v1/patients/pt_xxx/documents/doc_xxx/classification \
  -H "Content-Type: application/json" \
  -d '{
    "classification": "cancer_core",
    "approved_for_extraction": true
  }'

# Response: { "gp_reviewed": true, "gp_approved_for_extraction": true }

# 4. Process all approved documents
curl -X POST http://localhost:8787/api/v1/patients/pt_xxx/documents/process-approved \
  -H "Content-Type: application/json" \
  -d '{ "process_mode": "full" }'

# Response: { "queued": 1, "documents": [{ "id": "doc_xxx", "status": "processing" }] }

# 5. Check processing status
curl http://localhost:8787/api/v1/patients/pt_xxx/processing/status

# Response: { "completed": 1, "pending": 0 }
```

### Important Notes

1. **All Documents Are Searchable**: Fast processing (vectorization) happens for ALL documents regardless of classification, making them immediately searchable via RAG.

2. **Classification Uses First Page Only**: Fast and cheap classification analyzes only the first page of PDFs, which is sufficient for document type identification.

3. **Full Extraction Uses Whole Document**: When approved, full extraction processes the entire document to build the complete patient profile.

4. **Manual Approval Required**: Documents are NOT automatically fully extracted based on classification alone. They require explicit GP approval via the `approved_for_extraction` flag.

5. **Reclassification Supported**: Documents can be manually reclassified at any time using the PATCH endpoint, even after initial AI classification.

6. **Batch Operations**: For efficiency, use batch endpoints when reviewing multiple documents.

### API Endpoints Summary

| Stage | Endpoint | Purpose |
|-------|----------|---------|
| Upload | `POST /patients/:id/documents` | Upload documents |
| Auto | (Automatic) | Classification + Vectorization |
| Triage | `GET /patients/:id/documents/triage` | View pending documents |
| Review | `PATCH /patients/:id/documents/:docId/classification` | Approve single document |
| Batch | `POST /patients/:id/documents/triage/batch` | Approve multiple documents |
| Extract | `POST /patients/:id/documents/process-approved` | Full extraction of approved docs |
| Status | `GET /patients/:id/processing/status` | Check processing status |

---

## Document Processing

### Trigger Processing for Document

```
POST /api/v1/patients/:patientId/processing/documents/:docId/process
```

**Query Parameters (optional):**
- `provider` - AI provider: `gemini` or `openai`
- `resync` - Set to `true` to re-sync from cached data without LLM call

**Request Body (optional):**
```json
{
  "provider": "gemini"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document processed successfully",
  "data": {
    "success": true,
    "document_id": "doc_miss3t620h3wmaq",
    "extracted_data": {
      "patient_demographics": {
        "name": "Patient Name",
        "age": 65,
        "gender": "male"
      },
      "diagnosis": {
        "cancer_type": "Adenocarcinoma",
        "cancer_site_primary": "Stomach",
        "morphology": "Focal signet ring cell morphology"
      },
      "staging": {
        "metastatic": false,
        "nodes": "Gastrohepatic lymph nodes up to 15 x 9.7 mm"
      },
      "treatment": {
        "regimen_name": "mFOLFOX-6",
        "drugs": ["Oxaliplatin", "Calcium Leucovorin", "5-Fluorouracil"],
        "start_date": "2025-10-03",
        "intent": "neoadjuvant"
      },
      "treatment_cycle": [
        {
          "cycle_number": 1,
          "start_date": "2025-10-03",
          "regimen_name": "FOLFOX-6"
        }
      ],
      "medications": [...],
      "timeline_events": [...],
      "clinical_decisions": [...]
    },
    "tokens_used": 15000,
    "processing_time_ms": 45000,
    "provider": "openai",
    "model": "gpt-4.1"
  }
}
```

### Re-sync Profile from Cached Data (No LLM Call)

Use this endpoint when the document has already been processed but the profile sync failed or needs to be re-run. This reads the cached `extracted_data` from the database and re-runs all sync functions **without making any LLM API calls**.

```
POST /api/v1/patients/:patientId/processing/documents/:docId/resync
```

**Alternative:** Add `?resync=true` to the process endpoint:
```
POST /api/v1/patients/:patientId/processing/documents/:docId/process?resync=true
```

**Response:**
```json
{
  "success": true,
  "message": "Profile re-synced from cached data",
  "data": {
    "success": true,
    "document_id": "doc_miss3t620h3wmaq",
    "patient_id": "pt_mirfykmojcgc5xr",
    "extracted_data": {
      "diagnosis": {
        "cancer_type": "Adenocarcinoma",
        "cancer_site_primary": "Stomach",
        "morphology": "Focal signet ring cell morphology",
        "notes": "Diagnostic laparoscopy showed no serosal/omental/peritoneal metastases."
      },
      "staging": {
        "metastatic": false,
        "nodes": "Gastrohepatic lymph nodes up to 15 x 9.7 mm on CT (2025-09-12)",
        "notes": "CT Thorax (2025-09-23) showed no lung lesion. No ascites."
      },
      "treatment": {
        "regimen_name": "mFOLFOX-6",
        "drugs": ["Oxaliplatin", "Calcium Leucovorin", "5-Fluorouracil (bolus)", "5-Fluorouracil (continuous infusion)"],
        "start_date": "2025-10-03",
        "type": "neoadjuvant chemotherapy",
        "intent": "neoadjuvant"
      },
      "treatment_cycle": [
        {
          "cycle_number": 1,
          "start_date": "2025-10-03",
          "regimen_name": "FOLFOX-6",
          "notes": "Chemo chart indicates FOLFOX given on 2025-10-03"
        },
        {
          "cycle_number": 2,
          "start_date": "2025-10-17",
          "end_date": "2025-10-19",
          "regimen_name": "mFOLFOX-6",
          "notes": "Tolerated."
        },
        {
          "cycle_number": 3,
          "start_date": "2025-10-31",
          "end_date": "2025-11-02",
          "regimen_name": "mFOLFOX-6",
          "drugs_administered": [
            {"drug": "Oxaliplatin", "dose_value": 130, "dose_unit": "mg", "route": "IV"},
            {"drug": "Calcium Leucovorin", "dose_value": 600, "dose_unit": "mg", "route": "IV"},
            {"drug": "5-Fluorouracil (bolus)", "dose_value": 600, "dose_unit": "mg", "route": "IV"},
            {"drug": "5-Fluorouracil (continuous infusion)", "dose_value": 4000, "dose_unit": "mg", "route": "IV infusion"}
          ],
          "notes": "Pre-chemotherapy investigations within normal limits; tolerated well."
        }
      ],
      "medications": [
        {"generic_name": "Pantoprazole", "dose_value": 40, "dose_unit": "mg", "frequency": "once daily", "route": "oral"},
        {"generic_name": "Vitamin B complex with Zinc", "brand_name": "Becosules-Z", "frequency": "every morning", "route": "oral"},
        {"generic_name": "Ondansetron", "brand_name": "Emeset", "dose_value": 4, "dose_unit": "mg", "frequency": "two times a day as needed"}
      ],
      "timeline_events": [
        {"date": "2025-09-12", "event": "CT Abdomen and Pelvis", "details": "Thickening of stomach with luminal narrowing"},
        {"date": "2025-09-16", "event": "Upper GI endoscopy", "details": "Ulcerative growth 4 cm below GE junction"},
        {"date": "2025-09-24", "event": "OGD biopsy review", "details": "Adenocarcinoma with focal signet ring cell morphology"},
        {"date": "2025-10-03", "event": "Chemotherapy cycle 1 started", "details": "mFOLFOX-6 regimen"},
        {"date": "2025-10-17", "event": "Chemotherapy cycle 2", "details": "mFOLFOX-6"},
        {"date": "2025-10-31", "event": "Chemotherapy cycle 3", "details": "mFOLFOX-6; tolerated well"}
      ],
      "clinical_decisions": [
        {"date": "2025-10-31", "decision": "Proceed with cycle 3 mFOLFOX-6; continue neoadjuvant chemotherapy."},
        {"date": "2025-11-02", "decision": "Discharge in stable condition; check CBC on 2025-11-07; follow-up on 2025-11-14."}
      ],
      "hospitalizations": [
        {
          "facility": "MVR Cancer Centre & Research Institute, Kozhikode, Kerala, India",
          "department": "Medical Oncology",
          "admission_date": "2025-10-31",
          "discharge_date": "2025-11-02",
          "reason": "Cycle 3 neoadjuvant chemotherapy (mFOLFOX-6)",
          "discharge_condition": "Stable"
        }
      ],
      "document_info": {
        "document_type": "lab_report",
        "document_date": "2025-11-02",
        "facility": "MVR Cancer Centre & Research Institute",
        "department": "Medical Oncology",
        "author": "Dr. Prasanth Parameswaran (DM, Medical Oncology)",
        "title": "Discharge Summary and Chemotherapy Chart"
      }
    },
    "synced_from_cache": true
  }
}
```

**Error Response (No Cached Data):**
```json
{
  "success": false,
  "error": "No cached extracted data found. Run full processing first.",
  "document_id": "doc_xxx"
}
```

**Use Cases:**
- Profile sync failed due to code bug (now fixed)
- New sync functions added after initial processing
- Need to re-run sync without incurring LLM costs
- Testing profile sync logic changes

### Get Processing Status

```
GET /api/v1/patients/:patientId/processing/status
```

**Response:**
```json
{
  "success": true,
  "patient_id": "pat_xxx",
  "status": {
    "pending": 5,
    "processing": 2,
    "completed": 30,
    "failed": 1
  },
  "pending": 5,
  "processing": 2,
  "completed": 30,
  "failed": 1
}
```

### Get Processing Log

```
GET /api/v1/patients/:patientId/processing/log
```

Returns recent processing log entries (last 20).

### Get Document Processing Status

```
GET /api/v1/patients/:patientId/processing/documents/:docId/status
```

**Response:**
```json
{
  "success": true,
  "document_id": "doc_xxx",
  "filename": "biopsy_report.pdf",
  "processing_status": "completed",
  "processing_started_at": 1733328000,
  "processing_completed_at": 1733328500,
  "processing_error": null,
  "vectorize_status": "completed",
  "vectorized_at": 1733328500,
  "file_search_status": "completed",
  "tokens_used": 15000,
  "model": "gemini-2.0-flash-exp"
}
```

### List All Documents (Debug)

```
GET /api/v1/patients/:patientId/processing/documents
```

Returns all documents for the patient with processing status.

---

## Diagnosis & Staging

### Get Diagnosis

```
GET /api/v1/patients/:id/diagnosis
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "diag_mirh1mndu57kx80",
    "patient_id": "pt_mirfykmojcgc5xr",
    "primary_cancer_type": "Adenocarcinoma",
    "primary_cancer_subtype": null,
    "icd_code": null,
    "diagnosis_date": "2025-11-02",
    "tumor_location": "Stomach",
    "tumor_laterality": null,
    "tumor_size_cm": null,
    "tumor_grade": null,
    "histology": "Focal signet ring cell morphology",
    "biomarkers": null,
    "genetic_mutations": null,
    "metastatic_sites": null,
    "data_sources": {
      "primary_cancer_type": ["doc_miss3t620h3wmaq"],
      "tumor_location": ["doc_miss3t620h3wmaq"],
      "histology": ["doc_miss3t620h3wmaq"],
      "diagnosis_date": ["doc_miss3t620h3wmaq"]
    },
    "document_sources": [
      {
        "document_id": "doc_miss3t620h3wmaq",
        "filename": "discharge_summary.pdf"
      }
    ],
    "field_sources": {
      "primary_cancer_type": [
        {
          "document_id": "doc_miss3t620h3wmaq",
          "filename": "discharge_summary.pdf"
        }
      ],
      "tumor_location": [
        {
          "document_id": "doc_miss3t620h3wmaq",
          "filename": "discharge_summary.pdf"
        }
      ],
      "histology": [
        {
          "document_id": "doc_miss3t620h3wmaq",
          "filename": "discharge_summary.pdf"
        }
      ]
    },
    "created_at": 1733328000,
    "updated_at": 1733497800
  }
}
```

**Data Provenance:**
- `data_sources`: Maps field names to document IDs
- `document_sources`: List of all source documents with filenames
- `field_sources`: Field-level document mapping with filenames

### Update Diagnosis (Admin Only)

```
PUT /api/v1/patients/:id/diagnosis
```

**Request Body:**
```json
{
  "primary_cancer_type": "Adenocarcinoma",
  "cancer_site_primary": "Stomach",
  "histology": "Adenocarcinoma",
  "diagnosis_date": "2025-09-29",
  "tumor_grade": "G2",
  "biomarkers": {
    "HER2": "negative",
    "MSI": "stable"
  },
  "edit_reason": "Manual correction based on pathology review"
}
```

**Note:** Creates version history for changed fields. Requires admin role.

### Get Staging

```
GET /api/v1/patients/:id/staging
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "id": "stg_002",
      "staging_type": "restaging",
      "staging_date": "2025-11-15",
      "staging_system": "AJCC 8th Edition",
      "clinical_tnm": "cT2N1M0",
      "pathological_tnm": "pT2N1M0",
      "overall_stage": "IIB",
      "source_document": "doc_yyy",
      "source_document_filename": "ct_scan_nov2025.pdf"
    },
    "timeline": [
      {
        "id": "stg_001",
        "staging_type": "initial",
        "staging_date": "2025-09-29",
        "overall_stage": "IIIA",
        "clinical_tnm": "cT3N2M0",
        "source_document": "doc_xxx",
        "source_document_filename": "initial_ct_scan.pdf"
      },
      {
        "id": "stg_002",
        "staging_type": "restaging",
        "staging_date": "2025-11-15",
        "overall_stage": "IIB",
        "clinical_tnm": "cT2N1M0",
        "source_document": "doc_yyy",
        "source_document_filename": "ct_scan_nov2025.pdf"
      }
    ],
    "document_sources": [
      {
        "document_id": "doc_xxx",
        "filename": "initial_ct_scan.pdf"
      },
      {
        "document_id": "doc_yyy",
        "filename": "ct_scan_nov2025.pdf"
      }
    ]
  }
}
```

### Update Staging (Admin Only)

```
PUT /api/v1/patients/:id/staging
```

**Request Body:**
```json
{
  "clinical_t": "T2",
  "clinical_n": "N1",
  "clinical_m": "M0",
  "clinical_stage": "IIB",
  "staging_system": "AJCC 8th Edition",
  "staging_date": "2025-11-15",
  "edit_reason": "Manual correction"
}
```

**Note:** Creates version history. Requires admin role.

### Get Staging Snapshots (Timeline)

```
GET /api/v1/patients/:id/staging/snapshots
```

**Response:**
```json
{
  "success": true,
  "data": {
    "snapshots": [
      {
        "id": "stg_001",
        "staging_type": "initial",
        "staging_date": "2025-09-29",
        "staging_system": "AJCC 8th Edition",
        "clinical_tnm": "cT3N2M0",
        "pathological_tnm": null,
        "overall_stage": "IIIA",
        "document_id": "doc_xxx",
        "created_at": 1727568000
      },
      {
        "id": "stg_002",
        "staging_type": "restaging",
        "staging_date": "2025-11-15",
        "staging_system": "AJCC 8th Edition",
        "clinical_tnm": "cT2N1M0",
        "pathological_tnm": "pT2N1M0",
        "overall_stage": "IIB",
        "document_id": "doc_yyy",
        "created_at": 1731628800
      }
    ]
  }
}
```

### Create Staging Snapshot (Admin)

```
POST /api/v1/patients/:id/staging/snapshots
```

**Request Body:**
```json
{
  "staging_type": "restaging",
  "staging_date": "2025-11-20",
  "staging_system": "AJCC 8th Edition",
  "clinical_tnm": "cT2N0M0",
  "pathological_tnm": null,
  "overall_stage": "IIA",
  "document_id": "doc_zzz",
  "notes": "Post-chemotherapy restaging"
}
```

**Staging Types:**
- `initial`: Initial staging at diagnosis
- `restaging`: Re-evaluation after treatment
- `post_treatment`: Post-treatment staging
- `recurrence`: Staging at recurrence

---

## Treatment

### Get Treatment Overview

```
GET /api/v1/patients/:id/treatment
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tx_mirh1mndxabsc0k",
    "patient_id": "pt_mirfykmojcgc5xr",
    "regimen_name": "mFOLFOX-6 (neoadjuvant)",
    "treatment_intent": "Neoadjuvant",
    "treatment_line": null,
    "protocol": null,
    "drugs": ["Oxaliplatin", "Calcium Leucovorin", "5-Fluorouracil (bolus)", "5-Fluorouracil (continuous infusion)"],
    "total_planned_cycles": null,
    "treatment_status": "active",
    "start_date": "2025-10-03",
    "planned_end_date": null,
    "actual_end_date": null,
    "best_response": null,
    "response_date": null,
    "data_sources": {
      "regimen_name": {
        "value": "mFOLFOX-6 (neoadjuvant)",
        "source": "doc_miss3t620h3wmaq",
        "timestamp": 1733497800
      },
      "treatment_intent": {
        "value": "Neoadjuvant",
        "source": "doc_miss3t620h3wmaq",
        "timestamp": 1733497800
      },
      "drugs": {
        "value": "[\"Oxaliplatin\",\"Calcium Leucovorin\",\"5-Fluorouracil (bolus)\",\"5-Fluorouracil (continuous infusion)\"]",
        "source": "doc_miss3t620h3wmaq",
        "timestamp": 1733497800
      },
      "start_date": {
        "value": "2025-10-03",
        "source": "doc_miss3t620h3wmaq",
        "timestamp": 1733497800
      }
    },
    "created_at": 1733328000,
    "updated_at": 1733497800
  }
}
```

### Update Treatment (Admin Only)

```
PUT /api/v1/patients/:id/treatment
```

**Request Body:**
```json
{
  "regimen_name": "m.FOLFOX-6",
  "treatment_intent": "curative",
  "treatment_line": "first_line",
  "total_planned_cycles": 12,
  "treatment_status": "active",
  "best_response": "partial_response",
  "edit_reason": "Updated based on latest scan"
}
```

**Note:** Creates version history. Requires admin role.

### Get Treatment Cycles

```
GET /api/v1/patients/:id/treatment/cycles
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cyc_mirjj0qv8cxdcbc",
      "treatment_id": "tx_mirh1mndxabsc0k",
      "patient_id": "pt_mirfykmojcgc5xr",
      "cycle_number": 1,
      "planned_date": "2025-10-03",
      "actual_date": "2025-10-03",
      "cycle_status": "completed",
      "drugs_administered": null,
      "notes": "Chemo chart indicates FOLFOX given on 2025-10-03; 5-FU noted again on 2025-10-06.",
      "data_sources": {
        "source": "doc_miss3t620h3wmaq",
        "document_date": "2025-11-02",
        "extracted_at": "2025-12-06T11:30:00.000Z"
      }
    },
    {
      "id": "cyc_mirjj0qwabcd123",
      "treatment_id": "tx_mirh1mndxabsc0k",
      "patient_id": "pt_mirfykmojcgc5xr",
      "cycle_number": 2,
      "planned_date": "2025-10-17",
      "actual_date": "2025-10-19",
      "cycle_status": "completed",
      "drugs_administered": null,
      "notes": "Tolerated.",
      "data_sources": {
        "source": "doc_miss3t620h3wmaq",
        "document_date": "2025-11-02",
        "extracted_at": "2025-12-06T11:30:00.000Z"
      }
    },
    {
      "id": "cyc_mirjj0qxefgh456",
      "treatment_id": "tx_mirh1mndxabsc0k",
      "patient_id": "pt_mirfykmojcgc5xr",
      "cycle_number": 3,
      "planned_date": "2025-10-31",
      "actual_date": "2025-11-02",
      "cycle_status": "completed",
      "drugs_administered": [
        {"drug": "Oxaliplatin", "dose_value": 130, "dose_unit": "mg", "route": "IV"},
        {"drug": "Calcium Leucovorin", "dose_value": 600, "dose_unit": "mg", "route": "IV"},
        {"drug": "5-Fluorouracil (bolus)", "dose_value": 600, "dose_unit": "mg", "route": "IV"},
        {"drug": "5-Fluorouracil (continuous infusion)", "dose_value": 4000, "dose_unit": "mg", "route": "IV infusion"}
      ],
      "notes": "Pre-chemotherapy investigations within normal limits; tolerated well.",
      "data_sources": {
        "source": "doc_miss3t620h3wmaq",
        "document_date": "2025-11-02",
        "extracted_at": "2025-12-06T11:30:00.000Z"
      }
    }
  ]
}
```

**Note on Additive Cycles:**  
Treatment cycles are **additive** - when the same cycle number is extracted from different documents, both records are kept (not overwritten). This allows doctors to see all cycle events from different sources. Each cycle record includes `data_sources` with:
- `source`: Document ID the cycle was extracted from
- `document_date`: Date of the source document  
- `extracted_at`: When the cycle was extracted

Duplicate cycles from the same document are automatically skipped during re-processing.

### Get Single Treatment Cycle

```
GET /api/v1/patients/:id/treatment/cycles/:cycleNumber
```

### Add Treatment Cycle

```
POST /api/v1/patients/:id/treatment/cycles
```

**Request Body:**
```json
{
  "cycle_number": 2,
  "planned_date": "2025-10-15",
  "actual_date": "2025-10-15",
  "drugs_administered": [
    {
      "drug": "Oxaliplatin",
      "dose": 85,
      "unit": "mg/m²",
      "route": "IV"
    }
  ],
  "cycle_status": "completed",
  "ctcae_grade": 1
}
```

### Update Treatment Cycle

```
PUT /api/v1/patients/:id/treatment/cycles/:cycleNumber
```

**Request Body:**
```json
{
  "actual_date": "2025-10-16",
  "cycle_status": "completed",
  "ctcae_grade": 2,
  "dose_reduced": true,
  "dose_reduction_reason": "Grade 2 neuropathy",
  "dose_percentage": 85.0
}
```

---

## Medications

### List Medications

```
GET /api/v1/patients/:patientId/medications
```

**Response:**
```json
{
  "success": true,
  "data": {
    "active": [
      {
        "id": "med_mirjj16utgnglk0",
        "patient_id": "pt_mirfykmojcgc5xr",
        "medication_name": "Pantop 40 mg",
        "generic_name": "Pantoprazole",
        "drug_class": null,
        "dose": 40,
        "dose_unit": "mg",
        "frequency": "once daily",
        "route": "oral",
        "medication_status": "active",
        "medication_type": "supportive",
        "treatment_context": "Supportive Care",
        "start_date": null,
        "end_date": null,
        "indication": null,
        "data_sources": {
          "source": "doc_miss3t620h3wmaq",
          "extracted_at": "2025-12-06T11:30:00.000Z"
        }
      },
      {
        "id": "med_miu7juibaj25yc4",
        "patient_id": "pt_mirfykmojcgc5xr",
        "medication_name": "Becosules-Z",
        "generic_name": "Vitamin B complex with Zinc",
        "drug_class": null,
        "dose": 1,
        "dose_unit": "capsule",
        "frequency": "every morning",
        "route": "oral",
        "medication_status": "active",
        "medication_type": "supportive",
        "treatment_context": "Supportive Care"
      },
      {
        "id": "med_miu7juic3z0d9k6",
        "patient_id": "pt_mirfykmojcgc5xr",
        "medication_name": "Emeset",
        "generic_name": "Ondansetron",
        "drug_class": null,
        "dose": 4,
        "dose_unit": "mg",
        "frequency": "two times a day as needed",
        "route": "oral",
        "medication_status": "active",
        "medication_type": "supportive",
        "treatment_context": "Supportive Care"
      }
    ],
    "discontinued": [],
    "supportive": []
  },
  "flat": [...]
}
```

### Create Medication (Admin Only)

```
POST /api/v1/patients/:patientId/medications
```

**Request Body:**
```json
{
  "medication_name": "Capecitabine",
  "generic_name": "Capecitabine",
  "dose": 1000,
  "dose_unit": "mg",
  "frequency": "twice daily",
  "route": "oral",
  "medication_status": "active",
  "medication_type": "chemotherapy",
  "treatment_context": "m.FOLFOX-6",
  "start_date": "2025-10-01",
  "indication": "Colorectal cancer"
}
```

### Update Medication (Admin Only)

```
PUT /api/v1/patients/:patientId/medications/:medId
```

### Delete Medication (Admin Only)

```
DELETE /api/v1/patients/:patientId/medications/:medId
```

---

## Alerts

### List Alerts

```
GET /api/v1/patients/:patientId/alerts
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert_xxx",
      "alert_type": "clinical",
      "severity": "high",
      "title": "Elevated CA-125",
      "description": "CA-125 level is 89 U/mL, concerning for recurrence",
      "alert_category": "tumor_marker",
      "alert_status": "active",
      "actionable": true,
      "recommended_action": "Consider imaging studies"
    }
  ]
}
```

### Create Alert (Admin Only)

```
POST /api/v1/patients/:patientId/alerts
```

**Request Body:**
```json
{
  "alert_type": "clinical",
  "severity": "high",
  "title": "Elevated CA-125",
  "description": "CA-125 level is 89 U/mL",
  "alert_category": "tumor_marker",
  "actionable": true,
  "recommended_action": "Consider imaging studies"
}
```

### Update Alert (Admin Only)

```
PUT /api/v1/patients/:patientId/alerts/:alertId
```

### Delete Alert (Admin Only)

```
DELETE /api/v1/patients/:patientId/alerts/:alertId
```

---

## Clinical Decisions

### List Clinical Decisions

```
GET /api/v1/patients/:patientId/decisions
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "dec_xxx",
      "decision_type": "treatment_selection",
      "clinical_question": "Should patient receive adjuvant chemotherapy?",
      "decision_made": "Yes, proceed with m.FOLFOX-6",
      "rationale": "Stage III disease, good performance status",
      "decision_date": "2025-10-01"
    }
  ]
}
```

### Create Clinical Decision (Admin Only)

```
POST /api/v1/patients/:patientId/decisions
```

**Request Body:**
```json
{
  "decision_type": "treatment_selection",
  "clinical_question": "Should patient receive adjuvant chemotherapy?",
  "decision_made": "Yes, proceed with m.FOLFOX-6",
  "rationale": "Stage III disease, good performance status",
  "decision_date": "2025-10-01"
}
```

### Update Clinical Decision (Admin Only)

```
PUT /api/v1/patients/:patientId/decisions/:decisionId
```

### Delete Clinical Decision (Admin Only)

```
DELETE /api/v1/patients/:patientId/decisions/:decisionId
```

---

## Timeline

### Get Patient Timeline

```
GET /api/v1/patients/:patientId/timeline?from=2025-01-01&to=2025-12-31&types=diagnosis,treatment
```

**Query Parameters:**
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)
- `types` - Comma-separated event types

**Response:**
```json
{
  "success": true,
  "patient_id": "pt_mirfykmojcgc5xr",
  "timeline": [
    {
      "date": "2025-09-12",
      "events": [
        {
          "id": "evt_miu7juicp8xf1k0",
          "type": "imaging",
          "category": "clinical",
          "title": "CT Abdomen and Pelvis",
          "description": "Thickening of greater and lesser curvature of stomach with luminal narrowing; gastrohepatic lymph nodes up to 15 x 9.7 mm; no ascites.",
          "track": "imaging",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-09-16",
      "events": [
        {
          "id": "evt_miu7juicq9yg2l1",
          "type": "procedure",
          "category": "clinical",
          "title": "Upper GI endoscopy",
          "description": "Ulcerative growth 4 cm below GE junction along lesser curvature and posterior wall up to proximal antrum.",
          "track": "procedure",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-09-24",
      "events": [
        {
          "id": "evt_miu7juicr0zh3m2",
          "type": "diagnosis",
          "category": "clinical",
          "title": "OGD biopsy review",
          "description": "Adenocarcinoma with focal signet ring cell morphology.",
          "track": "diagnosis",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-09-29",
      "events": [
        {
          "id": "evt_miu7juics1ai4n3",
          "type": "procedure",
          "category": "clinical",
          "title": "Diagnostic laparoscopy and peritoneal cytology",
          "description": "Reactive mesothelial cells; negative for malignancy.",
          "track": "procedure",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-10-03",
      "events": [
        {
          "id": "evt_miu7juict2bj5o4",
          "type": "treatment",
          "category": "clinical",
          "title": "Chemotherapy cycle 1 started",
          "description": "mFOLFOX-6 regimen.",
          "track": "treatment",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-10-17",
      "events": [
        {
          "id": "evt_miu7juicu3ck6p5",
          "type": "treatment",
          "category": "clinical",
          "title": "Chemotherapy cycle 2",
          "description": "mFOLFOX-6; 2025-10-17 to 2025-10-19.",
          "track": "treatment",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-10-31",
      "events": [
        {
          "id": "evt_miu7juicv4dl7q6",
          "type": "treatment",
          "category": "clinical",
          "title": "Chemotherapy cycle 3",
          "description": "mFOLFOX-6; 2025-10-31 to 2025-11-02; tolerated well.",
          "track": "treatment",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-11-07",
      "events": [
        {
          "id": "evt_miu7juicw5em8r7",
          "type": "lab",
          "category": "clinical",
          "title": "Planned lab",
          "description": "Check CBC and inform over phone.",
          "track": "lab",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    },
    {
      "date": "2025-11-14",
      "events": [
        {
          "id": "evt_miu7juicx6fn9s8",
          "type": "other",
          "category": "clinical",
          "title": "Planned follow-up",
          "description": "Review with CBC, RFT, LFT, RBS and SE for next chemotherapy.",
          "track": "follow_up",
          "source_document_id": "doc_miss3t620h3wmaq"
        }
      ]
    }
  ],
  "tracks": {
    "diagnosis": ["evt_miu7juicr0zh3m2"],
    "treatment": ["evt_miu7juict2bj5o4", "evt_miu7juicu3ck6p5", "evt_miu7juicv4dl7q6"],
    "imaging": ["evt_miu7juicp8xf1k0"],
    "procedure": ["evt_miu7juicq9yg2l1", "evt_miu7juics1ai4n3"],
    "lab": ["evt_miu7juicw5em8r7"],
    "follow_up": ["evt_miu7juicx6fn9s8"]
  },
  "date_range": {
    "earliest": "2025-09-12",
    "latest": "2025-11-14"
  },
  "total_events": 11
}
```

### Get Timeline by Tracks

```
GET /api/v1/patients/:patientId/timeline/tracks
```

Returns timeline events organized by tracks (for visualization).

---

## Medical History

### Get Medical History

```
GET /api/v1/patients/:patientId/history/medical
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "mh_xxx",
      "patient_id": "pat_xxx",
      "condition": "Hypertension",
      "icd_code": "I10",
      "diagnosis_date": "2020-01-15",
      "is_current": true,
      "severity": "mild",
      "treatment_received": "Lisinopril 10mg daily"
    }
  ]
}
```

### Add Medical History (Admin Only)

```
POST /api/v1/patients/:patientId/history/medical
```

**Request Body:**
```json
{
  "condition": "Hypertension",
  "icd_code": "I10",
  "diagnosis_date": "2020-01-15",
  "is_current": true,
  "severity": "mild",
  "treatment_received": "Lisinopril 10mg daily"
}
```

### Get Surgical History

```
GET /api/v1/patients/:patientId/history/surgical
```

### Add Surgical History (Admin Only)

```
POST /api/v1/patients/:patientId/history/surgical
```

**Request Body:**
```json
{
  "procedure_name": "Appendectomy",
  "procedure_code": "44970",
  "surgery_date": "2015-06-10",
  "surgeon": "Dr. Smith",
  "hospital": "General Hospital",
  "outcome": "Successful"
}
```

---

## Case Packs

### Get Case Pack

```
GET /api/v1/patients/:patientId/case-packs
```

**Response:**
```json
{
  "success": true,
  "data": {
    "case_pack": {
      "id": "cp_xxx",
      "patient_id": "pat_xxx",
      "title": "Initial Diagnosis Case Pack",
      "description": "Key documents for initial diagnosis"
    },
    "documents": [
      {
        "id": "doc_xxx",
        "filename": "biopsy_report.pdf",
        "document_type": "pathology",
        "medical_highlight": "Adenocarcinoma confirmed...",
        "added_to_case_pack": 1733328000
      }
    ],
    "total_documents": 5
  }
}
```

### Update Case Pack

```
PUT /api/v1/patients/:patientId/case-packs
```

**Request Body:**
```json
{
  "title": "Updated Case Pack Title",
  "description": "Updated description"
}
```

### Remove Document from Case Pack

```
DELETE /api/v1/patients/:patientId/case-packs/:docId
```

### Reorder Case Pack Documents

```
POST /api/v1/patients/:patientId/case-packs/reorder
```

**Request Body:**
```json
{
  "document_ids": ["doc_123", "doc_456", "doc_789"]
}
```

---

## Patient Intake

### Create Patient from Documents

```
POST /api/v1/intake
Content-Type: multipart/form-data
```

**Form Data:**
- `files` (required) - One or more clinical documents
- `caregiver_name` (required) - Name of caregiver
- `caregiver_relation` (optional) - Relationship to patient
- `caregiver_contact` (optional) - Contact information
- `provider` (optional) - AI provider

**Response:** `201 Created`
```json
{
  "success": true,
  "patient_id": "pat_xxx",
  "message": "Patient created from clinical documents",
  "data": {
    "patient": {
      "id": "pat_xxx",
      "name": "John Doe",
      "age": 45,
      "gender": "male",
      ...
    },
    "documents_uploaded": 3,
    "extracted_demographics": {
      "name": "John Doe",
      "age": 45,
      "gender": "male"
    }
  }
}
```

**Workflow:**
1. Creates placeholder patient
2. Uploads all documents
3. Processes first document to extract demographics
4. Updates patient with extracted data
5. Processes remaining documents in background

---

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `202 Accepted` - Request accepted for processing
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `501 Not Implemented` - Feature not configured

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `AUTH_ERROR` - Authentication failed
- `UNAUTHORIZED` - Insufficient permissions
- `CONFIG_ERROR` - Configuration error
- `PROCESSING_ERROR` - Document processing failed

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "condition is required"
  }
}
```

---

## Rate Limiting

Rate limiting may be applied to prevent abuse. Check response headers:
- `X-RateLimit-Limit` - Request limit per window
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time (Unix timestamp)

---

## Pagination

List endpoints support pagination via query parameters:
- `limit` - Number of results per page (default: 20, max: 100)
- `offset` - Number of results to skip (default: 0)

**Example:**
```
GET /api/v1/patients?limit=50&offset=100
```

---

## Data Formats

### Dates
- Format: `YYYY-MM-DD` (ISO 8601 date)
- Example: `2025-09-29`

### Timestamps
- Format: Unix timestamp (seconds since epoch)
- Example: `1733328000`

### JSON Fields
Some fields store JSON data:
- `data_sources` - Object mapping field names to document IDs
- `biomarkers` - Object with biomarker test results
- `drugs_administered` - Array of drug objects

---

## Version History

When admin users update critical fields (diagnosis, staging, treatment), the system automatically creates version history records. These track:
- Field name
- Old value
- New value
- Original source document
- Editor user ID
- Edit reason
- Timestamp

Version history can be queried separately (endpoint TBD).

---

## Notes

1. **Document Processing**: Documents are processed asynchronously. Check processing status via `/processing/status` endpoint.

2. **Classification**: Documents are automatically classified on upload. Use triage endpoints to review and approve for extraction.

3. **Data Provenance**: Diagnosis and staging endpoints include `data_sources` showing which documents contributed each field.

4. **Staging Snapshots**: Staging creates snapshots (never overwrites) to maintain a complete timeline.

5. **Admin Endpoints**: Some endpoints require admin role. Check individual endpoint documentation.

6. **File Search vs Vectorize**: Semantic search prefers File Search (Gemini) but falls back to Vectorize if needed.

---

## Support

For API support, contact: support@saarthihq.com

---

**Last Updated:** 2025-12-06

