# Postman Collection Guide

## 📦 Import the Collection

**File:** `postman_collection.json` (Complete - Phase 2-3)

1. Open Postman
2. Click **Import** (top left)
3. Drag & drop `postman_collection.json`
4. Collection will be imported with all 12 sections

---

## 🔧 Setup Collection Variables

After importing, set these variables in the collection:

### Required Variables
1. **baseUrl**:
   - Local: `http://localhost:8787/api/v1`
   - Production: `https://process.saarthihq.com/api/v1`

2. **patientId**: Auto-populated after creating a patient
3. **documentId**: Auto-populated after uploading a document
4. **firebaseToken**: For authentication (optional for local testing)

### How to Set Variables
1. Click on the collection name
2. Go to **Variables** tab
3. Update the `Current value` column
4. Click **Save**

---

## 📋 Complete Endpoint List

### 1. Authentication (5 endpoints)
- Send Phone OTP
- Verify Phone OTP
- Verify Firebase Token
- Get Current User
- Logout

### 2. Health (1 endpoint)
- Health Check

### 3. Patients (5 endpoints)
- Create Patient *(with extended Phase 2 fields)*
- List Patients
- Get Patient by ID
- Update Patient
- Delete Patient (Archive)

**New Phase 2 Fields:**
- `blood_type`, `height_cm`, `weight_kg`, `bsa`
- `ecog_status`, `current_status`
- `patient_id_uhid`, `patient_id_ipd`
- `primary_oncologist`, `primary_center`
- `language_preference`, `allergy_status`

### 4. Documents (9 endpoints)
- Upload Documents
- List Documents
- Get Document
- Download Document
- Delete Document
- **Vectorize Document** *(Phase 3 - NEW)*
- **Semantic Search** *(Phase 3 - NEW)*
- **Reorder Case-Pack Documents** *(Phase 2 - NEW)*
- **Reprocess Document** *(Phase 2 - NEW)*

### 5. Processing (4 endpoints)
- Process Document (Gemini)
- Process Document (OpenAI)
- Get Processing Status
- Get Processing Log

### 6. **Diagnosis & Staging** *(Phase 2 - NEW)* (4 endpoints)
- **Get Diagnosis**
- **Create/Update Diagnosis** *(creates version history)*
- **Get Staging**
- **Create/Update Staging** *(creates version history)*

### 7. **Treatment** *(Phase 2 - NEW)* (6 endpoints)
- **Get Treatment**
- **Create/Update Treatment** *(creates version history)*
- **Get All Treatment Cycles**
- **Get Specific Cycle**
- **Add Treatment Cycle**
- **Update Treatment Cycle**

### 8. **Document Vectorization & Search** *(Phase 3 - NEW)* (4 endpoints)
- **Vectorize Document** *(Workers AI embeddings)*
- **Search Documents (RAG)** *(Semantic search)*
- **Reorder Case-Pack Documents**
- **Reprocess Document**

### 9. Case-Packs (4 endpoints)
- Get Case-Pack
- Update Case-Pack Metadata
- Remove Document from Case-Pack
- Reorder Documents

### 10. Views (4 endpoints)
- Get Patient Summary
- Get Diagnosis & Staging
- Get Imaging Findings
- Get Lab Results

### 11. Timeline (2 endpoints)
- Get Timeline
- Get Timeline Tracks

### 12. Intake (1 endpoint)
- Create Patient from Documents

---

## 🚀 Quick Start Workflows

### Workflow 1: Create Patient & Upload Documents

1. **Create Patient**
   - Folder: `Patients`
   - Request: `Create Patient`
   - Body example:
     ```json
     {
       "name": "Test Patient",
       "age": 65,
       "sex": "male",
       "blood_type": "O+",
       "ecog_status": 1,
       "primary_oncologist": "Dr. Smith"
     }
     ```
   - ✅ `patientId` auto-saved

2. **Upload Documents**
   - Folder: `Documents`
   - Request: `Upload Documents`
   - Select files and set `process_immediately` to `true`
   - ✅ `documentId` auto-saved

3. **Check Processing Status**
   - Folder: `Processing`
   - Request: `Get Processing Status`

### Workflow 2: Add Diagnosis & Staging

1. **Create Diagnosis**
   - Folder: `Diagnosis & Staging`
   - Request: `Create/Update Diagnosis`
   - Body example:
     ```json
     {
       "primary_cancer_type": "Breast Cancer",
       "tumor_size_cm": 2.5,
       "diagnosis_date": "2024-01-15"
     }
     ```

2. **Create Staging**
   - Request: `Create/Update Staging`
   - Body example:
     ```json
     {
       "clinical_t": "cT2",
       "clinical_n": "cN1",
       "clinical_m": "cM0",
       "clinical_stage": "IIB"
     }
     ```

### Workflow 3: Semantic Search (RAG)

1. **Vectorize Document** (if not auto-vectorized)
   - Folder: `Document Vectorization & Search`
   - Request: `Vectorize Document`

2. **Search Documents**
   - Request: `Search Documents (RAG)`
   - Body:
     ```json
     {
       "query": "breast cancer diagnosis",
       "top_k": 5
     }
     ```

### Workflow 4: Add Treatment Plan

1. **Create Treatment**
   - Folder: `Treatment`
   - Request: `Create/Update Treatment`
   - Body:
     ```json
     {
       "regimen_name": "AC-T",
       "treatment_intent": "adjuvant",
       "drugs": ["Doxorubicin", "Cyclophosphamide"],
       "total_planned_cycles": 8
     }
     ```

2. **Add Treatment Cycle**
   - Request: `Add Treatment Cycle`
   - Body:
     ```json
     {
       "cycle_number": 1,
       "actual_date": "2024-02-01",
       "drugs_administered": [
         {"drug": "Doxorubicin", "dose": 60, "unit": "mg/m2"}
       ]
     }
     ```

---

## 🎯 Testing Tips

### 1. Use Collection Runner
Run multiple requests in sequence:
1. Create Patient
2. Upload Documents
3. Process Documents
4. Create Diagnosis
5. Add Treatment

### 2. Environment Switching
Create 2 environments:
- **Local**: `baseUrl = http://localhost:8787/api/v1`
- **Production**: `baseUrl = https://process.saarthihq.com/api/v1`

Switch between them easily in Postman.

### 3. Auto-Save IDs
Scripts automatically save `patientId` and `documentId` to variables. Check the **Tests** tab in requests to see the auto-save scripts.

### 4. Monitor Responses
- Look for `data_sources` field in responses (shows where data came from)
- Check `vectorize_status` on documents
- Review `processing_status` to track AI processing

---

## 🆕 What's New in Phase 2-3

### Phase 2 Features
✅ **Extended Patient Fields** (blood type, ECOG status, etc.)
✅ **Diagnosis & Staging** with version history
✅ **Treatment & Cycles** management
✅ **Field-level source tracking** (document vs AI-inferred)
✅ **Version history** for admin edits
✅ **Document reprocessing**
✅ **Case-pack merged into documents**

### Phase 3 Features
✅ **Vectorize** documents with Workers AI embeddings
✅ **Semantic search** (RAG) across patient documents
✅ **768D embeddings** using `@cf/baai/bge-base-en-v1.5`

---

## 🔍 Key Differences from Backup

| Feature | Backup | New (Phase 2-3) |
|---------|--------|-----------------|
| Patient fields | Basic | Extended (blood type, ECOG, etc.) |
| Diagnosis | View only | CRUD + version history |
| Treatment | View only | CRUD + cycles + version history |
| Document search | Basic | Semantic RAG with Workers AI |
| Document vectorization | Manual/local | Workers AI embeddings |
| Case-packs | Separate table | Merged into documents |
| Source tracking | None | Field-level tracking |
| Version history | None | Full audit trail |

---

## 📊 Total Endpoints

| Section | Count | Phase |
|---------|-------|-------|
| Authentication | 5 | Phase 1 |
| Health | 1 | Phase 1 |
| Patients | 5 | Phase 2 |
| Documents | 9 | Phase 2-3 |
| Processing | 4 | Phase 1 |
| **Diagnosis & Staging** | **4** | **Phase 2** |
| **Treatment** | **6** | **Phase 2** |
| **Vectorization & Search** | **4** | **Phase 3** |
| Case-Packs | 4 | Phase 1 |
| Views | 4 | Phase 1 |
| Timeline | 2 | Phase 1 |
| Intake | 1 | Phase 1 |
| **Total** | **49** | - |

---

## 🛠️ Troubleshooting

### Collection Variables Not Saving
- Make sure auto-save scripts are enabled
- Check the **Tests** tab in each request
- Manually set `patientId` and `documentId` if needed

### Vectorize Returns "Skipped"
- Run `wrangler vectorize list` to check if index exists
- For local dev: Use `wrangler dev` (without `--local`) for real Workers AI

### 401 Unauthorized
- Generate a Firebase token for testing
- Add to Authorization header: `Bearer <token>`

### Endpoints Not Found (404)
- Check you're using the correct `baseUrl`
- Verify your local server is running: `npm run dev`
- Check endpoint path matches the API

---

## 📚 Related Files

- `LOCAL_DEVELOPMENT.md` - Local development setup guide
- `new_plan.md` - Complete refactoring plan (Phase 1-7)
- `schema.sql` - Database schema with all new tables
- `src/tests/api.test.js` - API test examples

---

Happy Testing! 🎉
