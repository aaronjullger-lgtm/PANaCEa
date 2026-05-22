/**
 * Chain of Verification (CoVe) for Medical Content Generation
 *
 * PHASE 4: NEURO-SYMBOLIC INTEGRITY - Milestone 1
 *
 * This module implements a multi-step verification pipeline to prevent AI hallucinations
 * in generated medical questions. It follows the CoVe pattern:
 *
 * 1. EXTRACT: Parse factual claims from generated content
 * 2. VERIFY: Cross-reference claims against authoritative sources (DB)
 * 3. VALIDATE: Ensure correct answer is definitively correct
 * 4. CHECK DISTRACTORS: Verify plausibility without accidental correctness
 *
 * @see https://arxiv.org/abs/2309.11495 (Chain-of-Verification paper)
 */

import type { Question, SystemCode } from '../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * A single factual claim extracted from generated content
 */
export interface FactualClaim {
  /** Unique identifier for this claim */
  id: string;
  /** The claim text itself */
  text: string;
  /** Category of claim (etiology, symptom, treatment, diagnostic, etc.) */
  category: ClaimCategory;
  /** Medical entity this claim relates to (condition, drug, procedure) */
  entity: string;
  /** Confidence that this is a verifiable factual claim (0-1) */
  confidence: number;
  /** Source location in the original text */
  source: 'vignette' | 'option' | 'rationale' | 'pearl';
}

export type ClaimCategory =
  | 'etiology'
  | 'pathophysiology'
  | 'symptom'
  | 'sign'
  | 'diagnostic_test'
  | 'treatment'
  | 'contraindication'
  | 'epidemiology'
  | 'prognosis'
  | 'risk_factor'
  | 'mechanism'
  | 'other';

/**
 * Result of verifying a single claim
 */
export interface ClaimVerification {
  claim: FactualClaim;
  /** Whether the claim was verified against database */
  verified: boolean;
  /** Confidence in verification (0-1) */
  confidence: number;
  /** Source used for verification */
  verificationSource: 'database' | 'llm_knowledge' | 'unverified';
  /** If contradicted, the correct information */
  correction?: string;
  /** Explanation of verification result */
  explanation?: string;
}

/**
 * Result of verifying the correct answer
 */
export interface AnswerVerification {
  /** Whether the marked correct answer is actually correct */
  isCorrect: boolean;
  /** Confidence in this assessment (0-1) */
  confidence: number;
  /** Reasoning for the assessment */
  reasoning: string;
  /** If incorrect, what the correct answer should be */
  suggestedCorrection?: {
    correctAnswerIndex: number;
    explanation: string;
  };
}

/**
 * Result of checking a distractor option
 */
export interface DistractorCheck {
  optionIndex: number;
  optionText: string;
  /** Is this a plausible distractor? */
  isPlausible: boolean;
  /** Could this accidentally be correct? (BAD) */
  isAccidentallyCorrect: boolean;
  /** Why this distractor is wrong */
  whyWrong: string;
  /** Quality score (0-1) */
  quality: number;
}

/**
 * Complete verification result for a generated question
 */
export interface CoVeResult {
  /** Unique verification ID */
  verificationId: string;
  /** Timestamp of verification */
  timestamp: string;
  /** Overall verification passed */
  passed: boolean;
  /** Overall confidence score (0-1) */
  overallConfidence: number;
  /** Individual claim verifications */
  claimVerifications: ClaimVerification[];
  /** Answer correctness verification */
  answerVerification: AnswerVerification;
  /** Distractor quality checks */
  distractorChecks: DistractorCheck[];
  /** Summary statistics */
  summary: {
    totalClaims: number;
    verifiedClaims: number;
    unverifiedClaims: number;
    contradictedClaims: number;
    verificationRate: number;
  };
  /** Flags for specific issues */
  flags: CoVeFlag[];
  /** Recommended action */
  recommendation: 'accept' | 'review' | 'reject' | 'regenerate';
}

export interface CoVeFlag {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  location?: string;
}

/**
 * Database content used for verification
 */
export interface VerificationContext {
  conditionName: string;
  system: SystemCode;
  databaseContent?: {
    overview?: string;
    pathophysiology?: string;
    symptoms?: string[];
    signs?: string[];
    diagnostics?: string[];
    treatment?: string[];
    differentialDiagnosis?: string[];
    complications?: string[];
    riskFactors?: string[];
    buzzwords?: string[];
    clinicalPearls?: string[];
  };
}

// ============================================================================
// CLAIM EXTRACTION
// ============================================================================

/**
 * Extract factual claims from a generated question using LLM
 * This is step 1 of the CoVe pipeline
 */
export async function extractFactualClaims(
  question: Question,
  geminiApiCall: (prompt: string) => Promise<string>
): Promise<FactualClaim[]> {
  const questionText = question.question || '';
  const options = question.options || [];
  const rationale = question.rationale || '';
  const pearls = question.pearls || [];

  const prompt = `You are a medical fact-checker. Extract all factual medical claims from the following question content.

QUESTION VIGNETTE:
${questionText}

OPTIONS:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

RATIONALE:
${rationale}

CLINICAL PEARLS:
${pearls.join('\n')}

TASK: Extract each distinct factual claim that can be verified against medical literature.
For each claim, identify:
1. The exact claim text
2. Category (etiology, pathophysiology, symptom, sign, diagnostic_test, treatment, contraindication, epidemiology, prognosis, risk_factor, mechanism, other)
3. The medical entity it relates to (condition, drug, procedure name)
4. Where it appears (vignette, option, rationale, pearl)
5. Confidence that this is a verifiable fact (0.0-1.0)

Return ONLY a JSON array with no markdown:
[
  {
    "text": "exact claim text",
    "category": "category",
    "entity": "medical entity",
    "source": "vignette|option|rationale|pearl",
    "confidence": 0.9
  }
]

Focus on claims that could be WRONG if hallucinated:
- Disease-symptom associations
- Drug-condition relationships
- Diagnostic test interpretations
- Treatment recommendations
- Pathophysiology mechanisms
- Epidemiological facts

Do NOT include:
- Patient demographics (age, gender)
- Generic clinical workflow statements
- Question structure elements`;

  try {
    const response = await geminiApiCall(prompt);
    const cleanedJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const claims = JSON.parse(cleanedJson) as Array<{
      text: string;
      category: string;
      entity: string;
      source: string;
      confidence: number;
    }>;

    return claims.map((c, index) => ({
      id: `claim_${Date.now()}_${index}`,
      text: c.text,
      category: c.category as ClaimCategory,
      entity: c.entity,
      source: c.source as FactualClaim['source'],
      confidence: c.confidence,
    }));
  } catch (error) {
    console.error('[CoVe] Failed to extract claims:', error);
    return [];
  }
}

// ============================================================================
// CLAIM VERIFICATION
// ============================================================================

/**
 * Verify extracted claims against database content
 * This is step 2 of the CoVe pipeline
 */
export async function verifyClaims(
  claims: FactualClaim[],
  context: VerificationContext,
  geminiApiCall: (prompt: string) => Promise<string>
): Promise<ClaimVerification[]> {
  if (claims.length === 0) {
    return [];
  }

  // Build database context string
  const dbContext = context.databaseContent
    ? buildDbContextString(context.databaseContent)
    : 'No database content available for verification.';

  const prompt = `You are a medical fact-checker verifying claims against authoritative content.

CONDITION: ${context.conditionName}
SYSTEM: ${context.system}

AUTHORITATIVE DATABASE CONTENT:
${dbContext}

CLAIMS TO VERIFY:
${claims.map((c, i) => `${i + 1}. [${c.category}] ${c.text}`).join('\n')}

TASK: For each claim, determine if it is:
- VERIFIED: Supported by the database content
- UNVERIFIED: Cannot be confirmed from database (may still be correct)
- CONTRADICTED: Conflicts with database content

Return ONLY a JSON array with no markdown:
[
  {
    "claimIndex": 0,
    "verified": true,
    "confidence": 0.95,
    "verificationSource": "database|llm_knowledge|unverified",
    "correction": null,
    "explanation": "Brief explanation"
  }
]

BE STRICT: Only mark as "verified" if the database content explicitly supports the claim.
If contradicted, provide the correct information in "correction".`;

  try {
    const response = await geminiApiCall(prompt);
    const cleanedJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const verifications = JSON.parse(cleanedJson) as Array<{
      claimIndex: number;
      verified: boolean;
      confidence: number;
      verificationSource: string;
      correction: string | null;
      explanation: string;
    }>;

    return verifications.map((v) => {
      const claim = claims[v.claimIndex];
      if (!claim) {
        throw new Error(`Invalid claim index: ${v.claimIndex}`);
      }
      return {
        claim,
        verified: v.verified,
        confidence: v.confidence,
        verificationSource: v.verificationSource as ClaimVerification['verificationSource'],
        correction: v.correction || undefined,
        explanation: v.explanation,
      };
    });
  } catch (error) {
    console.error('[CoVe] Failed to verify claims:', error);
    // Return unverified status for all claims on error
    return claims.map((claim) => ({
      claim,
      verified: false,
      confidence: 0,
      verificationSource: 'unverified' as const,
      explanation: 'Verification failed due to error',
    }));
  }
}

/**
 * Build a string representation of database content for verification
 */
function buildDbContextString(content: VerificationContext['databaseContent']): string {
  if (!content) return '';

  const parts: string[] = [];

  if (content.overview) parts.push(`Overview: ${content.overview}`);
  if (content.pathophysiology) parts.push(`Pathophysiology: ${content.pathophysiology}`);
  if (content.symptoms?.length) parts.push(`Symptoms: ${content.symptoms.join(', ')}`);
  if (content.signs?.length) parts.push(`Signs: ${content.signs.join(', ')}`);
  if (content.diagnostics?.length) parts.push(`Diagnostics: ${content.diagnostics.join(', ')}`);
  if (content.treatment?.length) parts.push(`Treatment: ${content.treatment.join(', ')}`);
  if (content.differentialDiagnosis?.length) {
    parts.push(`Differential Diagnosis: ${content.differentialDiagnosis.join(', ')}`);
  }
  if (content.complications?.length)
    parts.push(`Complications: ${content.complications.join(', ')}`);
  if (content.riskFactors?.length) parts.push(`Risk Factors: ${content.riskFactors.join(', ')}`);
  if (content.buzzwords?.length) parts.push(`Buzzwords: ${content.buzzwords.join(', ')}`);
  if (content.clinicalPearls?.length)
    parts.push(`Clinical Pearls: ${content.clinicalPearls.join('; ')}`);

  return parts.join('\n\n');
}

// ============================================================================
// ANSWER VERIFICATION
// ============================================================================

/**
 * Verify that the marked correct answer is actually correct
 * This is step 3 of the CoVe pipeline
 */
export async function verifyCorrectAnswer(
  question: Question,
  context: VerificationContext,
  geminiApiCall: (prompt: string) => Promise<string>
): Promise<AnswerVerification> {
  const questionText = question.question || '';
  const options = question.options || [];
  const correctIndex = question.correctAnswerIndex ?? 0;
  const correctAnswer = options[correctIndex] || '';

  const dbContext = context.databaseContent
    ? buildDbContextString(context.databaseContent)
    : 'No database content available.';

  const prompt = `You are a medical expert verifying that a PANCE question has the correct answer marked.

CONDITION: ${context.conditionName}

DATABASE CONTENT (AUTHORITATIVE):
${dbContext}

QUESTION:
${questionText}

OPTIONS:
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}${i === correctIndex ? ' [MARKED AS CORRECT]' : ''}`).join('\n')}

TASK: Verify if "${correctAnswer}" is definitively the BEST answer for this question.

Consider:
1. Does the database content support this answer?
2. Is there another option that could also be correct or better?
3. Is this the MOST appropriate answer for a PANCE exam?

Return ONLY JSON with no markdown:
{
  "isCorrect": true,
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this is or isn't correct",
  "suggestedCorrection": null
}

If the answer is WRONG, include suggestedCorrection:
{
  "isCorrect": false,
  "confidence": 0.9,
  "reasoning": "Explanation",
  "suggestedCorrection": {
    "correctAnswerIndex": 2,
    "explanation": "Why option C is actually correct"
  }
}`;

  try {
    const response = await geminiApiCall(prompt);
    const cleanedJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleanedJson) as AnswerVerification;
  } catch (error) {
    console.error('[CoVe] Failed to verify answer:', error);
    return {
      isCorrect: false,
      confidence: 0,
      reasoning: 'Verification failed due to error',
    };
  }
}

// ============================================================================
// DISTRACTOR VERIFICATION
// ============================================================================

/**
 * Check that distractors are plausible but definitively wrong
 * This is step 4 of the CoVe pipeline
 */
export async function checkDistractors(
  question: Question,
  context: VerificationContext,
  geminiApiCall: (prompt: string) => Promise<string>
): Promise<DistractorCheck[]> {
  const questionText = question.question || '';
  const options = question.options || [];
  const correctIndex = question.correctAnswerIndex ?? 0;

  const distractors = options
    .map((opt, idx) => ({ index: idx, text: opt }))
    .filter((_, idx) => idx !== correctIndex);

  if (distractors.length === 0) {
    return [];
  }

  const dbContext = context.databaseContent
    ? buildDbContextString(context.databaseContent)
    : 'No database content available.';

  const prompt = `You are a medical educator evaluating distractor quality for a PANCE question.

CONDITION: ${context.conditionName}

DATABASE CONTENT:
${dbContext}

QUESTION:
${questionText}

CORRECT ANSWER: ${options[correctIndex]}

DISTRACTORS TO EVALUATE:
${distractors.map((d) => `${String.fromCharCode(65 + d.index)}. ${d.text}`).join('\n')}

TASK: Evaluate each distractor for:
1. PLAUSIBILITY: Is this a reasonable wrong answer that tests understanding?
2. ACCIDENTAL CORRECTNESS: Could this actually be correct or equally correct?
3. WHY WRONG: Brief explanation of why this is definitively wrong
4. QUALITY: Score from 0-1 (1 = excellent distractor)

Good distractors:
- Represent common misconceptions
- Are related to the correct condition
- Are clearly wrong once you understand the topic
- Test clinical reasoning, not trick questions

Bad distractors:
- Are obviously wrong
- Could accidentally be correct
- Are completely unrelated
- Use "gotcha" phrasing

Return ONLY JSON array with no markdown:
[
  {
    "optionIndex": 0,
    "optionText": "text",
    "isPlausible": true,
    "isAccidentallyCorrect": false,
    "whyWrong": "Brief explanation",
    "quality": 0.8
  }
]`;

  try {
    const response = await geminiApiCall(prompt);
    const cleanedJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleanedJson) as DistractorCheck[];
  } catch (error) {
    console.error('[CoVe] Failed to check distractors:', error);
    return distractors.map((d) => ({
      optionIndex: d.index,
      optionText: d.text,
      isPlausible: false,
      isAccidentallyCorrect: false,
      whyWrong: 'Verification failed',
      quality: 0,
    }));
  }
}

// ============================================================================
// MAIN VERIFICATION PIPELINE
// ============================================================================

/**
 * Configuration for the CoVe pipeline
 */
export interface CoVeConfig {
  /** Minimum verification rate to pass (0-1) */
  minVerificationRate: number;
  /** Minimum overall confidence to pass (0-1) */
  minConfidence: number;
  /** Whether to require answer verification */
  requireAnswerVerification: boolean;
  /** Minimum distractor quality score (0-1) */
  minDistractorQuality: number;
  /** Maximum allowed unverified claims */
  maxUnverifiedClaims: number;
}

const DEFAULT_CONFIG: CoVeConfig = {
  minVerificationRate: 0.7,
  minConfidence: 0.8,
  requireAnswerVerification: true,
  minDistractorQuality: 0.5,
  maxUnverifiedClaims: 3,
};

/**
 * Run the complete Chain of Verification pipeline on a generated question
 */
export async function runCoVePipeline(
  question: Question,
  context: VerificationContext,
  geminiApiCall: (prompt: string) => Promise<string>,
  config: Partial<CoVeConfig> = {}
): Promise<CoVeResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const verificationId = `cove_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const flags: CoVeFlag[] = [];


  // Step 1: Extract factual claims
  const claims = await extractFactualClaims(question, geminiApiCall);

  if (claims.length === 0) {
    flags.push({
      severity: 'warning',
      code: 'NO_CLAIMS_EXTRACTED',
      message: 'No factual claims could be extracted from the question',
    });
  }

  // Step 2: Verify claims against database
  const claimVerifications = await verifyClaims(claims, context, geminiApiCall);

  const verifiedCount = claimVerifications.filter((v) => v.verified).length;
  const contradictedCount = claimVerifications.filter((v) => v.correction).length;
  const unverifiedCount = claimVerifications.filter((v) => !v.verified && !v.correction).length;


  if (contradictedCount > 0) {
    flags.push({
      severity: 'critical',
      code: 'CLAIMS_CONTRADICTED',
      message: `${contradictedCount} claim(s) contradicted by database content`,
    });
  }

  if (unverifiedCount > cfg.maxUnverifiedClaims) {
    flags.push({
      severity: 'warning',
      code: 'MANY_UNVERIFIED_CLAIMS',
      message: `${unverifiedCount} claims could not be verified (max: ${cfg.maxUnverifiedClaims})`,
    });
  }

  // Step 3: Verify correct answer
  const answerVerification = await verifyCorrectAnswer(question, context, geminiApiCall);

  if (!answerVerification.isCorrect) {
    flags.push({
      severity: 'critical',
      code: 'WRONG_ANSWER_MARKED',
      message: 'The marked correct answer may be incorrect',
    });
  }

  // Step 4: Check distractors
  const distractorChecks = await checkDistractors(question, context, geminiApiCall);

  const accidentallyCorrect = distractorChecks.filter((d) => d.isAccidentallyCorrect);
  if (accidentallyCorrect.length > 0) {
    flags.push({
      severity: 'critical',
      code: 'DISTRACTOR_ACCIDENTALLY_CORRECT',
      message: `${accidentallyCorrect.length} distractor(s) may be accidentally correct`,
      location: accidentallyCorrect
        .map((d) => `Option ${String.fromCharCode(65 + d.optionIndex)}`)
        .join(', '),
    });
  }

  const lowQualityDistractors = distractorChecks.filter(
    (d) => d.quality < cfg.minDistractorQuality
  );
  if (lowQualityDistractors.length > 0) {
    flags.push({
      severity: 'warning',
      code: 'LOW_QUALITY_DISTRACTORS',
      message: `${lowQualityDistractors.length} distractor(s) have low quality scores`,
    });
  }

  // Calculate summary statistics
  const verificationRate = claims.length > 0 ? verifiedCount / claims.length : 1;
  const avgDistractorQuality =
    distractorChecks.length > 0
      ? distractorChecks.reduce((sum, d) => sum + d.quality, 0) / distractorChecks.length
      : 1;

  // Calculate overall confidence
  const claimConfidence =
    claimVerifications.length > 0
      ? claimVerifications.reduce((sum, v) => sum + v.confidence, 0) / claimVerifications.length
      : 1;
  const overallConfidence =
    claimConfidence * 0.3 + answerVerification.confidence * 0.4 + avgDistractorQuality * 0.3;

  // Determine recommendation
  let recommendation: CoVeResult['recommendation'];
  const hasCriticalFlags = flags.some((f) => f.severity === 'critical');

  if (hasCriticalFlags) {
    recommendation =
      contradictedCount > 0 || !answerVerification.isCorrect ? 'reject' : 'regenerate';
  } else if (verificationRate < cfg.minVerificationRate || overallConfidence < cfg.minConfidence) {
    recommendation = 'review';
  } else {
    recommendation = 'accept';
  }

  const passed = recommendation === 'accept';


  return {
    verificationId,
    timestamp: new Date().toISOString(),
    passed,
    overallConfidence,
    claimVerifications,
    answerVerification,
    distractorChecks,
    summary: {
      totalClaims: claims.length,
      verifiedClaims: verifiedCount,
      unverifiedClaims: unverifiedCount,
      contradictedClaims: contradictedCount,
      verificationRate,
    },
    flags,
    recommendation,
  };
}

// ============================================================================
// QUICK VERIFICATION (Lightweight check for high-volume use)
// ============================================================================

/**
 * Perform a quick, lightweight verification suitable for high-volume generation
 * Only checks the most critical elements without full claim extraction
 */
export async function quickVerify(
  question: Question,
  context: VerificationContext,
  geminiApiCall: (prompt: string) => Promise<string>
): Promise<{
  passed: boolean;
  confidence: number;
  criticalIssues: string[];
}> {
  const questionText = question.question || '';
  const options = question.options || [];
  const correctIndex = question.correctAnswerIndex ?? 0;
  const rationale = question.rationale || '';

  const dbContext = context.databaseContent
    ? buildDbContextString(context.databaseContent)
    : 'No database content available.';

  const prompt = `You are a rapid medical fact-checker. Quickly verify this PANCE question.

CONDITION: ${context.conditionName}
SYSTEM: ${context.system}

DATABASE (AUTHORITATIVE):
${dbContext}

QUESTION:
${questionText}

OPTIONS:
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}${i === correctIndex ? ' [CORRECT]' : ''}`).join('\n')}

RATIONALE:
${rationale}

QUICK CHECK:
1. Is the marked correct answer (${String.fromCharCode(65 + correctIndex)}) actually correct?
2. Are there any blatant factual errors?
3. Could any distractor accidentally be correct?

Return ONLY JSON with no markdown:
{
  "passed": true,
  "confidence": 0.9,
  "criticalIssues": []
}

If issues found:
{
  "passed": false,
  "confidence": 0.3,
  "criticalIssues": ["Issue 1", "Issue 2"]
}`;

  try {
    const response = await geminiApiCall(prompt);
    const cleanedJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error('[CoVe] Quick verify failed:', error);
    return {
      passed: false,
      confidence: 0,
      criticalIssues: ['Verification failed due to error'],
    };
  }
}
