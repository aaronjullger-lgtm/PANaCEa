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

/**
 * Progress-linkage gate for learner-facing serving.
 *
 * submitDrillReview can only persist ReviewLog/UserProgress/FSRS state when the
 * question carries a conditionId or medicalContentId. Serving an unlinked
 * question makes every answer a silent scheduling no-op (success returned, no
 * durable review state). Production probe 2026-06-10: 70/1429 approved
 * PreGeneratedQuestion and 19/331 ACTIVE Question rows lacked linkage.
 *
 * Apply at serving sites only — NOT in the review resolver, which must still
 * resolve previously served unlinked questions.
 */
export const PROGRESS_LINKAGE_FILTER = {
  OR: [{ conditionId: { not: null } }, { medicalContentId: { not: null } }],
} as const;

export function withProgressLinkage<TWhere extends WhereInput>(
  where: TWhere = {} as TWhere
): TWhere & { AND: unknown[] } {
  const currentAnd = (where as { AND?: unknown }).AND;
  const existingAnd = Array.isArray(currentAnd) ? currentAnd : currentAnd != null ? [currentAnd] : [];
  return {
    ...where,
    AND: [...existingAnd, PROGRESS_LINKAGE_FILTER],
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
