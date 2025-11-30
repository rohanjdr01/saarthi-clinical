# Saarthi Clinical API Endpoints

Complete reference for all API endpoints in the Saarthi Clinical Platform.

**Base URL:** `http://localhost:8787/api/v1` (development)

---

## 🏥 Health Check

### Check API Status
```
GET /api/v1/health
```

**Response:**
```json
{
  "success": true,
  "message": "Saarthi Clinical Platform is running",
  "timestamp": "2025-11-30T10:00:00.000Z",
  "environment": "development",
  "services": {
    "database": true,
    "storage": true,
    "cache": true,
    "gemini": true
  }
}
```

---

## 👥 Patients

### Create Patient (Manual Entry)
```
POST /api/v1/patients
```

**Request Body:**
```json
{
  "name": "John Doe",
  "age": 65,
  "gender": "male",
  "caregiver": {
    "name": "Jane Doe",
    "relation": "daughter",
    "contact": "+91-9999999999"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pt_abc123",
    "name": "John Doe",
    "age": 65,
    "gender": "male",
    "caregiver_name": "Jane Doe",
    "caregiver_relation": "daughter",
    "caregiver_contact": "+91-9999999999",
    "status": "active",
    "created_at": 1638360000,
    "updated_at": 1638360000
  }
}
```

---

### List All Patients
```
GET /api/v1/patients
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pt_abc123",
      "name": "John Doe",
      "age": 65,
      "gender": "male",
      "caregiver": {
        "name": "Jane Doe",
        "relation": "daughter",
        "contact": "+91-9999999999"
      },
      "created_at": 1638360000
    }
  ],
  "total": 1
}
```

---

### Get Patient by ID
```
GET /api/v1/patients/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pt_abc123",
    "name": "John Doe",
    "age": 65,
    "gender": "male",
    "caregiver_name": "Jane Doe",
    "caregiver_relation": "daughter",
    "caregiver_contact": "+91-9999999999",
    "status": "active",
    "created_at": 1638360000,
    "updated_at": 1638360000
  }
}
```

---

### Update Patient
```
PATCH /api/v1/patients/:id
```

**Request Body:**
```json
{
  "name": "John Updated Doe",
  "age": 66,
  "caregiver": {
    "name": "Jane Updated",
    "contact": "+91-8888888888"
  }
}
```

---

### Delete Patient
```
DELETE /api/v1/patients/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Patient deleted successfully"
}
```

---

## 📄 Documents

### Upload Documents (Multi-File)
```
POST /api/v1/patients/:patientId/documents/
```

**Form Data:**
- `files` (File[], required) - Multiple files
- `document_type` (string, optional) - pathology, imaging, lab, consultation, gp_notes, other
- `document_date` (string, optional) - YYYY-MM-DD format
- `process_immediately` (boolean, optional) - true/false

**Example (cURL):**
```bash
curl -X POST http://localhost:8787/api/v1/patients/pt_abc123/documents/ \
  -F "files=@report1.pdf" \
  -F "files=@report2.pdf" \
  -F "document_type=pathology" \
  -F "process_immediately=true"
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "case_pack_id": "cp_xyz789",
  "documents_uploaded": 2,
  "processing_status": "processing",
  "message": "2 document(s) uploaded successfully. Processing started.",
  "data": {
    "case_pack_id": "cp_xyz789",
    "documents": [
      {
        "id": "doc_123",
        "patient_id": "pt_abc123",
        "filename": "report1.pdf",
        "file_type": "pdf",
        "document_type": "pathology",
        "file_size": 245678,
        "mime_type": "application/pdf",
        "processing_status": "pending",
        "created_at": 1638360000,
        "updated_at": 1638360000
      }
    ]
  }
}
```

---

### List Patient Documents
```
GET /api/v1/patients/:patientId/documents/
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_123",
      "patient_id": "pt_abc123",
      "filename": "pathology_report.pdf",
      "file_type": "pdf",
      "document_type": "pathology",
      "document_date": "2025-01-15",
      "file_size": 245678,
      "processing_status": "completed",
      "medical_highlight": "Biopsy confirms invasive ductal carcinoma, Grade 2, ER+/PR+/HER2-",
      "created_at": 1638360000,
      "updated_at": 1638360000
    }
  ],
  "total": 1
}
```

---

### Get Document Metadata
```
GET /api/v1/patients/:patientId/documents/:docId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "filename": "pathology_report.pdf",
    "document_type": "pathology",
    "processing_status": "completed",
    "medical_highlight": "Biopsy confirms invasive ductal carcinoma...",
    "created_at": 1638360000
  }
}
```

---

### Download Document File
```
GET /api/v1/patients/:patientId/documents/:docId/download
```

**Response:** Binary file stream with headers:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="pathology_report.pdf"
Content-Length: 245678
```

---

### Delete Document
```
DELETE /api/v1/patients/:patientId/documents/:docId
```

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

## 📦 Case-Packs

### Get Case-Pack with Documents
```
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
      }
    ],
    "total_documents": 1
  }
}
```

---

### Update Case-Pack Metadata
```
PUT /api/v1/patients/:patientId/case-pack/
```

**Request Body:**
```json
{
  "title": "Lung Cancer Diagnosis - January 2025",
  "description": "Complete diagnostic workup for lung cancer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cp_xyz789",
    "patient_id": "pt_abc123",
    "title": "Lung Cancer Diagnosis - January 2025",
    "description": "Complete diagnostic workup for lung cancer",
    "created_at": 1638360000,
    "updated_at": 1638360100
  }
}
```

---

### Remove Document from Case-Pack
```
DELETE /api/v1/patients/:patientId/case-pack/:docId
```

**Response:**
```json
{
  "success": true,
  "message": "Document removed from case-pack"
}
```

---

### Reorder Documents in Case-Pack
```
POST /api/v1/patients/:patientId/case-pack/reorder
```

**Request Body:**
```json
{
  "document_ids": ["doc_123", "doc_456", "doc_789"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Documents reordered successfully"
}
```

---

## ⚙️ Processing

### Process Document
```
POST /api/v1/patients/:patientId/processing/documents/:docId/process
```

**Request Body (optional):**
```json
{
  "mode": "incremental"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document processing started",
  "document_id": "doc_123"
}
```

---

### Get Processing Status
```
GET /api/v1/patients/:patientId/processing/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": 2,
    "processing": 1,
    "completed": 5,
    "failed": 0
  }
}
```

---

### Get Processing Log
```
GET /api/v1/patients/:patientId/processing/log
```

**Query Parameters:**
- `limit` (number, optional) - Number of log entries to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_123",
      "patient_id": "pt_abc123",
      "action": "document_processing_incremental",
      "documents_processed": ["doc_123"],
      "tokens_used": 1500,
      "processing_time_ms": 2340,
      "status": "success",
      "created_at": 1638360000
    }
  ],
  "total": 1
}
```

---

## 📊 Views & Summary

### Get Patient Summary
```
GET /api/v1/patients/:patientId/summary
```

**Response:**
```json
{
  "success": true,
  "patient": {
    "id": "pt_abc123",
    "name": "John Doe",
    "age": 65
  },
  "sections": {
    "diagnosis_staging": {
      "summary": "Stage IIA Adenocarcinoma",
      "last_updated": 1638360000
    },
    "imaging_findings": {
      "summary": "3.2cm mass in right upper lobe",
      "last_updated": 1638360000
    },
    "lab_results": {
      "summary": "Mild anemia, otherwise WNL",
      "last_updated": 1638360000
    }
  }
}
```

---

### Get Detailed Section
```
GET /api/v1/patients/:patientId/detailed/:section
```

**Sections:** diagnosis_staging, imaging_findings, lab_results, consultation_notes, general_findings

**Response:**
```json
{
  "success": true,
  "data": {
    "section_type": "diagnosis_staging",
    "summary_content": "Stage IIA Adenocarcinoma",
    "detailed_content": {
      "primary_diagnosis": {
        "cancer_type": "Lung Adenocarcinoma",
        "histology": "Adenocarcinoma",
        "grade": "Grade 2",
        "location": "Right upper lobe"
      },
      "staging": {
        "pathological_stage": "T2N1M0",
        "stage_group": "IIA"
      }
    },
    "last_processed_at": 1638360000
  }
}
```

---

## ⏱️ Timeline

### Get Patient Timeline
```
GET /api/v1/patients/:patientId/timeline
```

**Response:**
```json
{
  "success": true,
  "patient": {
    "id": "pt_abc123",
    "name": "John Doe"
  },
  "timeline": [
    {
      "date": "2025-01-15",
      "events": [
        {
          "id": "evt_123",
          "event_type": "diagnosis",
          "title": "Biopsy Confirmation",
          "description": "Invasive ductal carcinoma confirmed",
          "source_document_id": "doc_123"
        }
      ]
    }
  ]
}
```

---

### Get Timeline Tracks
```
GET /api/v1/patients/:patientId/timeline/tracks
```

**Response:**
```json
{
  "success": true,
  "tracks": {
    "diagnosis": ["evt_123", "evt_456"],
    "treatment": ["evt_789"],
    "imaging": ["evt_234"]
  }
}
```

---

## 🚪 Intake (Document-First Patient Creation)

### Create Patient from Documents
```
POST /api/v1/intake
```

**Form Data:**
- `files` (File[], required) - Clinical documents
- `document_type` (string, optional) - Type of documents
- `caregiver_name` (string, required) - Caregiver name
- `caregiver_relation` (string, required) - Relation to patient
- `caregiver_contact` (string, required) - Contact number

**Example:**
```bash
curl -X POST http://localhost:8787/api/v1/intake \
  -F "files=@pathology_report.pdf" \
  -F "files=@ct_scan.pdf" \
  -F "document_type=pathology" \
  -F "caregiver_name=Jane Doe" \
  -F "caregiver_relation=daughter" \
  -F "caregiver_contact=+91-9999999999"
```

**Response:**
```json
{
  "success": true,
  "message": "Patient created and documents processed",
  "data": {
    "patient": {
      "id": "pt_abc123",
      "name": "John Doe",
      "age": 65,
      "gender": "male",
      "caregiver_name": "Jane Doe",
      "caregiver_relation": "daughter",
      "caregiver_contact": "+91-9999999999"
    },
    "documents_uploaded": 2,
    "documents_processed": 1
  }
}
```

---

## 📝 Error Responses

All endpoints return consistent error responses:

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Patient not found",
  "statusCode": 404
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Patient ID is required",
  "statusCode": 400
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "statusCode": 500
}
```

---

## 🔑 Authentication

Currently, the API does not require authentication (development mode).

**CORS Allowed Origins:**
- http://localhost:3000
- http://localhost:5000
- http://localhost:8000

---

## 📊 Rate Limits

No rate limits are currently enforced in development mode.

---

## 🗂️ Endpoint Summary

| Category | Endpoints | Total |
|----------|-----------|-------|
| Health | 1 | 1 |
| Patients | 5 | 5 |
| Documents | 5 | 5 |
| Case-Packs | 4 | 4 |
| Processing | 3 | 3 |
| Views | 2 | 2 |
| Timeline | 2 | 2 |
| Intake | 1 | 1 |
| **Total** | | **23** |

---

## 🚀 Quick Start Examples

### Upload and Process Multiple Documents
```bash
curl -X POST http://localhost:8787/api/v1/patients/pt_abc123/documents/ \
  -F "files=@biopsy.pdf" \
  -F "files=@ct_scan.pdf" \
  -F "files=@blood_work.pdf" \
  -F "document_type=pathology" \
  -F "process_immediately=true"
```

### Get Complete Patient View
```bash
# Get summary
curl http://localhost:8787/api/v1/patients/pt_abc123/summary

# Get timeline
curl http://localhost:8787/api/v1/patients/pt_abc123/timeline

# Get case-pack with all documents
curl http://localhost:8787/api/v1/patients/pt_abc123/case-pack
```

### Create Patient from Documents
```bash
curl -X POST http://localhost:8787/api/v1/intake \
  -F "files=@report1.pdf" \
  -F "files=@report2.pdf" \
  -F "caregiver_name=Jane Doe" \
  -F "caregiver_relation=daughter" \
  -F "caregiver_contact=+91-9999999999"
```

---

**Last Updated:** 2025-11-30
**API Version:** v1
**Base URL:** http://localhost:8787/api/v1
