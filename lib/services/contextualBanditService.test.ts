/**
 * Unit tests for lib/services/contextualBanditService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   identityMatrix(d)
 *   zeroVector(d)
 *   matVecMul(A, x)
 *   dotProduct(a, b)
 *   addOuterProduct(A, x)
 *   addScaledVector(b, x, scale)
 *   solveLinearSystem(A, b)
 *   quadraticForm(A, x)
 *   contextToVector(ctx)
 *   initArmParams()
 *   initBanditState()
 *   scoreArm(arm, params, alpha)
 *   buildBanditArm(meta)
 *   updateBanditState(state, reward)
 *   batchUpdateBanditState(state, rewards)
 *   getBanditDiagnostics(state)
 *   rankCandidates(candidates, state, config)
 *   selectQuestions(candidates, state, count)
 */

import { describe, it, expect } from 'vitest';
import {
  CONTEXT_DIM,
  DEFAULT_BANDIT_CONFIG,
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
  buildBanditArm,
  updateBanditState,
  batchUpdateBanditState,
  getBanditDiagnostics,
  rankCandidates,
  selectQuestions,
  type BanditArm,
  type BanditContext,
  type BanditState,
  type BanditReward,
  type QuestionMetadata,
} from './contextualBanditService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<BanditContext> = {}): BanditContext {
  return {
    topicMastery: 0.5,
    overdueRatio: 1.0,
    difficulty: 0.5,
    systemWeakness: 0.5,
    blueprintWeight: 0.10,
    timeSinceLastReview: 0.5,
    sessionPosition: 0.0,
    ...overrides,
  };
}

function makeArm(questionId: string, system = 'Cardiology', overrides: Partial<BanditContext> = {}): BanditArm {
  return {
    questionId,
    system,
    context: makeContext(overrides),
  };
}

function makeMeta(overrides: Partial<QuestionMetadata> = {}): QuestionMetadata {
  return {
    questionId: 'q-001',
    system: 'Pulmonology',
    difficulty: '3',
    topic: 'COPD',
    ...overrides,
  };
}

function makeState(): BanditState {
  return initBanditState();
}

// ─── identityMatrix ──────────────────────────────────────────────────────────

describe('identityMatrix', () => {
  it('returns a d×d matrix', () => {
    const M = identityMatrix(3);
    expect(M).toHaveLength(3);
    M.forEach(row => expect(row).toHaveLength(3));
  });

  it('has 1s on the main diagonal', () => {
    const M = identityMatrix(4);
    for (let i = 0; i < 4; i++) {
      expect(M[i]![i]).toBe(1);
    }
  });

  it('has 0s off the diagonal', () => {
    const M = identityMatrix(3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i !== j) expect(M[i]![j]).toBe(0);
      }
    }
  });

  it('works for d=1', () => {
    expect(identityMatrix(1)).toEqual([[1]]);
  });

  it('CONTEXT_DIM identity has correct shape', () => {
    const M = identityMatrix(CONTEXT_DIM);
    expect(M).toHaveLength(CONTEXT_DIM);
    expect(M[0]).toHaveLength(CONTEXT_DIM);
  });
});

// ─── zeroVector ───────────────────────────────────────────────────────────────

describe('zeroVector', () => {
  it('returns array of length d filled with 0', () => {
    const v = zeroVector(5);
    expect(v).toHaveLength(5);
    v.forEach(x => expect(x).toBe(0));
  });

  it('CONTEXT_DIM zero vector', () => {
    const v = zeroVector(CONTEXT_DIM);
    expect(v).toHaveLength(CONTEXT_DIM);
    expect(v.every(x => x === 0)).toBe(true);
  });
});

// ─── matVecMul ────────────────────────────────────────────────────────────────

describe('matVecMul', () => {
  it('identity × x = x', () => {
    const I = identityMatrix(3);
    const x = [1, 2, 3];
    expect(matVecMul(I, x)).toEqual([1, 2, 3]);
  });

  it('zero matrix × x = zero vector', () => {
    const Z = [[0, 0], [0, 0]];
    const x = [5, 7];
    expect(matVecMul(Z, x)).toEqual([0, 0]);
  });

  it('computes correct result for simple 2×2 case', () => {
    // [[2, 0], [0, 3]] × [4, 5] = [8, 15]
    const A = [[2, 0], [0, 3]];
    const x = [4, 5];
    expect(matVecMul(A, x)).toEqual([8, 15]);
  });

  it('handles general 3×3 matrix', () => {
    // [[1,1,0],[0,1,1],[1,0,1]] × [1,2,3] = [3, 5, 4]
    const A = [[1, 1, 0], [0, 1, 1], [1, 0, 1]];
    const x = [1, 2, 3];
    const result = matVecMul(A, x);
    expect(result).toEqual([3, 5, 4]);
  });
});

// ─── dotProduct ───────────────────────────────────────────────────────────────

describe('dotProduct', () => {
  it('[1,2,3]·[4,5,6] = 32', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('zero vector dotted with anything = 0', () => {
    expect(dotProduct([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('unit vectors: [1,0,0]·[0,1,0] = 0', () => {
    expect(dotProduct([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('same vector: [1,2] · [1,2] = 5', () => {
    expect(dotProduct([1, 2], [1, 2])).toBe(5);
  });

  it('handles negative values', () => {
    expect(dotProduct([-1, 2], [3, -4])).toBe(-11);
  });
});

// ─── addOuterProduct ──────────────────────────────────────────────────────────

describe('addOuterProduct', () => {
  it('adds x·xᵀ to A in place', () => {
    const A = identityMatrix(2); // [[1,0],[0,1]]
    const x = [1, 0]; // x·xᵀ = [[1,0],[0,0]]
    addOuterProduct(A, x);
    expect(A).toEqual([[2, 0], [0, 1]]);
  });

  it('outer product of [1,1] adds [[1,1],[1,1]]', () => {
    const A = [[0, 0], [0, 0]];
    addOuterProduct(A, [1, 1]);
    expect(A).toEqual([[1, 1], [1, 1]]);
  });

  it('mutates A (not a new matrix)', () => {
    const A = identityMatrix(2);
    const ref = A;
    addOuterProduct(A, [1, 0]);
    expect(A).toBe(ref); // same reference
  });
});

// ─── addScaledVector ──────────────────────────────────────────────────────────

describe('addScaledVector', () => {
  it('adds scale×x to b in place', () => {
    const b = [0, 0, 0];
    addScaledVector(b, [1, 2, 3], 2);
    expect(b).toEqual([2, 4, 6]);
  });

  it('scale=0 leaves b unchanged', () => {
    const b = [5, 6];
    addScaledVector(b, [1, 2], 0);
    expect(b).toEqual([5, 6]);
  });

  it('scale=-1 subtracts x from b', () => {
    const b = [3, 4];
    addScaledVector(b, [1, 2], -1);
    expect(b).toEqual([2, 2]);
  });

  it('mutates b (not a new array)', () => {
    const b = [1, 2];
    const ref = b;
    addScaledVector(b, [0, 0], 1);
    expect(b).toBe(ref);
  });
});

// ─── solveLinearSystem ────────────────────────────────────────────────────────

describe('solveLinearSystem', () => {
  it('identity matrix: A⁻¹b = b', () => {
    const A = identityMatrix(3);
    const b = [1, 2, 3];
    const x = solveLinearSystem(A, b);
    // With regularization, result is b / (1 + 1e-6) ≈ b
    x.forEach((val, i) => expect(val).toBeCloseTo(b[i]!, 4));
  });

  it('diagonal matrix: solution is element-wise division', () => {
    // A = diag(2, 4) → x = [b0/2, b1/4]
    const A = [[2, 0], [0, 4]];
    const b = [4, 8];
    const x = solveLinearSystem(A, b);
    expect(x[0]).toBeCloseTo(2, 3);
    expect(x[1]).toBeCloseTo(2, 3);
  });

  it('returns zero vector for zero b', () => {
    const A = identityMatrix(3);
    const b = [0, 0, 0];
    const x = solveLinearSystem(A, b);
    x.forEach(val => expect(Math.abs(val)).toBeLessThan(1e-8));
  });

  it('result length matches b length', () => {
    const A = identityMatrix(CONTEXT_DIM);
    const b = zeroVector(CONTEXT_DIM);
    const x = solveLinearSystem(A, b);
    expect(x).toHaveLength(CONTEXT_DIM);
  });
});

// ─── quadraticForm ────────────────────────────────────────────────────────────

describe('quadraticForm', () => {
  it('identity matrix: xᵀI⁻¹x = |x|²', () => {
    const I = identityMatrix(3);
    const x = [1, 2, 3];
    const expected = 1 + 4 + 9; // 14
    expect(quadraticForm(I, x)).toBeCloseTo(expected, 3);
  });

  it('returns 0 for zero vector', () => {
    const I = identityMatrix(3);
    const x = [0, 0, 0];
    expect(quadraticForm(I, x)).toBeCloseTo(0, 10);
  });

  it('returns non-negative value', () => {
    const I = identityMatrix(CONTEXT_DIM);
    const x = Array.from({ length: CONTEXT_DIM }, (_, i) => (i - 3) * 0.2);
    expect(quadraticForm(I, x)).toBeGreaterThanOrEqual(0);
  });

  it('result is symmetric: same for any valid positive-definite A', () => {
    // For I, xᵀI⁻¹x = |x|² regardless of sign
    const I = identityMatrix(2);
    const pos = [2, 3];
    const neg = [-2, -3];
    expect(quadraticForm(I, pos)).toBeCloseTo(quadraticForm(I, neg), 5);
  });
});

// ─── contextToVector ──────────────────────────────────────────────────────────

describe('contextToVector', () => {
  it('returns vector of length CONTEXT_DIM (7)', () => {
    const v = contextToVector(makeContext());
    expect(v).toHaveLength(CONTEXT_DIM);
  });

  it('all values in [0, 1]', () => {
    const v = contextToVector(makeContext());
    v.forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });

  it('overdueRatio is capped at 3.0 (feature[1] = min(overdueRatio, 3)/3)', () => {
    const v4x = contextToVector(makeContext({ overdueRatio: 4.0 }));
    const v3x = contextToVector(makeContext({ overdueRatio: 3.0 }));
    // Both should yield feature[1] = 1.0 (capped)
    expect(v4x[1]).toBeCloseTo(1.0, 5);
    expect(v3x[1]).toBeCloseTo(1.0, 5);
  });

  it('overdueRatio=1.5 → feature[1] = 0.5', () => {
    const v = contextToVector(makeContext({ overdueRatio: 1.5 }));
    expect(v[1]).toBeCloseTo(0.5, 5);
  });

  it('blueprintWeight is scaled ×5 (0.10 → 0.50)', () => {
    const v = contextToVector(makeContext({ blueprintWeight: 0.10 }));
    expect(v[4]).toBeCloseTo(0.50, 5);
  });

  it('blueprintWeight saturates at 0.20+ (feature[4] = 1.0)', () => {
    const v = contextToVector(makeContext({ blueprintWeight: 0.20 }));
    expect(v[4]).toBeCloseTo(1.0, 5);
  });

  it('clamps topicMastery to [0,1]', () => {
    const vHigh = contextToVector(makeContext({ topicMastery: 1.5 }));
    const vLow = contextToVector(makeContext({ topicMastery: -0.5 }));
    expect(vHigh[0]).toBe(1.0);
    expect(vLow[0]).toBe(0.0);
  });

  it('non-finite values (NaN/Infinity) map to 0.5', () => {
    const v = contextToVector(makeContext({ topicMastery: NaN, difficulty: Infinity }));
    expect(v[0]).toBe(0.5);
    expect(v[2]).toBe(0.5);
  });
});

// ─── initArmParams ────────────────────────────────────────────────────────────

describe('initArmParams', () => {
  it('A is a CONTEXT_DIM×CONTEXT_DIM identity matrix', () => {
    const params = initArmParams();
    expect(params.A).toHaveLength(CONTEXT_DIM);
    for (let i = 0; i < CONTEXT_DIM; i++) {
      expect(params.A[i]).toHaveLength(CONTEXT_DIM);
      expect(params.A[i]![i]).toBe(1);
    }
  });

  it('b is a zero vector of length CONTEXT_DIM', () => {
    const params = initArmParams();
    expect(params.b).toHaveLength(CONTEXT_DIM);
    params.b.forEach(v => expect(v).toBe(0));
  });

  it('pullCount starts at 0', () => {
    expect(initArmParams().pullCount).toBe(0);
  });
});

// ─── initBanditState ──────────────────────────────────────────────────────────

describe('initBanditState', () => {
  it('armParams is empty object', () => {
    expect(initBanditState().armParams).toEqual({});
  });

  it('totalSelections starts at 0', () => {
    expect(initBanditState().totalSelections).toBe(0);
  });

  it('cumulativeReward starts at 0', () => {
    expect(initBanditState().cumulativeReward).toBe(0);
  });

  it('updatedAt is a valid ISO string', () => {
    const state = initBanditState();
    expect(() => new Date(state.updatedAt)).not.toThrow();
    expect(new Date(state.updatedAt).getFullYear()).toBeGreaterThan(2020);
  });
});

// ─── scoreArm ─────────────────────────────────────────────────────────────────

describe('scoreArm', () => {
  const arm = makeArm('q-001');
  const freshParams = initArmParams();

  it('returns expected fields', () => {
    const result = scoreArm(arm, freshParams, 0.5);
    expect(result).toHaveProperty('questionId', 'q-001');
    expect(result).toHaveProperty('system', 'Cardiology');
    expect(result).toHaveProperty('expectedReward');
    expect(result).toHaveProperty('explorationBonus');
    expect(result).toHaveProperty('ucbScore');
  });

  it('expectedReward is 0 with fresh params (b = zero vector)', () => {
    // θ̂ = A⁻¹b = I⁻¹·0 = 0 → expectedReward = 0
    const result = scoreArm(arm, freshParams, 0.5);
    expect(result.expectedReward).toBeCloseTo(0, 5);
  });

  it('explorationBonus is positive with fresh params', () => {
    const result = scoreArm(arm, freshParams, 0.5);
    expect(result.explorationBonus).toBeGreaterThan(0);
  });

  it('ucbScore = expectedReward + alpha × explorationBonus', () => {
    const alpha = 0.5;
    const result = scoreArm(arm, freshParams, alpha);
    expect(result.ucbScore).toBeCloseTo(result.expectedReward + alpha * result.explorationBonus, 5);
  });

  it('higher alpha → higher ucbScore (more exploration)', () => {
    const low = scoreArm(arm, freshParams, 0.1);
    const high = scoreArm(arm, freshParams, 2.0);
    expect(high.ucbScore).toBeGreaterThan(low.ucbScore);
  });
});

// ─── buildBanditArm ───────────────────────────────────────────────────────────

describe('buildBanditArm', () => {
  it('sets questionId from metadata', () => {
    const arm = buildBanditArm(makeMeta({ questionId: 'q-xyz' }));
    expect(arm.questionId).toBe('q-xyz');
  });

  it('uses system from metadata', () => {
    const arm = buildBanditArm(makeMeta({ system: 'Neurology' }));
    expect(arm.system).toBe('Neurology');
  });

  it('null system defaults to "Unknown"', () => {
    const arm = buildBanditArm(makeMeta({ system: null }));
    expect(arm.system).toBe('Unknown');
  });

  it('difficulty "1" → 0 (normalized to [0,1] from 1-5)', () => {
    const arm = buildBanditArm(makeMeta({ difficulty: '1' }));
    expect(arm.context.difficulty).toBeCloseTo(0, 5);
  });

  it('difficulty "3" → 0.5', () => {
    const arm = buildBanditArm(makeMeta({ difficulty: '3' }));
    expect(arm.context.difficulty).toBeCloseTo(0.5, 5);
  });

  it('difficulty "5" → 1', () => {
    const arm = buildBanditArm(makeMeta({ difficulty: '5' }));
    expect(arm.context.difficulty).toBeCloseTo(1.0, 5);
  });

  it('null difficulty defaults to 0.5', () => {
    const arm = buildBanditArm(makeMeta({ difficulty: null }));
    expect(arm.context.difficulty).toBeCloseTo(0.5, 5);
  });

  it('timeSinceLastReview = min(daysSinceReview/30, 1.0)', () => {
    const arm30 = buildBanditArm(makeMeta({ daysSinceReview: 30 }));
    const arm60 = buildBanditArm(makeMeta({ daysSinceReview: 60 }));
    expect(arm30.context.timeSinceLastReview).toBeCloseTo(1.0, 5);
    expect(arm60.context.timeSinceLastReview).toBeCloseTo(1.0, 5); // capped at 1.0
  });

  it('sessionPosition = sessionIndex / (sessionSize - 1)', () => {
    const arm = buildBanditArm(makeMeta({ sessionIndex: 2, sessionSize: 5 }));
    expect(arm.context.sessionPosition).toBeCloseTo(2 / 4, 5);
  });

  it('sessionPosition defaults to 0 if sessionSize not provided', () => {
    const arm = buildBanditArm(makeMeta({ sessionSize: undefined, sessionIndex: undefined }));
    expect(arm.context.sessionPosition).toBe(0);
  });
});

// ─── updateBanditState ────────────────────────────────────────────────────────

describe('updateBanditState', () => {
  const reward: BanditReward = {
    questionId: 'q-001',
    system: 'Cardiology',
    context: makeContext(),
    correct: 1,
  };

  it('increments totalSelections by 1', () => {
    const state = makeState();
    const next = updateBanditState(state, reward);
    expect(next.totalSelections).toBe(1);
  });

  it('increments cumulativeReward by reward.correct', () => {
    const state = makeState();
    const next = updateBanditState(state, reward);
    expect(next.cumulativeReward).toBe(1);
  });

  it('adds learningProgressBonus to cumulativeReward', () => {
    const state = makeState();
    const rewardWithBonus: BanditReward = { ...reward, learningProgressBonus: 0.3 };
    const next = updateBanditState(state, rewardWithBonus);
    expect(next.cumulativeReward).toBeCloseTo(1.3, 5);
  });

  it('creates arm params for the system', () => {
    const state = makeState();
    const next = updateBanditState(state, reward);
    expect(next.armParams['Cardiology']).toBeDefined();
    expect(next.armParams['Cardiology']!.pullCount).toBe(1);
  });

  it('does not mutate the original state', () => {
    const state = makeState();
    updateBanditState(state, reward);
    expect(state.totalSelections).toBe(0);
    expect(state.armParams['Cardiology']).toBeUndefined();
  });

  it('after correct=1, b vector has nonzero components', () => {
    const state = makeState();
    const next = updateBanditState(state, reward);
    const b = next.armParams['Cardiology']!.b;
    const hasNonzero = b.some(v => Math.abs(v) > 1e-10);
    expect(hasNonzero).toBe(true);
  });

  it('incorrect reward (correct=0) leaves b as zero vector', () => {
    const state = makeState();
    const incorrectReward: BanditReward = { ...reward, correct: 0 };
    const next = updateBanditState(state, incorrectReward);
    const b = next.armParams['Cardiology']!.b;
    b.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-10));
  });
});

// ─── batchUpdateBanditState ───────────────────────────────────────────────────

describe('batchUpdateBanditState', () => {
  const makeReward = (system: string, correct: number): BanditReward => ({
    questionId: 'q-test',
    system,
    context: makeContext(),
    correct,
  });

  it('applies all rewards sequentially', () => {
    const state = makeState();
    const rewards = [
      makeReward('Cardiology', 1),
      makeReward('Cardiology', 1),
      makeReward('Pulmonology', 0),
    ];
    const next = batchUpdateBanditState(state, rewards);
    expect(next.totalSelections).toBe(3);
    expect(next.armParams['Cardiology']!.pullCount).toBe(2);
    expect(next.armParams['Pulmonology']!.pullCount).toBe(1);
  });

  it('empty rewards array returns equivalent state', () => {
    const state = makeState();
    const next = batchUpdateBanditState(state, []);
    expect(next.totalSelections).toBe(0);
    expect(next.armParams).toEqual({});
  });

  it('cumulativeReward sums all rewards', () => {
    const state = makeState();
    const rewards = [
      makeReward('Cardiology', 1),
      makeReward('Cardiology', 1),
      makeReward('Cardiology', 0),
    ];
    const next = batchUpdateBanditState(state, rewards);
    expect(next.cumulativeReward).toBeCloseTo(2, 5);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    batchUpdateBanditState(state, [makeReward('Cardiology', 1)]);
    expect(state.totalSelections).toBe(0);
  });
});

// ─── getBanditDiagnostics ─────────────────────────────────────────────────────

describe('getBanditDiagnostics', () => {
  it('avgReward is 0 for fresh state (0 selections)', () => {
    const diag = getBanditDiagnostics(makeState());
    expect(diag.avgReward).toBe(0);
    expect(diag.totalSelections).toBe(0);
    expect(diag.cumulativeReward).toBe(0);
  });

  it('systemStats empty for fresh state', () => {
    const diag = getBanditDiagnostics(makeState());
    expect(Object.keys(diag.systemStats)).toHaveLength(0);
  });

  it('includes system stats after updates', () => {
    let state = makeState();
    state = updateBanditState(state, {
      questionId: 'q-1',
      system: 'Neurology',
      context: makeContext(),
      correct: 1,
    });
    const diag = getBanditDiagnostics(state);
    expect(diag.systemStats['Neurology']).toBeDefined();
    expect(diag.systemStats['Neurology']!.pulls).toBe(1);
  });

  it('avgReward = cumulativeReward / totalSelections', () => {
    let state = makeState();
    const reward = { questionId: 'q-1', system: 'Cardiology', context: makeContext(), correct: 1 as const };
    state = batchUpdateBanditState(state, [reward, reward]);
    const diag = getBanditDiagnostics(state);
    expect(diag.avgReward).toBeCloseTo(diag.cumulativeReward / diag.totalSelections, 3);
  });
});

// ─── rankCandidates ───────────────────────────────────────────────────────────

describe('rankCandidates', () => {
  const freshState = makeState();

  it('returns all candidates scored and sorted', () => {
    const arms = [makeArm('q-1'), makeArm('q-2'), makeArm('q-3')];
    const ranked = rankCandidates(arms, freshState);
    expect(ranked).toHaveLength(3);
    ranked.forEach(r => {
      expect(r).toHaveProperty('questionId');
      expect(r).toHaveProperty('ucbScore');
    });
  });

  it('returns empty array for empty candidates', () => {
    expect(rankCandidates([], freshState)).toEqual([]);
  });

  it('sorted descending by ucbScore', () => {
    const arms = [makeArm('q-1'), makeArm('q-2'), makeArm('q-3')];
    const ranked = rankCandidates(arms, freshState);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.ucbScore).toBeGreaterThanOrEqual(ranked[i]!.ucbScore);
    }
  });

  it('respects maxCandidates config', () => {
    const arms = Array.from({ length: 10 }, (_, i) => makeArm(`q-${i}`));
    const ranked = rankCandidates(arms, freshState, { ...DEFAULT_BANDIT_CONFIG, maxCandidates: 5 });
    expect(ranked.length).toBeLessThanOrEqual(5);
  });

  it('cold start bonus: unseen arm (pullCount=0) gets higher score than seen arm', () => {
    // Seed state with many pulls for Cardiology
    let state = makeState();
    const reward = { questionId: 'q-seen', system: 'Cardiology', context: makeContext(), correct: 1 as const };
    for (let i = 0; i < 15; i++) {
      state = updateBanditState(state, reward);
    }
    // Now rank a seen arm vs. an unseen system
    const seenArm = makeArm('q-seen', 'Cardiology');
    const unseenArm = makeArm('q-unseen', 'Neurology');
    const ranked = rankCandidates([seenArm, unseenArm], state, {
      ...DEFAULT_BANDIT_CONFIG,
      epsilonFloor: 0, // disable ε-greedy so we get deterministic ordering
    });
    // Unseen system (cold start) should get promoted
    const unseenScore = ranked.find(r => r.questionId === 'q-unseen')!.ucbScore;
    const seenScore = ranked.find(r => r.questionId === 'q-seen')!.ucbScore;
    expect(unseenScore).toBeGreaterThan(seenScore);
  });
});

// ─── selectQuestions ──────────────────────────────────────────────────────────

describe('selectQuestions', () => {
  const freshState = makeState();

  it('returns at most count questions', () => {
    const arms = Array.from({ length: 5 }, (_, i) => makeArm(`q-${i}`));
    const selected = selectQuestions(arms, freshState, 3);
    expect(selected).toHaveLength(3);
  });

  it('returns all if count >= candidates', () => {
    const arms = [makeArm('q-1'), makeArm('q-2')];
    const selected = selectQuestions(arms, freshState, 10);
    expect(selected).toHaveLength(2);
  });

  it('count=0 returns empty array', () => {
    const arms = [makeArm('q-1')];
    expect(selectQuestions(arms, freshState, 0)).toHaveLength(0);
  });

  it('selected arms are the top-scored arms from rankCandidates', () => {
    const arms = Array.from({ length: 5 }, (_, i) => makeArm(`q-${i}`));
    const ranked = rankCandidates(arms, freshState);
    const selected = selectQuestions(arms, freshState, 2);
    expect(selected[0]!.questionId).toBe(ranked[0]!.questionId);
    expect(selected[1]!.questionId).toBe(ranked[1]!.questionId);
  });
});
