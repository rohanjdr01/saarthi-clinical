/**
 * Google File Search Service
 * Handles File Search store management and document operations
 * https://ai.google.dev/gemini-api/docs/file-search
 */

export class FileSearchService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Create or get File Search store for a patient
   * Store name format: patient-{patientId}
   * Returns the full resource name (e.g., "fileSearchStores/123")
   */
  async createFileSearchStore(patientId) {
    const storeDisplayName = `patient-${patientId}`;
    
    // First, try to get existing store
    const existingStore = await this.getFileSearchStore(patientId);
    if (existingStore) {
      console.log(`ℹ️  Using existing File Search store: ${existingStore}`);
      return existingStore;
    }

    // Create new store
    const url = `${this.baseUrl}/fileSearchStores?key=${this.apiKey}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: storeDisplayName
        })
      }, 30000);

      if (response.ok) {
        const data = await response.json();
        const storeName = data.name; // Full resource name like "fileSearchStores/123"
        console.log(`✅ Created File Search store: ${storeName}`);
        return storeName;
      }

      const error = await response.text();
      throw new Error(`Failed to create File Search store: ${response.status} - ${error}`);
    } catch (error) {
      console.error('Error creating File Search store:', error);
      throw error;
    }
  }

  /**
   * Get existing File Search store for a patient
   * Lists stores and finds the one matching the patient ID
   */
  async getFileSearchStore(patientId) {
    const storeDisplayName = `patient-${patientId}`;
    const url = `${this.baseUrl}/fileSearchStores?key=${this.apiKey}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }, 30000);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const stores = data.fileSearchStores || [];

      // Find store with matching display name
      const store = stores.find(s => s.displayName === storeDisplayName);
      if (store) {
        console.log(`ℹ️  Found existing File Search store: ${store.name}`);
        return store.name;
      }
      return null;
    } catch (error) {
      console.error('Error getting File Search store:', error);
      return null;
    }
  }

  /**
   * Upload document to File Search store
   * Uses the Files API first, then imports to File Search store
   * Returns the document name in the File Search store
   */
  async uploadDocumentToFileSearch(patientId, documentId, fileBuffer, mimeType, filename) {
    try {
      // Step 1: Upload file to Files API
      const fileUrl = `${this.baseUrl}/files?key=${this.apiKey}`;
      
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('metadata', JSON.stringify({
        name: filename
      }));
      formData.append('file', blob, filename);

      console.log(`📤 Uploading file to Gemini Files API: ${filename}`);

      const fileResponse = await this.fetchWithTimeout(fileUrl, {
        method: 'POST',
        body: formData
      }, 300000); // 5 min for large files

      if (!fileResponse.ok) {
        const error = await fileResponse.text();
        throw new Error(`File upload failed: ${fileResponse.status} - ${error}`);
      }

      const fileData = await fileResponse.json();
      const uploadedFileName = fileData.file?.name;

      if (!uploadedFileName) {
        throw new Error('File upload did not return file name');
      }

      console.log(`✅ File uploaded to Files API: ${uploadedFileName}`);

      // Step 2: Ensure File Search store exists
      const storeName = await this.createFileSearchStore(patientId);

      // Step 3: Import file into File Search store
      const importUrl = `${this.baseUrl}/${storeName}:importFile?key=${this.apiKey}`;

      const importResponse = await this.fetchWithTimeout(importUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: uploadedFileName
        })
      }, 30000);

      if (!importResponse.ok) {
        const error = await importResponse.text();
        throw new Error(`File Search import failed: ${importResponse.status} - ${error}`);
      }

      const importData = await importResponse.json();

      // Check if operation is complete
      if (importData.done) {
        const documentName = importData.response?.fileSearchDocument?.name;
        console.log(`✅ File imported to File Search: ${documentName}`);
        return documentName;
      }

      // If operation is async, poll for completion
      if (importData.name) {
        return await this.pollOperation(importData.name, documentId);
      }

      throw new Error('Unexpected response from File Search import');
    } catch (error) {
      console.error('Error uploading to File Search:', error);
      throw error;
    }
  }

  /**
   * Poll async operation until complete
   */
  async pollOperation(operationName, documentId, maxAttempts = 60) {
    // Extract operation name if full path provided
    const opName = operationName.includes('/') 
      ? operationName.split('/').pop() 
      : operationName;
    
    const url = `${this.baseUrl}/operations/${opName}?key=${this.apiKey}`;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }, 30000);

      if (!response.ok) {
        throw new Error(`Failed to poll operation: ${response.status}`);
      }

      const data = await response.json();

      if (data.done) {
        if (data.error) {
          throw new Error(`File Search operation failed: ${data.error.message}`);
        }
        const documentName = data.response?.fileSearchDocument?.name;
        console.log(`✅ File Search upload completed: ${documentName}`);
        return documentName;
      }

      attempts++;
      console.log(`⏳ Polling File Search operation (attempt ${attempts}/${maxAttempts})...`);
    }

    throw new Error('File Search upload operation timed out');
  }

  /**
   * Search documents using File Search tool
   * Returns answer text and citations
   */
  async searchDocuments(patientId, query, model = 'gemini-2.5-flash') {
    try {
      const storeName = await this.createFileSearchStore(patientId);
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

      const requestBody = {
        contents: [{ parts: [{ text: query }] }],
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [storeName]
          }
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      };

      console.log(`🔍 File Search query for patient ${patientId}: ${query}`);
      console.log(`   Store: ${storeName}`);

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }, 60000);

      if (!response.ok) {
        const error = await response.text();
        console.error(`File Search API error: ${response.status}`, error);
        throw new Error(`File Search query failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        console.warn('⚠️  File Search returned no candidate in response');
        return {
          text: '',
          citations: [],
          tokensUsed: 0,
          error: 'No response from File Search'
        };
      }

      const text = candidate?.content?.parts
        ?.filter(p => !p.thought)
        ?.map(p => p.text)
        ?.join('') || '';

      // Extract citations from grounding metadata
      const groundingMetadata = candidate?.groundingMetadata;
      const citations = this.extractCitations(groundingMetadata);

      console.log(`✅ File Search completed:`);
      console.log(`   - Citations: ${citations.length}`);
      console.log(`   - Text length: ${text.length} chars`);
      console.log(`   - Tokens used: ${data.usageMetadata?.totalTokenCount || 0}`);

      // Log detailed response for debugging if no citations
      if (citations.length === 0) {
        console.warn('⚠️  File Search returned no citations');
        console.log('   Response structure:', {
          hasText: text.length > 0,
          textPreview: text.substring(0, 300),
          hasGroundingMetadata: !!groundingMetadata,
          groundingMetadataKeys: groundingMetadata ? Object.keys(groundingMetadata) : null,
          candidateKeys: candidate ? Object.keys(candidate) : null
        });
      }

      return {
        text,
        citations,
        tokensUsed: data.usageMetadata?.totalTokenCount || 0
      };
    } catch (error) {
      console.error('Error searching with File Search:', error);
      throw error;
    }
  }

  /**
   * Extract citations from grounding metadata
   */
  extractCitations(groundingMetadata) {
    if (!groundingMetadata) return [];

    const citations = [];
    const chunks = groundingMetadata.groundingChunks || [];

    for (const chunk of chunks) {
      // Citations can be in different places in the response
      const fileSearchDocument = chunk.fileSearchDocument || 
                                 chunk.relevanceScore?.fileSearchDocument ||
                                 chunk.groundingChunkMetadata?.fileSearchDocument;
      
      if (fileSearchDocument) {
        citations.push({
          documentName: fileSearchDocument.name,
          displayName: fileSearchDocument.displayName || fileSearchDocument.name,
          relevanceScore: chunk.relevanceScore?.score || chunk.score || 0
        });
      }
    }

    // Also check for fileSearchChunks in groundingMetadata
    const fileSearchChunks = groundingMetadata.fileSearchChunks || [];
    for (const chunk of fileSearchChunks) {
      if (chunk.fileSearchDocument) {
        citations.push({
          documentName: chunk.fileSearchDocument.name,
          displayName: chunk.fileSearchDocument.displayName || chunk.fileSearchDocument.name,
          relevanceScore: chunk.relevanceScore || 0
        });
      }
    }

    // Remove duplicates based on documentName
    const uniqueCitations = [];
    const seen = new Set();
    for (const citation of citations) {
      if (!seen.has(citation.documentName)) {
        seen.add(citation.documentName);
        uniqueCitations.push(citation);
      }
    }

    return uniqueCitations;
  }

  /**
   * Delete document from File Search store
   */
  async deleteDocumentFromFileSearch(documentName) {
    if (!documentName) return;

    try {
      const url = `${this.baseUrl}/${documentName}?key=${this.apiKey}`;

      const response = await this.fetchWithTimeout(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      }, 30000);

      if (!response.ok && response.status !== 404) {
        const error = await response.text();
        throw new Error(`Failed to delete from File Search: ${response.status} - ${error}`);
      }

      console.log(`✅ Deleted document from File Search: ${documentName}`);
    } catch (error) {
      console.error('Error deleting from File Search:', error);
      // Don't throw - deletion is best effort
    }
  }

  /**
   * Convert buffer to base64
   */
  toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Fetch with timeout
   */
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

