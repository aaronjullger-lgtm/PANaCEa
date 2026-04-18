/**
 * Tutoring contracts — Socratic tutor, coaching chat, remediation dialogue.
 *
 * Non-streaming Socratic turns use SocraticTurnSchema so we can enforce
 * that the tutor returns exactly one question plus (optionally) a hint
 * tier, never a full answer. Streaming turns use the raw text surface but
 * post-stream can still be validated if a structured summary is requested.
 */

import { z } from 'zod';

export const SocraticTurnSchema = z.object({
  question: z.string().min(5).max(600),
  hintTier: z.enum(['none', 'nudge', 'partial_answer', 'full_answer']).default('none'),
  hintText: z.string().max(2000).optional(),
  targetConcept: z.string().max(200),
  expectedStudentResponseType: z.enum([
    'recall',
    'explanation',
    'diagnosis',
    'management_plan',
    'mechanism',
  ]),
  exitSignal: z
    .enum(['continue', 'student_mastered', 'student_stuck_escalate'])
    .default('continue'),
});
export type SocraticTurn = z.infer<typeof SocraticTurnSchema>;

export const SOCRATIC_TURN_DESCRIPTION = `{
  "question": string (exactly ONE Socratic question to ask the student),
  "hintTier": "none" | "nudge" | "partial_answer" | "full_answer",
  "hintText": string (only if hintTier != "none"),
  "targetConcept": string (what this turn is probing for),
  "expectedStudentResponseType": "recall" | "explanation" | "diagnosis" | "management_plan" | "mechanism",
  "exitSignal": "continue" | "student_mastered" | "student_stuck_escalate"
}`;

export const CoachingTurnSchema = z.object({
  messageToStudent: z.string().min(1).max(2000),
  toneCategory: z.enum([
    'encouraging',
    'redirecting',
    'celebratory',
    'grounding',
    'safety_check',
  ]),
  suggestedNextAction: z
    .enum(['continue_drill', 'switch_topic', 'take_break', 'review_fundamentals'])
    .optional(),
});
export type CoachingTurn = z.infer<typeof CoachingTurnSchema>;

export const MnemonicSchema = z.object({
  mnemonic: z.string().min(3).max(400),
  expansion: z.array(z.string()).min(2).max(15),
  clinicalRelevance: z.string().max(1500),
  warnings: z.array(z.string()).default([]),
});
export type Mnemonic = z.infer<typeof MnemonicSchema>;

export const MNEMONIC_DESCRIPTION = `{
  "mnemonic": string (the mnemonic phrase),
  "expansion": string[] (each letter/word explained, in order),
  "clinicalRelevance": string,
  "warnings": string[] (any oversimplifications the student should be aware of)
}`;
