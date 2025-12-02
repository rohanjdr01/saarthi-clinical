/**
 * Data Source Tracking Utility
 *
 * Provides field-level source tracking to identify whether data came from:
 * - A specific document (document_id)
 * - AI inference ("ai_inferred")
 * - Manual entry ("manual_entry")
 * - Manual override by admin ("manual_override")
 *
 * Data sources are stored as JSON in the data_sources field:
 * {
 *   field_name: {
 *     value: <current_value>,
 *     source: "doc_123" | "ai_inferred" | "manual_entry" | "manual_override",
 *     timestamp: <unix_timestamp>,
 *     confidence: <0-1> (optional, for AI inferred)
 *   }
 * }
 */

/**
 * Track the source of a field value
 * @param {Object} currentSources - Current data_sources JSON object
 * @param {string} fieldName - Name of the field being tracked
 * @param {any} value - Value of the field
 * @param {string} source - Source identifier (document_id, "ai_inferred", etc.)
 * @param {number} confidence - Confidence score (0-1, optional)
 * @returns {Object} Updated data_sources object
 */
export function trackFieldSource(currentSources = {}, fieldName, value, source, confidence = null) {
  const sources = typeof currentSources === 'string'
    ? JSON.parse(currentSources)
    : { ...currentSources };

  sources[fieldName] = {
    value,
    source,
    timestamp: Date.now(),
    ...(confidence !== null && { confidence })
  };

  return sources;
}

/**
 * Track multiple field sources at once
 * @param {Object} currentSources - Current data_sources JSON object
 * @param {Object} fields - Object with field names as keys and {value, source, confidence} as values
 * @returns {Object} Updated data_sources object
 */
export function trackMultipleFieldSources(currentSources = {}, fields) {
  let sources = typeof currentSources === 'string'
    ? JSON.parse(currentSources)
    : { ...currentSources };

  for (const [fieldName, fieldData] of Object.entries(fields)) {
    sources = trackFieldSource(
      sources,
      fieldName,
      fieldData.value,
      fieldData.source,
      fieldData.confidence
    );
  }

  return sources;
}

/**
 * Get the source of a specific field
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @param {string} fieldName - Name of the field
 * @returns {Object|null} Source information or null if not found
 */
export function getFieldSource(dataSources, fieldName) {
  if (!dataSources) return null;

  const sources = typeof dataSources === 'string'
    ? JSON.parse(dataSources)
    : dataSources;

  return sources[fieldName] || null;
}

/**
 * Get all fields from a specific source
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @param {string} sourceId - Source identifier to filter by
 * @returns {Object} Object with field names as keys
 */
export function getFieldsBySource(dataSources, sourceId) {
  if (!dataSources) return {};

  const sources = typeof dataSources === 'string'
    ? JSON.parse(dataSources)
    : dataSources;

  const result = {};
  for (const [fieldName, fieldData] of Object.entries(sources)) {
    if (fieldData.source === sourceId) {
      result[fieldName] = fieldData;
    }
  }

  return result;
}

/**
 * Get all AI-inferred fields
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @returns {Object} Object with field names as keys
 */
export function getAIInferredFields(dataSources) {
  return getFieldsBySource(dataSources, 'ai_inferred');
}

/**
 * Get all manually entered fields
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @returns {Object} Object with field names as keys
 */
export function getManualFields(dataSources) {
  const manualEntry = getFieldsBySource(dataSources, 'manual_entry');
  const manualOverride = getFieldsBySource(dataSources, 'manual_override');

  return { ...manualEntry, ...manualOverride };
}

/**
 * Check if a field was AI-inferred
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @param {string} fieldName - Name of the field
 * @returns {boolean} True if field was AI-inferred
 */
export function isAIInferred(dataSources, fieldName) {
  const source = getFieldSource(dataSources, fieldName);
  return source ? source.source === 'ai_inferred' : false;
}

/**
 * Check if a field was manually overridden
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @param {string} fieldName - Name of the field
 * @returns {boolean} True if field was manually overridden
 */
export function isManualOverride(dataSources, fieldName) {
  const source = getFieldSource(dataSources, fieldName);
  return source ? source.source === 'manual_override' : false;
}

/**
 * Check if a field came from a document
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @param {string} fieldName - Name of the field
 * @returns {boolean|string} Document ID if from document, false otherwise
 */
export function isFromDocument(dataSources, fieldName) {
  const source = getFieldSource(dataSources, fieldName);
  if (!source) return false;

  // Document IDs typically start with a prefix or are UUIDs
  if (source.source !== 'ai_inferred' &&
      source.source !== 'manual_entry' &&
      source.source !== 'manual_override') {
    return source.source; // Return the document ID
  }

  return false;
}

/**
 * Get confidence score for a field (if available)
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @param {string} fieldName - Name of the field
 * @returns {number|null} Confidence score or null
 */
export function getFieldConfidence(dataSources, fieldName) {
  const source = getFieldSource(dataSources, fieldName);
  return source?.confidence || null;
}

/**
 * Merge data sources from multiple records (e.g., when consolidating)
 * Newer timestamps take precedence
 * @param {Array<Object|string>} sourcesList - Array of data_sources objects
 * @returns {Object} Merged data_sources object
 */
export function mergeDataSources(...sourcesList) {
  const merged = {};

  for (const sources of sourcesList) {
    if (!sources) continue;

    const parsed = typeof sources === 'string'
      ? JSON.parse(sources)
      : sources;

    for (const [fieldName, fieldData] of Object.entries(parsed)) {
      // Keep the entry with the most recent timestamp
      if (!merged[fieldName] || fieldData.timestamp > merged[fieldName].timestamp) {
        merged[fieldName] = fieldData;
      }
    }
  }

  return merged;
}

/**
 * Create a summary of data sources for reporting
 * @param {Object|string} dataSources - data_sources JSON object or string
 * @returns {Object} Summary with counts by source type
 */
export function getSourceSummary(dataSources) {
  if (!dataSources) {
    return {
      total: 0,
      fromDocuments: 0,
      aiInferred: 0,
      manualEntry: 0,
      manualOverride: 0
    };
  }

  const sources = typeof dataSources === 'string'
    ? JSON.parse(dataSources)
    : dataSources;

  const summary = {
    total: 0,
    fromDocuments: 0,
    aiInferred: 0,
    manualEntry: 0,
    manualOverride: 0,
    documentIds: new Set()
  };

  for (const fieldData of Object.values(sources)) {
    summary.total++;

    switch (fieldData.source) {
      case 'ai_inferred':
        summary.aiInferred++;
        break;
      case 'manual_entry':
        summary.manualEntry++;
        break;
      case 'manual_override':
        summary.manualOverride++;
        break;
      default:
        // Assume it's a document ID
        summary.fromDocuments++;
        summary.documentIds.add(fieldData.source);
    }
  }

  // Convert Set to Array for JSON serialization
  summary.documentIds = Array.from(summary.documentIds);

  return summary;
}

/**
 * Prepare data sources for JSON storage in database
 * @param {Object} dataSources - data_sources object
 * @returns {string} JSON string
 */
export function serializeDataSources(dataSources) {
  return JSON.stringify(dataSources);
}

/**
 * Parse data sources from database
 * @param {string} dataSourcesString - JSON string from database
 * @returns {Object} Parsed data_sources object
 */
export function parseDataSources(dataSourcesString) {
  if (!dataSourcesString) return {};

  try {
    return typeof dataSourcesString === 'string'
      ? JSON.parse(dataSourcesString)
      : dataSourcesString;
  } catch (error) {
    console.error('Error parsing data sources:', error);
    return {};
  }
}

/**
 * Example usage:
 *
 * // Track a field from a document
 * let sources = trackFieldSource({}, 'primary_cancer_type', 'Breast Cancer', 'doc_abc123', 0.95);
 *
 * // Track an AI-inferred field
 * sources = trackFieldSource(sources, 'tumor_size_cm', 2.5, 'ai_inferred', 0.75);
 *
 * // Track multiple fields at once
 * sources = trackMultipleFieldSources(sources, {
 *   diagnosis_date: { value: '2024-01-15', source: 'doc_abc123' },
 *   histology: { value: 'Ductal carcinoma', source: 'doc_def456', confidence: 0.9 }
 * });
 *
 * // Query field sources
 * const cancerTypeSource = getFieldSource(sources, 'primary_cancer_type');
 * // => { value: 'Breast Cancer', source: 'doc_abc123', timestamp: 1234567890, confidence: 0.95 }
 *
 * const isAI = isAIInferred(sources, 'tumor_size_cm'); // => true
 *
 * const summary = getSourceSummary(sources);
 * // => { total: 4, fromDocuments: 2, aiInferred: 1, ... }
 */
