/**
 * Self-Refine Service for Question Generation
 *
 * Implements a draft → critique → rewrite loop for AI-generated questions.
 * After initial generation, a separate critique pass evaluates the question
 * for clinical accuracy, distractor plausibility, Bloom's level alignment,
 * stem clarity, and answer homogeneity. If issues are found, the question
 * is regenerated with critique feedback injected into the prompt.
 *
 * Research basis:
 *   - Madaan et al. (2023): "Self-Refine: Iterative Refinement with Self-Feedback"
 *   - NBME item-writing best practices
 *   - Haladyna & Rodriguez (2013): Developing and Validating Test Items
 *
 * Cost optimization:
 *   - Only run self-refine for difficulty ≥ 3 or third-order questions
 *   - Maximum 1 refinement iteration (draft → critique → rewrite)
 *   - Skip refinement if critique score ≥ 0.85
 *
 * Architecture:
 *   Pure prompt construction — no API calls. Caller (generate-rag.ts)
 *   handles Gemini invocation. This service builds critique/rewrite prompts
 *   and parses critique results.
 *
 * Sprint 22 — Self-Refine loop for question generation
 * @module lib/services/selfRefineService
 */

// ─── Types ──────────────────────────────────────────────────────────────

/** A generated question to be critiqued */
export interface GeneratedQuestion {
  type: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: {
    rationale: string;
    incorrect?: Record<string, string>;
  };
  difficulty: number;
  sourceSections?: string[];
  sourceConditions?: string[];
}

/** Critique result for a single question */
export interface CritiqueResult {
  /** Overall quality score (0-1) */
  overallScore: number;
  /** Should this question be refined? */
  needsRefinement: boolean;
  /** Individual dimension scores */
  dimensions: CritiqueDimension[];
  /** Specific issues found */
  issues: CritiqueIssue[];
  /** Summary feedback for the rewrite prompt */
  feedbackForRewrite: string;
}

export interface CritiqueDimension {
  name: string;
  score: number;
  feedback: string;
}

export interface CritiqueIssue {
  severity: 'critical' | 'major' | 'minor';
  category: CritiqueCategory;
  description: string;
  suggestion: string;
}

export type CritiqueCategory =
  | 'clinical_accuracy'
  | 'distractor_plausibility'
  | 'blooms_alignment'
  | 'stem_clarity'
  | 'answer_homogeneity'
  | 'testwise_cues'
  | 'diagnosis_in_stem'
  | 'explanation_depth';

/** Configuration for self-refine behavior */
export interface SelfRefineConfig {
  /** Minimum difficulty to trigger self-refine (0-1 scale) */
  minDifficulty: number;
  /** Score threshold above which refinement is skipped */
  skipThreshold: number;
  /** Maximum refinement iterations */
  maxIterations: number;
  /** Whether to refine third-order questions regardless of difficulty */
  alwaysRefineThirdOrder: boolean;
}

export const DEFAULT_SELF_REFINE_CONFIG: SelfRefineConfig = {
  minDifficulty: 0.5, // difficulty ≥ 3 on 1-5 scale → ≥ 0.5 normalized
  skipThreshold: 0.85,
  maxIterations: 1,
  alwaysRefineThirdOrder: true,
};

/** Refinement pipeline metrics */
export interface RefinementMetrics {
  /** Whether refinement was attempted */
  refined: boolean;
  /** Why refinement was skipped (if applicable) */
  skipReason: string | null;
  /** Critique score of the draft */
  draftScore: number | null;
  /** Critique score after refinement */
  refinedScore: number | null;
  /** Number of issues found in critique */
  issueCount: number;
  /** Categories of issues found */
  issueCategories: CritiqueCategory[];
}

// ─── Gate: Should We Refine? ────────────────────────────────────────────

/**
 * Determine if a question should go through the self-refine loop.
 */
export function shouldRefine(
  question: GeneratedQuestion,
  config: SelfRefineConfig = DEFAULT_SELF_REFINE_CONFIG
): { refine: boolean; reason: string } {
  // Third-order questions always get refined if configured
  if (config.alwaysRefineThirdOrder && isThirdOrder(question)) {
    return { refine: true, reason: 'Third-order question — always refine' };
  }

  // Difficulty gate
  if (question.difficulty < config.minDifficulty) {
    return { refine: false, reason: `Difficulty ${question.difficulty} below threshold ${config.minDifficulty}` };
  }

  return { refine: true, reason: 'Meets difficulty threshold' };
}

/**
 * Heuristic: is this a third-order (application/analysis) question?
 * Checks for keywords in the stem that suggest higher-order reasoning.
 */
export function isThirdOrder(question: GeneratedQuestion): boolean {
  const stem = question.question.toLowerCase();
  const thirdOrderCues = [
    'most likely diagnosis',
    'next best step',
    'most appropriate',
    'mechanism',
    'pathophysiology',
    'complication',
    'most likely cause',
    'best initial',
    'first-line',
    'expected finding',
    'most likely explains',
    'which of the following',
  ];
  return thirdOrderCues.some((cue) => stem.includes(cue));
}

// ─── Critique Prompt Builder ────────────────────────────────────────────

/**
 * Build the critique prompt for evaluating a generated question.
 * This prompt is sent to Gemini as a separate call.
 */
export function buildCritiquePrompt(
  question: GeneratedQuestion,
  clinicalContext?: string
): string {
  const contextBlock = clinicalContext
    ? `\nCLINICAL REFERENCE CONTEXT (for accuracy checking):\n${clinicalContext}\n`
    : '';

  return `You are an expert NBME item-writing reviewer evaluating a PANCE-style clinical question.
${contextBlock}
QUESTION TO EVALUATE:
Type: ${question.type}
Stem: ${question.question}
Options: ${question.options.join(' | ')}
Correct Answer: ${question.correctAnswer}
Explanation: ${question.explanation.rationale}

EVALUATE on these 8 dimensions (score each 0.0 to 1.0):

1. CLINICAL_ACCURACY: Are all clinical facts correct? Does the correct answer match current guidelines?
2. DISTRACTOR_PLAUSIBILITY: Would each wrong answer be correct for a slightly different patient? Are they all realistic?
3. BLOOMS_ALIGNMENT: Is this truly application/analysis level, not just recall?
4. STEM_CLARITY: Is the vignette clear? Does it include ≥2 pertinent negatives? Does it avoid unnecessary complexity?
5. ANSWER_HOMOGENEITY: Are all options grammatically parallel, similar length, and same category?
6. TESTWISE_CUES: Are there grammatical clues, absolute terms, or length differences that give away the answer?
7. DIAGNOSIS_IN_STEM: Does the stem avoid naming the diagnosis (should present raw patient data only)?
8. EXPLANATION_DEPTH: Does each whyIncorrect explain WHAT scenario the distractor is correct for AND why it fails for THIS patient? Are the explanations teaching-quality, not dismissive one-liners?

OUTPUT FORMAT (JSON):
{
  "overallScore": 0.0-1.0,
  "dimensions": [
    {"name": "clinical_accuracy", "score": 0.0-1.0, "feedback": "..."},
    {"name": "distractor_plausibility", "score": 0.0-1.0, "feedback": "..."},
    {"name": "blooms_alignment", "score": 0.0-1.0, "feedback": "..."},
    {"name": "stem_clarity", "score": 0.0-1.0, "feedback": "..."},
    {"name": "answer_homogeneity", "score": 0.0-1.0, "feedback": "..."},
    {"name": "testwise_cues", "score": 0.0-1.0, "feedback": "..."},
    {"name": "diagnosis_in_stem", "score": 0.0-1.0, "feedback": "..."},
    {"name": "explanation_depth", "score": 0.0-1.0, "feedback": "..."}
  ],
  "issues": [
    {"severity": "critical|major|minor", "category": "dimension_name", "description": "...", "suggestion": "..."}
  ],
  "feedbackForRewrite": "Concise 2-3 sentence summary of what to fix."
}

Return ONLY valid JSON. No markdown fences. Be strict — PANCE items must be clinically defensible.`;
}

// ─── Critique Parser ────────────────────────────────────────────────────

/**
 * Parse the raw critique JSON from Gemini into a typed CritiqueResult.
 */
export function parseCritiqueResponse(rawJson: string): CritiqueResult | null {
  try {
    const cleaned = rawJson.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      overallScore?: number;
      dimensions?: Array<{ name?: string; score?: number; feedback?: string }>;
      issues?: Array<{ severity?: string; category?: string; description?: string; suggestion?: string }>;
      feedbackForRewrite?: string;
    };

    if (typeof parsed.overallScore !== 'number') return null;

    const overallScore = clamp01(parsed.overallScore);

    const dimensions: CritiqueDimension[] = (parsed.dimensions ?? []).map((d) => ({
      name: d.name ?? 'unknown',
      score: clamp01(d.score ?? 0.5),
      feedback: d.feedback ?? '',
    }));

    const validCategories = new Set<string>([
      'clinical_accuracy', 'distractor_plausibility', 'blooms_alignment',
      'stem_clarity', 'answer_homogeneity', 'testwise_cues', 'diagnosis_in_stem',
      'explanation_depth',
    ]);

    const issues: CritiqueIssue[] = (parsed.issues ?? [])
      .filter((i) => i.description && validCategories.has(i.category ?? ''))
      .map((i) => ({
        severity: (['critical', 'major', 'minor'].includes(i.severity ?? '') ? i.severity : 'minor') as CritiqueIssue['severity'],
        category: i.category as CritiqueCategory,
        description: i.description ?? '',
        suggestion: i.suggestion ?? '',
      }));

    const needsRefinement = overallScore < DEFAULT_SELF_REFINE_CONFIG.skipThreshold
      || issues.some((i) => i.severity === 'critical');

    return {
      overallScore,
      needsRefinement,
      dimensions,
      issues,
      feedbackForRewrite: parsed.feedbackForRewrite ?? '',
    };
  } catch (err) {
    console.warn('[selfRefineService] critique parsing failed', err);
    return null;
  }
}

// ─── Rewrite Prompt Builder ─────────────────────────────────────────────

/**
 * Build the rewrite prompt incorporating critique feedback.
 */
export function buildRewritePrompt(
  originalQuestion: GeneratedQuestion,
  critique: CritiqueResult,
  clinicalContext?: string
): string {
  const contextBlock = clinicalContext
    ? `\nCLINICAL REFERENCE CONTEXT:\n${clinicalContext}\n`
    : '';

  const issueBlock = critique.issues
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.category}: ${i.description}. Fix: ${i.suggestion}`)
    .join('\n');

  return `You are an expert NBME item-writer. The following PANCE-style question was critiqued and needs improvement.
${contextBlock}
ORIGINAL QUESTION:
Stem: ${originalQuestion.question}
Options: ${originalQuestion.options.join(' | ')}
Correct Answer: ${originalQuestion.correctAnswer}

CRITIQUE FEEDBACK (score: ${critique.overallScore.toFixed(2)}/1.00):
${critique.feedbackForRewrite}

SPECIFIC ISSUES TO FIX:
${issueBlock || 'No specific issues — improve overall quality.'}

REWRITE RULES:
- Fix ALL identified issues while preserving the clinical concept being tested
- Do NOT name the diagnosis in the vignette stem — raw patient data only
- Include ≥2 pertinent negatives that rule out top differentials
- Each distractor must be correct for a different clinical scenario — explain WHAT scenario
- Every whyIncorrect MUST explain what the distractor IS correct for and why it fails for THIS patient
- Maintain or increase the Bloom's taxonomy level
- Keep the same correct answer concept (the clinical fact being tested should not change)

OUTPUT FORMAT (JSON):
{
  "vignette": "Realistic clinical vignette (2-4 sentences, raw patient data only)...",
  "question": "What is the most likely diagnosis?",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option",
    "E": "Fifth option"
  },
  "correctAnswer": "B",
  "rationale": {
    "bottomLine": "The diagnosis is X, and the key discriminator is Y.",
    "whyCorrect": "Walk through vignette steps that lead to the diagnosis, referencing specific findings.",
    "whyIncorrectA": "Incorrect because [specific reason]. This would be correct for [different clinical scenario].",
    "whyIncorrectB": "Incorrect because [specific reason]. This would be correct for [different clinical scenario].",
    "whyIncorrectC": "Incorrect because [specific reason]. This would be correct for [different clinical scenario].",
    "whyIncorrectD": "Incorrect because [specific reason]. This would be correct for [different clinical scenario].",
    "whyIncorrectE": "Incorrect because [specific reason]. This would be correct for [different clinical scenario].",
    "clinicalPearl": "Remember: [one actionable key takeaway for PANCE].",
    "highYieldImageOrTable": "N/A"
  },
  "difficulty": ${originalQuestion.difficulty},
  "sourceSections": ${JSON.stringify(originalQuestion.sourceSections ?? [])},
  "sourceConditions": ${JSON.stringify(originalQuestion.sourceConditions ?? [])}
}

Return ONLY valid JSON. No markdown fences.`;
}

// ─── Metrics ────────────────────────────────────────────────────────────

/**
 * Build refinement metrics for logging/analytics.
 */
export function buildRefinementMetrics(
  refined: boolean,
  skipReason: string | null,
  critique: CritiqueResult | null,
  refinedCritique?: CritiqueResult | null
): RefinementMetrics {
  return {
    refined,
    skipReason,
    draftScore: critique?.overallScore ?? null,
    refinedScore: refinedCritique?.overallScore ?? null,
    issueCount: critique?.issues.length ?? 0,
    issueCategories: [...new Set((critique?.issues ?? []).map((i) => i.category))],
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  if (!isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}
