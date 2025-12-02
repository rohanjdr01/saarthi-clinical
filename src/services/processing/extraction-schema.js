/**
 * Comprehensive Medical Document Extraction Schema
 *
 * Defines the strict structure for AI model extraction.
 * Based on API endpoints defined in refactored_api_endpoints.md
 */

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
        language_preference: { type: "string" }
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
        document_type: { type: "string", enum: ["pathology", "radiology", "discharge_summary", "consultation", "lab_report", "operative_note", "progress_note", "other"] },
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
 */
export function generateExtractionPrompt(documentType = 'default') {
  return `You are a medical data extraction AI. Extract ALL relevant clinical information from this medical document.

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
