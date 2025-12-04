# Saarthi Clinical API Endpoints

Complete reference for all API endpoints in the Saarthi Clinical Platform.

## Base URLs

- **Production:** `https://process.saarthihq.com/api/v1`
- **Staging:** `https://staging.saarthihq.com/api/v1`
- **Local Development:** `http://localhost:8787/api/v1`

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

---

## 🔐 Authentication

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
  "data": {
    "user": {
      "id": "usr_abc123",
      "firebase_uid": "firebase_uid_here",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

### Get Current User
```
GET /api/v1/auth/me
Authorization: Bearer <firebase-token>
```

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

## 👥 Patients

### Create Patient
```
POST /api/v1/patients
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "John Doe",
  "age": 65,
  "age_unit": "years",
  "sex": "male",
  "dob": "1957-10-08",
  "patient_id_uhid": "UHID-12345",
  "patient_id_ipd": "IPD-12345",
  "primary_oncologist": "Dr. Smith",
  "primary_center": "City Hospital",
  "current_status": "on_treatment",
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
    "sex": "male",
    "created_at": 1638360000
  }
}
```

### List All Patients
```
GET /api/v1/patients?status=active&limit=20&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (string, optional) - Filter by current_status
- `oncologist` (string, optional) - Filter by primary_oncologist
- `limit` (number, optional) - Default 20
- `offset` (number, optional) - For pagination

### Get Patient by ID
```
GET /api/v1/patients/:id
Authorization: Bearer <token>
```

### Update Patient
```
PATCH /api/v1/patients/:id
Authorization: Bearer <token>
```

### Delete Patient
```
DELETE /api/v1/patients/:id
Authorization: Bearer <token>
```

---

## 📄 Documents

### Upload Documents (Multi-File)
```
POST /api/v1/patients/:patientId/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `files` (File[], required) - Multiple files
- `category` (string, optional) - pathology, radiology, discharge_summary, consultation, lab_report, operative_note, other
- `subcategory` (string, optional) - biopsy, ct, mri, pet, etc.
- `document_date` (string, optional) - YYYY-MM-DD format
- `process_immediately` (boolean, optional) - Default true
- `provider` (string, optional) - gemini or openai

**Response (202 Accepted):**
```json
{
  "success": true,
  "documents_uploaded": 2,
  "processing_status": "processing",
  "data": [{
    "id": "doc_123",
    "filename": "report1.pdf",
    "processing_status": "pending",
    "vectorize_status": "pending"
  }]
}
```

### List Patient Documents
```
GET /api/v1/patients/:patientId/documents?category=pathology&sort=date_desc
Authorization: Bearer <token>
```

**Query Parameters:**
- `category` (string, optional) - Filter by category
- `from` (date, optional) - Documents from date
- `to` (date, optional) - Documents to date
- `reviewed` (boolean, optional) - Filter by reviewed status
- `sort` (string, optional) - date_desc, date_asc, case_pack_order

### Get Document Metadata
```
GET /api/v1/patients/:patientId/documents/:docId
Authorization: Bearer <token>
```

### Update Document Metadata
```
PATCH /api/v1/patients/:patientId/documents/:docId
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Primary Biopsy",
  "category": "pathology",
  "reviewed_status": "reviewed",
  "case_pack_order": 1
}
```

### Download Document
```
GET /api/v1/patients/:patientId/documents/:docId/download
Authorization: Bearer <token>
```

**Response:** Binary file stream

### Delete Document
```
DELETE /api/v1/patients/:patientId/documents/:docId
Authorization: Bearer <token>
```

### Search Documents (RAG)
```
POST /api/v1/patients/:patientId/documents/search
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "query": "What was the HER2 status?",
  "top_k": 5,
  "category_filter": ["pathology"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [{
      "document_id": "doc_123",
      "chunk_text": "HER2 status: Negative (Score 1+)...",
      "relevance_score": 0.92
    }]
  }
}
```

### Reprocess Document
```
POST /api/v1/patients/:patientId/documents/:docId/reprocess?provider=openai
Authorization: Bearer <token>
```

### Vectorize Document
```
POST /api/v1/patients/:patientId/documents/:docId/vectorize
Authorization: Bearer <token>
```

### Reorder Documents
```
POST /api/v1/patients/:patientId/documents/reorder
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "document_ids": ["doc_123", "doc_456", "doc_789"]
}
```

---

## 🔬 Diagnosis & Staging

### Get Diagnosis
```
GET /api/v1/patients/:id/diagnosis
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cancer_type": "Gastric adenocarcinoma",
    "cancer_site_primary": "Stomach",
    "histology": "Adenocarcinoma",
    "diagnosis_date": "2025-09-22",
    "her2_status": "negative",
    "her2_score": "1+"
  }
}
```

### Update Diagnosis (Admin Only)
```
PUT /api/v1/patients/:id/diagnosis
Authorization: Bearer <token>
```

Creates version history entry for all changes.

### Get Staging
```
GET /api/v1/patients/:id/staging
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "staging_system": "AJCC 8th Edition",
    "staging_type": "clinical",
    "tnm_clinical": {
      "t": "cT3",
      "n": "cN2",
      "m": "cM0",
      "stage": "IIIA"
    }
  }
}
```

### Update Staging (Admin Only)
```
PUT /api/v1/patients/:id/staging
Authorization: Bearer <token>
```

---

## 💊 Treatment

### Get Treatment Overview
```
GET /api/v1/patients/:id/treatment
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "treatment_intent": "neoadjuvant",
    "regimen_name": "mFOLFOX-6",
    "regimen_components": ["5-Fluorouracil", "Leucovorin", "Oxaliplatin"],
    "cycles_completed": 4,
    "cycles_planned": 6
  }
}
```

### Update Treatment (Admin Only)
```
PUT /api/v1/patients/:id/treatment
Authorization: Bearer <token>
```

### Get Treatment Cycles
```
GET /api/v1/patients/:id/treatment/cycles
Authorization: Bearer <token>
```

### Get Single Cycle
```
GET /api/v1/patients/:id/treatment/cycles/:cycleNumber
Authorization: Bearer <token>
```

### Add Treatment Cycle
```
POST /api/v1/patients/:id/treatment/cycles
Authorization: Bearer <token>
```

### Update Treatment Cycle
```
PUT /api/v1/patients/:id/treatment/cycles/:cycleNumber
Authorization: Bearer <token>
```

---

## 💉 Medications

### Get Medications
```
GET /api/v1/patients/:id/medications
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "medications": [{
      "id": "med_001",
      "generic_name": "Phenytoin",
      "brand_name": "Eptoin",
      "dose_value": 100,
      "dose_unit": "mg",
      "frequency": "1 morning + 1 night",
      "route": "oral",
      "status": "active"
    }]
  }
}
```

### Add Medication
```
POST /api/v1/patients/:id/medications
Authorization: Bearer <token>
```

### Update Medication
```
PUT /api/v1/patients/:id/medications/:medId
Authorization: Bearer <token>
```

### Delete Medication
```
DELETE /api/v1/patients/:id/medications/:medId
Authorization: Bearer <token>
```

### Get Drug Interactions
```
GET /api/v1/patients/:id/medications/interactions
Authorization: Bearer <token>
```

---

## ⚠️ Alerts

### Get All Alerts
```
GET /api/v1/patients/:id/alerts?severity=high&status=active
Authorization: Bearer <token>
```

**Query Parameters:**
- `severity` (string, optional) - high, medium, low
- `category` (string, optional) - neurological, infection, nutrition, treatment, lab, allergy
- `status` (string, optional) - active, resolved

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [{
      "alert_id": "alert_001",
      "category": "neurological",
      "title": "Seizure Disorder",
      "severity": "high",
      "status": "active_controlled"
    }],
    "counts": {
      "total": 5,
      "high": 1,
      "medium": 2
    }
  }
}
```

### Create Alert
```
POST /api/v1/patients/:id/alerts
Authorization: Bearer <token>
```

### Update Alert
```
PUT /api/v1/patients/:id/alerts/:alertId
Authorization: Bearer <token>
```

### Delete Alert
```
DELETE /api/v1/patients/:id/alerts/:alertId
Authorization: Bearer <token>
```

---

## 🧪 Labs

### Get Latest Labs
```
GET /api/v1/patients/:id/labs/latest
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2025-11-21",
    "hemoglobin": {"value": 10.2, "unit": "g/dL", "flag": "low"},
    "wbc": {"value": 5.8, "unit": "x10^9/L", "flag": "normal"},
    "platelets": {"value": 180, "unit": "x10^9/L", "flag": "normal"}
  }
}
```

### Get Lab Trends
```
GET /api/v1/patients/:id/labs/trends?marker=hemoglobin&from=2025-01-01&to=2025-12-31
Authorization: Bearer <token>
```

**Query Parameters:**
- `marker` (string, required) - hemoglobin, anc, platelets, creatinine, etc.
- `from` (date, optional) - Start date
- `to` (date, optional) - End date

### Get Tumor Markers
```
GET /api/v1/patients/:id/tumor-markers
Authorization: Bearer <token>
```

### Get Tumor Marker Trends
```
GET /api/v1/patients/:id/tumor-markers/trends?marker=cea
Authorization: Bearer <token>
```

### Add Lab Result
```
POST /api/v1/patients/:id/labs
Authorization: Bearer <token>
```

---

## 📅 Timeline

### Get Patient Timeline
```
GET /api/v1/patients/:id/timeline?from=2025-01-01&to=2025-12-31&category=diagnosis
Authorization: Bearer <token>
```

**Query Parameters:**
- `from` (date, optional) - Start date
- `to` (date, optional) - End date
- `category` (string, optional) - diagnosis, imaging, treatment, complication, hospitalization

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [{
      "id": "evt_001",
      "date": "2025-09-12",
      "category": "imaging",
      "title": "CT Abdomen",
      "description": "Wall thickening (2.1cm)",
      "document_id": "doc_ct_sept"
    }]
  }
}
```

### Add Timeline Event
```
POST /api/v1/patients/:id/timeline
Authorization: Bearer <token>
```

---

## 📋 History

### Get Medical History
```
GET /api/v1/patients/:id/history/medical
Authorization: Bearer <token>
```

### Update Medical History
```
PUT /api/v1/patients/:id/history/medical
Authorization: Bearer <token>
```

### Get Surgical History
```
GET /api/v1/patients/:id/history/surgical
Authorization: Bearer <token>
```

### Update Surgical History
```
PUT /api/v1/patients/:id/history/surgical
Authorization: Bearer <token>
```

### Get Family History
```
GET /api/v1/patients/:id/history/family
Authorization: Bearer <token>
```

### Update Family History
```
PUT /api/v1/patients/:id/history/family
Authorization: Bearer <token>
```

### Get Social History
```
GET /api/v1/patients/:id/history/social
Authorization: Bearer <token>
```

### Update Social History
```
PUT /api/v1/patients/:id/history/social
Authorization: Bearer <token>
```

---

## 🧠 Decisions & Clinical Questions

### Get Clinical Decisions
```
GET /api/v1/patients/:id/decisions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "primary_clinical_question": "Post-neoadjuvant chemotherapy management",
    "surgical_considerations": ["Minimally invasive approach feasibility"],
    "decision_timeline": {
      "date": "2025-12-05",
      "event": "CT response assessment",
      "decision": "Surgery vs 5th cycle"
    }
  }
}
```

### Update Decisions
```
PUT /api/v1/patients/:id/decisions
Authorization: Bearer <token>
```

### Get MDT Discussions
```
GET /api/v1/patients/:id/decisions/mdt
Authorization: Bearer <token>
```

### Add MDT Discussion
```
POST /api/v1/patients/:id/decisions/mdt
Authorization: Bearer <token>
```

---

## ⚙️ Processing

### Get Processing Status
```
GET /api/v1/patients/:id/processing/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": {
      "pending": 2,
      "processing": 1,
      "completed": 23,
      "failed": 0
    },
    "vectorization": {
      "pending": 2,
      "completed": 23,
      "failed": 0
    }
  }
}
```

### Get Processing Log
```
GET /api/v1/patients/:id/processing/log?limit=20&type=extraction
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (number, optional) - Default 20
- `type` (string, optional) - extraction, vectorization, all

### Get Document Processing Status
```
GET /api/v1/patients/:patientId/processing/documents/:docId/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "document_id": "doc_abc123",
  "filename": "2025-11-21_Chemo_IV_-_Discharge_Summary.pdf",
  "processing_status": "completed",
  "processing_started_at": "2025-12-04T13:00:00Z",
  "processing_completed_at": "2025-12-04T13:02:30Z",
  "processing_error": null,
  "vectorize_status": "completed",
  "vectorized_at": "2025-12-04T13:02:25Z",
  "file_search_status": "completed",
  "file_search_store_name": "fileSearchStores/patient-pt_abc123",
  "file_search_document_name": "fileSearchDocuments/doc_mirh9g5kny6nnhm",
  "tokens_used": 15234,
  "model": "gpt-5",
  "created_at": "2025-12-04T12:55:41Z",
  "updated_at": "2025-12-04T13:02:30Z"
}
```

Use the aggregate `/processing/status` for dashboard counts and this endpoint for per-document progress/errors.

---

## 📊 Views & Summary

### Get Patient Summary
```
GET /api/v1/patients/:patientId/summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "patient_id": "pt_abc123",
  "patient_name": "John Doe",
  "sections": {
    "diagnosis_staging": {
      "summary": "Stage IIA Adenocarcinoma",
      "last_updated": 1638360000
    }
  },
  "document_count": 5,
  "timeline_event_count": 12
}
```

### Get Detailed Section
```
GET /api/v1/patients/:patientId/detailed/:section
Authorization: Bearer <token>
```

**Sections:** diagnosis_staging, imaging_findings, lab_results, consultation_notes, general_findings

---

## 🚪 Intake (Document-First Patient Creation)

### Create Patient from Documents
```
POST /api/v1/intake
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `files` (File[], required) - Clinical documents
- `caregiver_name` (string, required)
- `caregiver_relation` (string, required)
- `caregiver_contact` (string, required)
- `primary_oncologist` (string, optional)
- `primary_center` (string, optional)

**Response:**
```json
{
  "success": true,
  "message": "Patient created and documents processed",
  "data": {
    "patient": {
      "id": "pt_abc123",
      "name": "John Doe",
      "extracted_from_documents": true
    },
    "documents_uploaded": 2,
    "processing_status": "processing"
  }
}
```

---

## ❌ Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Not Found",
  "message": "Patient not found",
  "statusCode": 404
}
```

---

## 🔑 Authentication

All protected endpoints require a Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

**CORS Allowed Origins:**
- http://localhost:3000
- http://localhost:5000
- http://localhost:8000
- https://process.saarthihq.com
- https://staging.saarthihq.com

---

## 📊 Endpoint Summary

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Health | 2 | Health check and diagnostics |
| Auth | 4 | Authentication and user management |
| Patients | 5 | Patient CRUD operations |
| Documents | 9 | Document upload, search, vectorization |
| Diagnosis & Staging | 4 | Clinical diagnosis and TNM staging |
| Treatment | 6 | Treatment regimens and cycles |
| Medications | 5 | Medication management |
| Alerts | 4 | Clinical alerts and risk factors |
| Labs | 5 | Lab results and tumor markers |
| Timeline | 2 | Medical timeline events |
| History | 8 | Medical, surgical, family, social history |
| Decisions | 4 | Clinical decisions and MDT |
| Processing | 2 | Document processing status |
| Views | 2 | Patient summary and detailed views |
| Intake | 1 | Document-first patient creation |
| **Total** | **63** | |

---

**Last Updated:** 2025-12-03  
**API Version:** v1
