import { generateId, getCurrentTimestamp } from '../utils/helpers.js';

export class Patient {
  constructor(data) {
    this.id = data.id || generateId('pt');

    // External IDs
    this.booking_patient_id = data.booking_patient_id || null;
    this.external_mrn = data.external_mrn || null;
    this.patient_id_uhid = data.patient_id_uhid || null;
    this.patient_id_ipd = data.patient_id_ipd || null;

    // Demographics
    this.name = data.name;
    this.age = data.age || null;
    this.age_unit = data.age_unit || 'years';
    this.sex = data.sex || null;
    this.dob = data.dob || null;
    this.date_of_birth = data.date_of_birth || data.dob || null; // backward compatibility
    this.gender = data.gender || data.sex || null; // backward compatibility

    // Physical attributes
    this.blood_type = data.blood_type || null;
    this.height_cm = data.height_cm || null;
    this.weight_kg = data.weight_kg || null;
    this.bsa = data.bsa || null; // Body Surface Area

    // Clinical status
    this.ecog_status = data.ecog_status || null;
    this.current_status = data.current_status || null;
    this.current_status_detail = data.current_status_detail || null;

    // Care team
    this.primary_oncologist = data.primary_oncologist || null;
    this.primary_center = data.primary_center || null;

    // Preferences
    this.language_preference = data.language_preference || null;
    this.allergy_status = data.allergy_status || null;

    // Caregiver
    this.caregiver_name = data.caregiver?.name || data.caregiver_name || null;
    this.caregiver_relation = data.caregiver?.relation || data.caregiver_relation || null;
    this.caregiver_contact = data.caregiver?.contact || data.caregiver_contact || null;

    // Status
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

    const validGenders = ['male', 'female', 'other'];
    if (data.gender && !validGenders.includes(data.gender.toLowerCase())) {
      errors.push('Gender must be male, female, or other');
    }
    if (data.sex && !validGenders.includes(data.sex.toLowerCase())) {
      errors.push('Sex must be male, female, or other');
    }

    const validAgeUnits = ['years', 'months', 'days'];
    if (data.age_unit && !validAgeUnits.includes(data.age_unit.toLowerCase())) {
      errors.push('Age unit must be years, months, or days');
    }

    if (data.ecog_status !== null && data.ecog_status !== undefined) {
      if (data.ecog_status < 0 || data.ecog_status > 5) {
        errors.push('ECOG status must be between 0 and 5');
      }
    }

    if (data.height_cm && data.height_cm < 0) {
      errors.push('Height must be positive');
    }

    if (data.weight_kg && data.weight_kg < 0) {
      errors.push('Weight must be positive');
    }

    if (data.bsa && data.bsa < 0) {
      errors.push('BSA must be positive');
    }

    const validAllergyStatus = ['none', 'documented', 'unknown'];
    if (data.allergy_status && !validAllergyStatus.includes(data.allergy_status.toLowerCase())) {
      errors.push('Allergy status must be none, documented, or unknown');
    }

    return errors;
  }

  toJSON() {
    // Rationalize: Use primary field, fallback to backward compatibility field if primary is null
    const dob = this.dob || this.date_of_birth;
    const sex = this.sex || this.gender;

    return {
      id: this.id,

      // External IDs
      booking_patient_id: this.booking_patient_id,
      external_mrn: this.external_mrn,
      patient_id_uhid: this.patient_id_uhid,
      patient_id_ipd: this.patient_id_ipd,

      // Demographics (rationalized - no redundant fields)
      name: this.name,
      age: this.age,
      age_unit: this.age_unit,
      sex: sex, // Use sex as primary, gender as fallback
      dob: dob, // Use dob as primary, date_of_birth as fallback

      // Physical attributes
      blood_type: this.blood_type,
      height_cm: this.height_cm,
      weight_kg: this.weight_kg,
      bsa: this.bsa,

      // Clinical status
      ecog_status: this.ecog_status,
      current_status: this.current_status,
      current_status_detail: this.current_status_detail,

      // Care team
      primary_oncologist: this.primary_oncologist,
      primary_center: this.primary_center,

      // Preferences
      language_preference: this.language_preference,
      allergy_status: this.allergy_status,

      // Caregiver
      caregiver: this.caregiver_name ? {
        name: this.caregiver_name,
        relation: this.caregiver_relation,
        contact: this.caregiver_contact
      } : null,

      // Status
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  toDBRow() {
    return {
      id: this.id,

      // External IDs
      booking_patient_id: this.booking_patient_id,
      external_mrn: this.external_mrn,
      patient_id_uhid: this.patient_id_uhid,
      patient_id_ipd: this.patient_id_ipd,

      // Demographics
      name: this.name,
      age: this.age,
      age_unit: this.age_unit,
      sex: this.sex,
      dob: this.dob,
      date_of_birth: this.date_of_birth,
      gender: this.gender,

      // Physical attributes
      blood_type: this.blood_type,
      height_cm: this.height_cm,
      weight_kg: this.weight_kg,
      bsa: this.bsa,

      // Clinical status
      ecog_status: this.ecog_status,
      current_status: this.current_status,
      current_status_detail: this.current_status_detail,

      // Care team
      primary_oncologist: this.primary_oncologist,
      primary_center: this.primary_center,

      // Preferences
      language_preference: this.language_preference,
      allergy_status: this.allergy_status,

      // Caregiver
      caregiver_name: this.caregiver_name,
      caregiver_relation: this.caregiver_relation,
      caregiver_contact: this.caregiver_contact,

      // Status
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
