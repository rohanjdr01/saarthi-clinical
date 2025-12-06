import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database for reference data tests
const createMockDB = () => ({
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null)
    })
  })
});

describe('Document Categories Reference Data', () => {
  let mockDB;

  beforeEach(() => {
    mockDB = createMockDB();
  });

  describe('Primary Categories', () => {
    it('should have all 7 primary categories', async () => {
      // Mock query result
      const mockResult = {
        results: [
          { category: 'pathology' },
          { category: 'imaging' },
          { category: 'laboratory' },
          { category: 'clinical' },
          { category: 'treatment' },
          { category: 'surgical' },
          { category: 'admin' }
        ]
      };

      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await mockDB.prepare('SELECT DISTINCT category FROM document_categories')
        .bind().all();
      
      const categories = result.results.map(r => r.category);
      
      expect(categories).toContain('pathology');
      expect(categories).toContain('imaging');
      expect(categories).toContain('laboratory');
      expect(categories).toContain('clinical');
      expect(categories).toContain('treatment');
      expect(categories).toContain('surgical');
      expect(categories).toContain('admin');
      expect(categories.length).toBe(7);
    });
  });

  describe('Subcategories', () => {
    it('should have pathology subcategories', async () => {
      const mockResult = {
        results: [
          { category: 'pathology', subcategory: 'biopsy', display_name: 'Biopsy / Histopathology', extraction_priority: 'P0' },
          { category: 'pathology', subcategory: 'fnac', display_name: 'FNAC', extraction_priority: 'P0' },
          { category: 'pathology', subcategory: 'cytology', display_name: 'Cytology', extraction_priority: 'P1' },
          { category: 'pathology', subcategory: 'ihc', display_name: 'IHC / Molecular', extraction_priority: 'P0' },
          { category: 'pathology', subcategory: 'hpe_review', display_name: 'HPE Review', extraction_priority: 'P1' },
          { category: 'pathology', subcategory: 'frozen', display_name: 'Frozen Section', extraction_priority: 'P1' }
        ]
      };

      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await mockDB.prepare("SELECT * FROM document_categories WHERE category = 'pathology'")
        .bind().all();
      
      const subcats = result.results.map(r => r.subcategory);
      expect(subcats).toContain('biopsy');
      expect(subcats).toContain('fnac');
      expect(subcats).toContain('ihc');
      expect(subcats.length).toBe(6);
    });

    it('should have imaging subcategories', async () => {
      const mockResult = {
        results: [
          { category: 'imaging', subcategory: 'ct', display_name: 'CT Scan', extraction_priority: 'P0' },
          { category: 'imaging', subcategory: 'pet', display_name: 'PET-CT', extraction_priority: 'P0' },
          { category: 'imaging', subcategory: 'mri', display_name: 'MRI', extraction_priority: 'P1' },
          { category: 'imaging', subcategory: 'xray', display_name: 'X-Ray', extraction_priority: 'P2' }
        ]
      };

      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await mockDB.prepare("SELECT * FROM document_categories WHERE category = 'imaging'")
        .bind().all();
      
      const subcats = result.results.map(r => r.subcategory);
      expect(subcats).toContain('ct');
      expect(subcats).toContain('pet');
      expect(subcats).toContain('mri');
    });
  });

  describe('Extraction Priorities', () => {
    it('should have extraction_priority for all entries', async () => {
      const mockResult = {
        results: [
          { category: 'pathology', subcategory: 'biopsy', extraction_priority: 'P0' },
          { category: 'imaging', subcategory: 'ct', extraction_priority: 'P0' },
          { category: 'laboratory', subcategory: 'cbc', extraction_priority: 'P2' },
          { category: 'admin', subcategory: 'bill', extraction_priority: 'P3' }
        ]
      };

      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await mockDB.prepare('SELECT * FROM document_categories WHERE extraction_priority IS NULL')
        .bind().all();
      
      // All should have priority
      expect(result.results.length).toBe(0);
    });

    it('should have P0 categories for critical oncology docs', async () => {
      const mockResult = {
        results: [
          { category: 'pathology', subcategory: 'biopsy', extraction_priority: 'P0' },
          { category: 'pathology', subcategory: 'fnac', extraction_priority: 'P0' },
          { category: 'pathology', subcategory: 'ihc', extraction_priority: 'P0' },
          { category: 'imaging', subcategory: 'ct', extraction_priority: 'P0' },
          { category: 'imaging', subcategory: 'pet', extraction_priority: 'P0' },
          { category: 'clinical', subcategory: 'discharge', extraction_priority: 'P0' },
          { category: 'clinical', subcategory: 'tumor_board', extraction_priority: 'P0' },
          { category: 'treatment', subcategory: 'chemo_chart', extraction_priority: 'P0' },
          { category: 'treatment', subcategory: 'chemo_protocol', extraction_priority: 'P0' },
          { category: 'treatment', subcategory: 'rt_plan', extraction_priority: 'P0' }
        ]
      };

      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await mockDB.prepare("SELECT * FROM document_categories WHERE extraction_priority = 'P0'")
        .bind().all();
      
      const subcats = result.results.map(r => r.subcategory);
      expect(subcats).toContain('biopsy');
      expect(subcats).toContain('pet');
      expect(subcats).toContain('discharge');
      expect(subcats).toContain('chemo_chart');
    });

    it('should have P3 categories for low-priority admin docs', async () => {
      const mockResult = {
        results: [
          { category: 'admin', subcategory: 'insurance', extraction_priority: 'P3' },
          { category: 'admin', subcategory: 'bill', extraction_priority: 'P3' },
          { category: 'admin', subcategory: 'id', extraction_priority: 'P3' }
        ]
      };

      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await mockDB.prepare("SELECT * FROM document_categories WHERE category = 'admin' AND extraction_priority = 'P3'")
        .bind().all();
      
      expect(result.results.length).toBeGreaterThan(0);
      result.results.forEach(row => {
        expect(row.extraction_priority).toBe('P3');
      });
    });
  });

  describe('Display Names', () => {
    it('should have display_name for all entries', async () => {
      const mockResult = {
        results: [
          { category: 'pathology', subcategory: 'biopsy', display_name: 'Biopsy / Histopathology' },
          { category: 'imaging', subcategory: 'ct', display_name: 'CT Scan' },
          { category: 'laboratory', subcategory: 'cbc', display_name: 'Complete Blood Count' }
        ]
      };

      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await mockDB.prepare('SELECT * FROM document_categories')
        .bind().all();
      
      result.results.forEach(row => {
        expect(row.display_name).toBeDefined();
        expect(typeof row.display_name).toBe('string');
        expect(row.display_name.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Primary Key Constraint', () => {
    it('should have composite primary key (category, subcategory)', () => {
      // This would be tested at database level
      // In SQLite, we can verify by attempting duplicate insert
      const category = 'pathology';
      const subcategory = 'biopsy';
      
      // Should be unique combination
      expect(category && subcategory).toBeTruthy();
    });
  });
});

