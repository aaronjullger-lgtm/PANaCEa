# Audit: Foundational Features (Batch 1)

**Date:** February 2026  
**Scope:** 8 foundational features—auth, database, health, quiz/session, dashboard, conditions, navigation, build/typecheck.

---

## 1. Authentication (Clerk)

**Status:** ✅ Functional

- **Frontend:** `index.tsx` wraps app with `AuthProvider`; `AuthProvider` uses `ClerkProvider` from `@clerk/clerk-react`. `useAuth()` (in `hooks/useAuth.ts`) wraps Clerk’s `useUser`, `useClerk`, `useAuth` and exposes `isSignedIn`, `getToken`, `user`, `signOut`.
- **Protected UI:** `App.tsx` uses `useUser()` / `isSignedIn`; when not signed in, shows landing/sign-in. Dozens of components use `useAuth()` for `getToken` on API calls.
- **API:** `functions/api/_shared/auth.ts` exports `verifyAuthToken(requestOrHeader, envOrSecret)` using `@clerk/backend` `verifyToken`. `authenticatedEndpoint` in middleware runs auth and passes `auth.userId` into handlers. No raw `process.env` in Edge; uses `context.env.CLERK_SECRET_KEY`.
- **Gap:** None. Ensure `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` are set in deployment.

---

## 2. Database / Prisma

**Status:** ✅ Functional

- **Schema:** `prisma/schema.prisma` is the source of truth. Core models include `User`, `Question`, `QuestionAttempt`, `Condition`, `MedicalContent`, `UserTopicProgress`, etc.
- **Edge usage:** All Functions use `createEdgePrismaClient(env.DATABASE_URL)` from `functions/api/_shared/prisma-edge.ts` (singleton pattern). Handlers call `safePrismaDisconnect(prisma)` in `finally` blocks. No `new PrismaClient()` in route handlers.
- **Health check:** `GET /api/health` uses Prisma `$queryRaw\`SELECT 1 as health_check\`` to verify connectivity; reports `database.status: pass/fail`.
- **Gap:** None. Use `DATABASE_URL` (Prisma Accelerate `prisma://` or direct `postgresql://`) in env.

---

## 3. Health / API availability

**Status:** ✅ Functional

- **Endpoint:** `GET /api/health` in `functions/api/health.ts`. No auth. Returns JSON: `functionDeployed`, `environment` (DATABASE_URL, CLERK_SECRET_KEY, format), `database` (connection + latency). Overall `status`: `healthy` or `degraded`; 200 if all pass, 503 if any fail.
- **CORS:** Uses `getCorsHeaders` and `handleCorsPreflightSecure` for OPTIONS.
- **Gap:** None. Use for deployment and uptime checks.

---

## 4. Main quiz / session flow

**Status:** ✅ Functional

- **Session init:** `initializeSession()` from `services/core/mainSessionService.ts` (exported via `services/core/index.ts`). Used in `App.tsx` when starting a session.
- **Fetch questions:** `fetchSessionQuestions(settings, token, count)` in `mainSessionService.ts` calls `GET /api/questions/session?count=...&system=...&mode=...` with `Authorization: Bearer <token>`. On failure, falls back to `fallbackQuestionFetch` (client-side `getQuestionBatch`).
- **API:** `GET /api/questions/session` and `POST /api/questions/session` in `functions/api/questions/session.ts` use `authenticatedEndpoint`, resolve user by `auth.userId` (Clerk), call `SessionService.getSessionQuestions`, return `questions` (+ analytics/poolStatus). `SessionService` uses Prisma and pool logic.
- **Attempts:** `POST /api/questions/attempt` in `functions/api/questions/attempt.ts` accepts `questionId`, `isCorrect`/`wasCorrect`, `selectedAnswer`, `telemetryJson`, `answerChangedCount`, etc.; updates `QuestionAttempt`, `UserQuestionSeen`, and related. QuizView and sync manager send attempts here.
- **Client:** `getQuestionBatch` in `services/questionService.ts` uses `fetchFromPool` → `GET /api/questions/pool?...` when token is present; otherwise local/fallback behavior.
- **Gap:** None. Ensure `GEMINI_API_KEY` and pool/DB are populated for full experience.

---

## 5. Dashboard and user stats

**Status:** ✅ Functional

- **API:** `GET /api/dashboard/stats` in `functions/api/dashboard/stats.ts`; authenticated. Uses `resolveUserId`, Prisma, `computeCurrentStreak`, `computeLongestStreak`, `calculateConceptGaps`, and returns `currentStreak`, `longestStreak`, `weakestSystem`, `predictedPassChance`, etc.
- **Frontend:** `DashboardPage.tsx` and `useUserStats` hook load user stats; `UserFriendlyStatsDisplay`, `RetentionWidget`, `CalibrationQuadrantWidget`, etc. consume them.
- **Gap:** None. Dashboard depends on analytics/streak data being populated (cron/aggregation if used).

---

## 6. Condition pages and content

**Status:** ✅ Functional

- **Public API:** `GET /api/conditions/content?name=...` in `functions/api/conditions/content.ts` (publicEndpoint). Resolves `MedicalContent` by condition name or conditionId; returns published content. Used for question generation and context.
- **Page:** `pages/conditions/[id].tsx` loads condition by id, uses `useAuth().getToken` for any auth-only APIs, renders condition detail and structured cards (`ConditionStructuredCards`).
- **Structured/content APIs:** `functions/api/conditions/[identifier]/structured.ts`, `extended.ts`, etc. serve condition-specific data. Condition list and search exist under `api/conditions/`.
- **Gap:** None. Condition content must exist in DB (`MedicalContent`, `Condition`) for pages to show data.

---

## 7. Navigation and routing

**Status:** ✅ Functional

- **Router:** `index.tsx` uses `BrowserRouter`; `App.tsx` uses `Routes`/`Route` and path-driven view state (e.g. `/study` with view query). `config/routes.ts` defines `ROUTES`; `config/appViews.ts` and `config/navigation.ts` define views and nav.
- **NavRail / Menu:** `NavRail`, `MenuView`, `CommandCenterHub` provide navigation. Lazy-loaded views in `config/lazyComponents.tsx` (QuizView, Dashboard, Toolkit, etc.).
- **Gap:** None. Deep links and study sub-routes resolve; 404/guards are in place where intended.

---

## 8. Build and typecheck

**Status:** ✅ Addressed (one fix applied)

- **Typecheck:** `npm run typecheck` runs `tsc --noEmit`. **Fix applied:** `functions/api/tutor/chat.ts` had a parse error at line 98 (`'>' expected`) due to nested generic type being parsed as JSX. Replaced inline type with named interfaces `TutorCandidate` and `TutorSuccessData` so typecheck passes.
- **Build:** `npm run build` (Vite) transforms 4157+ modules. Sourcemap warnings on a few components (e.g. SrsFlashcardView, TutorChatPage, StudyCompanionPage) are non-fatal. Build can be slow; consider increasing timeout in CI if needed.
- **Gap:** None for typecheck. Build completes; for CI, use sufficient timeout or split typecheck from build.

---

## Summary

| # | Feature              | Status   | Notes                                      |
|---|----------------------|----------|--------------------------------------------|
| 1 | Auth (Clerk)         | ✅       | Provider, useAuth, verifyAuthToken, middleware |
| 2 | Database / Prisma    | ✅       | Edge client, health check, disconnect     |
| 3 | Health API           | ✅       | GET /api/health, no auth                   |
| 4 | Quiz / session flow  | ✅       | Session API, attempt API, getQuestionBatch, pool |
| 5 | Dashboard / stats    | ✅       | GET /api/dashboard/stats, useUserStats    |
| 6 | Condition pages      | ✅       | Content API, [id] page, structured cards  |
| 7 | Navigation           | ✅       | Router, routes, lazy views, NavRail        |
| 8 | Build / typecheck    | ✅       | tutor/chat.ts type fix; build succeeds     |

**Batches 2–6 completed:**
- **Batch 2:** `AUDIT_FOUNDATIONAL_FEATURES_BATCH_2.md` – sync, SRS, analytics, drill modes, admin.
- **Batch 3:** `AUDIT_FOUNDATIONAL_FEATURES_BATCH_3.md` – OSCE, study companion, reference APIs, integrations.
- **Batch 4:** `AUDIT_FOUNDATIONAL_FEATURES_BATCH_4.md` – grand rounds, baseline, recommendations, knowledge cache, streaks.
- **Batch 5:** `AUDIT_FOUNDATIONAL_FEATURES_BATCH_5.md` – exam, targeted-daily, intelligence/tutor, cron, feedback.
- **Batch 6:** `AUDIT_FOUNDATIONAL_FEATURES_BATCH_6.md` – achievements, streaks (record/use-freeze), preferences/goals/pearls, dashboard daily-triad/review-queue, admin content-audit/platform-stats.
- **Batch 7:** `AUDIT_FOUNDATIONAL_FEATURES_BATCH_7.md` – retention stats, podcast/veo/vision, branches, clinical browse, drills (code-blue, lab-cases, related-content).
- **Batch 8:** `AUDIT_FOUNDATIONAL_FEATURES_BATCH_8.md` – notifications (stub), cache/kv-cache/semantic-cache, rate limiter, RBAC, error-handler, env-validation.

**Next batch (optional):** Further backend utilities (validation, resolveUser, auditLog) or frontend feature audits as needed.
