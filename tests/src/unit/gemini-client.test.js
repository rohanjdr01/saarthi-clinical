import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiService } from '../../services/gemini/client.js';

describe('GeminiService', () => {
  let service;

  beforeEach(() => {
    service = new GeminiService('test-api-key');
  });

  describe('constructor', () => {
    it('should initialize with correct model', () => {
      expect(service.model).toBe('gemini-3-pro-preview');
    });

    it('should set default thinking level', () => {
      expect(service.defaultThinkingLevel).toBe('low');
    });
  });

  describe('getExtractionPrompt', () => {
    it('should return pathology prompt', () => {
      const prompt = service.getExtractionPrompt('pathology');
      expect(prompt).toContain('pathology');
      expect(prompt).toContain('primary_diagnosis');
    });

    it('should return imaging prompt', () => {
      const prompt = service.getExtractionPrompt('imaging');
      expect(prompt).toContain('imaging');
      expect(prompt).toContain('findings');
    });

    it('should return lab prompt', () => {
      const prompt = service.getExtractionPrompt('lab');
      expect(prompt).toContain('lab');
      expect(prompt).toContain('results');
    });

    it('should return default prompt for unknown types', () => {
      const prompt = service.getExtractionPrompt('unknown');
      expect(prompt).toContain('medical document');
    });
  });

  describe('toBase64', () => {
    it('should convert ArrayBuffer to base64', () => {
      const text = 'Hello, World!';
      const encoder = new TextEncoder();
      const buffer = encoder.encode(text).buffer;
      
      const base64 = service.toBase64(buffer);
      expect(base64).toBe(btoa(text));
    });
  });

  describe('cleanResponse', () => {
    it('should remove markdown code blocks', () => {
      const text = '```json\n{"key": "value"}\n```';
      expect(service.cleanResponse(text)).toBe('{"key": "value"}');
    });

    it('should trim whitespace', () => {
      const text = '  {"key": "value"}  ';
      expect(service.cleanResponse(text)).toBe('{"key": "value"}');
    });
  });
});

