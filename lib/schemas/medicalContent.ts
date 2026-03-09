/**
 * Zod schemas for MedicalContent API responses.
 * Used by library, condition summary, and condition details endpoints to validate or shape responses.
 */

import { z } from 'zod';

/** One item in the library list response (GET /api/content/library) */
export const LibraryListItemSchema = z.object({
  id: z.string(),
  condition: z.string(),
  conditionId: z.string(),
  system: z.string(),
  subcategory: z.string().nullable().optional(),
  pance_yield: z.number().nullable().optional(),
  classic_patient: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  buzzwords: z.union([z.array(z.string()), z.string()]).optional(),
  gold_standard_dx: z.string().nullable().optional(),
  first_line_rx: z.string().nullable().optional(),
  epidemiology: z.string().nullable().optional(),
  etiology: z.string().nullable().optional(),
  riskFactors: z.string().nullable().optional(),
  pathophysiology: z.string().nullable().optional(),
  symptoms: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  physicalExam: z.string().nullable().optional(),
  classic_triad: z.union([z.array(z.string()), z.record(z.unknown())]).nullable().optional(),
  clinical_pearls: z.union([z.array(z.string()), z.record(z.unknown())]).nullable().optional(),
  best_initial_test: z.string().nullable().optional(),
  diagnostics: z.string().nullable().optional(),
  treatment: z.string().nullable().optional(),
  complications: z.string().nullable().optional(),
  prognosis: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
}).passthrough();

/** Response shape for GET /api/content/library */
export const LibraryResponseSchema = z.object({
  content: z.array(LibraryListItemSchema),
  count: z.number(),
}).passthrough();

/** Confused-with item in condition summary */
export const ConfusedWithItemSchema = z.object({
  id: z.string(),
  conditionId: z.string(),
  condition: z.string(),
});

/** Response shape for GET /api/content/condition/:conditionId/summary */
export const ConditionSummarySchema = z.object({
  id: z.string(),
  condition: z.string(),
  conditionId: z.string(),
  system: z.string(),
  pance_yield: z.number().nullable().optional(),
  buzzwords: z.array(z.string()).optional(),
  synonyms: z.unknown().optional(),
  classic_triad: z.unknown().optional(),
  clinical_pearls: z.unknown().optional(),
  mnemonic: z.string().nullable().optional(),
  confusedWith: z.array(ConfusedWithItemSchema).optional(),
}).passthrough();

/** Nested link shapes for condition details (minimal for validation) */
const LabLinkSchema = z.object({
  id: z.string(),
  relationshipType: z.string().optional(),
  expectedResult: z.string().nullable().optional(),
  significance: z.string().nullable().optional(),
  LabTest: z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string().nullable().optional(),
    category: z.string(),
  }).optional(),
}).passthrough();

const ImagingLinkSchema = z.object({
  id: z.string(),
  relationshipType: z.string().optional(),
  classicFindings: z.string().nullable().optional(),
  ImagingStudy: z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string().nullable().optional(),
    modality: z.string(),
    bodyRegion: z.string().nullable().optional(),
  }).optional(),
}).passthrough();

const DrugLinkSchema = z.object({
  id: z.string(),
  relationshipType: z.string().optional(),
  isFirstLine: z.boolean().optional(),
  Drug: z.object({
    id: z.string(),
    genericName: z.string(),
    brandName: z.string().nullable().optional(),
    drugClass: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();

/** Response shape for GET /api/content/condition/:conditionId/details */
export const ConditionDetailsSchema = z.object({
  id: z.string(),
  conditionId: z.string(),
  condition: z.string(),
  system: z.string(),
  subcategory: z.string().nullable().optional(),
  parent_category: z.string().nullable().optional(),
  symptoms: z.string().nullable().optional(),
  physicalExam: z.string().nullable().optional(),
  treatment: z.string().nullable().optional(),
  diagnostics: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  pathophysiology: z.string().nullable().optional(),
  etiology: z.string().nullable().optional(),
  epidemiology: z.string().nullable().optional(),
  prognosis: z.string().nullable().optional(),
  differentialDiagnosis: z.string().nullable().optional(),
  riskFactors: z.string().nullable().optional(),
  complications: z.string().nullable().optional(),
  best_initial_test: z.string().nullable().optional(),
  gold_standard_dx: z.string().nullable().optional(),
  first_line_rx: z.string().nullable().optional(),
  disposition: z.string().nullable().optional(),
  patient_education: z.string().nullable().optional(),
  prevention: z.string().nullable().optional(),
  age_demographic: z.unknown().optional(),
  gender_bias: z.string().nullable().optional(),
  classic_patient: z.string().nullable().optional(),
  differentials: z.unknown().optional(),
  LabConditionLink: z.array(LabLinkSchema).optional(),
  ImagingConditionLink: z.array(ImagingLinkSchema).optional(),
  DrugConditionLink: z.array(DrugLinkSchema).optional(),
  FindingConditionLink: z.array(z.record(z.unknown())).optional(),
  ECGConditionLink: z.array(z.record(z.unknown())).optional(),
  TreatmentConditionLink: z.array(z.record(z.unknown())).optional(),
  other_MedicalContent: z.array(z.object({
    id: z.string(),
    conditionId: z.string(),
    condition: z.string(),
    system: z.string(),
  })).optional(),
}).passthrough();

export type LibraryListItem = z.infer<typeof LibraryListItemSchema>;
export type LibraryResponse = z.infer<typeof LibraryResponseSchema>;
export type ConditionSummary = z.infer<typeof ConditionSummarySchema>;
export type ConditionDetails = z.infer<typeof ConditionDetailsSchema>;
