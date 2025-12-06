import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentProcessor } from '../../services/processing/processor.js';

// Mock environment
const createMockEnv = () => ({
  GEMINI_API_KEY: 'test-gemini-key',
  OPENAI_API_KEY: 'test-openai-key',
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({})
      })
    })
  },
  DOCUMENTS: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  }
});

describe('DocumentProcessor', () => {
  let processor;
  let mockEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();
    processor = new DocumentProcessor(mockEnv);
  });

  describe('constructor', () => {
    it('should initialize with both providers when keys present', () => {
      expect(processor.services.gemini).toBeDefined();
      expect(processor.services.openai).toBeDefined();
    });

    it('should default to gemini provider', () => {
      expect(processor.provider).toBe('gemini');
    });

    it('should accept custom provider option', () => {
      const proc = new DocumentProcessor(mockEnv, { provider: 'openai' });
      expect(proc.provider).toBe('openai');
    });

    it('should handle missing Gemini key', () => {
      const env = { ...mockEnv, GEMINI_API_KEY: null };
      const proc = new DocumentProcessor(env);
      expect(proc.services.gemini).toBeUndefined();
    });

    it('should handle missing OpenAI key', () => {
      const env = { ...mockEnv, OPENAI_API_KEY: null };
      const proc = new DocumentProcessor(env);
      expect(proc.services.openai).toBeUndefined();
    });
  });

  describe('getService', () => {
    it('should return requested provider if available', () => {
      const result = processor.getService('openai');
      expect(result.provider).toBe('openai');
    });

    it('should return default provider if none requested', () => {
      const result = processor.getService(null);
      expect(result.provider).toBe('gemini');
    });

    it('should throw if no providers configured', () => {
      const env = { DB: mockEnv.DB, DOCUMENTS: mockEnv.DOCUMENTS };
      const proc = new DocumentProcessor(env);
      
      expect(() => proc.getService(null)).toThrow('No AI provider configured');
    });

    it('should throw if explicitly requested provider not configured', () => {
      const env = { ...mockEnv, OPENAI_API_KEY: null };
      const proc = new DocumentProcessor(env);
      
      expect(() => proc.getService('openai'))
        .toThrow("Provider 'openai' not configured");
    });

    it('should fallback when no specific provider requested', () => {
      const env = { ...mockEnv, GEMINI_API_KEY: null };
      const proc = new DocumentProcessor(env, { provider: 'gemini' });
      
      // When no override is passed, uses default, then falls back
      const result = proc.getService(null);
      expect(result.provider).toBe('openai');
    });
  });

  describe('processDocument', () => {
    it('should throw if document not found', async () => {
      await expect(processor.processDocument('invalid_id'))
        .rejects.toThrow('Document not found');
    });
  });
});
