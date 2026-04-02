---
name: vitest-author
description: >
  Write high-quality Vitest tests for PANaCEa services, following project conventions.
  Use this skill whenever writing tests, fixing failing tests, adding test coverage,
  or the user says "test this", "add tests", "why is this test failing", or "run tests".
  Also use when implementing any new service — every service needs tests. This skill
  prevents common test pitfalls like ordering artifacts in test data, incorrect
  signal strength math assertions, and missing vitest imports.
---

# Vitest Test Author for PANaCEa

## Why this exists

PANaCEa tests have specific patterns that prevent false passes and subtle bugs.
Most failures in this codebase come from: (1) test data ordering artifacts,
(2) wrong math in threshold/z-score assertions, and (3) missing imports. This
skill encodes the patterns that produce reliable tests on the first try.

## Project test setup

- Framework: Vitest 4.x
- Config: `vitest.config.ts` at repo root
- Test location: `tests/` directory at repo root
- Globals NOT configured — always import explicitly:
  ```ts
  import { describe, it, expect } from 'vitest';
  ```
- Run tests: `npx vitest run tests/specificFile.test.ts`
- Run all: `npx vitest run tests/`

## The interleaved helper pattern

This is the most important pattern. When creating test data with a target
recall rate, NEVER put all correct answers first and incorrect last:

```ts
// BAD — creates ordering artifacts in rolling-window tests
for (let i = 0; i < count; i++) {
  reviews.push({ wasCorrect: i < count * recallRate });
  // First 80% correct, last 20% incorrect → "last 50" window is all wrong!
}

// GOOD — interleave correct/incorrect evenly
const correctCount = Math.round(count * recallRate);
for (let i = 0; i < count; i++) {
  const isCorrect = Math.floor((i + 1) * correctCount / count)
    > Math.floor(i * correctCount / count);
  reviews.push({ wasCorrect: isCorrect });
}
```

The bad version caused real test failures in Sprint 8: the "last 50" rolling
window saw only incorrect answers, producing artificial drift in what should
have been uniform data.

## Z-score test math

When testing z-score thresholds (Ghost Grader, behavioral baselines), always
write the math in a comment so it's verifiable at a glance:

```ts
it('fires on oscillations > 2 stddev above user norm', () => {
  // oscillations=3, median=1.0, stddev=0.5 → z=(3-1)/0.5=4.0 > 2.0 ✓
  const result = applyHonestRatingWithDetail({
    oscillations: 3,
    baseline: { oscillationMedian: 1.0, oscillationStdDev: 0.5, ... },
  });
  expect(result.rating).toBe(Rating.Again);
});
```

**Common trap**: z > 2.0 means STRICTLY greater. z = 2.0 does NOT fire.
So `(2 - 1) / 0.5 = 2.0` → no fire. `(3 - 1) / 0.5 = 4.0` → fires.

## Signal strength assertions

Ghost Grader signal strength is cumulative. A single signal often doesn't
exceed 0.4 (the threshold for Good→Hard downgrade). Know the weights:

- A single oscillation signal: ~0.075–0.3 strength
- A single drift signal: ~0.04–0.25 strength
- A single tremor signal: ~0.05–0.2 strength
- A single regression signal: ~0.08–0.25 strength

So testing "downgrades Good→Hard" requires combining multiple strong signals,
or using `userRating: Rating.Easy` (which downgrades to Good on ANY single signal).

## Test file structure

Follow this consistent pattern:

```ts
import { describe, it, expect } from 'vitest';
import { functionUnderTest } from '../lib/services/theService';

// ─── Helpers ──────────────────────────────

function makeReviews(count: number, retrievability: number, recallRate: number) {
  // Use the interleaved pattern (see above)
}

// ─── Test Groups ──────────────────────────

describe('Service Name — Feature Group', () => {
  it('describes expected behavior precisely', () => {
    // Arrange → Act → Assert
  });
});
```

## Testing pure vs DB functions

PANaCEa services export BOTH pure algorithm functions (for testing) and async
DB-integrated functions (for production). Always test the pure functions:

```ts
// Test these (pure, no DB needed):
import { bucketReviews, computeCorrectionFactor, detectDrift } from '../lib/services/retrievabilityCalibrationService';

// Don't test these in unit tests (need Prisma mock):
// import { generateCalibrationReport, getStabilityCorrectionFactor } from '...';
```

## Calibration factor math

When testing `computeCorrectionFactor`, remember:
- Bins with < 10 reviews (MIN_BIN_COUNT) are skipped or assumed calibrated
- The factor is a weighted average of `actual/predicted` ratios
- Clamped to [0.7, 1.4]
- Higher-retrievability bins (0.5–0.95) are weighted 2x in PANaCEa's implementation

## Running tests after implementation

After implementing any new service or modifying an existing one:
1. Write tests for all pure/exported functions
2. Run: `cd /Users/aaronullger/GitHub/StudyPANaCEa && npx vitest run tests/yourTest.test.ts`
3. If tests fail, read the error carefully — check math in comments
4. Run all related tests together to catch integration issues
5. Report pass count: "X/Y tests passing"
