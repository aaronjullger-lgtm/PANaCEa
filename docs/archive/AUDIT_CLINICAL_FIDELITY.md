# Clinical Fidelity Features Audit

**Goal:** Make the experience feel real—time pressure where appropriate, and a simulated EMR that trains students to hunt for information like in Epic/Cerner.

**Scope:** Time-pressure UI (timer, Commuter Mode exception) and EMR view (toggle, tabbed layout).

---

## 1. Time Pressure UI

### Context

Standard tests are timed. The UI should show a visible but unobtrusive countdown. If "Commuter Mode" is on, the timer should be hidden to reduce anxiety during casual study.

---

### 1.1 Countdown Timer

**Audit question:** Is there a visible (but unobtrusive) timer?

**Current state:**

| Area | Finding |
|------|--------|
| **Quiz (main session)** | **Yes.** `components/quiz/QuestionTimer.tsx` provides a timer that shows elapsed time on the current question, with a progress bar against par time (default 72s). It supports `compact` mode (clock icon + time only). |
| **QuizView** | The timer is shown in the header: `QuestionTimer` with `startTime`, `parTimeMs`, `isAnswered`, `isVisible={showTimer}`, `compact`. So it is **visible** and **compact** (unobtrusive). |
| **Other modes** | `CodeBlueSpeedMode` and `GrandRoundsMode` have their own countdown timers. `PANRELASimulator` has a 5‑minute-per-question countdown. |

**Verdict:** **Pass.** A visible, unobtrusive question timer exists for the main quiz (elapsed + par-time bar, compact in header).

---

### 1.2 Commuter Mode Exception

**Audit question:** If "Commuter Mode" is on, is the timer hidden to reduce anxiety during casual study?

**Current state:**

| Area | Finding |
|------|--------|
| **CommuterContext** | `contexts/CommuterContext.tsx` provides `isCommuterMode`, `toggleCommuterMode`, and persists to localStorage. Used for voice-first, high-contrast, and accessibility. |
| **QuizView** | `showTimer` is local state: `const [showTimer, setShowTimer] = useState(true)`. The timer visibility is passed as `isVisible={showTimer}` to `QuestionTimer`. There is **no** `useCommuter()` call in QuizView, and **no** logic that sets `showTimer` to `false` when `isCommuterMode` is true. |
| **App / Session** | App wraps the app with `CommuterProvider`. QuizView is rendered inside that tree but does not read commuter state. No other layer overrides timer visibility based on Commuter Mode. |

**Verdict:** **Gap.** Commuter Mode does **not** hide the timer. The timer is always shown (unless the user could toggle it elsewhere—currently `showTimer` is only initialized to `true` and not bound to any user control or Commuter Mode). **Recommendation:** In `QuizView`, call `useCommuter()` and pass `isVisible={showTimer && !isCommuterMode}` (or hide the timer entirely when `isCommuterMode` is true), so that in Commuter Mode the countdown is hidden.

---

## 2. EMR View (Simulated EMR Interface)

### Context

A toggle exists for a "Simulated EMR Interface." The intent is to mimic hospital software (Epic/Cerner): information should appear in tabs (e.g. HPI | PMH | Meds | Labs) so students learn to hunt for information rather than reading one long scroll.

---

### 2.1 Toggle Exists

**Audit question:** Is there a toggle for the simulated EMR interface?

**Current state:**

| Area | Finding |
|------|--------|
| **Settings** | In `components/modals/SettingsStatsModal.tsx`, under "Clinical Fidelity Mode," there is a toggle: **"Simulated EMR Interface"** with description: "Display vignettes in tabbed hospital chart format (HPI, Vitals, Labs, Imaging)." |
| **Persistence** | The value is stored in `clinicalFidelitySettings.emrInterface` and persisted to `localStorage` under `panceai_clinical_fidelity`. |
| **Patient Encounter** | `PatientEncounterMode` reads the same key via `loadClinicalFidelitySettings()` and uses `clinicalFidelity.emrInterface`. It is used only to set `isFidelityModeActive` (with `rawLabValues`), which shows a "Clinical Fidelity" badge. |

**Verdict:** **Pass.** The toggle exists and is described as providing a tabbed hospital chart format.

---

### 2.2 Tabbed Layout (HPI | PMH | Meds | Labs)

**Audit question:** Does the question/vignette appear in tabs (HPI | PMH | Meds | Labs) when EMR is on, so the student must "hunt" for information?

**Current state:**

| Area | Finding |
|------|--------|
| **Patient Encounter Mode** | When the patient info card is expanded, the layout is a **single scroll**: one block "Chief Complaint," then one block "EMR Monitor" (vitals in a 2×2 grid). There are **no tabs**. The same layout is shown regardless of `emrInterface`. `clinicalFidelity.emrInterface` is only used for the `isFidelityModeActive` badge. |
| **Quiz (question vignette)** | `QuizView` does not read `panceai_clinical_fidelity` or `emrInterface`. The question/vignette is rendered as a single block (with optional table extraction). There is **no** tabbed EMR layout for quiz questions. |
| **OrderPanel (OSCE)** | `components/modes/osce/OrderPanel.tsx` has tabs for **order categories** (Labs, Imaging, etc.), not for patient chart sections (HPI, PMH, Meds, Labs). |

**Verdict:** **Gap.** The toggle exists and its copy promises "tabbed hospital chart format (HPI, Vitals, Labs, Imaging)," but **no tabbed EMR layout is implemented** in either:

- **Patient Encounter:** Patient info is a single collapsible section (Chief Complaint + EMR Monitor vitals). There are no HPI | PMH | Meds | Labs (or HPI | Vitals | Labs | Imaging) tabs.
- **Quiz:** The vignette is not split into EMR-style tabs; the EMR toggle is not read in the quiz flow.

So the student is **not** trained to hunt for information in a tabbed chart; they get one scroll. **Recommendation:** Implement a tabbed chart when `emrInterface` is true:

- **Patient Encounter:** When `clinicalFidelity.emrInterface` is true, render the left column (patient info) as tabs, e.g. **HPI** (chief complaint + history narrative), **PMH/Meds** (past medical history, medications, allergies), **Vitals** (current vitals + trends), **Labs/Imaging** (results as they become available), and only show one tab’s content at a time so the student must switch tabs to find information.
- **Quiz (optional):** If the EMR toggle is intended to affect the main quiz as well, parse the vignette into sections (e.g. by HPI, PMH, labs, imaging) and render them in tabs when `emrInterface` is true; otherwise keep the current single-block display.

---

## Summary Table

| Audit check | Status | Notes |
|-------------|--------|--------|
| Countdown timer | Pass | QuestionTimer in QuizView; visible, compact, par-time bar. |
| Commuter Mode: hide timer | Gap | QuizView does not use CommuterContext; timer always visible. |
| EMR toggle exists | Pass | "Simulated EMR Interface" in Settings; stored in localStorage. |
| Tabbed layout (HPI \| PMH \| Meds \| Labs) | Gap | Not implemented; patient info is single scroll; quiz ignores EMR toggle. |

---

## References

- `components/quiz/QuestionTimer.tsx`: timer component, `isVisible` prop
- `components/session/QuizView.tsx`: `showTimer` state, QuestionTimer usage, no CommuterContext
- `contexts/CommuterContext.tsx`: `isCommuterMode`, CommuterProvider
- `components/modals/SettingsStatsModal.tsx`: EMR toggle, "tabbed hospital chart format (HPI, Vitals, Labs, Imaging)"
- `components/modes/PatientEncounterMode.tsx`: `clinicalFidelity.emrInterface`, patient card layout (Chief Complaint + EMR Monitor), no tabs
- `components/modes/osce/OrderPanel.tsx`: tabs for order categories only
