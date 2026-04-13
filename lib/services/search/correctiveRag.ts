/**
 * Corrective RAG (CRAG) Grader Service
 *
 * Validates retrieved documents against queries before LLM synthesis.
 * Uses lightweight heuristic-based grading (<5ms) with keyword overlap,
 * TF weighting, and medical term matching. Triggers fallback retrieval
 * when overall quality is too low.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface RetrievedDocument {
  id: string;
  text: string;
  score: number;
  source: string;
}

export interface GradeResult {
  document: RetrievedDocument;
  relevant: boolean;
  confidence: number;  // 0-1
  reason: string;
}

export interface CRAGResult {
  accepted: RetrievedDocument[];
  rejected: GradeResult[];
  qualityScore: number;
  fallbackTriggered: boolean;
  sources: ('primary' | 'fallback')[];
}

export interface CRAGConfig {
  minRelevance?: number;      // Default: 0.5
  minQualityRatio?: number;   // Default: 0.3
  maxAccepted?: number;       // Default: 10
  fallbackRetriever?: (query: string) => Promise<RetrievedDocument[]>;
}

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

/** Medical terms and synonyms for relevance matching */
const MEDICAL_TERMS = new Set([
  // Conditions (common patterns)
  'hypertension', 'hypotension', 'tachycardia', 'bradycardia', 'arrhythmia',
  'myocardial', 'infarction', 'stroke', 'tia', 'sepsis', 'pneumonia',
  'asthma', 'copd', 'diabetic', 'diabetes', 'insulin', 'glucose',
  'acute', 'chronic', 'acute coronary', 'acute kidney', 'acute respiratory',
  'heart failure', 'kidney disease', 'liver disease', 'pulmonary',
  'cardiogenic', 'distributive', 'hypovolemic', 'anaphylaxis',
  'encephalitis', 'meningitis', 'appendicitis', 'pancreatitis',
  'gastroenteritis', 'colitis', 'hepatitis', 'nephritis',

  // Procedures & interventions
  'intubation', 'extubation', 'ventilator', 'mechanical ventilation',
  'catheterization', 'ablation', 'cardioversion', 'defibrillation',
  'resuscitation', 'cpr', 'chest compression', 'rescue breathing',
  'dialysis', 'hemodialysis', 'peritoneal', 'plasmapheresis',
  'transfusion', 'transplant', 'anastomosis', 'ligation',

  // Drugs (common classes & generic names)
  'antibiotic', 'amoxicillin', 'penicillin', 'cephalosporin',
  'fluoroquinolone', 'macrolide', 'anticoagulant', 'warfarin',
  'heparin', 'apixaban', 'dabigatran', 'rivaroxaban',
  'statin', 'ace inhibitor', 'beta blocker', 'calcium channel',
  'diuretic', 'thiazide', 'loop', 'potassium sparing',
  'antidepressant', 'ssri', 'snri', 'tricyclic',
  'antipsychotic', 'benzodiazepine', 'barbiturate',
  'insulin', 'metformin', 'sulfonylurea', 'glp1',
  'corticosteroid', 'glucocorticoid', 'mineralocorticoid',
  'immunosuppressant', 'biologic', 'monoclonal',

  // Physical findings
  'murmur', 'gallop', 'rub', 'crackles', 'rales', 'wheezes',
  'rhonchi', 'stridor', 'wheezing', 'cyanosis', 'edema',
  'jaundice', 'pallor', 'flushing', 'petechiae', 'purpura',

  // Labs & imaging
  'elevated', 'decreased', 'normal', 'abnormal',
  'ekg', 'ecg', 'echo', 'echocardiogram', 'ct', 'mri', 'xray',
  'creatinine', 'bun', 'ast', 'alt', 'bilirubin', 'albumin',
  'hemoglobin', 'hematocrit', 'wbc', 'platelet', 'glucose', 'potassium',
  'sodium', 'chloride', 'bicarbonate', 'anion gap', 'ph', 'pco2', 'po2',
  'lactate', 'troponin', 'bmp', 'cmp', 'cbc', 'pt', 'ptt', 'inr',

  // General medical
  'presentation', 'symptoms', 'signs', 'diagnosis', 'differential',
  'management', 'treatment', 'therapy', 'prognosis', 'complications',
  'contraindication', 'side effect', 'adverse', 'toxicity',
  'dose', 'dosing', 'frequency', 'duration', 'contraindicated',
]);

/**
 * Normalize text for comparison (lowercase, trim, remove extra whitespace)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return normalizeText(text)
    .replace(/[^\w\s-]/g, '')  // Remove punctuation except hyphens
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Calculate query term frequency in document
 * Returns ratio of query tokens found in document
 */
function calculateKeywordOverlap(queryTokens: string[], docTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const docTokenSet = new Set(docTokens);
  const matchCount = queryTokens.filter(token => docTokenSet.has(token)).length;

  return matchCount / queryTokens.length;
}

/**
 * Calculate TF-IDF style weighting
 * Higher for query tokens that appear multiple times in document
 */
function calculateTFWeighting(queryTokens: string[], docTokens: string[]): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  let totalWeight = 0;
  for (const queryToken of queryTokens) {
    const frequency = docTokens.filter(token => token === queryToken).length;
    totalWeight += Math.log(1 + frequency);  // Log scaling to avoid over-weighting
  }

  return totalWeight / queryTokens.length;
}

/**
 * Count medical terms in document
 * Higher count suggests medical relevance
 */
function countMedicalTerms(docTokens: string[]): { count: number; ratio: number } {
  const docText = docTokens.join(' ');
  let count = 0;

  // Check for exact term matches
  for (const term of MEDICAL_TERMS) {
    if (docText.includes(term)) {
      count++;
    }
  }

  return {
    count,
    ratio: docTokens.length > 0 ? count / docTokens.length : 0,
  };
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Grade a single document for relevance to a query
 *
 * Uses heuristic-based scoring:
 * - Keyword overlap: What fraction of query terms appear in document
 * - TF weighting: How frequently query terms appear in document
 * - Medical term matching: Document contains medical terminology
 * - Initial retrieval score: Pre-ranked relevance from retriever
 *
 * Returns confidence 0-1 and binary relevant judgment at minRelevance threshold.
 */
export function gradeDocument(
  query: string,
  doc: RetrievedDocument,
  minRelevance: number = 0.5
): GradeResult {
  const queryTokens = tokenize(query);
  const docTokens = tokenize(doc.text);

  // Calculate components
  const keywordOverlap = calculateKeywordOverlap(queryTokens, docTokens);
  const tfWeight = calculateTFWeighting(queryTokens, docTokens);
  const medicalTerms = countMedicalTerms(docTokens);
  const retrievalScore = Math.min(doc.score, 1);  // Normalize to 0-1

  // Weighted composite score
  const confidence =
    keywordOverlap * 0.35 +           // Keyword overlap (35%)
    tfWeight * 0.25 +                 // TF weighting (25%)
    medicalTerms.ratio * 0.15 +       // Medical term density (15%)
    retrievalScore * 0.25;            // Retriever score (25%)

  const relevant = confidence >= minRelevance;

  // Build reasoning string
  const reasons: string[] = [];
  if (keywordOverlap > 0.5) reasons.push(`high keyword overlap (${(keywordOverlap * 100).toFixed(0)}%)`);
  if (tfWeight > 0.3) reasons.push(`strong term frequency (${(tfWeight * 100).toFixed(0)}%)`);
  if (medicalTerms.count > 5) reasons.push(`${medicalTerms.count} medical terms`);
  if (retrievalScore > 0.7) reasons.push(`strong retriever confidence (${(retrievalScore * 100).toFixed(0)}%)`);

  const reason = reasons.length > 0
    ? reasons.join('; ')
    : `low confidence (${(confidence * 100).toFixed(0)}%)`;

  return {
    document: doc,
    relevant,
    confidence: parseFloat(confidence.toFixed(3)),
    reason,
  };
}

/**
 * Grade multiple documents and compute overall quality metrics
 *
 * Returns:
 * - accepted: Documents above minRelevance threshold
 * - rejected: Documents below threshold with grading details
 * - qualityScore: Ratio of accepted documents
 * - fallbackTriggered: True if quality < minQualityRatio
 * - sources: Mix of 'primary' and fallback source identifiers
 *
 * If fallbackRetriever is provided and quality is low, attempts fallback
 * retrieval and re-grades the combined set.
 */
export async function gradeDocuments(
  query: string,
  docs: RetrievedDocument[],
  config?: CRAGConfig
): Promise<CRAGResult> {
  const {
    minRelevance = 0.5,
    minQualityRatio = 0.3,
    maxAccepted = 10,
    fallbackRetriever,
  } = config || {};

  // Grade primary documents
  const gradeResults = docs.map(doc => gradeDocument(query, doc, minRelevance));

  const accepted = gradeResults
    .filter(gr => gr.relevant)
    .slice(0, maxAccepted)
    .map(gr => gr.document);

  const rejected = gradeResults.filter(gr => !gr.relevant);

  const qualityScore = docs.length > 0 ? accepted.length / docs.length : 0;
  let fallbackTriggered = false;
  let sources: ('primary' | 'fallback')[] = docs.map(() => 'primary');
  let finalAccepted = accepted;

  // Check if fallback is needed
  if (qualityScore < minQualityRatio && fallbackRetriever) {
    fallbackTriggered = true;

    try {
      const fallbackDocs = await fallbackRetriever(query);

      // Grade fallback docs
      const fallbackGradeResults = fallbackDocs.map(doc =>
        gradeDocument(query, doc, minRelevance)
      );

      // Combine and re-rank
      const combinedGraded = [
        ...gradeResults,
        ...fallbackGradeResults,
      ];

      finalAccepted = combinedGraded
        .filter(gr => gr.relevant)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxAccepted)
        .map(gr => gr.document);

      // Track sources
      sources = finalAccepted.map(doc => {
        const isPrimary = docs.some(d => d.id === doc.id);
        return isPrimary ? 'primary' : 'fallback';
      });
    } catch (error) {
      // Fallback retrieval failed; use primary results only
      fallbackTriggered = false;
    }
  }

  return {
    accepted: finalAccepted,
    rejected,
    qualityScore: parseFloat(qualityScore.toFixed(3)),
    fallbackTriggered,
    sources,
  };
}

/**
 * Build context string from accepted documents
 *
 * Formats each document with source attribution, suitable for passing
 * to an LLM for synthesis. Maintains order and includes source metadata.
 */
export function buildCRAGContext(accepted: RetrievedDocument[]): string {
  if (accepted.length === 0) {
    return '';
  }

  const sections = accepted.map((doc, index) => {
    return `[Source ${index + 1}: ${doc.source}]\n${doc.text}`;
  });

  return sections.join('\n\n');
}
