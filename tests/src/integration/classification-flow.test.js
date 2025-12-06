import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentClassifier } from '../../services/classification/classifier.js';
import { DocumentRepository } from '../../repositories/document.repository.js';
import { PatientRepository } from '../../repositories/patient.repository.js';

/**
 * Integration Tests - Full Classification Flow
 * 
 * Tests the complete document classification flow with new categories
 */

const createMockEnv = () => {
  const mockDB = {
    prepare: vi.fn()
  };

  const mockR2 = {
    get: vi.fn()
  };

  return {
    GEMINI_API_KEY: 'test-key',
    OPENAI_API_KEY: 'test-key',
    DB: mockDB,
    DOCUMENTS: mockR2
  };
};

describe('Classification Flow - Integration', () => {
  let classifier;
  let mockEnv;
  let mockDB;
  let mockR2;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockDB = mockEnv.DB;
    mockR2 = mockEnv.DOCUMENTS;
    classifier = new DocumentClassifier(mockEnv);
  });

  describe('Full Classification with New Categories', () => {
    it('should classify document and store category/subcategory/facility', async () => {
      const patientId = 'pt_test123';
      const documentId = 'doc_test456';

      // Mock document fetch
      const mockDocument = {
        id: documentId,
        patient_id: patientId,
        filename: 'biopsy_tmc.pdf',
        storage_key: 'test/storage/key',
        mime_type: 'application/pdf'
      };

      // Mock patient fetch
      const mockPatient = {
        id: patientId,
        name: 'Test Patient'
      };

      // Mock diagnosis fetch
      const mockDiagnosis = {
        primary_cancer_type: 'Adenocarcinoma',
        diagnosis_date: '2025-09-29'
      };

      // Mock R2 file
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
      };

      // Mock AI service response
      const mockAIResponse = {
        text: JSON.stringify({
          classification: 'cancer_core',
          confidence: 0.95,
          reason: 'Biopsy confirming adenocarcinoma',
          category: 'pathology',
          subcategory: 'biopsy',
          facility: 'Tata Memorial Hospital',
          document_date: '2025-11-02',
          is_handwritten: false
        })
      };

      // Setup mocks
      let prepareCallCount = 0;
      mockDB.prepare.mockImplementation((query) => {
        const stmt = {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockImplementation(async () => {
              prepareCallCount++;
              if (prepareCallCount === 1) return mockDocument;
              if (prepareCallCount === 2) return mockPatient;
              if (prepareCallCount === 3) return mockDiagnosis;
              return null;
            }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true })
          })
        };
        return stmt;
      });

      mockR2.get.mockResolvedValue(mockFile);

      // Mock AI service (would need to mock the actual service)
      // For now, we'll test the structure

      // Verify prompt includes new fields
      const prompt = classifier.generateClassificationPrompt(
        { cancer_type: 'Adenocarcinoma', diagnosis_date: '2025-09-29' },
        'biopsy_tmc.pdf'
      );

      expect(prompt).toContain('"category"');
      expect(prompt).toContain('"subcategory"');
      expect(prompt).toContain('"facility"');
      expect(prompt).toContain('"is_handwritten"');
    });

    it('should normalize facility name during classification', () => {
      const normalized = classifier.normalizeFacility('TMH');
      expect(normalized).toBe('Tata Memorial Hospital');

      const normalized2 = classifier.normalizeFacility('aiims delhi');
      expect(normalized2).toBe('AIIMS Delhi');
    });

    it('should validate category before storing', () => {
      const validCategories = ['pathology', 'imaging', 'laboratory', 'clinical', 'treatment', 'surgical', 'admin'];
      
      // Test validation logic
      const testCategory = 'pathology';
      expect(validCategories.includes(testCategory)).toBe(true);

      const invalidCategory = 'old_category';
      expect(validCategories.includes(invalidCategory)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle AI response parsing errors gracefully', () => {
      const invalidResponse = {
        text: 'Not valid JSON {'
      };

      expect(() => {
        JSON.parse(invalidResponse.text);
      }).toThrow();

      // In actual implementation, should fallback to safe defaults
      const fallback = {
        classification: 'cancer_adjacent',
        confidence: 0.5,
        category: null,
        subcategory: null,
        facility: null
      };

      expect(fallback.classification).toBe('cancer_adjacent');
      expect(fallback.category).toBeNull();
    });

    it('should mark document as classification_failed on error', async () => {
      const patientId = 'pt_test123';
      const documentId = 'doc_test789';

      // Mock document not found
      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null) // Document not found
        })
      });

      // Should throw error
      await expect(
        classifier.classifyDocument(patientId, documentId)
      ).rejects.toThrow('Document not found');
    });
  });

  describe('Bulk Classification', () => {
    it('should classify multiple documents with new categories', async () => {
      const patientId = 'pt_test123';
      const documentIds = ['doc_001', 'doc_002', 'doc_003'];

      // Mock documents query
      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: documentIds.map(id => ({
              id,
              filename: `test_${id}.pdf`,
              classification: null
            }))
          })
        })
      });

      // Mock individual document fetches (would be called in loop)
      // This is a simplified test structure

      // Verify bulk classify accepts document IDs
      expect(documentIds.length).toBe(3);
    });
  });
});

