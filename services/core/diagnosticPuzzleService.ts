import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

type DiagnosticPuzzleStatus = 'playing' | 'won' | 'lost';

export const DIAGNOSTIC_MAX_CLUES = 6;

export class DiagnosticPuzzleServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagnosticPuzzleServiceError';
  }
}

type NormalizedPuzzleDate = {
  isoDate: string;
  dateOnly: Date;
};

// Type with included Condition relation
type DailyDiagnosticPuzzleWithPuzzle = {
  id: string;
  date: Date;
  puzzleId: string;
  createdAt: Date;
  updatedAt: Date;
  DiagnosticPuzzle: {
    id: string;
    conditionId: string;
    clue1: string;
    clue2: string | null;
    clue3: string | null;
    clue4: string | null;
    clue5: string | null;
    clue6: string | null;
    title: string | null;
    difficulty: number | null;
    system: string | null;
    createdAt: Date;
    updatedAt: Date;
    Condition: {
      id: string;
      name: string;
      system: string;
      status: string;
      aliases: string[];
    };
  };
};

const normalizePuzzleDate = (date?: string | Date): NormalizedPuzzleDate => {
  const base = date ? new Date(date) : new Date();
  if (isNaN(base.getTime())) {
    throw new DiagnosticPuzzleServiceError('Invalid puzzle date');
  }

  const isoDate = base.toISOString().split('T')[0] ?? '';
  const dateOnly = new Date(`${isoDate}T00:00:00.000Z`);
  return { isoDate, dateOnly };
};

const getSeedFromDate = (isoDate: string): number => {
  const digits = isoDate.replace(/-/g, '');
  return Number(digits) || Date.now();
};

type UserDiagnosticPuzzleStateRecord = {
  id: string;
  userId: string;
  date: Date;
  guesses: string[];
  status: DiagnosticPuzzleStatus;
  updatedAt: Date;
};

const getOrCreateDailyPuzzle = async (
  normalized: NormalizedPuzzleDate
): Promise<DailyDiagnosticPuzzleWithPuzzle> => {
  const existing = await prisma.dailyDiagnosticPuzzle.findUnique({
    where: { date: normalized.dateOnly },
    include: {
      DiagnosticPuzzle: {
        include: { Condition: true },
      },
    },
  });

  if (existing) {
    return existing as DailyDiagnosticPuzzleWithPuzzle;
  }

  const totalPuzzles = await prisma.diagnosticPuzzle.count();
  if (totalPuzzles === 0) {
    throw new DiagnosticPuzzleServiceError('No diagnostic puzzles configured');
  }

  const seed = getSeedFromDate(normalized.isoDate);
  const offset = seed % totalPuzzles;

  const puzzles = await prisma.diagnosticPuzzle.findMany({
    orderBy: { title: 'asc' },
    skip: offset,
    take: 1,
    include: { Condition: true },
  });

  const selected = puzzles[0];
  if (!selected) {
    throw new DiagnosticPuzzleServiceError('Unable to select a puzzle for today');
  }

  const created = await prisma.dailyDiagnosticPuzzle.create({
    data: {
      id: uuidv4(),
      date: normalized.dateOnly,
      puzzleId: selected.id,
      updatedAt: new Date(),
    },
    include: {
      DiagnosticPuzzle: {
        include: { Condition: true },
      },
    },
  });

  return created as DailyDiagnosticPuzzleWithPuzzle;
};

const getOrCreateUserState = async (
  userId: string,
  normalized: NormalizedPuzzleDate
): Promise<UserDiagnosticPuzzleStateRecord> => {
  const existing = await prisma.userDiagnosticPuzzleState.findUnique({
    where: {
      userId_date: {
        userId,
        date: normalized.dateOnly,
      },
    },
  });

  if (existing) return existing;

  return prisma.userDiagnosticPuzzleState.create({
    data: {
      id: uuidv4(),
      userId,
      date: normalized.dateOnly,
      guesses: [],
      status: 'playing',
      updatedAt: new Date(),
    },
  });
};

export interface DiagnosticPuzzleDailyPayload {
  id: string;
  date: string;
  puzzle: {
    id: string;
    conditionId: string;
    conditionName: string;
    system: string | null;
    title: string | null;
    difficulty: number | null;
    clues: string[]; // clues revealed up to current clue index
    totalClues: number;
  };
  userState: {
    guesses: string[];
    status: DiagnosticPuzzleStatus;
    cluesRevealed: number; // 1‑based index of the next clue to reveal (equals guesses.length)
    attemptsLeft: number;
    maxAttempts: number;
  };
}

const buildPayload = (
  daily: DailyDiagnosticPuzzleWithPuzzle,
  state: UserDiagnosticPuzzleStateRecord
): DiagnosticPuzzleDailyPayload => {
  const normalizedDate = daily.date.toISOString().split('T')[0] ?? '';
  const guesses = state.guesses ?? [];
  const cluesRevealed = Math.min(guesses.length + 1, DIAGNOSTIC_MAX_CLUES);
  const attemptsLeft = Math.max(0, DIAGNOSTIC_MAX_CLUES - guesses.length);
  const puzzle = daily.DiagnosticPuzzle;
  const condition = puzzle.Condition;

  // Build array of clues revealed (clue1 is always revealed, clue2 after first guess, etc.)
  const clues: string[] = [];
  if (cluesRevealed >= 1) clues.push(puzzle.clue1);
  if (cluesRevealed >= 2 && puzzle.clue2) clues.push(puzzle.clue2);
  if (cluesRevealed >= 3 && puzzle.clue3) clues.push(puzzle.clue3);
  if (cluesRevealed >= 4 && puzzle.clue4) clues.push(puzzle.clue4);
  if (cluesRevealed >= 5 && puzzle.clue5) clues.push(puzzle.clue5);
  if (cluesRevealed >= 6 && puzzle.clue6) clues.push(puzzle.clue6);

  return {
    id: daily.id,
    date: normalizedDate,
    puzzle: {
      id: puzzle.id,
      conditionId: puzzle.conditionId,
      conditionName: condition.name,
      system: puzzle.system,
      title: puzzle.title,
      difficulty: puzzle.difficulty,
      clues,
      totalClues: DIAGNOSTIC_MAX_CLUES,
    },
    userState: {
      guesses,
      status: state.status,
      cluesRevealed,
      attemptsLeft,
      maxAttempts: DIAGNOSTIC_MAX_CLUES,
    },
  };
};

export async function getDailyPuzzleForUser(
  userId: string,
  date?: string | Date
): Promise<DiagnosticPuzzleDailyPayload> {
  const normalized = normalizePuzzleDate(date);
  const daily = await getOrCreateDailyPuzzle(normalized);
  const state = await getOrCreateUserState(userId, normalized);
  return buildPayload(daily, state);
}

const normalizeGuess = (guess: string): string => {
  const sanitized = guess.trim().toLowerCase();
  if (!sanitized) {
    throw new DiagnosticPuzzleServiceError('Guess is required');
  }
  // Allow spaces, hyphens, parentheses? We'll just keep as is.
  return sanitized;
};

/** Simple Levenshtein distance for fuzzy matching */
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
};

const FUZZY_MATCH_THRESHOLD = 0.75; // 75% similarity required

const guessMatchesCondition = (guess: string, conditionName: string, aliases: string[]): boolean => {
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedCondition = conditionName.trim().toLowerCase();
  if (normalizedGuess === normalizedCondition) return true;
  // Check aliases
  for (const alias of aliases) {
    if (alias.trim().toLowerCase() === normalizedGuess) return true;
  }
  // Fuzzy match: accept if similarity ratio exceeds threshold
  const candidates = [normalizedCondition, ...aliases.map(a => a.trim().toLowerCase())];
  for (const candidate of candidates) {
    const maxLen = Math.max(normalizedGuess.length, candidate.length);
    if (maxLen === 0) continue;
    const distance = levenshtein(normalizedGuess, candidate);
    const similarity = 1 - distance / maxLen;
    if (similarity >= FUZZY_MATCH_THRESHOLD) return true;
  }
  return false;
};

export async function submitDiagnosticGuess(
  userId: string,
  guess: string,
  date?: string | Date
): Promise<DiagnosticPuzzleDailyPayload> {
  const normalized = normalizePuzzleDate(date);
  const daily = await getOrCreateDailyPuzzle(normalized);
  const state = await getOrCreateUserState(userId, normalized);

  if (state.status !== 'playing') {
    throw new DiagnosticPuzzleServiceError("You have already completed today's diagnostic puzzle");
  }

  const sanitizedGuess = normalizeGuess(guess);
  const condition = daily.DiagnosticPuzzle.Condition;
  const isCorrect = guessMatchesCondition(sanitizedGuess, condition.name, condition.aliases ?? []);

  const updatedGuesses = [...state.guesses, sanitizedGuess];
  const newStatus: DiagnosticPuzzleStatus = isCorrect
    ? 'won'
    : updatedGuesses.length >= DIAGNOSTIC_MAX_CLUES
      ? 'lost'
      : 'playing';

  const updatedState = await prisma.userDiagnosticPuzzleState.update({
    where: {
      userId_date: {
        userId,
        date: normalized.dateOnly,
      },
    },
    data: {
      guesses: updatedGuesses,
      status: newStatus,
    },
  });

  return buildPayload(daily, updatedState);
}

// Stats & streak functions
export async function getUserDiagnosticStats(userId: string) {
  const states = await prisma.userDiagnosticPuzzleState.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  const total = states.length;
  const wins = states.filter(s => s.status === 'won').length;
  const losses = states.filter(s => s.status === 'lost').length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  // Calculate current streak (consecutive wins up to today)
  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const state of states) {
    const stateDate = new Date(state.date);
    stateDate.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - stateDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > streak + 1) break; // gap in days, streak broken
    if (state.status === 'won') {
      streak++;
      today.setTime(stateDate.getTime()); // move back one day
    } else {
      break;
    }
  }

  // Guess distribution (how many guesses to win)
  const guessDistribution: Record<number, number> = {};
  for (let i = 1; i <= DIAGNOSTIC_MAX_CLUES; i++) guessDistribution[i] = 0;
  for (const state of states) {
    if (state.status === 'won' && state.guesses.length > 0) {
      const guessesUsed = state.guesses.length;
      guessDistribution[guessesUsed] = (guessDistribution[guessesUsed] || 0) + 1;
    }
  }

  return {
    total,
    wins,
    losses,
    winRate,
    streak,
    guessDistribution,
  };
}