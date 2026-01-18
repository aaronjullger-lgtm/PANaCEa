// Minimal Prisma-like contract (works with @prisma/client and @prisma/client/edge)
type PrismaLike = {
  questionAttempt: {
    findMany: (args: any) => Promise<unknown[]>;
  };
};

interface AccuracySummary {
  total: number;
  correct: number;
  accuracy: number;
}

/** Compute overall accuracy using ranked attempts only */
export async function calculateTotalAccuracy(
  prisma: PrismaLike,
  userId: string
): Promise<AccuracySummary> {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId, isRankedAttempt: true },
    select: { wasCorrect: true },
  });

  const total = attempts.length;
  const correct = attempts.filter((a: any) => a.wasCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

  return { total, correct, accuracy };
}

/** Derive a lightweight predicted score (currently scaled off ranked accuracy) */
export async function calculatePredictedScore(
  prisma: PrismaLike,
  userId: string
): Promise<{ predictedScore: number; accuracy: number }> {
  const { accuracy } = await calculateTotalAccuracy(prisma, userId);
  // Simple scaling: center around 500 with +/-150 swing based on accuracy percentage
  const predictedScore = Math.round(500 + (accuracy - 50) * 3);
  return { predictedScore, accuracy };
}

/** Build weakness heatmap stats, filtered to ranked attempts */
export async function getWeaknessHeatmap(
  prisma: PrismaLike,
  userId: string
): Promise<Array<{ system: string; correct: number; total: number; accuracy: number }>> {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId, isRankedAttempt: true, system: { not: null } },
    select: { system: true, wasCorrect: true },
  });

  const map = new Map<string, { correct: number; total: number }>();

  for (const attempt of attempts as Array<{ system: string | null; wasCorrect: boolean }>) {
    if (!attempt.system) continue;
    const key = attempt.system;
    const existing = map.get(key) || { correct: 0, total: 0 };
    map.set(key, {
      correct: existing.correct + (attempt.wasCorrect ? 1 : 0),
      total: existing.total + 1,
    });
  }

  return Array.from(map.entries()).map(([system, stats]) => ({
    system,
    correct: stats.correct,
    total: stats.total,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0,
  }));
}

/** Convenience wrapper used by APIs to refresh global accuracy after a ranked attempt */
export async function updateGlobalAccuracy(
  prisma: PrismaLike,
  userId: string
): Promise<AccuracySummary> {
  return calculateTotalAccuracy(prisma, userId);
}
