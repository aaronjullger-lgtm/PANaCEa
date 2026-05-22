# Updated PANaCEa Production Readiness Scorecard

Status: integration scorecard refreshed 2026-05-05 12:03 EDT.

Overall updated grade: **85/100, B/no-launch**.

The numeric score has improved from the initial production audit, but the launch decision remains **no-launch** while P0 identity/migration and runtime smoke gates remain open.

## Integration Pass Addendum

The current integration pass resolved several small P1 seams without changing the no-launch decision:

- Admin AI routes now use the fail-closed AI gateway tier before the broader admin tier.
- Legacy `/api/srs/submit` forwards `attemptId` as the canonical review idempotency key.
- `syncManager.syncAll()` is now the awaitable drain for in-flight review writes before session summary/plan completion.
- Enhanced generated questions held for review are not surfaced as usable session questions.
- `/api/library/answer` no longer returns raw unexpected backend error messages.
- `verify:health` now targets the Wrangler Playwright config, and missing package scripts were removed.

| Category | Previous Grade | Updated Grade | Trend | Evidence | Main Blockers | Next Action |
|---|---:|---:|---|---|---|---|
| Backend/API | 78 | 87 | Up | Health split, AI limiter fail-closed including admin AI paths, SRS compatibility safer, generation/admin routes hardened, question context endpoint now uses production lifecycle filters/internal user IDs, explain-rag uses the shared AI gateway, structured condition cards use gateway extraction, library answers use gateway text generation with generic public errors, and admin condition enrichment uses gateway structured output | No live runtime smoke; approval/mirror writes still need transactionality; other direct AI call sites and direct embedding calls remain | Keep endpoint regressions green and continue direct-AI-call census |
| Database/data integrity | 70 | 73 | Up | Mirror helpers, identity probes, staging provenance, UserProgress guard | No canonical source identity or concept identity migration/backfill | Run DB probe and design migration |
| Medical knowledge base | 60 | 66 | Up | Broader schema, safety gates, structured condition-card extraction now uses gateway schema validation, library answer generation now routes through gateway with reference fallback, admin enrichment writes only validated/requested fields, and active library/RAG search embeddings now share `getEmbedding` | Provenance, seed completeness, entity linkage, embedding backfill/versioning still separate | Add provenance/seed validation and embedding versioning review separately |
| Question generation | 62 | 81 | Up | Primary and RAG generation now fail closed when new generated questions cannot be staged and share one preview/staging helper; deep-context output is explicitly admin-preview-only; enhanced approved rows can persist live only after staging provenance is written; admin enrichment validates structured output through the shared gateway before writes | Full canonical generated-question schema/prompt adapter still open; batch/refill conservative; remaining direct vision/image routes | Continue generated-question schema consolidation and direct-call cleanup |
| Explanation generation | 68 | 77 | Up | `explain-rag.ts` now uses `gateway.callStructured`, validates the explanation schema, skips stale fallback cache entries, and fails closed on gateway/no-context failure | No persisted canonical `ExplanationV1` contract and other explanation surfaces remain uneven | Add consumer unavailable-state handling and canonical explanation persistence later |
| Study sessions | 73 | 81 | Up | CoreAdaptiveSession launch settings, session ID propagation, approved-pool serving | Untyped historical question IDs | Continue source identity migration plan |
| Study modes | 62 | 66 | Up | Mode readiness gates and real `system_drill` slice | Most modes deferred/incomplete | Keep hidden; enable one mode at a time with proof |
| Attempt/scoring pipeline | 70 | 81 | Up | Correctness resolution, idempotency, PGQ mirror, stats-only attempt endpoint, direct context/attempt/record reads now have lifecycle guards | Source identity migration | Keep direct lookup regressions and design source identity migration |
| Progress/weakness tracking | 70 | 75 | Up | UserProgress condition guard, ReviewLog session IDs | Concept identity migration; weakness tagging still partial | Continue guarded writes and migration design |
| FSRS/review scheduling | 70 | 81 | Up | `drillReviewService` ownership, SRS submit delegation with legacy idempotency key forwarding, sync drain awaiting before session summary, due/next safer | SRS shells/schema remain; runtime proof absent; durable writes are not yet atomic | Keep compatibility and add smoke |
| Study plan generation | 72 | 80 | Up | Accepted-plan preservation, launch/completion linkage, and single-system current-plan tasks now route as system-scoped sessions | Full V2 task contract split | Continue consolidation |
| Dashboard analytics | 76 | 82 | Up | Adaptive registry and truthful review coverage | Upstream data identity truth | Add more dashboard data-source tests |
| Frontend UI/UX | 73 | 78 | Up | Adaptive dashboard, hidden deferred modes | Session accessibility and design-token warnings | Separate UI hardening slice |
| Auth/security | 75 | 82 | Up | Todoist linking removed, health diagnostics protected, audit clean | Runtime/RLS smoke and route inventory | Add authenticated smoke gates |
| Testing/QA | 80 | 86 | Up | Full Vitest reported passing previously; focused integration proofs added for gateway tiering, SRS compatibility, sync drain, enhanced-generation review hold, and library answer | Browser/live smoke missing | Add route smoke when credentials exist |
| Deployment readiness | 63 | 68 | Up | Local build and health route stronger | Scheduler ownership, deploy gates, runtime smoke | Document release gates; no prod deploy |
| Performance/scalability | 66 | 71 | Up | DB-side aggregation, lazy route mounting, reservoir cleanup, and active library/RAG embedding calls now share one helper boundary for timing/error behavior | Worker/refill policy and live p95 unproven | Add runtime measurement later |
| Deprecated code cleanup | 72 | 78 | Up | Legacy dashboard/palette/Todoist removed, SRS helper deleted | Compatibility shells and stale docs remain | Conservative import-census cleanup |
