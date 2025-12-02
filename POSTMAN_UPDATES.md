# Postman Collection Updates for Phase 2 Refactoring

## New Endpoints to Add

### 1. Patients - New Endpoints

#### Get Patient Demographics
```
GET {{baseUrl}}/patients/{{patientId}}/demographics
```
**Description:** Get patient demographics only (subset of full patient record)

**Response includes:** name, age, age_unit, sex, dob, blood_type, height_cm, weight_kg, bsa, language_preference, allergy_status, caregiver info

---

### 2. Patients - Updated Create/Update

#### Create Patient (Extended Fields)
```
POST {{baseUrl}}/patients
Content-Type: application/json

{
  "name": "John Doe",
  "age": 65,
  "age_unit": "years",
  "sex": "male",
  "dob": "1958-01-01",
  "blood_type": "O+",
  "height_cm": 175,
  "weight_kg": 70,
  "bsa": 1.85,
  "ecog_status": 1,
  "current_status": "in_treatment",
  "primary_oncologist": "Dr. Smith",
  "primary_center": "Main Hospital",
  "language_preference": "English",
  "allergy_status": "none",
  "patient_id_uhid": "UHID12345",
  "patient_id_ipd": "IPD67890",
  "caregiver": {
    "name": "Jane Doe",
    "relation": "spouse",
    "contact": "+1234567890"
  }
}
```

#### List Patients (With Filters)
```
GET {{baseUrl}}/patients?status=active&oncologist=Dr.%20Smith&current_status=in_treatment&limit=20&offset=0
```

---

### 3. Documents - New/Updated Endpoints

#### Upload Documents (Category Optional - AI Inferred)
```
POST {{baseUrl}}/patients/{{patientId}}/documents
Content-Type: multipart/form-data

Form Data:
- files: [file]
- category (optional): "pathology" | "radiology" | "lab" | "clinical_notes" | etc.
- subcategory (optional): "biopsy" | "ct_scan" | "mri" | etc.
- document_date (optional): "2024-01-15"
- process_immediately: "true" | "false"
```
**Note:** Category/subcategory are optional - AI will infer during processing

#### List Documents (With Filters)
```
GET {{baseUrl}}/patients/{{patientId}}/documents?category=pathology&start_date=2024-01-01&end_date=2024-12-31&reviewed_status=pending&sort=created_at&order=desc
```

#### Update Document Metadata
```
PATCH {{baseUrl}}/patients/{{patientId}}/documents/{{documentId}}
Content-Type: application/json

{
  "title": "Pathology Report - Biopsy",
  "category": "pathology",
  "subcategory": "biopsy",
  "reviewed_status": "reviewed",
  "reviewed_by": "user_123",
  "case_pack_order": 1,
  "document_date": "2024-01-15"
}
```

#### Reorder Case-Pack Documents
```
POST {{baseUrl}}/patients/{{patientId}}/documents/reorder
Content-Type: application/json

{
  "document_orders": [
    { "document_id": "doc_123", "order": 1 },
    { "document_id": "doc_456", "order": 2 },
    { "document_id": "doc_789", "order": 3 }
  ]
}
```

#### Semantic Search (RAG) - Phase 3 Placeholder
```
POST {{baseUrl}}/patients/{{patientId}}/documents/search
Content-Type: application/json

{
  "query": "What are the tumor markers?",
  "top_k": 5
}
```
**Response:** 501 Not Implemented (Phase 3)

#### Reprocess Document
```
POST {{baseUrl}}/patients/{{patientId}}/documents/{{documentId}}/reprocess
```
**Description:** Reprocess document with AI to re-infer category and extract data

---

### 4. Diagnosis & Staging (NEW Folder)

#### Create/Update Diagnosis
```
PUT {{baseUrl}}/patients/{{patientId}}/diagnosis
Content-Type: application/json

{
  "primary_cancer_type": "Breast Cancer",
  "primary_cancer_subtype": "Invasive Ductal Carcinoma",
  "icd_code": "C50.9",
  "diagnosis_date": "2024-01-15",
  "tumor_location": "Upper outer quadrant, left breast",
  "tumor_laterality": "left",
  "tumor_size_cm": 2.5,
  "tumor_grade": "G2",
  "histology": "Ductal carcinoma",
  "biomarkers": {
    "ER": "positive",
    "PR": "positive",
    "HER2": "negative"
  },
  "genetic_mutations": ["BRCA1"],
  "metastatic_sites": ["lymph_nodes"]
}
```
**Note:** Admin only (requires role check). Creates version history.

#### Get Diagnosis
```
GET {{baseUrl}}/patients/{{patientId}}/diagnosis
```
**Response includes:** diagnosis details + data_sources (field-level source tracking)

#### Create/Update Staging
```
PUT {{baseUrl}}/patients/{{patientId}}/staging
Content-Type: application/json

{
  "clinical_t": "cT2",
  "clinical_n": "cN1",
  "clinical_m": "cM0",
  "pathological_t": "pT2",
  "pathological_n": "pN1",
  "pathological_m": "pM0",
  "clinical_stage": "IIB",
  "pathological_stage": "IIB",
  "staging_system": "AJCC 8th",
  "staging_date": "2024-01-20",
  "restaging_reason": "Post-neoadjuvant therapy"
}
```
**Note:** Admin only. Creates version history.

#### Get Staging
```
GET {{baseUrl}}/patients/{{patientId}}/staging
```

---

### 5. Treatment (NEW Folder)

#### Create/Update Treatment
```
PUT {{baseUrl}}/patients/{{patientId}}/treatment
Content-Type: application/json

{
  "regimen_name": "AC-T",
  "treatment_intent": "adjuvant",
  "treatment_line": "first-line",
  "protocol": "AC-T Protocol",
  "drugs": ["Doxorubicin", "Cyclophosphamide", "Paclitaxel"],
  "start_date": "2024-02-01",
  "planned_end_date": "2024-08-01",
  "total_planned_cycles": 8,
  "treatment_status": "active",
  "best_response": "PR",
  "response_date": "2024-04-01"
}
```
**Note:** Admin only. Creates version history.

#### Get Current Treatment
```
GET {{baseUrl}}/patients/{{patientId}}/treatment
```

#### Get All Treatment Cycles
```
GET {{baseUrl}}/patients/{{patientId}}/treatment/cycles
```

#### Get Specific Cycle
```
GET {{baseUrl}}/patients/{{patientId}}/treatment/cycles/1
```

#### Add Treatment Cycle
```
POST {{baseUrl}}/patients/{{patientId}}/treatment/cycles
Content-Type: application/json

{
  "cycle_number": 1,
  "planned_date": "2024-02-01",
  "actual_date": "2024-02-01",
  "drugs_administered": [
    {
      "drug": "Doxorubicin",
      "dose": 60,
      "unit": "mg/m2",
      "route": "IV"
    },
    {
      "drug": "Cyclophosphamide",
      "dose": 600,
      "unit": "mg/m2",
      "route": "IV"
    }
  ],
  "pre_treatment_vitals": {
    "bp": "120/80",
    "hr": 72,
    "temp": 98.6
  },
  "cycle_status": "completed",
  "dose_percentage": 100
}
```

#### Update Treatment Cycle
```
PUT {{baseUrl}}/patients/{{patientId}}/treatment/cycles/1
Content-Type: application/json

{
  "actual_date": "2024-02-02",
  "adverse_events": [
    {
      "event": "Nausea",
      "grade": 2
    },
    {
      "event": "Neutropenia",
      "grade": 3
    }
  ],
  "ctcae_grade": 3,
  "dose_reduced": true,
  "dose_reduction_reason": "Grade 3 neutropenia",
  "dose_percentage": 75,
  "notes": "Dose reduced due to toxicity"
}
```

---

## Deprecated Endpoints

### Case-Packs (To be removed)
- ❌ `GET /patients/:id/case-pack` - **Use documents list with case_pack_order instead**
- ❌ `PUT /patients/:id/case-pack` - **Update document metadata instead**
- ❌ `DELETE /patients/:id/case-pack/:docId` - **Use DELETE /documents/:docId**
- ❌ `POST /patients/:id/case-pack/reorder` - **Use POST /documents/reorder**

**Migration:** Case-pack functionality is now merged into documents table using `case_pack_order` field.

---

## Updated Response Fields

### Patient Response
Now includes:
- `patient_id_uhid`, `patient_id_ipd`
- `age_unit`, `sex`, `dob`, `blood_type`
- `height_cm`, `weight_kg`, `bsa`
- `ecog_status`, `current_status`, `current_status_detail`
- `primary_oncologist`, `primary_center`
- `language_preference`, `allergy_status`

### Document Response
Now includes:
- `category`, `subcategory`, `title`
- `case_pack_order` (replaces case-pack relationship)
- `vectorize_status`, `vectorized_at`
- `reviewed_status`, `reviewed_by`, `reviewed_date`
- `critical_findings`, `summary`

---

## Import Instructions

1. **Option 1:** Manually add these endpoints to your existing Postman collection
2. **Option 2:** Use the updated `postman_collection.json` file (when generated)
3. **Option 3:** Import this as a separate collection for Phase 2 testing

---

## Testing Checklist

- [ ] Patient CRUD with new fields
- [ ] Patient demographics endpoint
- [ ] Document upload without category (AI inference)
- [ ] Document filtering and sorting
- [ ] Document metadata updates (PATCH)
- [ ] Case-pack reordering
- [ ] Diagnosis CRUD
- [ ] Staging CRUD
- [ ] Treatment CRUD
- [ ] Treatment cycles CRUD
- [ ] Version history creation (admin edits)
- [ ] Data source tracking validation
