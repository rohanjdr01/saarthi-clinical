# Part 3: Disease Progression Tracker (New Feature)

## What Oncologists Are Really Asking For

When they say "aggression of disease" and "how markers are progressing," they're looking at:

### 1. Tumor Markers Over Time
Quantitative values that indicate disease activity:

| Cancer Type | Key Markers |
|-------------|-------------|
| Colorectal | CEA, CA 19-9 |
| Ovarian | CA-125, HE4 |
| Breast | CA 15-3, CA 27-29 |
| Prostate | PSA |
| Liver | AFP |
| Pancreatic | CA 19-9 |
| Gastric | CEA, CA 72-4, CA 19-9 |

**What matters:** The trend, not just the value. CEA of 15 means nothing without knowing it was 5 last month.

### 2. Imaging Response
- Tumor size changes (RECIST criteria)
- New lesions appearing/disappearing
- Metabolic activity (PET SUV values)

### 3. Performance Status
- ECOG score over time
- Weight changes
- Symptom burden

### 4. Lab Trends (Treatment Toxicity)
- ANC (neutropenia risk)
- Hemoglobin (anemia)
- Creatinine (kidney function)
- LFTs (liver function)

---

## What You Could Build: Disease Progression Tracker

### Concept: `GET /patients/:id/progression`

A dedicated endpoint that synthesizes "how is this patient doing" from multiple data sources.

```json
{
  "patient_id": "pt_xxx",
  "cancer_type": "Gastric Adenocarcinoma",
  "current_status": "on_treatment",
  "overall_trend": "stable",  // 'improving' | 'stable' | 'progressing' | 'insufficient_data'
  
  "tumor_markers": {
    "primary_marker": "CEA",
    "latest_value": 8.5,
    "latest_date": "2025-11-15",
    "unit": "ng/mL",
    "reference_range": "0-5",
    "trend": "rising",  // 'rising' | 'falling' | 'stable' | 'fluctuating'
    "percent_change_30d": "+42%",
    "timeline": [
      { "date": "2025-09-29", "value": 4.2, "source": { "doc_id": "doc_xxx", "filename": "lab_sep.pdf" } },
      { "date": "2025-10-15", "value": 6.0, "source": { "doc_id": "doc_yyy", "filename": "lab_oct.pdf" } },
      { "date": "2025-11-15", "value": 8.5, "source": { "doc_id": "doc_zzz", "filename": "lab_nov.pdf" } }
    ],
    "interpretation": "CEA rising despite treatment - may indicate disease progression"
  },
  
  "imaging_response": {
    "latest_assessment": "stable_disease",  // RECIST: 'complete_response' | 'partial_response' | 'stable_disease' | 'progressive_disease'
    "latest_date": "2025-11-10",
    "target_lesion_sum": 45,  // mm
    "baseline_sum": 52,  // mm
    "percent_change_from_baseline": "-13%",
    "timeline": [
      { "date": "2025-09-29", "assessment": "baseline", "sum_mm": 52, "source": { "doc_id": "...", "filename": "ct_baseline.pdf" } },
      { "date": "2025-11-10", "assessment": "stable_disease", "sum_mm": 45, "source": { "doc_id": "...", "filename": "ct_restaging.pdf" } }
    ]
  },
  
  "performance_status": {
    "latest_ecog": 1,
    "latest_date": "2025-11-02",
    "trend": "stable",
    "timeline": [
      { "date": "2025-09-29", "ecog": 1, "source": { "doc_id": "...", "filename": "..." } },
      { "date": "2025-11-02", "ecog": 1, "source": { "doc_id": "...", "filename": "..." } }
    ]
  },
  
  "key_labs": {
    "concerning": [
      {
        "name": "ANC",
        "latest_value": 1.2,
        "unit": "x10³/µL",
        "status": "low",  // 'normal' | 'low' | 'high' | 'critical'
        "trend": "falling",
        "clinical_note": "Grade 2 neutropenia - monitor closely"
      }
    ],
    "stable": [
      { "name": "Hemoglobin", "latest_value": 11.2, "unit": "g/dL", "status": "normal", "trend": "stable" },
      { "name": "Creatinine", "latest_value": 0.9, "unit": "mg/dL", "status": "normal", "trend": "stable" }
    ]
  },
  
  "alerts": [
    {
      "severity": "warning",
      "type": "marker_trend",
      "message": "CEA rising +42% over 30 days despite treatment",
      "recommendation": "Consider restaging imaging if not done recently"
    },
    {
      "severity": "warning", 
      "type": "lab_trend",
      "message": "ANC trending down - Grade 2 neutropenia",
      "recommendation": "Consider G-CSF support or dose reduction"
    }
  ],
  
  "data_completeness": {
    "tumor_markers": "good",      // 3+ data points
    "imaging": "partial",          // 2 data points  
    "performance_status": "partial",
    "labs": "good"
  }
}
```

---

## MVP vs Full Vision

### MVP (What to build now)

| Component | Scope | Effort |
|-----------|-------|--------|
| **Tumor Marker Timeline** | Extract values from labs, show trend | M |
| **Staging Timeline** | Already built ✅ | - |
| **Basic Lab Trends** | ANC, Hb, Creatinine from CBC/LFT/KFT | M |

### Later (When you have more data)

| Component | Why Wait |
|-----------|----------|
| RECIST calculations | Requires structured imaging extraction |
| Auto-generated alerts | Need to validate thresholds with oncologists |
| Performance status tracking | Often not documented consistently |
| Overall trend assessment | Need enough patients to calibrate |

---

## Immediate Implementation: Tumor Marker Tracker

### New Table: `tumor_markers`

```sql
CREATE TABLE tumor_markers (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  marker_name TEXT NOT NULL,        -- 'CEA', 'CA-125', 'PSA', etc.
  value REAL NOT NULL,
  unit TEXT,                         -- 'ng/mL', 'U/mL', etc.
  reference_range_low REAL,
  reference_range_high REAL,
  test_date TEXT,                    -- Date of the test
  document_id TEXT,                  -- Source document
  created_at INTEGER,
  
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX idx_tumor_markers_patient ON tumor_markers(patient_id, marker_name, test_date);
```

### New Table: `lab_results`

```sql
CREATE TABLE lab_results (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  test_name TEXT NOT NULL,          -- 'ANC', 'Hemoglobin', 'Creatinine', etc.
  test_category TEXT,               -- 'cbc', 'lft', 'kft', 'tumor_marker'
  value REAL NOT NULL,
  unit TEXT,
  reference_range_low REAL,
  reference_range_high REAL,
  status TEXT,                       -- 'normal', 'low', 'high', 'critical'
  test_date TEXT,
  document_id TEXT,
  created_at INTEGER,
  
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX idx_lab_results_patient ON lab_results(patient_id, test_name, test_date);
```

---

## New Endpoints

### `GET /patients/:id/markers`

Tumor marker trends.

```json
{
  "success": true,
  "data": {
    "markers": {
      "CEA": {
        "latest": { "value": 8.5, "date": "2025-11-15", "status": "elevated" },
        "trend": "rising",
        "percent_change_30d": "+42%",
        "reference_range": { "low": 0, "high": 5, "unit": "ng/mL" },
        "timeline": [
          { "date": "2025-09-29", "value": 4.2, "source": { "document_id": "doc_xxx", "filename": "lab_sep.pdf" } },
          { "date": "2025-10-15", "value": 6.0, "source": { "document_id": "doc_yyy", "filename": "lab_oct.pdf" } },
          { "date": "2025-11-15", "value": 8.5, "source": { "document_id": "doc_zzz", "filename": "lab_nov.pdf" } }
        ]
      },
      "CA 19-9": {
        "latest": { "value": 35, "date": "2025-11-15", "status": "normal" },
        "trend": "stable",
        "reference_range": { "low": 0, "high": 37, "unit": "U/mL" },
        "timeline": [...]
      }
    },
    "data_completeness": {
      "CEA": "good",      // 3+ points
      "CA 19-9": "partial" // 2 points
    }
  }
}
```

### `GET /patients/:id/labs`

Key lab trends (treatment toxicity monitoring).

```json
{
  "success": true,
  "data": {
    "summary": {
      "concerning": [
        {
          "test": "ANC",
          "latest_value": 1.2,
          "unit": "x10³/µL",
          "status": "low",
          "trend": "falling",
          "grade": 2,  // CTCAE grade
          "message": "Grade 2 neutropenia"
        }
      ],
      "normal": ["Hemoglobin", "Creatinine", "Bilirubin"]
    },
    "by_category": {
      "cbc": {
        "ANC": { "timeline": [...], "trend": "falling" },
        "Hemoglobin": { "timeline": [...], "trend": "stable" },
        "Platelets": { "timeline": [...], "trend": "stable" }
      },
      "lft": {
        "Bilirubin": { "timeline": [...], "trend": "stable" },
        "ALT": { "timeline": [...], "trend": "stable" },
        "AST": { "timeline": [...], "trend": "stable" }
      },
      "kft": {
        "Creatinine": { "timeline": [...], "trend": "stable" },
        "BUN": { "timeline": [...], "trend": "stable" }
      }
    }
  }
}
```

### `GET /patients/:id/progression` (Summary View)

Combined disease status for dashboard.

```json
{
  "success": true,
  "data": {
    "patient_id": "pt_xxx",
    "assessment_date": "2025-12-06",
    
    "disease_status": {
      "staging_trend": "improving",  // Based on staging snapshots
      "marker_trend": "rising",      // Based on tumor markers
      "overall": "mixed"             // 'improving' | 'stable' | 'progressing' | 'mixed' | 'insufficient_data'
    },
    
    "key_findings": [
      { "type": "positive", "finding": "Staging improved from IIIA to IIB after 3 cycles" },
      { "type": "concern", "finding": "CEA rising despite treatment response" },
      { "type": "concern", "finding": "ANC trending down - Grade 2 neutropenia" }
    ],
    
    "recommendations": [
      "Continue current regimen with close monitoring",
      "Consider G-CSF support for neutropenia",
      "Repeat tumor markers in 2 weeks"
    ],
    
    "next_milestones": [
      { "date": "2025-12-15", "event": "Cycle 4 due" },
      { "date": "2025-12-20", "event": "Restaging CT recommended" }
    ]
  }
}
```

---

## Extraction Prompt Additions

Add to your extraction prompt:

```markdown
## Tumor Markers
Extract all tumor marker values with:
- marker_name: Standardized name (CEA, CA-125, CA 19-9, PSA, AFP, etc.)
- value: Numeric value
- unit: Unit of measurement
- test_date: Date of test
- reference_range: Normal range if mentioned

## Lab Results (Key Values)
Extract these specific labs when present:
- CBC: WBC, ANC, Hemoglobin, Platelets
- LFT: Bilirubin (total), ALT, AST, ALP
- KFT: Creatinine, BUN, eGFR
- Others: Albumin, LDH

For each, capture:
- test_name: Standardized name
- value: Numeric value
- unit: Unit
- test_date: Date
- status: 'normal', 'low', 'high' if indicated
```

---

## What This Gives Oncologists

| Need | Solution |
|------|----------|
| "Is the disease responding?" | Staging timeline + tumor marker trends |
| "Are markers going up or down?" | Marker timeline with trend calculation |
| "Is treatment causing toxicity?" | Lab trends (ANC, LFTs, KFTs) |
| "What should I watch for?" | Progression summary with key findings |
| "When is the next milestone?" | Timeline + next events |

---

## Implementation Priority

### Phase 1 (This Sprint)
1. Add `lab_results` table
2. Update extraction to capture tumor markers + key labs
3. Build `GET /patients/:id/markers` endpoint
4. Build `GET /patients/:id/labs` endpoint

### Phase 2 (Next Sprint)
1. Build `GET /patients/:id/progression` summary
2. Add trend calculations (30-day change, direction)
3. Add basic alerts for concerning trends

### Phase 3 (Later)
1. RECIST response tracking (requires more structured imaging extraction)
2. Performance status tracking
3. Auto-generated recommendations

---

## Questions to Answer

1. **Are tumor markers consistently present in the docs you're getting?** (Lab reports, discharge summaries?)

2. **Which markers matter most for your initial patients?** (Gastric = CEA, CA 19-9, CA 72-4)

3. **Do you want trend alerts in MVP, or just the data visualization?**

4. **Should this be a separate endpoint (`/progression`) or embedded in patient summary?**

This could be a real differentiator — most EMRs show labs as flat lists, not trends. If you can show a doctor "CEA is up 42% over 30 days" at a glance, that's genuinely useful.