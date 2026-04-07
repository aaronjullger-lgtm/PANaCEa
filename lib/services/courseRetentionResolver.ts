/**
 * Course Retention Resolver — Phase 4.3
 *
 * Resolves the effective desired retention for a given course/system,
 * checking per-course overrides in UserSRSConfig.courseRetentionMap
 * before falling back to the global requestRetention (default 0.9).
 *
 * Usage in drillReviewService.ts:
 *   const retention = await resolveRetention(prisma, userId, system);
 *   // Pass to FSRS: fsrs.parameters.request_retention = retention;
 *
 * @module lib/services/courseRetentionResolver
 */

const DEFAULT_RETENTION = 0.9;
const MIN_RETENTION = 0.80;
const MAX_RETENTION = 0.95;

/**
 * Clamp retention to safe bounds.
 * Below 0.80 = too many forgotten cards, above 0.95 = diminishing returns.
 */
function clampRetention(value: number): number {
  return Math.max(MIN_RETENTION, Math.min(MAX_RETENTION, value));
}

/**
 * Resolve the effective desired retention for a user + system/course.
 *
 * Priority:
 *   1. courseRetentionMap[system] (per-course override)
 *   2. requestRetention (global user preference)
 *   3. DEFAULT_RETENTION (0.9)
 */
export async function resolveRetention(
  prisma: { userSRSConfig: { findUnique: (args: any) => Promise<any> } },
  userId: string,
  system?: string | null
): Promise<number> {
  try {
    const config = await prisma.userSRSConfig.findUnique({
      where: { userId },
      select: { requestRetention: true, courseRetentionMap: true },
    });

    if (!config) return DEFAULT_RETENTION;

    // Check per-course override
    if (system && config.courseRetentionMap) {
      const map = config.courseRetentionMap as Record<string, number>;
      const courseRetention = map[system];
      if (typeof courseRetention === 'number' && isFinite(courseRetention)) {
        return clampRetention(courseRetention);
      }
    }

    // Fall back to global
    if (typeof config.requestRetention === 'number' && isFinite(config.requestRetention)) {
      return clampRetention(config.requestRetention);
    }

    return DEFAULT_RETENTION;
  } catch {
    // Non-fatal — use default
    return DEFAULT_RETENTION;
  }
}

/**
 * Update per-course retention for a user.
 * Merges with existing map (does not replace).
 */
export async function updateCourseRetention(
  prisma: {
    userSRSConfig: {
      findUnique: (args: any) => Promise<any>;
      update: (args: any) => Promise<any>;
    };
  },
  userId: string,
  courseId: string,
  retention: number
): Promise<void> {
  const clamped = clampRetention(retention);

  const existing = await prisma.userSRSConfig.findUnique({
    where: { userId },
    select: { courseRetentionMap: true },
  });

  const currentMap = (existing?.courseRetentionMap as Record<string, number>) ?? {};
  const updatedMap = { ...currentMap, [courseId]: clamped };

  await prisma.userSRSConfig.update({
    where: { userId },
    data: { courseRetentionMap: updatedMap },
  });
}

export { DEFAULT_RETENTION, MIN_RETENTION, MAX_RETENTION };
