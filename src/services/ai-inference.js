/**
 * AI Inference Service (placeholder)
 *
 * Intentionally minimal to avoid changing current providers.
 * Extend with actual model calls and schema mappings as needed.
 */
export class AIInferenceService {
  constructor(env) {
    this.env = env;
  }

  async inferMissingData(patientId) {
    // Stub: return not implemented to avoid accidental calls
    return {
      status: 'not_implemented',
      patient_id: patientId
    };
  }
}
