# Saarthi Clinical API Endpoints (Refactored)

Complete reference for all API endpoints - restructured around patient dashboard params.

**Base URL:** `http://localhost:8787/api/v1` (development)

---

## Design Decisions

### Case-Pack → Documents Merger
- **Removed:** Separate `/case-pack/` endpoints
- **Change:** Documents now have `case_pack_order` field for ordering
- **New:** Documents endpoint returns all case-pack functionality
- **Future:** Auto-RAG vectorization on document upload for Cloudflare Vectorize

### Endpoint Structure
Aligned with dashboard param categories:
1. Patient Header (demographics + clinical identifiers)
2. Diagnosis & Staging
3. Treatment (regimens, cycles)
4. Medications
5. Alerts (risk factors, clinical alerts)
6. Labs (structured + documents)
7. Timeline
8. Documents (merged case-pack)
9. History (medical, surgical, family, social)
10. Decisions (clinical questions, MDT)

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
  "services": {
    "database": true,
    "storage": true,
    "vectorize": true,
    "gemini": true
  }
}
```

---

## 👥 Patients

### Create Patient
```
POST /api/v1/patients
```

**Request Body:**
```json
{
  "name": "Mohammed Kutty P K",
  "age": 68,
  "age_unit": "years",
  "sex": "male",
  "dob": "1957-10-08",
  "patient_id_uhid": "UHID-1010111284",
  "patient_id_ipd": "IPD.25-26-29851",
  "primary_oncologist": "Dr. Prasanth Parameswaran",
  "primary_center": "MVR Cancer Centre & Research Institute",
  "current_status": "on_treatment",
  "current_status_detail": "Neoadjuvant Chemo",
  "caregiver": {
    "name": "Faris Mohammed",
    "relation": "son",
    "contact": "+91-9876543210"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pt_abc123",
    "name": "Mohammed Kutty P K",
    "age": 68,
    "age_unit": "years",
    "sex": "male",
    "dob": "1957-10-08",
    "patient_id_uhid": "UHID-1010111284",
    "patient_id_ipd": "IPD.25-26-29851",
    "primary_oncologist": "Dr. Prasanth Parameswaran",
    "primary_center": "MVR Cancer Centre & Research Institute",
    "current_status": "on_treatment",
    "current_status_detail": "Neoadjuvant Chemo",
    "caregiver_name": "Faris Mohammed",
    "caregiver_relation": "son",
    "caregiver_contact": "+91-9876543210",
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

**Query Parameters:**
- `status` (string, optional) - Filter by current_status
- `oncologist` (string, optional) - Filter by primary_oncologist
- `limit` (number, optional) - Default 20
- `offset` (number, optional) - For pagination

---

### Get Patient by ID
```
GET /api/v1/patients/:id
```

**Response:** Full patient header data

---

### Get Patient Demographics
```
GET /api/v1/patients/:id/demographics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Mohammed Kutty P K",
    "age": 68,
    "age_unit": "years",
    "sex": "male",
    "dob": "1957-10-08",
    "patient_id_uhid": "UHID-1010111284",
    "patient_id_ipd": "IPD.25-26-29851",
    "blood_type": "O_positive",
    "height_cm": 165,
    "weight_kg": 54,
    "weight_date": "2025-11-21",
    "bsa": 1.58,
    "bsa_formula": "mosteller",
    "ecog_status": 2,
    "ecog_date": "2025-11-21",
    "language_preference": "Malayalam",
    "primary_caregiver": "Faris Mohammed (Son)",
    "emergency_contact": {
      "name": "Faris Mohammed",
      "relationship": "Son",
      "phone": "+91-9876543210"
    },
    "allergy_status": "nkda",
    "allergies": []
  }
}
```

---

### Update Patient
```
PATCH /api/v1/patients/:id
```

---

### Delete Patient
```
DELETE /api/v1/patients/:id
```

---

## 🔬 Diagnosis & Staging

### Get Diagnosis
```
GET /api/v1/patients/:id/diagnosis
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cancer_type": "Gastric adenocarcinoma",
    "cancer_site_primary": "Stomach",
    "cancer_site_subsite": "Body/Antrum",
    "histology": "Adenocarcinoma with focal signet ring cell features",
    "histology_code": "8144/3",
    "differentiation_grade": "poorly_differentiated",
    "metastasis_status": "localized",
    "metastasis_sites": [],
    "diagnosis_date": "2025-09-22",
    "her2_status": "negative",
    "her2_score": "1+",
    "msi_status": "mss",
    "mmr_status": "proficient",
    "pdl1_status": "not_tested",
    "lauren_classification": "intestinal"
  }
}
```

---

### Update Diagnosis
```
PUT /api/v1/patients/:id/diagnosis
```

---

### Get Staging
```
GET /api/v1/patients/:id/staging
```

**Response:**
```json
{
  "success": true,
  "data": {
    "staging_system": "AJCC 8th Edition",
    "staging_type": "clinical",
    "staging_date": "2025-09-23",
    "tnm_clinical": {
      "t": "cT3",
      "n": "cN2",
      "m": "cM0",
      "stage": "IIIA"
    },
    "tnm_pathological": null,
    "tumor_size_cm": 2.1,
    "tumor_size_source": "ct",
    "lymph_nodes_involved_count": 3,
    "lymph_node_stations": ["perigastric"],
    "stage_narrative": "Locally advanced Stage III"
  }
}
```

---

### Update Staging
```
PUT /api/v1/patients/:id/staging
```

---

## 💊 Treatment

### Get Treatment Overview
```
GET /api/v1/patients/:id/treatment
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
    "cycles_planned": 6,
    "cycle_interval_days": 14,
    "current_cycle_status": "completed",
    "last_cycle_date": "2025-11-21",
    "next_cycle_date": null,
    "days_since_last_cycle": 10,
    "dose_modifications_present": true,
    "dose_modification_summary": "Cycle 4 dose-reduced post-Salmonella infection",
    "dose_intensity_overall_percent": 92,
    "cumulative_oxaliplatin_mg": 536,
    "cumulative_oxaliplatin_mg_m2": 340,
    "neuropathy_grade": 1,
    "neuropathy_description": "Mild paresthesias in fingertips",
    "hospitalization_per_cycle": "2-3 days",
    "best_response": null,
    "response_assessment_method": "recist_1_1"
  }
}
```

---

### Update Treatment
```
PUT /api/v1/patients/:id/treatment
```

---

### Get Treatment Cycles
```
GET /api/v1/patients/:id/treatment/cycles
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cycles": [
      {
        "cycle_number": 1,
        "start_date": "2025-10-03",
        "end_date": "2025-10-05",
        "status": "completed",
        "hospitalization_days": 3,
        "doses": {
          "oxaliplatin_mg_m2": 85,
          "oxaliplatin_mg_actual": 134,
          "5fu_bolus_mg_m2": 400,
          "5fu_infusion_mg_m2": 2400,
          "leucovorin_mg_m2": 400
        },
        "dose_intensity_percent": 100,
        "delays_days": 0,
        "delay_reason": null,
        "modifications": [],
        "toxicities": [],
        "nadir_date": "2025-10-10",
        "nadir_anc": 1.2,
        "pre_chemo_weight_kg": 57.8,
        "document_id": "doc_cycle1_discharge"
      }
    ],
    "total_cycles": 4
  }
}
```

---

### Get Single Cycle
```
GET /api/v1/patients/:id/treatment/cycles/:cycleNumber
```

---

### Add/Update Cycle
```
POST /api/v1/patients/:id/treatment/cycles
PUT /api/v1/patients/:id/treatment/cycles/:cycleNumber
```

---

## 💉 Medications

### Get Medications
```
GET /api/v1/patients/:id/medications
```

**Response:**
```json
{
  "success": true,
  "data": {
    "medications": [
      {
        "id": "med_001",
        "generic_name": "Phenytoin",
        "brand_name": "Eptoin",
        "dose_value": 100,
        "dose_unit": "mg",
        "frequency": "1 morning + 1 night + 1 additional",
        "route": "oral",
        "indication": "Seizure disorder",
        "start_date": "2025-10-22",
        "end_date": null,
        "status": "active",
        "prescriber": "Dr. Neurologist",
        "category": "anti_epileptic"
      }
    ],
    "medications_documented": true,
    "supportive_medications_complete": false,
    "medication_last_modified_date": "2025-11-21"
  }
}
```

---

### Add Medication
```
POST /api/v1/patients/:id/medications
```

---

### Update Medication
```
PUT /api/v1/patients/:id/medications/:medId
```

---

### Delete Medication
```
DELETE /api/v1/patients/:id/medications/:medId
```

---

### Get Drug Interactions
```
GET /api/v1/patients/:id/medications/interactions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "interactions": [
      {
        "drug1": "Phenytoin",
        "drug2": "5-Fluorouracil",
        "severity": "major",
        "effect": "Phenytoin induces 5-FU metabolism, reducing efficacy",
        "recommendation": "Monitor 5-FU levels, consider dose adjustment",
        "source": "Lexicomp"
      }
    ],
    "alert_count": 1
  }
}
```

---

## ⚠️ Alerts

### Get All Alerts
```
GET /api/v1/patients/:id/alerts
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
    "alerts": [
      {
        "alert_id": "alert_001",
        "category": "neurological",
        "title": "Seizure Disorder",
        "severity": "high",
        "status": "active_controlled",
        "onset_date": "2025-10-01",
        "description": "4-5 episodes during chemotherapy, now controlled on Eptoin",
        "action_required": "Requires perioperative management",
        "last_updated": "2025-10-22",
        "related_document_ids": ["doc_neuro_consult"]
      },
      {
        "alert_id": "alert_002",
        "category": "infection",
        "title": "Recent Salmonella Infection",
        "severity": "medium",
        "status": "resolved",
        "onset_date": "2025-11-07",
        "description": "Severe diarrhea, 7-day hospitalization",
        "action_required": null,
        "last_updated": "2025-11-13",
        "related_document_ids": ["doc_discharge_nov"]
      }
    ],
    "counts": {
      "total": 5,
      "high": 1,
      "medium": 2,
      "low": 2
    }
  }
}
```

---

### Create Alert
```
POST /api/v1/patients/:id/alerts
```

---

### Update Alert
```
PUT /api/v1/patients/:id/alerts/:alertId
```

---

### Delete Alert
```
DELETE /api/v1/patients/:id/alerts/:alertId
```

---

## 🧪 Labs

### Get Latest Labs
```
GET /api/v1/patients/:id/labs/latest
```

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2025-11-21",
    "hemoglobin": {"value": 10.2, "unit": "g/dL", "flag": "low", "ref_low": 13.0, "ref_high": 17.0},
    "wbc": {"value": 5.8, "unit": "x10^9/L", "flag": "normal", "ref_low": 4.0, "ref_high": 11.0},
    "anc": {"value": 3.2, "unit": "x10^9/L", "flag": "normal", "ref_low": 1.5, "ref_high": 8.0},
    "platelets": {"value": 180, "unit": "x10^9/L", "flag": "normal", "ref_low": 150, "ref_high": 400},
    "creatinine": {"value": 1.1, "unit": "mg/dL", "flag": "normal", "ref_low": 0.7, "ref_high": 1.3},
    "egfr": {"value": 72, "unit": "mL/min/1.73m2", "flag": "normal", "ref_low": 60, "ref_high": null},
    "bilirubin_total": {"value": 0.8, "unit": "mg/dL", "flag": "normal", "ref_low": 0.1, "ref_high": 1.2},
    "alt": {"value": 28, "unit": "U/L", "flag": "normal", "ref_low": 7, "ref_high": 56},
    "ast": {"value": 32, "unit": "U/L", "flag": "normal", "ref_low": 10, "ref_high": 40},
    "albumin": {"value": 3.2, "unit": "g/dL", "flag": "low", "ref_low": 3.5, "ref_high": 5.0},
    "abnormal_count": 2,
    "critical_count": 0
  }
}
```

---

### Get Lab Trends
```
GET /api/v1/patients/:id/labs/trends
```

**Query Parameters:**
- `marker` (string, required) - hemoglobin, anc, platelets, creatinine, etc.
- `from` (date, optional) - Start date
- `to` (date, optional) - End date

**Response:**
```json
{
  "success": true,
  "data": {
    "marker": "hemoglobin",
    "unit": "g/dL",
    "ref_low": 13.0,
    "ref_high": 17.0,
    "values": [
      {"date": "2025-09-23", "value": 12.8},
      {"date": "2025-10-17", "value": 11.5},
      {"date": "2025-11-07", "value": 9.8},
      {"date": "2025-11-21", "value": 10.2}
    ]
  }
}
```

---

### Get Tumor Markers
```
GET /api/v1/patients/:id/tumor-markers
```

**Response:**
```json
{
  "success": true,
  "data": {
    "baseline": {
      "cea": {"value": 4.2, "date": "2025-09-23"},
      "ca199": {"value": 28.5, "date": "2025-09-23"}
    },
    "latest": {
      "cea": {"value": 3.8, "date": "2025-11-21", "trend": "decreasing"},
      "ca199": {"value": 22.1, "date": "2025-11-21", "trend": "decreasing"}
    }
  }
}
```

---

### Get Tumor Marker Trends
```
GET /api/v1/patients/:id/tumor-markers/trends
```

**Query Parameters:**
- `marker` (string, required) - cea, ca199, ca125, afp, psa, etc.

---

### Add Lab Result
```
POST /api/v1/patients/:id/labs
```

---

## 📅 Timeline

### Get Patient Timeline
```
GET /api/v1/patients/:id/timeline
```

**Query Parameters:**
- `from` (date, optional)
- `to` (date, optional)
- `category` (string, optional) - diagnosis, imaging, treatment, complication, hospitalization

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "evt_001",
        "date": "2025-09-12",
        "date_precision": "day",
        "category": "imaging",
        "title": "CT Abdomen",
        "description": "Wall thickening (2.1cm). Perigastric lymphadenopathy.",
        "significance": "diagnostic",
        "document_id": "doc_ct_sept"
      },
      {
        "id": "evt_002",
        "date": "2025-09-22",
        "date_precision": "day",
        "category": "diagnosis",
        "title": "Biopsy Confirmation",
        "description": "Adenocarcinoma with focal signet ring cell features",
        "significance": "key_milestone",
        "document_id": "doc_biopsy"
      }
    ],
    "hospitalizations": [
      {
        "admission_date": "2025-11-07",
        "discharge_date": "2025-11-13",
        "los_days": 7,
        "diagnosis": "Salmonella infection",
        "document_id": "doc_discharge_nov"
      }
    ],
    "upcoming": [
      {
        "date": "2025-12-05",
        "event_type": "imaging",
        "title": "CT Response Assessment",
        "decision": "Surgery vs 5th cycle"
      }
    ]
  }
}
```

---

### Add Timeline Event
```
POST /api/v1/patients/:id/timeline
```

---

## 📄 Documents (Merged Case-Pack)

### Upload Documents
```
POST /api/v1/patients/:id/documents
```

**Form Data:**
- `files` (File[], required) - Multiple files
- `category` (string, optional) - pathology, radiology, discharge_summary, consultation, lab_report, operative_note, other
- `subcategory` (string, optional) - biopsy, ct, mri, pet, etc.
- `document_date` (string, optional) - YYYY-MM-DD format
- `process_immediately` (boolean, optional) - Default true
- `vectorize` (boolean, optional) - Enable RAG indexing, default true

**Response (202 Accepted):**
```json
{
  "success": true,
  "documents_uploaded": 2,
  "processing_status": "processing",
  "message": "2 document(s) uploaded. Processing and vectorization started.",
  "data": {
    "documents": [
      {
        "id": "doc_123",
        "patient_id": "pt_abc123",
        "filename": "pathology_report.pdf",
        "file_type": "pdf",
        "category": "pathology",
        "subcategory": "biopsy",
        "document_date": "2025-09-22",
        "file_size": 245678,
        "processing_status": "pending",
        "vectorize_status": "pending",
        "case_pack_order": 1,
        "created_at": 1638360000
      }
    ]
  }
}
```

---

### List Patient Documents
```
GET /api/v1/patients/:id/documents
```

**Query Parameters:**
- `category` (string, optional) - Filter by category
- `from` (date, optional) - Documents from date
- `to` (date, optional) - Documents to date
- `reviewed` (boolean, optional) - Filter by reviewed status
- `sort` (string, optional) - date_desc, date_asc, case_pack_order

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_123",
        "filename": "pathology_report.pdf",
        "title": "Primary Biopsy",
        "category": "pathology",
        "subcategory": "biopsy",
        "document_date": "2025-09-22",
        "file_size": 245678,
        "processing_status": "completed",
        "vectorize_status": "completed",
        "reviewed_status": "reviewed",
        "reviewed_by": "Dr. Oncologist",
        "reviewed_date": "2025-09-23",
        "critical_findings": false,
        "summary": "Adenocarcinoma with focal signet ring cell features",
        "case_pack_order": 1,
        "created_at": 1638360000
      }
    ],
    "counts_by_category": {
      "pathology": 3,
      "radiology": 5,
      "discharge_summary": 4,
      "consultation": 2,
      "lab_report": 12
    },
    "total": 26
  }
}
```

---

### Get Document Metadata
```
GET /api/v1/patients/:id/documents/:docId
```

---

### Update Document Metadata
```
PATCH /api/v1/patients/:id/documents/:docId
```

**Request Body:**
```json
{
  "title": "Primary Gastric Biopsy",
  "category": "pathology",
  "subcategory": "biopsy",
  "document_date": "2025-09-22",
  "reviewed_status": "reviewed",
  "reviewed_by": "Dr. Oncologist",
  "critical_findings": false,
  "case_pack_order": 1
}
```

---

### Download Document
```
GET /api/v1/patients/:id/documents/:docId/download
```

**Response:** Binary file stream

---

### Delete Document
```
DELETE /api/v1/patients/:id/documents/:docId
```

---

### Reorder Documents (Case-Pack Order)
```
POST /api/v1/patients/:id/documents/reorder
```

**Request Body:**
```json
{
  "document_ids": ["doc_123", "doc_456", "doc_789"]
}
```

---

### Search Documents (RAG)
```
POST /api/v1/patients/:id/documents/search
```

**Request Body:**
```json
{
  "query": "What was the HER2 status on biopsy?",
  "top_k": 5,
  "category_filter": ["pathology", "consultation"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "document_id": "doc_123",
        "filename": "pathology_report.pdf",
        "chunk_text": "HER2 status: Negative (Score 1+). IHC performed on...",
        "relevance_score": 0.92,
        "document_date": "2025-09-22"
      }
    ],
    "answer": "The HER2 status on biopsy was Negative with a score of 1+."
  }
}
```

---

## 📋 History

### Get Medical History
```
GET /api/v1/patients/:id/history/medical
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comorbidities": [],
    "comorbidities_summary": "None (no HTN, DM)",
    "charlson_comorbidity_index": 2,
    "functional_baseline": "Fully independent, manages farm",
    "hepatitis_b_status": "negative",
    "hepatitis_c_status": "negative",
    "hiv_status": "unknown",
    "tb_history": false,
    "prior_malignancies": [],
    "prior_radiation": false,
    "cardiac_history_detail": null,
    "cardiac_ef_baseline": null,
    "pulmonary_history": null
  }
}
```

---

### Update Medical History
```
PUT /api/v1/patients/:id/history/medical
```

---

### Get Surgical History
```
GET /api/v1/patients/:id/history/surgical
```

**Response:**
```json
{
  "success": true,
  "data": {
    "surgeries": [
      {
        "procedure": "Leg surgery",
        "year": 2013,
        "details": null,
        "complications": null
      }
    ]
  }
}
```

---

### Get Family History
```
GET /api/v1/patients/:id/history/family
```

**Response:**
```json
{
  "success": true,
  "data": {
    "family_history": [
      {
        "relationship": "maternal_aunt_daughter",
        "condition": "breast cancer",
        "age_at_diagnosis": null,
        "relevance": "likely_unrelated"
      }
    ],
    "family_history_cancer_immediate": false
  }
}
```

---

### Get Social History
```
GET /api/v1/patients/:id/history/social
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alcohol": "never",
    "smoking": "never",
    "tobacco": "never",
    "occupational_exposures": [],
    "diet": null,
    "exercise": null
  }
}
```

---

## 🧠 Decisions & Clinical Questions

### Get Clinical Decisions
```
GET /api/v1/patients/:id/decisions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "primary_clinical_question": "Post-neoadjuvant chemotherapy management - surgical candidacy assessment",
    "surgical_considerations": [
      "Minimally invasive approach feasibility",
      "Extent of resection"
    ],
    "perioperative_risks": [
      "Seizure disorder",
      "Recent infection",
      "Nutritional status"
    ],
    "decision_timeline": {
      "date": "2025-12-05",
      "event": "CT response assessment",
      "decision": "Surgery vs 5th cycle"
    },
    "action_items": [
      "Review surgical candidacy",
      "Advise on MIS feasibility"
    ],
    "alternative_management_options": [
      "Continue 2 more cycles before surgery",
      "Refer to high-volume center"
    ],
    "center_of_excellence_consideration": {
      "centers": ["Manipal", "Fortis"],
      "reason": "Family exploring advanced/minimally invasive options"
    },
    "family_goals": "Explore advanced/minimally invasive surgical options",
    "staging_gap_noted": true
  }
}
```

---

### Update Decisions
```
PUT /api/v1/patients/:id/decisions
```

---

### Get MDT Discussions
```
GET /api/v1/patients/:id/decisions/mdt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "discussions": [
      {
        "date": "2025-09-25",
        "attendees": ["Dr. Oncologist", "Dr. Surgeon", "Dr. Radiologist"],
        "recommendation": "Proceed with 4-6 cycles neoadjuvant FOLFOX, restage, then surgical evaluation",
        "next_review_date": "2025-12-10",
        "document_id": "doc_mdt_sept"
      }
    ]
  }
}
```

---

### Add MDT Discussion
```
POST /api/v1/patients/:id/decisions/mdt
```

---

## 📊 Performance Status

### Get Performance Status
```
GET /api/v1/patients/:id/performance-status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "ecog": 2,
      "karnofsky": 70,
      "date": "2025-11-21"
    },
    "history": [
      {"date": "2025-09-23", "ecog": 1, "karnofsky": 80},
      {"date": "2025-11-21", "ecog": 2, "karnofsky": 70}
    ]
  }
}
```

---

### Update Performance Status
```
POST /api/v1/patients/:id/performance-status
```

---

## 🏥 Comorbidities

### Get Comorbidities
```
GET /api/v1/patients/:id/comorbidities
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comorbidities": [],
    "charlson_score": 2,
    "summary": "None documented (no HTN, DM)"
  }
}
```

---

## ⚙️ Processing

### Get Processing Status
```
GET /api/v1/patients/:id/processing/status
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

---

### Get Processing Log
```
GET /api/v1/patients/:id/processing/log
```

**Query Parameters:**
- `limit` (number, optional) - Default 20
- `type` (string, optional) - extraction, vectorization, all

---

### Reprocess Document
```
POST /api/v1/patients/:id/documents/:docId/reprocess
```

**Request Body:**
```json
{
  "mode": "full",
  "revectorize": true
}
```

---

## 🚪 Intake (Document-First Patient Creation)

### Create Patient from Documents
```
POST /api/v1/intake
```

**Form Data:**
- `files` (File[], required)
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
      "name": "Mohammed Kutty P K",
      "age": 68,
      "sex": "male",
      "extracted_from_documents": true
    },
    "documents_uploaded": 2,
    "documents_processed": 1,
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

## 📊 Endpoint Summary

| Category | Endpoints | Priority |
|----------|-----------|----------|
| Health | 1 | - |
| Patients | 5 | Must Have |
| Demographics | 1 | Must Have |
| Diagnosis | 2 | Must Have |
| Staging | 2 | Must Have |
| Treatment | 5 | Must Have |
| Medications | 5 | Must Have |
| Alerts | 4 | Must Have |
| Labs | 5 | Must Have |
| Tumor Markers | 2 | Must Have |
| Timeline | 2 | Must Have |
| Documents | 8 | Must Have |
| History | 4 | Good to Have |
| Decisions | 3 | Must Have |
| Performance Status | 2 | Good to Have |
| Comorbidities | 1 | Good to Have |
| Processing | 3 | Must Have |
| Intake | 1 | Must Have |
| **Total** | **56** | |

---

## 🗄️ Database Schema Changes (D1)

### New/Modified Tables

```sql
-- Documents table (replaces documents + case_pack_documents)
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  title TEXT,
  file_type TEXT NOT NULL,
  category TEXT, -- pathology, radiology, etc.
  subcategory TEXT,
  document_date TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_key TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  vectorize_status TEXT DEFAULT 'pending',
  reviewed_status TEXT DEFAULT 'unreviewed',
  reviewed_by TEXT,
  reviewed_date INTEGER,
  critical_findings INTEGER DEFAULT 0,
  summary TEXT,
  detailed_extraction TEXT, -- JSON blob
  case_pack_order INTEGER DEFAULT 0, -- For ordering in case pack view
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Remove case_packs table (merged into documents)
-- Remove case_pack_documents table (merged into documents)
```

---

## 🔄 Migration Notes

1. **Case-Pack Migration:**
   - Move `case_pack_documents.display_order` → `documents.case_pack_order`
   - Delete `case_packs` and `case_pack_documents` tables
   - Update all case-pack API calls to use documents endpoints

2. **New Fields to Add:**
   - `documents.category` (enum)
   - `documents.subcategory` (string)
   - `documents.vectorize_status` (enum)
   - `documents.reviewed_status` (enum)
   - `documents.reviewed_by` (string)
   - `documents.reviewed_date` (timestamp)
   - `documents.critical_findings` (boolean)
   - `documents.case_pack_order` (integer)

3. **Vectorize Integration:**
   - On document upload, queue for Cloudflare Vectorize
   - Store vector embeddings with document chunks
   - Enable semantic search via `/documents/search`

---

**Last Updated:** 2025-12-01
**API Version:** v1
**Base URL:** http://localhost:8787/api/v1