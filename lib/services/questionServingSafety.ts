/**
 * Production serving gates for learner-facing question delivery.
 *
 * These filters are intentionally stricter than authoring/admin queries. Study
 * modes should fail closed to empty/fallback sessions instead of serving draft,
 * unreviewed, rejected, or deprecated clinical content.
 */

export const PRODUCTION_QUESTION_SAFETY_FILTER = {
  lifecycleStatus: 'ACTIVE',
  qaStatus: 'APPROVED',
} as const;

export const PRODUCTION_PREGENERATED_SAFETY_FILTER = {
  validationStatus: 'approved',
} as const;

type WhereInput = Record<string, unknown>;

export function withProductionQuestionSafety<TWhere extends WhereInput>(
  where: TWhere = {} as TWhere
): TWhere & typeof PRODUCTION_QUESTION_SAFETY_FILTER {
  return {
    ...where,
    ...PRODUCTION_QUESTION_SAFETY_FILTER,
  };
}

export function withProductionPregeneratedSafety<TWhere extends WhereInput>(
  where: TWhere = {} as TWhere
): TWhere & typeof PRODUCTION_PREGENERATED_SAFETY_FILTER {
  return {
    ...where,
    ...PRODUCTION_PREGENERATED_SAFETY_FILTER,
  };
}

export function buildLegacyStudyModeEndpointMetadata(options: {
  replacement: string;
  canonicalRequest?: Record<string, unknown>;
  note?: string;
}) {
  return {
    deprecated: true,
    replacement: options.replacement,
    canonicalRequest: options.canonicalRequest ?? null,
    note:
      options.note ??
      'Compatibility endpoint retained for older clients; new study modes should launch canonical sessions.',
  };
}
