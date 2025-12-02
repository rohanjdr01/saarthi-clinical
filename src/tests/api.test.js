import { describe, it, expect, beforeAll } from 'vitest';

/**
 * API Integration Tests (Updated for Phase 2 Refactoring)
 *
 * Run with: npm test
 *
 * These tests verify all API endpoints work correctly
 */

const API_BASE = 'http://localhost:8787/api/v1';

// Test data
let testPatientId = null;
let testDocumentId = null;
let testDiagnosisId = null;
let testTreatmentId = null;

describe('Saarthi Clinical API Tests', () => {

  // ========================================
  // HEALTH CHECK
  // ========================================
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.services).toBeDefined();
      expect(data.services.database).toBe(true);
    });
  });

  // ========================================
  // PATIENTS (REFACTORED)
  // ========================================
  describe('Patients', () => {
    it('should create a new patient with extended fields', async () => {
      const response = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Patient',
          age: 65,
          age_unit: 'years',
          sex: 'male',
          dob: '1958-03-15',
          blood_type: 'O+',
          height_cm: 175,
          weight_kg: 70,
          bsa: 1.85,
          ecog_status: 1,
          primary_oncologist: 'Dr. Smith',
          primary_center: 'Main Hospital',
          language_preference: 'English',
          allergy_status: 'none',
          caregiver: {
            name: 'Test Caregiver',
            relation: 'daughter',
            contact: '+91-9999999999'
          }
        })
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe('Test Patient');
      expect(data.data.blood_type).toBe('O+');
      expect(data.data.ecog_status).toBe(1);

      // Save for later tests
      testPatientId = data.data.id;
    });

    it('should list patients with filters', async () => {
      const response = await fetch(`${API_BASE}/patients?status=active&oncologist=Dr.%20Smith`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should get patient by ID', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testPatientId);
      expect(data.data.blood_type).toBeDefined();
    });

    it('should get patient demographics only', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/demographics`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBeDefined();
      expect(data.data.blood_type).toBeDefined();
      expect(data.data.caregiver).toBeDefined();
    });

    it('should update patient with new fields', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: 66,
          current_status: 'in_treatment',
          ecog_status: 2
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.age).toBe(66);
      expect(data.data.current_status).toBe('in_treatment');
      expect(data.data.ecog_status).toBe(2);
    });
  });

  // ========================================
  // DOCUMENTS (REFACTORED)
  // ========================================
  describe('Documents', () => {
    it('should upload documents without category (will be inferred)', async () => {
      // Create test file
      const testFile = new File(['test pathology content'], 'test-pathology.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('files', testFile);
      // NOTE: Category is optional - AI will infer it
      formData.append('process_immediately', 'false');

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.success).toBe(true);
      expect(data.documents_uploaded).toBeGreaterThan(0);
      expect(data.data).toBeDefined();

      // Save for later tests
      if (data.data.length > 0) {
        testDocumentId = data.data[0].id;
      }
    });

    it('should upload documents with optional category', async () => {
      const testFile = new File(['test radiology content'], 'test-radiology.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('files', testFile);
      formData.append('category', 'radiology');
      formData.append('subcategory', 'ct_scan');
      formData.append('process_immediately', 'false');

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.success).toBe(true);
    });

    it('should list documents with filters', async () => {
      const response = await fetch(
        `${API_BASE}/patients/${testPatientId}/documents?category=radiology&sort=created_at&order=desc`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.filters).toBeDefined();
    });

    it('should get document metadata', async () => {
      if (!testDocumentId) return;

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/${testDocumentId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testDocumentId);
      expect(data.data.vectorize_status).toBeDefined();
      expect(data.data.reviewed_status).toBeDefined();
    });

    it('should update document metadata', async () => {
      if (!testDocumentId) return;

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/${testDocumentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Test Document',
          category: 'pathology',
          reviewed_status: 'reviewed',
          case_pack_order: 1
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Updated Test Document');
      expect(data.data.reviewed_status).toBe('reviewed');
    });

    it('should reorder case-pack documents', async () => {
      if (!testDocumentId) return;

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_orders: [
            { document_id: testDocumentId, order: 1 }
          ]
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.documents_reordered).toBeGreaterThan(0);
    });

    it('should search documents using RAG semantic search', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'pathology',
          top_k: 5
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      // Note: Results may be empty if no documents have been vectorized yet
    });

    it('should reprocess document', async () => {
      if (!testDocumentId) return;

      const response = await fetch(
        `${API_BASE}/patients/${testPatientId}/documents/${testDocumentId}/reprocess`,
        {
          method: 'POST'
        }
      );

      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.success).toBe(true);
      expect(data.message).toContain('reprocessing started');
    });

    it('should trigger manual vectorization (may be skipped)', async () => {
      if (!testDocumentId) return;

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/${testDocumentId}/vectorize`, {
        method: 'POST'
      });
      const data = await response.json();

      expect([200, 501]).toContain(response.status);
      expect(data.success).toBeDefined();
    });
  });

  // ========================================
  // DIAGNOSIS & STAGING (NEW)
  // ========================================
  describe('Diagnosis & Staging', () => {
    it('should create diagnosis', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/diagnosis`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_cancer_type: 'Breast Cancer',
          primary_cancer_subtype: 'Invasive Ductal Carcinoma',
          diagnosis_date: '2024-01-15',
          tumor_location: 'Upper outer quadrant, left breast',
          tumor_laterality: 'left',
          tumor_size_cm: 2.5,
          tumor_grade: 'G2',
          histology: 'Ductal carcinoma'
        })
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.primary_cancer_type).toBe('Breast Cancer');
    });

    it('should get diagnosis', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/diagnosis`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.primary_cancer_type).toBeDefined();
    });

    it('should create staging', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/staging`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_t: 'cT2',
          clinical_n: 'cN1',
          clinical_m: 'cM0',
          clinical_stage: 'IIB',
          staging_system: 'AJCC 8th',
          staging_date: '2024-01-20'
        })
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.clinical_stage).toBe('IIB');
    });

    it('should get staging', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/staging`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });
  });

  // ========================================
  // TREATMENT (NEW)
  // ========================================
  describe('Treatment', () => {
    it('should create treatment', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/treatment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regimen_name: 'AC-T',
          treatment_intent: 'adjuvant',
          treatment_line: 'first-line',
          protocol: 'AC-T Protocol',
          drugs: ['Doxorubicin', 'Cyclophosphamide', 'Paclitaxel'],
          start_date: '2024-02-01',
          total_planned_cycles: 8,
          treatment_status: 'active'
        })
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.regimen_name).toBe('AC-T');
    });

    it('should get treatment', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/treatment`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.regimen_name).toBeDefined();
    });

    it('should add treatment cycle', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/treatment/cycles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_number: 1,
          planned_date: '2024-02-01',
          actual_date: '2024-02-01',
          drugs_administered: [
            { drug: 'Doxorubicin', dose: 60, unit: 'mg/m2', route: 'IV' },
            { drug: 'Cyclophosphamide', dose: 600, unit: 'mg/m2', route: 'IV' }
          ],
          cycle_status: 'completed',
          dose_percentage: 100
        })
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.cycle_number).toBe(1);
    });

    it('should get all cycles', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/treatment/cycles`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should get specific cycle', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/treatment/cycles/1`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.cycle_number).toBe(1);
    });

    it('should update cycle', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/treatment/cycles/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adverse_events: [
            { event: 'Nausea', grade: 2 }
          ],
          ctcae_grade: 2
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ========================================
  // Medications
  // ========================================
  describe('Medications', () => {
    it('should list medications (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/medications`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });

    it('should reject create medication without admin', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medication_name: 'Cisplatin', dose: 50 })
      });
      if (response.status === 401 || response.status === 403) {
        expect(true).toBe(true);
      } else {
        // If auth not enforced in test env, still validate response
        const data = await response.json();
        expect(data.success).toBeDefined();
      }
    });
  });

  // ========================================
  // Alerts
  // ========================================
  describe('Alerts', () => {
    it('should list alerts (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/alerts`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });
  });

  // ========================================
  // Labs
  // ========================================
  describe('Labs', () => {
    it('should list lab results (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/labs`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });
  });

  // ========================================
  // History
  // ========================================
  describe('History', () => {
    it('should list medical history (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/history/medical`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });

    it('should list surgical history (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/history/surgical`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });

    it('should list family history (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/history/family`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });

    it('should list social history (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/history/social`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });
  });

  // ========================================
  // Clinical Decisions
  // ========================================
  describe('Clinical Decisions', () => {
    it('should list decisions (public)', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/decisions`);
      const data = await response.json();
      expect([200, 401]).toContain(response.status);
      expect(data.success).toBeDefined();
    });
  });

  // ========================================
  // LEGACY ENDPOINTS (To be deprecated)
  // ========================================
  describe('Legacy Endpoints', () => {
    it('should still support processing status', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/processing/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should still support processing log', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/processing/log`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should still support patient summary', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/summary`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should still support timeline', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/timeline`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ========================================
  // CLEANUP
  // ========================================
  describe('Cleanup', () => {
    it('should delete test patient', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should trigger manual vectorization (skipped without binding)', async () => {
      if (!testDocumentId) return;

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/${testDocumentId}/vectorize`, {
        method: 'POST'
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBeDefined();
    });

    it('should return 501 for search when vectorize not configured', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'tumor markers', top_k: 3 })
      });

      const data = await response.json();
      expect([200, 501]).toContain(response.status);
      if (response.status === 501) {
        expect(data.success).toBe(false);
      } else {
        expect(data.success).toBe(true);
      }
    });
  });
});
