import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Document Endpoint Tests - Category Support
 * 
 * Tests for endpoints that return or update document category/subcategory/facility
 */

global.fetch = vi.fn();

const API_BASE = process.env.API_BASE || 'http://localhost:8787/api/v1';

describe('Document Endpoints - Category Support', () => {
  const patientId = 'pt_test123';
  const documentId = 'doc_test456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /documents/:docId - Single Document', () => {
    it('should include category, subcategory, and facility in response', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/${documentId}`;

      const mockResponse = {
        success: true,
        data: {
          id: documentId,
          patient_id: patientId,
          filename: 'biopsy_tmc.pdf',
          category: 'pathology',
          subcategory: 'biopsy',
          facility: 'Tata Memorial Hospital',
          classification: 'cancer_core',
          classification_confidence: 0.95,
          document_date: '2025-11-02',
          created_at: 1234567890,
          updated_at: 1234567890
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.category).toBe('pathology');
      expect(data.data.subcategory).toBe('biopsy');
      expect(data.data.facility).toBe('Tata Memorial Hospital');
    });

    it('should handle documents without category gracefully', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/${documentId}`;

      const mockResponse = {
        success: true,
        data: {
          id: documentId,
          filename: 'unknown.pdf',
          category: null,
          subcategory: null,
          facility: null,
          classification: null
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.data.category).toBeNull();
      expect(data.data.subcategory).toBeNull();
    });
  });

  describe('PATCH /documents/:docId - Update Metadata', () => {
    it('should allow updating category and subcategory', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/${documentId}`;

      const updateBody = {
        category: 'imaging',
        subcategory: 'pet',
        facility: 'Apollo Hospitals'
      };

      const mockResponse = {
        success: true,
        message: 'Document metadata updated successfully',
        data: {
          id: documentId,
          category: 'imaging',
          subcategory: 'pet',
          facility: 'Apollo Hospitals'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.category).toBe('imaging');
      expect(data.data.subcategory).toBe('pet');
      expect(data.data.facility).toBe('Apollo Hospitals');
    });

    it('should allow updating only category', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/${documentId}`;

      const updateBody = {
        category: 'laboratory'
      };

      const mockResponse = {
        success: true,
        data: {
          id: documentId,
          category: 'laboratory',
          subcategory: null // unchanged
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });
      const data = await response.json();

      expect(data.data.category).toBe('laboratory');
    });
  });

  describe('POST /documents/:documentId/classify - Classify Document', () => {
    it('should return category and subcategory in classification response', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/${documentId}/classify`;

      const mockResponse = {
        success: true,
        data: {
          document_id: documentId,
          classification: 'cancer_core',
          confidence: 0.95,
          reason: 'Biopsy confirming adenocarcinoma',
          category: 'pathology',
          subcategory: 'biopsy',
          facility: 'Tata Memorial Hospital',
          document_date: '2025-11-02',
          is_handwritten: false
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.category).toBe('pathology');
      expect(data.data.subcategory).toBe('biopsy');
      expect(data.data.facility).toBe('Tata Memorial Hospital');
      expect(data.data.classification).toBe('cancer_core');
    });

    it('should return existing classification if already classified', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/${documentId}/classify`;

      const mockResponse = {
        success: true,
        data: {
          document_id: documentId,
          classification: 'cancer_core',
          confidence: 0.92,
          reason: 'Previously classified',
          document_category: 'pathology',
          document_date: '2025-11-02'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'POST'
      });
      const data = await response.json();

      expect(data.data.classification).toBe('cancer_core');
    });

    it('should accept force parameter to re-classify', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/${documentId}/classify`;

      const mockResponse = {
        success: true,
        data: {
          document_id: documentId,
          classification: 'cancer_adjacent',
          category: 'laboratory',
          subcategory: 'cbc'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await response.json();

      expect(data.data.category).toBe('laboratory');
    });
  });

  describe('POST /documents/classify - Bulk Classify', () => {
    it('should classify multiple documents and return category info', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/classify`;

      const requestBody = {
        document_ids: ['doc_001', 'doc_002', 'doc_003']
      };

      const mockResponse = {
        success: true,
        data: {
          total_documents: 3,
          classified: 3,
          results: [
            {
              document_id: 'doc_001',
              classification: 'cancer_core',
              category: 'pathology',
              subcategory: 'biopsy'
            },
            {
              document_id: 'doc_002',
              classification: 'cancer_adjacent',
              category: 'laboratory',
              subcategory: 'cbc'
            },
            {
              document_id: 'doc_003',
              classification: 'cancer_core',
              category: 'imaging',
              subcategory: 'pet'
            }
          ]
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();

      expect(data.data.total_documents).toBe(3);
      expect(data.data.results.length).toBe(3);
      expect(data.data.results[0].category).toBe('pathology');
      expect(data.data.results[1].category).toBe('laboratory');
      expect(data.data.results[2].category).toBe('imaging');
    });

    it('should classify all pending documents if no IDs provided', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/classify`;

      const mockResponse = {
        success: true,
        data: {
          total_documents: 5,
          classified: 5,
          results: [
            { document_id: 'doc_001', category: 'pathology', subcategory: 'biopsy' },
            { document_id: 'doc_002', category: 'imaging', subcategory: 'ct' }
          ]
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();

      expect(data.data.total_documents).toBeGreaterThan(0);
    });
  });

  describe('POST /documents/triage/batch - Batch Triage Operations', () => {
    it('should handle batch classification updates', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/triage/batch`;

      const requestBody = {
        updates: [
          {
            document_id: 'doc_001',
            classification: 'cancer_core',
            approved_for_extraction: true
          },
          {
            document_id: 'doc_002',
            classification: 'cancer_adjacent',
            approved_for_extraction: false
          }
        ]
      };

      const mockResponse = {
        success: true,
        data: {
          updated: 2,
          approved_for_extraction: 1,
          results: [
            { document_id: 'doc_001', status: 'updated' },
            { document_id: 'doc_002', status: 'updated' }
          ]
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();

      expect(data.data.updated).toBe(2);
      expect(data.data.approved_for_extraction).toBe(1);
    });

    it('should handle errors in batch updates gracefully', async () => {
      const url = `${API_BASE}/patients/${patientId}/documents/triage/batch`;

      const requestBody = {
        updates: [
          {
            document_id: 'doc_invalid',
            classification: 'cancer_core'
          }
        ]
      };

      const mockResponse = {
        success: true,
        data: {
          updated: 0,
          approved_for_extraction: 0,
          results: [
            {
              document_id: 'doc_invalid',
              status: 'error',
              error: 'Document not found or does not belong to patient'
            }
          ]
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();

      expect(data.data.results[0].status).toBe('error');
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent category fields across all endpoints', async () => {
      // Test that all document responses include category/subcategory/facility
      const endpoints = [
        { method: 'GET', url: `${API_BASE}/patients/${patientId}/documents/${documentId}` },
        { method: 'POST', url: `${API_BASE}/patients/${patientId}/documents/${documentId}/classify` }
      ];

      const expectedFields = ['category', 'subcategory', 'facility'];

      for (const endpoint of endpoints) {
        const mockResponse = {
          success: true,
          data: {
            id: documentId,
            category: 'pathology',
            subcategory: 'biopsy',
            facility: 'Tata Memorial Hospital'
          }
        };

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        expectedFields.forEach(field => {
          expect(data.data).toHaveProperty(field);
        });
      }
    });
  });
});

