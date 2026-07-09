# Do Not Repeat

> Canonical (tracked) location: `docs/agent-memory/`. `.cursor/memory/` is gitignored
> (`.gitignore:227`), so durable agent memory is persisted here instead.

Specific actions proven wrong. Each: date · context · lesson · evidence · where · lifetime.

## Do NOT re-attempt a monolithic `EncounterActiveView` extraction
- **Date:** 2026-07-09
- **Context:** the active-encounter view (`viewState === 'active'` block in `PatientEncounterMode.tsx`,
  ~930 lines) is tightly coupled to ~50 reducer state fields, setters, and ~18 handlers.
- **Lesson:** A one-shot `<EncounterActiveView>` requires ~55 props (prop-drilling anti-pattern) and was
  already created + reverted once. **Instead:** (a) extract self-contained *read-only* leaves (done:
  `EncounterLogSidebar`), and/or (b) introduce an EncounterContext that lets sub-panels consume the
  reducer state/actions directly, THEN extract phase panels. Never re-create the 55-prop component.
- **Evidence:** `8b270979` (add 1,267-line wip) → `2af22271` (chore: clean up decomposition intermediates).
- **Where:** `components/modes/PatientEncounterMode.tsx`.
- **Lifetime:** permanent (until an EncounterContext exists).

## Do NOT reopen these as live work (already fixed / stale)
- **Date:** 2026-07-09
- **Lesson / evidence:**
  - OSCE `queueAnswer({ questionId: sessionId })` — removed (TASK-001).
  - "145 endpoints fail Zod" — audit-script bug; `audit:zod` = 0 FAIL.
  - "18 Prisma-disconnect fails" — false positives; `audit:prisma` all pass.
  - "NotificationLog does not exist" — model + RLS migration + write path all present.
  - "routes/ Express split-brain" — `routes/` already retired to `_trash/`; `server.ts` is a broken
    orphan (recommend removal, Ask-First).
  - `functions/api/questions/review.ts` — already a 410 tombstone.
- **Where:** audit-driven backlog grooming.
- **Lifetime:** permanent.

## Do NOT do broad loading/skeleton or design-token sweeps in a stabilization run
- **Date:** 2026-07-09
- **Lesson:** loading-state normalization is ~done (72 migrations, TASK-012…021); the remaining
  `audit:loading` advisory list is a broad, design-sensitive sweep. 251 raw-hex lint *warnings* are
  pre-existing debt within the `--max-warnings 2000` budget. Broad conversion without browser QA risks
  visual regressions and is out of scope. Convert only obvious leaf-level tokens on surfaces you already
  touch, with browser evidence.
- **Where:** `components/**`, `index.css`, `lib/tokens/`.
- **Lifetime:** permanent guidance for stabilization-type runs.
