# Cursor Follow-up Issues

Actionable follow-ups discovered during the 2026-07-09 root-cause stabilization run. Grouped by gate.

## A. Safe (no approval) — recommended next PRs

1. **Full-strict typecheck debt (~1,151 error lines).** `npm run typecheck:all` fails, concentrated in
   `services/optimizer/*`, `services/imageOptimizationService.ts`, `functions/api/admin/refinery/action.ts`.
   Not CI-gating today. Fix cluster-by-cluster in dedicated PRs; do not weaken tsconfig.
2. **PatientEncounterMode decomposition — next leaves.** Continue after `EncounterLogSidebar`: extract the
   encounter header/status bar and the phase-progress stepper (both low-coupling). See §C for the
   phase-panel work that needs a context refactor first.
3. **Loading-state advisory tail.** `audit:loading` lists ~30+ components with `Loading…`/content spinners
   that "could use skeletons for CLS." Do as a dedicated, one-cluster-per-PR sweep with browser evidence.
4. **Characterization tests for `drillReviewService`** (prep for atomic-write work) — assert the current
   write set/order before any transaction refactor.
5. **Unauthenticated smoke in CI** — wire `e2e/api-health.spec.ts` + `csp-console.spec.ts` (no creds
   needed) as a fast pre-deploy gate.
6. **Embedding version consolidation (read-only prep)** — add `EMBEDDING_MODEL`/`EMBEDDING_DIM` constant
   module + a read-only drift-count query.

## B. Approval-gated (Ask First) — decisions needed from Aaron

1. **Remove dead Express backend** — delete `server.ts` + `dev:server`/`dev:all`/`build:server` scripts
   (already broken: `./routes` is gone). Update `CLAUDE.md`/`LOCAL_DEVELOPMENT.md` to `dev` + `dev:wrangler`.
   (`docs/express-to-edge-retirement-map.md`)
2. **Push reminders go-live** — apply the drafted `NotificationLog` migration, choose a scheduler owner,
   optionally add `web-push`. (`docs/push-reminder-runtime-plan.md`)
3. **Legacy SRS retirement** — product decision on flashcard→FSRS; then narrow `srs/submit`, backfill +
   drop `SRSItem`. (`docs/fsrs-legacy-retirement-plan.md`)
4. **Study groups / social** — build `functions/api/social/*` or freeze/delete the scaffold.
   (`docs/hidden-and-placeholder-feature-inventory.md`)
5. **Library-enrichment `.disabled` admin endpoints** — data-source decision, then re-enable or delete.
6. **Atomic review writes** — wrap the invariant core in a transaction (core FSRS path).
   (`docs/atomic-review-write-plan.md`)
7. **Source/concept identity migration** — canonical spine + additive FKs + backfill on a copy.
   (`docs/source-identity-migration-proposal.md`)
8. **Runtime smoke auth** — provision a Clerk test user / test env for authenticated E2E.
   (`docs/runtime-smoke-test-plan.md`)
9. **Embedding backfill** — bulk re-embedding is a **paid AI batch** → STOP AND ASK.
   (`docs/embedding-versioning-plan.md`)
10. **`OSCEResultsView.tsx` deletion** — now unused (its dead render branch was removed); delete once
    confirmed no dynamic import references it.

## C. Design prerequisite

- **EncounterContext for PatientEncounterMode.** The active-view phase panels (history/physical/
  diagnostic/diagnosis/treatment, ~930 lines) cannot be cleanly extracted without prop-drilling ~50
  values. Introduce a context that exposes the `useEncounterReducer` state + actions so sub-panels
  consume directly. This unblocks the remaining decomposition. (See `docs/agent-memory/do-not-repeat.md`.)
