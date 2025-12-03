/**
 * Cloudflare Vectorize integration with Workers AI embeddings
 *
 * Notes:
 * - If VECTORIZE binding is absent, operations will be skipped with a status.
 * - Supports multiple embedding models via EMBEDDING_MODEL env var.
 * - Default: bge-large-en-v1.5 (1024 dimensions) for better quality.
 * - Falls back to deterministic hashing for local dev when AI binding unavailable.
 */

// Model configurations
const EMBEDDING_MODELS = {
  'bge-base-en-v1.5': {
    model: '@cf/baai/bge-base-en-v1.5',
    dimensions: 768
  },
  'bge-large-en-v1.5': {
    model: '@cf/baai/bge-large-en-v1.5',
    dimensions: 1024
  }
};

const DEFAULT_TOP_K = 5;

// Get model config from env or default to large model
function getEmbeddingModel(env) {
  const modelName = env.EMBEDDING_MODEL || 'bge-large-en-v1.5';
  return EMBEDDING_MODELS[modelName] || EMBEDDING_MODELS['bge-large-en-v1.5'];
}

async function createEmbedding(env, text, modelOverride = null) {
  const modelConfig = modelOverride || getEmbeddingModel(env);
  const VECTOR_DIMENSION = modelConfig.dimensions;
  
  // Use Workers AI if available (production)
  if (env.AI) {
    try {
      const response = await env.AI.run(modelConfig.model, {
        text: [text]
      });
      
      // Handle different response formats from Workers AI
      let embedding;
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        embedding = response.data[0];
      } else if (Array.isArray(response) && response.length > 0) {
        embedding = response[0];
      } else if (Array.isArray(response)) {
        embedding = response;
      } else {
        embedding = response;
      }
      
      // Ensure we have an array of numbers
      if (!Array.isArray(embedding)) {
        throw new Error('Embedding response is not an array');
      }
      
      // Validate dimensions match expected size
      if (embedding.length !== VECTOR_DIMENSION) {
        console.warn(`Warning: Embedding dimension mismatch. Expected ${VECTOR_DIMENSION}, got ${embedding.length}`);
        // If dimensions don't match, pad or truncate to match
        if (embedding.length < VECTOR_DIMENSION) {
          embedding = [...embedding, ...new Array(VECTOR_DIMENSION - embedding.length).fill(0)];
        } else {
          embedding = embedding.slice(0, VECTOR_DIMENSION);
        }
      }
      
      return embedding;
    } catch (error) {
      console.error('Workers AI embedding failed:', error);
      // Fall through to deterministic hash
    }
  }

  // Fallback: Simple deterministic hashing for local/dev
  const values = new Array(VECTOR_DIMENSION).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = i % VECTOR_DIMENSION;
    values[idx] += code / 255; // normalize roughly
  }
  return values;
}

/**
 * Improved chunking strategy with overlap for better context preservation
 * Smaller chunks (1000 chars) with 200 char overlap work better for semantic search
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text) return [];
  
  // Try to parse as JSON and chunk by logical sections
  try {
    const parsed = JSON.parse(text);
    return chunkJSON(parsed, chunkSize);
  } catch {
    // Not JSON, use sentence-aware chunking
  }
  
  // Sentence-aware chunking with overlap
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      // Start new chunk with overlap
      const words = currentChunk.split(/\s+/);
      const overlapText = words.slice(-Math.floor(overlap / 10)).join(' ');
      currentChunk = overlapText + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Chunk JSON by logical sections (diagnosis, treatment, medications, etc.)
 * This preserves semantic meaning better than character-based chunking
 */
function chunkJSON(obj, maxSize = 1000) {
  const chunks = [];
  
  // Create chunks for major sections
  const sections = ['diagnosis', 'treatment', 'medications', 'labs', 'alerts', 'timeline_events', 'clinical_decisions'];
  
  for (const section of sections) {
    if (obj[section]) {
      const sectionText = JSON.stringify(obj[section]);
      if (sectionText.length <= maxSize) {
        chunks.push(JSON.stringify({ [section]: obj[section] }));
      } else {
        // Split large sections using regular chunking
        const subChunks = chunkText(sectionText, maxSize, 200);
        subChunks.forEach(chunk => {
          try {
            chunks.push(JSON.stringify({ [section]: JSON.parse(chunk) }));
          } catch {
            chunks.push(chunk); // Fallback if not valid JSON
          }
        });
      }
    }
  }
  
  // Add patient demographics to each chunk as context
  if (obj.patient_demographics && chunks.length > 0) {
    return chunks.map(chunk => {
      try {
        const parsed = JSON.parse(chunk);
        return JSON.stringify({ ...parsed, patient_demographics: obj.patient_demographics });
      } catch {
        return chunk;
      }
    });
  }
  
  return chunks.length > 0 ? chunks : [JSON.stringify(obj)];
}

export async function vectorizeDocument(env, { documentId, patientId, text, metadata = {} }) {
  if (!env || !env.VECTORIZE) {
    return { status: 'skipped', reason: 'VECTORIZE binding not configured' };
  }

  if (!text || text.trim().length === 0) {
    return { status: 'skipped', reason: 'No text content to vectorize' };
  }

  const modelConfig = getEmbeddingModel(env);
  const chunks = chunkText(text, 1000, 200); // Smaller chunks with overlap for better context
  if (chunks.length === 0) {
    return { status: 'skipped', reason: 'No text chunks generated' };
  }

  const now = Date.now();

  // Generate embeddings for all chunks
  const vectors = [];
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    try {
      const values = await createEmbedding(env, chunk, modelConfig);
      
      // Validate embedding dimensions
      if (!Array.isArray(values) || values.length !== modelConfig.dimensions) {
        throw new Error(`Invalid embedding dimensions: expected ${modelConfig.dimensions}, got ${values?.length || 0}`);
      }

      vectors.push({
        id: `${documentId}#${idx}`,
        values,
        metadata: {
          document_id: String(documentId),
          patient_id: String(patientId), // Ensure consistent string type for filtering
          chunk_index: idx,
          text: chunk,
          created_at: now,
          ...metadata
        }
      });
    } catch (error) {
      console.error(`Failed to create embedding for chunk ${idx}:`, error);
      return { status: 'failed', error: `Embedding generation failed: ${error.message}` };
    }
  }

  if (vectors.length === 0) {
    return { status: 'failed', error: 'No vectors generated' };
  }

  try {
    await env.VECTORIZE.upsert(vectors);
    return { status: 'completed', chunks: chunks.length };
  } catch (error) {
    // Check if this is the "needs to run remotely" error (local dev mode)
    if (error.message?.includes('needs to be run remotely') || error.remote === true) {
      console.warn('⚠️  Vectorize not available in local dev mode - skipping');
      return { status: 'skipped', reason: 'Vectorize requires remote mode (local dev)' };
    }
    
    // Check for dimension mismatch errors
    if (error.message?.includes('dimension') || error.message?.includes('dimensions')) {
      console.error('Vectorize dimension mismatch:', error);
      return { status: 'failed', error: `Dimension mismatch: ${error.message}. Ensure index dimensions (${modelConfig.dimensions}) match embedding model output.` };
    }
    
    console.error('Vectorize upsert failed:', error);
    return { status: 'failed', error: error.message || 'Unknown error during vector upsert' };
  }
}

export async function searchDocuments(env, { patientId, query, topK = DEFAULT_TOP_K }) {
  if (!env || !env.VECTORIZE) {
    return { status: 'skipped', reason: 'VECTORIZE binding not configured', results: [] };
  }

  if (!query || query.trim().length === 0) {
    return { status: 'failed', error: 'Query is required', results: [] };
  }

  const modelConfig = getEmbeddingModel(env);
  const vector = await createEmbedding(env, query, modelConfig);
  
  // Validate embedding dimensions
  if (!Array.isArray(vector) || vector.length !== modelConfig.dimensions) {
    return { status: 'failed', error: `Invalid query embedding dimensions: expected ${modelConfig.dimensions}, got ${vector?.length || 0}`, results: [] };
  }

  try {
    // Build query options
    // Get more results initially for better context, then slice to requested topK
    const queryOptions = {
      topK: Math.max(1, Math.min(topK * 2, 100)), // Get more results for better context
      returnMetadata: true,
      returnValues: false // We don't need the actual vector values
    };

    // Add filter if patientId is provided
    // Note: Vectorize filters work on metadata fields with exact match
    // Ensure patient_id is a string to match how we store it
    if (patientId) {
      queryOptions.filter = { patient_id: String(patientId) };
    }

    console.log('Vectorize query options:', {
      topK: queryOptions.topK,
      hasFilter: !!queryOptions.filter,
      filterValue: queryOptions.filter?.patient_id,
      model: modelConfig.model,
      dimensions: modelConfig.dimensions
    });
    
    const searchResult = await env.VECTORIZE.query(vector, queryOptions);

    // Log search results for debugging
    const matchesCount = searchResult.matches?.length || 0;
    console.log('Vectorize search result:', {
      matchesCount,
      hasMatches: matchesCount > 0,
      firstMatch: searchResult.matches?.[0] ? {
        id: searchResult.matches[0].id,
        score: searchResult.matches[0].score,
        patient_id: searchResult.matches[0].metadata?.patient_id,
        document_id: searchResult.matches[0].metadata?.document_id
      } : null
    });

    // If no results with filter, try without filter to see if vectors exist
    // (This helps debug if the issue is with the filter or if no vectors exist)
    if (matchesCount === 0 && patientId) {
      console.warn('No results with patient filter, trying without filter to check if vectors exist...');
      const unfilteredResult = await env.VECTORIZE.query(vector, {
        topK: 20, // Get more results to see what's in the index
        returnMetadata: true,
        returnValues: false
      });
      
      if (unfilteredResult.matches && unfilteredResult.matches.length > 0) {
        const requestedPatientIdStr = String(patientId);
        // Filter client-side to see if any match the patient
        const matchingResults = unfilteredResult.matches.filter(m => 
          String(m.metadata?.patient_id) === requestedPatientIdStr
        );
        
        console.warn('Found vectors without filter:', {
          totalMatches: unfilteredResult.matches.length,
          matchingPatientId: matchingResults.length,
          samplePatientIds: unfilteredResult.matches.slice(0, 5).map(m => ({
            id: m.id,
            patient_id: m.metadata?.patient_id,
            patient_id_type: typeof m.metadata?.patient_id,
            matches: String(m.metadata?.patient_id) === requestedPatientIdStr
          })),
          requestedPatientId: requestedPatientIdStr,
          requestedPatientIdType: typeof patientId
        });
        
        // If client-side filtering found matches, use those instead
        if (matchingResults.length > 0) {
          console.warn('Using client-side filtered results (Vectorize filter may not be working)');
          const results = matchingResults.slice(0, topK).map(match => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata || {},
            document_id: match.metadata?.document_id,
            patient_id: match.metadata?.patient_id,
            chunk_index: match.metadata?.chunk_index,
            text: match.metadata?.text,
            document_type: match.metadata?.document_type,
            category: match.metadata?.category,
            subcategory: match.metadata?.subcategory
          }));
          
          return {
            status: 'completed',
            results: results
          };
        }
      } else {
        console.warn('No vectors found even without filter - vectors may not be indexed yet or query vector is invalid');
      }
    }

    // Process and format results (slice to requested topK)
    const results = (searchResult.matches || []).slice(0, topK).map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
      // Extract document info from metadata
      document_id: match.metadata?.document_id,
      patient_id: match.metadata?.patient_id,
      chunk_index: match.metadata?.chunk_index,
      text: match.metadata?.text,
      document_type: match.metadata?.document_type,
      category: match.metadata?.category,
      subcategory: match.metadata?.subcategory
    }));

    return {
      status: 'completed',
      results: results
    };
  } catch (error) {
    // Check if this is the "needs to run remotely" error (local dev mode)
    if (error.message?.includes('needs to be run remotely') || error.remote === true) {
      console.warn('⚠️  Vectorize not available in local dev mode - skipping search');
      return { status: 'skipped', reason: 'Vectorize requires remote mode (local dev)', results: [] };
    }
    console.error('Vectorize query failed:', error);
    return { status: 'failed', error: error.message || 'Unknown error during vector search', results: [] };
  }
}

export async function deleteDocumentVectors(env, documentId) {
  if (!env || !env.VECTORIZE) {
    return { status: 'skipped', reason: 'VECTORIZE binding not configured' };
  }

  try {
    // Delete all chunks for this document
    // Vector IDs are formatted as `${documentId}#${chunkIndex}`
    // We need to delete all possible chunks (up to a reasonable limit)
    // Note: Vectorize doesn't support prefix-based deletion, so we delete known chunk IDs
    const vectorIdsToDelete = [];
    // Try deleting chunks 0-99 (reasonable limit for document chunks)
    for (let idx = 0; idx < 100; idx++) {
      vectorIdsToDelete.push(`${documentId}#${idx}`);
    }
    
    await env.VECTORIZE.deleteByIds(vectorIdsToDelete);
    return { status: 'completed' };
  } catch (error) {
    // Check if this is the "needs to run remotely" error (local dev mode)
    if (error.message?.includes('needs to be run remotely') || error.remote === true) {
      console.warn('⚠️  Vectorize not available in local dev mode - skipping delete');
      return { status: 'skipped', reason: 'Vectorize requires remote mode (local dev)' };
    }
    console.error('Vectorize delete failed:', error);
    return { status: 'failed', error: error.message };
  }
}
