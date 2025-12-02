/**
 * Gemini 3 Pro Client
 * Uses the latest Gemini 3 Pro model with native document understanding
 * https://ai.google.dev/gemini-api/docs/gemini-3
 */

import { generateExtractionPrompt } from '../processing/extraction-schema.js';

export class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    
    // Gemini 3 Pro - latest model with advanced reasoning
    this.model = 'gemini-3-pro-preview';
    
    // Default thinking level: low, high (medium not supported)
    this.defaultThinkingLevel = 'low';
  }

  /**
   * Generate content with Gemini 3 Pro
   */
  async generateContent({ prompt, thinkingLevel = null, temperature = 1.0 }) {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 64000,
        thinkingConfig: {
          thinkingLevel: thinkingLevel || this.defaultThinkingLevel
        }
      }
    };

    console.log(`🤖 Gemini 3 Pro request (thinking: ${thinkingLevel || this.defaultThinkingLevel})...`);

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 180000);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.filter(p => !p.thought)
      ?.map(p => p.text)
      ?.join('') || '';

    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
    console.log(`✅ Gemini 3 Pro success (${tokensUsed} tokens)`);

    return {
      text: this.cleanResponse(text),
      tokensUsed,
      model: this.model
    };
  }

  /**
   * Process document (PDF, image, etc.) with Gemini 3 Pro
   * Gemini 3 handles documents natively - no text extraction needed
   */
  async processDocument({ fileBuffer, mimeType, documentType, thinkingLevel = 'low' }) {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const base64Data = this.toBase64(fileBuffer);

    const prompt = this.getExtractionPrompt(documentType);

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 64000,
        thinkingConfig: {
          thinkingLevel: thinkingLevel
        }
      }
    };

    console.log(`📄 Gemini 3 Pro document processing (${mimeType}, thinking: ${thinkingLevel})...`);

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 300000); // 5 min for large docs

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.filter(p => !p.thought)
      ?.map(p => p.text)
      ?.join('') || '';

    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
    console.log(`✅ Document processed (${tokensUsed} tokens)`);

    return {
      text: this.cleanResponse(text),
      tokensUsed,
      model: this.model
    };
  }

  /**
   * Extract medical highlight from document
   */
  async extractMedicalHighlight({ fileBuffer, mimeType, documentType }) {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const base64Data = this.toBase64(fileBuffer);

    const prompt = `Read this medical document and provide a single-line highlight (max 150 chars) summarizing the most significant clinical finding.

Examples:
- "CT shows 2.5cm lesion in right upper lobe, suspicious for malignancy"
- "Biopsy confirms invasive ductal carcinoma, Grade 2, ER+/PR+/HER2-"
- "Labs show elevated CA-125 at 89 U/mL, concerning for recurrence"

Return ONLY the highlight, nothing else.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        thinkingConfig: { thinkingLevel: 'low' }
      }
    };

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 60000);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { text: text.trim().substring(0, 150), tokensUsed: data.usageMetadata?.totalTokenCount || 0 };
  }

  getExtractionPrompt(documentType) {
    return generateExtractionPrompt(documentType);
  }

  toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  cleanResponse(text) {
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Extract JSON from response if there's text before it
    const jsonStart = cleaned.indexOf('{');
    const jsonArrayStart = cleaned.indexOf('[');
    
    if (jsonStart === -1 && jsonArrayStart === -1) {
      return cleaned;
    }
    
    const start = jsonStart === -1 ? jsonArrayStart 
      : jsonArrayStart === -1 ? jsonStart 
      : Math.min(jsonStart, jsonArrayStart);
    
    return cleaned.substring(start);
  }

  async fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }
}
