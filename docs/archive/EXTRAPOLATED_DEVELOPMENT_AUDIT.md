# Extrapolated Development Audit and Further Steps

**Date:** February 4, 2026  
**Scope:** Routes, navigation, API usage, accessibility, design system, and browser-relevant behavior after the 10-step improvement plan.

---

## 1. Routes and URL–View Sync

### 1.1 Implemented Routes (App.tsx)

| Path | View / Behavior |
|------|------------------|
| `/` | command_center |
| `/menu` | menu |
| `/study`, `/study/` | command_center |
| `/study/reference` | reference_library **(fixed in this audit)** |
| `/study/toolkit` | toolkit |
| `/admin` | AdminDashboard (full route) |
| `/clinical-eye` | ClinicalEyePage |
| `/visualizer` | VisualizerPage |
| `*` | Main app shell (view derived from path above or prior state) |

### 1.2 NavRail Quick Actions (Actual Links)

- Dashboard: `/study`
- Progress: `/study?tab=analytics`
- Start Session: `/study`
- Reference: `/study/reference` → now correctly sets `reference_library`
- Calculators: `/study/toolkit`
- Menu: `/menu`

### 1.3 Navigation Config vs Reality

`config/navigation.ts` (NAVIGATION_CONFIG and NAVIGATION_STRUCTURE) includes paths that **do not** map to any view or route in App:

| Path | Used By | Status |
|------|---------|--------|
| `/education` | NAVIGATION_CONFIG | No route; would show command_center |
| `/study/reference` | NavRail, config | **Fixed** – now syncs to reference_library |
| `/settings` | NAVIGATION_CONFIG | No route |
| `/subscription` | NAVIGATION_CONFIG | No route |
| `/stats` | NAVIGATION_STRUCTURE | No route |
| `/education/adaptive`, `/education/qbank`, `/education/simulator`, `/education/cases` | NAVIGATION_STRUCTURE | No routes |
| `/reference/conditions`, `/reference/drugs`, `/reference/diagnostics`, `/reference/guidelines` | NAVIGATION_STRUCTURE | No routes |
| `/skills/terminology`, `/skills/rapid`, `/skills/visuals` | NAVIGATION_STRUCTURE | No routes |

**Recommendation:** Either (a) add path→view sync (or real routes) for these in App and implement corresponding views, or (b) trim `config/navigation.ts` to only paths that exist so no dead links are shown (AppSidebar is deprecated; NavRail is source of truth).

---

## 2. Broken or Risky Navigation (Fixed in This Audit)

### 2.1 Gap Analysis “Study Now”

- **Before:** `navigate(\`/quiz?system=${systemName}\`)` – no `/quiz` route; user stayed on same URL or saw wrong content.
- **After:** `GapAnalysisDashboard` accepts optional `onStudySystem(systemName)`. App passes a callback that sets view to `command_center` and calls `handleConfirmSession({ focus: 'topic', topic: systemName, count: INITIAL_QUEUE_SIZE })` so a topic-focused session starts correctly.

### 2.2 Reference Link in NavRail

- **Before:** NavRail “Reference” linked to `/study/reference` but App did not set view to `reference_library`, so content did not change.
- **After:** App path sync includes `location.pathname.startsWith('/study/reference')` → `setView('reference_library')`.

### 2.3 ExplanationPanel Concept Links

- **Before:** `href={\`/concepts/${link.conceptId}\`}` with `target="_blank"` – `/concepts/:id` has no route; new tab 404.
- **After:** `href={\`#concept-${link.conceptId}\`}` (in-page anchor), removed `target="_blank"`, added `aria-label`. A future step can add a real `/concepts/:id` route or a concept detail view.

---

## 3. API and Auth Audit (Post–10-Step)

### 3.1 Endpoints That Now Use Auth / getApiEndpoint

- Dashboard retention: `DashboardPage` – auth-aware fetcher for `/api/stats/retention`.
- Mnemonic: `MnemonicGenerator` – uses `/api/ai/generate-mnemonic` with Bearer token.
- Retention widget: `RetentionWidget` – `getApiEndpoint('/api/srs/stats')` + auth.
- Gap Analysis: `GapAnalysisDashboard` – `getApiEndpoint(API_ENDPOINTS.ANALYTICS_PERFORMANCE_DELTAS)` + auth.
- User stats / stability: `AnalyticsDashboard`, `UserFriendlyStatsDisplay` – auth already present.

### 3.2 Endpoints Still Marked “NEEDS REVIEW” (Auth Header Audit)

- StudyGroupDashboard: `/api/social/groups`, `/api/social/leaderboard`, `/api/social/groups/join` – confirm Cloudflare equivalents require auth and that requests send Bearer token.
- SmartReviewMode: `/api/drills/smart-review`, `/api/drills/submit-review` – idem.
- Drill/mode endpoints (SystemDrillSession, PharmacologyDrillSession, DrillSetup, GrandRoundsMode, etc.) – verify each Cloudflare function expects auth and that the client sends it.

### 3.3 Missing or Legacy-Only Endpoints

- `/api/ai/generate-mnemonic` – **added** as Cloudflare Function; no longer missing.
- `/api/stats/retention` – exists in `functions/api/stats/retention.ts`; client now sends auth.
- DashboardPage fetcher – now passes Authorization for retention.

---

## 4. Accessibility and UX

### 4.1 Skip Link and Main Content

- App includes “Skip to main content” (`href="#main-content"`) with visible focus styles – good.

### 4.2 Focus and Design Tokens

- UI design system forbids pure black; prefers semantic tokens and `--color-*`. Charts use blue-tinted grid lines and brand palette.

### 4.3 Buttons and Labels

- Some buttons (e.g. MnemonicGenerator copy/save) may lack `aria-label` or `title`; audit report noted “Buttons must have discernible text” for at least one case. Recommend a pass on all icon-only buttons.

### 4.4 Concepts Link

- ExplanationPanel concept links now have `aria-label={\`Review concept: ${link.title}\`}`.

---

## 5. Mobile and Layout

- NavRail collapses by default on narrow viewport (`max-width: 768px`).
- Main content uses `marginLeft: var(--nav-rail-width)` and responsive padding; `pb-20 sm:pb-24` keeps content above the rail on small screens.
- No separate “mobile menu” route – everything goes through the same views and NavRail.

---

## 6. Extrapolated Development Steps (Prioritized)

### Phase A: Navigation and Dead Links (High)

1. **Align config/navigation.ts with reality**  
   - Either remove or relabel paths that have no route (e.g. `/education`, `/stats`, `/settings`, `/subscription`, `/reference/*`, `/skills/*`) so they are not shown as primary nav, or add minimal path→view sync and placeholder views.

2. **Optional: /concepts/:id route**  
   - Add a route (e.g. `/concepts/:id`) and a small “Concept detail” view or redirect to reference/tutor, and point ExplanationPanel links back to `/concepts/${link.conceptId}` if desired.

3. **Deep-link support for key views**  
   - Consider syncing more views to URL (e.g. `/study/gap-analysis`, `/study/clinical-profile`, `/study/toolkit`) so back/forward and bookmarks work. Currently only `/`, `/menu`, `/study`, `/study/reference`, `/study/toolkit` drive view.

### Phase B: API and Auth Consistency (Medium)

4. **Social and drill endpoints**  
   - Ensure every fetch to `/api/social/*`, `/api/drills/*`, and mode-specific endpoints (e.g. Grand Rounds, Code Blue, Fluids, Antibiotics) sends `Authorization: Bearer <token>` when the Cloudflare function requires auth, and use `getApiEndpoint()` for base path.

5. **Centralized authenticated fetch**  
   - Introduce a small helper (e.g. `fetchWithAuth(url, getToken, options)`) used by DashboardPage, RetentionWidget, GapAnalysisDashboard, AnalyticsDashboard, and other authenticated calls to avoid duplication and missing headers.

6. **Error and retry UX**  
   - Where API calls can fail (sync, retention, analytics), ensure error state is inside a card/section with a retry control (per design system) and avoid full-page error when a single widget fails.

### Phase C: Analytics and Data Consistency (Medium)

7. **Analytics data sources doc**  
   - Already added: `docs/ANALYTICS_DATA_SOURCES.md`. Optionally add a short in-app “?” or tooltip on heatmap/analytics explaining “Uses your synced session data” vs “Server-calculated stats.”

8. **Performance record completeness**  
   - Verify that all session end paths (quiz, drills, simulation) write `focus`, `topic`, and `system` (where applicable) so heatmap and growth areas stay consistent with server stats.

### Phase D: Accessibility and Polish (Medium–Low)

9. **Icon-only buttons**  
   - Audit icon-only controls (copy, save, close, etc.) and add `aria-label` or `title` so they have discernible text.

10. **Focus visible**  
    - Confirm `:focus-visible` uses `--color-focus-ring` or `--color-accent` (no default browser outline only).

11. **Reduced motion**  
    - `useAccessibleTransition` and `useReducedMotion` exist; ensure heavy animations (e.g. view transitions, modals) respect `prefers-reduced-motion`.

### Phase E: Testing and Regression (Ongoing)

12. **E2E critical paths**  
    - Add or extend Playwright tests for: (1) sign-in → sync → start session → answer → end; (2) NavRail Reference → reference library visible; (3) Gap Analysis → “Study Now” → session starts with correct topic; (4) onboarding flow completion.

13. **Unit tests for new behavior**  
    - Tests for sync response shape and session/config shapes already added; add tests for any new `path→view` logic or `onStudySystem` callback behavior if refactored further.

### Phase F: Documentation and Maintenance (Low)

14. **Route map**  
    - Keep a single “Route map” doc (or section in this file) updated when adding/removing routes or path→view rules.

15. **Deprecated sidebar**  
    - `AppSidebar` and `Sidebar` are deprecated in favor of NavRail; consider removing or clearly marking as “demo/legacy” so new code does not add links there.

---

## 7. Browser Audit Note

A browser-based audit was attempted via the cursor-ide-browser MCP. The app was opened at `http://localhost:3000/` (PANaCEa title confirmed). Snapshot content was not available in this context. The above findings are from static analysis of routes, navigation config, and component code. For a full browser audit, run the app locally and manually (or with Playwright) verify:

- All NavRail links update URL and content.
- Gap Analysis “Study Now” starts a topic session.
- Reference opens the reference library view.
- No 404s on primary user paths.
- Auth-required API calls succeed when signed in and fail with 401 when not.

---

## 8. Summary of Changes Made in This Audit

| Item | Change |
|------|--------|
| Path→view sync | `/study/reference` → `reference_library` |
| Gap Analysis “Study Now” | `onStudySystem` callback from App; starts topic session instead of navigating to `/quiz` |
| ExplanationPanel concept links | `href` to `#concept-${id}`, removed `target="_blank"`, added `aria-label` |
| Doc | This extrapolated development audit and prioritized phases |

All high-priority navigation bugs identified in the audit are addressed. Remaining steps are documented above for future sprints.
