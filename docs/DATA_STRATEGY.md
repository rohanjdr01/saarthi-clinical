# Data Strategy: Diagnosis, Staging & Document Provenance

> **Status**: Draft — pending review before implementation  
> **Last Updated**: 2025-12-04

---

## Problem Statement

### Current Issues

When processing medical documents, we observe inconsistencies between:
1. **Extraction output** (rich, detailed data returned from AI processing)
2. **Stored data** (incomplete fields in diagnosis/staging tables)
3. **API responses** (missing provenance — which documents contributed to each field)

#### Example: Manual Processing Response
```json
{
  "extracted_data": {
    "diagnosis": {
      "cancer_type": "Adenocarcinoma",
      "cancer_site_primary": "Stomach",
      "cancer_subsite": "Gastric body (along lesser curvature)",
      "histology_subtype": "Adenocarcinoma with focal signet ring cell component",
      "basis": "Histopathology review of OGD biopsy",
      "date_of_diagnosis": "2025-09-29",
      "status": "provisional"
    }
  }
}
```

#### Example: GET /diagnosis Response
```json
{
  "data": {
    "primary_cancer_type": "Adenocarcinoma",
    "primary_cancer_subtype": null,        // ← Lost: was extracted
    "diagnosis_date": null,                 // ← Lost: was extracted as "2025-09-29"
    "tumor_location": null,                 // ← Lost: was extracted as "Gastric body"
    "histology": null,                      // ← Lost: was extracted
    "data_sources": {
      "primary_cancer_type": { "source": "doc_xxx" }
    }
  }
}
```

### Root Causes

1. **Field mapping gaps**: Extraction schema doesn't map cleanly to database schema
2. **Overwrite behavior**: New documents can overwrite existing data instead of enriching it
3. **No conflict detection**: When documents disagree, latest value silently wins
4. **No history tracking**: Lost visibility into how data evolved over time
5. **No multi-diagnosis support**: Patients may have multiple cancer diagnoses (primary, recurrence, secondary)
6. **No staging evolution**: Staging changes over time (initial → restaging → post-treatment)

---

## Design Principles

### 1. Documents Are Additive
- Each document **enriches** the patient picture
- Documents should **never erase** previously captured data
- A field is only updated if the new value is "better" (more specific, more recent, or fills a gap)

### 2. Field-Level Provenance
- Every field tracks **which document(s)** contributed to it
- API responses include the source documents for transparency
- Enables "trace back" to original source when reviewing data

### 3. Cancer-Specific Scope
- **Diagnosis endpoint**: Returns cancer diagnosis only (not comorbidities)
- **Staging endpoint**: Returns cancer staging snapshots
- Other conditions (diabetes, hypertension, etc.) belong in `medical_history`

### 4. Support Multiple Cancer Events
- Primary diagnosis
- Recurrence
- Secondary primary (different cancer type)
- Each is a distinct record linked to the patient

### 5. Event-Based Staging
- Staging is tied to **evaluation events** (scans, biopsies, clinical exams)
- Each significant evaluation creates a **staging snapshot**
- Staging timeline shows how stage evolved: initial → post-treatment → recurrence

### 6. Conflicts Require Manual Review
- When two documents report different values for the same field:
  - **Flag the conflict** (don't silently overwrite)
  - Keep the existing value until resolved
  - Surface conflicts to users in the UI

---

## Proposed Schema Changes

### New Tables

#### `diagnosis_history`
Tracks every change to diagnosis fields.

```sql
CREATE TABLE diagnosis_history (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  diagnosis_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT,           -- 'added' | 'updated' | 'conflict'
  created_at INTEGER,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (diagnosis_id) REFERENCES diagnosis(id),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

#### `staging_snapshots`
Each staging evaluation creates a snapshot.

```sql
CREATE TABLE staging_snapshots (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  document_id TEXT,
  timeline_event_id TEXT,
  staging_type TEXT,          -- 'initial' | 'restaging' | 'post_treatment' | 'recurrence'
  staging_date TEXT,
  staging_system TEXT,        -- 'AJCC 8th Edition', 'FIGO', etc.
  
  -- TNM Components
  clinical_t TEXT,
  clinical_n TEXT,
  clinical_m TEXT,
  pathological_t TEXT,
  pathological_n TEXT,
  pathological_m TEXT,
  
  overall_stage TEXT,         -- 'IIA', 'IIIB', etc.
  stage_group TEXT,           -- 'Stage II', 'Stage III', etc.
  
  data_sources TEXT,          -- JSON: field-level sources
  notes TEXT,
  created_at INTEGER,
  
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

#### `data_conflicts`
Tracks unresolved conflicts for manual review.

```sql
CREATE TABLE data_conflicts (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  entity_type TEXT,           -- 'diagnosis' | 'staging' | 'medication' | 'patient'
  entity_id TEXT,
  field_name TEXT,
  
  existing_value TEXT,
  existing_source_doc TEXT,
  existing_source_date INTEGER,
  
  new_value TEXT,
  new_source_doc TEXT,
  new_source_date INTEGER,
  
  status TEXT DEFAULT 'pending',  -- 'pending' | 'resolved' | 'dismissed'
  resolution TEXT,                 -- Which value was chosen
  resolved_by TEXT,
  resolved_at INTEGER,
  
  created_at INTEGER,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
```

### Modifications to Existing Tables

#### `diagnosis`
```sql
-- Support multiple diagnoses per patient
ALTER TABLE diagnosis ADD COLUMN is_current INTEGER DEFAULT 1;
ALTER TABLE diagnosis ADD COLUMN cancer_category TEXT;  -- 'primary' | 'recurrence' | 'secondary_primary'
ALTER TABLE diagnosis ADD COLUMN related_diagnosis_id TEXT;  -- Links recurrence to original
```

---

## Processing Logic Changes

### Current Flow (Problematic)
```
Document → Extract → Overwrite diagnosis/staging → Done
```

### Proposed Flow
```
Document → Extract → Compare with existing data
                   ↓
         ┌────────┴────────┐
         ↓                 ↓
    No conflict?      Conflict detected?
         ↓                 ↓
    Merge & update    Create conflict record
    Update data_sources   Keep existing value
    Create history entry  Notify for review
```

### Sync Logic Pseudocode

```javascript
async function syncDiagnosisFromExtraction(patientId, documentId, extractedData) {
  const existing = await getDiagnosis(patientId);
  const extracted = extractedData.diagnosis;
  
  for (const [field, newValue] of Object.entries(extracted)) {
    const existingValue = existing[field];
    
    if (!existingValue) {
      // Field was empty → add it
      await updateField(field, newValue, documentId);
      await createHistoryEntry(field, null, newValue, 'added', documentId);
      
    } else if (existingValue === newValue) {
      // Same value → just add source
      await appendSource(field, documentId);
      
    } else {
      // Different value → conflict!
      await createConflict({
        entityType: 'diagnosis',
        fieldName: field,
        existingValue,
        existingSource: existing.data_sources[field]?.source,
        newValue,
        newSource: documentId
      });
      // Keep existing value, don't overwrite
    }
  }
}
```

---

## API Response Changes

### GET `/patients/:id/diagnosis`

**Current Response**:
```json
{
  "success": true,
  "data": {
    "primary_cancer_type": "Adenocarcinoma",
    "histology": null
  }
}
```

**Proposed Response**:
```json
{
  "success": true,
  "data": {
    "current_diagnosis": {
      "id": "diag_xxx",
      "primary_cancer_type": "Adenocarcinoma",
      "cancer_site_primary": "Stomach",
      "histology": "Adenocarcinoma with focal signet ring cell component",
      "diagnosis_date": "2025-09-29",
      "cancer_category": "primary"
    },
    "document_sources": [
      {
        "document_id": "doc_xxx",
        "filename": "biopsy_report.pdf",
        "fields_contributed": ["cancer_type", "histology", "diagnosis_date"]
      },
      {
        "document_id": "doc_yyy",
        "filename": "pet_scan.pdf",
        "fields_contributed": ["metastatic_sites"]
      }
    ],
    "pending_conflicts": [
      {
        "id": "conflict_001",
        "field": "tumor_size_cm",
        "existing": { "value": 2.5, "source": "doc_xxx" },
        "proposed": { "value": 3.0, "source": "doc_yyy" }
      }
    ],
    "related_diagnoses": [
      {
        "id": "diag_yyy",
        "cancer_category": "recurrence",
        "diagnosis_date": "2026-03-15",
        "primary_cancer_type": "Adenocarcinoma"
      }
    ]
  }
}
```

### GET `/patients/:id/staging`

**Proposed Response**:
```json
{
  "success": true,
  "data": {
    "current_staging": {
      "id": "stg_002",
      "staging_type": "restaging",
      "staging_date": "2025-11-15",
      "staging_system": "AJCC 8th Edition",
      "clinical_stage": "IIB",
      "tnm": { "t": "cT2", "n": "cN1", "m": "cM0" }
    },
    "staging_timeline": [
      {
        "id": "stg_001",
        "staging_type": "initial",
        "staging_date": "2025-09-29",
        "overall_stage": "IIIA",
        "source_document": "doc_xxx",
        "source_event": "Initial CT staging"
      },
      {
        "id": "stg_002",
        "staging_type": "restaging",
        "staging_date": "2025-11-15",
        "overall_stage": "IIB",
        "source_document": "doc_yyy",
        "source_event": "Post-chemo CT evaluation"
      }
    ],
    "document_sources": [
      { "document_id": "doc_xxx", "filename": "initial_ct.pdf" },
      { "document_id": "doc_yyy", "filename": "restaging_ct.pdf" }
    ]
  }
}
```

---

## New Endpoints

### Conflict Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients/:id/conflicts` | List all pending conflicts |
| GET | `/patients/:id/conflicts/:conflictId` | Get conflict details |
| PUT | `/patients/:id/conflicts/:conflictId/resolve` | Resolve: choose a value |
| PUT | `/patients/:id/conflicts/:conflictId/dismiss` | Dismiss: keep existing, ignore new |

---

## Migration Strategy

### Phase 1: Schema (Non-Breaking)
1. Create new tables (`diagnosis_history`, `staging_snapshots`, `data_conflicts`)
2. Add new columns to `diagnosis` table
3. Deploy — existing code continues to work

### Phase 2: Processing Logic
1. Update `syncDiagnosisFromExtraction` with additive logic
2. Update `syncStagingFromExtraction` to create snapshots
3. Add conflict detection
4. Deploy

### Phase 3: API Updates
1. Update GET `/diagnosis` response format
2. Update GET `/staging` response format
3. Add conflict resolution endpoints
4. Deploy

### Phase 4: Backfill (Optional)
1. Reprocess existing documents to populate history
2. Generate staging snapshots from existing data

---

## Open Questions

1. **Conflict resolution UI**: How should conflicts be surfaced in the frontend?
   - Banner/alert on patient dashboard?
   - Dedicated "Review" section?
   - Inline on each field?

2. **Auto-resolution rules**: Should some conflicts auto-resolve?
   - Example: If new document is more recent and from same institution, prefer it?
   - Example: If values differ by <5%, consider them the same?

3. **Staging snapshot triggers**: What events create a new staging snapshot?
   - Any imaging document?
   - Only specific document types (CT, PET, MRI)?
   - Manual trigger only?

4. **Version history depth**: How much history to keep?
   - All changes forever?
   - Last N changes?
   - Changes within last Y months?

5. **Breaking change handling**: The new GET `/diagnosis` response structure is different.
   - Add a `?format=v2` query param?
   - Version the API (`/api/v2/`)?
   - Just update and coordinate with frontend?

---

## Next Steps

- [ ] Review this document and answer open questions
- [ ] Finalize schema design
- [ ] Create migration files
- [ ] Implement processing logic changes
- [ ] Update API endpoints
- [ ] Update frontend to handle new response format
- [ ] Test with real documents
- [ ] Deploy to staging

