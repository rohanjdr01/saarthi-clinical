# Saarthi Clinical Platform - Medical Data Overview
## For Clinical Review and Verification

---

## 1. PATIENT INFORMATION

### Basic Demographics
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Patient ID | Text | pt_abc123 | System-generated unique identifier |
| Patient Name | Text | John Doe | Full name |
| Age | Number | 65 | Age in years |
| Gender | Text | male, female, other | Patient gender |
| Status | Text | active, inactive, archived | Current patient status |

### Caregiver Information
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Caregiver Name | Text | Jane Doe | Primary caregiver name |
| Relationship | Text | daughter, spouse, son | Relationship to patient |
| Contact Number | Phone | +91-9999999999 | Emergency contact |

---

## 2. DIAGNOSIS INFORMATION

### Primary Diagnosis
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Primary Cancer Type | Text | Breast Cancer | Main cancer diagnosis |
| Cancer Subtype | Text | Invasive Ductal Carcinoma | Specific subtype |
| Diagnosis Date | Date | 2024-01-15 | Date of confirmed diagnosis |

### Tumor Characteristics
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Tumor Location | Text | Upper outer quadrant, left breast | Anatomical location |
| Laterality | Text | left, right, bilateral | Which side affected |
| Tumor Size | Number | 2.5 cm | Size in centimeters |
| Tumor Grade | Text | G1, G2, G3, G4 | Histological grade |
| Histology | Text | Ductal carcinoma | Tissue type |

### Biomarkers
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| ER Status | Text | positive, negative | Estrogen Receptor |
| PR Status | Text | positive, negative | Progesterone Receptor |
| HER2 Status | Text | positive, negative, equivocal | HER2/neu status |

---

## 3. STAGING INFORMATION

### Clinical Staging (TNM)
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Clinical T | Text | cT2 | Tumor size/extent |
| Clinical N | Text | cN1 | Lymph node involvement |
| Clinical M | Text | cM0 | Metastasis status |
| Clinical Stage | Text | IIA, IIB, IIIA | Overall clinical stage |

### Pathological Staging (TNM)
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Pathological T | Text | pT2 | Post-surgery tumor assessment |
| Pathological N | Text | pN1 | Post-surgery node assessment |
| Pathological M | Text | pM0 | Post-surgery metastasis status |
| Pathological Stage | Text | IIA, IIB, IIIA | Overall pathological stage |

### Staging Details
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Staging System | Text | AJCC 8th | Which staging system used |
| Staging Date | Date | 2024-01-20 | When staging was determined |

---

## 4. TREATMENT INFORMATION

### Treatment Plan Overview
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Regimen Name | Text | AC-T | Treatment protocol name |
| Treatment Intent | Text | adjuvant, neoadjuvant, curative | Purpose of treatment |
| Treatment Line | Text | first-line, second-line | Which line of therapy |
| Protocol Name | Text | AC-T Protocol | Full protocol name |
| Drug Names | List | Doxorubicin, Cyclophosphamide | All drugs in regimen |
| Start Date | Date | 2024-02-01 | Treatment start date |
| Planned Cycles | Number | 8 | Total cycles planned |
| Treatment Status | Text | active, completed, discontinued | Current status |

### Individual Treatment Cycles
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Cycle Number | Number | 1, 2, 3... | Which cycle |
| Planned Date | Date | 2024-02-01 | When cycle was scheduled |
| Actual Date | Date | 2024-02-01 | When cycle was administered |
| Cycle Status | Text | completed, delayed, cancelled | Status of this cycle |
| Dose Percentage | Number | 100%, 75%, 50% | % of full dose given |

### Drug Administration Details
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Drug Name | Text | Doxorubicin | Specific drug |
| Dose | Number | 60 | Dose amount |
| Unit | Text | mg/m2, mg, mcg | Dose unit |
| Route | Text | IV, PO, SC | How administered |

### Side Effects/Adverse Events
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Event Name | Text | Nausea, Neutropenia | Specific side effect |
| CTCAE Grade | Number | 1, 2, 3, 4, 5 | Severity grade (1=mild, 5=death) |

---

## 5. LABORATORY RESULTS

### Lab Test Information
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Test Name | Text | Hemoglobin, WBC Count | Name of lab test |
| Result Value | Number | 10.5, 7500 | Numeric result |
| Unit | Text | g/dL, cells/mcL | Unit of measurement |
| Test Date | Date | 2025-01-01 | When test was performed |
| Is Abnormal | Yes/No | Yes, No | Whether result is out of range |

---

## 6. MEDICATIONS

### Current Medications
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Medication Name | Text | Cisplatin, Lisinopril | Drug name |
| Dose | Number | 50 | Dose amount |
| Dose Unit | Text | mg, mcg | Dose measurement |
| Frequency | Text | q3w, daily, BID | How often given |
| Route | Text | IV, PO, SC | Administration route |
| Status | Text | active, discontinued, completed | Current status |
| Discontinuation Reason | Text | Completed regimen | Why stopped (if applicable) |

---

## 7. MEDICAL HISTORY

### Past Medical History
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Condition | Text | Hypertension, Diabetes | Previous condition |
| Diagnosis Date | Date | 2010-01-01 | When diagnosed |

### Surgical History
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Procedure Name | Text | Appendectomy, Lumpectomy | Surgery performed |
| Surgery Date | Date | 2015-05-05 | When performed |

### Family History
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Relationship | Text | mother, father, sister | Family member |
| Condition | Text | Breast cancer, Colon cancer | Condition in family |

### Social History
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Tobacco Use | Text | never, former, current | Smoking status |
| Alcohol Use | Text | never, occasional, regular | Drinking status |

---

## 8. CLINICAL ALERTS

### Alert Information
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Alert Type | Text | clinical, administrative | Category of alert |
| Severity | Text | high, medium, low | How urgent |
| Title | Text | Neutropenia risk | Brief description |
| Description | Text | ANC trending down | Detailed information |
| Status | Text | active, acknowledged, resolved | Current status |
| Acknowledged By | Text | Dr. Smith | Who reviewed the alert |

---

## 9. CLINICAL DECISIONS

### Decision Documentation
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Decision Type | Text | treatment_plan, diagnostic_test | Type of decision |
| Clinical Question | Text | Next line therapy? | Question being addressed |
| Decision Made | Text | Start AC-T regimen | The decision reached |
| Implementation Status | Text | planned, in_progress, completed | Status |

---

## 10. PATIENT DOCUMENTS

### Document Information
| Data Field | Type | Example | Notes |
|------------|------|---------|-------|
| Document ID | Text | doc_123 | System identifier |
| Filename | Text | pathology_report.pdf | Original file name |
| Document Type | Text | pathology, imaging, lab | Category |
| Processing Status | Text | pending, processing, completed | Upload status |
| Medical Highlight | Text | Biopsy confirms invasive ductal carcinoma | Key finding from document |
| Upload Date | Date/Time | 2024-01-15 10:30 AM | When uploaded |

---

## VERIFICATION CHECKLIST FOR DOCTORS

When reviewing this data structure, please verify:

- [ ] All essential medical data fields are included
- [ ] Field names are clear and unambiguous
- [ ] Example values represent realistic clinical scenarios
- [ ] No critical clinical information is missing
- [ ] Data types (text, number, date) make sense for each field
- [ ] Biomarker options cover all necessary values
- [ ] Staging information follows current standards (AJCC 8th edition)
- [ ] Treatment cycle tracking captures necessary details
- [ ] Side effect grading follows CTCAE standards
- [ ] Lab result tracking is sufficient for clinical monitoring
- [ ] Alert severity levels are appropriate
- [ ] Medical history sections are comprehensive

---

## QUESTIONS OR CONCERNS?

Please note any:
- Missing data fields that should be captured
- Unclear terminology that needs clarification
- Additional information needed for clinical decision-making
- Corrections to medical terminology or examples

---

**Document Purpose**: This document outlines all medical data that the Saarthi Clinical Platform captures and stores. It is designed for clinical review to ensure completeness and accuracy of medical information.

**Last Updated**: December 2024
