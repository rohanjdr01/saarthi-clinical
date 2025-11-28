import { generateId, getCurrentTimestamp } from '../utils/helpers.js';

export class Patient {
  constructor(data) {
    this.id = data.id || generateId('pt');
    this.booking_patient_id = data.booking_patient_id || null;
    this.external_mrn = data.external_mrn || null;
    
    this.name = data.name;
    this.age = data.age || null;
    this.date_of_birth = data.date_of_birth || null;
    this.gender = data.gender || null;
    
    this.caregiver_name = data.caregiver?.name || null;
    this.caregiver_relation = data.caregiver?.relation || null;
    this.caregiver_contact = data.caregiver?.contact || null;
    
    this.status = data.status || 'active';
    this.created_at = data.created_at || getCurrentTimestamp();
    this.updated_at = data.updated_at || getCurrentTimestamp();
  }

  static validate(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }
    
    if (data.age && (data.age < 0 || data.age > 150)) {
      errors.push('Age must be between 0 and 150');
    }
    
    if (data.gender && !['male', 'female', 'other'].includes(data.gender.toLowerCase())) {
      errors.push('Gender must be male, female, or other');
    }
    
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      booking_patient_id: this.booking_patient_id,
      external_mrn: this.external_mrn,
      name: this.name,
      age: this.age,
      date_of_birth: this.date_of_birth,
      gender: this.gender,
      caregiver: this.caregiver_name ? {
        name: this.caregiver_name,
        relation: this.caregiver_relation,
        contact: this.caregiver_contact
      } : null,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  toDBRow() {
    return {
      id: this.id,
      booking_patient_id: this.booking_patient_id,
      external_mrn: this.external_mrn,
      name: this.name,
      age: this.age,
      date_of_birth: this.date_of_birth,
      gender: this.gender,
      caregiver_name: this.caregiver_name,
      caregiver_relation: this.caregiver_relation,
      caregiver_contact: this.caregiver_contact,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new Patient({
      ...row,
      caregiver: row.caregiver_name ? {
        name: row.caregiver_name,
        relation: row.caregiver_relation,
        contact: row.caregiver_contact
      } : null
    });
  }
}
