# Tier 3b: Delete Orphaned sessionInterleaving + enhancedQuestionPool

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete two dead files — `lib/sessionInterleaving.ts` and `services/core/enhancedQuestionPool.ts` — whose only consumer (`services/core/questionService.ts`) has had its import commented out. Also delete `scripts/demo-question-sprint-b.ts` which imports from `sessionInterleaving` and has no production usage.

**Architecture:** The deletion chain is bottom-up. `questionService.ts` disabled its import of `enhancedQuestionPool` (lines 63–68 are commented out with a note "DISABLED: Server-only module with @prisma/client"). `enhancedQuestionPool` is the only non-demo caller of `sessionInterleaving`. The new interleaver lives in `lib/services/mainSessionQuestionSelector.ts` and is already in use — `sessionInterleaving` was explicitly deprecated in its own file header ("Use MainSessionQuestionSelector instead"). Deleting these three files removes ~500 lines of dead code with zero functional impact.

**Tech Stack:** TypeScript (strict), Vitest — no new deps, only `git rm` and test runs.

---

## Pre-flight: Verify callsites before any deletion

Do NOT skip this task. The analysis was done on 2026-04-18; the repo moves fast.

### Task 0: Confirm there are no live callers

**Files:**
- Read: `services/core/questionService.ts` (lines 60–70)
- Read: `scripts/demo-question-sprint-b.ts` (first 50 lines)

- [ ] **Step 1: Confirm `enhancedQuestionPool` has no live callers**

```bash
grep -r "enhancedQuestionPool\|getEnhancedQuestionBatch\|getEnhancedPoolStatus" \
  --include="*.ts" --include="*.tsx" .
```

Expected output (exactly these lines, no others):
```
services/core/questionService.ts:63:// DISABLED: Server-only module with @prisma/client - use dynamic imports
services/core/questionService.ts:64:// export {
services/core/questionService.ts:65://   getEnhancedQuestionBatch,
services/core/questionService.ts:66://   getEnhancedQuestion as getEnhancedQuestionV2,
services/core/questionService.ts:67://   getEnhancedPoolStatus,
services/core/questionService.ts:68:// } from './enhancedQuestionPool';
services/core/enhancedQuestionPool.ts:36:export async function getEnhancedQuestionBatch(
services/core/enhancedQuestionPool.ts:74:export async function getEnhancedQuestion(
services/core/enhancedQuestionPool.ts:137:export async function getEnhancedPoolStatus(
```

If ANY other live import appears (uncommented), STOP and reassess. Do not delete.

- [ ] **Step 2: Confirm `sessionInterleaving` callers**

```bash
grep -r "from.*sessionInterleaving\|sessionInterleaving" \
  --include="*.ts" --include="*.tsx" .
```

Expected callers:
```
services/core/enhancedQuestionPool.ts:28:import { ensureInterleaving, validateInterleaving } from '../../lib/sessionInterleaving';
scripts/demo-question-sprint-b.ts:35:} from '../lib/sessionInterleaving';
lib/sessionInterleaving.ts: (self, the source file)
```

If `lib/nccpa-blueprint.ts` appears — that file defines its OWN `validateInterleaving` and does NOT import from `lib/sessionInterleaving.ts`. Confirm by checking:
```bash
grep -n "sessionInterleaving\|from.*interleaving" lib/nccpa-blueprint.ts
```
Expected: zero matches.

- [ ] **Step 3: Confirm the demo script is non-production**

```bash
head -20 scripts/demo-question-sprint-b.ts
```

Expected: file opens with a comment indicating it's a demo/test script and is not imported or called anywhere in production code. Also confirm:

```bash
grep -r "demo-question-sprint-b\|sprint-b" --include="*.ts" --include="*.tsx" --include="*.json" .
```

Expected: zero matches outside the script itself (not in package.json scripts, not imported by any other file).

- [ ] **Step 4: Confirm `mainSessionQuestionSelector.ts` is the active replacement**

```bash
grep -rn "mainSessionQuestionSelector\|MainSessionQuestionSelector" \
  --include="*.ts" --include="*.tsx" . | head -20
```

Expected: multiple callers confirming it's the live implementation, not zero.

---

### Task 1: Delete `scripts/demo-question-sprint-b.ts`

Delete the demo script first (it imports from sessionInterleaving — deleting it eliminates that caller, simplifying the remaining graph).

**Files:**
- Delete: `scripts/demo-question-sprint-b.ts`

- [ ] **Step 1: Read the file to confirm no hidden production logic**

```bash
cat -n scripts/demo-question-sprint-b.ts
```

Confirm: it is a self-contained demo/benchmark script with no side effects imported elsewhere.

- [ ] **Step 2: Delete the file**

```bash
git rm scripts/demo-question-sprint-b.ts
```

Expected: `rm 'scripts/demo-question-sprint-b.ts'`

- [ ] **Step 3: Run tests to confirm nothing breaks**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: same pass/fail counts as before this task.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(hygiene): delete demo-question-sprint-b.ts (orphaned sprint demo)"
```

---

### Task 2: Delete `services/core/enhancedQuestionPool.ts`

The import from `questionService.ts` was explicitly commented out. No live callers remain after Task 1.

**Files:**
- Delete: `services/core/enhancedQuestionPool.ts`

- [ ] **Step 1: Re-confirm no live callers (quick sanity check)**

```bash
grep -r "enhancedQuestionPool" --include="*.ts" --include="*.tsx" . | grep -v "^services/core/enhancedQuestionPool"
```

Expected: only the commented-out lines in `services/core/questionService.ts`. If an uncommented import appears, STOP.

- [ ] **Step 2: Delete the file**

```bash
git rm services/core/enhancedQuestionPool.ts
```

Expected: `rm 'services/core/enhancedQuestionPool.ts'`

- [ ] **Step 3: Run TypeScript check**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep -i "enhancedQuestionPool\|cannot find module"
```

Expected: zero errors related to the deleted file. (The commented-out import in questionService.ts does not generate TS errors because it's inside a comment block.)

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: same pass/fail as before Task 2.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(hygiene): delete enhancedQuestionPool.ts (disabled Sprint A/B integration)"
```

---

### Task 3: Delete `lib/sessionInterleaving.ts`

Now that both callers (`enhancedQuestionPool` and the demo script) are gone, `sessionInterleaving` has zero callers and can be safely deleted.

**Files:**
- Delete: `lib/sessionInterleaving.ts`

- [ ] **Step 1: Final caller check**

```bash
grep -r "sessionInterleaving" --include="*.ts" --include="*.tsx" .
```

Expected: zero matches (both callers deleted in Tasks 1 and 2).

If any match appears, STOP and investigate before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm lib/sessionInterleaving.ts
```

Expected: `rm 'lib/sessionInterleaving.ts'`

- [ ] **Step 3: TypeScript check**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors. Any pre-existing errors should be unchanged.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests that were passing before this plan still pass. The deleted files had no test coverage (they were dead code).

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(hygiene): delete sessionInterleaving.ts (deprecated, replaced by mainSessionQuestionSelector)"
```

---

### Task 4: Clean up the commented-out block in `services/core/questionService.ts`

The comment block on lines 62–68 was the "breadcrumb" explaining why `enhancedQuestionPool` was disabled. Now that the file is deleted, the comment is misleading. Remove it.

**Files:**
- Modify: `services/core/questionService.ts:60-70`

- [ ] **Step 1: Read lines 58–72**

```bash
sed -n '58,72p' services/core/questionService.ts
```

Current content (lines 62–68):
```typescript
// Enhanced question pool (Sprint A & B integration)
// DISABLED: Server-only module with @prisma/client - use dynamic imports
// export {
//   getEnhancedQuestionBatch,
//   getEnhancedQuestion as getEnhancedQuestionV2,
//   getEnhancedPoolStatus,
// } from './enhancedQuestionPool';
```

- [ ] **Step 2: Delete the 7-line commented block**

Delete lines 62–68 entirely (the full commented-out export block and its header comment).

After deletion, verify the surrounding context still reads cleanly:
```bash
sed -n '58,68p' services/core/questionService.ts
```

- [ ] **Step 3: TypeScript check**

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep questionService
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add services/core/questionService.ts
git commit -m "chore(hygiene): remove commented-out enhancedQuestionPool import from questionService"
```

---

### Task 5: Update HYGIENE-TODO.md and final verification

- [ ] **Step 1: Verify all three files are gone**

```bash
ls lib/sessionInterleaving.ts services/core/enhancedQuestionPool.ts scripts/demo-question-sprint-b.ts 2>&1
```

Expected: `No such file or directory` for all three.

- [ ] **Step 2: Confirm zero sessionInterleaving or enhancedQuestionPool references remain**

```bash
grep -r "sessionInterleaving\|enhancedQuestionPool" --include="*.ts" --include="*.tsx" .
```

Expected: zero matches.

- [ ] **Step 3: Final test run**

```bash
npm test
```

Expected: same test counts as before this plan. No new failures.

- [ ] **Step 4: Update HYGIENE-TODO.md**

Add to the "Status" section at the top:
```markdown
- Tier 3b — DONE. Commits on `<branch>` — deleted sessionInterleaving.ts, enhancedQuestionPool.ts, demo-question-sprint-b.ts.
```

- [ ] **Step 5: Commit**

```bash
git add HYGIENE-TODO.md
git commit -m "chore(hygiene): mark Tier 3b complete — dead code deletion"
```
