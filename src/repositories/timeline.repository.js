/**
 * Timeline Repository (Data Access Layer)
 * Handles all database operations for timeline events
 */

export const TimelineRepository = (db) => ({
  /**
   * Find all timeline events for a patient with optional filters
   */
  findByPatientId: async (patientId, filters = {}) => {
    const { from, to, types } = filters;
    
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
    
    const result = await db.prepare(query).bind(...params).all();
    
    return result.results;
  },

  /**
   * Get timeline organized by tracks (for visualization)
   */
  findByPatientIdGroupedByTracks: async (patientId) => {
    const result = await db.prepare(`
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
    
    return Object.values(trackData);
  }
});

