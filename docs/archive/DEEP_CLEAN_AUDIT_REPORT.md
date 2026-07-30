# PANaCEa Deep Clean Audit Report

**Role:** Senior Product Architect, QA Lead, UX Designer  
**Objective:** Systematic audit of Top 5 Core Features and full UI/UX layer for prototype → production readiness.  
**Data flow traced:** Database → API → UI.

---

## 1. CRITICAL BLOCKERS

Bugs that break the app or poison data.

| # | Blocker | Location | Detail |
|---|---------|----------|--------|
| 1 | **Body Map shows no system dots** | `BodyMapWidget.tsx` vs `rolling360Service.ts` | `UserRolling360Stats.systemStats` uses **normalized keys** (e.g. `"Cardiovascular"`, `"Pulmonary"`) from `SYSTEM_NORMALIZATION_MAP`. `BodyMapWidget.SYSTEM_TO_REGION` only has **short codes** (`CV`, `PULM`, `GI`, …). So `SYSTEM_TO_REGION[system]` is always `undefined` for every key; all circles return `null` and the body map renders no dots. |
| 2 | **OSCE chat never persists vitals** | `functions/api/osce/chat.ts` | Chat endpoint only updates `messages`. It does **not** accept or persist `physicalFindings`. If the “living patient” is supposed to have vitals that change over time (e.g. from AI or time progression), those changes are never saved. Only `/api/osce/intervene` writes `physicalFindings`. Result: patient state does not evolve with chat; vitals effectively “reset” or stay stale. |
| 3 | **Main question generator bypasses Staging Lake** | `functions/api/questions/generate.ts` | Generate flow returns the question to the client and caches via semantic cache. It **never** writes to `StagingQuestion`. So there is no pipeline from “Deep Think” generation → Staging → approval → production. Staging exists and is used by admin/run-critic and questions/staging, but the main `/api/questions/generate` path is disconnected. |
| 4 | **Quiz Submit button has no submit guard** | `components/session/QuizView.tsx` | Submit button is only hidden when `isAnswered` is set at the start of `handleSubmitAnswer`. There is no `disabled={isSubmitting}` or ref guard. A fast double-click before re-render can fire `handleSubmitAnswer` twice, risking duplicate attempts/sync. |

---

## 2. LOGIC GAPS

Features that exist in the DB or design but are not wired in the API or UI.

| # | Gap | Location | Detail |
|---|-----|----------|--------|
| 1 | **VitalSignRange.emergencyValues only used in intervene** | `functions/api/osce/` | `emergencyValues` is **read** in `intervene.ts` for Code Blue / decompensation. It is **not** read in `chat.ts`. So “patient decompensates” only happens when the user explicitly triggers an intervention (e.g. drug). Chat-only flows never evaluate emergency ranges. |
| 2 | **Condition page does not use DrugConditionLink** | `pages/conditions/[id].tsx` | “First-line” and drug info come from condition **section content** (e.g. `first_line_rx` from `getHeroValue(sec, ['first_line_rx'])`), i.e. static text in MedicalContent. There is **no** fetch of related drugs via `DrugConditionLink`. Deep-linking to a drug graph is not implemented. |
| 3 | **Distractor anchoring not enforced in schema** | `functions/api/_shared/question-generator.ts` | Prompt asks for “Kaplan-level distractors” and “incorrect” rationale per option, but the **JSON response schema** does not require a structured distractor field (e.g. “wrong but plausible for X”). The generator returns `explanation.incorrect` as optional; DB `Question`/PreGeneratedQuestion store `options` as a flat array with no distractor metadata. |
| 4 | **Vignette length not enforced** | `question-generator.ts` | Prompt does not require “3-sentence vignette” or “pertinent negatives.” It only says `"question": "..."`. Model can return a one-liner; no validation or retry for vignette quality. |
| 5 | **UserBehaviorMetrics not called from all drill paths** | Frontend | `UserBehaviorMetrics` is written via POST to `/api/user/behavior-metrics` from `useImplicitMetrics.submitAnswer`, which is used in `QuizView`. Other drill UIs (e.g. ConditionDrillSession, GrandRoundsMode) may not send the same telemetry (e.g. `timeToFirstClick`). Coverage is inconsistent. |
| 6 | **Registry sync is manual** | `lib/services/sync/registrySync.ts`, `scripts/syncAllRegistries.ts` | Conditions/drugs sync from registry/DB exists but is **not** automatic on deploy. If DB is empty or out of date, the app is empty or stale until someone runs the sync script. |

---

## 3. UX DEBT

Ugly transitions, broken routes, mobile issues, and visual inconsistencies.

| # | Issue | Location | Detail |
|---|--------|----------|--------|
| 1 | **Landing: generic hero, no live stats** | `pages/LandingPage.tsx` | Hero is static (“Your Complete PA School Resource”). No “Live Stats” ticker from `PlatformStatistics`. CTAs are “Get Started” / “Sign Up Free” and correctly open Clerk Sign-up; no broken “Start Free Trial” link found. |
| 2 | **Landing route is correct** | `App.tsx` | Unauthenticated users get `<LandingPage />` when `!isSignedIn` (no separate route; same path “/”). So unauthenticated traffic does hit the landing page. |
| 3 | **Navigation uses Framer Motion** | `App.tsx`, `NavRail.tsx` | Main app uses `AnimatePresence` and `pageVariants` for view changes; NavRail uses `motion.aside` and `AnimatePresence`. No hard refresh for in-app navigation. |
| 4 | **Mobile: NavRail vs Sidebar** | Layout | Main study flow uses **NavRail** (in App.tsx). **Sidebar** + **MainLayout** (mobile drawer) exist but are not the primary shell for the study app. Confirm which routes use MainLayout and that mobile overlay z-index is sufficient where drawer is used. |
| 5 | **Theme: no pure black** | `tailwind.config.js` | Dark mode uses `clinical-navy` (#0F172A), `slate-950` (#020617). No `#000000` or `bg-black` in scanned files. Matches design system. |
| 6 | **Semantic colors** | Design system | Correct/stable use emerald; critical uses rose. `BodyMapWidget` uses `--color-data-pass`, `--color-data-fail`, etc. Some hardcoded fallbacks (e.g. `bg-rose-500`) exist; prefer semantic tokens everywhere. |
| 7 | **Drill: explanation expand CLS** | QuizView / drill cards | When the explanation/rationale section expands after submit, layout can shift if the card does not reserve min-height or use a stable container. No explicit min-height or skeleton for explanation block was confirmed; worth testing for CLS. |
| 8 | **Submit button state** | `QuizView.tsx` | Submit is not disabled during any async phase (attempt/sync is fire-and-forget). Only protection is hiding after `isAnswered`. Add `disabled` or ref guard for the first few hundred ms to prevent double submit. |

---

## 4. FEATURE-BY-FEATURE SUMMARY

### Feature 1: Deep Think Question Engine

- **Distractor logic:** Prompt mentions distractors; JSON schema does not enforce distractor anchoring or a required `options` metadata shape that matches DB. Options in DB are a flat array.
- **Vignette quality:** No enforcement of 3-sentence vignette or pertinent negatives; prompt only specifies `"question": "..."`.
- **Pipeline:** `generate.ts` → cache + client. **Not** connected to QuestionSeed → StagingQuestion → Question. Staging is a separate path (admin/staging, questions/staging, run-critic). Pool reads from PreGeneratedQuestion + Question; staging promotion writes to PreGeneratedQuestion.

### Feature 2: Living Patient (Dynamic OSCE)

- **emergencyValues:** Read in `intervene.ts` for decompensation; not used in `chat.ts`.
- **State persistence:** `chat.ts` only saves `messages`. Modified vitals are **not** saved in chat; only `intervene.ts` updates `physicalFindings`. If design expects vitals to change with chat or time, that is missing.
- **Rubric grading:** `OsceResult` is created/updated in `grade.ts` with validated checklist (GRADE_CHECKLIST_ITEM); CaseRubric is used in the Gemini prompt and parsing is correct.

### Feature 3: FSRS v6 Implicit Optimizer

- **SRSItem:** `functions/api/srs/submit.ts` still **updates** `SRSItem` when `srsItemId` is provided (legacy path). DB writes to SRSItem exist there. Client-side `lib/services/srsService.ts` uses in-memory/localStorage SRSItem (different concern).
- **review_type:** `drillReviewService` creates `ReviewLog` only when `sessionType !== 'cram' && sessionType !== 'rapid_recall'`, and then with `review_type: 'real'`, `sessionType: 'MAIN'`. Cram/rapid_recall do not write ReviewLog. No pollution from non-main sessions.
- **Telemetry:** `timeToFirstClick` is sent from `useImplicitMetrics.submitAnswer` to `/api/user/behavior-metrics` and stored in `UserBehaviorMetrics`. Main quiz path is wired; other drill paths may not be.

### Feature 4: Hybrid Content Engine

- **Orphaned content:** Registry sync exists (`registrySync.ts`, `syncAllRegistries.ts`). If DB is empty, `/api/content/all` and condition load are empty; sync must be run manually or via cron.
- **Condition page drugs:** Condition page does **not** fetch or display related drugs via `DrugConditionLink`. It shows static text from condition sections (e.g. first_line_rx). Unacceptable for “graph” deep-linking.

### Feature 5: Dashboard & Metacognition

- **Rolling 360 limit:** `rolling360Service` uses a circular buffer of exactly `ROLLING_WINDOW_SIZE` (360) slots; the 361st attempt overwrites slot 0. The 360 limit is respected.
- **Body map JSON:** `systemStats` keys are **normalized full names** (e.g. Cardiovascular). BodyMapWidget expects **short codes** (CV, PULM, …). Key mismatch causes **no dots** to render (critical blocker above).

---

## 5. EXECUTION PLAN (Prioritized)

Ordered list of files to edit and what to do.

1. **Body Map key alignment (critical)**  
   - **Option A:** In `rolling360Service.ts`, store `systemStats` under **short codes** (CV, PULM, …) when writing to `UserRolling360Stats`, and keep BodyMapWidget as is.  
   - **Option B:** In `BodyMapWidget.tsx`, add a reverse map (e.g. Cardiovascular → CV) and use it to look up `SYSTEM_TO_REGION`.  
   - Files: `lib/services/rolling360Service.ts` and/or `components/dashboard/BodyMapWidget.tsx`.

2. **OSCE chat vitals persistence (critical)**  
   - Extend `functions/api/osce/chat.ts` to accept optional `physicalFindings` in the body; if present, update `PatientEncounterSession.physicalFindings` together with `messages`.  
   - Ensure frontend sends updated vitals when the “living patient” state changes (e.g. from AI or time step).  
   - File: `functions/api/osce/chat.ts`; then frontend OSCE/chat component(s).

3. **Quiz submit double-click guard**  
   - In `QuizView.tsx`, add a ref (e.g. `submittedRef`) or `isSubmitting` state: set true at start of `handleSubmitAnswer`, set false after a short delay or after fire-and-forget calls are queued. Disable the Submit button when true.  
   - File: `components/session/QuizView.tsx`.

4. **Connect generate to Staging (optional but recommended)**  
   - Either: add a “staging” mode or admin-only path that writes `generate.ts` output to StagingQuestion (via `_shared/staging-questions.ts`), or document that “Deep Think” is cache-only and staging is fed by a separate pipeline.  
   - Files: `functions/api/questions/generate.ts`, `functions/api/_shared/staging-questions.ts`.

5. **Condition page: DrugConditionLink**  
   - Add an API (e.g. GET condition drugs by conditionId using `DrugConditionLink`) and have the condition page fetch and display related drugs.  
   - Files: new or existing `functions/api/` endpoint; `pages/conditions/[id].tsx`.

6. **Question generator: vignette + distractor**  
   - In `question-generator.ts`, add explicit schema requirements: e.g. “question” must be at least 2–3 sentences for vignette type; add optional “distractorRationale” per option and include in cache/DB shape if desired.  
   - File: `functions/api/_shared/question-generator.ts`.

7. **Landing: Live Stats ticker**  
   - Add an API or use existing `PlatformStatistics` to expose safe, public stats (e.g. questions answered, active users). On Landing, add a small “Live” ticker that fetches and displays them.  
   - Files: `pages/LandingPage.tsx`, and either new endpoint or existing stats API.

8. **Registry sync on deploy**  
   - Document or add a deploy step (e.g. GitHub Action or manual run) to execute `syncAllRegistries` (or equivalent) when content should be refreshed.  
   - Files: `docs/` or CI/deploy config; optionally a small cron or post-deploy hook.

9. **Body Map: reserve space for explanation (CLS)**  
   - In QuizView (and any drill that shows expandable explanation), give the explanation block a min-height or placeholder so layout doesn’t jump when it appears.  
   - File: `components/session/QuizView.tsx` (and drill components as needed).

10. **UserBehaviorMetrics coverage**  
    - Audit all drill/session components that submit answers; ensure they either use `useImplicitMetrics` (or equivalent) and POST to `/api/user/behavior-metrics` with `timeToFirstClick` and other fields so FSRS/analytics have consistent data.  
    - Files: All session/drill views that record attempts.

---

## 6. SCHEMA / SOURCE REFERENCES

- **Question, QuestionSeed, StagingQuestion:** schema.prisma (models around 2042, 2196, 2402).  
- **PatientEncounterSession, VitalSignRange, OsceResult:** 1689, 2836, 1712.  
- **ReviewLog, Card, SRSItem:** 1582, 2261, 2231.  
- **UserBehaviorMetrics, MedicalContent, DrugConditionLink:** 3548, 1440, 750.  
- **UserRolling360Stats, SessionAnalytics, PlatformStatistics:** 3892, 3809, 2531.

---

*End of Deep Clean Audit Report. Be harsh; fix critical blockers first, then logic gaps, then UX debt.*
