/**
 * Student Intent Schema — shared between the OSCE encounter graph and the
 * intent-router agent. Lives here (not in osceEncounter.ts) to avoid a
 * circular dependency: osceEncounter ← intentRouter ← StudentIntentSchema.
 *
 * @module lib/ai/schemas/intent
 */

import { z } from 'zod';

export const STUDENT_INTENT_VALUES = [
  'history_question',
  'ros_review',
  'exam_request',
  'lab_order',
  'imaging_order',
  'assessment_present',
  'closure',
  'small_talk',
] as const;

export type StudentIntent = (typeof STUDENT_INTENT_VALUES)[number];

export const StudentIntentSchema = z.object({
  intent: z.enum(STUDENT_INTENT_VALUES),
});

export type StudentIntentResult = z.infer<typeof StudentIntentSchema>;