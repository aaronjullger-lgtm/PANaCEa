/**
 * Zod schemas for MedicalContent JSON columns
 * Use for validating/normalizing classic_triad, clinical_pearls, age_demographic, differentials, synonyms, content
 */

import { z } from 'zod';

/** classic_triad: array of strings (e.g. three classic findings) */
export const classicTriadSchema = z.array(z.string()).default([]);

/** clinical_pearls: array of strings */
export const clinicalPearlsSchema = z.array(z.string()).default([]);

/** age_demographic: typical + optional range */
export const ageDemographicSchema = z
  .object({
    typical: z.string().optional(),
    range: z.string().optional(),
  })
  .optional()
  .nullable();

/** differentials: array of strings (condition names) or objects with name/notes */
export const differentialItemSchema = z.union([
  z.string(),
  z.object({ name: z.string(), notes: z.string().optional() }),
]);
export const differentialsSchema = z.array(differentialItemSchema).default([]);

/** synonyms: array of strings */
export const synonymsSchema = z.array(z.string()).default([]);

/** content: full nested content object (matches MedicalContentSchema shape) */
export const medicalContentContentSchema = z
  .object({
    condition: z.string().optional().default(''),
    system: z.string().optional().default(''),
    overview: z.string().optional(),
    diagnostics: z.string().optional(),
    treatment: z.string().optional(),
    clinical_pearls: clinicalPearlsSchema,
    buzzwords: z.array(z.string()).default([]),
    symptoms: z.string().optional(),
    pathophysiology: z.string().optional(),
    first_line_rx: z.string().optional(),
    gold_standard_dx: z.string().optional(),
    classic_patient: z.string().optional(),
    risks: z.string().optional(),
    prognosis: z.string().optional(),
    age_demographic: ageDemographicSchema,
    synonyms: synonymsSchema.optional(),
    version: z.number().optional(),
    last_updated: z.string().optional(),
  })
  .passthrough();

export type ClassicTriad = z.infer<typeof classicTriadSchema>;
export type ClinicalPearls = z.infer<typeof clinicalPearlsSchema>;
export type AgeDemographic = z.infer<typeof ageDemographicSchema>;
export type Differentials = z.infer<typeof differentialsSchema>;
export type Synonyms = z.infer<typeof synonymsSchema>;
export type MedicalContentContent = z.infer<typeof medicalContentContentSchema>;

/**
 * Safe parse a raw JSON value with a schema; returns default on failure
 */
export function parseMedicalContentField<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  defaultValue: T
): T {
  if (raw === null || raw === undefined) return defaultValue;
  const result = schema.safeParse(raw);
  return result.success ? result.data : defaultValue;
}
