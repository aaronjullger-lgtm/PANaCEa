# .autoclaw/next-actions.md — Priority Queue

## Immediate (this session)
1. [x] Run full repo discovery pass — file counts, test health, build status
2. [x] Identify any failing tests, broken routes, disconnected UI — 0 failures
3. [x] Verify build passes clean: `npm run build` ✅
4. [x] Verify typecheck: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` ✅

## High Priority
1. [ ] Complete learning pipeline verification — study session flow end-to-end
2. [ ] Verify FSRS pipeline — implicit rating → scheduling → persistence
3. [ ] QuizView refactor — parked on `wip/quizview-refactor-parked` (192 TS errors) — **needs Aaron decision**
4. [ ] Drill routing consolidation — DrillShell vs. useDrillFSRS split — **needs Aaron decision**

## Medium Priority
1. [ ] CSS variable migration — 238 hardcoded hex → CSS vars
2. [ ] Inline styles → Tailwind — 1063 inline styles to migrate
3. [ ] PatientEncounterMode decomposition — 3488 lines
4. [ ] Pending Prisma migrations — 4+ migrations awaiting approval

## Ongoing
- [ ] Create local skills for recurring PANaCEa workflows
- [ ] Track build failures and type errors in error-log.md
- [ ] Document architecture decisions in decision-log.md
- [ ] Profile test coverage gaps in test-log.md
