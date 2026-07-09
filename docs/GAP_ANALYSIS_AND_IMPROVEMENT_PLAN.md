# PANaCEa Gap Analysis & Improvement Plan

**Date:** February 6, 2026  
**Scope:** Site functionality, features, navigation, API parity, placeholders, and production readiness.

---

## Executive Summary

PANaCEa has a strong foundation: auth, database, quiz/session flow, dashboard, conditions, OSCE, study companion, and reference APIs are functional. This audit identifies **gaps** between documented “complete” status and actual behavior, **dead or mismatched** navigation/APIs, **placeholder/stub** implementations, and **missing or incomplete** features. Prioritized improvements are grouped by impact and effort.

---

## 1. Navigation & Routing Gaps

### 1.1 Path–View Mismatch (High Impact)

**Current behavior:** Only these paths drive view state in `App.tsx`:

- `/`, `/study`, `/study/` → `command_center`
- `/menu` → `menu`
- `/study/reference` → `reference_library`
- `/study/toolkit` → `toolkit`

**Gap:** `config/navigation.ts` (NAVIGATION_CONFIG and NAVIGATION_STRUCTURE) still references paths that **do not** map to any view or route:

| Path | Result when user navigates |
|------|-----------------------------|
| `/education` | Stays on or shows command_center; URL is wrong |
| `/settings` | No route; Settings is **modal-only** (header button). Link is dead. |
| `/subscription` | No route; dead link. |
| `/stats` | No route; analytics is `/study?tab=analytics`, not `/stats`. |
| `/education/adaptive`, `/education/qbank`, `/education/simulator`, `/education/cases` | No routes. |
| `/reference/conditions`, `/reference/drugs`, `/reference/diagnostics`, `/reference/guidelines` | No routes. |
| `/skills/terminology`, `/skills/rapid`, `/skills/visuals` | No routes. |

**Recommendation:**

- **Option A (quick):** Trim `config/navigation.ts` so only paths that exist are used (NavRail is already correct; remove or repoint legacy nav items that point to `/education`, `/stats`, `/settings`, `/subscription`, `/reference/*`, `/skills/*`).
- **Option B (full):** Add path→view sync in `App.tsx` for `/settings` (e.g. open Settings modal on load) and `/stats` → redirect to `/study?tab=analytics`. Add real routes or redirects for `/reference/conditions` → `/study/reference` with a query or hash for conditions tab.

---

### 1.2 No Dedicated 404 Route

**Gap:** The catch-all `path="*"` always renders the main app shell. Unknown paths (e.g. `/foo/bar`) do not show a 404 page; they show the dashboard with a wrong URL.

**Recommendation:** Add a `Route path="*"` that checks `location.pathname` against the known set; if unknown, render a small “Page not found” view with a link to `/study`.

---

## 2. API & Backend Gaps

### 2.1 Sync Manager vs Cloudflare Pearl Paths (Medium Impact)

**Location:** `lib/services/sync/syncManager.ts`

**Gap:** Offline sync uses **Express-style** pearl URLs:

- `/api/pearls/${id}/view`, `/api/pearls/${id}/mastered`, `/api/pearls/${id}/schedule`, `/api/pearls/${id}/save`

**Reality:** Cloudflare Functions expose pearls under **user**:

- `GET /api/user/pearls`, `GET /api/user/pearls/daily`, `POST /api/user/pearls/[id]/save`, `POST /api/user/pearls/[id]/useful`

So sync actions for pearls will **fail in production** (404 or wrong path).

**Recommendation:** Update `syncManager.ts` to use `/api/user/pearls/[id]/save` (and equivalent) and align action types with the CF API (e.g. “useful” vs “mastered”). Add a small adapter if Express dev server still uses `/api/pearls/*`.

---

### 2.2 Missing Social API in Production (High Impact if Social is Used)

**Location:** `components/social/StudyGroupDashboard.tsx`

**Gap:** The component calls:

- `GET /api/social/groups`
- `GET /api/social/leaderboard?period=weekly`
- `POST /api/social/groups/join`

There is **no** `functions/api/social/` directory. These endpoints exist only in the legacy Express `routes/` (and even there, a dedicated social router may be missing). In production (Cloudflare Pages), these calls will **404**.

**Recommendation:** Either (1) implement `functions/api/social/` (groups, leaderboard, join) with auth and DB, or (2) hide or feature-flag Study Group UI until backend exists, and document that social is “coming soon.”

---

### 2.3 Games / Wordle API — Implemented (Resolved)

**Location:** `hooks/useWordleGame.ts`, `functions/api/games/wordle/daily.ts`, `functions/api/games/wordle/guess.ts`

**Status:** Edge handlers are deployed under `functions/api/games/wordle/`. Medical Wordle is reachable at `/modes/medical-wordle` via `config/training-modes.ts`.

**Remaining risk:** Empty `Buzzword` catalog returns a validation error; seed buzzwords before QA.

---

### 2.4 Study Session Generate: Review/Focused Modes Not Implemented (Low–Medium Impact)

**Location:** `functions/api/study/session/generate.ts`

**Gap:** The handler returns `501` for `mode !== 'mainSession'` with message: `Mode '${mode}' not yet implemented. Use 'mainSession'.` So any client that calls this endpoint with `review` or `focused` will get 501.

**Note:** The main quiz flow uses `/api/questions/session` and supports `focus: 'review'` / `reviewFlagged` in the app; the gap is specific to the **study/session/generate** API.

**Recommendation:** Either implement `review` and `focused` in `study/session/generate.ts` (e.g. delegate to SRS/review logic) or document that this endpoint is “mainSession only” and ensure no UI calls it with other modes.

---

## 3. Placeholder & Stub Implementations

### 3.1 Smart Scribe Infographic (Medium Impact)

**Location:** `functions/api/smart-scribe/generate-infographic.ts`, `hooks/useEnhancedDebrief.ts`, `services/scribe/infographicService.ts`

**Gap:**

- Infographic API calls a non-existent or placeholder “info_genius” style API; on failure it returns a **placeholder** infographic with `imageUrl: '/placeholder-infographic.svg'`.
- Frontend uses `/placeholder-infographic.svg` and `/placeholder-thumbnail.svg` in debrief.

**Recommendation:** Either (1) implement real infographic generation (e.g. with a supported Gemini/Imagen API or external service) and return real asset URLs, or (2) clearly label the feature as “placeholder” in UI and track as tech debt.

---

### 3.2 Notifications (Email) – Stub Only (Low Impact until you need email)

**Location:** `functions/api/_shared/notifications.ts` (from Batch 8 audit)

**Gap:** `sendFlagResolvedNotification` and `sendAdminFlagNotification` only `console.log` and return `true`. No email is sent.

**Recommendation:** When you need email, implement HTTP-based provider (Resend, SendGrid, Postmark) and set env (e.g. `RESEND_API_KEY`). Keep stub for dev.

---

### 3.3 Clinical Eye Placeholder Image (Low Impact)

**Location:** `components/modes/ClinicalEyeMode.tsx`

**Gap:** Uses `imageUrl: '/sample-chest-xray.jpg'` with comment “Placeholder.”

**Recommendation:** Replace with real sample asset or load from your media/condition pipeline so the mode is representative.

---

### 3.4 Avatar XP / UserAvatar Type (Low Impact)

**Location:** `components/gamification/AvatarDisplay.tsx`

**Gap:** Comment: “TODO: Update UserAvatar type in Prisma schema to include xp field.” Code uses `(avatar as any).xp`.

**Recommendation:** Add `xp` (or equivalent) to the schema and to the type so the UI is type-safe and persistence is consistent.

---

### 3.5 Sync User Placeholder Email (Low Impact)

**Location:** `functions/api/sync.ts`

**Gap:** When creating a user, email may be set to `${clerkId}@placeholder.panacea.app`.

**Recommendation:** Prefer Clerk’s email when available; use placeholder only as fallback and document it. Consider not storing placeholder emails in analytics or notifications.

---

### 3.6 Other Placeholders (Documentation / Tech Debt)

- **aiTutorService.ts:** “TODO: Look up from database” for resource title; “Placeholder” for follow-ups and relevant resources.
- **soapNoteService.ts:** `organization: 85` (placeholder).
- **infographicService.ts:** `cost: 0.05` (placeholder); “Placeholder - parse SVG for interactive elements.”
- **systemIntegrationService.ts:** “Placeholder - in production, pre-fetch images, videos.”
- **drillSessionManager.ts:** “Group by system (placeholder - would need condition lookup for accurate system mapping).”
- **ImagingViewer.tsx:** Placeholder slide with `id: 'placeholder'`, `url: '/images/radiology/placeholder.png'`.

Treat as tech debt; fix when touching those flows or when they affect user-facing behavior.

---

## 4. Dormant / Unused Features (Consistency)

**From `routes/index.ts`:**

- `/api/games` – Medical Wordle; not used in App (dormant).
- `/api/pearls` – Express only; CF uses `/api/user/pearls` (see 2.1).
- `/api/adaptive` – Not called by frontend (dormant).
- `/api/recommendations` – **Used** by `RecommendationFeed`; CF has `functions/api/recommendations/` ✅.

**Recommendation:** Either remove or feature-flag UI that depends on dormant APIs; ensure production only calls APIs that exist in `functions/api/`.

---

## 5. Settings & Subscription Access (UX)

**Gap:** “Profile & Settings” and “Subscription” in navigation config point to `/settings` and `/subscription`. There are no routes for these; Settings is opened via **header button** (modal). So users who click “Settings” or “Subscription” in a sidebar/nav that uses those paths will not see the modal; they’ll just see the dashboard with a wrong URL.

**Recommendation:** (1) In nav, link “Settings” to `#` or `javascript:void(0)` and open the Settings modal on click (same as header), or (2) add `/settings` route that opens the app and immediately opens the Settings modal (e.g. via search param `?settings=1`). Same idea for Subscription if it’s modal-based.

---

## 6. Content & Data Readiness (From PRODUCTION_READINESS_MASTER_PLAN)

- **Images:** Large image import in progress; many conditions may still lack images. Run gap analysis and prioritize high-yield conditions.
- **Condition content:** Many conditions may have minimal or placeholder `MedicalContent`/description. Audit completeness and enrich.
- **OSCE cases:** Requires seeded `PatientEncounterCase` (and related) data for OSCE to be useful.

These are product/content gaps rather than code bugs; keep them in the launch checklist.

---

## 7. Error Handling & Resilience

- **Components:** Many components have try/catch and error state; some surfaces still need consistent “retry” and “contained within card” behavior per design system.
- **API:** Structured JSON errors and error-handler middleware are in place ✅. Ensure all new endpoints use the same pattern.

No major structural gap; continue applying existing patterns to new code.

---

## 8. Testing & Quality

- **Tests:** `tests/` has good coverage of critical paths (sync, session start, FSRS, pool, analytics, etc.). E2E has auth setup and mode coverage.
- **Gap:** Some drill/mode endpoints and social flows are not covered by tests. Adding tests for sync manager (pearl paths) and for any new social API would reduce regressions.

---

## 9. Prioritized Improvement Plan

### P0 – Critical (Before/At Launch)

1. **Navigation:** Align nav config with reality: remove or redirect dead links (`/education`, `/stats`, `/settings`, `/subscription`, `/reference/*`, `/skills/*`), or add minimal path→view sync so Settings/Subscription are reachable from nav.
2. **Pearl sync:** Update `syncManager.ts` to use Cloudflare pearl paths (`/api/user/pearls/...`) so offline pearl actions work in production.
3. **Social:** Either implement `functions/api/social/*` or hide/disable Study Group UI and document.

### P1 – High Value, Short Term

4. **404 handling:** Add explicit 404 route/view for unknown paths.
5. **Infographic:** Either ship real infographic generation or clearly mark placeholder in UI and roadmap.
6. **Games/Wordle:** Verify buzzword seed data and authenticated play on `/modes/medical-wordle` (API exists at `/api/games/wordle/*`).

### P2 – Polish & Consistency

7. **Study session generate:** Implement or document `review`/`focused` modes for `/api/study/session/generate`.
8. **Avatar XP:** Add `xp` to Prisma UserAvatar (or equivalent) and remove `(avatar as any).xp`.
9. **Clinical Eye / ImagingViewer:** Replace placeholder images with real assets or a single “sample” asset from your pipeline.
10. **Settings/Subscription from nav:** Make “Settings” and “Subscription” in nav open the correct modals (or a route that does).

### P3 – Tech Debt & Content

11. **Email notifications:** When needed, wire notifications to Resend/SendGrid/Postmark.
12. **TODOs in aiTutorService, infographicService, systemIntegrationService:** Resolve when touching those features.
13. **Content completion:** Follow PRODUCTION_READINESS_MASTER_PLAN for images and condition content.

---

## 10. Summary Table

| Area | Gap | Priority | Action |
|------|-----|----------|--------|
| Navigation | Dead links (settings, subscription, education, stats, reference/*, skills/*) | P0 | Align config or add path→view |
| Sync | Pearl URLs use `/api/pearls/*`; CF has `/api/user/pearls/*` | P0 | Update syncManager to CF paths |
| Social | No `functions/api/social/`; StudyGroupDashboard 404s | P0 | Implement API or hide UI |
| Routing | No 404 for unknown paths | P1 | Add 404 route/view |
| Smart Scribe | Infographic returns placeholder SVG | P1 | Real implementation or label placeholder |
| Games | Wordle API live at `/api/games/wordle/*` | P2 | Seed buzzwords; verify hook reads unified envelope `data` |
| Study session API | review/focused return 501 | P2 | Implement or document |
| Avatar | UserAvatar type missing xp | P2 | Schema + type update |
| Placeholders | Clinical Eye, ImagingViewer, emails, etc. | P2–P3 | Replace or document |
| Settings from nav | Links don’t open modal | P2 | Nav opens modal or route |
| Notifications | Email stub only | P3 | Wire when needed |
| Content | Images, condition content, OSCE cases | P3 | Per master plan |

---

**Next steps:** Tackle P0 items first (navigation, pearl sync, social). Then add 404 and infographic/Wordle decisions. Use this doc as a living checklist and update as you close gaps.
