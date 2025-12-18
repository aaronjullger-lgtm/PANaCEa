import { prisma } from '../prisma';

/**
 * Get the start of the current day (UTC) for daily uniqueness.
 */
function getTodayDate(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

async function pickRandomQuestionIds(count: number): Promise<string[]> {
  const total = await prisma.question.count();
  if (total === 0) return [];

  const target = Math.min(count, total);
  const ids = new Set<string>();

  // Random sampling with skip; avoids ORDER BY RANDOM() overhead.
  while (ids.size < target) {
    const skip = Math.max(0, Math.floor(Math.random() * total));
    const record = await prisma.question.findFirst({
      skip,
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (record?.id) {
      ids.add(record.id);
    }
  }

  return Array.from(ids);
}

export async function getOrCreateDailyChallenge() {
  const today = getTodayDate();

  // 1) Return existing challenge if present
  const existing = await prisma.grandRoundsChallenge.findUnique({
    where: { date: today },
  });
  if (existing) {
    return existing;
  }

  // 2) Create new challenge with 5 random high-quality questions
  const questionIds = await pickRandomQuestionIds(5);

  if (questionIds.length === 0) {
    throw new Error('No questions available to create Grand Rounds challenge');
  }

  const challenge = await prisma.grandRoundsChallenge.create({
    data: {
      date: today,
      questionIds,
    },
  });

  return challenge;
}

export async function getUserAttemptForChallenge(userId: string, challengeId: string) {
  return await prisma.grandRoundsAttempt.findUnique({
    where: {
      userId_challengeId: {
        userId,
        challengeId,
      },
    },
  });
}

export async function calculatePercentile(challengeId: string, userScore: number): Promise<number> {
  const allAttempts = await prisma.grandRoundsAttempt.findMany({
    where: { challengeId },
    select: { score: true },
  });

  if (allAttempts.length === 0) return 100;

  const worseCount = allAttempts.filter(a => a.score < userScore).length;
  return Math.round((worseCount / allAttempts.length) * 100);
}

export async function getRankingForChallenge(challengeId: string, userScore: number, userTimeMs: number): Promise<number> {
  const allAttempts = await prisma.grandRoundsAttempt.findMany({
    where: { challengeId },
    select: { score: true, timeSpentMs: true },
    orderBy: [
      { score: 'desc' },
      { timeSpentMs: 'asc' },
    ],
  });

  let rank = 1;
  for (const attempt of allAttempts) {
    if (attempt.score > userScore) {
      rank++;
    } else if (attempt.score === userScore && attempt.timeSpentMs < userTimeMs) {
      rank++;
    } else {
      break;
    }
  }

  return rank;
}

