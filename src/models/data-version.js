/**
 * Data Version Model
 *
 * Handles version history for all editable fields across all tables.
 * Tracks admin edits, allows rollback, and maintains audit trail.
 */

import { nanoid } from 'nanoid';

export class DataVersion {
  /**
   * Create a version entry when a field is edited
   * @param {Object} env - Cloudflare Workers environment
   * @param {Object} params - Version parameters
   * @returns {Promise<Object>} Created version record
   */
  static async createVersion(env, {
    recordType,
    recordId,
    patientId,
    fieldName,
    oldValue,
    newValue,
    editedBy,
    editReason = null,
    originalSource = null,
    overrideSource = 'manual_override'
  }) {
    const id = nanoid();
    const timestamp = Date.now();

    const version = {
      id,
      record_type: recordType,
      record_id: recordId,
      patient_id: patientId,
      field_name: fieldName,
      old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
      new_value: newValue !== null && newValue !== undefined ? String(newValue) : null,
      edited_by: editedBy,
      edited_at: timestamp,
      edit_reason: editReason,
      original_source: originalSource,
      override_source: overrideSource,
      created_at: timestamp
    };

    const stmt = env.DB.prepare(`
      INSERT INTO data_versions (
        id, record_type, record_id, patient_id, field_name,
        old_value, new_value, edited_by, edited_at, edit_reason,
        original_source, override_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      version.id,
      version.record_type,
      version.record_id,
      version.patient_id,
      version.field_name,
      version.old_value,
      version.new_value,
      version.edited_by,
      version.edited_at,
      version.edit_reason,
      version.original_source,
      version.override_source,
      version.created_at
    );

    await stmt.run();

    return version;
  }

  /**
   * Create version entries for multiple fields at once
   * @param {Object} env - Cloudflare Workers environment
   * @param {Object} baseParams - Base parameters (recordType, recordId, patientId, editedBy, etc.)
   * @param {Array<Object>} fields - Array of {fieldName, oldValue, newValue, originalSource}
   * @returns {Promise<Array>} Array of created version records
   */
  static async createMultipleVersions(env, baseParams, fields) {
    const versions = [];

    for (const field of fields) {
      const version = await DataVersion.createVersion(env, {
        ...baseParams,
        fieldName: field.fieldName,
        oldValue: field.oldValue,
        newValue: field.newValue,
        originalSource: field.originalSource || null
      });
      versions.push(version);
    }

    return versions;
  }

  /**
   * Get version history for a specific record
   * @param {Object} env - Cloudflare Workers environment
   * @param {string} recordType - Type of record (patients, diagnosis, treatment, etc.)
   * @param {string} recordId - ID of the record
   * @returns {Promise<Array>} Array of version records
   */
  static async getVersionHistory(env, recordType, recordId) {
    const stmt = env.DB.prepare(`
      SELECT * FROM data_versions
      WHERE record_type = ? AND record_id = ?
      ORDER BY edited_at DESC
    `).bind(recordType, recordId);

    const result = await stmt.all();
    return result.results || [];
  }

  /**
   * Get version history for a specific field
   * @param {Object} env - Cloudflare Workers environment
   * @param {string} recordType - Type of record
   * @param {string} recordId - ID of the record
   * @param {string} fieldName - Name of the field
   * @returns {Promise<Array>} Array of version records for that field
   */
  static async getFieldVersionHistory(env, recordType, recordId, fieldName) {
    const stmt = env.DB.prepare(`
      SELECT * FROM data_versions
      WHERE record_type = ? AND record_id = ? AND field_name = ?
      ORDER BY edited_at DESC
    `).bind(recordType, recordId, fieldName);

    const result = await stmt.all();
    return result.results || [];
  }

  /**
   * Get all versions for a patient (across all records)
   * @param {Object} env - Cloudflare Workers environment
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} Array of version records
   */
  static async getPatientVersionHistory(env, patientId) {
    const stmt = env.DB.prepare(`
      SELECT * FROM data_versions
      WHERE patient_id = ?
      ORDER BY edited_at DESC
    `).bind(patientId);

    const result = await stmt.all();
    return result.results || [];
  }

  /**
   * Get a specific version by ID
   * @param {Object} env - Cloudflare Workers environment
   * @param {string} versionId - Version ID
   * @returns {Promise<Object|null>} Version record or null
   */
  static async getVersion(env, versionId) {
    const stmt = env.DB.prepare(`
      SELECT * FROM data_versions WHERE id = ?
    `).bind(versionId);

    const result = await stmt.first();
    return result || null;
  }

  /**
   * Rollback a field to a previous version
   * @param {Object} env - Cloudflare Workers environment
   * @param {string} versionId - Version ID to rollback to
   * @param {string} editedBy - User performing the rollback
   * @param {string} reason - Reason for rollback
   * @returns {Promise<Object>} Result with updated record info
   */
  static async rollbackToVersion(env, versionId, editedBy, reason = 'Rollback to previous version') {
    // Get the version to rollback to
    const version = await DataVersion.getVersion(env, versionId);

    if (!version) {
      throw new Error('Version not found');
    }

    // Get the current value from the actual table
    const currentValue = await DataVersion._getCurrentFieldValue(
      env,
      version.record_type,
      version.record_id,
      version.field_name
    );

    // Create a new version entry for the rollback
    const rollbackVersion = await DataVersion.createVersion(env, {
      recordType: version.record_type,
      recordId: version.record_id,
      patientId: version.patient_id,
      fieldName: version.field_name,
      oldValue: currentValue,
      newValue: version.old_value, // Rollback to the old value from the version
      editedBy,
      editReason: reason,
      originalSource: version.original_source,
      overrideSource: 'manual_override'
    });

    // Update the actual record
    await DataVersion._updateFieldValue(
      env,
      version.record_type,
      version.record_id,
      version.field_name,
      version.old_value
    );

    return {
      success: true,
      rolledBackTo: version.old_value,
      versionCreated: rollbackVersion
    };
  }

  /**
   * Get the current value of a field from the database
   * @private
   */
  static async _getCurrentFieldValue(env, recordType, recordId, fieldName) {
    const stmt = env.DB.prepare(`
      SELECT ${fieldName} FROM ${recordType} WHERE id = ?
    `).bind(recordId);

    const result = await stmt.first();
    return result ? result[fieldName] : null;
  }

  /**
   * Update a field value in the database
   * @private
   */
  static async _updateFieldValue(env, recordType, recordId, fieldName, newValue) {
    const stmt = env.DB.prepare(`
      UPDATE ${recordType}
      SET ${fieldName} = ?, updated_at = ?
      WHERE id = ?
    `).bind(newValue, Date.now(), recordId);

    await stmt.run();
  }

  /**
   * Get edit summary for a record (who edited what when)
   * @param {Object} env - Cloudflare Workers environment
   * @param {string} recordType - Type of record
   * @param {string} recordId - ID of the record
   * @returns {Promise<Object>} Summary of edits
   */
  static async getEditSummary(env, recordType, recordId) {
    const versions = await DataVersion.getVersionHistory(env, recordType, recordId);

    const summary = {
      totalEdits: versions.length,
      fieldsEdited: new Set(),
      editors: new Set(),
      lastEditedAt: null,
      lastEditedBy: null,
      editsByField: {}
    };

    for (const version of versions) {
      summary.fieldsEdited.add(version.field_name);
      summary.editors.add(version.edited_by);

      if (!summary.lastEditedAt || version.edited_at > summary.lastEditedAt) {
        summary.lastEditedAt = version.edited_at;
        summary.lastEditedBy = version.edited_by;
      }

      if (!summary.editsByField[version.field_name]) {
        summary.editsByField[version.field_name] = 0;
      }
      summary.editsByField[version.field_name]++;
    }

    // Convert Sets to Arrays for JSON serialization
    summary.fieldsEdited = Array.from(summary.fieldsEdited);
    summary.editors = Array.from(summary.editors);

    return summary;
  }

  /**
   * Compare two versions to see what changed
   * @param {Object} version1 - First version
   * @param {Object} version2 - Second version
   * @returns {Object} Comparison result
   */
  static compareVersions(version1, version2) {
    return {
      fieldName: version1.field_name,
      from: {
        value: version1.new_value,
        editedBy: version1.edited_by,
        editedAt: version1.edited_at
      },
      to: {
        value: version2.new_value,
        editedBy: version2.edited_by,
        editedAt: version2.edited_at
      },
      timeBetweenEdits: version2.edited_at - version1.edited_at
    };
  }

  /**
   * Delete version history for a record (when record is deleted)
   * @param {Object} env - Cloudflare Workers environment
   * @param {string} recordType - Type of record
   * @param {string} recordId - ID of the record
   * @returns {Promise<void>}
   */
  static async deleteVersionHistory(env, recordType, recordId) {
    const stmt = env.DB.prepare(`
      DELETE FROM data_versions
      WHERE record_type = ? AND record_id = ?
    `).bind(recordType, recordId);

    await stmt.run();
  }

  /**
   * Get audit trail for compliance/reporting
   * @param {Object} env - Cloudflare Workers environment
   * @param {Object} filters - Filters (patientId, recordType, startDate, endDate, editedBy)
   * @returns {Promise<Array>} Filtered version records
   */
  static async getAuditTrail(env, filters = {}) {
    let query = 'SELECT * FROM data_versions WHERE 1=1';
    const bindings = [];

    if (filters.patientId) {
      query += ' AND patient_id = ?';
      bindings.push(filters.patientId);
    }

    if (filters.recordType) {
      query += ' AND record_type = ?';
      bindings.push(filters.recordType);
    }

    if (filters.editedBy) {
      query += ' AND edited_by = ?';
      bindings.push(filters.editedBy);
    }

    if (filters.startDate) {
      query += ' AND edited_at >= ?';
      bindings.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND edited_at <= ?';
      bindings.push(filters.endDate);
    }

    query += ' ORDER BY edited_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      bindings.push(filters.limit);
    }

    const stmt = env.DB.prepare(query).bind(...bindings);
    const result = await stmt.all();

    return result.results || [];
  }
}

/**
 * Example usage:
 *
 * // Create a version when editing a field
 * await DataVersion.createVersion(env, {
 *   recordType: 'diagnosis',
 *   recordId: 'diag_123',
 *   patientId: 'patient_456',
 *   fieldName: 'primary_cancer_type',
 *   oldValue: 'Breast Cancer',
 *   newValue: 'Breast Cancer - Invasive Ductal Carcinoma',
 *   editedBy: 'user_789',
 *   editReason: 'Updated based on pathology report'
 * });
 *
 * // Get version history for a record
 * const history = await DataVersion.getVersionHistory(env, 'diagnosis', 'diag_123');
 *
 * // Rollback to a previous version
 * await DataVersion.rollbackToVersion(env, 'version_id', 'user_789', 'Incorrect edit');
 *
 * // Get audit trail
 * const audit = await DataVersion.getAuditTrail(env, {
 *   patientId: 'patient_456',
 *   startDate: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
 *   limit: 100
 * });
 */
