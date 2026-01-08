import { z } from 'zod';

/**
 * Zod schema for MedicalContent.content JSON structure
 */
export const MedicalContentSchema = z.object({
  condition: z.string(),
  system: z.string(),
  overview: z.string().optional(),
  diagnostics: z.string().optional(),
  treatment: z.string().optional(),
  clinical_pearls: z.array(z.string()).default([]),
  buzzwords: z.array(z.string()).default([]),
  symptoms: z.string().optional(),
  pathophysiology: z.string().optional(),
  first_line_rx: z.string().optional(),
  gold_standard_dx: z.string().optional(),
  classic_patient: z.string().optional(),
  risks: z.string().optional(),
  prognosis: z.string().optional(),
  
  // Structured fields
  age_demographic: z.object({
    typical: z.string().optional(),
    range: z.string().optional()
  }).optional(),
  
  synonyms: z.array(z.string()).optional(),
  
  // Metadata
  version: z.number().optional(),
  last_updated: z.string().optional(),
});

export type MedicalContentData = z.infer<typeof MedicalContentSchema>;

/**
 * Zod schema for Question.options JSON structure
 */
export const QuestionOptionsSchema = z.array(z.string()).min(2);

export type QuestionOptions = z.infer<typeof QuestionOptionsSchema>;

/**
 * Standardized Condition Metadata
 */
export const ConditionMetaSchema = z.object({
  id: z.string(),
  conditionId: z.string(),
  name: z.string(),
  system: z.string(),
  subcategory: z.string().nullable(),
  status: z.string(),
  hasContent: z.boolean(),
});

export type ConditionMeta = z.infer<typeof ConditionMetaSchema>;
