import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<Response>) | null,
}));

const _logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockPrisma: any = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  userProgress: { findMany: vi.fn() },
  userQuestionSeen: { findMany: vi.fn() },
  preGeneratedQuestion: { findMany: vi.fn(), create: vi.fn() },
  question: { findMany: vi.fn(), createMany: vi.fn() },
  questionIdentity: { upsert: vi.fn() },
  medicalContent: { findMany: vi.fn() },
  studySession: { upsert: vi.fn() },
  studySessionQuestion: { deleteMany: vi.fn(), createMany: vi.fn() },
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => _logger),
}));

vi.mock('../../../lib/services/conceptQuestionSelector', () => ({
  selectSessionQuestions: vi.fn(),
}));

vi.mock('../../../lib/services/reservoir', () => ({
  reserveFromReservoir: vi.fn().mockResolvedValue([]),
  releaseReservation: vi.fn().mockResolvedValue(0),
  failReservation: vi.fn().mockResolvedValue(0),
  requestRefill: vi.fn().mockResolvedValue(undefined),
  deriveScope: vi.fn(() => ({ kind: 'adaptive' })),
}));

vi.mock('../../../lib/nccpa-question-weighting', () => ({
  inferLearnerPhase: vi.fn(() => 'pance_prep'),
}));

import { selectSessionQuestions } from '../../../lib/services/conceptQuestionSelector';
import {
  failReservation,
  releaseReservation,
  reserveFromReservoir,
} from '../../../lib/services/reservoir';
import { safePrismaDisconnect } from '../_shared/prisma-edge';
import './session/generate';

function makeContext(body: Record<string, unknown> = {}, env: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123', ...env },
    auth: { userId: 'clerk_user_1' },
    validated: {
      body: {
        mode: 'adaptive',
        size: 2,
        blueprintWeights: { Cardiovascular: 1 },
        blueprintStage: 'pance_prep',
        gatedSystems: [],
        ...body,
      },
    },
    waitUntil: vi.fn(),
  };
}

function makePregenerated(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    system: 'Cardiovascular',
    difficulty: 'medium',
    conditionId: 'cond-1',
    medicalContentId: 'mc-1',
    questionData: {
      stem: `Question ${id}?`,
      options: ['A option', 'B option', 'C option', 'D option'],
      correctAnswer: 'B',
      explanation: 'Because B is correct.',
      ...overrides,
    },
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<any>;
}

describe('POST /api/study/session/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-db-1',
      currentRotation: null,
      eorTestDate: null,
      rotationEndDate: null,
      examDate: null,
      yearInProgram: null,
      trainingPhase: null,
    });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
    mockPrisma.userQuestionSeen.findMany.mockResolvedValue([]);
    mockPrisma.question.findMany.mockResolvedValue([]);
    mockPrisma.question.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.questionIdentity.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({ id: `qi_${create.questionSource}_${create.sourceQuestionId}` })
    );
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      makePregenerated('pg-1'),
      makePregenerated('pg-2', { correctAnswer: 'C' }),
    ]);
    mockPrisma.preGeneratedQuestion.create.mockResolvedValue({});
    mockPrisma.medicalContent.findMany.mockResolvedValue([]);
    mockPrisma.studySession.upsert.mockResolvedValue({});
    mockPrisma.studySessionQuestion.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studySessionQuestion.createMany.mockResolvedValue({ count: 2 });
    (reserveFromReservoir as Mock).mockResolvedValue([]);
    (releaseReservation as Mock).mockResolvedValue(0);
    (failReservation as Mock).mockResolvedValue(0);
    (selectSessionQuestions as Mock).mockResolvedValue({
      sessionId: 'ses_on_demand',
      questions: [],
      metadata: {
        dueReviewCount: 0,
        newCardCount: 0,
        systemDistribution: {},
        estimatedMinutes: 0,
        mode: 'adaptive',
        blueprintStage: 'pance_prep',
      },
    });
  });

  it('starts a session for a first-login user and fills from pre-generated questions', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'user-db-1',
      currentRotation: null,
      eorTestDate: null,
      rotationEndDate: null,
      examDate: null,
      yearInProgram: null,
      trainingPhase: null,
    });

    const response = await _capture.handler!(makeContext());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.sessionId).toBe('ses_on_demand');
    expect(body.data.questions).toHaveLength(2);
    expect(body.data.questions[0].correctAnswerIndex).toBe(1);
    expect(body.data.questions[0]).toEqual(
      expect.objectContaining({
        id: 'pg-1',
        questionId: 'pg-1',
        canonicalQuestionId: 'pg-1',
        sourceQuestionId: 'pg-1',
        questionSource: 'pre_generated',
        questionIdentityId: 'qi_pre_generated_pg-1',
        medicalContentId: 'mc-1',
      })
    );
    expect(body.data.questions[1]).toEqual(
      expect.objectContaining({
        questionIdentityId: 'qi_pre_generated_pg-2',
      })
    );
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_user_1',
          email: 'clerk_user_1@placeholder.panacea.app',
        }),
      })
    );
    expect(mockPrisma.studySession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-db-1',
          totalQuestions: 2,
          questionIds: ['pg-1', 'pg-2'],
        }),
      })
    );
    expect(mockPrisma.question.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: 'pg-1',
          source: 'pre_generated_approved',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
          medicalContentId: 'mc-1',
        }),
        expect.objectContaining({
          id: 'pg-2',
          source: 'pre_generated_approved',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
          medicalContentId: 'mc-1',
        }),
      ],
      skipDuplicates: true,
    });
    expect(mockPrisma.studySessionQuestion.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: 'ses_on_demand' },
    });
    expect(mockPrisma.studySessionQuestion.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sessionId: 'ses_on_demand',
          questionId: 'pg-1',
          preGeneratedQuestionId: 'pg-1',
          questionIdentityId: 'qi_pre_generated_pg-1',
          sequenceIndex: 0,
          source: 'pre_generated',
          metadata: expect.objectContaining({
            sourceQuestionId: 'pg-1',
            questionSource: 'pre_generated',
            medicalContentId: 'mc-1',
          }),
        }),
        expect.objectContaining({
          sessionId: 'ses_on_demand',
          questionId: 'pg-2',
          preGeneratedQuestionId: 'pg-2',
          questionIdentityId: 'qi_pre_generated_pg-2',
          sequenceIndex: 1,
          source: 'pre_generated',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('passes learner progress signals into on-demand question selection', async () => {
    mockPrisma.userProgress.findMany.mockResolvedValue([
      {
        conditionId: 'mc-cardiology',
        system: 'Cardiovascular',
        totalAttempts: 20,
        correctCount: 7,
        accuracy: 0.35,
        MedicalContent: {
          conditionId: 'condition-cardiology',
        },
      },
      {
        conditionId: 'mc-pulmonary',
        system: 'Pulmonary',
        totalAttempts: 10,
        correctCount: 8,
        accuracy: 0.8,
        MedicalContent: {
          conditionId: 'condition-pulmonary',
        },
      },
    ]);

    const response = await _capture.handler!(makeContext());

    expect(response.status).toBe(200);
    expect(selectSessionQuestions).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        banditState: expect.objectContaining({
          armParams: {},
          totalSelections: 0,
          cumulativeReward: 0,
        }),
        systemWeaknesses: expect.objectContaining({
          Cardiovascular: 0.65,
          Pulmonary: 0.2,
        }),
        topicMasteryMap: expect.objectContaining({
          'mc-cardiology': 0.35,
          'condition-cardiology': 0.35,
          'mc-pulmonary': 0.8,
          'condition-pulmonary': 0.8,
        }),
      })
    );
  });

  it('filters bad question data instead of serving unscorable cards', async () => {
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      makePregenerated('bad-1', { correctAnswer: 'Z' }),
      makePregenerated('good-1', { correctAnswer: 'A' }),
    ]);

    const response = await _capture.handler!(makeContext());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions.map((q: any) => q.id)).toEqual(['good-1']);
    expect(body.data.questions[0].correctAnswerIndex).toBe(0);
  });

  it('returns a safe empty session when the question pool is exhausted', async () => {
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);

    const response = await _capture.handler!(makeContext());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions).toEqual([]);
    expect(body.data.metadata.newCardCount).toBe(0);
    expect(mockPrisma.question.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.studySession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalQuestions: 0,
          questionIds: [],
        }),
      })
    );
    expect(mockPrisma.studySessionQuestion.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: 'ses_on_demand' },
    });
    expect(mockPrisma.studySessionQuestion.createMany).not.toHaveBeenCalled();
  });

  it('does not generate or serve dynamic questions when approved pools are thin', async () => {
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.medicalContent.findMany.mockResolvedValue([
      {
        id: 'mc-1',
        conditionId: 'cond-1',
        condition: 'Pulmonary embolism',
        system: 'Pulmonary',
        subcategory: 'Vascular',
        overview: 'Venous thromboembolism.',
        etiology: 'Clot migration.',
        pathophysiology: 'Pulmonary arterial obstruction.',
        symptoms: 'Pleuritic chest pain and tachycardia.',
        physicalExam: 'Hypoxemia.',
        diagnostics: 'CT pulmonary angiography.',
        treatment: 'Anticoagulation.',
        classic_patient: 'Postoperative patient with dyspnea.',
        classic_triad: ['dyspnea', 'pleuritic pain', 'tachycardia'],
        first_line_rx: 'Anticoagulation',
        gold_standard_dx: 'CT pulmonary angiography',
        best_initial_test: 'D-dimer when low risk',
        pance_yield: 5,
      },
    ]);

    const response = await _capture.handler!(
      makeContext(
        {
          mode: 'system',
          system: 'Pulmonary',
          size: 1,
          blueprintWeights: { Pulmonary: 1 },
        },
        { GEMINI_API_KEY: 'test-gemini-key' }
      )
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions).toEqual([]);
    expect(mockPrisma.preGeneratedQuestion.create).not.toHaveBeenCalled();
    expect(mockPrisma.medicalContent.findMany).not.toHaveBeenCalled();
    expect(_logger.warn).toHaveBeenCalledWith(
      'Study session question pool shortage; refusing learner-facing dynamic generation',
      expect.objectContaining({
        requestedSize: 1,
        availableSafeQuestions: 0,
        mode: 'system',
        system: 'Pulmonary',
      })
    );
  });

  it('respects system filters when using the pre-generated fallback', async () => {
    await _capture.handler!(makeContext({ mode: 'system', system: 'Pulmonary' }));

    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          system: 'Pulmonary',
          validationStatus: 'approved',
        }),
      })
    );
  });

  it('matches condition-targeted fallback questions across Condition and MedicalContent identity domains', async () => {
    await _capture.handler!(
      makeContext({
        mode: 'condition',
        conditionId: 'mc-1',
        size: 1,
      })
    );

    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ conditionId: 'mc-1' }, { medicalContentId: 'mc-1' }],
          validationStatus: 'approved',
        }),
      })
    );
  });

  it('preserves MedicalContent identity when condition fallback matches only medicalContentId', async () => {
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        ...makePregenerated('pg-medical-only'),
        conditionId: null,
        medicalContentId: 'mc-1',
        questionData: {
          stem: 'Medical-content-only condition question?',
          options: ['A option', 'B option'],
          correctAnswer: 'A option',
          explanation: 'Because A is correct.',
          medicalContentId: 'mc-1',
          conditionName: 'Asthma',
        },
      },
    ]);

    const response = await _capture.handler!(
      makeContext({
        mode: 'condition',
        conditionId: 'mc-1',
        size: 1,
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions[0]).toEqual(
      expect.objectContaining({
        id: 'pg-medical-only',
        conditionId: 'mc-1',
        medicalContentId: 'mc-1',
        questionId: 'pg-medical-only',
        canonicalQuestionId: 'pg-medical-only',
        sourceQuestionId: 'pg-medical-only',
        questionSource: 'pre_generated',
      })
    );
  });

  it('fails reservoir reservations that do not hydrate into enough production-safe questions', async () => {
    (reserveFromReservoir as Mock).mockResolvedValue([
      { id: 'res-1', questionId: 'draft-question', isReview: false },
      { id: 'res-2', questionId: 'pending-pregenerated', isReview: false },
    ]);
    mockPrisma.preGeneratedQuestion.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePregenerated('pg-1'), makePregenerated('pg-2')]);
    mockPrisma.question.findMany.mockResolvedValue([]);

    const response = await _capture.handler!(makeContext());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions.map((q: any) => q.id)).toEqual(['pg-1', 'pg-2']);
    expect(failReservation).toHaveBeenCalledWith(mockPrisma, expect.any(String), [
      'draft-question',
      'pending-pregenerated',
    ]);
    expect(releaseReservation).not.toHaveBeenCalled();
    expect(selectSessionQuestions).toHaveBeenCalled();
  });

  it('classifies partial reservoir reservations before releasing fallback rows', async () => {
    (reserveFromReservoir as Mock).mockResolvedValue([
      { id: 'res-1', questionId: 'good-reserved', isReview: false },
      { id: 'res-2', questionId: 'unsafe-reserved', isReview: false },
    ]);
    mockPrisma.preGeneratedQuestion.findMany
      .mockResolvedValueOnce([makePregenerated('good-reserved')])
      .mockResolvedValueOnce([
        makePregenerated('pg-1'),
        makePregenerated('pg-2'),
        makePregenerated('pg-3'),
      ]);
    mockPrisma.question.findMany.mockResolvedValue([]);

    const response = await _capture.handler!(makeContext({ size: 3 }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions.map((q: any) => q.id)).toEqual(['pg-1', 'pg-2', 'pg-3']);
    expect(failReservation).toHaveBeenCalledWith(mockPrisma, expect.any(String), [
      'unsafe-reserved',
    ]);
    expect(releaseReservation).toHaveBeenCalledWith(mockPrisma, expect.any(String), [
      'good-reserved',
    ]);
    expect(selectSessionQuestions).toHaveBeenCalled();
  });

  it('disconnects prisma after generation', async () => {
    await _capture.handler!(makeContext());

    expect(safePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });
});
