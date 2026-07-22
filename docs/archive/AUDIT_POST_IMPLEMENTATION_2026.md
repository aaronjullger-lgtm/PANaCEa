# Post-Implementation Audit (Feb 2026)

**Role:** Senior Full-Stack Architect & Quality Assurance Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness/scalability, refactoring opportunities for the recent UX/accessibility/data-permanence work.

**Status:** The three critical fixes were implemented (Archive & Reset in Settings, PatientEncounterMode try/catch, ExplainabilityTooltip a11y). The two copy-related logical omissions were also addressed: SessionEndSummary button now says "Review X To Review", and WeaknessCheatsheetExporter HTML export uses "Incorrect X time(s)" instead of "Missed X time(s)". Technical-debt items (centralize labels, document fix.modeIds and reduced-motion) remain as optional follow-ups.

---

## * Critical Fixes

### 1. **Archive & Reset flow not implemented in Settings UI**

**Plan stated:** Data Management should offer a **primary** action "Archive & Reset" (download archive, then clear data; no extra confirmation) and a **secondary** action "Clear permanently…" (type DELETE to confirm).

**Current state:** `exportArchive` is implemented in `lib/analyticsExport.ts` and imported in `components/modals/SettingsStatsModal.tsx`, but **it is never called**. The Performance Data section only has a single path: "Clear Performance Data…" → type DELETE → "Confirm Clear". There is no one-click "Archive & Reset" that downloads the archive and then clears data.

**Fix:** In `SettingsStatsModal.tsx` Data Management section, add a primary "Archive & Reset" button that (1) calls `exportArchive(performanceData)` (and if `performanceData.length === 0`, show a toast and return without clearing), (2) then calls `clearPerformanceData()`. Keep the existing "Clear Performance Data…" / type DELETE flow as the secondary destructive option (e.g. "Clear permanently…").

### 2. **PatientEncounterMode: unhandled promise rejection leaves user stuck in `loading_encounter`**

**Location:** `components/modes/PatientEncounterMode.tsx` — `handleStartEncounter`.

**Issue:** If `getToken()` or `getRandomEncounterCase(token)` **throws** (e.g. network error, backend down), the code never calls `setViewState('landing')` or `setIsLoading(false)`. The user remains on the loading-encounter screen with no way to recover except refresh.

**Fix:** Wrap the entire async body of `handleStartEncounter` in `try/catch`. In `catch`: set `setLoadError(...)`, `setViewState('landing')`, `setIsLoading(false)`.

### 3. **ExplainabilityTooltip: accessible name on the button**

**Location:** `components/ui/ExplainabilityTooltip.tsx`.

**Issue:** The focusable element is a `<span role="button">`. The accessible name is only on the child `<Info aria-label={ariaLabel} role="img" />`. Some assistive technologies expect the button element itself to have the label. The spec recommends the interactive element (the button) to have the accessible name.

**Fix:** Add `aria-label={ariaLabel}` to the `<span role="button">`, and set `aria-hidden="true"` on the `<Info>` icon so the button is announced once (e.g. "How is this calculated?, button").

---

## * Logical Omissions

### 1. **SessionEndSummary still says "Review X Missed"**

**Location:** `components/quiz/SessionEndSummary.tsx` — button label: `Review {overallStats.incorrect} Missed`.

**Omission:** The plan renamed "Missed Questions" to "To Review" across the app. This button was not updated and still uses "Missed".

**Suggestion:** Change to e.g. "Review X To Review" or "Review X incorrect" (or "Review X questions" if you want to avoid repeating "To Review").

### 2. **WeaknessCheatsheetExporter HTML export still uses "Missed" in body**

**Location:** `components/analytics/WeaknessCheatsheetExporter.tsx` — generated HTML: `Missed ${data.count} time${...}`.

**Omission:** The component was reframed as "Yield Optimization"; the exported HTML still says "Missed X time(s)" per condition.

**Suggestion:** Replace with e.g. "Incorrect X time(s)" or "To review: X time(s)" for consistency with the new framing.

### 3. **Archive & Reset when there is no data**

**Location:** `lib/analyticsExport.ts` — `exportArchive` does `if (performanceData.length === 0) { console.warn(...); return; }`.

**Omission:** When you add the "Archive & Reset" button, if the user has no performance data, calling `exportArchive` will do nothing (no file) and then clearing would still run. That could be confusing. The UI should either disable "Archive & Reset" when `performanceData.length === 0`, or call export only when there is data and show a toast when there is nothing to archive.

---

## * Technical Debt

### 1. **Duplicate / scattered copy strings**

- "To Review" appears in many files (`SettingsStatsModal`, `CommandCenterHub`, `TodoistExportModal`, `TodoistExportPanel`, `AnkiExportPanel`, `MenuView`, `QuickReviewMode`, etc.). "Clear To Review…", "To Review Study Guide", "To Review Only", etc. are not centralized.
- **Suggestion:** Introduce a small shared constants or copy module (e.g. `constants/labels.ts` or `copy/dataManagement.ts`) with keys like `TO_REVIEW_LABEL`, `CLEAR_TO_REVIEW`, `ARCHIVE_AND_RESET`, and use them in modals and navigation so future renames and i18n are easier.

### 2. **STUDY_OUTCOME_GROUPS.fix.modeIds is always []**

**Location:** `config/training-modes.ts` — `fix.modeIds: []` with a comment that the "Fix My Weaknesses" CTA is handled specially in the UI.

**Debt:** If someone later adds mode IDs to `fix.modeIds`, the Command Center "Fix My Weaknesses" block would need to render both the special "Focus on my weak areas" CTA and the list of modes. Right now it only renders the CTA. Consider a short comment in `CommandCenterHub.tsx` where the fix group is rendered, e.g. "fix.modeIds is intentionally empty; fix is handled by the weak-areas CTA only."

### 3. **useSupabase token failure is only logged**

**Location:** `hooks/useSupabase.ts` — on `getToken()` failure, the code `console.error`s and returns `null`. Callers may not handle a Supabase client that later sends unauthenticated requests.

**Debt:** Document that the client can be "anonymous" when the token is null, and ensure any RLS-protected usage either checks auth state or handles 403s. No code change required immediately if RLS and UI already handle it.

### 4. **index.css and component-level reduced motion**

**Current state:** Global `@media (prefers-reduced-motion: reduce)` in `index.css` forces very short durations site-wide. Several components also use `useReducedMotion()` and set Framer `duration: 0` or `initial: false`.

**Debt:** Slight duplication between global CSS and component logic. Acceptable for robustness (defense in depth). Optional: document in one place (e.g. accessibility doc) that both global and component-level handling exist and why.

---

## * Verification Steps

1. **Data Management (Settings)**  
   - Open Settings → Stats (or tab where Data Management lives).  
   - Confirm Performance Data section shows record count and **two** actions once implemented: "Archive & Reset" (primary) and "Clear permanently…" (type DELETE).  
   - With 0 records: "Archive & Reset" should either be disabled or show a toast and not clear.  
   - With data: "Archive & Reset" should download `panacea-archive_<timestamp>.json` and then clear performance data.  
   - "Clear permanently…" should still require typing DELETE and then clear.

2. **Virtual OSCE (Patient Encounter)**  
   - Start an encounter; confirm loading shell and rotating status messages appear.  
   - Simulate failure: e.g. disconnect network before "Start Interview", or point backend to an invalid URL — confirm you return to landing with an error message and are not stuck on loading.  
   - In a successful run, confirm transition from loading to active encounter and that typing indicator shows rotating messages during AI response.

3. **Explainability tooltips**  
   - Find a "Predicted PANCE Score" or "Estimated PANCE Score" or calibration copy that has the (i) icon.  
   - Focus the icon with keyboard and trigger with Enter/Space; confirm tooltip shows and the button is announced (e.g. "How is this calculated?, button").  
   - After fixing: confirm the button has `aria-label` and the icon is `aria-hidden`.

4. **Focus management**  
   - Open Settings from the main view (e.g. gear icon), then close the modal (Escape or close button).  
   - Confirm focus returns to the Settings button so the next Tab focuses the next element after the button.

5. **Reduced motion**  
   - Enable "Reduce motion" in OS (e.g. macOS Accessibility → Display → Reduce motion).  
   - Reload app; confirm no prolonged animations (e.g. QuickStatsBar, ModeCard, streaks, GlassCard).  
   - Confirm loading/typing status messages in Patient Encounter still update (only duration/visual motion should be reduced, not logic).

6. **Training / Study Now flow**  
   - From Command Center, use "Study Now" and confirm the "What do you want to focus on?" screen with Learn / Test / Fix groups.  
   - Confirm "Focus on my weak areas" under Fix starts a session with growth areas or incorrect focus when available.

7. **Copy consistency**  
   - After applying the SessionEndSummary and WeaknessCheatsheetExporter copy changes, do a quick grep for user-facing "Missed" and confirm only intentional uses remain (e.g. "Missed Critical Cues" in OSCE debrief).

8. **Environment and API**  
   - In `functions/`, confirm no `process.env`; all env access via `context.env` (or validated `env` from context).  
   - Run a production build and smoke-test key API routes (e.g. stats, generate, sync) with required env set.

---

## Summary

| Category           | Count | Notes |
|--------------------|-------|--------|
| Critical fixes     | 3     | Archive & Reset in UI; PatientEncounterMode try/catch; ExplainabilityTooltip aria-label on button. |
| Logical omissions  | 3     | SessionEndSummary and export HTML copy; empty-data behavior for Archive & Reset. |
| Technical debt     | 4     | Centralize labels; document fix.modeIds and reduced-motion strategy; useSupabase behavior. |
| Verification steps | 8     | Data Management, OSCE, tooltips, focus, reduced motion, Study Now, copy, env/API. |

Implementing the three critical fixes and the suggested copy/empty-data behavior will align the app with the original plan and reduce risk of stuck states and accessibility issues. The verification steps should be run before release.
