import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDailyPuzzleForUser, submitDiagnosticGuess, getUserDiagnosticStats } from './diagnosticPuzzleService';
import { prisma } from '@/lib/prisma';

// Mock the prisma module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyDiagnosticPuzzle: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    diagnosticPuzzle: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    userDiagnosticPuzzleState: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    condition: {
      findUnique: vi.fn(),
    },
  },
}));

describe('DiagnosticPuzzleService', () => {
  const mockUserId = 'user-123';
  const mockDate = '2025-01-01';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDailyPuzzleForUser', () => {
    it('should return a puzzle payload for a user', async () => {
      const mockDaily = {
        id: 'daily-id',
        date: new Date(mockDate),
        puzzleId: 'puzzle-id',
        DiagnosticPuzzle: {
          id: 'puzzle-id',
          conditionId: 'condition-1',
          clue1: 'Clue 1',
          clue2: 'Clue 2',
          clue3: null,
          clue4: null,
          clue5: null,
          clue6: null,
          title: 'Test Puzzle',
          difficulty: 3,
          system: 'Pulmonary',
          Condition: {
            id: 'condition-1',
            name: 'Pneumonia',
            system: 'Pulmonary',
            status: 'active',
            aliases: ['Pneumonia', 'PNA'],
          },
        },
      };
      const mockState = {
        id: 'state-id',
        userId: mockUserId,
        date: new Date(mockDate),
        guesses: [],
        status: 'playing' as const,
        updatedAt: new Date(),
      };

      (prisma.dailyDiagnosticPuzzle.findUnique as any).mockResolvedValue(mockDaily);
      (prisma.userDiagnosticPuzzleState.findUnique as any).mockResolvedValue(mockState);
      (prisma.diagnosticPuzzle.count as any).mockResolvedValue(10);
      (prisma.diagnosticPuzzle.findMany as any).mockResolvedValue([mockDaily.DiagnosticPuzzle]);

      const result = await getDailyPuzzleForUser(mockUserId, mockDate);

      expect(result).toEqual({
        id: 'daily-id',
        date: mockDate,
        puzzle: {
          id: 'puzzle-id',
          conditionId: 'condition-1',
          conditionName: 'Pneumonia',
          system: 'Pulmonary',
          title: 'Test Puzzle',
          difficulty: 3,
          clues: ['Clue 1'],
          totalClues: 6,
        },
        userState: {
          guesses: [],
          status: 'playing',
          cluesRevealed: 1,
          attemptsLeft: 6,
          maxAttempts: 6,
        },
      });
    });

    it('should create a new daily puzzle if none exists', async () => {
      (prisma.dailyDiagnosticPuzzle.findUnique as any).mockResolvedValue(null);
      (prisma.diagnosticPuzzle.count as any).mockResolvedValue(5);
      const mockPuzzle = {
        id: 'puzzle-id',
        conditionId: 'condition-1',
        clue1: 'Clue 1',
        clue2: 'Clue 2',
        clue3: null,
        clue4: null,
        clue5: null,
        clue6: null,
        title: 'Test',
        difficulty: 2,
        system: 'CV',
        Condition: {
          id: 'condition-1',
          name: 'Myocardial Infarction',
          system: 'CV',
          status: 'active',
          aliases: [],
        },
      };
      (prisma.diagnosticPuzzle.findMany as any).mockResolvedValue([mockPuzzle]);
      (prisma.dailyDiagnosticPuzzle.create as any).mockResolvedValue({
        id: 'daily-id',
        date: new Date(mockDate),
        puzzleId: 'puzzle-id',
        DiagnosticPuzzle: mockPuzzle,
      });
      (prisma.userDiagnosticPuzzleState.findUnique as any).mockResolvedValue(null);
      (prisma.userDiagnosticPuzzleState.create as any).mockResolvedValue({
        id: 'state-id',
        userId: mockUserId,
        date: new Date(mockDate),
        guesses: [],
        status: 'playing',
        updatedAt: new Date(),
      });

      await getDailyPuzzleForUser(mockUserId, mockDate);

      expect(prisma.dailyDiagnosticPuzzle.create).toHaveBeenCalled();
      expect(prisma.userDiagnosticPuzzleState.create).toHaveBeenCalled();
    });
  });

  describe('submitDiagnosticGuess', () => {
    it('should accept a correct guess and mark as won', async () => {
      const mockDaily = {
        id: 'daily-id',
        date: new Date(mockDate),
        puzzleId: 'puzzle-id',
        DiagnosticPuzzle: {
          id: 'puzzle-id',
          conditionId: 'condition-1',
          clue1: 'Clue 1',
          clue2: 'Clue 2',
          clue3: null,
          clue4: null,
          clue5: null,
          clue6: null,
          title: 'Test',
          difficulty: 3,
          system: 'Pulmonary',
          Condition: {
            id: 'condition-1',
            name: 'Pneumonia',
            system: 'Pulmonary',
            status: 'active',
            aliases: ['PNA'],
          },
        },
      };
      const mockState = {
        id: 'state-id',
        userId: mockUserId,
        date: new Date(mockDate),
        guesses: [],
        status: 'playing' as const,
        updatedAt: new Date(),
      };
      (prisma.dailyDiagnosticPuzzle.findUnique as any).mockResolvedValue(mockDaily);
      (prisma.userDiagnosticPuzzleState.findUnique as any).mockResolvedValue(mockState);
      (prisma.userDiagnosticPuzzleState.update as any).mockResolvedValue({
        ...mockState,
        guesses: ['pneumonia'],
        status: 'won',
      });

      const result = await submitDiagnosticGuess(mockUserId, 'Pneumonia', mockDate);
      expect(result.userState.status).toBe('won');
      expect(result.userState.guesses).toEqual(['pneumonia']);
    });

    it('should reject guess if already completed', async () => {
      const mockDaily = {
        id: 'daily-id',
        date: new Date(mockDate),
        puzzleId: 'puzzle-id',
        DiagnosticPuzzle: {
          id: 'puzzle-id',
          conditionId: 'condition-1',
          clue1: 'Clue 1',
          clue2: 'Clue 2',
          clue3: null,
          clue4: null,
          clue5: null,
          clue6: null,
          title: 'Test',
          difficulty: 3,
          system: 'Pulmonary',
          Condition: {
            id: 'condition-1',
            name: 'Pneumonia',
            system: 'Pulmonary',
            status: 'active',
            aliases: [],
          },
        },
      };
      const mockState = {
        id: 'state-id',
        userId: mockUserId,
        date: new Date(mockDate),
        guesses: ['pneumonia'],
        status: 'won' as const,
        updatedAt: new Date(),
      };
      (prisma.dailyDiagnosticPuzzle.findUnique as any).mockResolvedValue(mockDaily);
      (prisma.userDiagnosticPuzzleState.findUnique as any).mockResolvedValue(mockState);

      await expect(submitDiagnosticGuess(mockUserId, 'Pneumonia', mockDate)).rejects.toThrow(
        "You have already completed today's diagnostic puzzle"
      );
    });
  });

  describe('getUserDiagnosticStats', () => {
    it('should return stats for a user with wins and streak', async () => {
      const mockStates = [
        {
          id: '1',
          userId: mockUserId,
          date: new Date('2025-01-01'),
          guesses: ['guess1', 'guess2'],
          status: 'won' as const,
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId: mockUserId,
          date: new Date('2025-01-02'),
          guesses: ['guess1'],
          status: 'won' as const,
          updatedAt: new Date(),
        },
        {
          id: '3',
          userId: mockUserId,
          date: new Date('2025-01-03'),
          guesses: ['guess1', 'guess2', 'guess3'],
          status: 'lost' as const,
          updatedAt: new Date(),
        },
      ];
      (prisma.userDiagnosticPuzzleState.findMany as any).mockResolvedValue(mockStates);

      const result = await getUserDiagnosticStats(mockUserId);
      expect(result.total).toBe(3);
      expect(result.wins).toBe(2);
      expect(result.losses).toBe(1);
      expect(result.winRate).toBeCloseTo(66.66666666666666);
      expect(result.streak).toBe(0); // streak calculation depends on current date; mock dates are in the past
      expect(result.guessDistribution).toEqual({
        1: 1,
        2: 1,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
      });
    });

    it('should return zero stats for a user with no history', async () => {
      (prisma.userDiagnosticPuzzleState.findMany as any).mockResolvedValue([]);
      const result = await getUserDiagnosticStats(mockUserId);
      expect(result.total).toBe(0);
      expect(result.wins).toBe(0);
      expect(result.losses).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.streak).toBe(0);
      expect(result.guessDistribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
      });
    });
  });
});