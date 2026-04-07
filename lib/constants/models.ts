/**
 * Gemini model name constants for PANaCEa.
 *
 * Centralised here so that model upgrades are a one-line change.
 * All generation code should import from this file instead of
 * hardcoding model strings inline.
 *
 * Naming convention:
 *   GEMINI_<PURPOSE>_MODEL
 *
 * When Gemini releases a new stable version:
 *  1. Update the constant here.
 *  2. Run `npm run typecheck` to surface any import changes.
 *  3. Test generation endpoints before deploying.
 */

// Primary question-generation model — high-quality output, used for single-question
// and enhanced (CoVe) generation flows.
export const GEMINI_GENERATION_MODEL = 'gemini-2.5-flash' as const;

// Fast flash model used for bulk batch generation and behaviour analysis.
// Balanced between cost, speed, and quality for high-volume tasks.
export const GEMINI_BATCH_MODEL = 'gemini-2.0-flash' as const;

// Variant generation model — structured JSON output, fast turnaround.
// Used by questionVariantGenerator.ts and batchVariantService.ts.
export const GEMINI_VARIANT_MODEL = 'gemini-2.0-flash' as const;

// Behaviour analysis model (Ghost Grader, implicit metrics validation).
export const GEMINI_BEHAVIOR_MODEL = 'gemini-2.0-flash' as const;
