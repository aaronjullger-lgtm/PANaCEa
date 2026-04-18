/**
 * Safety-critical content fields.
 *
 * If any of these fields is empty on a condition/drug page, the UI MUST render
 * a visible "Incomplete — needs clinical review" marker instead of silently
 * hiding the section. PANaCEa's mandate: "Medical safety sections must be
 * complete or visibly marked incomplete."
 *
 * The field keys match `MedicalContentDisplay` in `types/medical-content.ts`.
 * Add (don't remove) when new safety-relevant fields are introduced.
 *
 * Rationale per field:
 * - complications          : missed downstream harm / morbidity
 * - first_line_rx          : wrong-treatment risk
 * - best_initial_test      : missed-diagnosis risk
 * - gold_standard_dx       : definitive diagnosis; impacts rule-in/out
 * - rx_side_effects        : direct iatrogenic harm
 * - differentialDiagnosis  : anchoring / premature closure protection
 * - riskFactors            : screening, prevention, pretest probability
 */
export const SAFETY_CRITICAL_FIELDS = [
  'complications',
  'first_line_rx',
  'best_initial_test',
  'gold_standard_dx',
  'rx_side_effects',
  'differentialDiagnosis',
  'riskFactors',
] as const;

export type SafetyCriticalFieldKey = (typeof SAFETY_CRITICAL_FIELDS)[number];

const SAFETY_SET = new Set<string>(SAFETY_CRITICAL_FIELDS);

export function isSafetyCriticalField(key: string | number | symbol | undefined | null): boolean {
  if (typeof key !== 'string') return false;
  return SAFETY_SET.has(key);
}

/**
 * Content-level completeness check — used by benchmark + health cron to score
 * how many safety-critical fields are populated on a given condition.
 *
 * Returns a tuple: [filledCount, totalCount, missingKeys]
 */
export function scoreSafetyCompleteness(
  content: Record<string, unknown>
): { filled: number; total: number; missing: SafetyCriticalFieldKey[] } {
  const missing: SafetyCriticalFieldKey[] = [];
  for (const key of SAFETY_CRITICAL_FIELDS) {
    const value = content[key];
    const isEmpty =
      value == null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) missing.push(key);
  }
  return {
    filled: SAFETY_CRITICAL_FIELDS.length - missing.length,
    total: SAFETY_CRITICAL_FIELDS.length,
    missing,
  };
}
