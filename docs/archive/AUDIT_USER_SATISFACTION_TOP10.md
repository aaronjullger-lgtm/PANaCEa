# Audit: Top 10 User-Satisfaction Implementation

**Role:** Senior Full-Stack Architect & Quality Assurance Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness/scalability, refactoring opportunities.  
**Reference:** User-satisfaction plan (profile → baseline → your plan; Command Center; toasts; errors; offline; loading; tutor; recommendations; onboarding; AI discoverability).

---

## Critical Fixes

| Priority | Issue | Location | Action |
|----------|--------|----------|--------|
| **Fixed** | Generate recommendations response shape: API returns `{ data: { success, count, recommendations } }` but frontend read `data.recommendations`, so new recs always appeared as 0. | `components/dashboard/RecommendationFeed.tsx` | Fixed: use `data?.data ?? data` and `payload.recommendations`. |
| **High** | Baseline submit does not set `User.hasCompletedBaseline`. Users who complete baseline are not marked; onboarding may show baseline again on next visit. | `functions/api/baseline/submit.ts` | After upserting `BaselineAssessment`, update `User`: `await prisma.user.update({ where: { id: userId }, data: { hasCompletedBaseline: true } });`. |
| **High** | OnboardingYourPlan: exam date save failures are silent. No toast or message if PUT `/api/user/profile` fails or returns non-ok. | `components/onboarding/OnboardingYourPlan.tsx` | On `!res.ok` or catch: call `toast.error('Could not save exam date. Try again.')` (add sonner import). |
| **Medium** | Baseline questions API: if `PreGeneratedQuestion` has no `completedAt`/`generatedAt`, `orderBy: { generatedAt: 'desc' }` may be invalid. | `functions/api/baseline/questions.ts` | Confirm schema has `generatedAt` (or equivalent) on `PreGeneratedQuestion`; if not, order by `id` or add field. |
| **Medium** | Baseline submit uses `userId` from `resolveUserId` (internal User.id). Prisma `baselineAssessment.upsert` where `{ userId }` is correct (userId is @unique). Ensure `resolveUserId` returns internal id. | `functions/api/baseline/submit.ts` | Verified: `resolveUserId` returns User.id; no change needed. |

---

## Logical Omissions

| Item | Plan / Expected | Current State | Recommendation |
|------|------------------|---------------|----------------|
| **hasCompletedBaseline** | Plan: “Upsert BaselineAssessment for the user.” Optional: “optionally show BaselineAssessment (if not skipped)”. | Baseline is always offered after profile; completing it does not set `hasCompletedBaseline`. | Set `hasCompletedBaseline: true` in baseline submit (see Critical Fixes). Optionally: if `hasCompletedBaseline` is true, skip baseline step and go straight to “Your plan”. |
| **Circadian in recommendations** | Plan §6: “From circadianAnalyticsService, call ‘optimal study time’; add one recommendation line.” | Recommendation engine does not call circadian service. | Low priority: add optional call to circadian “optimal time” and append one recommendation (e.g. “You perform best in the morning — try to study then”) when available. |
| **Due count per system** | Plan §6: “Optionally break by system: … ‘Review Cardiology — N due’.” | Only aggregate “Spaced Repetition Review” with total due count. | Optional: query due items grouped by system and add per-system “Review [system] — N due” recommendations if UI supports it. |
| **First-time AI pro tip** | Plan §10: “Optional: after onboarding … show a single dismissible tooltip: ‘Pro tip: Use Clinical Eye…’ Store hasSeenAIPrompt.” | Not implemented. | Optional: add a one-time modal/tooltip after OnboardingYourPlan with `localStorage.setItem('hasSeenAIPrompt', '1')` and short AI feature hints. |
| **Session end AI summary rate-limit** | Plan §5: “Rate-limit or make it opt-in to control cost.” | Opt-in only (user clicks “Get AI summary”); no server-side rate limit. | Acceptable for now. If cost grows, add a small server-side rate limit (e.g. per user per day) or track usage. |

---

## Technical Debt

| Area | Observation | Suggestion |
|------|-------------|------------|
| **Recommendation list response** | List returns `{ data: recommendations }`; feed normalizes with `(data && data.data) ? data.data : []`. Generate was fixed to use `data.data.recommendations`. | Standardize API contract: document that list/generate both return a `data` wrapper and use shared types/parsers on the client. |
| **prisma: any in recommendationEngine** | `generateRecommendations(userId: string, prisma: any)` uses `any` for Prisma. | Type with `PrismaClient` or a minimal interface (e.g. `{ baselineAssessment, user, studyRecommendation, userTopicProgress, medicalContent }`) for clarity and safety. |
| **Duplicate “20 questions today”** | Plan text and OnboardingYourPlan both say “20 questions today” as first goal. | Single source: constant or config (e.g. `FIRST_GOAL_QUESTIONS = 20`) and use in copy and any analytics. |
| **Baseline question payload typing** | Baseline APIs cast `questionData` as `Record<string, unknown>` and read `question`, `options`, `correctIndex` ad hoc. | Add a small Zod schema or shared type for baseline question payload and use in both GET and submit (for correct answer indexing). |
| **Error handling in onboarding** | BaselineAssessment and OnboardingYourPlan use inline strings for errors; App’s exam-date fetch uses `.catch(() => {})`. | Use `getUserFacingError` (or shared messages) for user-visible errors; at least log in catch (e.g. `console.warn`) for exam-date fetch failure. |
| **ESLint rules turned off** | `no-unused-vars`, `no-explicit-any`, `no-console`, `exhaustive-deps`, `only-export-components` were disabled to clear ~180 problems. | Re-enable incrementally per directory or file; fix unused vars and `any` in touched files (e.g. onboarding, recommendations, baseline). |

---

## Repo Consistency

| Check | Status | Notes |
|-------|--------|--------|
| **Naming** | OK | `BaselineAssessment`, `OnboardingYourPlan`, `handleBaselineComplete` follow existing patterns. |
| **Folder structure** | OK | Baseline API under `functions/api/baseline/`; onboarding components in `components/onboarding/`. |
| **Styling** | OK | CSS variables (`--color-accent`, `--color-text-primary`, etc.), Tailwind, rounded-xl cards, Lucide icons. |
| **Edge / no Node** | OK | Baseline and profile APIs use Prisma singleton, no `fs`/`path`/`process.cwd()`. |
| **Auth** | OK | Baseline and profile use `authenticateRequest`/`authenticatedEndpoint` and Clerk; `resolveUserId` used for internal id. |
| **Lib placement** | OK | `lib/recommendationEngine.ts` and `lib/utils/errorHandlingUtils.ts` are server/shared; no Prisma in `src/lib/`. |

---

## Logic & Security

| Area | Finding | Recommendation |
|------|---------|----------------|
| **Data fetching** | Baseline and profile fetch with Bearer token; errors surface in UI or as toast. RecommendationFeed now correctly parses generate response. | Keep current pattern; ensure all fetch paths handle non-ok and non-JSON (already done in RecommendationFeed). |
| **State management** | Onboarding step (`profile` → `baseline` → `your_plan`) and weakestSystems/examDate live in App; no cross-tab sync. | Acceptable; optional: persist “onboarding step” in localStorage only if you need to resume across reloads. |
| **Baseline submit** | Answers validated with Zod; grading uses server-side question data; no client trust. | Good. Consider rate limit (e.g. one submit per user per minute) to prevent abuse. |
| **Env / secrets** | Profile and baseline use `env.DATABASE_URL`; no keys in client. Gemini called via proxy with auth. | OK. Ensure Cloudflare env (e.g. `CLERK_SECRET_KEY`, `DATABASE_URL`) are set in production. |
| **RLS / Supabase** | Project uses Prisma + Postgres (Supabase). Baseline and recommendations are keyed by resolved `userId` (internal id). | If Supabase RLS is enabled, ensure policies allow access by same user id used in Prisma (e.g. custom `auth.uid()` mapping to User.id if needed). |

---

## Brittleness & Scalability

| Risk | Location | Mitigation |
|------|----------|------------|
| **PreGeneratedQuestion shape** | Baseline GET/submit assume `questionData` has `question`/`vignette`, `options`/`choices`, `correctAnswerIndex`/`correctIndex`. | Add schema validation (Zod) or DB constraint so only valid shapes are stored; or handle missing fields with clear defaults and logging. |
| **Few or no baseline questions** | If fewer than 20 approved questions exist, baseline returns a short list; UI still works. | Document minimum recommended count (e.g. 20); consider admin alert or dashboard metric when count is low. |
| **Recommendation list size** | List endpoint uses `take: 50`. | Sufficient for now; if needed later, add pagination or cursor. |
| **Exam date fetch on your_plan** | One GET on step transition; no retry. | Add a single retry or show “Couldn’t load exam date” with manual refresh if important. |
| **Session end AI summary** | Single Gemini call per click; no queue. | For high concurrency, consider queue or rate limit to avoid Gemini throttling. |

---

## Verification Steps

1. **Onboarding (happy path)**  
   - Sign out, then sign in with a new (or reset) user.  
   - Complete profile → complete baseline (or skip) → see “Your plan” with weakest systems (if baseline was done) and “20 questions today”.  
   - Click “Start first session” → session modal opens and onboarding closes.  
   - Set exam date → click “Set exam date” → see success (and no silent failure); reload and re-open profile/plan to confirm exam date persisted.

2. **Onboarding (skip baseline)**  
   - Profile → Skip (or complete) → Baseline → Skip → “Your plan” with “all systems”.  
   - Start first session → session modal opens.

3. **Recommendations**  
   - Open Command Center; ensure recommendations load (list).  
   - Click “Refresh” / “Analyze progress” (generate).  
   - Confirm new recommendations appear (count and list update); no “0 new” when backend actually returned recommendations.

4. **Baseline**  
   - Start baseline, answer all 20 (or available) questions.  
   - Submit → see results (accuracy, weakest/strongest systems).  
   - After close, open Command Center / recommendations and confirm “Review [weak system]” appears.

5. **Errors**  
   - Disconnect network; trigger baseline submit or profile save.  
   - Confirm user sees a clear error (toast or inline), not a silent failure.  
   - Trigger a drill that uses Gemini; confirm error boundary shows friendly message and “Try again” / “Go home”.

6. **Session end AI summary**  
   - Finish a short session; on end screen click “Get AI summary”.  
   - Confirm 1–2 sentences appear; on network or Gemini failure, confirm fallback message.

7. **Lint & types**  
   - Run `npm run build` and `npx eslint .` (with current config).  
   - Fix any new errors in modified files (e.g. onboarding, RecommendationFeed, baseline APIs).

---

## Summary

- **Critical:** Generate recommendations response parsing fixed; baseline should set `hasCompletedBaseline`; OnboardingYourPlan should show toast on exam date save failure.
- **Logical:** Optional improvements: circadian in recommendations, due-per-system, first-time AI pro tip; baseline skip when already completed.
- **Technical debt:** Type Prisma in recommendation engine; standardize API response shapes; reuse error messaging and first-goal constant.
- **Consistency & security:** Aligned with repo patterns and auth; no secrets in client; consider baseline rate limit and RLS alignment.
- **Verification:** Focus on full onboarding flow, recommendation generate/list, baseline submit/results, error paths, and session end AI summary.
