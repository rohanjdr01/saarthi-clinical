import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5000'],
  credentials: true,
}));

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({
    success: true,
    message: 'Saarthi Clinical Platform is running',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// Placeholder routes
app.get('/api/v1/patients', (c) => {
  return c.json({ success: true, data: [], message: 'Coming soon' });
});

export default app;