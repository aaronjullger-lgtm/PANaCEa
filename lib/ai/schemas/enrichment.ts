/**
 * Enrichment contracts — condition/drug/guideline enrichment, clinical pearl
 * generation, summarization, semantic validation.
 */

import { z } from 'zod';

export const ConditionEnrichmentSchema = z.object({
  summary: z.string().min(20).max(4000),
  pathophysiology: z.string().max(4000).optional(),
  presentationBuzzwords: z.array(z.string()).default([]),
  differentials: z.array(z.string()).default([]),
  firstLineTreatment: z.string().max(2000).optional(),
  redFlags: z.array(z.string()).default([]),
  clinicalPearls: z.array(z.string()).default([]),
  panceRelevanceNotes: z.string().max(2000).default(''),
});
export type ConditionEnrichment = z.infer<typeof ConditionEnrichmentSchema>;

export const DrugEnrichmentSchema = z.object({
  class: z.string(),
  mechanism: z.string().max(2000),
  indications: z.array(z.string()).default([]),
  contraindications: z.array(z.string()).default([]),
  blackBoxWarnings: z.array(z.string()).default([]),
  commonAdverseEffects: z.array(z.string()).default([]),
  seriousAdverseEffects: z.array(z.string()).default([]),
  monitoring: z.array(z.string()).default([]),
  dosing: z.string().max(1500).default(''),
  pregnancyCategory: z.string().optional(),
});
export type DrugEnrichment = z.infer<typeof DrugEnrichmentSchema>;

export const GuidelineEnrichmentSchema = z.object({
  title: z.string(),
  issuingBody: z.string(),
  publicationYear: z.number().int().optional(),
  keyRecommendations: z
    .array(
      z.object({
        recommendation: z.string(),
        strengthOfEvidence: z.enum(['A', 'B', 'C', 'D', 'expert_opinion']).optional(),
        grade: z.string().optional(),
      }),
    )
    .default([]),
  panceHighYieldPoints: z.array(z.string()).default([]),
  url: z.string().url().optional(),
});
export type GuidelineEnrichment = z.infer<typeof GuidelineEnrichmentSchema>;

export const SemanticValidationSchema = z.object({
  isValid: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z
    .array(
      z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        category: z.string(),
        description: z.string(),
        suggestedFix: z.string().optional(),
      }),
    )
    .default([]),
});
export type SemanticValidation = z.infer<typeof SemanticValidationSchema>;
