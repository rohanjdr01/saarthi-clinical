import { getCurrentTimestamp } from '../utils/helpers.js';

/**
 * Version history service for editable records
 */
export class VersionHistoryService {
  constructor(env) {
    this.db = env.DB;
  }

  async createVersion({
    recordType,
    recordId,
    patientId,
    fieldName,
    oldValue,
    newValue,
    userId,
    reason = null,
    originalSource = null,
    overrideSource = 'manual_override'
  }) {
    const id = `ver_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await this.db.prepare(`
      INSERT INTO data_versions (
        id, record_type, record_id, patient_id,
        field_name, old_value, new_value,
        edited_by, edited_at, edit_reason,
        original_source, override_source, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      recordType,
      recordId,
      patientId,
      fieldName,
      oldValue ?? null,
      newValue ?? null,
      userId,
      now,
      reason,
      originalSource,
      overrideSource,
      now
    ).run();

    return id;
  }

  async getHistory(recordType, recordId, fieldName = null) {
    let query = `
      SELECT * FROM data_versions
      WHERE record_type = ? AND record_id = ?
    `;
    const bindings = [recordType, recordId];

    if (fieldName) {
      query += ' AND field_name = ?';
      bindings.push(fieldName);
    }

    query += ' ORDER BY edited_at DESC';

    const result = await this.db.prepare(query).bind(...bindings).all();
    return result.results || [];
  }

  async rollback(versionId) {
    const version = await this.db.prepare(
      'SELECT * FROM data_versions WHERE id = ?'
    ).bind(versionId).first();

    if (!version) {
      throw new Error('Version not found');
    }

    return version;
  }
}
