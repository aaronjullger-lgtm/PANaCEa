# Tier 3a: Remove Deprecated PANCE_SYSTEM_PERCENTAGES Re-Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the deprecated `PANCE_SYSTEM_PERCENTAGES` re-exports from `lib/poolSelection.ts` and `services/domain/panceDistributionService.ts`, migrating all 7 callers to use `BLUEPRINT_PERCENT_BY_ABBREVIATION` directly from `lib/constants/blueprint.ts`.

**Architecture:** Both `lib/poolSelection.ts:12` and `services/domain/panceDistributionService.ts:12` re-export `BLUEPRINT_PERCENT_BY_ABBREVIATION` under the legacy name `PANCE_SYSTEM_PERCENTAGES`. The real constant already exists in `lib/constants/blueprint.ts` with abbreviation keys (`CV`, `PULM`, etc.) and integer percentage values. All callers use the same key structure, so this is a rename-and-redirect with no data changes.

**Tech Stack:** TypeScript (strict), Vitest, React 19 — no new deps needed.

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `lib/poolSelection.ts` | Delete lines 11–12 (deprecated re-export + JSDoc) |
| Modify | `services/domain/panceDistributionService.ts` | Delete line 11–12; replace 5 internal usages |
| Modify | `services/domain/index.ts` | Remove `PANCE_SYSTEM_PERCENTAGES` from re-exports |
| Modify | `tests/poolSelection.test.ts` | Swap import source + rename in 4 places |
| Modify | `components/quiz/SessionEndSummary.tsx` | Swap import source + rename in 2 places |
| Modify | `components/quiz/SessionStatsOverlay.tsx` | Swap import source + rename in 5 places |
| Leave alone | `services/ai/panceDistributionService.ts` | Uses `NCCPA_2025_BLUEPRINT_PERCENT` (full-name keys) — different data, separate scope |

---

### Task 1: Migrate `tests/poolSelection.test.ts`

This test imports `PANCE_SYSTEM_PERCENTAGES` from `lib/poolSelection`. We change it to import `BLUEPRINT_PERCENT_BY_ABBREVIATION` from `lib/constants/blueprint`. We do tests first because they'll immediately confirm the data structure is identical.

**Files:**
- Modify: `tests/poolSelection.test.ts:1-11`
- Modify: `tests/poolSelection.test.ts:124-135`

- [ ] **Step 1: Read the full test file to understand current state**

```bash
cat -n tests/poolSelection.test.ts
```

- [ ] **Step 2: Update the import on lines 6-10**

Current (lines 6-10):
```typescript
import {
  fisherYatesShuffle,
  selectByPanceDistribution,
  PANCE_SYSTEM_PERCENTAGES,
} from '../lib/poolSelection';
```

Replace with:
```typescript
import {
  fisherYatesShuffle,
  selectByPanceDistribution,
} from '../lib/poolSelection';
import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from '../lib/constants/blueprint';
```

- [ ] **Step 3: Update the describe block at lines 124–135**

Current:
```typescript
describe('PANCE_SYSTEM_PERCENTAGES', () => {
  it('has expected systems', () => {
    expect(PANCE_SYSTEM_PERCENTAGES.CV).toBe(11);
    expect(PANCE_SYSTEM_PERCENTAGES.PULM).toBe(9);
  });

  it('total is close to 100', () => {
    const total = Object.values(PANCE_SYSTEM_PERCENTAGES).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(90);
    expect(total).toBeLessThanOrEqual(110);
  });
});
```

Replace with:
```typescript
describe('BLUEPRINT_PERCENT_BY_ABBREVIATION', () => {
  it('has expected systems', () => {
    expect(BLUEPRINT_PERCENT_BY_ABBREVIATION.CV).toBe(11);
    expect(BLUEPRINT_PERCENT_BY_ABBREVIATION.PULM).toBe(9);
  });

  it('total is close to 100', () => {
    const total = Object.values(BLUEPRINT_PERCENT_BY_ABBREVIATION).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(90);
    expect(total).toBeLessThanOrEqual(110);
  });
});
```

- [ ] **Step 4: Run the updated tests and confirm they pass**

```bash
npx vitest run tests/poolSelection.test.ts
```

Expected: all tests pass (data is identical — `PANCE_SYSTEM_PERCENTAGES` was just `{ ...BLUEPRINT_PERCENT_BY_ABBREVIATION }`)

- [ ] **Step 5: Commit**

```bash
git add tests/poolSelection.test.ts
git commit -m "refactor(tests): migrate poolSelection test to BLUEPRINT_PERCENT_BY_ABBREVIATION"
```

---

### Task 2: Delete the re-export from `lib/poolSelection.ts`

**Files:**
- Modify: `lib/poolSelection.ts:9-12`

- [ ] **Step 1: Read the full poolSelection.ts to confirm import usage**

```bash
cat -n lib/poolSelection.ts
```

Confirm that `BLUEPRINT_PERCENT_BY_ABBREVIATION` (imported on line 9) is still used elsewhere in the file after removing the re-export. It IS used by `selectByPanceDistribution` (the function weights questions by blueprint system). The import stays.

- [ ] **Step 2: Delete lines 11–12 (the JSDoc + deprecated export)**

Current lines 11–12:
```typescript
/** @deprecated Use BLUEPRINT_PERCENT_BY_ABBREVIATION from lib/constants/blueprint.ts */
export const PANCE_SYSTEM_PERCENTAGES: Record<string, number> = { ...BLUEPRINT_PERCENT_BY_ABBREVIATION };
```

After deletion, lines 9–13 should look like:
```typescript
import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from './constants/blueprint';

/**
 * Fisher-Yates shuffle for unbiased randomization
 */
```

- [ ] **Step 3: Run tests to confirm nothing using poolSelection breaks**

```bash
npx vitest run tests/poolSelection.test.ts
```

Expected: all pass (we already updated the test to not import `PANCE_SYSTEM_PERCENTAGES`)

- [ ] **Step 4: Confirm no other files still import PANCE_SYSTEM_PERCENTAGES from poolSelection**

```bash
grep -r "from.*poolSelection" --include="*.ts" --include="*.tsx" -l
```

Expected: only `tests/poolSelection.test.ts` and `functions/api/questions/pool.ts` (pool.ts uses `selectByPanceDistribution` + `fisherYatesShuffle`, not `PANCE_SYSTEM_PERCENTAGES`)

- [ ] **Step 5: Commit**

```bash
git add lib/poolSelection.ts
git commit -m "refactor(constants): remove deprecated PANCE_SYSTEM_PERCENTAGES re-export from poolSelection"
```

---

### Task 3: Remove the re-export from `services/domain/panceDistributionService.ts`

`panceDistributionService.ts` declares its own copy of `PANCE_SYSTEM_PERCENTAGES` and uses it in 5 internal places. We delete the declaration and replace all 5 internal usages with `BLUEPRINT_PERCENT_BY_ABBREVIATION`, which is already imported on line 8.

**Files:**
- Modify: `services/domain/panceDistributionService.ts`

- [ ] **Step 1: Read the full file**

```bash
cat -n services/domain/panceDistributionService.ts
```

- [ ] **Step 2: Delete lines 11–12 (JSDoc + deprecated export declaration)**

Current lines 11–12:
```typescript
/** @deprecated Use BLUEPRINT_PERCENT_BY_ABBREVIATION from lib/constants/blueprint.ts */
export const PANCE_SYSTEM_PERCENTAGES: Record<string, number> = { ...BLUEPRINT_PERCENT_BY_ABBREVIATION };
```

Delete both lines.

- [ ] **Step 3: Replace the 5 internal usages of `PANCE_SYSTEM_PERCENTAGES`**

`BLUEPRINT_PERCENT_BY_ABBREVIATION` is already imported (line 8). Replace:

**In `createFreshState()` (was line 64):**
```typescript
// Before:
const systems = Object.keys(PANCE_SYSTEM_PERCENTAGES);
// After:
const systems = Object.keys(BLUEPRINT_PERCENT_BY_ABBREVIATION);
```

**In `normalizeSystemCode()` (was lines 110 and 119):**
```typescript
// Before (line 110):
if (PANCE_SYSTEM_PERCENTAGES[system]) {
// After:
if (BLUEPRINT_PERCENT_BY_ABBREVIATION[system]) {

// Before (line 119):
if (code && PANCE_SYSTEM_PERCENTAGES[code]) {
// After:
if (code && BLUEPRINT_PERCENT_BY_ABBREVIATION[code]) {
```

**In `calculateDistributionDrift()` (was line 178):**
```typescript
// Before:
for (const [system, targetPercent] of Object.entries(PANCE_SYSTEM_PERCENTAGES)) {
// After:
for (const [system, targetPercent] of Object.entries(BLUEPRINT_PERCENT_BY_ABBREVIATION)) {
```

**In `getSessionSummary()` (was line 250):**
```typescript
// Before:
target: PANCE_SYSTEM_PERCENTAGES[system] || 0,
// After:
target: BLUEPRINT_PERCENT_BY_ABBREVIATION[system] || 0,
```

- [ ] **Step 4: Run TypeScript check on the file**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep panceDistributionService
```

Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add services/domain/panceDistributionService.ts
git commit -m "refactor(constants): replace internal PANCE_SYSTEM_PERCENTAGES with BLUEPRINT_PERCENT_BY_ABBREVIATION"
```

---

### Task 4: Remove `PANCE_SYSTEM_PERCENTAGES` from `services/domain/index.ts`

The barrel export file re-exports `PANCE_SYSTEM_PERCENTAGES` from `panceDistributionService`. Now that the declaration is deleted, this line will cause a TypeScript error. We remove the re-export and add `BLUEPRINT_PERCENT_BY_ABBREVIATION` so callers can still get what they need from `@/services/domain` if desired.

**Files:**
- Modify: `services/domain/index.ts:36-44`

- [ ] **Step 1: Read lines 36–50**

```bash
sed -n '36,50p' services/domain/index.ts
```

Current block (lines 37–44):
```typescript
export {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
  recordQuestion,
  normalizeSystemCode,
  PANCE_SYSTEM_PERCENTAGES,
} from './panceDistributionService';
```

- [ ] **Step 2: Remove `PANCE_SYSTEM_PERCENTAGES` from the re-export block**

Replace with:
```typescript
export {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
  recordQuestion,
  normalizeSystemCode,
} from './panceDistributionService';
export { BLUEPRINT_PERCENT_BY_ABBREVIATION } from '@/lib/constants/blueprint';
```

- [ ] **Step 3: Run TypeScript check**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep -E "domain/index|PANCE_SYSTEM"
```

Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add services/domain/index.ts
git commit -m "refactor(constants): remove PANCE_SYSTEM_PERCENTAGES from domain barrel; export BLUEPRINT_PERCENT_BY_ABBREVIATION"
```

---

### Task 5: Migrate `components/quiz/SessionEndSummary.tsx`

Imports `PANCE_SYSTEM_PERCENTAGES` from `@/services/domain`. After Task 4, that export no longer exists. Replace with a direct import from `@/lib/constants/blueprint`.

**Files:**
- Modify: `components/quiz/SessionEndSummary.tsx`

- [ ] **Step 1: Read lines 31–45 and line 331 to identify exact import block and usage**

```bash
sed -n '31,45p' components/quiz/SessionEndSummary.tsx
sed -n '328,335p' components/quiz/SessionEndSummary.tsx
```

- [ ] **Step 2: Remove `PANCE_SYSTEM_PERCENTAGES` from the `@/services/domain` import**

Current (lines 32–37):
```typescript
import {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
  PANCE_SYSTEM_PERCENTAGES,
} from '@/services/domain';
```

Replace with:
```typescript
import {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
} from '@/services/domain';
import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from '@/lib/constants/blueprint';
```

- [ ] **Step 3: Replace usage at line ~331**

```typescript
// Before:
targetPercent: PANCE_SYSTEM_PERCENTAGES[system] || 0,
// After:
targetPercent: BLUEPRINT_PERCENT_BY_ABBREVIATION[system] || 0,
```

- [ ] **Step 4: Run TypeScript check on this component**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep SessionEndSummary
```

Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add components/quiz/SessionEndSummary.tsx
git commit -m "refactor(constants): migrate SessionEndSummary to BLUEPRINT_PERCENT_BY_ABBREVIATION"
```

---

### Task 6: Migrate `components/quiz/SessionStatsOverlay.tsx`

Same pattern as Task 5 — imports from `@/services/domain`, 5 usages.

**Files:**
- Modify: `components/quiz/SessionStatsOverlay.tsx`

- [ ] **Step 1: Read lines 22–27 and lines 85–135**

```bash
sed -n '22,27p' components/quiz/SessionStatsOverlay.tsx
sed -n '85,140p' components/quiz/SessionStatsOverlay.tsx
```

- [ ] **Step 2: Remove `PANCE_SYSTEM_PERCENTAGES` from the `@/services/domain` import**

Current (lines 22–26):
```typescript
import {
  getSessionSummary,
  normalizeSystemCode,
  PANCE_SYSTEM_PERCENTAGES,
} from '@/services/domain';
```

Replace with:
```typescript
import {
  getSessionSummary,
  normalizeSystemCode,
} from '@/services/domain';
import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from '@/lib/constants/blueprint';
```

- [ ] **Step 3: Replace the 5 usages**

```typescript
// Line ~89:
// Before: Object.keys(PANCE_SYSTEM_PERCENTAGES).forEach(...)
// After:  Object.keys(BLUEPRINT_PERCENT_BY_ABBREVIATION).forEach(...)

// Line ~105:
// Before: const target = PANCE_SYSTEM_PERCENTAGES[system] || 0;
// After:  const target = BLUEPRINT_PERCENT_BY_ABBREVIATION[system] || 0;

// Line ~125:
// Before: const allSystems = Object.keys(PANCE_SYSTEM_PERCENTAGES);
// After:  const allSystems = Object.keys(BLUEPRINT_PERCENT_BY_ABBREVIATION);

// Line ~133:
// Before: const targetPercent = PANCE_SYSTEM_PERCENTAGES[system] || 0;
// After:  const targetPercent = BLUEPRINT_PERCENT_BY_ABBREVIATION[system] || 0;
```

(There are 4 usages visible in grep output for this file despite HYGIENE-TODO saying 5. Confirm the count by reading the file first in Step 1.)

- [ ] **Step 4: Run TypeScript check**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep SessionStatsOverlay
```

Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add components/quiz/SessionStatsOverlay.tsx
git commit -m "refactor(constants): migrate SessionStatsOverlay to BLUEPRINT_PERCENT_BY_ABBREVIATION"
```

---

### Task 7: Full verification

- [ ] **Step 1: Confirm `PANCE_SYSTEM_PERCENTAGES` is fully eliminated from in-scope files**

```bash
grep -r "PANCE_SYSTEM_PERCENTAGES" \
  lib/poolSelection.ts \
  services/domain/panceDistributionService.ts \
  services/domain/index.ts \
  tests/poolSelection.test.ts \
  components/quiz/SessionEndSummary.tsx \
  components/quiz/SessionStatsOverlay.tsx
```

Expected: zero matches

- [ ] **Step 2: Confirm remaining uses of `PANCE_SYSTEM_PERCENTAGES` in repo (out-of-scope callers)**

```bash
grep -r "PANCE_SYSTEM_PERCENTAGES" --include="*.ts" --include="*.tsx" .
```

Expected remaining matches (out-of-scope, separate plan):
- `services/ai/panceDistributionService.ts` — uses full-name keys (`NCCPA_2025_BLUEPRINT_PERCENT`), not abbreviations
- `services/ai/enhancedQuestionService.ts` — imports from the ai version

These are NOT bugs; they use a different underlying constant for a different purpose. Document in HYGIENE-TODO.md.

- [ ] **Step 3: Full typecheck**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

Expected: zero new errors (pre-existing errors, if any, must not increase)

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests that were passing before still pass (at minimum `tests/poolSelection.test.ts`)

- [ ] **Step 5: Update HYGIENE-TODO.md**

Mark Tier 3a as complete in `HYGIENE-TODO.md`:

```markdown
- Tier 3a — DONE. Commit `<hash>` refactor(constants): remove PANCE_SYSTEM_PERCENTAGES deprecated re-export.
  Note: services/ai/panceDistributionService.ts retains its own PANCE_SYSTEM_PERCENTAGES (full-name keys from NCCPA_2025_BLUEPRINT_PERCENT) — separate scope.
```

- [ ] **Step 6: Final commit**

```bash
git add HYGIENE-TODO.md
git commit -m "chore(hygiene): mark Tier 3a complete — PANCE_SYSTEM_PERCENTAGES migration"
```
