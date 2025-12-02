-- Saarthi Clinical Database Schema (Refactored)
-- Version 2.0 - Complete rewrite with field-level source tracking and version history

-- ============================================================================
-- CORE PATIENT RECORD
-- ============================================================================

CREATE TABLE patients (
    id TEXT PRIMARY KEY,

    -- External IDs
    booking_patient_id TEXT,
    external_mrn TEXT,
    patient_id_uhid TEXT,
    patient_id_ipd TEXT,

    -- Demographics
    name TEXT NOT NULL,
    age INTEGER,
    age_unit TEXT DEFAULT 'years', -- years, months, days
    sex TEXT,
    dob TEXT,
    date_of_birth TEXT, -- keeping for backward compatibility
    gender TEXT, -- keeping for backward compatibility

    -- Physical attributes
    blood_type TEXT,
    height_cm REAL,
    weight_kg REAL,
    bsa REAL, -- Body Surface Area

    -- Clinical status
    ecog_status INTEGER, -- 0-5
    current_status TEXT, -- active, in_treatment, follow_up, deceased, etc.
    current_status_detail TEXT,

    -- Care team
    primary_oncologist TEXT,
    primary_center TEXT,

    -- Preferences
    language_preference TEXT,
    allergy_status TEXT, -- none, documented, unknown

    -- Caregiver
    caregiver_name TEXT,
    caregiver_relation TEXT,
    caregiver_contact TEXT,

    -- Status
    status TEXT DEFAULT 'active', -- active, archived, deleted
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- ============================================================================
-- DOCUMENTS (MERGED CASE-PACK FUNCTIONALITY)
-- ============================================================================

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    -- File metadata
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    storage_key TEXT NOT NULL,

    -- Document classification
    document_type TEXT NOT NULL, -- DEPRECATED, use category instead
    document_subtype TEXT, -- DEPRECATED, use subcategory instead
    category TEXT, -- pathology, radiology, lab, clinical_notes, etc.
    subcategory TEXT, -- biopsy, ct_scan, mri, blood_test, etc.
    title TEXT,
    document_date TEXT,

    -- Case pack integration (merged functionality)
    case_pack_order INTEGER, -- order in case pack, NULL if not in case pack

    -- Processing status
    processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    processing_started_at INTEGER,
    processing_completed_at INTEGER,
    processing_error TEXT,

    -- Vectorization status
    vectorize_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    vectorized_at INTEGER,

    -- Review status
    reviewed_status TEXT DEFAULT 'pending', -- pending, reviewed, flagged
    reviewed_by TEXT,
    reviewed_date INTEGER,

    -- AI processing metadata
    gemini_model TEXT,
    tokens_used INTEGER,
    thought_signature TEXT,
    extraction_confidence REAL,

    -- Extracted content
    extracted_text TEXT,
    extracted_data TEXT, -- JSON
    medical_highlight TEXT,
    critical_findings TEXT, -- JSON array
    summary TEXT,

    created_at INTEGER,
    updated_at INTEGER,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- DOCUMENT VECTORS (METADATA ONLY - ACTUAL VECTORS IN VECTORIZE)
-- ============================================================================

CREATE TABLE document_vectors (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,

    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,

    -- Vector metadata (actual vector stored in Cloudflare Vectorize)
    vector_id TEXT NOT NULL, -- ID in Vectorize index

    -- Context for RAG
    page_number INTEGER,
    section_title TEXT,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- DIAGNOSIS
-- ============================================================================

CREATE TABLE diagnosis (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    -- Cancer diagnosis
    primary_cancer_type TEXT,
    primary_cancer_subtype TEXT,
    icd_code TEXT,
    diagnosis_date TEXT,

    -- Tumor characteristics
    tumor_location TEXT,
    tumor_laterality TEXT, -- left, right, bilateral, midline
    tumor_size_cm REAL,
    tumor_grade TEXT, -- G1, G2, G3, G4
    histology TEXT,

    -- Molecular markers
    biomarkers TEXT, -- JSON: {marker: value, source: doc_id}
    genetic_mutations TEXT, -- JSON array

    -- Metastasis
    metastatic_sites TEXT, -- JSON array

    -- Field-level source tracking
    data_sources TEXT, -- JSON: {field_name: {value, source: doc_id|ai_inferred, timestamp}}

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- STAGING
-- ============================================================================

CREATE TABLE staging (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    diagnosis_id TEXT,

    -- TNM staging
    clinical_t TEXT, -- cT0-cT4
    clinical_n TEXT, -- cN0-cN3
    clinical_m TEXT, -- cM0-cM1
    pathological_t TEXT, -- pT0-pT4
    pathological_n TEXT, -- pN0-pN3
    pathological_m TEXT, -- pM0-pM1

    -- Overall stage
    clinical_stage TEXT, -- I, II, III, IV
    pathological_stage TEXT,

    -- Additional staging info
    staging_system TEXT, -- AJCC 8th, FIGO, etc.
    staging_date TEXT,
    restaging_reason TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (diagnosis_id) REFERENCES diagnosis(id) ON DELETE CASCADE
);

-- ============================================================================
-- TREATMENT
-- ============================================================================

CREATE TABLE treatment (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    -- Current treatment regimen
    regimen_name TEXT,
    treatment_intent TEXT, -- curative, palliative, adjuvant, neoadjuvant
    treatment_line TEXT, -- first-line, second-line, etc.

    -- Regimen details
    protocol TEXT,
    drugs TEXT, -- JSON array of drug names

    -- Schedule
    start_date TEXT,
    planned_end_date TEXT,
    actual_end_date TEXT,
    total_planned_cycles INTEGER,

    -- Status
    treatment_status TEXT, -- active, completed, discontinued, on-hold
    discontinuation_reason TEXT,

    -- Response
    best_response TEXT, -- CR, PR, SD, PD
    response_date TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- TREATMENT CYCLES
-- ============================================================================

CREATE TABLE treatment_cycles (
    id TEXT PRIMARY KEY,
    treatment_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,

    cycle_number INTEGER NOT NULL,

    -- Schedule
    planned_date TEXT,
    actual_date TEXT,

    -- Drugs administered
    drugs_administered TEXT, -- JSON array: [{drug, dose, unit, route}]

    -- Vital signs
    pre_treatment_vitals TEXT, -- JSON
    post_treatment_vitals TEXT, -- JSON

    -- Toxicity
    adverse_events TEXT, -- JSON array
    ctcae_grade INTEGER, -- 1-5

    -- Dose modifications
    dose_reduced BOOLEAN DEFAULT FALSE,
    dose_reduction_reason TEXT,
    dose_percentage REAL DEFAULT 100.0,

    -- Status
    cycle_status TEXT, -- completed, skipped, delayed, modified
    delay_reason TEXT,

    notes TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (treatment_id) REFERENCES treatment(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- MEDICATIONS
-- ============================================================================

CREATE TABLE medications (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    -- Drug info
    medication_name TEXT NOT NULL,
    generic_name TEXT,
    drug_class TEXT,

    -- Dosing
    dose REAL,
    dose_unit TEXT,
    frequency TEXT,
    route TEXT, -- oral, IV, subcutaneous, etc.

    -- Timing
    start_date TEXT,
    end_date TEXT,

    -- Status
    medication_status TEXT, -- active, discontinued, completed
    discontinuation_reason TEXT,

    -- Purpose
    indication TEXT,
    medication_type TEXT, -- chemotherapy, supportive, comorbidity

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- ALERTS
-- ============================================================================

CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    alert_type TEXT NOT NULL, -- clinical, risk_factor, drug_interaction, allergy
    severity TEXT, -- low, medium, high, critical

    title TEXT NOT NULL,
    description TEXT,

    -- Alert details
    alert_category TEXT, -- infection_risk, bleeding_risk, organ_dysfunction, etc.
    affected_system TEXT, -- cardiovascular, renal, hepatic, etc.

    -- Actionability
    actionable BOOLEAN DEFAULT FALSE,
    recommended_action TEXT,

    -- Status
    alert_status TEXT DEFAULT 'active', -- active, acknowledged, resolved, dismissed
    acknowledged_by TEXT,
    acknowledged_at INTEGER,
    resolved_at INTEGER,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- LAB RESULTS
-- ============================================================================

CREATE TABLE lab_results (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    test_name TEXT NOT NULL,
    test_category TEXT, -- hematology, chemistry, coagulation, etc.

    -- Result
    result_value REAL,
    result_text TEXT, -- for non-numeric results
    result_unit TEXT,

    -- Reference range
    reference_min REAL,
    reference_max REAL,
    is_abnormal BOOLEAN DEFAULT FALSE,
    abnormality_flag TEXT, -- high, low, critical_high, critical_low

    -- Test metadata
    test_date TEXT NOT NULL,
    specimen_type TEXT,
    lab_name TEXT,

    -- Field-level source tracking
    source_document_id TEXT,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL
);

-- ============================================================================
-- TUMOR MARKERS
-- ============================================================================

CREATE TABLE tumor_markers (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    marker_name TEXT NOT NULL, -- CEA, CA-125, PSA, AFP, etc.

    -- Result
    marker_value REAL NOT NULL,
    marker_unit TEXT,

    -- Reference
    reference_max REAL,
    is_elevated BOOLEAN DEFAULT FALSE,

    -- Trend
    test_date TEXT NOT NULL,
    trend TEXT, -- increasing, decreasing, stable

    -- Field-level source tracking
    source_document_id TEXT,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL
);

-- ============================================================================
-- MEDICAL HISTORY
-- ============================================================================

CREATE TABLE medical_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    condition TEXT NOT NULL,
    icd_code TEXT,

    -- Timing
    diagnosis_date TEXT,
    is_current BOOLEAN DEFAULT TRUE,
    resolution_date TEXT,

    -- Details
    severity TEXT,
    treatment_received TEXT,
    notes TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- SURGICAL HISTORY
-- ============================================================================

CREATE TABLE surgical_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    procedure_name TEXT NOT NULL,
    procedure_code TEXT,

    -- Timing
    surgery_date TEXT NOT NULL,

    -- Details
    surgeon TEXT,
    hospital TEXT,
    indication TEXT,

    -- Outcomes
    complications TEXT,
    outcome TEXT,
    notes TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- FAMILY HISTORY
-- ============================================================================

CREATE TABLE family_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    relationship TEXT NOT NULL, -- mother, father, sibling, etc.
    condition TEXT NOT NULL,

    -- Details
    age_at_diagnosis INTEGER,
    is_alive BOOLEAN,
    age_at_death INTEGER,
    cause_of_death TEXT,

    notes TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- SOCIAL HISTORY
-- ============================================================================

CREATE TABLE social_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    -- Tobacco
    tobacco_use TEXT, -- never, former, current
    tobacco_type TEXT, -- cigarettes, cigars, chewing, etc.
    tobacco_packs_per_day REAL,
    tobacco_years INTEGER,
    tobacco_quit_date TEXT,

    -- Alcohol
    alcohol_use TEXT, -- never, occasional, regular, heavy
    alcohol_drinks_per_week INTEGER,

    -- Other substances
    recreational_drug_use TEXT,

    -- Occupation
    occupation TEXT,
    occupational_exposures TEXT, -- JSON array

    -- Lifestyle
    exercise_frequency TEXT,
    diet_description TEXT,

    -- Support
    living_situation TEXT,
    support_system TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- PERFORMANCE STATUS
-- ============================================================================

CREATE TABLE performance_status (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    assessment_date TEXT NOT NULL,

    -- ECOG score
    ecog_score INTEGER, -- 0-5
    ecog_description TEXT,

    -- Karnofsky score
    karnofsky_score INTEGER, -- 0-100

    -- Clinical notes
    functional_status TEXT,
    activities_of_daily_living TEXT,
    notes TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- CLINICAL DECISIONS
-- ============================================================================

CREATE TABLE clinical_decisions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    -- Decision context
    decision_type TEXT, -- treatment_plan, diagnostic, follow_up, palliative
    decision_date TEXT NOT NULL,

    -- Question/Issue
    clinical_question TEXT NOT NULL,
    background TEXT,

    -- Discussion
    mdt_discussion BOOLEAN DEFAULT FALSE,
    mdt_date TEXT,
    participants TEXT, -- JSON array

    -- Decision
    decision_made TEXT NOT NULL,
    rationale TEXT,
    alternatives_considered TEXT,

    -- Implementation
    implementation_status TEXT, -- pending, in_progress, completed
    implemented_date TEXT,

    -- Outcome
    outcome TEXT,
    outcome_date TEXT,

    -- Field-level source tracking
    data_sources TEXT, -- JSON

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- VERSION HISTORY (FOR ALL EDITABLE FIELDS)
-- ============================================================================

CREATE TABLE data_versions (
    id TEXT PRIMARY KEY,

    -- Record identification
    record_type TEXT NOT NULL, -- patients, diagnosis, treatment, etc.
    record_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,

    -- Field change
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,

    -- Edit metadata
    edited_by TEXT NOT NULL, -- user ID
    edited_at INTEGER NOT NULL,
    edit_reason TEXT,

    -- Source tracking
    original_source TEXT, -- document_id or "ai_inferred" or "manual_entry"
    override_source TEXT, -- "manual_override" when admin edits

    created_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- CLINICAL SECTIONS (LEGACY - FOR BACKWARD COMPATIBILITY)
-- ============================================================================

CREATE TABLE clinical_sections (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    section_type TEXT NOT NULL, -- diagnosis_staging, imaging_findings, lab_results, etc.

    summary_content TEXT,
    detailed_content TEXT, -- JSON

    last_processed_at INTEGER,
    version INTEGER DEFAULT 1,

    created_at INTEGER,
    updated_at INTEGER,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- TIMELINE EVENTS (UPDATED)
-- ============================================================================

CREATE TABLE timeline_events (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_category TEXT,

    title TEXT NOT NULL,
    description TEXT,
    details TEXT, -- JSON

    -- Source tracking
    source_document_id TEXT,
    source_reference TEXT,

    -- Timeline visualization
    track TEXT,
    overlaps_with TEXT,

    confidence_score REAL,
    created_at INTEGER,
    updated_at INTEGER,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL
);

-- ============================================================================
-- PROCESSING AUDIT LOG
-- ============================================================================

CREATE TABLE processing_log (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    action TEXT NOT NULL,
    trigger_type TEXT,

    documents_processed TEXT,
    sections_updated TEXT,

    gemini_model TEXT,
    thinking_level TEXT,
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    changes_summary TEXT,
    thought_signature TEXT,

    status TEXT,
    error_details TEXT,

    created_at INTEGER,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- PATIENT ID MAPPING
-- ============================================================================

CREATE TABLE patient_id_mapping (
    clinical_patient_id TEXT PRIMARY KEY,
    booking_patient_id TEXT,
    external_mrn TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Patients
CREATE INDEX idx_patients_booking_id ON patients(booking_patient_id);
CREATE INDEX idx_patients_uhid ON patients(patient_id_uhid);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_oncologist ON patients(primary_oncologist);

-- Documents
CREATE INDEX idx_documents_patient ON documents(patient_id);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_reviewed ON documents(reviewed_status);
CREATE INDEX idx_documents_case_pack ON documents(case_pack_order);
CREATE INDEX idx_documents_vectorize ON documents(vectorize_status);

-- Document vectors
CREATE INDEX idx_vectors_document ON document_vectors(document_id);
CREATE INDEX idx_vectors_patient ON document_vectors(patient_id);

-- Diagnosis
CREATE INDEX idx_diagnosis_patient ON diagnosis(patient_id);

-- Staging
CREATE INDEX idx_staging_patient ON staging(patient_id);
CREATE INDEX idx_staging_diagnosis ON staging(diagnosis_id);

-- Treatment
CREATE INDEX idx_treatment_patient ON treatment(patient_id);
CREATE INDEX idx_treatment_status ON treatment(treatment_status);

-- Treatment cycles
CREATE INDEX idx_cycles_treatment ON treatment_cycles(treatment_id);
CREATE INDEX idx_cycles_patient ON treatment_cycles(patient_id);

-- Medications
CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_medications_status ON medications(medication_status);

-- Alerts
CREATE INDEX idx_alerts_patient ON alerts(patient_id);
CREATE INDEX idx_alerts_status ON alerts(alert_status);
CREATE INDEX idx_alerts_severity ON alerts(severity);

-- Lab results
CREATE INDEX idx_labs_patient ON lab_results(patient_id);
CREATE INDEX idx_labs_test ON lab_results(test_name);
CREATE INDEX idx_labs_date ON lab_results(test_date);

-- Tumor markers
CREATE INDEX idx_markers_patient ON tumor_markers(patient_id);
CREATE INDEX idx_markers_name ON tumor_markers(marker_name);

-- Medical history
CREATE INDEX idx_medical_history_patient ON medical_history(patient_id);

-- Surgical history
CREATE INDEX idx_surgical_history_patient ON surgical_history(patient_id);

-- Family history
CREATE INDEX idx_family_history_patient ON family_history(patient_id);

-- Social history
CREATE INDEX idx_social_history_patient ON social_history(patient_id);

-- Performance status
CREATE INDEX idx_performance_patient ON performance_status(patient_id);

-- Clinical decisions
CREATE INDEX idx_decisions_patient ON clinical_decisions(patient_id);
CREATE INDEX idx_decisions_mdt ON clinical_decisions(mdt_discussion);

-- Version history
CREATE INDEX idx_versions_patient ON data_versions(patient_id);
CREATE INDEX idx_versions_record ON data_versions(record_type, record_id);
CREATE INDEX idx_versions_field ON data_versions(field_name);

-- Clinical sections
CREATE INDEX idx_clinical_sections_patient ON clinical_sections(patient_id);
CREATE INDEX idx_clinical_sections_type ON clinical_sections(section_type);

-- Timeline
CREATE INDEX idx_timeline_patient ON timeline_events(patient_id);
CREATE INDEX idx_timeline_date ON timeline_events(event_date);
CREATE INDEX idx_timeline_type ON timeline_events(event_type);

-- Processing log
CREATE INDEX idx_processing_patient ON processing_log(patient_id);
