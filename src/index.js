import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from './middleware/logger.js';
import auth from './routes/auth.js';
import patients from './routes/patients.js';
import documents from './routes/documents.js';
import processing from './routes/processing.js';
import views from './routes/views.js';
import timeline from './routes/timeline.js';
import medications from './routes/medications.js';
import alerts from './routes/alerts.js';
import labs from './routes/labs.js';
import history from './routes/history.js';
import decisions from './routes/decisions.js';
import diagnosis from './routes/diagnosis.js';
import treatment from './routes/treatment.js';

const app = new Hono();

// Logger middleware (first, to log everything)
app.use('/*', logger());

// CORS middleware
app.use('/*', cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5000', 
    'http://localhost:8000',
    'https://process.saarthihq.com',
    'https://saarthi-clinical-prod.jdr-rohan.workers.dev'
  ],
  credentials: true,
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

// Mount routes
app.route('/api/v1/auth', auth);
app.route('/api/v1/patients', patients);
app.route('/api/v1/patients/:patientId/documents', documents);
app.route('/api/v1/patients/:patientId/processing', processing);
app.route('/api/v1/patients/:patientId/timeline', timeline);
app.route('/api/v1/patients/:patientId/medications', medications);
app.route('/api/v1/patients/:patientId/alerts', alerts);
app.route('/api/v1/patients/:patientId/labs', labs);
app.route('/api/v1/patients/:patientId/history', history);
app.route('/api/v1/patients/:patientId/decisions', decisions);
app.route('/api/v1/patients', diagnosis);  // Diagnosis & Staging routes
app.route('/api/v1/patients', treatment);  // Treatment routes
app.route('/api/v1/patients/:patientId', views);

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

export default app;
