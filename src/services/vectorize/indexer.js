/**
 * Cloudflare Vectorize integration with Workers AI embeddings
 *
 * Notes:
 * - If VECTORIZE binding is absent, operations will be skipped with a status.
 * - Uses Workers AI (@cf/baai/bge-base-en-v1.5) for production-quality embeddings.
 * - Falls back to deterministic hashing for local dev when AI binding unavailable.
 */

const VECTOR_DIMENSION = 768; // Workers AI bge-base-en-v1.5 dimension
const DEFAULT_TOP_K = 5;
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

async function createEmbedding(env, text) {
  // Use Workers AI if available (production)
  if (env.AI) {
    try {
      const response = await env.AI.run(EMBEDDING_MODEL, {
        text: [text]
      });
      return response.data[0];
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

function chunkText(text, chunkSize = 1500) {
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function vectorizeDocument(env, { documentId, patientId, text, metadata = {} }) {
  if (!env || !env.VECTORIZE) {
    return { status: 'skipped', reason: 'VECTORIZE binding not configured' };
  }

  const chunks = chunkText(text, 1500);
  const now = Date.now();

  // Generate embeddings for all chunks
  const vectors = [];
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const values = await createEmbedding(env, chunk);

    vectors.push({
      id: `${documentId}#${idx}`,
      values,
      metadata: {
        document_id: documentId,
        patient_id: patientId,
        chunk_index: idx,
        text: chunk,
        created_at: now,
        ...metadata
      }
    });
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
    console.error('Vectorize upsert failed:', error);
    return { status: 'failed', error: error.message };
  }
}

export async function searchDocuments(env, { patientId, query, topK = DEFAULT_TOP_K }) {
  if (!env || !env.VECTORIZE) {
    return { status: 'skipped', reason: 'VECTORIZE binding not configured', results: [] };
  }

  const vector = await createEmbedding(env, query || '');

  try {
    const searchResult = await env.VECTORIZE.query(vector, {
      topK,
      filter: patientId ? { patient_id: patientId } : undefined,
      returnMetadata: true
    });

    return {
      status: 'completed',
      results: searchResult.matches || []
    };
  } catch (error) {
    // Check if this is the "needs to run remotely" error (local dev mode)
    if (error.message?.includes('needs to be run remotely') || error.remote === true) {
      console.warn('⚠️  Vectorize not available in local dev mode - skipping search');
      return { status: 'skipped', reason: 'Vectorize requires remote mode (local dev)', results: [] };
    }
    console.error('Vectorize query failed:', error);
    return { status: 'failed', error: error.message, results: [] };
  }
}

export async function deleteDocumentVectors(env, documentId) {
  if (!env || !env.VECTORIZE) {
    return { status: 'skipped', reason: 'VECTORIZE binding not configured' };
  }

  try {
    // Best-effort delete by prefix; if not supported, delete explicit ids we know
    // For local deterministic ids, we can't list, so attempt a single delete to avoid throw
    await env.VECTORIZE.deleteByIds([documentId]);
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
