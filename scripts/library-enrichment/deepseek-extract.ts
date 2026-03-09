#!/usr/bin/env npx tsx

/**
 * DeepSeek API Integration for Targeted RAG Enrichment
 *
 * Calls DeepSeek's chat completion endpoint to extract missing field values
 * from provided medical textbook excerpts.
 *
 * Environment variable: DEEPSEEK_API_KEY
 */

interface ExtractionRequest {
  entityType: 'Condition' | 'Drug';
  entityName: string;
  missingField: string;
  contextText: string; // relevant excerpt from PDF
  existingValues: Record<string, any>;
}

interface ExtractionResult {
  success: boolean;
  extractedValue?: any;
  error?: string;
  rawResponse?: string;
}

/**
 * Call DeepSeek API with a prompt to extract missing field.
 */
export async function extractMissingField(
  request: ExtractionRequest
): Promise<ExtractionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY environment variable is required');
  }

  const prompt = buildExtractionPrompt(request);
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const payload = {
    model,
    messages: [
      { role: 'system', content: 'You are a medical expert specializing in board exam content.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 500,
  };

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API request failed with status ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        success: false,
        error: 'Empty response from DeepSeek',
        rawResponse: JSON.stringify(data),
      };
    }

    // Parse the extracted value based on field type
    const extracted = parseExtractedValue(request.missingField, content);
    return {
      success: true,
      extractedValue: extracted,
      rawResponse: content,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Build a prompt tailored to the field and context.
 */
function buildExtractionPrompt(req: ExtractionRequest): string {
  const { entityType, entityName, missingField, contextText, existingValues } = req;

  const fieldDescriptions: Record<string, string> = {
    // MedicalContent fields
    overview: 'a concise overview paragraph (approx 150-300 characters)',
    gold_standard_dx: 'the gold standard diagnostic test or criteria (short phrase)',
    first_line_rx: 'first-line treatment recommendation (short phrase)',
    best_initial_test: 'best initial diagnostic test (short phrase)',
    complications: 'common complications (short description)',
    diagnostics: 'diagnostic approach (short description)',
    differentialDiagnosis: 'differential diagnosis list (short phrases)',
    epidemiology: 'epidemiology facts (e.g., incidence, prevalence)',
    etiology: 'etiology/cause (short description)',
    pathophysiology: 'pathophysiology description (1-2 sentences)',
    physicalExam: 'physical exam findings (short description)',
    prognosis: 'prognosis (short description)',
    riskFactors: 'risk factors (short description)',
    symptoms: 'common symptoms (short description)',
    treatment: 'treatment approach (short description)',
    classic_triad: 'classic triad (three key features) as JSON array',
    clinical_pearls: 'clinical pearls as JSON array of strings',
    age_demographic: 'age demographic as JSON object',
    classic_patient: 'classic patient presentation (short phrase)',
    differentials: 'differential diagnoses as JSON array',
    disposition: 'disposition (short phrase)',
    gender_bias: 'gender bias (short phrase)',
    guidelines: 'guidelines (short phrase)',
    image_query: 'image query (short phrase)',
    mnemonic: 'mnemonic (short phrase)',
    patient_education: 'patient education points (short description)',
    prevention: 'prevention strategies (short description)',
    synonyms: 'synonyms as JSON array',
    // Drug fields
    mechanismOfAction: 'mechanism of action description (1-2 sentences)',
    dosing: 'typical dosing regimen (e.g., "500 mg PO BID")',
    brandName: 'brand/trade name (e.g., "Lipitor")',
    sideEffects: 'array of common side effects (as JSON array of strings)',
    indications: 'array of FDA-approved indications (as JSON array of strings)',
    contraindications: 'array of contraindications (as JSON array of strings)',
    drugClass: 'drug class(es) as JSON array of strings',
    clinicalNotes: 'clinical notes (short description)',
    elimination: 'elimination route (short phrase)',
    metabolism: 'metabolism description (short phrase)',
    absorption: 'absorption characteristics (short phrase)',
    administrationTips: 'administration tips (short phrase)',
    bioavailability: 'bioavailability (short phrase)',
    blackBoxWarnings: 'black box warnings as JSON array of strings',
    boardYieldFacts: 'board yield facts as JSON array of strings',
    clinicalPearls: 'clinical pearls as JSON array of strings',
    commonMistakes: 'common mistakes as JSON array of strings',
    cyp450Effects: 'CYP450 effects as JSON object',
    distribution: 'distribution characteristics (short phrase)',
    duration: 'duration of action (short phrase)',
    eliminationRoute: 'elimination route (short phrase)',
    foodInteractions: 'food interactions as JSON array of strings',
    formulations: 'formulations as JSON array of strings',
    genericAvailable: 'generic availability (boolean)',
    geriatricDosing: 'geriatric dosing (short phrase)',
    geriatricNotes: 'geriatric notes (short phrase)',
    halfLife: 'half-life (short phrase)',
    hepaticDosing: 'hepatic dosing adjustments (short phrase)',
    insuranceTier: 'insurance tier (number)',
    isFirstLine: 'first-line status (boolean)',
    lactationNotes: 'lactation notes (short phrase)',
    lactationSafety: 'lactation safety (short phrase)',
    majorInteractions: 'major drug interactions as JSON array',
    maxDailyDose: 'maximum daily dose (short phrase)',
    mechanismDetailed: 'detailed mechanism of action (short description)',
    metabolismDetail: 'detailed metabolism description (short phrase)',
    mnemonics: 'mnemonics as JSON array of strings',
    monitoringParams: 'monitoring parameters as JSON array of strings',
    onsetOfAction: 'onset of action (short phrase)',
    peakEffect: 'peak effect (short phrase)',
    pediatricDosing: 'pediatric dosing (short phrase)',
    pediatricNotes: 'pediatric notes (short phrase)',
    pharmacokinetics: 'pharmacokinetics as JSON object',
    pregnancyCategory: 'pregnancy category (short phrase)',
    pregnancyNotes: 'pregnancy notes (short phrase)',
    renalDosing: 'renal dosing adjustments (short phrase)',
    reversalAgent: 'reversal agent (short phrase)',
    riskStrategies: 'risk mitigation strategies as JSON array of strings',
    routesOfAdmin: 'routes of administration as JSON array of strings',
    storageRequirements: 'storage requirements (short phrase)',
    testQuestionTips: 'test question tips as JSON array of strings',
    toxicity: 'toxicity symptoms (short phrase)',
    typicalCost: 'typical cost (short phrase)',
  };

  const desc = fieldDescriptions[missingField] || missingField;

  let existingContext = '';
  if (Object.keys(existingValues).length > 0) {
    existingContext = 'Existing known values for this entity:\n';
    for (const [key, val] of Object.entries(existingValues)) {
      if (val !== null && val !== undefined && val !== '') {
        existingContext += `- ${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}\n`;
      }
    }
  }

  return `You are a medical expert. Given the following excerpt from a medical textbook about **${entityName}**, extract the **${missingField}** (${desc}).

${existingContext}

---
**Textbook Excerpt:**
${contextText}
---

Instructions:
- Extract only the requested information. If the excerpt does not contain the information, respond with "NOT_FOUND".
- Provide the extracted value exactly as it would appear in a medical database: concise, factual, and without extra commentary.
- For array fields (sideEffects, indications), output a valid JSON array of strings.
- For text fields, output a plain string.

Extracted ${missingField}:`;
}

/**
 * Parse the extracted text based on field type.
 */
function parseExtractedValue(field: string, rawText: string): any {
  const trimmed = rawText.trim();
  if (trimmed === 'NOT_FOUND') {
    return null;
  }

  // Remove any surrounding quotes or markdown code fences
  let cleaned = trimmed.replace(/^["'`]|["'`]$/g, '').replace(/^```json\s*|```$/g, '').trim();

  // Determine field type based on known patterns
  const isArrayField = (f: string): boolean => {
    const arrayFields = [
      'sideEffects', 'indications', 'contraindications', 'drugClass',
      'blackBoxWarnings', 'boardYieldFacts', 'clinicalPearls', 'commonMistakes',
      'foodInteractions', 'formulations', 'mnemonics', 'monitoringParams',
      'riskStrategies', 'routesOfAdmin', 'testQuestionTips',
      'classic_triad', 'clinical_pearls', 'differentials', 'synonyms',
    ];
    return arrayFields.includes(f);
  };

  const isJsonObjectField = (f: string): boolean => {
    const jsonFields = [
      'cyp450Effects', 'pharmacokinetics', 'age_demographic',
    ];
    return jsonFields.includes(f);
  };

  // Handle array fields
  if (isArrayField(field)) {
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
      }
    } catch {
      // Fallback: split by commas or newlines
      const items = cleaned.split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.toLowerCase().includes('not found'));
      return items;
    }
  }

  // Handle JSON object fields
  if (isJsonObjectField(field)) {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {
      // If not valid JSON, treat as plain text (maybe a string representation)
      return cleaned;
    }
  }

  // For boolean fields (genericAvailable, isFirstLine)
  if (field === 'genericAvailable' || field === 'isFirstLine') {
    const lower = cleaned.toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === '1') return true;
    if (lower === 'false' || lower === 'no' || lower === '0') return false;
    // fallback
  }

  // For numeric fields (insuranceTier, pance_yield)
  if (field === 'insuranceTier' || field === 'pance_yield') {
    const num = Number(cleaned);
    if (!isNaN(num)) return num;
  }

  // For text fields, return cleaned string
  return cleaned;
}

/**
 * Test function (run directly).
 */
async function test() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('Skipping test: DEEPSEEK_API_KEY not set');
    return;
  }

  const request: ExtractionRequest = {
    entityType: 'Condition',
    entityName: 'Urinary Retention',
    missingField: 'gold_standard_dx',
    contextText: `Urinary retention is the inability to empty the bladder completely. Diagnosis is confirmed by urodynamic studies, which measure bladder pressure and flow. The gold standard test is pressure‑flow study (urodynamics).`,
    existingValues: {
      overview: 'Urinary retention is the inability to completely or partially empty the bladder.',
      first_line_rx: 'Catheterization',
    },
  };

  console.log('🧪 Testing DeepSeek extraction...');
  const result = await extractMissingField(request);
  console.log('Result:', JSON.stringify(result, null, 2));
}

if (process.argv[1] === import.meta.url) {
  test().catch(console.error);
}