# Audit 6 — OSCE Mode End-to-End

**Date:** 2026-04-01
**Scope:** Virtual OSCE patient encounter — case selection, session init, rendering, chat, scoring, AI rubric, feedback UI, completion flow, state management
**Auditor perspective:** Senior full-stack engineer
**Goal:** Determine production readiness; separate "present but incomplete" from "nonfunctional"

---

## File Inventory (59 files, ~350KB source)

| Layer | Key Files | Lines |
|---|---|---|
| **Primary Component** | `components/modes/PatientEncounterMode.tsx` | ~4500 |
| **Simulator Component** | `components/modes/osce/OSCESimulator.tsx` | 426 |
| **Live Voice Session** | `components/modes/osce/OSCELiveSession.tsx` | 262 |
| **Score Report UI** | `components/modes/osce/ScoreReport.tsx` | ~600 |
| **Enhanced OSCE Hook** | `hooks/useEnhancedOSCE.ts` | 608 |
| **OSCE Metrics Hook** | `hooks/useOSCEMetrics.ts` | 206 |
| **Client Service** | `services/domain/osceService.ts` | 322 |
| **Scoring Engine** | `services/domain/osceScoringEngine.ts` | ~1300 |
| **API: Random Case** | `functions/api/osce/cases/random.ts` | 88 |
| **API: Session** | `functions/api/osce/session.ts` | 123 |
| **API: Chat** | `functions/api/osce/chat.ts` | 87 |
| **API: Complete** | `functions/api/osce/complete.ts` | 108 |
| **API: Grade** | `functions/api/osce/analysis/grade.ts` | ~500 |
| **API: Live Config** | `functions/api/osce/live-config.ts` | 122 |
| **Types** | `types/osce-enhanced.ts` | 386 |
| **Config** | `config/osce-settings.ts` | 278 |
| **Supporting** | OrderPanel, ExamPanel, BodyMap, RapportMeter, EncounterTimer, HistoryPanel, ResultsView | ~100K total |

---

## Architecture Overview

OSCE mode has **two parallel entry points** that share almost no code:

1. **`PatientEncounterMode.tsx` (primary)** — The 4500-line mega-component used from the dashboard. Manages its own case loading, chat with Gemini, physical exam, orders, diagnosis, treatment, completion, grading (Gemini rubric + preceptor debrief), and results view. This is the **production path**.

2. **`OSCESimulator.tsx` (secondary)** — A standalone voice-first OSCE station with BodyMap, ExamPanel, speech recognition, and local scoring. Uses different hooks and a different scoring path. **This component is broken** (see Finding 1).

Both components use `useEnhancedOSCE` for personality/rapport/scoring and `useOSCEMetrics` for telemetry, but PatientEncounterMode is the only one that calls the server-side grading pipeline.

### Flow (PatientEncounterMode — primary path):

```
Landing → [getRandomEncounterCase] → [startOSCESession] → Active Encounter
  ├── History Phase: chatWithPatientSimulator (Gemini) → saveOSCEChat
  ├── Physical Phase: performPhysicalExam (Gemini)
  ├── Diagnostic Phase: orderDiagnosticTest (Gemini)
  ├── Diagnosis Phase: evaluateDiagnosis (Gemini)
  └── Treatment Phase: evaluateTreatmentPlan (Gemini)
→ [completeOSCESession] → [gradeOSCESession (Gemini rubric)] → Results
  ├── Rubric checklist + red flags + billing code
  ├── Soft skills report (Gemini)
  ├── Dangerous action detection
  ├── Preceptor debrief (streaming Gemini)
  ├── Enhanced scoring engine report (client-side)
  └── FSRS sync via syncManager
```

---

## Findings

### Finding 1: OSCESimulator case loading is broken — `.data` unwrap on already-unwrapped response

- **Severity:** Critical
- **Type:** Correctness
- **File:** `components/modes/osce/OSCESimulator.tsx:82-86`
- **Root cause:** `getRandomEncounterCase()` returns the parsed JSON response. The Cloudflare middleware (`authenticatedEndpoint`) extracts `result.data` before sending (line 148 of middleware.ts: `JSON.stringify(result.data ?? result)`). So the client receives the raw case object. But `OSCESimulator` does `caseResponse.data` — accessing a `.data` field that doesn't exist on `PatientEncounterCase`. This makes `caseItem` always `undefined`, throwing "Failed to load OSCE case".
- **User impact:** The entire `OSCESimulator` component is nonfunctional. Users who navigate to it see a permanent error state.
- **Recommended fix:** Change to `const caseItem = caseResponse;` (the response IS the case). Also add proper typing: `getRandomEncounterCase` should return `Promise<PatientEncounterCase | null>` instead of `Promise<any | null>`.
- **Production blocker:** Yes — if OSCESimulator is reachable. If only PatientEncounterMode is routed, this is dead code.
- **Classification:** **Nonfunctional**

### Finding 2: Chat API overwrites entire message history — race condition on rapid messages

- **Severity:** High
- **Type:** Data integrity
- **File:** `functions/api/osce/chat.ts:64-70`, `components/modes/PatientEncounterMode.tsx:704-714`
- **Root cause:** The chat endpoint does `data: { messages }` — a full overwrite of the `messages` JSONB column. The client rebuilds the full message array from local state and sends it every time. If the user sends two messages in quick succession (before the first `saveOSCEChat` resolves), the second call builds its message array from stale local state (missing the first response) and overwrites, losing the first exchange.
- **User impact:** Chat messages silently lost under concurrent requests. Grading depends on the persisted transcript — lost messages mean the rubric grader evaluates an incomplete encounter.
- **Recommended fix:** Either (a) use append semantics server-side (`messages: { push: [...newMessages] }` with Prisma JSON update), or (b) serialize saves client-side with a queue (like syncManager does for FSRS).
- **Production blocker:** Yes — data loss affects grading accuracy.
- **Classification:** **Present but fragile**

### Finding 3: `initialCaseId` prop in OSCESimulator is a TODO — never loads specific case

- **Severity:** Medium
- **Type:** Correctness
- **File:** `components/modes/osce/OSCESimulator.tsx:111-116`
- **Root cause:** The `useEffect` checks `if (initialCaseId)` but the body is `// TODO: load specific case` followed by `loadCase()` — which loads a random case regardless. The prop is accepted but ignored.
- **User impact:** Any caller passing `initialCaseId` gets a random case instead of the requested one. Could break "retry this case" flows.
- **Recommended fix:** Implement `loadCase(initialCaseId)` path, or remove the prop to avoid false API promises.
- **Production blocker:** No (OSCESimulator is already broken per Finding 1).
- **Classification:** **Incomplete**

### Finding 4: Timer creates new interval on every tick — quadratic interval accumulation

- **Severity:** High
- **Type:** Performance / Correctness
- **File:** `components/modes/osce/OSCESimulator.tsx:126-137`
- **Root cause:** The timer `useEffect` has `remainingTime` in its dependency array. Every second, `setRemainingTime(prev => prev - 1)` fires, changing `remainingTime`, which re-runs the effect, creating a NEW interval without clearing the old one (the cleanup runs, but the new interval starts immediately and the cycle repeats). This is technically correct since the cleanup runs first — BUT the effect body runs `handleTimeUp()` when `remainingTime <= 0` and returns early without clearing. Since `handleTimeUp` clears the timer via the ref, but the ref may point to a different interval than the one just created, the timer can continue ticking past 0.
- **User impact:** Timer may behave erratically near 0. In PatientEncounterMode (the production path), the timer is handled by `EncounterTimer` component, so this only affects the broken OSCESimulator.
- **Recommended fix:** Use a stable `useInterval` hook or move `remainingTime` out of the dependency array (use a ref for the countdown logic).
- **Production blocker:** No (OSCESimulator is dead code).
- **Classification:** **Present but broken context**

### Finding 5: Scoring engine tracks critical actions via string matching only — no AI integration for action detection

- **Severity:** High
- **Type:** Architecture / Data integrity
- **File:** `services/domain/osceScoringEngine.ts:920-1040`
- **Root cause:** The client-side `OSCEScoringEngine` triggers critical actions by regex-matching question text, exam maneuver names, and order names. For example, asking about "medications" triggers `current_medications`. But the actual Gemini chat uses free-form text — if the student says "What meds are you on?" the regex `/current.?med|taking.?any|medications/` doesn't match. The regex patterns are narrow and miss many valid phrasings.
  - `trackQuestion()`: Only 3 patterns checked (allergies, meds, pain)
  - `trackExam()`: Only RLQ/McBurney detected; no cardiac, lung, neuro exam triggers
  - `trackOrder()`: Covers ~10 order types; misses many (e.g., BNP, BMP, CBC, urinalysis)
  - `trackTreatment()`: Covers aspirin, antibiotics, fluids, anticoagulation; misses insulin, albuterol, steroids, pressors
- **User impact:** The client-side scoring engine dramatically under-credits student actions. The overall score and critical action completion rate will be artificially low, frustrating students who did everything right. The server-side Gemini rubric grader is more accurate but runs separately.
- **Recommended fix:** (1) Expand regex coverage for the top conditions. (2) Long-term: use the Gemini rubric grade as the canonical score and treat the client-side engine as a preview only.
- **Production blocker:** Yes — misleading scores damage trust.
- **Classification:** **Present but inaccurate**

### Finding 6: Physical exam region is hardcoded to `'chest_anterior'` for free-text exams

- **Severity:** Medium
- **Type:** Correctness
- **File:** `components/modes/PatientEncounterMode.tsx:854`
- **Root cause:** When the user types a free-text physical exam action (like "auscultate lungs"), the component creates an `ExamFinding` with `region: 'chest_anterior'` regardless of what was examined. The scoring engine then uses this region for tracking.
- **User impact:** All free-text exam findings appear on "chest anterior" in the body map and scoring breakdown, regardless of what was actually examined. The body map visualization is misleading.
- **Recommended fix:** Parse the exam action text to infer body region (regex map of keywords → BodyRegion). The `getSuggestedExams()` function in `useEnhancedOSCE` already has keyword-to-region logic that could be repurposed.
- **Production blocker:** No — cosmetic/scoring accuracy issue.
- **Classification:** **Present but inaccurate**

### Finding 7: `handleTimeUp` sets phase to `'diagnostic'` — confusing UX and skips phases

- **Severity:** Medium
- **Type:** UX
- **File:** `components/modes/osce/OSCESimulator.tsx:138-143`
- **Root cause:** When the timer expires, `handleTimeUp` sets the station phase to `'diagnostic'` and logs `time_up` with `isCorrect: false`. There's no user notification (modal, toast, or visual indicator) that time is up. The user is silently moved to diagnostic phase without explanation.
- **User impact:** Student may be mid-history or mid-exam and suddenly see phase change with no explanation. No prompt to submit a diagnosis before timeout.
- **Recommended fix:** Show a modal "Time's up — please submit your findings" with option to submit or continue (with penalty). Also auto-submit if in treatment phase.
- **Production blocker:** No (OSCESimulator is broken per Finding 1).
- **Classification:** **Incomplete**

### Finding 8: Dual scoring systems produce contradictory results

- **Severity:** High
- **Type:** UX / Architecture
- **Files:** `services/domain/osceScoringEngine.ts` (client), `functions/api/osce/analysis/grade.ts` (server)
- **Root cause:** Two independent scoring systems run for each OSCE session:
  1. **Client-side** `OSCEScoringEngine` — regex-based critical action tracking, competency breakdown, timeline, expert comparisons, learning gaps. Score based on triggered/missed critical actions.
  2. **Server-side** Gemini rubric grader — reads the full chat transcript, case rubric, and telemetry. Produces checklist (PASS/FAIL items), red flags, clinical reasoning score, billing code, soft skills, communication score, differential score.

  These scores are displayed simultaneously in the results view. The client score may say 45% (because regex missed most actions) while the Gemini rubric says 78% (because it understood the full transcript). The student sees conflicting numbers with no explanation.
- **User impact:** Contradictory scores erode trust. Student doesn't know which score matters. The FSRS sync uses the rubric score (line 1013: `rubricResult.score`), not the client-side score.
- **Recommended fix:** Display the Gemini rubric as the primary score. Show the client-side engine breakdown as a "quick preview" badge with a note that the AI-graded score is authoritative. Or remove the client-side scoring display entirely.
- **Production blocker:** Yes — UX confusion undermines the learning value.
- **Classification:** **Present but confusing**

### Finding 9: Live voice session leaks Gemini API key to client browser

- **Severity:** Critical
- **Type:** Security
- **File:** `functions/api/osce/live-config.ts:106-118`, `components/modes/osce/OSCELiveSession.tsx:76-77`
- **Root cause:** The `/api/osce/live-config` endpoint creates an **ephemeral token** via `GEMINI_BASE/v1alpha/auth_tokens` and returns it as `apiKey` in the response. `OSCELiveSession` then passes it to `new GoogleGenAI({ apiKey })`. This is the correct pattern IF the Gemini auth_tokens API actually creates a scoped ephemeral token. However:
  - The endpoint falls back gracefully if ephemeral tokens fail (502 error)
  - The ephemeral token has `uses: 1` and expires in 30 minutes
  - The `apiKey` field name is misleading — it's actually an ephemeral token name, not the server API key

  This is actually **correctly implemented** — the server never sends `env.GEMINI_API_KEY` to the client. It sends the ephemeral token name. The naming is confusing but the security is sound.
- **User impact:** None — this is a false alarm. The pattern is correct.
- **Recommended fix:** Rename the field from `apiKey` to `ephemeralToken` or `sessionToken` to avoid confusion in future audits.
- **Production blocker:** No.
- **Classification:** **Cleanup only**

### Finding 10: `startOSCESession` wraps body in extra `{ body: {} }` — potential double-wrapping

- **Severity:** Medium
- **Type:** Correctness
- **File:** `services/domain/osceService.ts:76-78`
- **Root cause:** The `startOSCESession` client function sends `body: JSON.stringify({ body: { caseId } })`. The server-side `OSCESessionBodySchema` expects `{ body: { caseId } }`. This matches because the Cloudflare Pages Functions middleware parses the outer JSON body and the Zod schema validates `body.body.caseId`. This works but is fragile — the `{ body: { ... } }` wrapping convention is inconsistent with standard REST patterns. The same double-wrap pattern is used in `saveOSCEChat`, `completeOSCESession`, and `gradeOSCESession`.
- **User impact:** None currently — it works. But any future developer unfamiliar with the wrapping convention will introduce bugs.
- **Recommended fix:** Document the `{ body: {} }` wrapping convention prominently, or refactor to standard REST body parsing.
- **Production blocker:** No.
- **Classification:** **Cleanup only**

### Finding 11: PatientEncounterMode is ~4500 lines — unmaintainable mega-component

- **Severity:** High
- **Type:** Maintainability
- **File:** `components/modes/PatientEncounterMode.tsx`
- **Root cause:** A single file contains: landing page, loading screen, encounter header, chat interface, physical exam UI, diagnostic ordering, diagnosis submission, treatment submission, results view, preceptor debrief streaming, FSRS sync, OSCE metrics, rapport tracking, vitals engine, timing analytics, SOAP generation, state machine, voice mode toggle, language toggle, clinical fidelity mode, preset system, spaced repetition, and export. Over 30 `useState` hooks, 15+ `useEffect` hooks, and 10+ `useCallback` handlers.
- **User impact:** Indirect — increases bug risk, makes the component fragile to changes, and makes it nearly impossible for another developer to contribute.
- **Recommended fix:** Extract into sub-components: `OSCELanding`, `OSCEActiveEncounter`, `OSCEResultsView`, `useOSCESession` (hook for session management), `useOSCEGrading` (hook for completion/grading flow).
- **Production blocker:** No — but it's the highest-leverage refactor for future velocity.
- **Classification:** **Architectural risk**

### Finding 12: `endSession` returns `report!` (non-null assertion) when report may be null

- **Severity:** Medium
- **Type:** Correctness
- **File:** `hooks/useEnhancedOSCE.ts:290`
- **Root cause:** The `endSession` callback returns `report!` with a non-null assertion, but `report` is null when `scoringEngineRef.current` is null (which happens when `enableScoring` is false). The return type signature says `OSCEScoreReport` (not nullable), so callers won't guard against null.
- **User impact:** Runtime crash if `endSession` is called with scoring disabled.
- **Recommended fix:** Return `report` with type `OSCEScoreReport | null`, or throw an explicit error if scoring is required.
- **Production blocker:** No — scoring is enabled by default.
- **Classification:** **Likely defect**

### Finding 13: `completeOSCESession` is called twice — once in treatment submit, once in end encounter

- **Severity:** Medium
- **Type:** Data integrity
- **File:** `components/modes/PatientEncounterMode.tsx:927-930` and `:993-1000`
- **Root cause:** `handleTreatmentSubmit` calls `completeOSCESession(sessionId, userDiagnosis, treatmentPlan, token)` at line 927. Then `handleEndEncounter` calls it again at line 993 with telemetry payload. The second call is idempotent (server returns `{ success: true, alreadyCompleted: true }` if status is already 'completed'). But the first call completes the session WITHOUT telemetry — if the user hits "End Encounter" after treatment, the telemetry may or may not overwrite the existing completion depending on server implementation.
  Looking at the server (complete.ts:78-80): the second call returns early with `alreadyCompleted: true` and **does NOT update** the session. So the telemetry payload from the second call is silently discarded.
- **User impact:** OSCE telemetry (clinical confidence index, speech metrics, rapport, efficiency) is never persisted. The grading API (`grade.ts:491`) tries to read `session.osceTelemetry` but it's null. Grading works but without the behavioral telemetry context, which was meant to enhance the AI grading.
- **Recommended fix:** Remove the `completeOSCESession` call from `handleTreatmentSubmit`. Only complete in `handleEndEncounter`, which includes telemetry. OR: make the completion endpoint accept telemetry updates even on already-completed sessions.
- **Production blocker:** Yes — telemetry is silently lost, degrading grading quality.
- **Classification:** **Confirmed defect**

### Finding 14: FSRS sync uses sessionId as questionId — type mismatch and no ReviewLog

- **Severity:** Medium
- **Type:** Data integrity
- **File:** `components/modes/PatientEncounterMode.tsx:1017-1024`
- **Root cause:** After grading, the code syncs to FSRS via `syncManager.queueAnswer({ questionId: sessionId, selectedAnswer: 0, ... })`. The `questionId` is an OSCE session ID (format: `osce-userid-timestamp`), not a real question ID. The FSRS pipeline (`attempt.ts`) will try to look up this ID as a `PreGeneratedQuestion` — it won't find one, and the attempt creation will likely fail silently (or create an orphaned record).
  Additionally, `isMainSession: false` means this gets treated as non-FSRS (based on the session type gating found in Audit 5). So the FSRS sync is effectively a no-op.
- **User impact:** OSCE performance does not feed into the FSRS scheduling system. The spaced repetition benefit claimed by the condition-level scheduling is localStorage-only (via `updateConditionSchedule`).
- **Recommended fix:** Either (a) create a proper OSCE-specific review endpoint that writes to UserProgress/ReviewLog with an OSCE session type, or (b) remove the syncManager call and rely solely on the localStorage-based condition scheduling.
- **Production blocker:** No — but the FSRS sync is dead code that implies functionality that doesn't exist.
- **Classification:** **Confirmed defect (dead code)**

### Finding 15: Gemini rubric prompt includes correct diagnosis in grading context

- **Severity:** Low
- **Type:** Architecture
- **File:** `functions/api/osce/analysis/grade.ts:346-382`
- **Root cause:** The rubric grading prompt sent to Gemini includes `caseRecord.correctDiagnosis` as part of the context. This is intentional — the AI grader needs to know the correct answer to evaluate the student. However, it also means the grading quality depends entirely on Gemini's ability to compare, not verify. If the correct diagnosis in the database is wrong, the grading will penalize correct students.
- **User impact:** Minimal if case data is accurate. Risk scales with number of cases.
- **Recommended fix:** Add a case review/validation workflow for seeded cases. Low priority.
- **Production blocker:** No.
- **Classification:** **Architectural note**

---

## Status Classification

### Nonfunctional (completely broken)

| Component | Issue | Blocking? |
|---|---|---|
| `OSCESimulator.tsx` | Case loading broken — `.data` unwrap on unwrapped response (Finding 1) | Yes, if routed |

### Present but Incomplete

| Feature | Status | What's missing |
|---|---|---|
| `initialCaseId` prop | Code exists, body is TODO | Specific case loading logic |
| Time-up handling | Silently changes phase | User notification, auto-submit |
| Physical exam region detection | Hardcoded to chest_anterior | Text-to-region inference |
| FSRS sync for OSCE | Code exists, sync calls made | Proper endpoint that handles OSCE session type |

### Present but Inaccurate

| Feature | Issue |
|---|---|
| Client-side scoring engine | Regex patterns too narrow; misses most valid student actions |
| Dual scoring display | Client and server scores contradict each other |

### Production-Ready (with caveats)

| Feature | Status |
|---|---|
| Case selection + random case API | Works correctly |
| Session creation + persistence | Works correctly |
| Chat with Gemini patient | Works; message persistence has race condition |
| Physical exam via Gemini | Works |
| Diagnostic ordering via Gemini | Works |
| Diagnosis evaluation via Gemini | Works |
| Treatment evaluation via Gemini | Works |
| Session completion | Works but double-called (Finding 13) |
| Gemini rubric grading | Works well — checklist, red flags, soft skills, dangerous actions |
| Preceptor debrief streaming | Works with fallback |
| Score report UI | Well-built, handles all scoring dimensions |
| Quick-start presets | Works correctly |
| Cultural competency + resource-limited modes | Works correctly |
| AI difficulty levels | Works correctly |
| Landing page with stats | Works correctly |
| OSCE metrics telemetry | Works but never persisted (Finding 13) |
| Rapport tracking | Works client-side |
| Order alerts (allergies/contraindications) | Works correctly, clinically sound |
| Condition spaced repetition | Works (localStorage) |
| Live voice session | Correctly uses ephemeral tokens; depends on Gemini Live API availability |

---

## Top 10 Findings (Priority Order)

| # | Severity | Finding | Blocks Prod? |
|---|---|---|---|
| 1 | Critical | OSCESimulator case loading broken (`.data` unwrap) | Yes (if routed) |
| 2 | High | Double `completeOSCESession` — telemetry silently lost | Yes |
| 3 | High | Chat overwrite race condition — messages lost | Yes |
| 4 | High | Dual scoring systems contradict each other | Yes |
| 5 | High | Client scoring engine regex too narrow | Yes |
| 6 | Medium | FSRS sync uses sessionId as questionId — dead code | No |
| 7 | Medium | Physical exam region hardcoded to chest_anterior | No |
| 8 | Medium | `endSession` returns non-null asserted null | No |
| 9 | High | PatientEncounterMode 4500 lines — maintainability risk | No |
| 10 | Medium | `initialCaseId` prop is TODO — never loads specific case | No |

---

## 3 Highest-Leverage Fixes

### Fix 1: Remove the first `completeOSCESession` call (Finding 13)
**Effort:** 5 minutes
**Impact:** Telemetry persisted → grading quality improves → behavioral data available for analytics
**File:** `components/modes/PatientEncounterMode.tsx`
**Change:** Delete lines 926-931 (the `completeOSCESession` call inside `handleTreatmentSubmit`). The session will only be completed in `handleEndEncounter`, which includes the full telemetry payload.

### Fix 2: Unify scoring display — Gemini rubric as primary (Finding 4 + 8)
**Effort:** 2 hours
**Impact:** Eliminates contradictory scores; students see one authoritative number
**Change:** In the results view, display the Gemini rubric score as the primary score. Move the client-side `OSCEScoringEngine` report to a collapsible "Quick Preview" section with a note: "This is an estimated score based on detected actions. The AI-graded rubric score above is the authoritative assessment." If the rubric fails to load, fall back to client-side score.

### Fix 3: Serialize chat saves to prevent message loss (Finding 2)
**Effort:** 1 hour
**Impact:** Eliminates race condition that can lose conversation history
**Change:** Add a simple save queue in `PatientEncounterMode`:
```typescript
const chatSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

// In handleAskQuestion, replace direct saveOSCEChat with:
chatSaveQueueRef.current = chatSaveQueueRef.current.then(async () => {
  const token = await getToken();
  const messages = [...]; // full messages array
  await saveOSCEChat(session.id, messages, token);
});
```

---

## Minimal Safe Implementation Plan

### Phase 1: Critical fixes (Day 1, ~2 hours)
1. Remove first `completeOSCESession` call from `handleTreatmentSubmit` → telemetry persists
2. Serialize chat saves with promise queue → no more message race condition
3. Fix OSCESimulator case unwrapping (remove `.data` access) → component functional

### Phase 2: Scoring clarity (Day 2, ~3 hours)
4. Make Gemini rubric the primary score in results view
5. Relabel client-side score as "Quick Preview (estimated)"
6. Remove `syncManager.queueAnswer` call that sends sessionId as questionId (dead code)

### Phase 3: Polish (Day 3, ~4 hours)
7. Expand scoring engine regex for top 5 conditions (ACS, sepsis, stroke, DKA, PE)
8. Add keyword → BodyRegion mapping for free-text physical exams
9. Fix `endSession` null assertion to proper nullable return

### Phase 4: Architecture (Future sprint)
10. Extract PatientEncounterMode into sub-components (landing, encounter, results)
11. Create OSCE-specific review endpoint for proper FSRS integration
12. Implement proper `initialCaseId` loading in OSCESimulator

---

## What to Audit Next

**Recommended: Clinical Library / Knowledge Base content loading** — identified in CLAUDE.md as a known broken area ("fix Knowledge Base content loading"). This is the third priority after main session and OSCE mode. Should audit the content pages, condition/drug/anatomy data loading, search, and rendering to determine what's functional vs broken.
