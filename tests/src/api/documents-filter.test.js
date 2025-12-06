import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Document List Filter Tests - Category/Subcategory Filtering
 * 
 * Tests for GET /patients/:id/documents with category and subcategory filters
 */

global.fetch = vi.fn();

const API_BASE = process.env.API_BASE || 'http://localhost:8787/api/v1';

describe('Document List - Category Filter', () => {
  const patientId = 'pt_test123';
  const baseUrl = `${API_BASE}/patients/${patientId}/documents`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Category Filter', () => {
    it('should filter documents by category', async () => {
      const url = `${baseUrl}?category=pathology`;

      const mockResponse = {
        success: true,
        data: [
          {
            id: 'doc_001',
            filename: 'biopsy_report.pdf',
            category: 'pathology',
            subcategory: 'biopsy',
            facility: 'Tata Memorial Hospital'
          },
          {
            id: 'doc_002',
            filename: 'fnac_report.pdf',
            category: 'pathology',
            subcategory: 'fnac',
            facility: 'AIIMS Delhi'
          }
        ],
        total: 2,
        filters: {
          category: 'pathology',
          subcategory: null,
          sort: 'created_at',
          order: 'DESC'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.length).toBe(2);
      data.data.forEach(doc => {
        expect(doc.category).toBe('pathology');
      });
    });

    it('should filter by imaging category', async () => {
      const url = `${baseUrl}?category=imaging`;

      const mockResponse = {
        success: true,
        data: [
          { id: 'doc_003', category: 'imaging', subcategory: 'ct' },
          { id: 'doc_004', category: 'imaging', subcategory: 'pet' },
          { id: 'doc_005', category: 'imaging', subcategory: 'mri' }
        ],
        total: 3
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.data.length).toBe(3);
      data.data.forEach(doc => {
        expect(doc.category).toBe('imaging');
      });
    });

    it('should return empty array if no documents match category', async () => {
      const url = `${baseUrl}?category=surgical`;

      const mockResponse = {
        success: true,
        data: [],
        total: 0
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.data.length).toBe(0);
      expect(data.total).toBe(0);
    });
  });

  describe('Subcategory Filter', () => {
    it('should filter by category AND subcategory', async () => {
      const url = `${baseUrl}?category=pathology&subcategory=biopsy`;

      const mockResponse = {
        success: true,
        data: [
          {
            id: 'doc_001',
            category: 'pathology',
            subcategory: 'biopsy',
            filename: 'biopsy_1.pdf'
          },
          {
            id: 'doc_002',
            category: 'pathology',
            subcategory: 'biopsy',
            filename: 'biopsy_2.pdf'
          }
        ],
        total: 2,
        filters: {
          category: 'pathology',
          subcategory: 'biopsy',
          sort: 'created_at',
          order: 'DESC'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.data.length).toBe(2);
      data.data.forEach(doc => {
        expect(doc.category).toBe('pathology');
        expect(doc.subcategory).toBe('biopsy');
      });
      expect(data.filters.category).toBe('pathology');
      expect(data.filters.subcategory).toBe('biopsy');
    });

    it('should filter imaging by subcategory', async () => {
      const url = `${baseUrl}?category=imaging&subcategory=pet`;

      const mockResponse = {
        success: true,
        data: [
          { id: 'doc_006', category: 'imaging', subcategory: 'pet' }
        ],
        total: 1
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.data.length).toBe(1);
      expect(data.data[0].subcategory).toBe('pet');
    });
  });

  describe('Combined Filters', () => {
    it('should combine category filter with date range', async () => {
      const url = `${baseUrl}?category=laboratory&start_date=2025-01-01&end_date=2025-12-31`;

      const mockResponse = {
        success: true,
        data: [
          {
            id: 'doc_007',
            category: 'laboratory',
            subcategory: 'cbc',
            document_date: '2025-06-15'
          }
        ],
        total: 1,
        filters: {
          category: 'laboratory',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.data.length).toBe(1);
      expect(data.data[0].category).toBe('laboratory');
      expect(data.filters.category).toBe('laboratory');
    });

    it('should combine category with sort order', async () => {
      const url = `${baseUrl}?category=clinical&sort=document_date&order=asc`;

      const mockResponse = {
        success: true,
        data: [
          { id: 'doc_008', category: 'clinical', document_date: '2025-01-01' },
          { id: 'doc_009', category: 'clinical', document_date: '2025-02-01' }
        ],
        total: 2,
        filters: {
          category: 'clinical',
          sort: 'document_date',
          order: 'ASC'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.filters.sort).toBe('document_date');
      expect(data.filters.order).toBe('ASC');
    });
  });

  describe('Response Format', () => {
    it('should include category and subcategory in all document objects', async () => {
      const url = `${baseUrl}`;

      const mockResponse = {
        success: true,
        data: [
          {
            id: 'doc_010',
            filename: 'test.pdf',
            category: 'treatment',
            subcategory: 'chemo_chart',
            facility: 'Apollo Hospitals',
            document_date: '2025-11-02'
          }
        ],
        total: 1
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      const doc = data.data[0];
      expect(doc).toHaveProperty('category');
      expect(doc).toHaveProperty('subcategory');
      expect(doc).toHaveProperty('facility');
      expect(doc.category).toBe('treatment');
      expect(doc.subcategory).toBe('chemo_chart');
    });

    it('should include filters in response', async () => {
      const url = `${baseUrl}?category=pathology&subcategory=biopsy`;

      const mockResponse = {
        success: true,
        data: [],
        total: 0,
        filters: {
          category: 'pathology',
          subcategory: 'biopsy',
          start_date: null,
          end_date: null,
          reviewed_status: null,
          sort: 'created_at',
          order: 'DESC'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch(url);
      const data = await response.json();

      expect(data.filters).toBeDefined();
      expect(data.filters.category).toBe('pathology');
      expect(data.filters.subcategory).toBe('biopsy');
    });
  });
});

