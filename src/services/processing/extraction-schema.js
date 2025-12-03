/**
 * Comprehensive Medical Document Extraction Schema
 *
 * Defines the strict structure for AI model extraction.
 * Based on API endpoints defined in refactored_api_endpoints.md
 */

import { z } from 'zod';

// Zod runtime validation schemas
export const PatientDemographicsSchema = z.object({
  name: z.string().nullish(),
  age: z.number().nullish(),
  age_unit: z.enum(["years", "months", "days"]).nullish(),
  sex: z.enum(["male", "female", "other", "unknown"]).nullish(),
  dob: z.string().nullish(),
  mrn: z.string().nullish(),
  patient_id_uhid: z.string().nullish(),
  patient_id_ipd: z.string().nullish(),
  admission_date: z.string().nullish(),
  discharge_date: z.string().nullish(),
  blood_type: z.string().nullish(),
  height_cm: z.number().nullish(),
  weight_kg: z.number().nullish(),
  bsa: z.number().nullish(),
  ecog_status: z.number().nullish(),
  language_preference: z.string().nullish(),
  primary_oncologist: z.string().nullish(),
  primary_center: z.string().nullish()
}).passthrough();

export const DiagnosisSchema = z.object({
  cancer_type: z.string().nullish(),
  primary_cancer_type: z.string().nullish(), // Allow both field names
  cancer_site_primary: z.string().nullish(),
  cancer_site_subsite: z.string().nullish(),
  histology: z.string().nullish(),
  histology_code: z.string().nullish(),
  differentiation_grade: z.string().nullish(),
  grade: z.string().nullish(), // Allow both field names
  tumor_grade: z.string().nullish(),
  metastasis_status: z.string().nullish(),
  metastatic_sites: z.array(z.string()).nullish(),
  diagnosis_date: z.string().nullish(),
  location: z.string().nullish(), // Allow both field names
  tumor_location: z.string().nullish(),
  laterality: z.string().nullish(),
  tumor_laterality: z.string().nullish(),
  tumor_size_cm: z.number().nullish(),
  her2_status: z.string().nullish(),
  her2_score: z.string().nullish(),
  msi_status: z.string().nullish(),
  mmr_status: z.string().nullish(),
  pdl1_status: z.string().nullish(),
  pdl1_tps_percent: z.number().nullish(),
  lauren_classification: z.string().nullish(),
  biomarkers: z.any().nullish(),
  genetic_mutations: z.any().nullish(),
  icd_code: z.string().nullish()
}).passthrough();

export const TreatmentSchema = z.object({
  treatment_intent: z.enum(["curative", "palliative", "neoadjuvant", "adjuvant", "maintenance"]).nullish(),
  treatment_line: z.string().nullish(),
  regimen_name: z.string().nullish(),
  protocol: z.string().nullish(),
  drugs: z.union([z.array(z.string()), z.string()]).nullish(), // Allow array or string
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  planned_end_date: z.string().nullish(),
  cycle_number: z.number().nullish(),
  cycles_completed: z.number().nullish(),
  cycles_planned: z.number().nullish(),
  cycle_interval_days: z.number().nullish(),
  treatment_status: z.enum(["active", "completed", "discontinued", "on_hold"]).nullish(),
  best_response: z.string().nullish(),
  response_date: z.string().nullish(),
  response_assessment_method: z.string().nullish()
}).passthrough();

export const MedicationSchema = z.object({
  generic_name: z.string().nullish(),
  brand_name: z.string().nullish(),
  dose_value: z.number().nullish(),
  dose: z.string().nullish(), // Allow string dose
  dose_unit: z.string().nullish(),
  frequency: z.string().nullish(),
  route: z.enum(["oral", "iv", "im", "sc", "topical", "other"]).nullish(),
  indication: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  status: z.enum(["active", "discontinued", "completed"]).nullish(),
  prescriber: z.string().nullish(),
  category: z.string().nullish()
}).passthrough();

export const MedicalExtractionSchema = z.object({
  patient_demographics: PatientDemographicsSchema.nullish(),
  diagnosis: DiagnosisSchema.nullish(),
  primary_diagnosis: DiagnosisSchema.nullish(), // Allow both field names
  staging: z.any().nullish(),
  treatment: TreatmentSchema.nullish(),
  treatment_cycle: z.any().nullish(),
  medications: z.array(MedicationSchema).nullish(),
  alerts: z.array(z.any()).nullish(),
  labs: z.any().nullish(),
  tumor_markers: z.any().nullish(),
  medical_history: z.any().nullish(),
  surgical_history: z.any().nullish(),
  family_history: z.any().nullish(),
  social_history: z.any().nullish(),
  timeline_events: z.array(z.any()).nullish(),
  hospitalizations: z.array(z.any()).nullish(),
  clinical_decisions: z.any().nullish(),
  imaging: z.any().nullish(),
  pathology: z.any().nullish(),
  document_info: z.any().nullish(),
  document_date: z.string().nullish(), // Allow top-level document_date
  patient_name: z.string().nullish(), // Allow top-level patient_name
  name: z.string().nullish() // Allow top-level name
}).passthrough(); // Allow additional fields

/**
 * Validate and normalize extracted data
 * Returns validated data or throws detailed error
 */
export function validateExtractedData(data) {
  try {
    const validated = MedicalExtractionSchema.parse(data);
    console.log('✅ Schema validation passed');
    return validated;
  } catch (error) {
    console.error('❌ Schema validation failed:', error.errors);
    throw new Error(`Schema validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
  }
}

// JSON Schema for OpenAI Structured Outputs (unchanged)
export const MEDICAL_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    // Patient Demographics
    patient_demographics: {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        age_unit: { type: "string", enum: ["years", "months"] },
        sex: { type: "string", enum: ["male", "female", "other", "unknown"] },
        dob: { type: "string" }, // YYYY-MM-DD
        mrn: { type: "string" },
        patient_id_uhid: { type: "string" },
        patient_id_ipd: { type: "string" },
        admission_date: { type: "string" },
        discharge_date: { type: "string" },
        blood_type: { type: "string" },
        height_cm: { type: "number" },
        weight_kg: { type: "number" },
        bsa: { type: "number" },
        ecog_status: { type: "number" },
        language_preference: { type: "string" },
        primary_oncologist: { type: "string" },
        primary_center: { type: "string" }
      }
    },

    // Primary Diagnosis
    diagnosis: {
      type: "object",
      properties: {
        cancer_type: { type: "string" },
        cancer_site_primary: { type: "string" },
        cancer_site_subsite: { type: "string" },
        histology: { type: "string" },
        histology_code: { type: "string" },
        differentiation_grade: { type: "string" },
        metastasis_status: { type: "string" },
        metastasis_sites: { type: "array", items: { type: "string" } },
        diagnosis_date: { type: "string" },
        her2_status: { type: "string" },
        her2_score: { type: "string" },
        msi_status: { type: "string" },
        mmr_status: { type: "string" },
        pdl1_status: { type: "string" },
        pdl1_tps_percent: { type: "number" },
        lauren_classification: { type: "string" }
      }
    },

    // Staging Information
    staging: {
      type: "object",
      properties: {
        staging_system: { type: "string" },
        staging_type: { type: "string", enum: ["clinical", "pathological", "restaging"] },
        staging_date: { type: "string" },
        tnm_clinical: {
          type: "object",
          properties: {
            t: { type: "string" },
            n: { type: "string" },
            m: { type: "string" },
            stage: { type: "string" }
          }
        },
        tnm_pathological: {
          type: "object",
          properties: {
            t: { type: "string" },
            n: { type: "string" },
            m: { type: "string" },
            stage: { type: "string" }
          }
        },
        tumor_size_cm: { type: "number" },
        tumor_size_source: { type: "string" },
        lymph_nodes_involved_count: { type: "number" },
        lymph_nodes_examined_count: { type: "number" },
        lymph_node_stations: { type: "array", items: { type: "string" } },
        stage_narrative: { type: "string" }
      }
    },

    // Treatment Information
    treatment: {
      type: "object",
      properties: {
        treatment_intent: { type: "string", enum: ["curative", "palliative", "neoadjuvant", "adjuvant", "maintenance"] },
        treatment_line: { type: "string" },
        regimen_name: { type: "string" },
        protocol: { type: "string" },
        drugs: { type: "array", items: { type: "string" } },
        start_date: { type: "string" },
        end_date: { type: "string" },
        planned_end_date: { type: "string" },
        cycle_number: { type: "number" },
        cycles_completed: { type: "number" },
        cycles_planned: { type: "number" },
        cycle_interval_days: { type: "number" },
        treatment_status: { type: "string", enum: ["active", "completed", "discontinued", "on_hold"] },
        best_response: { type: "string" },
        response_date: { type: "string" },
        response_assessment_method: { type: "string" }
      }
    },

    // Cycle-specific treatment details
    treatment_cycle: {
      type: "object",
      properties: {
        cycle_number: { type: "number" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        status: { type: "string" },
        hospitalization_days: { type: "number" },
        doses: {
          type: "object",
          additionalProperties: { type: "number" }
        },
        dose_intensity_percent: { type: "number" },
        delays_days: { type: "number" },
        delay_reason: { type: "string" },
        modifications: { type: "array", items: { type: "string" } },
        toxicities: { type: "array", items: { type: "object" } },
        pre_chemo_weight_kg: { type: "number" }
      }
    },

    // Medications (Supportive/Concurrent)
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          generic_name: { type: "string" },
          brand_name: { type: "string" },
          dose_value: { type: "number" },
          dose_unit: { type: "string" },
          frequency: { type: "string" },
          route: { type: "string", enum: ["oral", "iv", "im", "sc", "topical", "other"] },
          indication: { type: "string" },
          start_date: { type: "string" },
          end_date: { type: "string" },
          status: { type: "string", enum: ["active", "discontinued", "completed"] },
          prescriber: { type: "string" },
          category: { type: "string" }
        }
      }
    },

    // Clinical Alerts
    alerts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["neurological", "infection", "nutrition", "treatment", "lab", "allergy", "cardiac", "other"] },
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          status: { type: "string" },
          onset_date: { type: "string" },
          description: { type: "string" },
          action_required: { type: "string" }
        }
      }
    },

    // Laboratory Results
    labs: {
      type: "object",
      properties: {
        collection_date: { type: "string" },
        hemoglobin: { type: "number" },
        wbc: { type: "number" },
        anc: { type: "number" },
        platelets: { type: "number" },
        creatinine: { type: "number" },
        egfr: { type: "number" },
        bilirubin_total: { type: "number" },
        alt: { type: "number" },
        ast: { type: "number" },
        albumin: { type: "number" },
        sodium: { type: "number" },
        potassium: { type: "number" }
      }
    },

    // Tumor Markers
    tumor_markers: {
      type: "object",
      properties: {
        date: { type: "string" },
        cea: { type: "number" },
        ca199: { type: "number" },
        ca125: { type: "number" },
        afp: { type: "number" },
        psa: { type: "number" }
      }
    },

    // Medical History
    medical_history: {
      type: "object",
      properties: {
        comorbidities: { type: "array", items: { type: "string" } },
        comorbidities_summary: { type: "string" },
        charlson_comorbidity_index: { type: "number" },
        functional_baseline: { type: "string" },
        hepatitis_b_status: { type: "string" },
        hepatitis_c_status: { type: "string" },
        hiv_status: { type: "string" },
        tb_history: { type: "boolean" },
        prior_malignancies: { type: "array", items: { type: "string" } },
        prior_radiation: { type: "boolean" },
        cardiac_history_detail: { type: "string" },
        cardiac_ef_baseline: { type: "number" },
        pulmonary_history: { type: "string" }
      }
    },

    // Surgical History
    surgical_history: {
      type: "array",
      items: {
        type: "object",
        properties: {
          procedure: { type: "string" },
          year: { type: "number" },
          date: { type: "string" },
          details: { type: "string" },
          complications: { type: "string" }
        }
      }
    },

    // Family History
    family_history: {
      type: "array",
      items: {
        type: "object",
        properties: {
          relationship: { type: "string" },
          condition: { type: "string" },
          age_at_diagnosis: { type: "number" },
          relevance: { type: "string" }
        }
      }
    },

    // Social History
    social_history: {
      type: "object",
      properties: {
        alcohol: { type: "string", enum: ["never", "former", "current", "unknown"] },
        smoking: { type: "string", enum: ["never", "former", "current", "unknown"] },
        tobacco: { type: "string", enum: ["never", "former", "current", "unknown"] },
        occupational_exposures: { type: "array", items: { type: "string" } },
        diet: { type: "string" },
        exercise: { type: "string" }
      }
    },

    // Timeline Events
    timeline_events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          date_precision: { type: "string", enum: ["day", "month", "year"] },
          category: { type: "string", enum: ["diagnosis", "imaging", "treatment", "complication", "hospitalization", "procedure", "consultation"] },
          title: { type: "string" },
          description: { type: "string" },
          significance: { type: "string", enum: ["diagnostic", "key_milestone", "complication", "routine"] }
        }
      }
    },

    // Hospitalizations
    hospitalizations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          admission_date: { type: "string" },
          discharge_date: { type: "string" },
          los_days: { type: "number" },
          diagnosis: { type: "string" },
          complications: { type: "array", items: { type: "string" } },
          procedures: { type: "array", items: { type: "string" } }
        }
      }
    },

    // Clinical Decisions
    clinical_decisions: {
      type: "object",
      properties: {
        primary_clinical_question: { type: "string" },
        surgical_considerations: { type: "array", items: { type: "string" } },
        perioperative_risks: { type: "array", items: { type: "string" } },
        action_items: { type: "array", items: { type: "string" } },
        alternative_management_options: { type: "array", items: { type: "string" } },
        family_goals: { type: "string" }
      }
    },

    // Imaging Findings
    imaging: {
      type: "object",
      properties: {
        study_type: { type: "string" },
        study_date: { type: "string" },
        contrast: { type: "string" },
        findings: { type: "array", items: { type: "string" } },
        impression: { type: "string" },
        comparison: { type: "string" },
        recommendations: { type: "array", items: { type: "string" } }
      }
    },

    // Pathology Details
    pathology: {
      type: "object",
      properties: {
        specimen_type: { type: "string" },
        specimen_site: { type: "string" },
        collection_date: { type: "string" },
        gross_description: { type: "string" },
        microscopic_description: { type: "string" },
        diagnosis: { type: "string" },
        grade: { type: "string" },
        margin_status: { type: "string" },
        lymphovascular_invasion: { type: "string" },
        perineural_invasion: { type: "string" },
        immunohistochemistry: { type: "object" },
        molecular_testing: { type: "object" }
      }
    },

    // Document metadata
    document_info: {
      type: "object",
      properties: {
        document_type: { 
          type: "string", 
          enum: [
            "pathology", 
            "radiology", 
            "scan_report", 
            "discharge_summary", 
            "consultation", 
            "lab_report", 
            "prescription",
            "doctor_notes",
            "gp_notes",
            "transcript",
            "operative_note", 
            "progress_note", 
            "other"
          ] 
        },
        document_date: { type: "string" },
        facility: { type: "string" },
        provider: { type: "string" },
        department: { type: "string" }
      }
    }
  }
};

/**
 * Generate extraction prompt with schema enforcement
 * Now includes document-type-specific instructions
 */
export function generateExtractionPrompt(documentType = 'default') {
  const normalizedType = (documentType || '').toLowerCase().replace(/[_\s-]/g, '_');
  
  // Document-type-specific instructions
  const typeSpecificInstructions = getDocumentTypeInstructions(normalizedType);
  
  return `You are a medical data extraction AI. Extract ALL relevant clinical information from this medical document.

DOCUMENT TYPE: ${documentType || 'unknown'}

${typeSpecificInstructions}

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanatory text
2. Follow the exact schema structure provided
3. Use null for missing fields, never omit fields
4. Extract dates in YYYY-MM-DD format when possible
5. Extract numerical values as numbers, not strings
6. Be comprehensive - extract all available information

Return a JSON object with these top-level keys (use only keys that apply to this document):
- patient_demographics
- diagnosis
- staging
- treatment
- treatment_cycle
- medications
- alerts
- labs
- tumor_markers
- medical_history
- surgical_history
- family_history
- social_history
- timeline_events
- hospitalizations
- clinical_decisions
- imaging
- pathology
- document_info

Example structure:
{
  "patient_demographics": {
    "name": "John Doe",
    "age": 65,
    "sex": "male",
    "mrn": "12345"
  },
  "diagnosis": {
    "cancer_type": "Adenocarcinoma",
    "cancer_site_primary": "Stomach"
  },
  "treatment": {
    "regimen_name": "FOLFOX-6",
    "drugs": ["5-Fluorouracil", "Leucovorin", "Oxaliplatin"],
    "start_date": "2025-10-03"
  },
  "medications": [
    {
      "generic_name": "Pantoprazole",
      "dose_value": 40,
      "dose_unit": "mg",
      "frequency": "once daily",
      "route": "oral"
    }
  ],
  "document_info": {
    "document_type": "${documentType}",
    "document_date": "2025-11-21"
  }
}

Extract all relevant information from the document now:`;
}

/**
 * Get document-type-specific extraction instructions
 */
function getDocumentTypeInstructions(documentType) {
  const instructions = {
    'discharge_summary': `SPECIFIC INSTRUCTIONS FOR DISCHARGE SUMMARY:
- Extract admission and discharge dates, length of stay
- Extract primary diagnosis and secondary diagnoses
- Extract procedures performed during hospitalization
- Extract medications prescribed at discharge (include in medications array)
- Extract discharge instructions and follow-up recommendations
- Extract complications that occurred during stay
- Extract vital signs and key lab values at discharge
- Extract treatment received during hospitalization
- Pay special attention to clinical_decisions section for discharge planning
- Extract any alerts or warnings for post-discharge care`,

    'lab_report': `SPECIFIC INSTRUCTIONS FOR LAB REPORT:
- Extract ALL laboratory values with units and reference ranges if available
- Extract collection date and time
- Extract test names exactly as written
- Pay special attention to abnormal values (flag in alerts if critical)
- Extract CBC values: hemoglobin, WBC, ANC, platelets
- Extract chemistry values: creatinine, eGFR, bilirubin, ALT, AST, albumin, sodium, potassium
- Extract tumor markers if present: CEA, CA19-9, CA125, AFP, PSA
- Extract microbiology results if present
- Extract any comments or notes from the lab
- If values are flagged as abnormal or critical, create alerts`,

    'scan_report': `SPECIFIC INSTRUCTIONS FOR SCAN/IMAGING REPORT (RADIOLOGY):
- Extract study type (CT, MRI, PET, X-ray, ultrasound, etc.)
- Extract study date and contrast used
- Extract all findings in detail (location, size, characteristics)
- Extract impression/conclusion section
- Extract comparison to prior studies if mentioned
- Extract recommendations for follow-up imaging
- Pay attention to measurements (tumor size, lymph nodes, etc.)
- Extract any mention of staging information (TNM)
- Extract any suspicious or concerning findings (create alerts if urgent)
- Extract specific anatomical locations mentioned`,

    'radiology': `SPECIFIC INSTRUCTIONS FOR RADIOLOGY REPORT:
- Extract study type (CT, MRI, PET, X-ray, ultrasound, etc.)
- Extract study date and contrast used
- Extract all findings in detail (location, size, characteristics)
- Extract impression/conclusion section
- Extract comparison to prior studies if mentioned
- Extract recommendations for follow-up imaging
- Pay attention to measurements (tumor size, lymph nodes, etc.)
- Extract any mention of staging information (TNM)
- Extract any suspicious or concerning findings (create alerts if urgent)
- Extract specific anatomical locations mentioned`,

    'prescription': `SPECIFIC INSTRUCTIONS FOR PRESCRIPTION:
- Extract ALL medications with complete dosing information
- Extract generic name and brand name if available
- Extract dose value, unit, frequency, and route
- Extract start date and duration if mentioned
- Extract prescriber name and specialty
- Extract indication/reason for each medication
- Extract any special instructions (take with food, avoid alcohol, etc.)
- Extract refill information if present
- Pay attention to medication categories (chemotherapy, supportive care, etc.)
- Extract any warnings or contraindications mentioned`,

    'doctor_notes': `SPECIFIC INSTRUCTIONS FOR DOCTOR NOTES:
- Extract clinical assessment and plan
- Extract any clinical decisions made during the visit
- Extract medications prescribed or changed
- Extract vital signs and physical exam findings
- Extract any concerns or alerts raised
- Extract follow-up plans and action items
- Extract any changes to treatment plan
- Extract patient status updates
- Extract any diagnostic considerations or differential diagnoses
- Pay attention to timeline_events for important dates mentioned`,

    'gp_notes': `SPECIFIC INSTRUCTIONS FOR GP NOTES:
- Extract chief complaint and presenting symptoms
- Extract clinical assessment
- Extract medications prescribed or changed
- Extract referrals made to specialists
- Extract follow-up recommendations
- Extract any concerns that need specialist attention
- Extract preventive care recommendations
- Extract any alerts or red flags mentioned
- Extract patient status and functional assessment
- Pay attention to social history and lifestyle factors`,

    'transcript': `SPECIFIC INSTRUCTIONS FOR TRANSCRIPT (DOCTOR-PATIENT CONVERSATION):
- Identify speakers (Doctor vs Patient) when possible
- Extract clinical decisions made during the conversation
- Extract medications discussed, prescribed, or changed
- Extract patient concerns and symptoms reported
- Extract doctor's assessment and recommendations
- Extract follow-up actions and next steps
- Extract any clinical status updates mentioned
- Extract treatment plan changes discussed
- Extract any alerts or urgent concerns raised
- Extract timeline information (dates, appointments, etc.)
- Pay special attention to clinical_decisions section
- Extract any diagnostic considerations discussed
- Note: This is a conversation, so information may be scattered - be thorough in extraction`,

    'pathology': `SPECIFIC INSTRUCTIONS FOR PATHOLOGY REPORT:
- Extract specimen type and collection site
- Extract collection date
- Extract gross and microscopic descriptions
- Extract final diagnosis with full details
- Extract tumor grade and differentiation
- Extract margin status if surgical specimen
- Extract lymphovascular and perineural invasion status
- Extract all immunohistochemistry results
- Extract molecular testing results (HER2, MSI, MMR, PD-L1, etc.)
- Extract staging information if provided
- Extract any special notes or comments
- Pay attention to cancer type, site, and histology details`,

    'consultation': `SPECIFIC INSTRUCTIONS FOR CONSULTATION NOTES:
- Extract consultation reason and chief complaint
- Extract clinical assessment and impression
- Extract recommendations and treatment plan
- Extract medications prescribed or recommended
- Extract any procedures or tests recommended
- Extract follow-up plans
- Extract any clinical decisions made
- Extract specialist recommendations
- Extract any alerts or concerns raised
- Extract timeline for next steps`,

    'default': `SPECIFIC INSTRUCTIONS:
- Extract all available patient demographics
- Extract any diagnosis information
- Extract any treatment information
- Extract any medications mentioned
- Extract any lab values or test results
- Extract any clinical decisions or recommendations
- Extract timeline events and dates
- Extract any alerts or concerns
- Be comprehensive and extract all relevant clinical information`
  };

  // Handle variations and aliases
  const typeMap = {
    'discharge': 'discharge_summary',
    'discharge_summary': 'discharge_summary',
    'lab': 'lab_report',
    'lab_report': 'lab_report',
    'laboratory': 'lab_report',
    'scan': 'scan_report',
    'scan_report': 'scan_report',
    'imaging': 'radiology',
    'radiology': 'radiology',
    'prescription': 'prescription',
    'rx': 'prescription',
    'doctor_notes': 'doctor_notes',
    'doctor_note': 'doctor_notes',
    'clinical_notes': 'doctor_notes',
    'gp_notes': 'gp_notes',
    'gp_note': 'gp_notes',
    'general_practitioner': 'gp_notes',
    'transcript': 'transcript',
    'conversation': 'transcript',
    'pathology': 'pathology',
    'pathology_report': 'pathology',
    'consultation': 'consultation',
    'consultation_note': 'consultation'
  };

  // Normalize the documentType parameter
  const normalizedType = (documentType || '').toLowerCase().replace(/[_\s-]/g, '_');
  const mappedType = typeMap[normalizedType] || normalizedType;
  return instructions[mappedType] || instructions['default'];
}
