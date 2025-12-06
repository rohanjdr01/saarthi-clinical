/**
 * Staging Snapshot Repository (Data Access Layer)
 * Handles all database operations for staging snapshots
 */

import { getCurrentTimestamp } from '../utils/helpers.js';

export const StagingSnapshotRepository = (db) => ({
  /**
   * Create a new staging snapshot
   */
  create: async (snapshot) => {
    const result = await db.prepare(`
      INSERT INTO staging_snapshots (
        id, patient_id, document_id, staging_type, staging_date,
        staging_system, clinical_tnm, pathological_tnm, overall_stage,
        notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshot.id,
      snapshot.patient_id,
      snapshot.document_id || null,
      snapshot.staging_type || 'initial',
      snapshot.staging_date || null,
      snapshot.staging_system || null,
      snapshot.clinical_tnm || null,
      snapshot.pathological_tnm || null,
      snapshot.overall_stage || null,
      snapshot.notes || null,
      snapshot.created_at || getCurrentTimestamp()
    ).run();

    return snapshot;
  },

  /**
   * Find all staging snapshots for a patient
   */
  findByPatientId: async (patientId) => {
    const result = await db.prepare(`
      SELECT * FROM staging_snapshots
      WHERE patient_id = ?
      ORDER BY staging_date DESC, created_at DESC
    `).bind(patientId).all();

    return result.results;
  },

  /**
   * Find the latest staging snapshot for a patient
   */
  findLatest: async (patientId) => {
    const row = await db.prepare(`
      SELECT * FROM staging_snapshots
      WHERE patient_id = ?
      ORDER BY staging_date DESC, created_at DESC
      LIMIT 1
    `).bind(patientId).first();

    return row || null;
  },

  /**
   * Find staging snapshot by ID
   */
  findById: async (snapshotId) => {
    const row = await db.prepare(`
      SELECT * FROM staging_snapshots
      WHERE id = ?
    `).bind(snapshotId).first();

    return row || null;
  },

  /**
   * Update staging snapshot
   */
  update: async (snapshotId, updates) => {
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return null;
    }

    values.push(snapshotId);

    await db.prepare(`
      UPDATE staging_snapshots
      SET ${fields.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    return await db.prepare(`
      SELECT * FROM staging_snapshots WHERE id = ?
    `).bind(snapshotId).first();
  },

  /**
   * Delete staging snapshot
   */
  delete: async (snapshotId) => {
    await db.prepare(`
      DELETE FROM staging_snapshots
      WHERE id = ?
    `).bind(snapshotId).run();

    return true;
  }
});

