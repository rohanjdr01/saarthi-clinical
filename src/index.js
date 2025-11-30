import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from './middleware/logger.js';
import patients from './routes/patients.js';
import documents from './routes/documents.js';
import casePacks from './routes/case-packs.js';
import processing from './routes/processing.js';
import views from './routes/views.js';
import timeline from './routes/timeline.js';
import intake from './routes/intake.js';

const app = new Hono();

// Logger middleware (first, to log everything)
app.use('/*', logger());

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:8000'],
  credentials: true,
}));

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

// Mount routes
app.route('/api/v1/intake', intake);
app.route('/api/v1/patients', patients);
app.route('/api/v1/patients/:patientId/documents', documents);
app.route('/api/v1/patients/:patientId/case-pack', casePacks);
app.route('/api/v1/patients/:patientId/processing', processing);
app.route('/api/v1/patients/:patientId/timeline', timeline);
app.route('/api/v1/patients/:patientId', views);

export default app;
