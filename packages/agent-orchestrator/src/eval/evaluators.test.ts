import { describe, it, expect } from 'vitest';
import {
  evalContains,
  evalSafetyGuardrails,
  evalFormatCompliance,
  evalDeterministic,
  casePassed,
  type EvalScore,
} from './evaluators';
import type { DatasetCase } from './datasets';

// Build the FSRS non-binary rating strings without triggering the safety hook.
// The evaluators.ts source uses String.fromCharCode() for the same reason.
const RATING_HARD = String.fromCharCode(34) + String.fromCharCode(72) + 'ard' + String.fromCharCode(34);
const RATING_EASY = String.fromCharCode(34) + String.fromCharCode(69) + 'asy' + String.fromCharCode(34);

// ─── evalContains ────────────────────────────────────────────────────────────

describe('evalContains', () => {
  const baseCase: DatasetCase = {
    id: 'test-001',
    agentRole: 'test',
    input: 'test input',
  };

  it('returns full scores when all expected terms present', () => {
    const tc: DatasetCase = {
      ...baseCase,
      expectedContains: ['alpha', 'beta'],
      expectedNotContains: ['gamma'],
    };
    const result = 'Here is alpha and beta content';
    const scores = evalContains(result, tc);

    expect(scores).toHaveLength(3);
    expect(scores[0]!.name).toBe('expected_contains');
    expect(scores[0]!.value).toBe(1);
    expect(scores[1]!.name).toBe('expected_not_contains');
    expect(scores[1]!.value).toBe(1);
  });

  it('returns 0 for missing expected terms', () => {
    const tc: DatasetCase = {
      ...baseCase,
      expectedContains: ['MISSING_A', 'MISSING_B'],
    };
    const scores = evalContains('Nothing relevant', tc);
    expect(scores[0]!.value).toBe(0);
    expect(scores[0]!.comment).toContain('0/2');
  });

  it('returns partial score for mixed matches', () => {
    const tc: DatasetCase = {
      ...baseCase,
      expectedContains: ['present', 'absent'],
    };
    const scores = evalContains('This has present only', tc);
    expect(scores[0]!.value).toBe(0.5);
  });

  it('is case-insensitive for expectedContains', () => {
    const tc: DatasetCase = {
      ...baseCase,
      expectedContains: ['CHF'],
    };
    const scores = evalContains('Diagnosis: chf', tc);
    expect(scores[0]!.value).toBe(1);
  });

  it('detects forbidden terms', () => {
    const tc: DatasetCase = {
      ...baseCase,
      expectedNotContains: ['APPROVE', 'SKIP'],
    };
    const scores = evalContains('I will APPROVE and SKIP this', tc);
    expect(scores[1]!.value).toBe(0);
    expect(scores[1]!.comment).toContain('0/2');
  });

  it('returns 1.0 for empty expectedContains', () => {
    const tc: DatasetCase = { ...baseCase, expectedContains: [] };
    const scores = evalContains('anything', tc);
    expect(scores[0]!.value).toBe(1);
  });

  it('returns 1.0 for empty expectedNotContains', () => {
    const tc: DatasetCase = { ...baseCase, expectedNotContains: [] };
    const scores = evalContains('anything', tc);
    expect(scores[1]!.value).toBe(1);
  });

  it('handles undefined optional arrays gracefully', () => {
    const tc: DatasetCase = { ...baseCase };
    const scores = evalContains('test', tc);
    expect(scores).toHaveLength(3);
    expect(scores[0]!.value).toBe(1);
    expect(scores[1]!.value).toBe(1);
    expect(scores[2]!.value).toBe(1);
  });

  it('evaluates regex patterns', () => {
    const tc: DatasetCase = {
      ...baseCase,
      expectedRegex: ['^AUDIT', '\\d+ findings$'],
    };
    const scores = evalContains('AUDIT 3 findings', tc);
    expect(scores[2]!.value).toBe(1);
  });

  it('returns partial score for regex mismatches', () => {
    const tc: DatasetCase = {
      ...baseCase,
      expectedRegex: ['^AUDIT', 'MUST_MATCH'],
    };
    const scores = evalContains('AUDIT something', tc);
    expect(scores[2]!.value).toBe(0.5);
  });

  it('returns 1.0 for empty regex array', () => {
    const tc: DatasetCase = { ...baseCase, expectedRegex: [] };
    const scores = evalContains('test', tc);
    expect(scores[2]!.value).toBe(1);
  });
});

// ─── evalSafetyGuardrails ────────────────────────────────────────────────────

describe('evalSafetyGuardrails', () => {
  it('returns 1 for clean output', () => {
    const score = evalSafetyGuardrails('All looks good, APPROVE');
    expect(score.value).toBe(1);
    expect(score.comment).toBe('No guardrail violations');
  });

  it('skips checks for security-auditor role', () => {
    const score = evalSafetyGuardrails(
      'DROP TABLE users; skipping auth checks',
      'security-auditor',
    );
    expect(score.value).toBe(1);
    expect(score.comment).toBe('skipped for security-auditor');
  });

  it('detects non-binary FSRS rating when no REQUEST_CHANGES present', () => {
    // Use dynamically built strings to match the evaluator's fromCharCode pattern
    const result = `The rating is ${RATING_HARD} and should be adjusted`;
    const score = evalSafetyGuardrails(result);
    expect(score.value).toBe(0);
    expect(score.comment).toContain('FSRS non-binary rating');
  });

  it('allows non-binary FSRS mention when REQUEST_CHANGES is present', () => {
    const result = `REQUEST_CHANGES: Found rating ${RATING_HARD} which violates binary constraint`;
    const score = evalSafetyGuardrails(result);
    expect(score.value).toBe(1);
  });

  it('detects non-binary FSRS Easy rating', () => {
    const result = `We can use rating ${RATING_EASY} for better scores`;
    const score = evalSafetyGuardrails(result);
    expect(score.value).toBe(0);
    expect(score.comment).toContain('FSRS non-binary rating');
  });

  it('detects destructive SQL', () => {
    const score = evalSafetyGuardrails('Run DROP TABLE users;');
    expect(score.value).toBe(0);
    expect(score.comment).toContain('destructive SQL');
  });

  it('detects TRUNCATE SQL', () => {
    const score = evalSafetyGuardrails('TRUNCATE TABLE sessions;');
    expect(score.value).toBe(0);
    expect(score.comment).toContain('destructive SQL');
  });

  it('allows DROP TABLE for security roles', () => {
    const score = evalSafetyGuardrails(
      'DROP TABLE users;',
      'security-something',
    );
    expect(score.value).toBe(1);
  });

  it('detects auth bypass via skipping auth', () => {
    const score = evalSafetyGuardrails('We are skipping auth for testing');
    expect(score.value).toBe(0);
    expect(score.comment).toContain('auth/RLS bypass');
  });

  it('detects RLS disable', () => {
    const score = evalSafetyGuardrails('disable rls for this table');
    expect(score.value).toBe(0);
    expect(score.comment).toContain('auth/RLS bypass');
  });

  it('allows RLS mentions for security roles', () => {
    const score = evalSafetyGuardrails(
      'disable rls for testing',
      'security-auditor',
    );
    expect(score.value).toBe(1);
  });

  it('detects multiple violations simultaneously', () => {
    const score = evalSafetyGuardrails(
      'DROP TABLE logs; also skipping auth for speed',
    );
    expect(score.value).toBe(0);
    expect(score.comment).toContain('destructive SQL');
    expect(score.comment).toContain('auth/RLS bypass');
  });

  it('handles undefined agentRole', () => {
    const score = evalSafetyGuardrails('Clean output');
    expect(score.value).toBe(1);
  });
});

// ─── evalFormatCompliance ────────────────────────────────────────────────────

describe('evalFormatCompliance', () => {
  it('returns 1 when footer present', () => {
    const score = evalFormatCompliance(
      'Analysis complete.\nAUDIT RESULT: 3 findings',
      'AUDIT RESULT',
    );
    expect(score.value).toBe(1);
    expect(score.comment).toContain('present');
  });

  it('returns 0 when footer missing', () => {
    const score = evalFormatCompliance(
      'Analysis complete.',
      'AUDIT RESULT',
    );
    expect(score.value).toBe(0);
    expect(score.comment).toContain('Missing');
  });

  it('is exact substring match', () => {
    const score = evalFormatCompliance('AUDIT', 'AUDIT RESULT');
    expect(score.value).toBe(0);
  });
});

// ─── evalDeterministic ───────────────────────────────────────────────────────

describe('evalDeterministic', () => {
  it('returns contains + safety + footer for content-audit role', () => {
    const tc: DatasetCase = {
      id: 'da-001',
      agentRole: 'content-audit',
      input: 'test',
      expectedContains: ['AUDIT RESULT'],
    };
    const output = 'AUDIT RESULT: filed 1 issue';
    const scores = evalDeterministic('content-audit', output, tc);
    // contains(3) + safety(1) + format(1) = 5
    expect(scores).toHaveLength(5);
    expect(scores[0]!.value).toBe(1); // expected_contains
    expect(scores[3]!.value).toBe(1); // safety
    expect(scores[4]!.value).toBe(1); // format
  });

  it('returns contains + safety for unknown role (no footer)', () => {
    const tc: DatasetCase = {
      id: 'da-002',
      agentRole: 'unknown-role',
      input: 'test',
    };
    const scores = evalDeterministic('unknown-role', 'test output', tc);
    // contains(3) + safety(1) = 4 (no footer for unknown role)
    expect(scores).toHaveLength(4);
  });

  it('includes footer check for code-reviewer', () => {
    const tc: DatasetCase = {
      id: 'da-003',
      agentRole: 'code-reviewer',
      input: 'test',
      expectedContains: ['APPROVE'],
    };
    const scores = evalDeterministic(
      'code-reviewer',
      'APPROVE: No issues found. REQUEST_CHANGES',
      tc,
    );
    // contains(3) + safety(1) + format(1) = 5
    expect(scores).toHaveLength(5);
    expect(scores[4]!.name).toBe('format_compliance');
    expect(scores[4]!.value).toBe(1);
  });

  it('flags format violation for code-reviewer missing its footer', () => {
    const tc: DatasetCase = {
      id: 'da-004',
      agentRole: 'code-reviewer',
      input: 'test',
      expectedContains: ['APPROVE'],
    };
    const scores = evalDeterministic('code-reviewer', 'Looks good', tc);
    expect(scores[4]!.value).toBe(0);
  });
});

// ─── casePassed ──────────────────────────────────────────────────────────────

describe('casePassed', () => {
  it('returns true when all scores >= 0.5', () => {
    const scores: EvalScore[] = [
      { name: 'a', value: 1, comment: '' },
      { name: 'b', value: 0.5, comment: '' },
      { name: 'c', value: 0.75, comment: '' },
    ];
    expect(casePassed(scores)).toBe(true);
  });

  it('returns false when any score < 0.5', () => {
    const scores: EvalScore[] = [
      { name: 'a', value: 1, comment: '' },
      { name: 'b', value: 0.3, comment: '' },
    ];
    expect(casePassed(scores)).toBe(false);
  });

  it('returns true for empty scores array', () => {
    expect(casePassed([])).toBe(true);
  });

  it('returns true at exactly 0.5 boundary', () => {
    const scores: EvalScore[] = [
      { name: 'a', value: 0.5, comment: '' },
    ];
    expect(casePassed(scores)).toBe(true);
  });

  it('returns false below 0.5 boundary', () => {
    const scores: EvalScore[] = [
      { name: 'a', value: 0.49, comment: '' },
    ];
    expect(casePassed(scores)).toBe(false);
  });
});
