import { describe, it, expect, beforeAll } from 'vitest';

/**
 * API Integration Tests
 *
 * Run with: npm test
 *
 * These tests verify all API endpoints work correctly
 */

const API_BASE = 'http://localhost:8787/api/v1';

// Test data
let testPatientId = null;
let testDocumentId = null;

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
  // PATIENTS
  // ========================================
  describe('Patients', () => {
    it('should create a new patient', async () => {
      const response = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Patient',
          age: 65,
          gender: 'male',
          caregiver: {
            name: 'Test Caregiver',
            relation: 'daughter',
            contact: '+91-9999999999'
          }
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe('Test Patient');

      // Save for later tests
      testPatientId = data.data.id;
    });

    it('should list all patients', async () => {
      const response = await fetch(`${API_BASE}/patients`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.total).toBeGreaterThan(0);
    });

    it('should get patient by ID', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testPatientId);
    });

    it('should update patient', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: 66
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.age).toBe(66);
    });

    it('should return 404 for non-existent patient', async () => {
      const response = await fetch(`${API_BASE}/patients/invalid_id`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  // ========================================
  // DOCUMENTS
  // ========================================
  describe('Documents', () => {
    it('should upload multiple documents', async () => {
      // Create test file
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('files', testFile);
      formData.append('document_type', 'pathology');
      formData.append('process_immediately', 'false');

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.success).toBe(true);
      expect(data.documents_uploaded).toBeGreaterThan(0);
      expect(data.data.documents).toBeDefined();

      // Save for later tests
      if (data.data.documents.length > 0) {
        testDocumentId = data.data.documents[0].id;
      }
    });

    it('should list patient documents', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should get document by ID', async () => {
      if (!testDocumentId) return;

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents/${testDocumentId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testDocumentId);
    });

    it('should require files in upload', async () => {
      const formData = new FormData();
      formData.append('document_type', 'pathology');

      const response = await fetch(`${API_BASE}/patients/${testPatientId}/documents`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  // ========================================
  // CASE-PACKS
  // ========================================
  describe('Case-Packs', () => {
    it('should get case-pack with documents', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/case-pack`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.case_pack).toBeDefined();
      expect(data.data.documents).toBeDefined();
    });

    it('should update case-pack metadata', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/case-pack`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Case Pack',
          description: 'Test description'
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Test Case Pack');
    });
  });

  // ========================================
  // PROCESSING
  // ========================================
  describe('Processing', () => {
    it('should get processing status', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/processing/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should get processing log', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/processing/log`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should process document', async () => {
      if (!testDocumentId) return;

      const response = await fetch(
        `${API_BASE}/patients/${testPatientId}/processing/documents/${testDocumentId}/process`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'incremental' })
        }
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ========================================
  // VIEWS & SUMMARY
  // ========================================
  describe('Views', () => {
    it('should get patient summary', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/summary`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.patient).toBeDefined();
    });

    it('should get detailed section', async () => {
      const response = await fetch(
        `${API_BASE}/patients/${testPatientId}/detailed/diagnosis_staging`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ========================================
  // TIMELINE
  // ========================================
  describe('Timeline', () => {
    it('should get patient timeline', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/timeline`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.timeline).toBeDefined();
    });

    it('should get timeline tracks', async () => {
      const response = await fetch(`${API_BASE}/patients/${testPatientId}/timeline/tracks`);
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
  });
});
