export class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async generateContent({ 
    prompt, 
    model = 'gemini-2.0-flash-thinking-exp-01-21',
    thinkingLevel = 'low',  // low, medium, high
    temperature = 0.1 
  }) {
    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 8192,
      }
    };

    // Add thinking config for thinking models
    if (model.includes('thinking')) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingLevel: thinkingLevel
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Extract text and thinking from response
    let text = '';
    let thinking = '';
    
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.thought) {
        thinking += part.text || '';
      } else if (part.text) {
        text += part.text;
      }
    }
    
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
    
    // Clean markdown code blocks from final output
    if (text) {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    return {
      text,
      thinking,  // The model's reasoning process
      tokensUsed,
      model
    };
  }

  async extractFromDocument({ documentText, documentType, thinkingLevel = 'medium' }) {
    const prompt = this.getExtractionPrompt(documentType, documentText);
    
    return await this.generateContent({
      prompt,
      thinkingLevel,
      temperature: 0.1
    });
  }

  getExtractionPrompt(documentType, documentText) {
    // Specialized prompts based on document type
    const prompts = {
      pathology: `You are analyzing a pathology report. Extract comprehensive oncological information.

Document:
${documentText}

Extract and return a JSON object with this EXACT structure:
{
  "patient_demographics": {
    "name": "patient name or null",
    "age": "age or null",
    "gender": "gender or null"
  },
  "primary_diagnosis": {
    "cancer_type": "specific cancer type",
    "histology": "histological type",
    "grade": "tumor grade",
    "location": "anatomical location"
  },
  "staging": {
    "clinical_stage": "cTNM if available",
    "pathological_stage": "pTNM if available",
    "stage_group": "overall stage (I, II, III, IV)",
    "tnm_details": {
      "t": "T staging details",
      "n": "N staging details",
      "m": "M staging details"
    }
  },
  "molecular_markers": {
    "marker_name": {
      "status": "positive/negative/value",
      "method": "testing method",
      "interpretation": "clinical significance"
    }
  },
  "key_findings": ["finding 1", "finding 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "document_date": "YYYY-MM-DD"
}

Return ONLY valid JSON, no markdown, no explanations.`,

      imaging: `You are analyzing a radiology/imaging report.

Document:
${documentText}

Extract and return a JSON object:
{
  "study_type": "CT/MRI/PET/X-ray",
  "study_date": "YYYY-MM-DD",
  "indication": "reason for study",
  "findings": {
    "primary_lesion": {
      "location": "anatomical location",
      "size": "measurements",
      "characteristics": "description"
    },
    "metastases": ["location 1", "location 2"],
    "other_findings": ["finding 1", "finding 2"]
  },
  "impression": "radiologist's conclusion",
  "comparison": "comparison to prior studies if mentioned"
}

Return ONLY valid JSON.`,

      lab: `You are analyzing laboratory results.

Document:
${documentText}

Extract and return a JSON object:
{
  "test_date": "YYYY-MM-DD",
  "test_type": "type of lab work",
  "results": [
    {
      "test_name": "name",
      "value": "result value",
      "unit": "unit of measurement",
      "reference_range": "normal range",
      "flag": "high/low/normal"
    }
  ],
  "interpretation": "clinical interpretation if provided"
}

Return ONLY valid JSON.`,

      consultation: `You are analyzing a consultation note.

Document:
${documentText}

Extract and return a JSON object:
{
  "consultation_date": "YYYY-MM-DD",
  "consulting_physician": "doctor name and specialty",
  "reason_for_consultation": "reason",
  "assessment": "physician's assessment",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "plan": "treatment or management plan"
}

Return ONLY valid JSON.`,

      default: `Extract structured clinical information from this document.

Document Type: ${documentType}
Document:
${documentText}

Return a JSON object with relevant clinical information.`
    };

    return prompts[documentType] || prompts.default;
  }

  async generateSummary({ 
    patientId, 
    allExtractedData, 
    existingSummary = null,
    thinkingLevel = 'high'  // Use high thinking for summaries
  }) {
    const prompt = `You are generating a comprehensive clinical summary for an oncology patient.

${existingSummary ? `Existing Summary:\n${JSON.stringify(existingSummary, null, 2)}\n\n` : ''}

All Extracted Clinical Data:
${JSON.stringify(allExtractedData, null, 2)}

Generate a structured clinical summary as JSON with these sections:

{
  "patient_details": {
    "summary": "One-line patient description",
    "demographics": {}
  },
  "diagnosis_staging": {
    "summary": "Primary diagnosis and stage in one sentence",
    "detailed": {
      "primary_diagnosis": {},
      "staging": {},
      "molecular_markers": {}
    }
  },
  "treating_physicians": {
    "summary": "Key physicians involved",
    "detailed": []
  },
  "treatment_history": {
    "summary": "Overview of treatments",
    "detailed": []
  },
  "current_status": {
    "summary": "Current clinical status",
    "detailed": {}
  },
  "key_findings": ["most important clinical findings"],
  "active_issues": ["current concerns or problems"]
}

Think deeply about the clinical significance and provide a coherent, accurate summary.
Return ONLY valid JSON.`;

    return await this.generateContent({
      prompt,
      thinkingLevel,
      temperature: 0.2
    });
  }

  async extractTimelineEvents({ 
    extractedData, 
    existingTimeline = [],
    thinkingLevel = 'medium'
  }) {
    const prompt = `You are extracting timeline events from clinical data.

Extracted Clinical Data:
${JSON.stringify(extractedData, null, 2)}

${existingTimeline.length > 0 ? `Existing Timeline Events:\n${JSON.stringify(existingTimeline, null, 2)}\n\n` : ''}

Extract timeline events as a JSON array. Each event should have:
{
  "date": "YYYY-MM-DD",
  "event_type": "diagnosis|treatment|imaging|lab|symptom|procedure|decision",
  "event_category": "category for grouping",
  "title": "Brief event title",
  "description": "Detailed description",
  "clinical_significance": "Why this matters",
  "source_reference": "Where this came from in the document"
}

Identify key clinical milestones, treatment decisions, diagnostic findings, and important changes.
Return ONLY a JSON array of events, sorted by date.`;

    return await this.generateContent({
      prompt,
      thinkingLevel,
      temperature: 0.1
    });
  }

  async analyzeRiskFactors({
    patientData,
    thinkingLevel = 'high'
  }) {
    const prompt = `You are analyzing risk factors for an oncology patient.

Patient Clinical Data:
${JSON.stringify(patientData, null, 2)}

Analyze and return a JSON object:
{
  "disease_risk_factors": [
    {
      "factor": "risk factor name",
      "category": "modifiable|non-modifiable|treatment-related",
      "severity": "low|moderate|high",
      "evidence": "why this is a risk",
      "recommendations": "what to do about it"
    }
  ],
  "prognostic_factors": [
    {
      "factor": "prognostic factor",
      "impact": "favorable|unfavorable|neutral",
      "explanation": "clinical significance"
    }
  ],
  "treatment_considerations": ["important considerations for treatment planning"],
  "monitoring_recommendations": ["what should be monitored and how often"]
}

Think carefully about clinical evidence and guidelines.
Return ONLY valid JSON.`;

    return await this.generateContent({
      prompt,
      thinkingLevel,
      temperature: 0.2
    });
  }
}
