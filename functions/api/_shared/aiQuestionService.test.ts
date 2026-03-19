/**
 * Unit tests for AI Question Service
 *
 * Tests cover:
 * - Duplicate detection accuracy
 * - Blueprint gap analysis correctness
 * - Difficulty estimation heuristics
 * - Health score calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateNewQuestion,
  generateQuestionFromGuideline,
} from './aiQuestionService';
import * as prismaModule from './prisma-edge';

vi.mock('./prisma-edge', () => ({
  prisma: {
    question: { findMany: vi.fn(), count: vi.fn() },
    medicalContent: { findMany: vi.fn(), findUnique: vi.fn() },
    systemMapping: { findMany: vi.fn() },
    reviewLog: { groupBy: vi.fn(), count: vi.fn() },
    examBlueprint: { findMany: vi.fn() },
    examBlueprintSystem: { findUnique: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));

describe('AI Question Service', () => {
  const mockConditionId = 'cond_cardio_001';
  const mockSystemName = 'Cardiovascular';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: no existing questions (prevents "existingQuestions is undefined" errors)
    vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValue([]);
    vi.mocked(prismaModule.prisma.question.count).mockResolvedValue(0);
  });

  describe('validateNewQuestion - Duplicate Detection', () => {
    it('should detect high-similarity questions as duplicates', async () => {
      const submission = {
        question:
          'What is the gold standard diagnostic test for acute myocardial infarction?',
        options: ['ECG only', 'Troponin', 'ECG and troponin', 'Angiography'],
        correctAnswer: 'ECG and troponin',
        explanation: 'Serial troponin with ECG changes confirms AMI.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      // Mock existing question that is nearly identical (must exceed 0.85 similarity threshold)
      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([
        {
          id: 'q_existing_001',
          question:
            'What is the gold standard diagnostic test for acute myocardial infarction?',
          conditionId: mockConditionId,
        },
      ]);

      const result = await validateNewQuestion(submission);

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOf).toBeDefined();
    });

    it('should not flag low-similarity questions as duplicates', async () => {
      const submission = {
        question: 'What are the complications of acute myocardial infarction?',
        options: [
          'Arrhythmias',
          'Heart failure',
          'Cardiogenic shock',
          'All of the above',
        ],
        correctAnswer: 'All of the above',
        explanation: 'AMI can lead to multiple serious complications.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([
        {
          id: 'q_existing_001',
          question: 'What is the epidemiology of coronary artery disease?',
          conditionId: mockConditionId,
        },
      ]);

      const result = await validateNewQuestion(submission);

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateOf).toBeUndefined();
    });

    it('should return empty duplicateOf for single non-matching question', async () => {
      const submission = {
        question: 'How is troponin used in MI diagnosis?',
        options: ['Immediate marker', 'Delayed marker', 'Chronic indicator', 'Prognostic'],
        correctAnswer: 'Delayed marker',
        explanation: 'Troponin rises 3-4 hours post-MI.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);

      const result = await validateNewQuestion(submission);

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateOf).toBeUndefined();
    });
  });

  describe('validateNewQuestion - Blueprint Gap Analysis', () => {
    it('should identify when question covers a blueprint gap', async () => {
      const submission = {
        question: 'What is the pathophysiology of myocardial infarction?',
        options: ['Thrombus formation', 'Plaque rupture', 'Vasospasm', 'All of above'],
        correctAnswer: 'All of above',
        explanation: 'Multiple pathophysiologic mechanisms can cause MI.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      // Mock blueprint target: 15% coverage but only 5% currently covered
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce({
        examType: 'PANCE',
        system: mockSystemName,
        targetPercentage: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Current coverage: 5 questions out of 100 total (5%)
      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(5) // count where system='Cardiovascular'
        .mockResolvedValueOnce(100); // total count

      const result = await validateNewQuestion(submission);

      expect(result.coversGap).toBe(true);
    });

    it('should not mark as gap-covering when blueprint already exceeded', async () => {
      const submission = {
        question: 'What is another cardiovascular concept?',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        explanation: 'Explanation here.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      // Blueprint target: 15% but 25% currently covered
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce({
        examType: 'PANCE',
        system: mockSystemName,
        targetPercentage: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Current coverage: 25 questions out of 100 total (25%)
      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(100);

      const result = await validateNewQuestion(submission);

      expect(result.coversGap).toBe(false);
    });

    it('should mark as gap-covering when no blueprint target exists', async () => {
      const submission = {
        question: 'What is a rare cardiovascular condition?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Rare condition explanation.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      // No blueprint target defined
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(100);

      const result = await validateNewQuestion(submission);

      expect(result.coversGap).toBe(true);
    });
  });

  describe('validateNewQuestion - Difficulty Estimation', () => {
    it('should estimate moderate difficulty for medium-length explanations', async () => {
      const submission = {
        question: 'What is the pathophysiology of heart failure?',
        options: ['Systolic dysfunction', 'Diastolic dysfunction', 'Both', 'Neither'],
        correctAnswer: 'Both',
        explanation:
          'Heart failure results from systolic or diastolic dysfunction. In systolic dysfunction, the ventricle cannot contract effectively. In diastolic dysfunction, the ventricle cannot relax properly. Both can lead to clinical heart failure.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce({
        examType: 'PANCE',
        system: mockSystemName,
        targetPercentage: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(100);

      const result = await validateNewQuestion(submission);

      expect(result.estimatedDifficulty).toBeGreaterThanOrEqual(0.5);
      expect(result.estimatedDifficulty).toBeLessThanOrEqual(1);
    });

    it('should estimate higher difficulty for complex explanations', async () => {
      const submission = {
        question: 'What is the pathophysiology of acute MI?',
        options: ['Thrombus', 'Plaque rupture', 'Vasospasm', 'All of above'],
        correctAnswer: 'All of above',
        explanation: `Acute myocardial infarction occurs through multiple pathophysiologic mechanisms. The classic mechanism involves rupture of a vulnerable atherosclerotic plaque, exposing tissue factor and other thrombogenic substances to flowing blood. This triggers the extrinsic coagulation cascade, leading to thrombus formation that occludes the coronary artery. Additionally, coronary vasospasm can occur in response to plaque rupture and can independently cause ischemia. Finally, demand ischemia from increased metabolic needs in the context of fixed stenosis can precipitate infarction. These mechanisms may occur in combination, with some patients experiencing multiple concurrent pathophysiologic processes that together result in myocardial necrosis.`,
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce({
        examType: 'PANCE',
        system: mockSystemName,
        targetPercentage: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(100);

      const result = await validateNewQuestion(submission);

      expect(result.estimatedDifficulty).toBeGreaterThan(0.65);
    });
  });

  describe('validateNewQuestion - Health Score Calculation', () => {
    it('should calculate higher health score for gap-covering questions', async () => {
      const submission = {
        question: 'Rare cardiovascular question for gap coverage?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Covers a blueprint gap.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce({
        examType: 'PANCE',
        system: mockSystemName,
        targetPercentage: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(5) // 5% coverage < 15% target
        .mockResolvedValueOnce(100);

      const result = await validateNewQuestion(submission);

      // Health score should be higher when coversGap is true
      expect(result.estimatedHealthScore).toBeGreaterThan(0.75);
    });

    it('should calculate moderate health score for standard submissions', async () => {
      const submission = {
        question: 'Standard question without gap?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Standard explanation.',
        system: mockSystemName,
        conditionId: mockConditionId,
      };

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce({
        examType: 'PANCE',
        system: mockSystemName,
        targetPercentage: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(20) // 20% coverage >= 15% target
        .mockResolvedValueOnce(100);

      const result = await validateNewQuestion(submission);

      // Non-gap-covering: healthScore = 0.65 + (0.3 * 0.5) = 0.80
      expect(result.estimatedHealthScore).toBeLessThan(0.85);
      expect(result.estimatedHealthScore).toBeGreaterThanOrEqual(0.75);
    });

    it('should use sensible defaults when data is incomplete', async () => {
      const submission = {
        question: 'Question with missing blueprint?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Explanation.',
        system: 'UnknownSystem',
        conditionId: mockConditionId,
      };

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prismaModule.prisma.question.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await validateNewQuestion(submission);

      expect(result.estimatedDifficulty).toBeGreaterThan(0);
      expect(result.estimatedDifficulty).toBeLessThanOrEqual(1);
      expect(result.estimatedHealthScore).toBeGreaterThan(0);
      expect(result.estimatedHealthScore).toBeLessThanOrEqual(1);
    });
  });

  describe('generateQuestionFromGuideline', () => {
    it('should estimate difficulty based on guideline length', async () => {
      const guideline =
        'This is a comprehensive clinical guideline covering multiple aspects of a complex medical condition.';

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findMany).mockResolvedValueOnce([
        {
          examType: 'PANCE',
          system: mockSystemName,
          targetPercentage: 15,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await generateQuestionFromGuideline(
        guideline,
        mockSystemName,
        mockConditionId
      );

      expect(result.draftQuestion).toBeDefined();
      expect(result.draftQuestion.estimatedDifficulty).toBeGreaterThan(0);
      expect(result.draftQuestion.system).toBe(mockSystemName);
      expect(result.draftQuestion.conditionId).toBe(mockConditionId);
    });

    it('should include duplicate candidates in response', async () => {
      const guideline = 'Clinical guideline text here.';

      const mockCandidates = [
        { id: 'q1', question: 'Similar question 1', conditionId: mockConditionId },
        { id: 'q2', question: 'Similar question 2', conditionId: mockConditionId },
      ];

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce(mockCandidates);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findMany).mockResolvedValueOnce([
        {
          examType: 'PANCE',
          system: mockSystemName,
          targetPercentage: 15,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await generateQuestionFromGuideline(
        guideline,
        mockSystemName,
        mockConditionId
      );

      expect(result.duplicateCandidates).toHaveLength(2);
      expect(result.duplicateCandidates[0].id).toBe('q1');
    });

    it('should analyze blueprint coverage', async () => {
      const guideline = 'Guideline for rare disease.';

      vi.mocked(prismaModule.prisma.question.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaModule.prisma.examBlueprintSystem.findMany).mockResolvedValueOnce([
        {
          examType: 'PANCE',
          system: mockSystemName,
          targetPercentage: 15,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await generateQuestionFromGuideline(
        guideline,
        mockSystemName,
        mockConditionId
      );

      expect(result.blueprintAnalysis).toBeDefined();
      expect(result.blueprintAnalysis.coveredSystem).toBe(mockSystemName);
      expect(typeof result.blueprintAnalysis.helpsGap).toBe('boolean');
    });
  });
});
