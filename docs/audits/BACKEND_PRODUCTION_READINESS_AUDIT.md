# Backend Production Readiness Audit

Audit date: 2026-05-01

## Executive Summary

Current backend grade: **C / 72**. PANaCEa has a real production backend foundation: Cloudflare Pages Functions, Clerk auth, Zod validation on key routes, Prisma Edge + Accelerate, rate limiting, unified response helpers, durable idempotency on drill review submission, and substantial tests. It is not launch-safe across the full learning pipeline because user identity handling, API contracts, FSRS write atomicity, study-plan backends, AI generation contracts, deprecated/mock paths, and frontend/backend route alignment are inconsistent.

No confirmed P0 unauthenticated write path was found. One functional P0 was confirmed: `functions/api/user/goals.ts` used Clerk IDs where `UserGoal.userId` requires internal `User.id`, and the frontend calls a missing `functions/api/user/goals/[goalId].ts` route. That slice was implemented in this pass.

## Backend Map

- Runtime: React + Vite frontend with Cloudflare Pages Functions under `functions/api`.
- Local-only backend: `server.ts` and `routes/*`; documented as local development only but still easy to confuse with production.
- Auth: Clerk JWT verification in `functions/api/_shared/auth.ts`; endpoint stacks in `functions/api/_shared/middleware.ts`.
- API response standard: `functions/api/_shared/api-response.ts` defines `{ ok, success, data/error, traceId, timestamp }` with legacy nested-envelope normalization in `envelopeFromHandlerResult()`; see `docs/api/API_OVERVIEW.md`. Adoption across all raw/unwrapped endpoints is still incomplete.
- Database: Prisma schema at `prisma/schema.prisma`; Edge client at `functions/api/_shared/prisma-edge.ts`; migrations under `prisma/migrations`.
- AI: central gateway in `lib/ai/aiGateway.ts`; several older direct Gemini/text JSON paths remain.
- Core pipeline: `functions/api/study/session/generate.ts` creates sessions; `functions/api/drills/submit-review.ts` delegates to `lib/services/drillReviewService.ts`; `functions/api/questions/attempt.ts` is stats-only compatibility; `lib/services/studyPlanService.ts` and `functions/api/_shared/studyPlanService.ts` both exist.

## Category Grades

| Category | Grade | Score | Severity | Summary |
|---|---:|---:|---|---|
| API design and route contracts | D | 68 | P1 | Missing frontend-called routes and inconsistent envelopes. |
| Authentication and authorization | C | 72 | P1 | Good Clerk foundation; identity normalization is inconsistent. |
| Database schema and data integrity | C+ | 78 | P1 | Good indexes/FKs in hot areas; RLS and relation coverage incomplete. |
| Data pipeline cohesion | C- | 70 | P1 | Core path exists but state stores and read models diverge. |
| Question generation pipeline | C | 74 | P1 | AI gateway exists; raw JSON parsing and inconsistent persistence remain. |
| Study session pipeline | C | 74 | P1 | Session generation is robust; completion can race review persistence. |
| Attempt submission and scoring | B- | 80 | P1 | Server scoring is strong; duplicate suppression and stats-only paths need policy. |
| Explanation generation | C | 70 | P2 | Explanations exist but no uniform persistence/retrieval contract. |
| User progress updates | D+ | 68 | P1 | Non-atomic FSRS/progress writes can diverge. |
| Weakness detection and analytics | B- | 80 | P2 | Real-data backed; query cost and stale cache risks. |
| FSRS/spaced repetition | D | 66 | P1 | Advanced math but split stores/context policy and partial writes. |
| Study plan generation | C | 71 | P1 | Two plan backends and TARGETED/READINESS mismatch. |
| Schedule generation | C- | 70 | P2 | Daily tasks exist; missed-day recovery is shallow. |
| Dashboard data APIs | B- | 80 | P1 | Real data, but envelope drift and cache staleness. |
| AI provider safety and reliability | C | 74 | P1 | Rate limits and gateway present; structured calls not universal. |
| Error handling and response envelopes | C+ | 78 | P1 | Canonical helper exists; gateway and route exceptions drift. |
| Validation and type safety | C+ | 77 | P1 | Shared schemas for key routes; many endpoints remain inline/ad hoc. |
| Transactions and idempotency | C | 72 | P1 | Drill idempotency is good; multi-write learning event is not atomic. |
| Rate limiting and abuse prevention | B- | 80 | P1 | Gateway tiers exist; KV-missing fallback must fail closed for production AI/admin. |
| Logging, monitoring, observability | C+ | 76 | P2 | Structured logs exist; auth logs full IDs and Prisma spans lack request correlation. |
| Performance and query optimization | C+ | 77 | P2 | Hot indexes exist; some dashboard/blueprint paths aggregate in JS. |
| Testing and QA coverage | B- | 81 | P1 | Many tests, but E2E does not prove persisted session→FSRS→dashboard. |
| Deployment readiness | B- | 80 | P1 | Env check passes; preview KV placeholders and health contract drift remain. |
| Deprecated/duplicate/conflicting code | D+ | 68 | P1 | Local Express, deprecated SRS, mock success endpoints, dual services remain. |

## P0 Launch Blockers

- **Confirmed and fixed this pass:** `functions/api/user/goals.ts` used `auth.userId` as `UserGoal.userId`; schema requires internal `User.id` (`prisma/schema.prisma` model `UserGoal`). Frontend also calls `/api/user/goals/:goalId`; `functions/api/user/goals/[goalId].ts` was added.

## P1 Serious Issues

- Frontend calls missing production routes such as `/api/social/groups`, `/api/social/leaderboard`, `/api/admin/media/upload`, `/api/analytics/submit`, `/api/user/settings`, `/api/analytics/flag`, `/api/admin/compliance/blueprint`, and `/api/feedback`.
- `functions/api/_middleware.ts` returns bespoke 429/503 payloads instead of the canonical envelope.
- `lib/services/drillReviewService.ts` can write `QuestionAttempt` then treat later `ReviewLog`/`UserProgress`/`Card` failures as non-fatal.
- `submitDrillReview` suppresses duplicates by user/question within five minutes even without a session-aware idempotency key.
- `UserProgress`, `UserTopicProgress`, and `Card` are all written/read by different FSRS consumers without a single canonical policy.
- `/api/users/me/daily-plan` and `/api/study-plan/current|progress` use divergent study-plan service implementations.
- Direct Gemini/raw JSON paths remain in generation/explanation and bypass the structured gateway path.
- Auth logging in `functions/api/_shared/auth.ts` logs full user IDs.
- RLS coverage is incomplete for several user-owned tables.
- Live placeholder/mock success paths exist in Spark and Smart Scribe endpoints.

## Recommended Implementation Order

1. Fix user identity normalization and missing user-goal item route.
2. Add a missing-route inventory check and either create disabled stubs or remove frontend callers.
3. Standardize gateway/rate-limit and dashboard error envelopes.
4. Define one canonical learning-event write boundary for attempt + review + FSRS + progress.
5. Resolve FSRS read-model policy for `READINESS` vs `TARGETED`.
6. Consolidate study-plan services.
7. Convert question-generation endpoints to structured gateway calls with Zod validation.
8. Remove or explicitly degrade mock-success production endpoints.
9. Add pipeline integration tests and deploy health/readiness checks.

## Second-Pass Status

First-pass findings are retained. Second-pass review **confirmed** the identity bug, missing route drift, FSRS partial-write risk, study-plan duplication, and AI contract gaps. No first-pass finding was proven false.
