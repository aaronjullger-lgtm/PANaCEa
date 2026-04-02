/**
 * JSON Schema for Gemini 2.5 structured output mode.
 * Used with responseSchema parameter in generationConfig.
 */

export const QUESTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['mcq', 'vignette'],
      description: 'Question format type'
    },
    question: {
      type: 'string',
      description: 'Clinical vignette stem (patient case, findings, and question). Must be at least 50 characters and must NOT contain the diagnosis name or condition being tested.'
    },
    options: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Exactly 4 multiple choice options (A, B, C, D)'
    },
    correctAnswer: {
      type: 'string',
      description: 'The correct answer, must match one element of options exactly'
    },
    explanation: {
      type: 'object',
      properties: {
        rationale: {
          type: 'string',
          description: 'Detailed explanation of why the correct answer is correct for this patient'
        },
        incorrect: {
          type: 'object',
          properties: {
            A: {
              type: 'string',
              description: 'Why option A is incorrect; identify the type of patient or scenario where it would be correct'
            },
            B: {
              type: 'string',
              description: 'Why option B is incorrect; identify the type of patient or scenario where it would be correct'
            },
            C: {
              type: 'string',
              description: 'Why option C is incorrect; identify the type of patient or scenario where it would be correct'
            },
            D: {
              type: 'string',
              description: 'Why option D is incorrect; identify the type of patient or scenario where it would be correct'
            }
          },
          required: ['A', 'B', 'C', 'D'],
          description: 'Explanations for each incorrect option'
        }
      },
      required: ['rationale', 'incorrect'],
      description: 'Structured explanation of the answer and distractors'
    },
    difficulty: {
      type: 'number',
      description: 'Difficulty score between 0.0 (easiest) and 1.0 (hardest). Typical values: 0.3-0.4 (easy), 0.5 (medium), 0.6-0.7 (hard/third-order), 0.8-0.9 (very hard)'
    },
    sourceSections: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Optional array of source section keys (e.g., ["clinicalPresentation", "treatment"])'
    }
  },
  required: ['type', 'question', 'options', 'correctAnswer', 'explanation', 'difficulty']
};

/**
 * TypeScript interface matching the schema exactly.
 * Use this for type-safe handling after JSON parsing.
 */
export interface GeneratedQuestionStrict {
  type: 'mcq' | 'vignette';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: {
    rationale: string;
    incorrect: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
  };
  difficulty: number;
  sourceSections?: string[];
}
