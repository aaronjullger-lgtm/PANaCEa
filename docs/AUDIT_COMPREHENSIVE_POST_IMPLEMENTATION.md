# Comprehensive Post-Implementation Audit

**Role:** Senior Full-Stack Architect & Quality Assurance Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness, refactoring.  
**Reference plans:** `AUDIT_CORE_SESSION_CHECKLIST.md`, `AUDIT_VIRTUAL_OSCE_AI_PATIENT.md`, `AUDIT_CLINICAL_FIDELITY.md`, `OSCE_GRADING_AUDIT.md`.

---

## Critical Fixes

### 1. **Storage key inconsistency (panacea vs panceai)**

**Location:** `lib/storage/storageRegistry.ts` vs `contexts/CommuterContext.tsx`, `components/toolkit/ToolkitHub.tsx`

**Issue:** The registry defines `COMMUTER_MODE: 'panacea_commuter_mode'` and `COMMUTER_SETTINGS: 'panacea_commuter_settings'` (and other `panacea_*` keys). `CommuterContext` uses `'panceai_commuter_mode'` and `'panceai_commuter_settings'`. Any code that uses `StorageKeys.COMMUTER_MODE` would read/write a **different** key than the app, so commuter state would not sync. `ToolkitHub` uses `'panceai_recent_calculators'` / `'panceai_pinned_calculators'` directly while the registry has `'panacea_recent_calculators'` / `'panacea_pinned_calculators'`.

**Fix:** Align on one prefix. Either (a) change the registry to `panceai_*` for all user-facing keys (recommended for consistency with the rest of the app), or (b) change CommuterContext and ToolkitHub to use `StorageKeys` and fix the registry values. Then use the registry everywhere for these keys so future renames are in one place.

---

### 2. **CaseRubric fallback in grading (implemented)**

**Location:** `functions/api/osce/analysis/grade.ts` → `resolveSessionAndRubric()`

**Current behavior:** Grading no longer requires a `CaseRubric` to exist. If no rubric is found, the API builds a fallback checklist from case `essentialQuestions` and `idealWorkup`, then continues grading and persists `OsceResult`.

**Status:** Implemented via in-handler fallback rubric construction. A seeding/admin rubric-management path is still useful for rubric consistency, but not required for endpoint availability.

---

### 3. **Grade API invocation on end encounter (implemented)**

**Location:** `components/modes/PatientEncounterMode.tsx` → `handleEndEncounter()`

**Current behavior:** On "End Encounter," the flow completes the session and then calls `POST /api/osce/analysis/grade`, so rubric checklist data and `redFlagsMissed` are fetched in the results flow.

**Status:** Implemented with correct sequencing (`complete` → `analysis/grade`), preserving `OsceResult` as the source of truth.

---

### 4. **XSS surface: rationale and HTML rendered without sanitization**

**Location:** `components/session/QuizView.tsx`, `components/panels/ExplanationPanel.tsx`

**Issue:** `dangerouslySetInnerHTML` is used for `currentQuestion.rationale`, table HTML, pearls, and explanation bullets. Rationale is generated server-side (Gemini), so risk is lower than user input, but (a) a compromised or buggy generator could emit script, and (b) any future user-editable or external content would be unsafe. The codebase uses `stripHtmlTags` in `geminiService` for options/condition but not for all HTML rendered in the client.

**Fix:** (1) Sanitize all content before passing to `dangerouslySetInnerHTML` (e.g. allow only a small tag set: `<b>`, `<i>`, `<br>`, `<table>`, etc., and strip script/event handlers). Consider a small client-side sanitizer or a shared `sanitizeForRationale()` that strips dangerous tags. (2) Ensure every generator path that produces rationale/HTML runs through the same sanitization or tag allow-list before storage/display.

---

## Logical Omissions

### 1. **Plan vs implementation gaps (from audit checklists)**

| Item | Plan | Current state |
|------|------|----------------|
| Normal Lab Reference | Slide-out "Normal Labs" panel during questions | Not implemented; no drawer/panel in QuizView. |
| "Vague" Patient AI | OSCE patient initially non-medical, requires OPQRST | Partial; no explicit lay-language / withhold-medical-terms rule in `chatWithPatientSimulator`. |
| Specific Exam Triggers | Only reveal findings for requested body systems | Vulnerability; "full physical exam" can dump all findings; no strict one-maneuver-one-finding rule. |
| Critical Action Grading | Grade and show checklist (e.g. "Ordered EKG") | Logic and API exist; grade API not called from results; checklist not shown. |
| Distractor Explanations | Explanations address why wrong answers are wrong | Generation requires it; main session shows single rationale string; structured rationale UI not used in QuizView. |
| Commuter: hide timer | Hide countdown when Commuter Mode is on | Timer always shown; QuizView does not use `useCommuter()` to hide timer. |
| EMR tabbed layout | Tabbed HPI \| PMH \| Meds \| Labs when EMR toggle on | Toggle exists; tabbed layout not implemented (single scroll in Patient Encounter). |

Address these in order of product priority (e.g. Critical Action Grading and Specific Exam Triggers for OSCE; Normal Labs and Commuter timer for main session).

---

### 2. **Session completion before grade**

**Location:** Grade API requires `session.status === 'completed'`.

**Issue:** If the front end calls the grade API before calling the complete endpoint (or before the session is persisted as completed), grading returns 400. The current flow does not call the grade API at all; once it does, the sequence must be: (1) complete session (status = completed), (2) then call grade. Document or enforce this order (e.g. in `handleEndEncounter`, await `completeOSCESession` then call grade).

---

### 3. **ConceptGap.system schema comment outdated**

**Location:** `prisma/schema.prisma` → `ConceptGap.system`

**Issue:** Comment says `// e.g. "Cardiology", "Pulmonary"` but `inferSystemFromCase` in the grade API stores lowercase values (`cardiovascular`, `pulmonary`, etc.). Downstream code may rely on the enum-style values. Comment should match reality to avoid future misuse.

**Fix:** Update the comment to e.g. `// e.g. "cardiovascular", "pulmonary" (lowercase, matches OrganSystemSchema)`.

---

## Technical Debt

### 1. **Clinical fidelity settings: duplicated load/save**

**Location:** `components/modes/PatientEncounterMode.tsx` (loadClinicalFidelitySettings, localStorage key `panceai_clinical_fidelity`), `components/modals/SettingsStatsModal.tsx` (useState initializer + handleToggleClinicalFidelity reading/writing same key).

**Issue:** Two places parse and persist the same object. If the shape or key changes, both must be updated. Defaults and key are duplicated.

**Recommendation:** Extract a small module or hook, e.g. `useClinicalFidelitySettings()`, that reads from localStorage (or from `StorageKeys` once unified), returns `[settings, updateSetting]`, and persists on change. Use it in both PatientEncounterMode and SettingsStatsModal. Optionally add `panceai_clinical_fidelity` to `StorageKeys` and use it everywhere.

---

### 2. **Storage key registry not used consistently**

**Location:** `lib/storage/storageRegistry.ts` vs various components.

**Issue:** Many components use hardcoded `'panceai_*'` or `'panacea_*'` strings. The registry exists to avoid collisions and centralize keys but is not used for commuter mode, clinical fidelity, enabled systems, grand rounds, or toolkit calculators. This increases the chance of typos and key drift (e.g. panacea vs panceai).

**Recommendation:** (1) Fix registry values to match actual keys in use (or vice versa), then (2) migrate call sites to use `StorageKeys` (or a single wrapper) for commuter, clinical fidelity, and other shared keys so renames and migrations are in one place.

---

### 3. **Error handling in PatientEncounterMode**

**Location:** `components/modes/PatientEncounterMode.tsx` — multiple async handlers.

**Issue:** Several `catch` blocks only `console.error` and do not set a user-visible error state or toast, so the user may see a silent failure (e.g. save chat or complete session fails). One `.catch(() => '')` swallows errors entirely.

**Recommendation:** For user-facing actions (submit question, complete session, save chat, end encounter), set an error state or trigger a toast on failure so the user knows something went wrong. Avoid empty `.catch()`; at least log and optionally set error state.

---

### 4. **Duplicate “resolve user by clerkId” in OSCE APIs**

**Location:** `functions/api/osce/complete.ts`, `chat.ts`, `history.ts`, `analysis/grade.ts` — each resolves `user` via `prisma.user.findUnique({ where: { clerkId: auth.userId } })`.

**Issue:** Same snippet repeated in four handlers. If the resolution logic or error handling changes (e.g. map multiple auth providers), four places must be updated.

**Recommendation:** Extract a small helper, e.g. `resolveUserByClerkId(prisma, clerkId)` returning `{ id }` or null, and use it in all OSCE endpoints. Optionally reuse the same pattern from a shared middleware or helper used by other authenticated endpoints.

---

## Verification Steps

**Run these to confirm stability and security:**

1. **OSCE ownership**
   - As User A, start an OSCE session and note `sessionId`.
   - As User B (different account), call `POST /api/osce/complete` and `POST /api/osce/chat` with User A’s `sessionId` using wrapped bodies (`{ body: { ... } }`). Expect 404 (not 200).
   - As User B, call `GET /api/osce/history?sessionId=<A's sessionId>`. Expect 404.

2. **Grading and CaseRubric**
   - Complete an OSCE session for a case that has **no** `CaseRubric`. Call `POST /api/osce/analysis/grade` with that sessionId. Expect **200** with fallback checklist grading.
   - For a case that **has** a rubric, complete the session then call the grade API. Expect **200** and a body with `checklist`, `redFlagsMissed`, `score`.

3. **Commuter Mode and storage**
   - Enable Commuter Mode in Settings. Reload the app. Confirm commuter mode is still enabled (read from same key).
   - Open DevTools → Application → Local Storage. Confirm the key used is the one you intend (e.g. `panceai_commuter_mode`). If the registry uses `panacea_commuter_mode`, confirm whether any code path uses the registry key; if not, fix registry or call sites.

4. **Timer visibility**
   - Start a main-session quiz. Confirm the question timer is visible.
   - Enable Commuter Mode, start a quiz again. Currently the timer remains visible; after implementing the “hide timer in Commuter Mode” feature, confirm it is hidden.

5. **Patient Encounter end-to-end**
   - Start a Virtual OSCE, send a few history messages, then type “I do a full physical exam.” Note whether the AI returns only one system’s findings or dumps all; after implementing the “specific exam triggers” rule, it should ask “Which part?” or return only one system.
   - End the encounter. Confirm results show Preceptor feedback. After wiring the grade API, confirm results also show checklist (PASS/FAIL per item) and red flags missed.

6. **Environment variables (Cloudflare)**
   - Deploy to Cloudflare Pages and run an OSCE completion and a grade request. Confirm no reliance on `process.env` in the Functions code path (only `context.env`). If any function uses `process.env` for required config, replace with `context.env` and configure in the dashboard.

7. **Rationale display**
   - Answer a question and open the rationale. Confirm it renders without layout/script errors. If possible, inject a string with `<script>alert(1)</script>` into a rationale (e.g. via a test or staging generator) and confirm it does not execute (sanitization or CSP).

---

## Summary Table

| Category | Item | Severity | Status |
|----------|------|----------|--------|
| Critical | Storage key panacea vs panceai | High | Open |
| Critical | CaseRubric fallback for grading | Medium | Implemented |
| Critical | Grade API call wired to end encounter flow | Medium | Implemented |
| Critical | XSS surface on rationale/HTML | Medium | Open |
| Omission | Normal Labs panel | Medium | Not implemented |
| Omission | Vague patient AI / OPQRST | Medium | Partial |
| Omission | Specific exam triggers | Medium | Vulnerability |
| Omission | Commuter hide timer | Low | Not implemented |
| Omission | EMR tabbed layout | Low | Not implemented |
| Omission | Distractor explanations in main session UI | Low | Partial |
| Debt | Clinical fidelity settings DRY | Low | Duplicated |
| Debt | Storage registry consistency | Low | Inconsistent |
| Debt | Silent errors in PatientEncounterMode | Low | Partial |
| Debt | Resolve user by clerkId repeated | Low | DRY |

---

## References

- `docs/AUDIT_CORE_SESSION_CHECKLIST.md`
- `docs/AUDIT_VIRTUAL_OSCE_AI_PATIENT.md`
- `docs/AUDIT_CLINICAL_FIDELITY.md`
- `docs/OSCE_GRADING_AUDIT.md`
- `docs/ENDPOINT_SECURITY_PRIORITY.md`
- `functions/api/osce/` (complete, chat, history, analysis/grade)
- `components/modes/PatientEncounterMode.tsx`
- `contexts/CommuterContext.tsx`
- `lib/storage/storageRegistry.ts`
