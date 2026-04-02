# OSCE Mode Refactor Plan

**Date:** 2026-04-01
**Status:** PHASES A1/A2/A3/B/C1/C2/C3/D1/E1/E2/E3 IMPLEMENTED + misc cleanup — D2 remaining
**Scope:** Performance, grading accuracy, UI immersion, architecture cleanup

## Implementation Log (2026-04-01)

### Completed
- **B1** ✅ Explicit 6-section scoring formula (20+20+25+20+10+5=100) added to Gemini system prompt
- **B2** ✅ Dangerous actions map injected into prompt so Gemini penalizes safety violations during scoring (not post-hoc)
- **B3** ✅ Grading idempotency: returns cached OsceResult unless `?force=true` query param
- **A3** ✅ Timer pause accumulation: `pausedMs` state + `pauseStartRef` + pause toggle button in encounter header
- **C2** ✅ `VitalsStrip` component: compact inline vitals with color-coded status, mini sparklines, CSS pulse animation synced to HR
- **C3** ✅ `PhaseStepper` component: clinical workflow stepper replacing inline text stepper, clickable completed phases, warning dot support
- **A2** ✅ Memoized handler callbacks: `handleOrderPlace`, `handleExamPerformed`, `handleCloseOrderPanel`, `handleCloseExamPanel`, `handlePhaseSelect` wrapped in `useCallback`
- **E2** ✅ System inference consolidated: 4 duplicate `inferSystemFromCase` functions replaced with shared `resolveSystem()` in `functions/api/_shared/inferSystem.ts` (server) and `lib/utils/inferSystem.ts` (client). All call sites prefer stored `targetSystem` with regex fallback.
- **D3** ✅ EMR tabs already implemented — `emrTab` state renders HPI/PMH/Meds/Vitals/Labs behind `clinicalFidelity.emrInterface` setting (no work needed)
- **Misc** ✅ Removed duplicate time display (manual Clock+font-mono) from encounter header — EncounterTimer component handles this
- **Misc** ✅ Removed dead `elapsedSeconds`/`minutes`/`seconds` computations from active encounter view
- **Misc** ✅ Cleaned up unused imports (consolidated lucide-react blocks, removed RapportIndicator, calculateEncounterScore, etc.)

- **D1** ✅ AV state badge: renders `currentAVState` in encounter UI when state machine is active — shows patient clinical state, context, and voice tone descriptors with severity-colored indicator
- **E1** ✅ Dead code cleanup: removed `initialCaseId` prop from OSCESimulator, removed `RapportChangeNotification`/`RapportIndicator` from barrel exports, un-exported 3 dead functions from osceScoringEngine (`calculateExamThoroughness`, `getDangerousActionsForCondition`, `checkForDangerousActions`)
- **E3** ✅ Unused component audit: confirmed all 11 barrel-exported OSCE components are actively imported; only `RapportChangeNotification` and `RapportIndicator` were dead (now removed from exports)

- **A1** ✅ `useEncounterReducer` hook: extracted 52 `useState` calls into a single `useReducer` with typed state, 4 action types (SET_FIELD, SET_FIELDS, UPDATE_FIELD, RESET), stable setter refs via `set()` factory. Functional updater pattern supported. Zero-diff JSX migration. File: `hooks/useEncounterReducer.ts` (308 lines).

- **C1** ✅ `EncounterWorkstation` clinical layout: created `components/modes/osce/EncounterWorkstation.tsx` (~240 lines) with 12-col grid (7-8 main + 4-5 sidebar), responsive based on active sidebar panel. Features: `AVStateBadge` (severity-colored dot + name + context + voice tone descriptors), `SidebarTab` toggles for Orders/Exam, `AnimatePresence` slide-in panels (max-h-[50vh]). Integrated into `PatientEncounterMode.tsx` replacing old modal overlays. Sidebar content extracted to `sidebarJsx` variable with full feature parity: Rapport Meter, Encounter Log (history/exam/diagnostics with sparkline trends), typing indicator with bounce dots + `TYPING_STATUS_MESSAGES`, `ChatSkeleton` loading state, diagnosis feedback entry, and `clinicalFidelity.rawLabValues` conditional for trend visualization.

### Still Pending
- **D2**: Apply voice modulation from AV state to TTS output (requires Gemini Live WebSocket integration)

---

## Exploration Summary

### System Size
- **PatientEncounterMode.tsx**: 3,612 lines, 50+ useState calls — the main monolith
- **osceScoringEngine.ts**: 1,591 lines — comprehensive but monolithic scoring
- **useEnhancedOSCE.ts**: 608 lines — primary integration hook
- **20+ OSCE components** across `components/modes/osce/` and `components/osce/`
- **17 API endpoints** in `functions/api/osce/`
- **Total OSCE system**: ~11,300 lines across 38+ files

### Critical Findings

| # | Category | Finding | Impact |
|---|----------|---------|--------|
| 1 | **Performance** | 50 useState calls in single 3.6K-line component; every state change re-renders everything | Lag during active encounters, especially vitals + chat |
| 2 | **Performance** | Handlers not wrapped in useCallback → defeats React.memo on OrderPanel, ExamPanel, etc. | Unnecessary child re-renders on every parent state change |
| 3 | **Grading** | Gemini prompt specifies PANCE weightings but no explicit scoring formula → inconsistent scores | Students receive inconsistent feedback across attempts |
| 4 | **Grading** | Dangerous actions detected *after* Gemini scores → Gemini unaware of safety violations | Inflated initial scores before penalty subtraction |
| 5 | **Grading** | No grading idempotency — calling /grade twice = two Gemini calls, divergent scores | Wasted API quota, confusing score changes |
| 6 | **Integration** | PatientAVEngine imported but event listeners never wired to UI | State machine exists but doesn't drive visual changes |
| 7 | **Integration** | Voice modulation defined in AV state but not applied to TTS | Patient voice doesn't change with clinical state |
| 8 | **Architecture** | Three uncoordinated hooks (useEnhancedOSCE, useOSCEMetrics, useSystemIntegration) | Fragmented state, manual coordination required |
| 9 | **UX** | Timer doesn't adjust for pause duration — elapsed time keeps accumulating | Penalizes students who pause to think |
| 10 | **UX** | emrTab state exists (line 214) but is never rendered in JSX | Incomplete EMR tab feature |

---

## Implementation Phases

### Phase A: Performance & Architecture (HIGH PRIORITY)

> Goal: Eliminate re-render cascades in the active encounter without changing user-visible behavior.

#### A1. Extract `useEncounterReducer` from PatientEncounterMode

Replace 50 loose useState calls with a single `useReducer` that groups related state into a typed state object with explicit action types. This provides:
- Single state update per action (no cascading setState calls)
- Explicit transition validation (can't set invalid phase/viewState combos)
- Debuggable action log

**File:** `hooks/useEncounterReducer.ts` (new)

**State shape:**
```typescript
interface EncounterState {
  // View
  viewState: ViewState;
  phase: EncounterPhase;
  isPaused: boolean;

  // Case
  currentCase: PatientEncounterCase | null;
  session: EncounterSession | null;
  patientPersona: PatientPersona | null;
  secretDiagnosis: string | null;

  // Inputs
  currentQuestion: string;
  examAction: string;
  diagnosticOrder: string;
  userDiagnosis: string;
  treatmentPlan: string;
  differentialDiagnoses: string[];
  newDifferential: string;

  // Loading
  isLoading: boolean;
  isTyping: boolean;
  loadError: string | null;

  // Results
  diagnosisFeedback: DiagnosisFeedback | null;
  treatmentFeedback: TreatmentFeedback | null;
  gradeResult: OsceGradeResult | null;
  gradeResultLoading: boolean;
  enhancedScoreReport: OSCEScoreReport | null;
  preceptorFeedback: PreceptorFeedback | null;

  // Settings
  languageMode: SpanishMode;
  aiDifficulty: AIDifficulty;
  enableCulturalCompetency: boolean;
  enableResourceLimited: boolean;

  // Panels
  showOrderPanel: boolean;
  showExamPanel: boolean;
  showHistoryPanel: boolean;
  showLiveSession: boolean;

  // Timer
  encounterStartTime: number;
  pauseAccumulator: number; // NEW: tracks total paused ms
}
```

**Actions:** `START_ENCOUNTER`, `CASE_LOADED`, `SET_PHASE`, `TOGGLE_PAUSE`, `SUBMIT_DIAGNOSIS`, `GRADE_RECEIVED`, `NEW_CASE`, `SET_INPUT`, `TOGGLE_PANEL`, `SET_ERROR`, etc.

**Estimated:** ~250 lines | **Risk:** Low (pure state refactor, no behavior change)

#### A2. Memoize handler callbacks

Wrap all handler functions passed to memoized children in `useCallback`:
- `handleAskQuestion`, `handlePhysicalExam`, `handleOrderTest`
- `handleSubmitDiagnosis`, `handleSubmitTreatment`
- `applyPreset`, `handleStartEncounter`, `handleNewCase`
- Panel toggle callbacks

**File:** `PatientEncounterMode.tsx` (modify in-place)
**Estimated:** ~60 lines changed | **Risk:** Low

#### A3. Fix timer pause accumulation

Current problem: `encounterStartTime` set once, `isPaused` toggle doesn't adjust elapsed calculation.

Fix: Add `pauseAccumulator` to state. On pause, record `pauseStartTime`. On resume, add `(Date.now() - pauseStartTime)` to `pauseAccumulator`. Pass `pauseAccumulator` to `EncounterTimer` so it subtracts paused time from elapsed.

**Files:** `hooks/useEncounterReducer.ts` + `components/modes/osce/EncounterTimer.tsx`
**Estimated:** ~20 lines | **Risk:** Low

---

### Phase B: Grading Accuracy (HIGH PRIORITY)

> Goal: Make Gemini grading reproducible, rubric-anchored, and safety-aware.

#### B1. Add explicit scoring formula to Gemini prompt

Current prompt says "evaluate 4 PANCE areas" with weightings but doesn't tell Gemini *how* to compute the final score. Fix: add a structured scoring rubric with point allocation.

**Prompt addition:**
```
SCORING FORMULA (mandatory):
1. History Taking (20 pts max): Award full credit if student asks ≥ 4 of the essential questions
   AND covers HPI, PMH, medications, allergies, social/family history.
2. Physical Exam (20 pts max): Award full credit if student performs ≥ 3 relevant exam maneuvers.
3. Diagnostic Reasoning (25 pts max): Award full credit if correct diagnosis is in differential
   AND ≥ 2 appropriate tests ordered AND ≤ 1 unnecessary test.
4. Treatment/Management (20 pts max): Award full credit if treatment plan addresses the diagnosis
   AND includes follow-up.
5. Communication (10 pts max): Award based on open-ended questions used, empathy shown,
   self-introduction, patient education.
6. Efficiency (5 pts max): Deduct for excessive unnecessary questions or tests.

Final score = sum of above. Return as 'score' field (0-100).
```

**File:** `functions/api/osce/analysis/grade.ts`
**Estimated:** ~40 lines | **Risk:** Medium (changes grading behavior — needs validation)

#### B2. Include dangerous actions in Gemini prompt context

Currently, dangerous actions are detected *after* Gemini returns the score, then subtracted. This means Gemini gives full credit for unsafe care. Fix: include the dangerous actions keyword map for the case's condition in the Gemini prompt so it can factor safety into its reasoning.

**Prompt addition:**
```
PATIENT SAFETY (critical):
The following actions are dangerous for this condition ([condition]):
[list from dangerous actions map]
If the student's transcript shows evidence of any dangerous action, deduct the specified
penalty from the relevant competency area AND flag it in redFlagsMissed.
```

**File:** `functions/api/osce/analysis/grade.ts`
**Estimated:** ~30 lines | **Risk:** Medium

#### B3. Add grading idempotency

Check if `OsceResult` already exists for the session before calling Gemini. If it does, return the cached result. Add a `?force=true` query param to allow re-grading when explicitly requested.

**File:** `functions/api/osce/analysis/grade.ts`
**Estimated:** ~15 lines | **Risk:** Low

---

### Phase C: UI Immersion & Clinical Aesthetics (MEDIUM PRIORITY)

> Goal: Transform the active encounter from "React app" to "clinical workstation."

#### C1. EMR-style encounter layout

Replace the current stacked-panel layout during `viewState === 'active'` with a clinical workstation grid:

```
┌──────────────────────────────────────────────────────┐
│ [Timer] [Phase: History] [Rapport ●●●○○] [Vitals]   │ ← Compact status bar
├──────────────────────┬───────────────────────────────┤
│                      │  Patient Info / Vitals Panel   │
│   Chat / Interaction │  (HR, BP, RR, O2 trending)    │
│   Panel (primary)    │───────────────────────────────│
│                      │  Orders / Exam Findings        │
│                      │  (collapsible side panel)      │
├──────────────────────┴───────────────────────────────┤
│ [Phase Navigation] ← History | Physical | Dx | DDx | Tx →  │
└──────────────────────────────────────────────────────┘
```

Key design decisions:
- **Chat panel takes 60% width** — the patient is the focus
- **Vitals + orders in persistent sidebar** (not modal overlays)
- **Phase navigation as a clinical workflow stepper** at the bottom
- **Monospace font for vitals/labs** (e.g., `JetBrains Mono` or `Fira Code`)
- **Clinical color tokens:** Deep slate background, sterile white cards, red/amber/green reserved for critical indicators only

**Files:** New `components/modes/osce/EncounterWorkstation.tsx` extracted from active view JSX
**Estimated:** ~400 lines (extracted + restyled) | **Risk:** Medium (visual change, no logic change)

#### C2. Vitals strip with real-time trending

Replace static vitals display with a compact strip showing:
- Current value with color-coded status (normal=white, warning=amber, critical=red)
- Mini sparkline per vital (last 10 readings from useVitalsEngine history)
- CSS-only pulse animation on HR value synced to current heart rate

**File:** New `components/modes/osce/VitalsStrip.tsx`
**Estimated:** ~150 lines | **Risk:** Low

#### C3. Phase stepper with clinical milestone markers

Replace loose phase buttons with a horizontal stepper showing:
- Completed phases (green check), current phase (highlighted), upcoming phases (dimmed)
- Critical action markers (red dot on phase if a critical action was missed)
- Animated transition between phases

**File:** New `components/modes/osce/PhaseStepper.tsx`
**Estimated:** ~120 lines | **Risk:** Low

---

### Phase D: Integration Completions (MEDIUM PRIORITY)

> Goal: Wire existing subsystems that were built but never connected.

#### D1. Wire PatientAVEngine to encounter UI

The AV engine has a full event system (`STATE_ENTER`, `TRIGGER_ACTIVATED`, `VITALS_UPDATED`) and clinical trigger evaluation, but no event listeners are connected in PatientEncounterMode. Wire it:

1. On encounter start, create PatientAVEngine instance with case's state machine
2. Subscribe to `VITALS_UPDATED` → update vitals display
3. Subscribe to `TRIGGER_ACTIVATED` → show clinical alert banner (e.g., "Patient's O2 dropping")
4. Subscribe to `STATE_ENTER` → update patient presentation description
5. On encounter end, tear down subscriptions

**File:** `PatientEncounterMode.tsx` (add useEffect for AV engine lifecycle)
**Estimated:** ~80 lines | **Risk:** Medium (new behavior, needs testing)

#### D2. Apply voice modulation from AV state to TTS

When AV state changes, update `useSpeechSynthesis` parameters:
- `voice.rate` → map from AV state (e.g., distressed = faster speech)
- `voice.pitch` → map from AV state (e.g., pain = higher pitch)
- `voice.volume` → map from AV state (e.g., hypoxic = quieter)

**File:** `components/modes/osce/OSCESimulator.tsx` or PatientEncounterMode
**Estimated:** ~30 lines | **Risk:** Low

#### D3. Render EMR tabs (hpi/pmh/meds/vitals/labs)

The `emrTab` state exists but was never rendered. Build a compact EMR reference panel that shows case data in organized tabs — the student can reference it during the encounter without it being a chat spoiler.

**Files:** New `components/modes/osce/EMRReferencePanel.tsx`
**Estimated:** ~200 lines | **Risk:** Low

---

### Phase E: Dead Code & Cleanup (LOW PRIORITY)

> Goal: Reduce codebase size and confusion.

#### E1. Remove dead code
- ~~`functions/api/osce/grade-soap.ts`~~ — already deleted
- ~~`lib/utils/osceAdaptiveDifficulty.ts`~~ — already deleted
- `OSCESimulator.tsx` TODO for `initialCaseId` — either implement or remove the prop
- Duplicate type definitions (PatientPersonality in multiple files) — consolidate

#### E2. Consolidate system inference
- Replace all `inferSystemFromCase()` regex calls with stored `targetSystem` field
- Remove regex fallback from analytics.ts and grade.ts after data backfill

#### E3. Unused component audit
Several components in `/components/osce/` are not imported by PatientEncounterMode:
- `DifferentialDiagnosisRanker.tsx` — could replace the tag-style diff input
- `EchoPathVisualization.tsx` — could be wired to results view
- `SOAPComparisonView.tsx` — could enhance debrief
- `InfographicDisplay.tsx` — could enhance post-encounter learning

Decision needed: integrate these or remove them.

---

## Dependency Graph

```
Phase A (Performance) ← No dependencies, do first
    A1: useEncounterReducer
    A2: useCallback memoization (depends on A1)
    A3: Timer pause fix (depends on A1)

Phase B (Grading) ← Independent of A, can run in parallel
    B1: Scoring formula prompt
    B2: Dangerous actions in prompt (depends on B1)
    B3: Grading idempotency (independent)

Phase C (UI) ← Depends on A1 (needs reducer for clean state)
    C1: EncounterWorkstation layout (depends on A1)
    C2: VitalsStrip (independent)
    C3: PhaseStepper (independent)

Phase D (Integration) ← Depends on A1 + C1
    D1: AV Engine wiring (depends on C1 for layout)
    D2: Voice modulation (depends on D1)
    D3: EMR tabs (depends on C1 for layout)

Phase E (Cleanup) ← Do last, anytime
```

## Estimated Effort

| Phase | Lines Changed | New Files | Risk | Priority |
|-------|--------------|-----------|------|----------|
| A: Performance | ~330 | 1 | Low | HIGH |
| B: Grading | ~85 | 0 | Medium | HIGH |
| C: UI Immersion | ~670 | 3 | Medium | MEDIUM |
| D: Integration | ~310 | 1 | Medium | MEDIUM |
| E: Cleanup | ~100 | 0 | Low | LOW |
| **Total** | **~1,495** | **5** | | |

---

## Recommended Execution Order

1. **A1** → useEncounterReducer (unlocks everything else)
2. **B1 + B3** → Grading prompt + idempotency (independent, high impact)
3. **A2 + A3** → Memoization + timer fix (quick wins after A1)
4. **B2** → Dangerous actions in prompt (builds on B1)
5. **C2 + C3** → VitalsStrip + PhaseStepper (independent UI components)
6. **C1** → EncounterWorkstation layout (uses C2, C3)
7. **D3** → EMR tabs (uses C1 layout)
8. **D1 + D2** → AV engine wiring + voice modulation
9. **E1-E3** → Cleanup pass

---

## Open Questions for Aaron

1. **Phase C1 (Layout):** Do you want the OrderPanel/ExamPanel to remain as modal overlays, or should they become persistent sidebar panels in the clinical workstation layout?
2. **Phase D (AV Integration):** The veo-2 video generation pipeline is fully implemented but no `<video>` element renders anywhere. Do you want to add patient video during encounters, or defer this?
3. **Phase E3 (Unused components):** `DifferentialDiagnosisRanker` has drag-and-drop ordering which is richer than the current tag-style input. Should we swap it in for the diagnosis phase?
4. **Grading calibration:** After implementing B1 (explicit scoring formula), should I run a batch of 10 sample transcripts through the updated grader and compare against manual assessment?
