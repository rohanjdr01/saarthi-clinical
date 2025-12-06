import { Hono } from 'hono';
import { TimelineRepository } from '../repositories/timeline.repository.js';
import { NotFoundError, errorResponse } from '../utils/errors.js';

const timeline = new Hono();

// Get patient timeline
timeline.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const { from, to, types } = c.req.query();
    
    const timelineRepo = TimelineRepository(c.env.DB);
    const events = await timelineRepo.findByPatientId(patientId, { from, to, types });
    
    // Get document filenames for source documents
    const documentIds = [...new Set(events.map(e => e.source_document_id).filter(Boolean))];
    const documentSources = {};
    if (documentIds.length > 0) {
      const placeholders = documentIds.map(() => '?').join(',');
      const docs = await c.env.DB.prepare(`
        SELECT id, filename FROM documents WHERE id IN (${placeholders})
      `).bind(...documentIds).all();
      docs.results.forEach(doc => {
        documentSources[doc.id] = doc.filename;
      });
    }
    
    // Group events by date
    const eventsByDate = {};
    const trackAssignment = {};
    
    events.forEach(event => {
      const date = event.event_date;
      if (!eventsByDate[date]) {
        eventsByDate[date] = [];
      }
      
      // Assign to track
      if (!trackAssignment[event.event_type]) {
        trackAssignment[event.event_type] = event.event_type;
      }
      
      eventsByDate[date].push({
        id: event.id,
        type: event.event_type,
        category: event.event_category,
        title: event.title,
        description: event.description,
        track: event.event_type,
        source_document_id: event.source_document_id,
        source_document_filename: event.source_document_id ? documentSources[event.source_document_id] : null,
        confidence_score: event.confidence_score
      });
    });
    
    // Convert to timeline array
    const timeline = Object.entries(eventsByDate).map(([date, events]) => ({
      date,
      events
    }));
    
    // Group by track
    const tracks = {};
    events.forEach(event => {
      const track = event.event_type;
      if (!tracks[track]) {
        tracks[track] = [];
      }
      tracks[track].push(event.id);
    });
    
    // Find date range
    const dates = Object.keys(eventsByDate).sort();
    const dateRange = dates.length > 0 ? {
      earliest: dates[0],
      latest: dates[dates.length - 1]
    } : null;
    
    return c.json({
      success: true,
      patient_id: patientId,
      timeline,
      tracks,
      date_range: dateRange,
      total_events: events.length
    });
    
  } catch (error) {
    console.error('Error getting timeline:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Get timeline organized by tracks (for visualization)
timeline.get('/tracks', async (c) => {
  try {
    const { patientId } = c.req.param();
    
    const timelineRepo = TimelineRepository(c.env.DB);
    const tracks = await timelineRepo.findByPatientIdGroupedByTracks(patientId);
    
    return c.json({
      success: true,
      patient_id: patientId,
      tracks
    });
    
  } catch (error) {
    console.error('Error getting timeline tracks:', error);
    return c.json(errorResponse(error), 500);
  }
});

export default timeline;
