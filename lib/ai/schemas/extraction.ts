/**
 * Extraction contracts — vision analysis, PDF/PPTX extraction, clinical
 * fact extraction, imaging interpretation.
 */

import { z } from 'zod';

export const VisionExtractionSchema = z.object({
  description: z.string().min(10).max(4000),
  structures: z.array(z.string()).default([]),
  findings: z.array(
    z.object({
      finding: z.string(),
      location: z.string().optional(),
      severity: z.enum(['normal', 'mild', 'moderate', 'severe']).optional(),
    }),
  ).default([]),
  modality: z.enum([
    'xray',
    'ct',
    'mri',
    'ultrasound',
    'ecg',
    'pathology',
    'dermatology',
    'other',
  ]).optional(),
  uncertain: z.boolean().default(false),
  uncertaintyReason: z.string().default(''),
});
export type VisionExtraction = z.infer<typeof VisionExtractionSchema>;

export const ClinicalFactExtractionSchema = z.object({
  conditions: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  labValues: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        unit: z.string().optional(),
        abnormal: z.boolean().optional(),
      }),
    )
    .default([]),
  vitals: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        abnormal: z.boolean().optional(),
      }),
    )
    .default([]),
  symptoms: z.array(z.string()).default([]),
  timeline: z.array(z.string()).default([]),
});
export type ClinicalFactExtraction = z.infer<typeof ClinicalFactExtractionSchema>;

export const DocumentExtractionSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string(),
      pageNumber: z.number().int().optional(),
    }),
  ),
  keyPoints: z.array(z.string()).default([]),
});
export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;

// ─── Real-time SOAP scribe extraction (permissive) ───────────────────────

/**
 * Smart Scribe SOAP extraction — the live dictation agent produces an
 * updated SOAP note on each refresh. The SOAPNote type is deeply nested and
 * has many conditional/dynamic inner keys (arbitrary ROS slots, physical
 * exam regions, plan entries), so a strict Zod schema would duplicate an
 * evolving frontend type.
 *
 * Instead we validate structure at one level: the result must be a JSON
 * object and any declared top-level SOAP key must itself be an object (not
 * a string, not a null). Inner content is accepted as `unknown` and merged
 * by the client `mergeNotes()` routine, which already tolerates partial
 * updates.
 *
 * This is the minimum schema that would catch a catastrophic model output
 * (prose instead of JSON, a bare array, etc.) without blocking a legitimate
 * extraction the moment the frontend schema grows a new field.
 */
const nestedRecord = z.record(z.unknown());

export const SoapScribeExtractionSchema = z.object({
  subjective: nestedRecord.optional(),
  objective: nestedRecord.optional(),
  assessment: nestedRecord.optional(),
  plan: nestedRecord.optional(),
  metadata: nestedRecord.optional(),
});
export type SoapScribeExtraction = z.infer<typeof SoapScribeExtractionSchema>;

export const SOAP_SCRIBE_EXTRACTION_DESCRIPTION = `{
  "subjective": { /* HPI, ROS, past history, etc. */ },
  "objective":  { /* vital signs, physical exam findings */ },
  "assessment": { /* primary diagnosis, differentials, clinical reasoning */ },
  "plan":       { /* treatment, follow-up, patient education */ },
  "metadata":   { /* optional completeness / confidence hints */ }
}
Any SOAP section may be omitted if no new info was heard for it. Return ONLY this JSON — no prose, no code fence. Inner shapes follow the SOAPNote contract provided with the prompt.`;

// ─── Bounding box (spatial vision grading) ────────────────────────────────

/**
 * Vision spatial grading — the model is asked to draw a single bounding box
 * around the primary pathology/finding in a medical image. Coordinates are
 * normalized to 0-1000 and ordered [ymin, xmin, ymax, xmax] (Gemini's native
 * spatial convention — documented at ai.google.dev/gemini-api/docs/vision).
 *
 * The tuple order matters: downstream overlap() uses the same [y,x,y,x]
 * convention when computing IoU against the student's drawn box.
 */
export const BoundingBoxSchema = z.object({
  bounding_box: z
    .array(z.number().min(0).max(1000))
    .length(4, 'Expected exactly 4 numbers: [ymin, xmin, ymax, xmax]'),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const BOUNDING_BOX_DESCRIPTION = `{
  "bounding_box": [ymin, xmin, ymax, xmax]
}
All four coordinates are integers 0-1000 (normalized to the image). ymin < ymax, xmin < xmax. Return ONLY this JSON — no prose, no code fence.`;

// ─── Clinical-eye vision analysis ─────────────────────────────────────────

/**
 * Used by /api/vision/analyze (clinical-eye pathology detection).
 * bounding_box is optional: some images (e.g. derm photos) may not
 * have a discrete localizable lesion.
 */
export const VisionAnalysisSchema = z.object({
  diagnosis: z.string().min(1).max(500),
  reasoning: z.string().min(1).max(2000),
  bounding_box: z
    .tuple([
      z.number().min(0).max(1000),
      z.number().min(0).max(1000),
      z.number().min(0).max(1000),
      z.number().min(0).max(1000),
    ])
    .optional(),
});
export type VisionAnalysis = z.infer<typeof VisionAnalysisSchema>;

export const VISION_ANALYSIS_DESCRIPTION = `{
  "diagnosis": string (primary pathology or finding, ≤500 chars),
  "reasoning": string (clinical reasoning, ≤2000 chars),
  "bounding_box": [ymin, xmin, ymax, xmax] normalized 0-1000 (omit if no discrete lesion)
}
Return ONLY this JSON object — no markdown, no code fence, no prose.`;
