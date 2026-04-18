/**
 * Generation contracts — PANCE/PANRE question generation, drill item generation,
 * contrastive questions, causal-chain items.
 *
 * All generated questions carry NCCPA blueprint metadata, cognitive level,
 * and safety fields. The gateway refuses to persist items missing required
 * metadata.
 */

import { z } from 'zod';

const ChoiceSchema = z.object({
  id: z.string().regex(/^[A-E]$/),
  text: z.string().min(1).max(400),
  isCorrect: z.boolean(),
  rationale: z.string().min(5).max(2000),
});

export const GeneratedQuestionSchema = z.object({
  format: z.enum(['MCQ', 'SHORT_ANSWER', 'CASE', 'IMAGE_MCQ']),
  questionOrder: z.enum([
    'FIRST_ORDER', // recall
    'SECOND_ORDER', // application
    'THIRD_ORDER', // analysis / synthesis
  ]),
  cognitiveLevel: z.enum([
    'RECALL',
    'APPLICATION',
    'ANALYSIS',
    'EVALUATION',
    'CREATE',
  ]),
  taskCategory: z.enum([
    'HISTORY_PE',
    'DIAGNOSTIC_STUDIES',
    'DIAGNOSIS',
    'CLINICAL_INTERVENTIONS',
    'PHARMACOLOGY',
    'HEALTH_MAINTENANCE',
    'PROFESSIONAL_PRACTICE',
  ]),
  organSystem: z.string().min(2),
  blueprintTopic: z.string().min(2),
  vignette: z.string().min(40).max(3000),
  questionStem: z.string().min(5).max(500),
  choices: z.array(ChoiceSchema).length(5),
  correctChoiceId: z.string().regex(/^[A-E]$/),
  teachingPoint: z.string().min(10).max(2000),
  buzzwords: z.array(z.string()).max(10).default([]),
  redFlags: z.array(z.string()).default([]),
  safetyReview: z.object({
    reviewed: z.literal(true),
    containsDangerousAdvice: z.boolean(),
    notes: z.string().default(''),
  }),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const GENERATED_QUESTION_DESCRIPTION = `{
  "format": "MCQ" | "SHORT_ANSWER" | "CASE" | "IMAGE_MCQ",
  "questionOrder": "FIRST_ORDER" | "SECOND_ORDER" | "THIRD_ORDER",
  "cognitiveLevel": "RECALL" | "APPLICATION" | "ANALYSIS" | "EVALUATION" | "CREATE",
  "taskCategory": "HISTORY_PE" | "DIAGNOSTIC_STUDIES" | "DIAGNOSIS" | "CLINICAL_INTERVENTIONS" | "PHARMACOLOGY" | "HEALTH_MAINTENANCE" | "PROFESSIONAL_PRACTICE",
  "organSystem": string,
  "blueprintTopic": string,
  "vignette": string (40-3000 chars),
  "questionStem": string,
  "choices": [{ "id": "A"-"E", "text": string, "isCorrect": boolean, "rationale": string } x5 exactly],
  "correctChoiceId": "A"-"E",
  "teachingPoint": string,
  "buzzwords": string[] (up to 10),
  "redFlags": string[],
  "safetyReview": { "reviewed": true, "containsDangerousAdvice": boolean, "notes": string }
}`;

export const ContrastiveQuestionSchema = z.object({
  vignette: z.string().min(40).max(3000),
  keyDistinguishers: z.array(z.string()).min(1).max(10),
  whyNotOthers: z.record(z.string(), z.string()),
  correctCondition: z.string(),
});
export type ContrastiveQuestion = z.infer<typeof ContrastiveQuestionSchema>;

export const CausalChainSchema = z.object({
  rootCause: z.string(),
  chain: z
    .array(
      z.object({
        step: z.number().int().min(1),
        mechanism: z.string(),
        clinicalCorrelate: z.string(),
      }),
    )
    .min(2)
    .max(10),
  terminalFinding: z.string(),
  teachingPoint: z.string().max(2000),
});
export type CausalChain = z.infer<typeof CausalChainSchema>;
