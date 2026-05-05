# Backend Deprecated Code Audit

Audit date: 2026-05-01

| Item | Evidence | Used | Risk | Action |
|---|---|---:|---|---|
| Deprecated Gemini proxy | `functions/geminiProxy.ts` | Maybe old clients | P2 | Keep one release window, then delete after grep. |
| Cache warmer scheduler | `functions/cache-warmer.ts` | Not scheduler authority | P1 | Archive/delete or move outside runnable functions. |
| Local Express backend | `server.ts`, `routes/*`, `package.json` `dev:server` | Dev only | P1 | Guard clearly; avoid production confusion. |
| Express question fallback | `routes/questions.ts` placeholder generation | Local only | P1 | Disable/delete fallback; production generator fails closed. |
| Express SRSItem sync | `routes/sync.ts` | Local only | P1 | Point dev to canonical Edge sync. |
| `.deprecated` SRS functions | `functions/api/srs/index.ts.deprecated`, `stats.ts.deprecated` | Not served | P2 | Move out of `functions/api` or delete after archive. |
| Deprecated scheduler call | `scheduleConceptReview` from `profile-crud.ts` called by submit routes | Live | P1 | Remove or prove intentionally separate from FSRS. |
| Legacy SRS submit adapter | `functions/api/srs/submit.ts` | Live compat | P2 | Keep temporarily; add idempotency/sunset. |
| Legacy `SRSItem` model | `prisma/schema.prisma` | Schema compat | P2 | Freeze writes, migrate reads, later drop. |
| Deprecated Condition endpoint | `functions/api/conditions/[identifier]/extended.ts` | Live | P1 | Migrate to `MedicalContent` adapter. |
| Stale flag route consumer | `components/questions/FlagFeedbackNotification.tsx` calls `/api/user/flags` | Unknown | P1 | Switch to canonical question flag route or remove. |
| Spark placeholder success | `functions/api/spark/instant-calc.ts` | Live | P1 | Return 501/degraded until implemented. |
| Smart Scribe fake success | `functions/api/smart-scribe/generate-infographic.ts` | Live | P1 | Return explicit degraded state; do not mark fake artifact successful. |
| Study group non-persistence | `services/domain/studyGroupService.ts` | Unknown | P2/P1 | Hide feature or wire real persistence. |
| Mock peer benchmarks | `services/domain/realTimeCollaborationService.ts` | Unknown | P2 | Keep out of production dashboards. |
| Deprecated scripts | `scripts/deprecated/*` | Historical | P3 | Keep archived and excluded from automated scripts. |

Second pass status: **confirmed** as overlapping with prior `DEPRECATED_CODE_AND_CONFLICTS_AUDIT.md`; this file supersedes it for backend production-readiness work.
