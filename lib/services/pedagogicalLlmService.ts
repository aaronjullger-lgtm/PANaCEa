/**
 * Pedagogical LLM Service — Tier 3 Experimental Feature
 *
 * Shared pedagogical AI layer implementing Google's LearnLM approach
 * via the PARTS framework (Persona, Act, Recipient, Theme, Structure).
 *
 * This service provides:
 *   1. Centralized pedagogical prompt construction for all AI features
 *   2. LearnLM's five learning science principles as prompt directives
 *   3. FSRS-informed learner state descriptions for context injection
 *   4. Pedagogical quality scoring rubric for response evaluation
 *   5. Cost tracking and model routing recommendations
 *
 * Three-phase approach per tier3.md:
 *   Phase 1 (current): Gemini + LearnLM system instructions (PARTS framework)
 *   Phase 2 (future): Collect interaction data, fine-tune with DPO
 *   Phase 3 (future): Online RL alignment
 *
 * Research basis:
 *   - Google LearnLM: 82% preference over GPT-4o in blind comparisons
 *   - Eedi RCT: 5.5pp improvement in novel problem-solving
 *   - LearnLM principles: cognitive load, active learning, metacognition,
 *     curiosity, adaptation
 *   - arXiv:2505.15607: 7B model with online RL outperformed LearnLM
 *   - arXiv:2503.06424: DPO fine-tuning matched GPT-4o tutoring quality
 *
 * @module lib/services/pedagogicalLlmService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** LearnLM's five learning science principles */
export type LearnLmPrinciple =
  | 'manage_cognitive_load'
  | 'inspire_active_learning'
  | 'deepen_metacognition'
  | 'stimulate_curiosity'
  | 'adapt_to_learner';

/** AI feature context for pedagogical prompt customization */
export type PedagogicalFeature =
  | 'socratic_tutor'
  | 'mnemonic_generator'
  | 'confusion_explainer'
  | 'question_generator'
  | 'osce_simulator'
  | 'content_enrichment'
  | 'general_tutor';

/** PARTS framework components for prompt construction */
export interface PartsFramework {
  persona: string;
  act: string;
  recipient: string;
  theme: string;
  structure: string;
}

/** Learner context derived from FSRS and session data */
export interface LearnerContext {
  /** Current topic being studied */
  topic: string;
  /** FSRS retrievability for this topic/card (optional) */
  retrievability?: number;
  /** FSRS difficulty for this topic/card (optional) */
  difficulty?: number;
  /** Number of reviews for this topic (optional) */
  reviewCount?: number;
  /** Number of lapses (optional) */
  lapseCount?: number;
  /** Current session question count (optional) */
  sessionQuestionCount?: number;
  /** Current session accuracy (optional) */
  sessionAccuracy?: number;
  /** Fatigue level (optional) */
  fatigueLevel?: 'none' | 'mild' | 'moderate' | 'severe';
  /** Organ system (optional) */
  organSystem?: string;
}

/** Pedagogical quality dimensions for evaluation */
export interface PedagogicalQualityScore {
  /** Does the response manage cognitive load appropriately? [0, 1] */
  cognitiveLoad: number;
  /** Does it inspire active learning (not just passive reading)? [0, 1] */
  activeLearning: number;
  /** Does it encourage metacognition (thinking about thinking)? [0, 1] */
  metacognition: number;
  /** Does it stimulate curiosity? [0, 1] */
  curiosity: number;
  /** Is it adapted to the learner's current state? [0, 1] */
  adaptation: number;
  /** Composite score [0, 1] */
  overall: number;
  /** Whether the response leaked the answer prematurely */
  solutionLeakage: boolean;
}

/** Model routing recommendation */
export interface ModelRecommendation {
  /** Recommended Gemini model */
  model: string;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Temperature setting */
  temperature: number;
  /** Estimated cost per interaction in USD */
  estimatedCostUsd: number;
  /** Whether this feature benefits from extended thinking */
  useExtendedThinking: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** LearnLM principle directives — injected into every pedagogical prompt */
export const LEARNLM_DIRECTIVES: Record<LearnLmPrinciple, string> = {
  manage_cognitive_load:
    'Present information in digestible chunks. Avoid overwhelming the student. Build from simple to complex.',
  inspire_active_learning:
    'Ask the student to DO something — predict, explain, compare, apply — rather than passively receive information.',
  deepen_metacognition:
    'Prompt the student to reflect on their thinking: "What made you think that?" or "How confident are you?"',
  stimulate_curiosity:
    'Connect to clinical scenarios or surprising facts. Make the student WANT to know more.',
  adapt_to_learner:
    'Adjust difficulty, vocabulary, and depth based on the student\'s demonstrated knowledge level.',
};

/** Feature-specific persona descriptions */
export const FEATURE_PERSONAS: Record<PedagogicalFeature, string> = {
  socratic_tutor:
    'You are a Socratic medical education tutor who guides PA students to discover answers through carefully calibrated questions.',
  mnemonic_generator:
    'You are a creative medical mnemonic designer who crafts vivid, memorable visual and verbal associations for difficult concepts.',
  confusion_explainer:
    'You are a medical education specialist who helps students distinguish between commonly confused conditions, drugs, and concepts.',
  question_generator:
    'You are a PANCE exam item writer who creates clinically accurate, educationally valuable multiple-choice questions.',
  osce_simulator:
    'You are a standardized patient in an OSCE examination, responding realistically to the student\'s clinical approach.',
  content_enrichment:
    'You are a medical education content curator who enriches clinical reference material with teaching pearls and clinical correlations.',
  general_tutor:
    'You are a supportive medical education tutor for PA students preparing for the PANCE examination.',
};

/** Model routing by feature */
export const MODEL_ROUTING: Record<PedagogicalFeature, ModelRecommendation> = {
  socratic_tutor: {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 256,
    temperature: 0.5,
    estimatedCostUsd: 0.0006,
    useExtendedThinking: false,
  },
  mnemonic_generator: {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 512,
    temperature: 0.8, // Higher creativity for mnemonics
    estimatedCostUsd: 0.001,
    useExtendedThinking: false,
  },
  confusion_explainer: {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 512,
    temperature: 0.3, // Lower for factual accuracy
    estimatedCostUsd: 0.001,
    useExtendedThinking: false,
  },
  question_generator: {
    model: 'gemini-2.5-pro',
    maxOutputTokens: 1024,
    temperature: 0.4,
    estimatedCostUsd: 0.01,
    useExtendedThinking: true, // Complex clinical reasoning
  },
  osce_simulator: {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 512,
    temperature: 0.6,
    estimatedCostUsd: 0.002,
    useExtendedThinking: false,
  },
  content_enrichment: {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 1024,
    temperature: 0.3,
    estimatedCostUsd: 0.002,
    useExtendedThinking: false,
  },
  general_tutor: {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 512,
    temperature: 0.5,
    estimatedCostUsd: 0.001,
    useExtendedThinking: false,
  },
};

// ─── Prompt Construction ─────────────────────────────────────────────────────

/**
 * Build a PARTS-framework pedagogical system prompt for any AI feature.
 *
 * This is the shared prompt builder that ensures all AI interactions
 * in PANaCEa follow LearnLM's pedagogical principles consistently.
 *
 * @param feature - Which AI feature is making the request
 * @param learner - Learner context for personalization
 * @param additionalStructure - Feature-specific instructions to append
 * @returns Complete system prompt string
 */
export function buildPedagogicalPrompt(
  feature: PedagogicalFeature,
  learner: LearnerContext,
  additionalStructure?: string
): string {
  const parts = buildPartsFramework(feature, learner, additionalStructure);

  return `${parts.persona}

${parts.act}

${parts.recipient}

${parts.theme}

${parts.structure}

PEDAGOGICAL PRINCIPLES (apply throughout):
1. ${LEARNLM_DIRECTIVES.manage_cognitive_load}
2. ${LEARNLM_DIRECTIVES.inspire_active_learning}
3. ${LEARNLM_DIRECTIVES.deepen_metacognition}
4. ${LEARNLM_DIRECTIVES.stimulate_curiosity}
5. ${LEARNLM_DIRECTIVES.adapt_to_learner}

CLINICAL ACCURACY: Ensure all medical information is factually accurate and appropriate for PANCE-level content. If uncertain about a clinical fact, say so rather than guess.`;
}

/**
 * Build the individual PARTS framework components.
 */
export function buildPartsFramework(
  feature: PedagogicalFeature,
  learner: LearnerContext,
  additionalStructure?: string
): PartsFramework {
  return {
    persona: `[PERSONA] ${FEATURE_PERSONAS[feature]}`,
    act: buildActDirective(feature),
    recipient: buildRecipientDescription(learner),
    theme: `[THEME] ${learner.topic}${learner.organSystem ? ` (${learner.organSystem})` : ''}`,
    structure: buildStructureDirective(feature, learner, additionalStructure),
  };
}

function buildActDirective(feature: PedagogicalFeature): string {
  switch (feature) {
    case 'socratic_tutor':
      return '[ACT] Guide the student to discover their error through calibrated Socratic questioning. Never give the answer directly unless at the final hint level.';
    case 'mnemonic_generator':
      return '[ACT] Create a vivid, memorable mnemonic that uses dual coding (visual + verbal) to encode the key features of this concept.';
    case 'confusion_explainer':
      return '[ACT] Clearly distinguish between the two commonly confused concepts, highlighting the KEY differentiating features.';
    case 'question_generator':
      return '[ACT] Generate a clinically accurate PANCE-style multiple-choice question that tests understanding at the appropriate Bloom\'s taxonomy level.';
    case 'osce_simulator':
      return '[ACT] Respond as a realistic standardized patient. Answer the student\'s questions naturally and provide physical exam findings when asked.';
    case 'content_enrichment':
      return '[ACT] Enrich the clinical content with teaching pearls, clinical correlations, and high-yield PANCE facts.';
    case 'general_tutor':
      return '[ACT] Help the student learn this topic effectively using evidence-based pedagogical techniques.';
  }
}

function buildRecipientDescription(learner: LearnerContext): string {
  const parts: string[] = ['[RECIPIENT] PA student'];

  if (learner.retrievability !== undefined) {
    const level = learner.retrievability < 0.4 ? 'struggling' :
                  learner.retrievability < 0.75 ? 'developing' : 'strong';
    parts.push(`with ${level} recall of this topic`);
  }

  if (learner.fatigueLevel && learner.fatigueLevel !== 'none') {
    parts.push(`(currently experiencing ${learner.fatigueLevel} fatigue — keep responses concise)`);
  }

  if (learner.sessionQuestionCount !== undefined && learner.sessionAccuracy !== undefined) {
    parts.push(`— ${learner.sessionQuestionCount} questions into session at ${Math.round(learner.sessionAccuracy * 100)}% accuracy`);
  }

  return parts.join(' ');
}

function buildStructureDirective(
  feature: PedagogicalFeature,
  learner: LearnerContext,
  additionalStructure?: string
): string {
  const adaptationNote = getAdaptationNote(learner);
  const additional = additionalStructure ? `\n${additionalStructure}` : '';

  return `[STRUCTURE]
${adaptationNote}
- Keep responses focused and clinically relevant
- Use medical terminology appropriate for a PA student level
- Format for readability (short paragraphs, no walls of text)${additional}`;
}

function getAdaptationNote(learner: LearnerContext): string {
  if (learner.retrievability === undefined) {
    return '- Adapt to the student\'s demonstrated knowledge level during this interaction';
  }

  if (learner.retrievability < 0.4) {
    return '- This student is struggling with this topic — use simpler language, break concepts into smaller pieces, and focus on foundational understanding';
  }

  if (learner.retrievability < 0.75) {
    return '- This student has developing knowledge — challenge them to make connections and apply concepts, but provide scaffolding when needed';
  }

  return '- This student has strong recall — challenge them with higher-order thinking, clinical applications, and edge cases';
}

// ─── Model Routing ───────────────────────────────────────────────────────────

/**
 * Get the recommended model configuration for a pedagogical feature.
 */
export function getModelRecommendation(feature: PedagogicalFeature): ModelRecommendation {
  return MODEL_ROUTING[feature];
}

/**
 * Estimate the cost of an AI interaction.
 *
 * @param feature - The AI feature
 * @param inputTokens - Estimated input tokens
 * @param outputTokens - Estimated output tokens
 * @returns Estimated cost in USD
 */
export function estimateInteractionCost(
  feature: PedagogicalFeature,
  inputTokens: number = 1000,
  outputTokens: number = 256
): number {
  const model = MODEL_ROUTING[feature].model;

  // Gemini pricing (as of 2025)
  const pricing: Record<string, { input: number; output: number }> = {
    'gemini-2.5-flash': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    'gemini-2.5-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
  };

  const rates = pricing[model] ?? pricing['gemini-2.5-flash']!;
  return inputTokens * rates.input + outputTokens * rates.output;
}

// ─── Pedagogical Quality Evaluation ──────────────────────────────────────────

/**
 * Evaluate a response against LearnLM's pedagogical quality dimensions.
 *
 * This is a heuristic scorer for automated evaluation. For production use,
 * pair with periodic expert review per tier3.md evaluation stack.
 *
 * @param response - The AI-generated response text
 * @param feature - Which feature generated it
 * @returns Quality score across all dimensions
 */
export function evaluatePedagogicalQuality(
  response: string,
  feature: PedagogicalFeature
): PedagogicalQualityScore {
  const lower = response.toLowerCase();

  // Cognitive load: shorter, structured responses score higher
  const wordCount = response.split(/\s+/).length;
  const cognitiveLoad = wordCount < 50 ? 1.0 : wordCount < 150 ? 0.8 : wordCount < 300 ? 0.5 : 0.3;

  // Active learning: contains questions or action verbs
  const questionMarks = (response.match(/\?/g) ?? []).length;
  const actionVerbs = ['think', 'consider', 'compare', 'explain', 'predict', 'what if', 'how would'];
  const hasActionVerbs = actionVerbs.some(v => lower.includes(v));
  const activeLearning = Math.min(1, (questionMarks * 0.3 + (hasActionVerbs ? 0.4 : 0)));

  // Metacognition: asks about thinking process
  const metacogPhrases = ['what made you', 'how confident', 'why do you think', 'what\'s your reasoning', 'reflect on'];
  const metacognition = metacogPhrases.some(p => lower.includes(p)) ? 0.8 : 0.2;

  // Curiosity: surprising facts, clinical connections, "interesting"
  const curiosityPhrases = ['interesting', 'surprisingly', 'did you know', 'clinically', 'in practice', 'real-world'];
  const curiosity = curiosityPhrases.some(p => lower.includes(p)) ? 0.7 : 0.3;

  // Adaptation: references to student's level (heuristic)
  const adaptPhrases = ['your response', 'you mentioned', 'based on what you', 'given your'];
  const adaptation = adaptPhrases.some(p => lower.includes(p)) ? 0.8 : 0.4;

  // Solution leakage detection (for Socratic features)
  const leakagePhrases = ['the answer is', 'the correct answer', 'it\'s actually'];
  const solutionLeakage = feature === 'socratic_tutor' && leakagePhrases.some(p => lower.includes(p));

  const overall = (cognitiveLoad + activeLearning + metacognition + curiosity + adaptation) / 5;

  return {
    cognitiveLoad,
    activeLearning,
    metacognition,
    curiosity,
    adaptation,
    overall,
    solutionLeakage,
  };
}
