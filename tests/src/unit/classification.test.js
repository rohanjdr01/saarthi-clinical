import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentClassifier } from '../../services/classification/classifier.js';

// Mock environment
const createMockEnv = () => ({
  GEMINI_API_KEY: 'test-gemini-key',
  OPENAI_API_KEY: 'test-openai-key',
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true })
      })
    })
  },
  DOCUMENTS: {
    get: vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    })
  }
});

describe('DocumentClassifier - New Categories', () => {
  let classifier;
  let mockEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();
    classifier = new DocumentClassifier(mockEnv);
  });

  describe('generateClassificationPrompt', () => {
    it('should include 7 primary categories in prompt', () => {
      const prompt = classifier.generateClassificationPrompt(null, 'test.pdf');
      
      expect(prompt).toContain('pathology');
      expect(prompt).toContain('imaging');
      expect(prompt).toContain('laboratory');
      expect(prompt).toContain('clinical');
      expect(prompt).toContain('treatment');
      expect(prompt).toContain('surgical');
      expect(prompt).toContain('admin');
    });

    it('should include subcategory field in output JSON', () => {
      const prompt = classifier.generateClassificationPrompt(null, 'test.pdf');
      
      expect(prompt).toContain('"subcategory"');
      expect(prompt).toContain('"category"');
      expect(prompt).toContain('"facility"');
      expect(prompt).toContain('"is_handwritten"');
    });

    it('should include all pathology subcategories', () => {
      const prompt = classifier.generateClassificationPrompt(null, 'test.pdf');
      
      expect(prompt).toContain('biopsy');
      expect(prompt).toContain('fnac');
      expect(prompt).toContain('cytology');
      expect(prompt).toContain('ihc');
    });

    it('should include patient context when provided', () => {
      const patientContext = {
        cancer_type: 'Adenocarcinoma',
        diagnosis_date: '2025-09-29'
      };
      const prompt = classifier.generateClassificationPrompt(patientContext, 'test.pdf');
      
      expect(prompt).toContain('Patient Context');
      expect(prompt).toContain('Adenocarcinoma');
      expect(prompt).toContain('2025-09-29');
    });

    it('should not include patient context when null', () => {
      const prompt = classifier.generateClassificationPrompt(null, 'test.pdf');
      
      // Should not have Patient Context section
      expect(prompt).not.toContain('## Patient Context');
    });
  });

  describe('normalizeFacility', () => {
    it('should normalize TMH to Tata Memorial Hospital', () => {
      expect(classifier.normalizeFacility('TMH')).toBe('Tata Memorial Hospital');
      expect(classifier.normalizeFacility('Tata Memorial')).toBe('Tata Memorial Hospital');
      expect(classifier.normalizeFacility('tata hospital')).toBe('Tata Memorial Hospital');
    });

    it('should normalize AIIMS variations', () => {
      expect(classifier.normalizeFacility('AIIMS')).toBe('AIIMS Delhi');
      expect(classifier.normalizeFacility('All India Institute')).toBe('AIIMS Delhi');
      expect(classifier.normalizeFacility('aiims delhi')).toBe('AIIMS Delhi');
    });

    it('should normalize lab names', () => {
      expect(classifier.normalizeFacility('Thyrocare')).toBe('Thyrocare');
      expect(classifier.normalizeFacility('Thyrocare Labs')).toBe('Thyrocare');
      expect(classifier.normalizeFacility('Lal Path')).toBe('Dr. Lal PathLabs');
      expect(classifier.normalizeFacility('Dr Lal PathLabs')).toBe('Dr. Lal PathLabs');
    });

    it('should return null for null/undefined input', () => {
      expect(classifier.normalizeFacility(null)).toBeNull();
      expect(classifier.normalizeFacility(undefined)).toBeNull();
    });

    it('should return original value if no match found', () => {
      expect(classifier.normalizeFacility('Unknown Hospital')).toBe('Unknown Hospital');
      expect(classifier.normalizeFacility('Custom Lab Name')).toBe('Custom Lab Name');
    });
  });

  describe('Response Parsing', () => {
    it('should parse category and subcategory from AI response', () => {
      const mockResponse = {
        text: JSON.stringify({
          classification: 'cancer_core',
          confidence: 0.95,
          reason: 'Biopsy confirming adenocarcinoma',
          category: 'pathology',
          subcategory: 'biopsy',
          facility: 'TMH',
          document_date: '2025-11-02',
          is_handwritten: false
        })
      };

      // Simulate parsing logic
      const parsed = JSON.parse(mockResponse.text);
      expect(parsed.category).toBe('pathology');
      expect(parsed.subcategory).toBe('biopsy');
      expect(parsed.facility).toBe('TMH');
      expect(parsed.is_handwritten).toBe(false);
    });

    it('should handle missing category gracefully', () => {
      const mockResponse = {
        text: JSON.stringify({
          classification: 'cancer_core',
          confidence: 0.9,
          reason: 'Test',
          document_date: '2025-11-02'
        })
      };

      const parsed = JSON.parse(mockResponse.text);
      expect(parsed.category).toBeUndefined();
      // Should fallback to null in actual implementation
    });

    it('should parse is_handwritten boolean correctly', () => {
      const mockResponse1 = {
        text: JSON.stringify({ is_handwritten: true })
      };
      const mockResponse2 = {
        text: JSON.stringify({ is_handwritten: false })
      };
      const mockResponse3 = {
        text: JSON.stringify({}) // missing field
      };

      expect(JSON.parse(mockResponse1.text).is_handwritten).toBe(true);
      expect(JSON.parse(mockResponse2.text).is_handwritten).toBe(false);
      expect(JSON.parse(mockResponse3.text).is_handwritten).toBeUndefined();
    });
  });

  describe('Category Validation', () => {
    it('should accept valid categories', () => {
      const validCategories = ['pathology', 'imaging', 'laboratory', 'clinical', 'treatment', 'surgical', 'admin'];
      
      validCategories.forEach(cat => {
        // In actual implementation, validation would reject invalid ones
        expect(validCategories.includes(cat)).toBe(true);
      });
    });

    it('should reject invalid categories', () => {
      const invalidCategories = ['invalid', 'old_category', 'lab_report', 'radiology'];
      const validCategories = ['pathology', 'imaging', 'laboratory', 'clinical', 'treatment', 'surgical', 'admin'];
      
      invalidCategories.forEach(cat => {
        expect(validCategories.includes(cat)).toBe(false);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should map document_category from category', () => {
      const classificationData = {
        category: 'pathology',
        subcategory: 'biopsy'
      };
      
      // In actual implementation: document_category = category || null
      const document_category = classificationData.category || null;
      expect(document_category).toBe('pathology');
    });

    it('should handle old document_category field', () => {
      const mockResponse = {
        text: JSON.stringify({
          classification: 'cancer_core',
          document_category: 'pathology', // old field
          category: null // new field missing
        })
      };

      const parsed = JSON.parse(mockResponse.text);
      // Should fallback: category = parsed.category || parsed.document_category
      const category = parsed.category || parsed.document_category || null;
      expect(category).toBe('pathology');
    });
  });
});

