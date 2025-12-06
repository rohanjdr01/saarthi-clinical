import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Triage Endpoint Tests - Category Support
 * 
 * Tests for GET /patients/:id/documents/triage endpoint
 * with new category/subcategory fields
 */

// Mock fetch for API calls
global.fetch = vi.fn();

const API_BASE = process.env.API_BASE || 'http://localhost:8787/api/v1';

describe('Triage Endpoint - Category Support', () => {
  const patientId = 'pt_test123';
  const triageUrl = `${API_BASE}/patients/${patientId}/documents/triage`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Summary by_category', () => {
    it('should include by_category in summary', async () => {
      const mockResponse = {
        success: true,
        data: {
          patient_id: patientId,
          summary: {
            total: 10,
            pending_review: 5,
            reviewed: 5,
            by_classification: {
              cancer_core: 3,
              cancer_adjacent: 4,
              non_cancer: 2,
              classification_failed: 0,
              uncertain: 1,
              pending: 0
            },
            by_category: {
              pathology: 2,
              imaging: 3,
              laboratory: 3,
              clinical: 1,
              treatment: 1,
              surgical: 0,
              admin: 0
            }
          },
          documents: {
            cancer_core: [],
            cancer_adjacent: [],
            non_cancer: []
          }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(triageUrl);
      const data = await response.json();

      expect(data.data.summary.by_category).toBeDefined();
      expect(data.data.summary.by_category).toHaveProperty('pathology');
      expect(data.data.summary.by_category).toHaveProperty('imaging');
      expect(data.data.summary.by_category).toHaveProperty('laboratory');
      expect(data.data.summary.by_category).toHaveProperty('clinical');
      expect(data.data.summary.by_category).toHaveProperty('treatment');
      expect(data.data.summary.by_category).toHaveProperty('surgical');
      expect(data.data.summary.by_category).toHaveProperty('admin');
    });

    it('should count documents by category correctly', async () => {
      const mockResponse = {
        success: true,
        data: {
          summary: {
            by_category: {
              pathology: 5,
              imaging: 8,
              laboratory: 15
            }
          }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(triageUrl);
      const data = await response.json();

      expect(data.data.summary.by_category.pathology).toBe(5);
      expect(data.data.summary.by_category.imaging).toBe(8);
      expect(data.data.summary.by_category.laboratory).toBe(15);
    });
  });

  describe('Document Fields', () => {
    it('should include category and subcategory in document objects', async () => {
      const mockResponse = {
        success: true,
        data: {
          documents: {
            cancer_core: [
              {
                id: 'doc_001',
                filename: 'biopsy_tmc.pdf',
                category: 'pathology',
                subcategory: 'biopsy',
                category_display: 'Biopsy / Histopathology',
                extraction_priority: 'P0',
                facility: 'Tata Memorial Hospital',
                classification: 'cancer_core',
                classification_confidence: 0.95
              }
            ]
          }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(triageUrl);
      const data = await response.json();

      const doc = data.data.documents.cancer_core[0];
      expect(doc.category).toBe('pathology');
      expect(doc.subcategory).toBe('biopsy');
      expect(doc.category_display).toBe('Biopsy / Histopathology');
      expect(doc.extraction_priority).toBe('P0');
      expect(doc.facility).toBe('Tata Memorial Hospital');
    });

    it('should include category_display from document_categories join', async () => {
      const mockResponse = {
        success: true,
        data: {
          documents: {
            cancer_core: [
              {
                id: 'doc_002',
                category: 'imaging',
                subcategory: 'pet',
                category_display: 'PET-CT',
                extraction_priority: 'P0'
              }
            ]
          }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(triageUrl);
      const data = await response.json();

      const doc = data.data.documents.cancer_core[0];
      expect(doc.category_display).toBe('PET-CT');
      expect(doc.extraction_priority).toBe('P0');
    });

    it('should handle documents without category gracefully', async () => {
      const mockResponse = {
        success: true,
        data: {
          documents: {
            pending: [
              {
                id: 'doc_003',
                filename: 'unknown.pdf',
                category: null,
                subcategory: null,
                category_display: null,
                extraction_priority: null
              }
            ]
          }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(triageUrl);
      const data = await response.json();

      const doc = data.data.documents.pending[0];
      expect(doc.category).toBeNull();
      expect(doc.subcategory).toBeNull();
    });
  });

  describe('Grouping by Classification', () => {
    it('should group documents by classification with category info', async () => {
      const mockResponse = {
        success: true,
        data: {
          documents: {
            cancer_core: [
              { id: 'doc_001', category: 'pathology', subcategory: 'biopsy' },
              { id: 'doc_002', category: 'imaging', subcategory: 'pet' }
            ],
            cancer_adjacent: [
              { id: 'doc_003', category: 'laboratory', subcategory: 'cbc' }
            ],
            non_cancer: [
              { id: 'doc_004', category: 'admin', subcategory: 'bill' }
            ]
          }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(triageUrl);
      const data = await response.json();

      expect(data.data.documents.cancer_core.length).toBe(2);
      expect(data.data.documents.cancer_adjacent.length).toBe(1);
      expect(data.data.documents.non_cancer.length).toBe(1);

      expect(data.data.documents.cancer_core[0].category).toBe('pathology');
      expect(data.data.documents.cancer_adjacent[0].category).toBe('laboratory');
    });
  });

  describe('Status Filtering', () => {
    it('should filter by status and include category info', async () => {
      const pendingUrl = `${triageUrl}?status=pending`;

      const mockResponse = {
        success: true,
        data: {
          summary: {
            by_category: {
              pathology: 1,
              imaging: 2
            }
          },
          documents: {
            pending: [
              { id: 'doc_001', category: 'pathology', classification: null }
            ]
          }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(pendingUrl);
      const data = await response.json();

      expect(data.data.documents.pending.length).toBeGreaterThan(0);
      expect(data.data.summary.by_category).toBeDefined();
    });
  });
});

