/**
 * Socratic Hint Service
 * Sprint 6: Guided learning through leading questions (not direct answers)
 *
 * Based on cognitive science principles:
 * - Desirable difficulties enhance long-term retention
 * - Self-generated answers are remembered better
 * - Metacognitive prompts improve clinical reasoning
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SocraticHint {
  type: 'leading_question' | 'reasoning_prompt' | 'comparison' | 'anchoring';
  content: string;
  targetReasoning: string; // What we want the learner to realize
  difficultyLevel: 1 | 2 | 3; // 1 = gentle, 2 = moderate, 3 = challenging
}

export interface HintGenerationContext {
  questionStem: string;
  correctAnswer: string;
  selectedAnswer: string;
  organSystem: string;
  conditionName?: string;
  differentialDiagnoses?: string[];
  keyFindings?: string[];
}

// =============================================================================
// HINT TEMPLATES BY REASONING ERROR TYPE
// =============================================================================

const REASONING_ERROR_HINTS: Record<string, SocraticHint[]> = {
  // Missed key finding
  missed_finding: [
    {
      type: 'leading_question',
      content: 'What specific finding in the stem might change your differential?',
      targetReasoning: 'Re-examine key clinical findings',
      difficultyLevel: 1,
    },
    {
      type: 'reasoning_prompt',
      content: 'Consider: Is there a red flag symptom you may have overlooked?',
      targetReasoning: 'Identify overlooked critical findings',
      difficultyLevel: 2,
    },
  ],

  // Wrong organ system
  wrong_system: [
    {
      type: 'leading_question',
      content: "Which organ system best explains ALL the patient's symptoms together?",
      targetReasoning: 'Unify symptoms under correct system',
      difficultyLevel: 1,
    },
    {
      type: 'comparison',
      content: 'Compare: What would be different if this were truly a {wrong_system} problem?',
      targetReasoning: 'Distinguish between systems by expected findings',
      difficultyLevel: 2,
    },
  ],

  // Premature closure
  premature_closure: [
    {
      type: 'reasoning_prompt',
      content: 'Before committing: What findings would RULE OUT your initial impression?',
      targetReasoning: 'Consider disconfirming evidence',
      difficultyLevel: 2,
    },
    {
      type: 'leading_question',
      content:
        'If this patient had {correct_condition}, what additional symptoms might you expect?',
      targetReasoning: 'Expand consideration of correct diagnosis',
      difficultyLevel: 2,
    },
  ],

  // Similar conditions confusion
  similar_conditions: [
    {
      type: 'comparison',
      content: "What's the KEY distinguishing feature between {selected} and {correct}?",
      targetReasoning: 'Identify pathognomonic differences',
      difficultyLevel: 2,
    },
    {
      type: 'anchoring',
      content: "Remember: '{buzzword}' is classically associated with which condition?",
      targetReasoning: 'Recall high-yield associations',
      difficultyLevel: 1,
    },
  ],

  // Treatment vs diagnosis confusion
  treatment_confusion: [
    {
      type: 'leading_question',
      content: 'Is the question asking for diagnosis, next best step, or definitive treatment?',
      targetReasoning: 'Clarify question intent',
      difficultyLevel: 1,
    },
    {
      type: 'reasoning_prompt',
      content: 'Before treating: Do we need to confirm the diagnosis first?',
      targetReasoning: 'Consider diagnostic before therapeutic steps',
      difficultyLevel: 2,
    },
  ],
};

// =============================================================================
// GENERIC SOCRATIC PROMPTS
// =============================================================================

const GENERIC_PROMPTS: SocraticHint[] = [
  {
    type: 'reasoning_prompt',
    content: 'Walk through your reasoning: Why did you eliminate the other options?',
    targetReasoning: 'Explicit reasoning verbalization',
    difficultyLevel: 1,
  },
  {
    type: 'leading_question',
    content: "What's the most likely diagnosis given this patient's age and presentation?",
    targetReasoning: 'Consider epidemiology and demographics',
    difficultyLevel: 1,
  },
  {
    type: 'comparison',
    content: 'How would this presentation differ in an acute vs chronic setting?',
    targetReasoning: 'Consider temporal aspects',
    difficultyLevel: 2,
  },
  {
    type: 'reasoning_prompt',
    content: "What's the 'cannot miss' diagnosis here, even if less likely?",
    targetReasoning: 'Consider worst-first approach',
    difficultyLevel: 2,
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class SocraticHintService {
  /**
   * Generate a Socratic hint based on the learner's incorrect answer
   */
  static generateHint(context: HintGenerationContext): SocraticHint {
    // Analyze the error type
    const errorType = this.classifyError(context);

    // Get relevant hints for this error type
    const relevantHints = REASONING_ERROR_HINTS[errorType] || GENERIC_PROMPTS;

    // Select a hint (rotate through based on some randomness for variety)
    const hintIndex = Math.floor(Math.random() * relevantHints.length);
    const selectedHint = { ...relevantHints[hintIndex] };

    // Customize the hint with context
    selectedHint.content = this.customizeHint(selectedHint.content, context);

    return selectedHint;
  }

  /**
   * Classify the type of reasoning error
   */
  static classifyError(context: HintGenerationContext): string {
    const { correctAnswer, selectedAnswer, organSystem, conditionName } = context;

    // Simple heuristics for error classification
    // In a real implementation, this would use AI or more sophisticated logic

    // Check if answers are in same "family"
    const conditionKeywords = (conditionName || '').toLowerCase();
    const selectedLower = selectedAnswer.toLowerCase();

    // Similar condition confusion
    if (this.areSimilarConditions(correctAnswer, selectedAnswer)) {
      return 'similar_conditions';
    }

    // Treatment confusion (if answer contains treatment-like words)
    if (this.isTreatmentRelated(selectedAnswer)) {
      return 'treatment_confusion';
    }

    // Default to premature closure
    return 'premature_closure';
  }

  /**
   * Check if two answers represent similar/confusable conditions
   */
  static areSimilarConditions(correct: string, selected: string): boolean {
    const similarityPairs = [
      ['MI', 'angina'],
      ['type 1 diabetes', 'type 2 diabetes'],
      ['hyperthyroid', 'hypothyroid'],
      ['crohn', 'ulcerative colitis'],
      ['bacterial', 'viral'],
      ['osteoarthritis', 'rheumatoid arthritis'],
      ['depression', 'anxiety'],
      ['asthma', 'copd'],
    ];

    const correctLower = correct.toLowerCase();
    const selectedLower = selected.toLowerCase();

    return similarityPairs.some(
      ([a, b]) =>
        (correctLower.includes(a) && selectedLower.includes(b)) ||
        (correctLower.includes(b) && selectedLower.includes(a))
    );
  }

  /**
   * Check if answer is treatment-related
   */
  static isTreatmentRelated(answer: string): boolean {
    const treatmentKeywords = [
      'prescribe',
      'administer',
      'start',
      'give',
      'mg',
      'mcg',
      'antibiotic',
      'surgery',
      'refer',
      'admit',
      'discharge',
      'follow-up',
    ];

    const answerLower = answer.toLowerCase();
    return treatmentKeywords.some((kw) => answerLower.includes(kw));
  }

  /**
   * Customize hint text with specific context
   */
  static customizeHint(template: string, context: HintGenerationContext): string {
    return template
      .replace('{selected}', context.selectedAnswer)
      .replace('{correct}', context.correctAnswer)
      .replace('{wrong_system}', context.organSystem)
      .replace('{correct_condition}', context.conditionName || 'the correct diagnosis')
      .replace('{buzzword}', this.extractBuzzword(context.questionStem));
  }

  /**
   * Extract potential buzzword from question stem
   */
  static extractBuzzword(stem: string): string {
    const buzzwordPatterns = [
      /worst (headache|pain) of (their|my) life/i,
      /thunderclap/i,
      /cherry red spot/i,
      /café au lait/i,
      /butterfly rash/i,
      /barking cough/i,
      /rice water/i,
      /currant jelly/i,
      /strawberry tongue/i,
      /target lesion/i,
      /herald patch/i,
    ];

    for (const pattern of buzzwordPatterns) {
      const match = stem.match(pattern);
      if (match && match[0]) return match[0];
    }

    return 'the key finding';
  }

  /**
   * Generate multiple hints in order of increasing difficulty
   */
  static generateProgressiveHints(
    context: HintGenerationContext,
    count: number = 3
  ): SocraticHint[] {
    const hints: SocraticHint[] = [];
    const usedContents = new Set<string>();

    // Get hints from specific error type
    const errorType = this.classifyError(context);
    const specificHints = REASONING_ERROR_HINTS[errorType] || [];

    // Combine with generic hints
    const allHints = [...specificHints, ...GENERIC_PROMPTS];

    // Sort by difficulty
    const sortedHints = allHints.sort((a, b) => a.difficultyLevel - b.difficultyLevel);

    // Select unique hints up to count
    for (const hint of sortedHints) {
      if (hints.length >= count) break;
      if (!usedContents.has(hint.content)) {
        const customized = { ...hint };
        customized.content = this.customizeHint(hint.content, context);
        hints.push(customized);
        usedContents.add(hint.content);
      }
    }

    return hints;
  }

  /**
   * Generate a metacognitive reflection prompt after explanation
   */
  static generateReflectionPrompt(wasCorrect: boolean): string {
    const correctPrompts = [
      'What made you confident this was the right answer?',
      'Which finding was most diagnostic for you?',
      'How would you explain this to a patient?',
    ];

    const incorrectPrompts = [
      'What would you do differently next time?',
      'What distractor finding led you astray?',
      'How will you remember the key distinction?',
    ];

    const prompts = wasCorrect ? correctPrompts : incorrectPrompts;
    return prompts[Math.floor(Math.random() * prompts.length)];
  }
}

export default SocraticHintService;
