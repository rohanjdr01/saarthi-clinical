/**
 * OpenAI Client - Latest Models
 * Uses GPT-4o for images and Responses API for PDFs
 * https://platform.openai.com/docs/guides/vision
 */

export class OpenAIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
    
    // Latest models
    this.model = 'gpt-4o'; // Best for multimodal tasks
    this.reasoningModel = 'o3-mini'; // For complex reasoning
    
    // Supported image types for Vision API
    this.supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  }

  /**
   * Generate content with GPT-4o
   */
  async generateContent({ prompt, temperature = 0.7, useReasoning = false }) {
    const url = `${this.baseUrl}/chat/completions`;
    const model = useReasoning ? this.reasoningModel : this.model;

    const requestBody = useReasoning ? {
      model,
      messages: [{ role: 'user', content: prompt }],
      reasoning_effort: 'medium'
    } : {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 16384
    };

    console.log(`🤖 OpenAI request (${model})...`);

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, 180000);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log(`✅ OpenAI success (${tokensUsed} tokens)`);

    return {
      text: this.cleanResponse(text),
      tokensUsed,
      model
    };
  }

  /**
   * Process document with GPT-4o
   * - Images: Uses Vision API directly
   * - PDFs: Uses Responses API with file upload
   */
  async processDocument({ fileBuffer, mimeType, documentType, useReasoning = false }) {
    // Check if it's a PDF - need different approach
    if (mimeType === 'application/pdf') {
      return await this.processPDF({ fileBuffer, documentType });
    }

    // For images, use Vision API
    if (this.supportedImageTypes.includes(mimeType)) {
      return await this.processImage({ fileBuffer, mimeType, documentType, useReasoning });
    }

    throw new Error(`Unsupported file type for OpenAI: ${mimeType}. Supported: PDF, PNG, JPEG, GIF, WEBP`);
  }

  /**
   * Process image with GPT-4o Vision API
   */
  async processImage({ fileBuffer, mimeType, documentType, useReasoning = false }) {
    const url = `${this.baseUrl}/chat/completions`;
    const base64Data = this.toBase64(fileBuffer);
    const model = useReasoning ? this.reasoningModel : this.model;

    const prompt = this.getExtractionPrompt(documentType);

    const content = [
      { type: 'text', text: prompt },
      { 
        type: 'image_url', 
        image_url: { 
          url: `data:${mimeType};base64,${base64Data}`,
          detail: 'high'
        }
      }
    ];

    const requestBody = useReasoning ? {
      model,
      messages: [{ role: 'user', content }],
      reasoning_effort: 'high'
    } : {
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.2,
      max_tokens: 16384
    };

    console.log(`📄 OpenAI image processing (${model}, ${mimeType})...`);

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, 300000);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log(`✅ Image processed (${tokensUsed} tokens)`);

    return {
      text: this.cleanResponse(text),
      tokensUsed,
      model
    };
  }

  /**
   * Process PDF using OpenAI Responses API (file upload)
   */
  async processPDF({ fileBuffer, documentType }) {
    console.log(`📄 OpenAI PDF processing via Responses API...`);

    // Step 1: Upload the PDF file
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'document.pdf');
    formData.append('purpose', 'user_data');

    const uploadResponse = await this.fetchWithTimeout(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    }, 60000);

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`OpenAI file upload failed: ${uploadResponse.status} - ${error}`);
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;
    console.log(`📁 File uploaded: ${fileId}`);

    // Step 2: Use Responses API with the file
    const prompt = this.getExtractionPrompt(documentType);
    
    const requestBody = {
      model: this.model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_file', file_id: fileId },
            { type: 'input_text', text: prompt }
          ]
        }
      ]
    };

    const response = await this.fetchWithTimeout(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, 300000);

    if (!response.ok) {
      const error = await response.text();
      // Clean up uploaded file
      await this.deleteFile(fileId);
      throw new Error(`OpenAI Responses API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Extract text from response
    const text = data.output?.find(o => o.type === 'message')?.content
      ?.find(c => c.type === 'output_text')?.text || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    // Clean up uploaded file
    await this.deleteFile(fileId);

    console.log(`✅ PDF processed (${tokensUsed} tokens)`);

    return {
      text: this.cleanResponse(text),
      tokensUsed,
      model: this.model
    };
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(fileId) {
    try {
      await fetch(`${this.baseUrl}/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
    } catch (e) {
      console.warn(`Failed to delete file ${fileId}:`, e.message);
    }
  }

  /**
   * Extract medical highlight from document
   */
  async extractMedicalHighlight({ fileBuffer, mimeType, documentType }) {
    const prompt = `Read this medical document and provide a single-line highlight (max 150 chars) summarizing the most significant clinical finding.

Examples:
- "CT shows 2.5cm lesion in right upper lobe, suspicious for malignancy"
- "Biopsy confirms invasive ductal carcinoma, Grade 2, ER+/PR+/HER2-"
- "Labs show elevated CA-125 at 89 U/mL, concerning for recurrence"

Return ONLY the highlight, nothing else.`;

    // For PDFs, use a simple text extraction approach
    if (mimeType === 'application/pdf') {
      // For highlight, just use Responses API with simpler prompt
      try {
        const result = await this.processPDF({ 
          fileBuffer, 
          documentType: 'highlight' 
        });
        return { text: result.text.substring(0, 150), tokensUsed: result.tokensUsed };
      } catch (e) {
        console.warn('PDF highlight extraction failed:', e.message);
        return { text: 'Document processed', tokensUsed: 0 };
      }
    }

    // For images
    const base64Data = this.toBase64(fileBuffer);

    const requestBody = {
      model: this.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 256
    };

    const response = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, 60000);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    return { text: text.substring(0, 150), tokensUsed: data.usage?.total_tokens || 0 };
  }

  getExtractionPrompt(documentType) {
    if (documentType === 'highlight') {
      return `Read this medical document and provide a single-line highlight (max 150 chars) summarizing the most significant clinical finding. Return ONLY the highlight.`;
    }

    const prompts = {
      pathology: `Extract all clinical data from this pathology report. Return ONLY valid JSON (no other text):
{
  "patient_demographics": {"name": "", "age": "", "gender": "", "mrn": ""},
  "primary_diagnosis": {"cancer_type": "", "histology": "", "grade": "", "location": ""},
  "staging": {"stage": "", "tnm": {"T": "", "N": "", "M": ""}},
  "molecular_markers": {},
  "key_findings": [],
  "recommendations": [],
  "document_date": ""
}`,
      imaging: `Extract all data from this imaging report. Return ONLY valid JSON (no other text):
{
  "patient_demographics": {"name": "", "age": "", "gender": ""},
  "study": {"type": "", "date": "", "contrast": ""},
  "findings": [],
  "impression": "",
  "recommendations": []
}`,
      lab: `Extract all data from this lab report. Return ONLY valid JSON (no other text):
{
  "patient_demographics": {"name": "", "age": "", "gender": ""},
  "collection_date": "",
  "results": [{"test": "", "value": "", "unit": "", "range": "", "flag": ""}],
  "interpretation": ""
}`,
      default: `Extract all clinical data from this medical document. Return ONLY valid JSON (no other text) with patient_demographics, key_findings, and any relevant clinical information.`
    };
    return prompts[documentType] || prompts.default;
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
