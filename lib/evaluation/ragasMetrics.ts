/**
 * RAGAS-Inspired Evaluation Metrics for PANaCEa RAG Pipeline
 *
 * Measures retrieval quality with 5 core metrics:
 * 1. Context Relevance — are retrieved docs relevant to the query?
 * 2. Answer Faithfulness — is the answer grounded in retrieved context?
 * 3. Answer Relevance — does the answer address the query?
 * 4. Context Recall — did we retrieve the necessary information?
 * 5. Clinical Accuracy — domain-specific: are medical facts correct?
 *
 * Uses lightweight heuristic scoring (<10ms per evaluation) for
 * continuous monitoring, with optional LLM-based deep evaluation.
 *
 * Reference: RAGAS (Retrieval Augmented Generation Assessment)
 * https://docs.ragas.io
 *
 * @module lib/evaluation/ragasMetrics
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface EvalInput {
  query: string;
  retrievedDocs: Array<{ id: string; text: string; score: number }>;
  generatedAnswer: string;
  /** Ground truth answer (when available, e.g., from curated test set) */
  groundTruth?: string;
  /** Expected key concepts that should appear in the answer */
  expectedConcepts?: string[];
}

export interface EvalResult {
  contextRelevance: number;    // 0-1
  answerFaithfulness: number;  // 0-1
  answerRelevance: number;     // 0-1
  contextRecall: number;       // 0-1
  clinicalAccuracy: number;    // 0-1
  overall: number;             // 0-1 weighted composite
  details: Record<string, string>;
}

export interface EvalConfig {
  weights?: {
    contextRelevance?: number;
    answerFaithfulness?: number;
    answerRelevance?: number;
    contextRecall?: number;
    clinicalAccuracy?: number;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  contextRelevance: 0.20,
  answerFaithfulness: 0.25,
  answerRelevance: 0.20,
  contextRecall: 0.15,
  clinicalAccuracy: 0.20,
};

/** Medical stopwords to exclude from overlap calculations */
const MEDICAL_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'and', 'but', 'or', 'nor', 'if', 'while',
  'patient', 'patients', 'treatment', 'condition', 'disease', 'disorder',
]);

/** High-value clinical terms boost relevance scoring */
const CLINICAL_SIGNAL_TERMS = new Set([
  'diagnosis', 'differential', 'pathophysiology', 'mechanism', 'etiology',
  'prognosis', 'contraindication', 'indication', 'dosage', 'adverse',
  'first-line', 'gold standard', 'sensitivity', 'specificity', 'positive',
  'negative', 'predictive', 'likelihood', 'incidence', 'prevalence',
  'mortality', 'morbidity', 'prophylaxis', 'empiric', 'definitive',
  'surgical', 'conservative', 'pharmacological', 'non-pharmacological',
]);

// ─── Utility Functions ────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !MEDICAL_STOPWORDS.has(w));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function containsClinicalTerms(tokens: string[]): number {
  const matches = tokens.filter((t) =>
    CLINICAL_SIGNAL_TERMS.has(t) ||
    [...CLINICAL_SIGNAL_TERMS].some((ct) => t.includes(ct))
  );
  return Math.min(matches.length / 3, 1); // Normalize: 3+ clinical terms = 1.0
}

// ─── Core Metric Functions ────────────────────────────────────────────────

/**
 * Context Relevance: How relevant are retrieved docs to the query?
 * Measures term overlap between query and retrieved documents.
 */
export function scoreContextRelevance(input: EvalInput): { score: number; detail: string } {
  if (input.retrievedDocs.length === 0) {
    return { score: 0, detail: 'No documents retrieved' };
  }

  const queryTokens = new Set(tokenize(input.query));

  const docScores = input.retrievedDocs.map((doc) => {
    const docTokens = new Set(tokenize(doc.text));
    const overlap = jaccardSimilarity(queryTokens, docTokens);
    const clinicalBoost = containsClinicalTerms([...docTokens]) * 0.15;
    const retrieverConfidence = Math.min(doc.score, 1) * 0.2;
    return Math.min(overlap + clinicalBoost + retrieverConfidence, 1);
  });

  // Weight top docs more heavily (position-weighted mean)
  const weightedSum = docScores.reduce((sum, score, i) => {
    const posWeight = 1 / (i + 1); // 1, 0.5, 0.33, 0.25, ...
    return sum + score * posWeight;
  }, 0);
  const weightSum = docScores.reduce((sum, _, i) => sum + 1 / (i + 1), 0);
  const score = weightedSum / weightSum;

  return {
    score: Math.round(score * 100) / 100,
    detail: `${docScores.filter((s) => s > 0.3).length}/${input.retrievedDocs.length} docs relevant`,
  };
}

/**
 * Answer Faithfulness: Is the answer grounded in retrieved context?
 * Checks that answer claims can be traced to retrieved documents.
 */
export function scoreAnswerFaithfulness(input: EvalInput): { score: number; detail: string } {
  if (!input.generatedAnswer || input.retrievedDocs.length === 0) {
    return { score: 0, detail: 'No answer or context' };
  }

  const answerTokens = tokenize(input.generatedAnswer);
  if (answerTokens.length === 0) return { score: 0, detail: 'Empty answer' };

  // Combine all retrieved doc text
  const contextText = input.retrievedDocs.map((d) => d.text).join(' ');
  const contextTokens = new Set(tokenize(contextText));

  // Count answer tokens found in context
  const groundedTokens = answerTokens.filter((t) => contextTokens.has(t));
  const faithfulness = groundedTokens.length / answerTokens.length;

  return {
    score: Math.round(faithfulness * 100) / 100,
    detail: `${groundedTokens.length}/${answerTokens.length} answer tokens grounded in context`,
  };
}

/**
 * Answer Relevance: Does the answer actually address the query?
 */
export function scoreAnswerRelevance(input: EvalInput): { score: number; detail: string } {
  if (!input.generatedAnswer) return { score: 0, detail: 'No answer' };

  const queryTokens = new Set(tokenize(input.query));
  const answerTokens = new Set(tokenize(input.generatedAnswer));

  const overlap = jaccardSimilarity(queryTokens, answerTokens);
  // Bonus for clinical terms in answer
  const clinicalBoost = containsClinicalTerms([...answerTokens]) * 0.15;
  // Penalty for very short answers
  const lengthPenalty = answerTokens.size < 5 ? 0.3 : 0;

  const score = Math.min(Math.max(overlap + clinicalBoost - lengthPenalty, 0), 1);

  return {
    score: Math.round(score * 100) / 100,
    detail: `Query-answer overlap: ${(overlap * 100).toFixed(0)}%`,
  };
}

/**
 * Context Recall: Did we retrieve the necessary information?
 * Requires ground truth answer or expected concepts.
 */
export function scoreContextRecall(input: EvalInput): { score: number; detail: string } {
  const expectedTokens = input.expectedConcepts
    ? new Set(input.expectedConcepts.flatMap((c) => tokenize(c)))
    : input.groundTruth
      ? new Set(tokenize(input.groundTruth))
      : null;

  if (!expectedTokens || expectedTokens.size === 0) {
    return { score: 0.5, detail: 'No ground truth available — defaulting to 0.5' };
  }

  const contextText = input.retrievedDocs.map((d) => d.text).join(' ');
  const contextTokens = new Set(tokenize(contextText));

  const recalled = [...expectedTokens].filter((t) => contextTokens.has(t));
  const score = recalled.length / expectedTokens.size;

  return {
    score: Math.round(score * 100) / 100,
    detail: `${recalled.length}/${expectedTokens.size} expected concepts found in context`,
  };
}

/**
 * Clinical Accuracy: Domain-specific metric for medical correctness.
 * Checks answer against expected clinical concepts and terminology.
 */
export function scoreClinicalAccuracy(input: EvalInput): { score: number; detail: string } {
  if (!input.expectedConcepts || input.expectedConcepts.length === 0) {
    // Without expected concepts, use answer quality heuristics
    const answerTokens = tokenize(input.generatedAnswer);
    const clinicalDensity = containsClinicalTerms(answerTokens);
    const hasSubstance = answerTokens.length >= 10 ? 0.3 : 0;
    return {
      score: Math.round((clinicalDensity * 0.7 + hasSubstance) * 100) / 100,
      detail: 'Estimated from clinical term density (no expected concepts)',
    };
  }

  const answerLower = input.generatedAnswer.toLowerCase();
  const matched = input.expectedConcepts.filter((concept) => {
    const conceptWords = concept.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    // At least half the concept words should appear in the answer
    const found = conceptWords.filter((w) => answerLower.includes(w));
    return found.length >= Math.ceil(conceptWords.length / 2);
  });

  const score = matched.length / input.expectedConcepts.length;

  return {
    score: Math.round(score * 100) / 100,
    detail: `${matched.length}/${input.expectedConcepts.length} clinical concepts covered`,
  };
}

// ─── Composite Evaluation ────────────────────────────────────────────────

/**
 * Run all RAGAS metrics and compute weighted composite score.
 *
 * @example
 * ```ts
 * const result = evaluateRAG({
 *   query: 'What is the first-line treatment for atrial fibrillation?',
 *   retrievedDocs: [{ id: '1', text: 'Rate control with beta blockers...', score: 0.9 }],
 *   generatedAnswer: 'First-line treatment includes rate control with beta blockers or CCBs.',
 *   expectedConcepts: ['rate control', 'beta blocker', 'calcium channel blocker'],
 * });
 * console.log(result.overall); // 0.78
 * ```
 */
export function evaluateRAG(input: EvalInput, config?: EvalConfig): EvalResult {
  const w = { ...DEFAULT_WEIGHTS, ...config?.weights };

  const cr = scoreContextRelevance(input);
  const af = scoreAnswerFaithfulness(input);
  const ar = scoreAnswerRelevance(input);
  const crc = scoreContextRecall(input);
  const ca = scoreClinicalAccuracy(input);

  const overall =
    cr.score * w.contextRelevance +
    af.score * w.answerFaithfulness +
    ar.score * w.answerRelevance +
    crc.score * w.contextRecall +
    ca.score * w.clinicalAccuracy;

  return {
    contextRelevance: cr.score,
    answerFaithfulness: af.score,
    answerRelevance: ar.score,
    contextRecall: crc.score,
    clinicalAccuracy: ca.score,
    overall: Math.round(overall * 100) / 100,
    details: {
      contextRelevance: cr.detail,
      answerFaithfulness: af.detail,
      answerRelevance: ar.detail,
      contextRecall: crc.detail,
      clinicalAccuracy: ca.detail,
    },
  };
}

/**
 * Batch evaluate multiple query-answer pairs.
 * Returns individual results + aggregate statistics.
 */
export function batchEvaluateRAG(
  inputs: EvalInput[],
  config?: EvalConfig
): { results: EvalResult[]; aggregate: EvalResult & { count: number } } {
  const results = inputs.map((input) => evaluateRAG(input, config));

  const count = results.length;
  if (count === 0) {
    const empty: EvalResult = {
      contextRelevance: 0, answerFaithfulness: 0, answerRelevance: 0,
      contextRecall: 0, clinicalAccuracy: 0, overall: 0, details: {},
    };
    return { results, aggregate: { ...empty, count: 0 } };
  }

  const avg = (key: keyof Omit<EvalResult, 'details' | 'overall'>) =>
    Math.round((results.reduce((s, r) => s + r[key], 0) / count) * 100) / 100;

  const aggregate: EvalResult & { count: number } = {
    contextRelevance: avg('contextRelevance'),
    answerFaithfulness: avg('answerFaithfulness'),
    answerRelevance: avg('answerRelevance'),
    contextRecall: avg('contextRecall'),
    clinicalAccuracy: avg('clinicalAccuracy'),
    overall: Math.round((results.reduce((s, r) => s + r.overall, 0) / count) * 100) / 100,
    details: { summary: `Evaluated ${count} queries` },
    count,
  };

  return { results, aggregate };
}
