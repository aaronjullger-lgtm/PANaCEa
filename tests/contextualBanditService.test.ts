/**
 * Tests for Contextual Bandit Service (LinUCB)
 *
 * Validates linear algebra helpers, context vector construction,
 * UCB scoring, parameter updates, cold start behavior, and diagnostics.
 */
import { describe, it, expect } from 'vitest';
import {
  CONTEXT_DIM,
  identityMatrix,
  zeroVector,
  matVecMul,
  dotProduct,
  addOuterProduct,
  addScaledVector,
  solveLinearSystem,
  quadraticForm,
  contextToVector,
  initArmParams,
  initBanditState,
  scoreArm,
  rankCandidates,
  selectQuestions,
  updateBanditState,
  batchUpdateBanditState,
  buildBanditArm,
  getBanditDiagnostics,
  DEFAULT_BANDIT_CONFIG,
  type BanditContext,
  type BanditArm,
  type BanditReward,
  type BanditState,
  type BanditConfig,
} from '@/lib/services/contextualBanditService';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const BASE_CONTEXT: BanditContext = {
  topicMastery: 0.6,
  overdueRatio: 0.3,
  difficulty: 0.5,
  systemWeakness: 0.4,
  blueprintWeight: 0.10,
  timeSinceLastReview: 0.5,
  sessionPosition: 0.2,
};

function makeArm(id: string, system: string, ctx?: Partial<BanditContext>): BanditArm {
  return {
    questionId: id,
    system,
    context: { ...BASE_CONTEXT, ...ctx },
  };
}

// ─── Linear Algebra Helpers ─────────────────────────────────────────────────

describe('Linear Algebra Helpers', () => {
  it('identityMatrix creates correct d×d identity', () => {
    const I = identityMatrix(3);
    expect(I).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('zeroVector creates correct length', () => {
    const z = zeroVector(CONTEXT_DIM);
    expect(z).toHaveLength(CONTEXT_DIM);
    expect(z.every((v) => v === 0)).toBe(true);
  });

  it('matVecMul multiplies correctly', () => {
    const A = [
      [2, 0],
      [0, 3],
    ];
    const x = [4, 5];
    expect(matVecMul(A, x)).toEqual([8, 15]);
  });

  it('dotProduct computes correctly', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('addOuterProduct updates matrix in-place', () => {
    const A = [
      [1, 0],
      [0, 1],
    ];
    addOuterProduct(A, [1, 2]);
    expect(A).toEqual([
      [2, 2],
      [2, 5],
    ]);
  });

  it('addScaledVector updates vector in-place', () => {
    const b = [1, 2, 3];
    addScaledVector(b, [10, 20, 30], 0.5);
    expect(b).toEqual([6, 12, 18]);
  });

  it('solveLinearSystem solves A·x = b', () => {
    // Simple 2×2: [[2,0],[0,3]] · x = [4, 9] → x = [2, 3]
    const A = [
      [2, 0],
      [0, 3],
    ];
    const b = [4, 9];
    const x = solveLinearSystem(A, b);
    expect(x[0]).toBeCloseTo(2, 3);
    expect(x[1]).toBeCloseTo(3, 3);
  });

  it('solveLinearSystem handles identity matrix', () => {
    const I = identityMatrix(CONTEXT_DIM);
    const b = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    const x = solveLinearSystem(I, b);
    for (let i = 0; i < CONTEXT_DIM; i++) {
      expect(x[i]).toBeCloseTo(b[i]!, 5);
    }
  });

  it('quadraticForm computes xᵀA⁻¹x', () => {
    // For identity A, xᵀIx = ||x||²
    const I = identityMatrix(3);
    const x = [1, 2, 3];
    expect(quadraticForm(I, x)).toBeCloseTo(14, 3); // 1+4+9
  });
});

// ─── Context Vector Construction ────────────────────────────────────────────

describe('contextToVector', () => {
  it('produces vector of correct dimensionality', () => {
    const v = contextToVector(BASE_CONTEXT);
    expect(v).toHaveLength(CONTEXT_DIM);
  });

  it('clamps values to [0,1]', () => {
    const extreme: BanditContext = {
      topicMastery: -0.5,
      overdueRatio: 10.0, // will be capped at 3.0 then /3
      difficulty: 1.5,
      systemWeakness: -1,
      blueprintWeight: 5.0, // will be scaled and capped
      timeSinceLastReview: 2.0,
      sessionPosition: -0.3,
    };
    const v = contextToVector(extreme);
    for (const val of v) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('maps blueprintWeight with 5× scaling', () => {
    const ctx: BanditContext = { ...BASE_CONTEXT, blueprintWeight: 0.10 };
    const v = contextToVector(ctx);
    // 0.10 * 5 = 0.50
    expect(v[4]).toBeCloseTo(0.5, 5);
  });

  it('maps overdueRatio with cap at 3.0', () => {
    const ctx: BanditContext = { ...BASE_CONTEXT, overdueRatio: 1.5 };
    const v = contextToVector(ctx);
    // 1.5 / 3.0 = 0.5
    expect(v[1]).toBeCloseTo(0.5, 5);
  });
});

// ─── Arm Initialization ─────────────────────────────────────────────────────

describe('initArmParams', () => {
  it('creates identity A matrix of correct dimension', () => {
    const params = initArmParams();
    expect(params.A).toHaveLength(CONTEXT_DIM);
    expect(params.A[0]).toHaveLength(CONTEXT_DIM);
    // Diagonal is 1
    for (let i = 0; i < CONTEXT_DIM; i++) {
      expect(params.A[i]![i]).toBe(1);
    }
  });

  it('creates zero b vector', () => {
    const params = initArmParams();
    expect(params.b).toHaveLength(CONTEXT_DIM);
    expect(params.b.every((v) => v === 0)).toBe(true);
  });

  it('starts with zero pulls', () => {
    expect(initArmParams().pullCount).toBe(0);
  });
});

describe('initBanditState', () => {
  it('creates empty state', () => {
    const state = initBanditState();
    expect(state.totalSelections).toBe(0);
    expect(state.cumulativeReward).toBe(0);
    expect(Object.keys(state.armParams)).toHaveLength(0);
  });
});

// ─── Scoring ────────────────────────────────────────────────────────────────

describe('scoreArm', () => {
  it('returns positive exploration bonus for fresh params', () => {
    const arm = makeArm('q1', 'Cardiovascular');
    const params = initArmParams();
    const scored = scoreArm(arm, params, 0.5);

    expect(scored.explorationBonus).toBeGreaterThan(0);
    expect(scored.questionId).toBe('q1');
    expect(scored.system).toBe('Cardiovascular');
  });

  it('expected reward starts near zero for untrained params', () => {
    const arm = makeArm('q1', 'Cardiovascular');
    const params = initArmParams();
    const scored = scoreArm(arm, params, 0.5);

    // With identity A and zero b, theta = A⁻¹b = 0, so expected reward ≈ 0
    expect(Math.abs(scored.expectedReward)).toBeLessThan(0.01);
  });

  it('higher alpha increases exploration bonus', () => {
    const arm = makeArm('q1', 'Cardiovascular');
    const params = initArmParams();

    const lowAlpha = scoreArm(arm, params, 0.1);
    const highAlpha = scoreArm(arm, params, 2.0);

    expect(highAlpha.ucbScore).toBeGreaterThan(lowAlpha.ucbScore);
  });

  it('UCB = expectedReward + alpha * explorationBonus', () => {
    const arm = makeArm('q1', 'Cardiovascular');
    const params = initArmParams();
    const alpha = 0.5;
    const scored = scoreArm(arm, params, alpha);

    expect(scored.ucbScore).toBeCloseTo(
      scored.expectedReward + alpha * scored.explorationBonus,
      10
    );
  });
});

// ─── Ranking ────────────────────────────────────────────────────────────────

describe('rankCandidates', () => {
  it('returns all candidates scored and sorted', () => {
    const candidates = [
      makeArm('q1', 'Cardiovascular'),
      makeArm('q2', 'Pulmonary'),
      makeArm('q3', 'Renal'),
    ];
    const state = initBanditState();
    const config: BanditConfig = { ...DEFAULT_BANDIT_CONFIG, epsilonFloor: 0 };

    const ranked = rankCandidates(candidates, state, config);
    expect(ranked).toHaveLength(3);

    // Verify sorted descending
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.ucbScore).toBeGreaterThanOrEqual(ranked[i]!.ucbScore);
    }
  });

  it('gives cold start bonus to unseen systems', () => {
    const state: BanditState = {
      ...initBanditState(),
      armParams: {
        Cardiovascular: {
          ...initArmParams(),
          pullCount: 50, // well past threshold
        },
      },
    };
    const config: BanditConfig = {
      ...DEFAULT_BANDIT_CONFIG,
      epsilonFloor: 0,
      coldStartThreshold: 10,
    };

    const seenArm = makeArm('q1', 'Cardiovascular');
    const unseenArm = makeArm('q2', 'Pulmonary');

    // Same context, different systems
    const ranked = rankCandidates([seenArm, unseenArm], state, config);

    // Unseen system should rank higher due to cold start bonus
    expect(ranked[0]!.questionId).toBe('q2');
  });

  it('respects maxCandidates limit', () => {
    const candidates = Array.from({ length: 200 }, (_, i) =>
      makeArm(`q${i}`, 'CV')
    );
    const state = initBanditState();
    const config: BanditConfig = { ...DEFAULT_BANDIT_CONFIG, maxCandidates: 50, epsilonFloor: 0 };

    const ranked = rankCandidates(candidates, state, config);
    expect(ranked).toHaveLength(50);
  });
});

describe('selectQuestions', () => {
  it('returns requested count', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeArm(`q${i}`, `Sys${i % 3}`)
    );
    const state = initBanditState();
    const config: BanditConfig = { ...DEFAULT_BANDIT_CONFIG, epsilonFloor: 0 };

    const selected = selectQuestions(candidates, state, 5, config);
    expect(selected).toHaveLength(5);
  });

  it('returns fewer if not enough candidates', () => {
    const candidates = [makeArm('q1', 'CV'), makeArm('q2', 'Pulm')];
    const state = initBanditState();

    const selected = selectQuestions(candidates, state, 10);
    expect(selected).toHaveLength(2);
  });
});

// ─── Parameter Updates ──────────────────────────────────────────────────────

describe('updateBanditState', () => {
  it('increments total selections and cumulative reward', () => {
    const state = initBanditState();
    const reward: BanditReward = {
      questionId: 'q1',
      system: 'Cardiovascular',
      context: BASE_CONTEXT,
      correct: 1,
    };

    const newState = updateBanditState(state, reward);
    expect(newState.totalSelections).toBe(1);
    expect(newState.cumulativeReward).toBe(1);
  });

  it('does not mutate original state', () => {
    const state = initBanditState();
    const reward: BanditReward = {
      questionId: 'q1',
      system: 'CV',
      context: BASE_CONTEXT,
      correct: 1,
    };

    const newState = updateBanditState(state, reward);
    expect(state.totalSelections).toBe(0);
    expect(newState.totalSelections).toBe(1);
  });

  it('creates arm params for new system', () => {
    const state = initBanditState();
    const reward: BanditReward = {
      questionId: 'q1',
      system: 'Neurology',
      context: BASE_CONTEXT,
      correct: 0,
    };

    const newState = updateBanditState(state, reward);
    expect(newState.armParams['Neurology']).toBeDefined();
    expect(newState.armParams['Neurology']!.pullCount).toBe(1);
  });

  it('accumulates rewards correctly over multiple updates', () => {
    let state = initBanditState();

    // 3 correct, 2 incorrect
    const rewards: BanditReward[] = [
      { questionId: 'q1', system: 'CV', context: BASE_CONTEXT, correct: 1 },
      { questionId: 'q2', system: 'CV', context: BASE_CONTEXT, correct: 1 },
      { questionId: 'q3', system: 'CV', context: BASE_CONTEXT, correct: 0 },
      { questionId: 'q4', system: 'Pulm', context: BASE_CONTEXT, correct: 1 },
      { questionId: 'q5', system: 'Pulm', context: BASE_CONTEXT, correct: 0 },
    ];

    for (const r of rewards) {
      state = updateBanditState(state, r);
    }

    expect(state.totalSelections).toBe(5);
    expect(state.cumulativeReward).toBe(3);
    expect(state.armParams['CV']!.pullCount).toBe(3);
    expect(state.armParams['Pulm']!.pullCount).toBe(2);
  });

  it('includes learning progress bonus in reward', () => {
    const state = initBanditState();
    const reward: BanditReward = {
      questionId: 'q1',
      system: 'CV',
      context: BASE_CONTEXT,
      correct: 1,
      learningProgressBonus: 0.3,
    };

    const newState = updateBanditState(state, reward);
    expect(newState.cumulativeReward).toBeCloseTo(1.3, 5);
  });
});

describe('batchUpdateBanditState', () => {
  it('applies all rewards sequentially', () => {
    const state = initBanditState();
    const rewards: BanditReward[] = [
      { questionId: 'q1', system: 'CV', context: BASE_CONTEXT, correct: 1 },
      { questionId: 'q2', system: 'Pulm', context: BASE_CONTEXT, correct: 0 },
      { questionId: 'q3', system: 'CV', context: BASE_CONTEXT, correct: 1 },
    ];

    const newState = batchUpdateBanditState(state, rewards);
    expect(newState.totalSelections).toBe(3);
    expect(newState.cumulativeReward).toBe(2);
  });
});

// ─── Learning Behavior ──────────────────────────────────────────────────────

describe('LinUCB learning behavior', () => {
  it('shifts expected reward after training', () => {
    let state = initBanditState();

    // Train CV system: high mastery + correct = reward
    const highMasteryCtx: BanditContext = {
      ...BASE_CONTEXT,
      topicMastery: 0.9,
      difficulty: 0.3,
    };

    // 20 rounds of consistent positive reward for high-mastery, low-difficulty
    for (let i = 0; i < 20; i++) {
      state = updateBanditState(state, {
        questionId: `q${i}`,
        system: 'CV',
        context: highMasteryCtx,
        correct: 1,
      });
    }

    // Score a similar arm — expected reward should be positive
    const arm = makeArm('test', 'CV', {
      topicMastery: 0.9,
      difficulty: 0.3,
    });
    const scored = scoreArm(arm, state.armParams['CV']!, 0.5);
    expect(scored.expectedReward).toBeGreaterThan(0);
  });

  it('exploration bonus decreases with more data', () => {
    let state = initBanditState();
    const arm = makeArm('q1', 'CV');

    // Score before any training
    const beforeScore = scoreArm(arm, initArmParams(), 0.5);

    // Train for 50 rounds
    for (let i = 0; i < 50; i++) {
      state = updateBanditState(state, {
        questionId: `q${i}`,
        system: 'CV',
        context: BASE_CONTEXT,
        correct: i % 2 === 0 ? 1 : 0,
      });
    }

    const afterScore = scoreArm(arm, state.armParams['CV']!, 0.5);

    // Exploration bonus should shrink as A accumulates more data
    expect(afterScore.explorationBonus).toBeLessThan(beforeScore.explorationBonus);
  });
});

// ─── buildBanditArm ─────────────────────────────────────────────────────────

describe('buildBanditArm', () => {
  it('maps difficulty string to [0,1]', () => {
    const arm = buildBanditArm({
      questionId: 'q1',
      system: 'CV',
      difficulty: '3',
      topic: 'CHF',
    });
    expect(arm.context.difficulty).toBeCloseTo(0.5, 5); // (3-1)/4 = 0.5
  });

  it('handles null difficulty', () => {
    const arm = buildBanditArm({
      questionId: 'q1',
      system: null,
      difficulty: null,
      topic: null,
    });
    expect(arm.context.difficulty).toBe(0.5);
    expect(arm.system).toBe('Unknown');
  });

  it('normalizes daysSinceReview to [0,1] capped at 30 days', () => {
    const arm = buildBanditArm({
      questionId: 'q1',
      system: 'CV',
      difficulty: '2',
      topic: 'CHF',
      daysSinceReview: 15,
    });
    expect(arm.context.timeSinceLastReview).toBeCloseTo(0.5, 5); // 15/30
  });

  it('computes sessionPosition correctly', () => {
    const arm = buildBanditArm({
      questionId: 'q1',
      system: 'CV',
      difficulty: '2',
      topic: 'CHF',
      sessionIndex: 5,
      sessionSize: 20,
    });
    // 5 / (20-1) ≈ 0.263
    expect(arm.context.sessionPosition).toBeCloseTo(5 / 19, 3);
  });

  it('uses default values for missing optional fields', () => {
    const arm = buildBanditArm({
      questionId: 'q1',
      system: 'Pulm',
      difficulty: '4',
      topic: 'Asthma',
    });
    expect(arm.context.topicMastery).toBe(0.5);
    expect(arm.context.overdueRatio).toBe(0.0);
    expect(arm.context.systemWeakness).toBe(0.5);
    expect(arm.context.blueprintWeight).toBe(0.08);
  });
});

// ─── Diagnostics ────────────────────────────────────────────────────────────

describe('getBanditDiagnostics', () => {
  it('returns correct summary for empty state', () => {
    const diag = getBanditDiagnostics(initBanditState());
    expect(diag.totalSelections).toBe(0);
    expect(diag.avgReward).toBe(0);
    expect(Object.keys(diag.systemStats)).toHaveLength(0);
  });

  it('computes per-system stats after training', () => {
    let state = initBanditState();
    for (let i = 0; i < 10; i++) {
      state = updateBanditState(state, {
        questionId: `q${i}`,
        system: 'CV',
        context: BASE_CONTEXT,
        correct: 1,
      });
    }

    const diag = getBanditDiagnostics(state);
    expect(diag.totalSelections).toBe(10);
    expect(diag.avgReward).toBe(1);
    expect(diag.systemStats['CV']!.pulls).toBe(10);
  });
});

// ─── Config Defaults ────────────────────────────────────────────────────────

describe('DEFAULT_BANDIT_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_BANDIT_CONFIG.alpha).toBe(0.5);
    expect(DEFAULT_BANDIT_CONFIG.coldStartThreshold).toBe(10);
    expect(DEFAULT_BANDIT_CONFIG.epsilonFloor).toBe(0.05);
    expect(DEFAULT_BANDIT_CONFIG.maxCandidates).toBe(100);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles empty candidate list', () => {
    const ranked = rankCandidates([], initBanditState());
    expect(ranked).toHaveLength(0);
  });

  it('handles single candidate', () => {
    const candidates = [makeArm('q1', 'CV')];
    const selected = selectQuestions(candidates, initBanditState(), 5);
    expect(selected).toHaveLength(1);
  });

  it('CONTEXT_DIM matches expected dimensionality', () => {
    expect(CONTEXT_DIM).toBe(7);
    const v = contextToVector(BASE_CONTEXT);
    expect(v).toHaveLength(CONTEXT_DIM);
  });
});
