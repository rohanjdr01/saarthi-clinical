-- Core patient record
CREATE TABLE patients (
    id TEXT PRIMARY KEY,
    booking_patient_id TEXT,
    external_mrn TEXT,
    
    -- Demographics
    name TEXT NOT NULL,
    age INTEGER,
    date_of_birth TEXT,
    gender TEXT,
    
    -- Caregiver
    caregiver_name TEXT,
    caregiver_relation TEXT,
    caregiver_contact TEXT,
    
    -- Status
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Clinical sections (summary + detailed stored as JSON)
CREATE TABLE clinical_sections (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    section_type TEXT NOT NULL,
    
    summary_content TEXT,
    detailed_content TEXT,
    
    source_documents TEXT,
    confidence_score REAL,
    
    last_processed_at INTEGER,
    version INTEGER DEFAULT 1,
    
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Timeline events
CREATE TABLE timeline_events (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    
    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_category TEXT,
    
    title TEXT NOT NULL,
    description TEXT,
    details TEXT,
    
    source_document_id TEXT,
    source_reference TEXT,
    
    track TEXT,
    overlaps_with TEXT,
    
    confidence_score REAL,
    created_at INTEGER,
    
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Document registry
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    document_type TEXT NOT NULL,
    document_subtype TEXT,
    document_date TEXT,
    
    storage_key TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    
    processing_status TEXT DEFAULT 'pending',
    processing_started_at INTEGER,
    processing_completed_at INTEGER,
    processing_error TEXT,
    
    gemini_model TEXT,
    tokens_used INTEGER,
    thought_signature TEXT,
    extraction_confidence REAL,
    
    extracted_text TEXT,
    extracted_data TEXT,
    
    created_at INTEGER,
    updated_at INTEGER,
    
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Processing audit log
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
    
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Patient ID mapping (for integration with booking system)
CREATE TABLE patient_id_mapping (
    clinical_patient_id TEXT PRIMARY KEY,
    booking_patient_id TEXT,
    external_mrn TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

-- Indexes for common queries
CREATE INDEX idx_patients_booking_id ON patients(booking_patient_id);
CREATE INDEX idx_sections_patient ON clinical_sections(patient_id);
CREATE INDEX idx_sections_type ON clinical_sections(section_type);
CREATE INDEX idx_timeline_patient ON timeline_events(patient_id);
CREATE INDEX idx_timeline_date ON timeline_events(event_date);
CREATE INDEX idx_timeline_type ON timeline_events(event_type);
CREATE INDEX idx_documents_patient ON documents(patient_id);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_processing_patient ON processing_log(patient_id);
