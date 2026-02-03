# Comprehensive Audit: Post–User-Satisfaction Implementation (Feb 2026)

**Role:** Senior Full-Stack Architect & Quality Assurance Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness/scalability, refactoring opportunities.  
**Reference:** Top 10 user-satisfaction improvements (toasts, errors, offline, Command Center, loading, AI discoverability, recommendations, baseline, onboarding, tutor/session summary).

---

## 1. Critical Fixes

| Priority | Issue | Location | Action |
|----------|------|----------|--------|
| **High** | **Onboarding completion not synced to server** | `App.tsx`, `UserProfileModal`, `userProfileService` | ~~`hasCompletedOnboarding` stored only in localStorage; server never set.~~ | **Implemented:** (1) On profile complete and profile skip, `syncOnboardingCompleteToServer()` calls `PUT /api/user/profile` with `{ hasCompletedOnboarding: true }`. (2) On app load when signed in, GET profile runs first; if `data.profile.hasCompletedOnboarding === true`, `saveUserProfile({ hasCompletedOnboarding: true })` hydrates localStorage so cross-device and after clear-storage behave correctly. |
| **Medium** | **RecommendationFeed still uses `console.error`** | `components/dashboard/RecommendationFeed.tsx` (lines 110, 164) | Violates project preference to avoid console in production; ESLint may be off but the pattern remains. | Replace with a small logger or remove; if keeping for debug, gate with `import.meta.env.DEV` or use the project’s secure logger on the client. |
| **Low** | **Baseline submit: Prisma disconnect if client throws before try** | `functions/api/baseline/submit.ts` | If `createEdgePrismaClient(env.DATABASE_URL)` threw (e.g. env missing), `finally` would still run but `prisma` would be assigned. No issue in practice; edge case only. | Document or add a guard so `safePrismaDisconnect` is only called when `prisma` is defined. |

**Already addressed in prior work (verified in code):**

- Baseline submit sets `User.hasCompletedBaseline: true` after upsert (`functions/api/baseline/submit.ts`).
- OnboardingYourPlan shows toasts on exam date save success/failure (`components/onboarding/OnboardingYourPlan.tsx`).
- RecommendationFeed parses generate response as `data?.data ?? data` and `payload?.recommendations` (`components/dashboard/RecommendationFeed.tsx`).

---

## 2. Logical Omissions

| Item | Plan / Expected | Current State | Recommendation |
|------|------------------|---------------|-----------------|
| **Onboarding completion sync** | Completion should be durable across devices. | Only localStorage; server `User.hasCompletedOnboarding` never updated from onboarding. | See Critical Fixes: persist via PUT profile and optionally seed localStorage from GET profile on load. |
| **Skip baseline when already completed** | If user already has `hasCompletedBaseline`, skip baseline step. | App always shows profile → baseline → your_plan; no check for existing baseline. | When opening onboarding, if server/profile indicates `hasCompletedBaseline`, set step to `'your_plan'` (or skip baseline step in the flow). |
| **Circadian in recommendations** | Plan §6: optional “optimal study time” from circadian analytics. | `lib/recommendationEngine.ts` does not call circadian service. | Low priority: add optional call and one recommendation line when service is available. |
| **Due count per system** | Optional “Review Cardiology — N due” style. | Only aggregate “Spaced Repetition Review” with total count. | Optional: group due items by system and add per-system recommendations if UI supports it. |
| **First-time AI pro tip** | Optional dismissible tooltip after onboarding (e.g. “Pro tip: Use Clinical Eye…”). | Not implemented. | Optional: one-time tooltip + `localStorage.setItem('hasSeenAIPrompt', '1')`. |
| **Exam date fetch on your_plan** | Robust load of existing exam date. | Single GET on step transition; no retry. | Add one retry or fallback message (“Couldn’t load exam date”) with optional manual refresh. |

---

## 3. Technical Debt

| Area | Observation | Suggestion |
|------|-------------|------------|
| **Recommendation API contract** | List returns `{ data: recommendations }`; generate returns `{ data: { success, count, recommendations } }`. Feed normalizes both. | Document the contract; consider shared response type and a small client parser for list vs generate. |
| **`prisma: any` in recommendationEngine** | `generateRecommendations(userId, prisma: any)` uses `any`. | Type with a minimal interface (e.g. methods used: `baselineAssessment.findFirst`, `user.findUnique`, `userTopicProgress.findMany`, `studyRecommendation.findMany/createMany`) or project’s Edge Prisma type. |
| **“20 questions today”** | Hardcoded in OnboardingYourPlan and possibly elsewhere. | Single constant (e.g. `FIRST_GOAL_QUESTIONS = 20`) in config or constants; use in copy and any analytics. |
| **Baseline question payload** | GET and submit cast `questionData` as `Record<string, unknown>` and read `question`/`options`/`correctIndex` ad hoc. | Add a small Zod schema or shared type for baseline question payload and use in both endpoints (and optionally in DB validation). |
| **Error messaging in onboarding** | BaselineAssessment and OnboardingYourPlan use inline strings; App’s exam-date fetch uses `.catch(() => {})`. | Use shared user-facing messages (e.g. from `getUserFacingError` or a small messages module); at least log exam-date fetch failure for debugging. |
| **ESLint rules disabled** | `no-console`, `no-explicit-any`, `exhaustive-deps`, etc. were turned off to reduce noise. | Re-enable incrementally (e.g. per directory or file); fix onboarding, baseline, and recommendation code first. |

---

## 4. Repo Consistency

| Check | Status | Notes |
|-------|--------|------|
| **Naming** | OK | `BaselineAssessment`, `OnboardingYourPlan`, `handleBaselineComplete` match existing patterns. |
| **Folder structure** | OK | Baseline API under `functions/api/baseline/`; onboarding under `components/onboarding/`. |
| **Styling** | OK | CSS variables (`--color-accent`, `--color-text-primary`), Tailwind, rounded-xl, Lucide. |
| **Edge / no Node** | OK | Baseline and profile use Edge Prisma; no `fs`/`path`/`process.cwd()` in functions. |
| **Auth** | OK | Baseline and profile use `authenticatedEndpoint` and Clerk; `resolveUserId` for internal id. |
| **Lib placement** | OK | `lib/recommendationEngine.ts` is server/shared; no Prisma in `src/lib/`. |

---

## 5. Logic & Security

| Area | Finding | Recommendation |
|------|---------|----------------|
| **Data fetching** | Baseline and profile use Bearer token; errors surface in UI or toast. RecommendationFeed parses list and generate correctly. | Keep; ensure all fetch paths handle non-ok and non-JSON (RecommendationFeed already does). |
| **State management** | Onboarding step and weakestSystems/examDate live in App; no cross-tab sync. | Acceptable; optionally persist step in localStorage only if resume across reloads is required. |
| **Baseline submit** | Answers validated with Zod; grading uses server-side question data. | Good. Consider a light rate limit (e.g. one submit per user per minute) to prevent abuse. |
| **Env / secrets** | Profile and baseline use `context.env.DATABASE_URL`; no keys in client. | OK. Ensure Cloudflare env (e.g. `CLERK_SECRET_KEY`, `DATABASE_URL`) are set in production. |
| **RLS / Supabase** | Prisma + Postgres (Supabase); baseline and recommendations keyed by resolved `userId`. | If RLS is enabled, ensure policies align with the same user id used by Prisma (e.g. `auth.uid()` mapped to `User.id`). |

---

## 6. Brittleness & Scalability

| Risk | Location | Mitigation |
|------|----------|-------------|
| **PreGeneratedQuestion shape** | Baseline GET/submit assume `questionData` has `question`/`vignette`, `options`/`choices`, `correctAnswerIndex`/`correctIndex`. | Add Zod or DB constraint for valid shapes; handle missing fields with defaults and logging. |
| **Few baseline questions** | Fewer than 20 approved questions → shorter list; UI still works. | Document minimum (e.g. 20); consider admin metric or alert when count is low. |
| **Recommendation list size** | List uses `take: 50`. | Sufficient for now; add pagination or cursor if needed later. |
| **Session end AI summary** | One Gemini call per click; no server-side rate limit. | Acceptable for now; if cost grows, add per-user daily limit or usage tracking. |

---

## 7. Verification Steps

1. **Onboarding (happy path)**  
   - Sign out, sign in (or use user with cleared localStorage).  
   - Complete profile → complete baseline (or skip) → see “Your plan” with weakest systems (if baseline done) and “20 questions today”.  
   - Click “Start first session” → session modal opens, onboarding closes.  
   - Set exam date → “Set exam date” → see success toast; reload and confirm exam date persisted (GET profile).

2. **Onboarding (skip baseline)**  
   - Profile → Continue or Skip → Baseline → Skip → “Your plan” with “all systems”.  
   - Start first session → session modal opens.

3. **Onboarding completion persistence (gap)**  
   - Complete onboarding on device A; on device B (same user), confirm onboarding shows again until server sync is implemented.  
   - After implementing server sync: complete onboarding, then clear localStorage and reload; confirm onboarding does not show again if server returns `hasCompletedOnboarding: true`.

4. **Recommendations**  
   - Open Command Center; recommendations load (list).  
   - Click “Refresh” / “Analyze progress” (generate).  
   - Confirm new recommendations appear (count and list update); no “0 new” when backend returned recommendations.

5. **Baseline**  
   - Start baseline; answer all 20 (or available).  
   - Submit → see results (accuracy, weakest/strongest).  
   - After close, open Command Center; confirm “Review [weak system]” appears.

6. **Errors**  
   - Disconnect network; trigger baseline submit or profile save.  
   - Confirm user sees clear error (toast or inline), not silent failure.  
   - Trigger a drill that uses Gemini; confirm error boundary shows friendly message and “Try again” / “Go home”.

7. **Session end AI summary**  
   - Finish a short session; on end screen click “Get AI summary”.  
   - Confirm 1–2 sentences appear; on failure, confirm fallback message.

8. **Build & lint**  
   - `npm run build` and `npx eslint .` (current config).  
   - Fix any new errors in modified files.

---

## 8. Summary

- **Critical (implemented):** Onboarding completion is now synced to the server on profile complete/skip via PUT profile, and localStorage is hydrated from GET profile on load so behavior is correct across devices and after clear storage.
- **Logical:** Optional improvements: skip baseline when already completed, circadian recommendation, due-per-system, first-time AI pro tip, and retry/fallback for exam date fetch.
- **Technical debt:** Type Prisma in recommendation engine; standardize recommendation API response shape; shared error messages and first-goal constant; re-enable ESLint incrementally.
- **Consistency & security:** Aligned with repo patterns and auth; no secrets in client; consider baseline rate limit and RLS alignment.
- **Verification:** Focus on full onboarding flow (including cross-device after fix), recommendation generate/list, baseline submit/results, error paths, and session end AI summary.
