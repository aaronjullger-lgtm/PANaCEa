/**
 * Unit tests for lib/services/questionReviewGate.ts
 *
 * Only the pure functions are tested here — autoApproveHighQuality and
 * getReviewQueueStats require Prisma and belong in integration tests.
 *
 * Key thresholds (from the source):
 *   AUTO_APPROVE_THRESHOLD    = 0.9  → 'approved'
 *   NEEDS_REVISION_THRESHOLD  = 0.7  → boundary between 'pending' / 'needs_revision'
 *   MAX_FLAG_COUNT            = 3    → 'rejected'
 *   COMPONENT_APPROVE_THRESHOLD = 0.85 (from questionQualityService)
 */

import { describe, it, expect } from 'vitest';
import {
  determineValidationStatus,
  determineStatusFromComponents,
  AUTO_APPROVE_THRESHOLD,
  NEEDS_REVISION_THRESHOLD,
  MAX_FLAG_COUNT,
  type ReviewStatus,
} from './questionReviewGate';
import type { QualityComponents } from './questionQualityService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeComponents(
  partial: Partial<QualityComponents> = {}
): QualityComponents {
  return {
    difficultyAlignment: 0.9,
    discriminationIndex: 0.9,
    distractorEffectiveness: 0.9,
    clinicalRelevance: 0.9,
    ...partial,
  };
}

// ─── determineValidationStatus ────────────────────────────────────────────────

describe('determineValidationStatus', () => {
  // Flag-count rejection (highest priority)
  it('returns "rejected" when flagCount equals MAX_FLAG_COUNT', () => {
    expect(determineValidationStatus(0.95, MAX_FLAG_COUNT)).toBe('rejected');
  });

  it('returns "rejected" when flagCount exceeds MAX_FLAG_COUNT', () => {
    expect(determineValidationStatus(0.95, MAX_FLAG_COUNT + 5)).toBe('rejected');
  });

  it('does NOT reject when flagCount is MAX_FLAG_COUNT - 1', () => {
    const status = determineValidationStatus(0.95, MAX_FLAG_COUNT - 1);
    expect(status).not.toBe('rejected');
  });

  // Null/undefined quality score
  it('returns "pending" for null qualityScore (no score yet)', () => {
    expect(determineValidationStatus(null)).toBe('pending');
  });

  it('returns "pending" for undefined qualityScore', () => {
    expect(determineValidationStatus(undefined)).toBe('pending');
  });

  it('null quality + flagCount < MAX → "pending" (not rejected)', () => {
    expect(determineValidationStatus(null, 2)).toBe('pending');
  });

  // Auto-approve boundary
  it('returns "approved" for qualityScore >= AUTO_APPROVE_THRESHOLD', () => {
    expect(determineValidationStatus(AUTO_APPROVE_THRESHOLD)).toBe('approved');
  });

  it('returns "approved" for qualityScore = 1.0', () => {
    expect(determineValidationStatus(1.0)).toBe('approved');
  });

  it('returns "pending" for qualityScore just below AUTO_APPROVE_THRESHOLD', () => {
    expect(determineValidationStatus(AUTO_APPROVE_THRESHOLD - 0.001)).toBe('pending');
  });

  // Pending range
  it('returns "pending" for qualityScore = NEEDS_REVISION_THRESHOLD', () => {
    expect(determineValidationStatus(NEEDS_REVISION_THRESHOLD)).toBe('pending');
  });

  it('returns "pending" for qualityScore between thresholds (e.g. 0.8)', () => {
    expect(determineValidationStatus(0.8)).toBe('pending');
  });

  // Needs revision
  it('returns "needs_revision" for qualityScore just below NEEDS_REVISION_THRESHOLD', () => {
    expect(determineValidationStatus(NEEDS_REVISION_THRESHOLD - 0.001)).toBe('needs_revision');
  });

  it('returns "needs_revision" for qualityScore = 0.0', () => {
    expect(determineValidationStatus(0.0)).toBe('needs_revision');
  });

  it('returns "needs_revision" for very low qualityScore (0.1)', () => {
    expect(determineValidationStatus(0.1)).toBe('needs_revision');
  });

  // Default flagCount = 0
  it('treats missing flagCount as 0 (no default-rejection)', () => {
    expect(determineValidationStatus(0.95)).toBe('approved');
  });

  // Return type
  it('always returns a valid ReviewStatus string', () => {
    const validStatuses: ReviewStatus[] = ['approved', 'pending', 'needs_revision', 'rejected'];
    const scores = [null, 0, 0.5, 0.69, 0.70, 0.89, 0.90, 1.0];
    const flags = [0, 1, 2, 3, 10];
    for (const score of scores) {
      for (const flag of flags) {
        expect(validStatuses).toContain(determineValidationStatus(score, flag));
      }
    }
  });
});

// ─── determineStatusFromComponents ───────────────────────────────────────────

describe('determineStatusFromComponents', () => {
  // Flag-count rejection
  it('returns "rejected" when flagCount >= MAX_FLAG_COUNT regardless of quality', () => {
    const components = makeComponents();
    expect(determineStatusFromComponents(components, 1.0, MAX_FLAG_COUNT)).toBe('rejected');
  });

  // All-pass + high composite → approved
  it('returns "approved" when all components >= 0.85 AND compositeScore >= 0.90', () => {
    const components = makeComponents({ difficultyAlignment: 0.87, discriminationIndex: 0.92 });
    expect(determineStatusFromComponents(components, 0.91)).toBe('approved');
  });

  it('returns "approved" for all components exactly at COMPONENT_APPROVE_THRESHOLD (0.85)', () => {
    const components = makeComponents({
      difficultyAlignment: 0.85,
      discriminationIndex: 0.85,
      distractorEffectiveness: 0.85,
      clinicalRelevance: 0.85,
    });
    expect(determineStatusFromComponents(components, 0.90)).toBe('approved');
  });

  // One component below threshold → not approved
  it('returns "pending" when one component fails even if composite is high', () => {
    const components = makeComponents({ difficultyAlignment: 0.84 }); // just below 0.85
    const status = determineStatusFromComponents(components, 0.91);
    expect(status).not.toBe('approved');
    expect(status).toBe('pending');
  });

  it('returns "pending" when discriminationIndex fails', () => {
    const components = makeComponents({ discriminationIndex: 0.84 });
    expect(determineStatusFromComponents(components, 0.95)).toBe('pending');
  });

  it('returns "pending" when distractorEffectiveness fails', () => {
    const components = makeComponents({ distractorEffectiveness: 0.80 });
    expect(determineStatusFromComponents(components, 0.95)).toBe('pending');
  });

  it('returns "pending" when clinicalRelevance fails', () => {
    const components = makeComponents({ clinicalRelevance: 0.50 });
    expect(determineStatusFromComponents(components, 0.95)).toBe('pending');
  });

  // All components pass but composite too low → not approved
  it('returns "pending" when all components pass but compositeScore < 0.90', () => {
    const components = makeComponents();
    expect(determineStatusFromComponents(components, 0.89)).toBe('pending');
  });

  // Composite < 0.40 → needs_revision
  it('returns "needs_revision" when compositeScore < 0.40', () => {
    const components = makeComponents({ clinicalRelevance: 0.30 }); // fails component too
    expect(determineStatusFromComponents(components, 0.39)).toBe('needs_revision');
  });

  it('returns "needs_revision" for compositeScore = 0.0 even with good components', () => {
    // Components pass but composite is below 0.40
    const components = makeComponents();
    expect(determineStatusFromComponents(components, 0.0)).toBe('needs_revision');
  });

  it('returns "pending" for composite exactly at 0.40 (boundary stays pending)', () => {
    const components = makeComponents({ clinicalRelevance: 0.50 }); // one fails → not approved
    expect(determineStatusFromComponents(components, 0.40)).toBe('pending');
  });

  // Default flagCount = 0
  it('works with default flagCount = 0', () => {
    const components = makeComponents();
    expect(determineStatusFromComponents(components, 0.91)).toBe('approved');
  });

  // Return type coverage
  it('always returns a valid ReviewStatus string', () => {
    const validStatuses: ReviewStatus[] = ['approved', 'pending', 'needs_revision', 'rejected'];
    const testCases = [
      [makeComponents(), 1.0, 0],
      [makeComponents({ clinicalRelevance: 0.5 }), 0.91, 0],
      [makeComponents(), 0.3, 0],
      [makeComponents(), 0.91, MAX_FLAG_COUNT],
    ] as const;
    for (const [components, composite, flags] of testCases) {
      expect(validStatuses).toContain(
        determineStatusFromComponents(components as QualityComponents, composite, flags)
      );
    }
  });
});
