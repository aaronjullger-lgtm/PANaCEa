import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

type WordleStatus = 'playing' | 'won' | 'lost';

export const WORDLE_MAX_ATTEMPTS = 6;

export class WordleServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordleServiceError';
  }
}

type NormalizedWordleDate = {
  isoDate: string;
  dateOnly: Date;
};

// Type with included Buzzword relation
type DailyWordleWithWord = {
  id: string;
  date: Date;
  wordId: string;
  createdAt: Date;
  updatedAt: Date;
  Buzzword: {
    id: string;
    buzzword: string;
    condition: string;
    explanation: string;
    system: string;
    subcategory: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

const normalizeWordleDate = (date?: string | Date): NormalizedWordleDate => {
  const base = date ? new Date(date) : new Date();
  if (isNaN(base.getTime())) {
    throw new WordleServiceError('Invalid Wordle date');
  }

  const isoDate = base.toISOString().split('T')[0];
  const dateOnly = new Date(`${isoDate}T00:00:00.000Z`);
  return { isoDate, dateOnly };
};

const getSeedFromDate = (isoDate: string): number => {
  const digits = isoDate.replace(/-/g, '');
  return Number(digits) || Date.now();
};

type UserWordleStateRecord = {
  id: string;
  userId: string;
  date: Date;
  guesses: string[];
  status: WordleStatus;
  updatedAt: Date;
};

const getOrCreateDailyWord = async (
  normalized: NormalizedWordleDate
): Promise<DailyWordleWithWord> => {
  const existing = await prisma.dailyWordle.findUnique({
    where: { date: normalized.dateOnly },
    include: { Buzzword: true },
  });

  if (existing) {
    return existing;
  }

  const totalWords = await prisma.buzzword.count();
  if (totalWords === 0) {
    throw new WordleServiceError('No buzzwords configured for Wordle');
  }

  const seed = getSeedFromDate(normalized.isoDate);
  const offset = seed % totalWords;

  const words = await prisma.buzzword.findMany({
    orderBy: { buzzword: 'asc' },
    skip: offset,
    take: 1,
  });

  const selected = words[0];
  if (!selected) {
    throw new WordleServiceError('Unable to select a word for today');
  }

  const created = await prisma.dailyWordle.create({
    data: {
      id: uuidv4(),
      date: normalized.dateOnly,
      wordId: selected.id,
      updatedAt: new Date(),
    },
    include: { Buzzword: true },
  });

  return created as DailyWordleWithWord;
};

const getOrCreateUserState = async (
  userId: string,
  normalized: NormalizedWordleDate
): Promise<UserWordleStateRecord> => {
  const existing = await prisma.userWordleState.findUnique({
    where: {
      userId_date: {
        userId,
        date: normalized.dateOnly,
      },
    },
  });

  if (existing) return existing;

  return prisma.userWordleState.create({
    data: {
      id: uuidv4(),
      userId,
      date: normalized.dateOnly,
      updatedAt: new Date(),
    },
  });
};

export interface WordleDailyPayload {
  id: string;
  date: string;
  word: {
    id: string;
    buzzword: string;
    condition: string;
    system: string;
    subcategory?: string | null;
    explanation?: string | null;
  };
  userState: {
    guesses: string[];
    status: WordleStatus;
    attemptsLeft: number;
    maxAttempts: number;
  };
}

const buildPayload = (
  daily: DailyWordleWithWord,
  state: UserWordleStateRecord
): WordleDailyPayload => {
  const normalizedDate = daily.date.toISOString().split('T')[0];
  const attemptsLeft = Math.max(0, WORDLE_MAX_ATTEMPTS - state.guesses.length);

  return {
    id: daily.id,
    date: normalizedDate,
    word: {
      id: daily.Buzzword.id,
      buzzword: daily.Buzzword.buzzword,
      condition: daily.Buzzword.condition,
      system: daily.Buzzword.system,
      subcategory: daily.Buzzword.subcategory,
      explanation: daily.Buzzword.explanation,
    },
    userState: {
      guesses: state.guesses,
      status: state.status,
      attemptsLeft,
      maxAttempts: WORDLE_MAX_ATTEMPTS,
    },
  };
};

export async function getDailyWordForUser(
  userId: string,
  date?: string | Date
): Promise<WordleDailyPayload> {
  const normalized = normalizeWordleDate(date);
  const daily = await getOrCreateDailyWord(normalized);
  const state = await getOrCreateUserState(userId, normalized);
  return buildPayload(daily, state);
}

const normalizeGuess = (guess: string, targetLength: number): string => {
  const sanitized = guess.trim().toUpperCase();
  if (!sanitized) {
    throw new WordleServiceError('Guess is required');
  }

  if (!/^[A-Z]+$/.test(sanitized)) {
    throw new WordleServiceError('Guesses must only contain alphabetic characters');
  }

  if (sanitized.length !== targetLength) {
    throw new WordleServiceError(`Guess must be ${targetLength} letters long`);
  }

  return sanitized;
};

export async function submitWordleGuess(
  userId: string,
  guess: string,
  date?: string | Date
): Promise<WordleDailyPayload> {
  const normalized = normalizeWordleDate(date);
  const daily = await getOrCreateDailyWord(normalized);
  const target = daily.Buzzword.buzzword.toUpperCase();

  const state = await getOrCreateUserState(userId, normalized);

  if (state.status !== 'playing') {
    throw new WordleServiceError("You have already completed today's Wordle");
  }

  const sanitizedGuess = normalizeGuess(guess, target.length);

  const updatedGuesses = [...state.guesses, sanitizedGuess];
  const isCorrect = sanitizedGuess === target;
  const newStatus: WordleStatus = isCorrect
    ? 'won'
    : updatedGuesses.length >= WORDLE_MAX_ATTEMPTS
      ? 'lost'
      : 'playing';

  const updatedState = await prisma.userWordleState.update({
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
