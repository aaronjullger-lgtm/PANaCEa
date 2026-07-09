# Validation History (durable, append-only-ish)

Snapshots of verification runs so agents know the baseline (what passes, what's pre-existing). Keep recent + notable entries; prune old duplicates. No huge logs. Format: `| date | command | result | notes |`.

| Date | Command | Result | Notes |
|------|---------|--------|-------|
| 2026-07-09 | `npm test` | ✅ 527 files, 9849 passed (1 skipped) | ~140s baseline |
| 2026-07-09 | `npm run test:critical` | ✅ 143 passed | fast FSRS/core subset |
| 2026-07-09 | `npm run build` | ✅ pass | Vite prod build ~18s |
| 2026-07-09 | `npm run typecheck` | ❌ 2 errors | **pre-existing**, both in `lib/study/renderStructuredRationale.ts` |
| 2026-07-09 | `npm run lint` | ❌ 3 errors + 251 warnings | **pre-existing** `no-empty` errors; warnings under 2000 gate |
| 2026-07-09 | orchestration PR full suite | ✅/❌ baseline unchanged | test 527/9849 ✅, test:critical 143 ✅, build ✅; typecheck 2 + lint 3 **pre-existing** only (no new failures introduced by the agent-config PR) |

Baseline rule: the typecheck (2) and lint (3) failures above are **pre-existing on `main`**. A change is "clean" if it does not increase these counts. Always distinguish pre-existing vs introduced in final reports.
