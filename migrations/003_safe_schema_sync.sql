-- Safe schema sync for production
-- Creates missing tables/indexes with IF NOT EXISTS guards so it can run on live DBs

-- Ensure documents has vectorization columns (ignore error if they already exist)
ALTER TABLE documents ADD COLUMN vectorize_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN vectorized_at INTEGER;

-- Core new tables from refactor
CREATE TABLE IF NOT EXISTS document_vectors (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    vector_id TEXT NOT NULL,
    page_number INTEGER,
    section_title TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diagnosis (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    primary_cancer_type TEXT,
    primary_cancer_subtype TEXT,
    icd_code TEXT,
    diagnosis_date TEXT,
    tumor_location TEXT,
    tumor_laterality TEXT,
    tumor_size_cm REAL,
    tumor_grade TEXT,
    histology TEXT,
    biomarkers TEXT,
    genetic_mutations TEXT,
    metastatic_sites TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staging (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    diagnosis_id TEXT,
    clinical_t TEXT,
    clinical_n TEXT,
    clinical_m TEXT,
    pathological_t TEXT,
    pathological_n TEXT,
    pathological_m TEXT,
    clinical_stage TEXT,
    pathological_stage TEXT,
    staging_system TEXT,
    staging_date TEXT,
    restaging_reason TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (diagnosis_id) REFERENCES diagnosis(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS treatment (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    regimen_name TEXT,
    treatment_intent TEXT,
    treatment_line TEXT,
    protocol TEXT,
    drugs TEXT,
    start_date TEXT,
    planned_end_date TEXT,
    actual_end_date TEXT,
    total_planned_cycles INTEGER,
    treatment_status TEXT,
    discontinuation_reason TEXT,
    best_response TEXT,
    response_date TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS treatment_cycles (
    id TEXT PRIMARY KEY,
    treatment_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    cycle_number INTEGER NOT NULL,
    planned_date TEXT,
    actual_date TEXT,
    drugs_administered TEXT,
    pre_treatment_vitals TEXT,
    post_treatment_vitals TEXT,
    adverse_events TEXT,
    ctcae_grade INTEGER,
    dose_reduced BOOLEAN DEFAULT FALSE,
    dose_reduction_reason TEXT,
    dose_percentage REAL DEFAULT 100.0,
    cycle_status TEXT,
    delay_reason TEXT,
    notes TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (treatment_id) REFERENCES treatment(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    medication_name TEXT NOT NULL,
    generic_name TEXT,
    drug_class TEXT,
    dose REAL,
    dose_unit TEXT,
    frequency TEXT,
    route TEXT,
    start_date TEXT,
    end_date TEXT,
    medication_status TEXT,
    discontinuation_reason TEXT,
    indication TEXT,
    medication_type TEXT,
    treatment_context TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT,
    title TEXT NOT NULL,
    description TEXT,
    alert_category TEXT,
    affected_system TEXT,
    actionable BOOLEAN DEFAULT FALSE,
    recommended_action TEXT,
    alert_status TEXT DEFAULT 'active',
    acknowledged_by TEXT,
    acknowledged_at INTEGER,
    resolved_at INTEGER,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_results (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    test_name TEXT NOT NULL,
    test_category TEXT,
    result_value REAL,
    result_text TEXT,
    result_unit TEXT,
    reference_min REAL,
    reference_max REAL,
    is_abnormal BOOLEAN DEFAULT FALSE,
    abnormality_flag TEXT,
    test_date TEXT NOT NULL,
    specimen_type TEXT,
    lab_name TEXT,
    source_document_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tumor_markers (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    marker_name TEXT NOT NULL,
    marker_value REAL NOT NULL,
    marker_unit TEXT,
    reference_max REAL,
    is_elevated BOOLEAN DEFAULT FALSE,
    test_date TEXT NOT NULL,
    trend TEXT,
    source_document_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medical_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    icd_code TEXT,
    diagnosis_date TEXT,
    is_current BOOLEAN DEFAULT TRUE,
    resolution_date TEXT,
    severity TEXT,
    treatment_received TEXT,
    notes TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS surgical_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    procedure_name TEXT NOT NULL,
    procedure_code TEXT,
    surgery_date TEXT NOT NULL,
    surgeon TEXT,
    hospital TEXT,
    indication TEXT,
    complications TEXT,
    outcome TEXT,
    notes TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS family_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    relationship TEXT NOT NULL,
    condition TEXT NOT NULL,
    icd_code TEXT,
    age_at_diagnosis INTEGER,
    is_alive BOOLEAN,
    age_at_death INTEGER,
    cause_of_death TEXT,
    notes TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS social_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    tobacco_use TEXT,
    tobacco_type TEXT,
    tobacco_packs_per_day REAL,
    tobacco_years INTEGER,
    tobacco_quit_date TEXT,
    alcohol_use TEXT,
    alcohol_drinks_per_week INTEGER,
    recreational_drug_use TEXT,
    occupation TEXT,
    occupational_exposures TEXT,
    exercise_frequency TEXT,
    diet_description TEXT,
    living_situation TEXT,
    support_system TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_status (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    assessment_date TEXT NOT NULL,
    ecog_score INTEGER,
    ecog_description TEXT,
    karnofsky_score INTEGER,
    functional_status TEXT,
    activities_of_daily_living TEXT,
    notes TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clinical_decisions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    decision_type TEXT,
    decision_date TEXT NOT NULL,
    clinical_question TEXT NOT NULL,
    background TEXT,
    mdt_discussion BOOLEAN DEFAULT FALSE,
    mdt_date TEXT,
    participants TEXT,
    decision_made TEXT NOT NULL,
    rationale TEXT,
    alternatives_considered TEXT,
    implementation_status TEXT,
    implemented_date TEXT,
    outcome TEXT,
    outcome_date TEXT,
    data_sources TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS data_versions (
    id TEXT PRIMARY KEY,
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    edited_by TEXT NOT NULL,
    edited_at INTEGER NOT NULL,
    edit_reason TEXT,
    original_source TEXT,
    override_source TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Indexes (guarded)
CREATE INDEX IF NOT EXISTS idx_documents_vectorize ON documents(vectorize_status);
CREATE INDEX IF NOT EXISTS idx_diagnosis_patient ON diagnosis(patient_id);
CREATE INDEX IF NOT EXISTS idx_staging_patient ON staging(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_patient ON treatment(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_status ON treatment(treatment_status);
CREATE INDEX IF NOT EXISTS idx_cycles_treatment ON treatment_cycles(treatment_id);
CREATE INDEX IF NOT EXISTS idx_cycles_patient ON treatment_cycles(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(medication_status);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(alert_status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_labs_patient ON lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_labs_test ON lab_results(test_name);
CREATE INDEX IF NOT EXISTS idx_labs_date ON lab_results(test_date);
CREATE INDEX IF NOT EXISTS idx_markers_patient ON tumor_markers(patient_id);
CREATE INDEX IF NOT EXISTS idx_markers_name ON tumor_markers(marker_name);
CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON medical_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgical_history_patient ON surgical_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_family_history_patient ON family_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_social_history_patient ON social_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_performance_patient ON performance_status(patient_id);
CREATE INDEX IF NOT EXISTS idx_decisions_patient ON clinical_decisions(patient_id);
CREATE INDEX IF NOT EXISTS idx_versions_patient ON data_versions(patient_id);
CREATE INDEX IF NOT EXISTS idx_versions_record ON data_versions(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_versions_field ON data_versions(field_name);
