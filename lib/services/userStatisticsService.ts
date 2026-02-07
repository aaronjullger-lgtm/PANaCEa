import {
  AttemptPayload,
  calculateProfile,
  computeUpdatedAverages,
  updateDiagnosisBias,
  updateSystemStats,
} from '../clinicalProfileCalculator';

export async function applyAttemptToUserStatistics(
  prisma: any,
  userId: string,
  payload: AttemptPayload
) {
  const existing = await prisma.userStatistics.findUnique({ where: { userId } });

  const totalQuestions = existing?.totalQuestions ?? 0;
  const correctAnswers = existing?.correctAnswers ?? 0;
  const isCorrect = payload.isCorrect;
  const timeSpentMs = payload.timeSpentMs ?? null;

  const updatedSystemStats = payload.system
    ? updateSystemStats(
        existing?.systemStats as Record<string, any>,
        payload.system,
        isCorrect,
        timeSpentMs
      )
    : (existing?.systemStats as Record<string, any>) || {};

  const updatedTotals = {
    totalQuestions: totalQuestions + 1,
    correctAnswers: correctAnswers + (isCorrect ? 1 : 0),
  };

  const avgTimePerQuestion = computeUpdatedAverages(
    totalQuestions,
    existing?.avgTimePerQuestion ?? null,
    timeSpentMs
  );

  const diagnosisBias = updateDiagnosisBias(
    existing?.diagnosisBias as Record<string, number> | undefined,
    payload.selectedCondition,
    payload.correctCondition,
    isCorrect
  );

  const derived = calculateProfile({
    systemStats: updatedSystemStats,
    totalQuestions: updatedTotals.totalQuestions,
    correctAnswers: updatedTotals.correctAnswers,
  });

  const record = await prisma.userStatistics.upsert({
    where: { userId },
    update: {
      ...updatedTotals,
      avgTimePerQuestion,
      systemStats: updatedSystemStats,
      diagnosisBias,
      ...derived,
    },
    create: {
      userId,
      ...updatedTotals,
      avgTimePerQuestion,
      systemStats: updatedSystemStats,
      diagnosisBias,
      ...derived,
    },
  });

  return record;
}

export async function recomputePeakStudyHours(prisma: any, userId: string) {
  const rows = await prisma.$queryRaw<{ hour: number; count: bigint }[]>`
    SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
    FROM "QuestionAttempt"
    WHERE "userId" = ${userId}
    GROUP BY hour
    ORDER BY COUNT(*) DESC
    LIMIT 3;
  `;

  return rows.map((row: { hour: unknown }) => Number(row.hour));
}

export async function recomputeAvgSessionLength(prisma: any, userId: string) {
  const sessions = await prisma.studySession.findMany({
    where: { userId, endedAt: { not: null } },
    select: { startedAt: true, endedAt: true },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  const durations = sessions
    .map((s: { startedAt: Date; endedAt: Date | null }) => {
      if (!s.endedAt) return null;
      const ms = s.endedAt.getTime() - s.startedAt.getTime();
      return ms > 0 ? ms : null;
    })
    .filter((ms: number | null): ms is number => ms !== null);

  if (!durations.length) return null;
  const avgMs = durations.reduce((sum: number, ms: number) => sum + ms, 0) / durations.length;
  return avgMs / 60000; // minutes
}

export async function updateTimingAggregates(
  prisma: any,
  userId: string,
  options: { refreshPeakHours?: boolean; refreshAvgSessionLength?: boolean } = {}
) {
  const [peakStudyHours, avgSessionLength] = await Promise.all([
    options.refreshPeakHours ? recomputePeakStudyHours(prisma, userId) : Promise.resolve(null),
    options.refreshAvgSessionLength
      ? recomputeAvgSessionLength(prisma, userId)
      : Promise.resolve(null),
  ]);

  await prisma.userStatistics.upsert({
    where: { userId },
    update: {
      ...(peakStudyHours ? { peakStudyHours } : {}),
      ...(typeof avgSessionLength === 'number' ? { avgSessionLength } : {}),
    },
    create: {
      userId,
      totalQuestions: 0,
      correctAnswers: 0,
      systemStats: {},
      peakStudyHours: peakStudyHours || [],
      avgSessionLength: typeof avgSessionLength === 'number' ? avgSessionLength : null,
    },
  });
}
