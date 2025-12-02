API and Database Refactoring Plan
Overview
Refactor the Saarthi Clinical API to match the new endpoint design, implement field-level data source tracking, version history for admin edits, and Cloudflare Vectorize integration for semantic document search.

Phase 1: Database Schema Refactoring
1.1 New Schema Design
File: saarthi-clinical/schema.sql

Create new schema matching refactored design:

patients table: Extend with new fields (patient_id_uhid, patient_id_ipd, primary_oncologist, primary_center, current_status, current_status_detail, age_unit, sex, dob, blood_type, height_cm, weight_kg, bsa, ecog_status, language_preference, allergy_status)
documents table: Merge case-pack functionality
Add: category, subcategory, title, vectorize_status, reviewed_status, reviewed_by, reviewed_date, critical_findings, summary, case_pack_order
Remove dependency on case_packs and case_pack_documents tables
New tables:
diagnosis - Cancer diagnosis details with field-level source tracking
staging - TNM staging information
treatment - Treatment regimens and cycles
treatment_cycles - Individual cycle details
medications - Patient medications
alerts - Clinical alerts and risk factors
lab_results - Lab test results with trends
tumor_markers - Tumor marker values
medical_history - Medical history
surgical_history - Surgical procedures
family_history - Family medical history
social_history - Social history
clinical_decisions - Clinical questions and MDT discussions
performance_status - ECOG/Karnofsky scores
data_versions - Version history for all editable fields
document_vectors - Vector embeddings for RAG (metadata only, actual vectors in Vectorize)
1.2 Data Source Tracking
File: saarthi-clinical/src/utils/data-source.js (new)

Create utility for field-level source tracking:

trackFieldSource(fieldName, value, source) - Track if data came from document_id or "ai_inferred"
getFieldSource(fieldName, recordId) - Retrieve source for a field
Store in JSON metadata field: {field_name: {value, source: "doc_123" | "ai_inferred", timestamp}}
1.3 Version History System
File: saarthi-clinical/src/models/data-version.js (new)

Create version history model:

Track all edits with: field_name, old_value, new_value, edited_by, edited_at, reason
Link to original source (document_id or ai_inferred)
Support rollback to previous versions
Phase 2: Core API Endpoints (Priority 1)
2.1 Patients Endpoints
File: saarthi-clinical/src/routes/patients.js

Refactor to match new design:

POST /api/v1/patients - Create with new fields
GET /api/v1/patients - List with filters (status, oncologist)
GET /api/v1/patients/:id - Get full patient header
GET /api/v1/patients/:id/demographics - Get demographics only
PATCH /api/v1/patients/:id - Update patient
DELETE /api/v1/patients/:id - Archive patient
File: saarthi-clinical/src/models/patient.js

Update Patient model to include:

New demographic fields (blood_type, height_cm, weight_kg, bsa, ecog_status, etc.)
Clinical identifiers (patient_id_uhid, patient_id_ipd)
Care team (primary_oncologist, primary_center)
Current status fields
2.2 Documents Endpoints (Merged Case-Pack)
File: saarthi-clinical/src/routes/documents.js

Refactor to merge case-pack functionality:

POST /api/v1/patients/:id/documents - Upload with category/subcategory, auto-queue vectorization
GET /api/v1/patients/:id/documents - List with filters (category, date range, reviewed status, sort)
GET /api/v1/patients/:id/documents/:docId - Get metadata
PATCH /api/v1/patients/:id/documents/:docId - Update metadata (title, category, reviewed_status, case_pack_order)
GET /api/v1/patients/:id/documents/:docId/download - Download file
DELETE /api/v1/patients/:id/documents/:docId - Delete document
POST /api/v1/patients/:id/documents/reorder - Reorder case-pack
POST /api/v1/patients/:id/documents/search - RAG search (uses Vectorize)
POST /api/v1/patients/:id/documents/:docId/reprocess - Reprocess document
File: saarthi-clinical/src/models/document.js

Update Document model:

Add category, subcategory, title, vectorize_status, reviewed_status fields
Remove case_pack dependency
Add case_pack_order field
2.3 Diagnosis & Staging Endpoints
File: saarthi-clinical/src/routes/diagnosis.js (new)

Create new routes:

GET /api/v1/patients/:id/diagnosis - Get diagnosis with source tracking
PUT /api/v1/patients/:id/diagnosis - Update diagnosis (admin only, creates version)
GET /api/v1/patients/:id/staging - Get staging
PUT /api/v1/patients/:id/staging - Update staging (admin only, creates version)
File: saarthi-clinical/src/models/diagnosis.js (new)

File: saarthi-clinical/src/models/staging.js (new)

2.4 Treatment Endpoints
File: saarthi-clinical/src/routes/treatment.js (new)

Create treatment routes:

GET /api/v1/patients/:id/treatment - Get treatment overview
PUT /api/v1/patients/:id/treatment - Update treatment
GET /api/v1/patients/:id/treatment/cycles - Get all cycles
GET /api/v1/patients/:id/treatment/cycles/:cycleNumber - Get single cycle
POST /api/v1/patients/:id/treatment/cycles - Add cycle
PUT /api/v1/patients/:id/treatment/cycles/:cycleNumber - Update cycle
File: saarthi-clinical/src/models/treatment.js (new)

File: saarthi-clinical/src/models/treatment-cycle.js (new)

Phase 3: Cloudflare Vectorize Integration
3.1 Vectorize Configuration
File: saarthi-clinical/wrangler.toml

Add Vectorize binding:

[[vectorize]]
binding = "VECTORIZE"
index_name = "medical-documents"
3.2 Vectorization Service
File: saarthi-clinical/src/services/vectorize/indexer.js (new)

Create vectorization service:

vectorizeDocument(docId, text) - Chunk text, generate embeddings, store in Vectorize
searchDocuments(patientId, query, topK) - Semantic search using Vectorize
deleteDocumentVectors(docId) - Remove vectors on document delete
Use Cloudflare Workers AI embeddings API or external embedding service
3.3 Document Processing Integration
File: saarthi-clinical/src/services/processing/processor.js

Update to:

After document processing, extract text chunks
Queue vectorization (manual trigger via API)
Update vectorize_status field
File: saarthi-clinical/src/routes/documents.js

Add:

POST /api/v1/patients/:id/documents/:docId/vectorize - Manual vectorization trigger
POST /api/v1/patients/:id/documents/search - RAG search endpoint
Phase 4: Admin Editing & Version History
4.1 Admin Middleware
File: saarthi-clinical/src/middleware/auth.js

Enhance requireRole to support admin role:

Check if user.role === 'admin' for edit endpoints
Add requireAdmin() helper
4.2 Version History Service
File: saarthi-clinical/src/services/version-history.js (new)

Create service for:

createVersion(recordType, recordId, fieldName, oldValue, newValue, userId, reason) - Create version entry
getVersionHistory(recordType, recordId, fieldName) - Get history for a field
rollbackToVersion(versionId) - Rollback to previous version
4.3 Edit Endpoints
Update all PUT/PATCH endpoints to:

Check admin role
Create version history entry before update
Track data source (mark as "manual_override" when edited)
Phase 5: Data Extraction & AI Processing
5.1 Enhanced Extraction
File: saarthi-clinical/src/services/processing/processor.js

Update extraction to:

Extract structured data matching new schema (diagnosis, staging, treatment, medications, labs, etc.)
Tag each extracted field with source (document_id)
Store in appropriate tables with source tracking
5.2 AI Inference Service
File: saarthi-clinical/src/services/ai-inference.js (new)

Create service for AI-inferred data:

inferMissingData(patientId) - Use AI to fill gaps in patient data
Tag inferred fields with source "ai_inferred"
Store in same tables as extracted data, but with different source tag
Phase 6: Remaining Endpoints (Priority 2)
6.1 Medications, Alerts, Labs
Files:

saarthi-clinical/src/routes/medications.js (new)
saarthi-clinical/src/routes/alerts.js (new)
saarthi-clinical/src/routes/labs.js (new)
Implement CRUD endpoints for:

Medications (with drug interaction checking)
Alerts (risk factors, clinical alerts)
Labs (latest, trends, tumor markers)
6.2 Timeline, History, Decisions
Files:

saarthi-clinical/src/routes/timeline.js (update)
saarthi-clinical/src/routes/history.js (new)
saarthi-clinical/src/routes/decisions.js (new)
Update/implement:

Timeline with new event structure
Medical/surgical/family/social history
Clinical decisions and MDT discussions
Phase 7: Migration & Cleanup
7.1 Migration Scripts
File: saarthi-clinical/migrations/003_refactor_schema.sql (new)

Create migration to:

Drop old tables (case_packs, case_pack_documents, clinical_sections)
Create new tables (diagnosis, staging, treatment, etc.)
Migrate existing data where applicable (fresh start approach)
7.2 Route Cleanup
File: saarthi-clinical/src/index.js

Update route mounting:

Remove old case-pack routes
Add new routes (diagnosis, staging, treatment, medications, alerts, labs, history, decisions)
Update intake route
7.3 Model Cleanup
Remove/update:

saarthi-clinical/src/models/case-pack.js (delete)
Update existing models to match new schema
Implementation Order
Database Schema - Create new schema.sql
Core Models - Patient, Document (updated)
Core Routes - Patients, Documents (refactored)
Vectorize Integration - Setup and basic search
Diagnosis & Staging - New endpoints
Treatment - New endpoints
Data Source Tracking - Implement field-level tracking
Version History - Admin editing with history
Remaining Endpoints - Medications, Alerts, Labs, etc.
Migration - Deploy new schema
Key Files to Create/Modify
New Files:

saarthi-clinical/src/utils/data-source.js
saarthi-clinical/src/models/data-version.js
saarthi-clinical/src/models/diagnosis.js
saarthi-clinical/src/models/staging.js
saarthi-clinical/src/models/treatment.js
saarthi-clinical/src/models/treatment-cycle.js
saarthi-clinical/src/services/vectorize/indexer.js
saarthi-clinical/src/services/version-history.js
saarthi-clinical/src/services/ai-inference.js
saarthi-clinical/src/routes/diagnosis.js
saarthi-clinical/src/routes/treatment.js
saarthi-clinical/src/routes/medications.js
saarthi-clinical/src/routes/alerts.js
saarthi-clinical/src/routes/labs.js
saarthi-clinical/src/routes/history.js
saarthi-clinical/src/routes/decisions.js
saarthi-clinical/migrations/003_refactor_schema.sql
Modified Files:

saarthi-clinical/schema.sql (complete rewrite)
saarthi-clinical/src/models/patient.js
saarthi-clinical/src/models/document.js
saarthi-clinical/src/routes/patients.js
saarthi-clinical/src/routes/documents.js
saarthi-clinical/src/routes/timeline.js
saarthi-clinical/src/routes/intake.js
saarthi-clinical/src/services/processing/processor.js
saarthi-clinical/src/middleware/auth.js
saarthi-clinical/src/index.js