import { Hono } from 'hono';
import { NotFoundError, errorResponse } from '../utils/errors.js';

const timeline = new Hono();

// Get patient timeline
timeline.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const { from, to, types } = c.req.query();
    
    // Build query
    let query = 'SELECT * FROM timeline_events WHERE patient_id = ?';
    const params = [patientId];
    
    if (from) {
      query += ' AND event_date >= ?';
      params.push(from);
    }
    
    if (to) {
      query += ' AND event_date <= ?';
      params.push(to);
    }
    
    if (types) {
      const typeList = types.split(',').map(t => `'${t}'`).join(',');
      query += ` AND event_type IN (${typeList})`;
    }
    
    query += ' ORDER BY event_date ASC';
    
    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();
    
    // Group events by date
    const eventsByDate = {};
    const trackAssignment = {};
    
    result.results.forEach(event => {
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
    result.results.forEach(event => {
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
      total_events: result.results.length
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
    
    const result = await c.env.DB.prepare(`
      SELECT * FROM timeline_events 
      WHERE patient_id = ?
      ORDER BY event_date ASC
    `).bind(patientId).all();
    
    // Organize by track/event_type
    const trackData = {};
    
    result.results.forEach(event => {
      const track = event.event_type;
      if (!trackData[track]) {
        trackData[track] = {
          track_name: track,
          events: []
        };
      }
      
      trackData[track].events.push({
        id: event.id,
        date: event.event_date,
        title: event.title,
        description: event.description,
        category: event.event_category
      });
    });
    
    return c.json({
      success: true,
      patient_id: patientId,
      tracks: Object.values(trackData)
    });
    
  } catch (error) {
    console.error('Error getting timeline tracks:', error);
    return c.json(errorResponse(error), 500);
  }
});

export default timeline;
