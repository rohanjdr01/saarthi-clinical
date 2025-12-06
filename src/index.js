import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from './middleware/logger.js';
import auth from './routes/auth.js';
import patients from './routes/patients.js';
import documents from './routes/documents.js';
import processing from './routes/processing.js';
import timeline from './routes/timeline.js';
import medications from './routes/medications.js';
import alerts from './routes/alerts.js';
import history from './routes/history.js';
import decisions from './routes/decisions.js';
import diagnosis from './routes/diagnosis.js';
import treatment from './routes/treatment.js';
import { DocumentProcessor } from './services/processing/processor.js';
import { DocumentRepository } from './repositories/document.repository.js';

const app = new Hono();

// Logger middleware (first, to log everything)
app.use('/*', logger());

// CORS middleware
app.use('/*', cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5000', 
    'http://localhost:5173', // Vite dev server
    'http://localhost:8000',
    'https://process.saarthihq.com',
    'https://saarthi-clinical-prod.jdr-rohan.workers.dev'
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Saarthi Clinical Platform',
    version: '1.0.0',
    status: 'operational',
    docs: '/api/v1/health',
      endpoints: {
        health: '/api/v1/health',
        auth: '/api/v1/auth',
        patients: '/api/v1/patients'
      }
  });
});

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({
    success: true,
    message: 'Saarthi Clinical Platform is running',
    timestamp: new Date().toISOString(),
    environment: c.env?.ENVIRONMENT || 'development',
    services: {
      database: !!c.env.DB,
      storage: !!c.env.DOCUMENTS,
      cache: !!c.env.CACHE,
      gemini: !!c.env.GEMINI_API_KEY,
      openai: !!c.env.OPENAI_API_KEY
    }
  });
});

// Database diagnostic endpoint
app.get('/api/v1/health/db', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({
        success: false,
        error: 'DB binding not found in environment',
        diagnostic: {
          hasDB: false,
          envKeys: Object.keys(c.env || {}),
          environment: c.env?.ENVIRONMENT || 'unknown'
        }
      }, 500);
    }

    // Test basic query
    const testQuery = await c.env.DB.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="patients"').first();
    
    if (!testQuery) {
      return c.json({
        success: false,
        error: 'patients table not found',
        diagnostic: {
          hasDB: true,
          tableExists: false,
          allTables: await c.env.DB.prepare('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name').all().then(r => r.results.map(t => t.name))
        }
      }, 500);
    }

    // Test actual query
    const patientCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM patients').first();

    return c.json({
      success: true,
      message: 'Database connection successful',
      diagnostic: {
        hasDB: true,
        tableExists: true,
        patientCount: patientCount?.count || 0,
        databaseId: c.env.DB?.database_id || 'unknown',
        environment: c.env?.ENVIRONMENT || 'unknown'
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
      diagnostic: {
        hasDB: !!c.env.DB,
        errorType: error.constructor.name,
        stack: error.stack
      }
    }, 500);
  }
});

// R2 Storage diagnostic endpoint
app.get('/api/v1/health/storage', async (c) => {
  try {
    if (!c.env.DOCUMENTS) {
      return c.json({
        success: false,
        error: 'R2 DOCUMENTS binding not found',
        diagnostic: {
          hasDocuments: false,
          environment: c.env?.ENVIRONMENT || 'unknown'
        }
      }, 500);
    }

    // Get recent documents from DB
    const recentDocs = await c.env.DB.prepare(`
      SELECT id, filename, storage_key, file_size, processing_status, created_at
      FROM documents
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    // Check if each document exists in R2
    const storageChecks = [];
    for (const doc of recentDocs.results || []) {
      const r2Object = await c.env.DOCUMENTS.get(doc.storage_key);
      storageChecks.push({
        document_id: doc.id,
        filename: doc.filename,
        storage_key: doc.storage_key,
        db_size: doc.file_size,
        r2_exists: !!r2Object,
        r2_size: r2Object?.size || null,
        processing_status: doc.processing_status,
        created_at: doc.created_at
      });
    }

    return c.json({
      success: true,
      message: 'R2 storage check completed',
      diagnostic: {
        hasDocuments: true,
        totalDocumentsInDB: recentDocs.results?.length || 0,
        recentDocuments: storageChecks,
        environment: c.env?.ENVIRONMENT || 'unknown'
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
      diagnostic: {
        hasDocuments: !!c.env.DOCUMENTS,
        errorType: error.constructor.name,
        stack: error.stack
      }
    }, 500);
  }
});

// Mount routes
app.route('/api/v1/auth', auth);
app.route('/api/v1/patients', patients);
app.route('/api/v1/patients/:patientId/documents', documents);
app.route('/api/v1/patients/:patientId/processing', processing);
app.route('/api/v1/patients/:patientId/timeline', timeline);
app.route('/api/v1/patients/:patientId/medications', medications);
app.route('/api/v1/patients/:patientId/alerts', alerts);
app.route('/api/v1/patients/:patientId/history', history);
app.route('/api/v1/patients/:patientId/decisions', decisions);
app.route('/api/v1/patients', diagnosis);  // Diagnosis & Staging routes
app.route('/api/v1/patients', treatment);  // Treatment routes

// Catch-all 404 handler
app.all('*', (c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      available_routes: [
        'GET /',
        'GET /api/v1/health',
        'POST /api/v1/auth/verify',
        'GET /api/v1/auth/me',
        'GET /api/v1/patients',
        'POST /api/v1/patients'
      ]
    }
  }, 404);
});

// Export both HTTP handler and queue consumer
// Cloudflare expects both handlers in the default export object
export default {
  // HTTP handler (Hono app)
  fetch: app.fetch.bind(app),

  // Queue consumer for document processing
  async queue(batch, env, ctx) {
    // Process each message in the batch
    for (const message of batch.messages) {
      let job = null;
      try {
        job = typeof message.body === 'string' ? JSON.parse(message.body) : message.body;
        
        console.log(`📥 Processing queue job:`, {
          documentId: job.documentId,
          mode: job.mode,
          provider: job.provider,
          attempt: message.attempts || 0
        });

        // Validate job
        if (!job.documentId) {
          console.error('❌ Invalid job: missing documentId');
          message.ack();
          continue;
        }

        // Diagnostic: Check environment bindings
        console.log(`🔍 Queue environment check:`, {
          hasDB: !!env.DB,
          hasDocuments: !!env.DOCUMENTS,
          hasVectorize: !!env.VECTORIZE,
          hasAI: !!env.AI,
          hasGeminiKey: !!env.GEMINI_API_KEY,
          hasOpenAIKey: !!env.OPENAI_API_KEY
        });

        // Verify document exists in DB and R2
        const doc = await env.DB.prepare('SELECT * FROM documents WHERE id = ?')
          .bind(job.documentId)
          .first();
        
        if (!doc) {
          // On first attempt, this might be a timing issue - retry
          if ((message.attempts || 0) === 0) {
            console.warn(`⚠️ Document ${job.documentId} not found in database on first attempt - will retry`);
            throw new Error(`Document ${job.documentId} not found in database (timing issue - retrying)`);
          }
          
          // After retries, this is a real error - acknowledge to prevent infinite loop
          console.error(`❌ Document ${job.documentId} not found in database after retries - acknowledging`);
          message.ack();
          continue;
        }

        console.log(`📄 Document metadata:`, {
          id: doc.id,
          patient_id: doc.patient_id,
          filename: doc.filename,
          storage_key: doc.storage_key,
          mime_type: doc.mime_type,
          processing_status: doc.processing_status
        });

        // Check if file exists in R2
        const r2Object = await env.DOCUMENTS.get(doc.storage_key);
        if (!r2Object) {
          throw new Error(`Document file not found in R2 at key: ${doc.storage_key}`);
        }

        console.log(`📦 R2 object found:`, {
          storage_key: doc.storage_key,
          size: r2Object.size,
          uploaded: r2Object.uploaded?.toISOString()
        });

        // Initialize processor with env
        const processor = new DocumentProcessor(env, { provider: job.provider });

        // Process based on mode
        if (job.mode === 'fast') {
          // Fast mode: quick highlight + vectorize
          console.log(`⚡ Starting fast processing for ${doc.filename}`);
          await processor.processDocumentFast(job.documentId, { provider: job.provider });
        } else {
          // Full mode: complete extraction + patient sync
          console.log(`🔬 Starting full processing for ${doc.filename}`);
          await processor.processDocument(job.documentId, {
            mode: job.mode === 'full' ? 'incremental' : job.mode,
            provider: job.provider
          });
        }

        console.log(`✅ Successfully processed document ${job.documentId} (${doc.filename}) in ${job.mode} mode`);
        message.ack();

      } catch (error) {
        console.error(`❌ Error processing queue message:`, {
          error: error.message,
          stack: error.stack,
          documentId: job?.documentId,
          mode: job?.mode,
          attempt: message.attempts || 0
        });

        // Update document status to failed
        try {
          if (job?.documentId && env.DB) {
            const docRepo = DocumentRepository(env.DB);
            await docRepo.updateProcessingStatus(
              job.documentId,
              'failed',
              `Queue error: ${error.message}`
            );
            console.log(`Updated document ${job.documentId} status to failed`);
          }
        } catch (updateError) {
          console.error('Failed to update document status:', {
            error: updateError.message,
            documentId: job?.documentId
          });
        }

        // Retry logic: retry up to 3 times, then acknowledge to prevent infinite loops
        const retries = message.attempts || 0;
        if (retries < 3) {
          console.log(`🔄 Retrying message (attempt ${retries + 1}/3)`);
          message.retry({ delaySeconds: Math.min(60, Math.pow(2, retries) * 5) });
        } else {
          console.error(`❌ Max retries reached for document ${job?.documentId}, acknowledging to prevent infinite loop`);
          message.ack();
        }
      }
    }
  }
};
