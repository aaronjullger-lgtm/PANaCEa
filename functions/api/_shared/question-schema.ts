/**
 * JSON Schema for Gemini 2.5 structured output mode.
 * Used with responseSchema parameter in generationConfig.
 *
 * Supports 4 OR 5 options (A–D or A–E) to align with PANCE blueprint.
 * When 5 options are generated, explanation.incorrect.E is required.
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
      description: '4 or 5 multiple choice options (A–D or A–E). PANCE uses 4 options; use 5 when additional plausible distractors improve discrimination.'
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
            },
            E: {
              type: 'string',
              description: 'Why option E is incorrect (only when 5 options are present); identify the type of patient or scenario where it would be correct'
            }
          },
          required: ['A', 'B', 'C', 'D'],
          description: 'Explanations for each incorrect option. A–D are required; E is required when 5 options are present.'
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
    },
    questionOrder: {
      type: 'string',
      enum: ['first', 'second', 'third'],
      description: 'Bloom\'s taxonomy-mapped question order. first=Remember/Understand (recall a fact, difficulty 0.2-0.4). second=Apply/Analyze (diagnose then treat, one intermediate step, difficulty 0.4-0.6). third=Evaluate/Create (multi-step vignette with confounders, difficulty 0.6-0.9).'
    },
    taskCategory: {
      type: 'string',
      enum: ['history_pe', 'diagnostics', 'diagnosis', 'management', 'health_maintenance', 'pharmaceutical', 'basic_science', 'professional'],
      description: 'PANCE task category. history_pe=History taking & physical exam. diagnostics=Ordering/interpreting labs & imaging. diagnosis=Formulating most likely diagnosis. management=Clinical interventions & treatment planning. health_maintenance=Preventive care & screening. pharmaceutical=Pharmacotherapy selection & monitoring. basic_science=Pathophysiology & mechanisms. professional=Ethics, communication, patient education.'
    }
  },
  required: ['type', 'question', 'options', 'correctAnswer', 'explanation', 'difficulty', 'questionOrder', 'taskCategory']
};

/**
 * TypeScript interface matching the schema exactly.
 * Use this for type-safe handling after JSON parsing.
 */
/** Bloom's taxonomy-mapped question order for PA education */
export type QuestionOrder = 'first' | 'second' | 'third';

/** PANCE task categories aligned with NCCPA content blueprint */
export type TaskCategory =
  | 'history_pe'
  | 'diagnostics'
  | 'diagnosis'
  | 'management'
  | 'health_maintenance'
  | 'pharmaceutical'
  | 'basic_science'
  | 'professional';

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
      /** Present when question has 5 options */
      E?: string;
    };
  };
  difficulty: number;
  sourceSections?: string[];
  questionOrder: QuestionOrder;
  taskCategory: TaskCategory;
}
