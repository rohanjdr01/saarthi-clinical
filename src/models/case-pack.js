import { generateId, getCurrentTimestamp } from '../utils/helpers.js';

export class CasePack {
  constructor(data) {
    this.id = data.id || generateId('cp');
    this.patient_id = data.patient_id;

    this.title = data.title || null;
    this.description = data.description || null;

    this.created_at = data.created_at || getCurrentTimestamp();
    this.updated_at = data.updated_at || getCurrentTimestamp();
  }

  static validate(data) {
    const errors = [];

    if (!data.patient_id) {
      errors.push('Patient ID is required');
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      patient_id: this.patient_id,
      title: this.title,
      description: this.description,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new CasePack(row);
  }
}
