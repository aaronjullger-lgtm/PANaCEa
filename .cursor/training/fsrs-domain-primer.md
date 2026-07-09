# FSRS Domain Primer (safety-critical)

PANaCEa's core differentiator is a **fully implicit** FSRS spaced-repetition system. Changes here are high-risk. Authoritative code: `lib/fsrs.ts`, `lib/services/drillReviewService.ts`, `lib/implicit-metrics.ts`; see `CLAUDE.md` for the full pipeline.

## Non-negotiables
- **Binary implicit rating only:** Again (0) / Good (1). **Never** introduce Hard/Easy or any user-facing self-rating button.
- Rating is derived from behavioral telemetry (time-to-first-click, dwell, switches, correctness), not asked.
- Rapid-guess filter (MVRT thresholds) skips FSRS updates for too-fast answers.
- Only **`MAIN`** and **`DRILL`** session types trigger FSRS updates (not Cram/rapid_recall).
- SRS review **writes are owned by `drillReviewService.ts`**; legacy `/api/srs/*` are compatibility adapters only — don't add new write paths there.
- New drills submit via the `useDrillFSRS` hook → `submit-review` endpoint.

## When working here
- Read the `// Step N` / `// Wave N` comments in `drillReviewService.ts` — if docs and code disagree, the code wins.
- FSRS math is floating-point; tests must tolerate precision. There's a large existing test suite (`npm run test:critical`) — do not break it.

## Approval required
- Any change to rating logic, scheduling parameters, or the single-writer invariant → human approval. Treat as `security-agent`/human-gated.
