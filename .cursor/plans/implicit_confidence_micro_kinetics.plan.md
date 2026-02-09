---
name: ""
overview: ""
todos: []
isProject: false
---

# Deepening the Implicit Confidence Armory: Micro-Kinetics for JOL

## Overview

Add five advanced behavioral metrics to enhance Judgments of Learning (JOL) and implicit FSRS rating inference. These micro-kinetic signals provide high-fidelity indicators of verification anxiety, confusion, indecision, recall failure, and strategy speed.

---

## Current State

**Existing implicit metrics:**

- `timeToFirstClick` - Time before first answer selection (useImplicitMetrics, BehavioralTracker)
- `answerSwitches` - Number of answer changes before submit
- `mouse_hover_duration_ms` - Per-option (A,B,C,D) hover times
- `eliminatedCount` - Number of distractors crossed off (in behaviorSignals)
- `trajectory_metrics` - Placeholder in TelemetryData (hoverEntropy, hesitationIndex, etc. set to 0)

**Key files:**

- [hooks/useImplicitMetrics.ts](hooks/useImplicitMetrics.ts) - timeToFirstClick, answerSwitches, submitAnswer
- [components/quiz/Tracker.tsx](components/quiz/Tracker.tsx) - BehavioralTracker (hover, answer changes, finalize)
- [lib/services/cognitiveScience/implicitConfidenceInference.ts](lib/services/cognitiveScience/implicitConfidenceInference.ts) - Uses timing, answer stability, hesitation
- [lib/micro-kinetics.ts](lib/micro-kinetics.ts) - TrajectoryMetrics (pathLength, idealDistance, efficiency) - exists but may not be wired to mouse tracking
- [types/telemetry.ts](types/telemetry.ts) - TelemetryData, trajectory_metrics
- [prisma/schema.prisma](prisma/schema.prisma) - UserBehaviorMetrics, QuestionAttempt.telemetryJson

---

## New Metrics


| Metric                   | Primary Signal       | Logic                                                  | Implementation                                                                             |
| ------------------------ | -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Commitment Gap**       | Verification Anxiety | Time between last answer selection and Submit click    | Record lastSelectionTimestamp; on submit: `commitmentGapMs = now - lastSelectionTimestamp` |
| **Cursor Entropy**       | General Confusion    | Ratio: total mouse travel / straight-line displacement | `pathLength / idealDistance` from trajectory; >1 = meandering                              |
| **Hover Oscillation**    | 50/50 Indecision     | Frequency of mouse movement between two options (A↔B)  | Track hover-enter sequence; count A→B and B→A transitions                                  |
| **Vignette Regression**  | Recall Failure       | Scrolls back to vignette after reading answers         | Count scroll-up into vignette zone after having scrolled past it                           |
| **Elimination Velocity** | Strategy Speed       | Rate of crossing off distractors (eliminations/time)   | Timestamps of each elimination; velocity = count / (lastElimTime - firstElimTime)          |


---

## Implementation Plan

### Phase 1: Commitment Gap

**1.1 BehavioralTracker / useImplicitMetrics**

- Add `lastSelectionTimestampRef` (or state) to record when user last selected an answer.
- On `recordAnswerSelection` / `recordAnswerChange`: set `lastSelectionTimestamp = Date.now()`.
- On `finalize`: compute `commitmentGapMs = now - lastSelectionTimestamp` (or `null` if never selected).
- Add `commitmentGapMs` to `BehavioralPayload` and `TelemetryData`.

**1.2 API and schema**

- Add `commitmentGapMs` to TelemetryData interface and behavioralPayloadToTelemetryData.
- Store in QuestionAttempt.telemetryJson (JSONB) or UserBehaviorMetrics (new column if needed). Prefer telemetryJson to avoid migration.

### Phase 2: Cursor Entropy

**2.1 Mouse trajectory capture**

- Check if `lib/micro-kinetics.ts` is used anywhere for actual mouse tracking. If not, wire it.
- Option A: Use existing `computeTrajectoryMetrics` from RawTrajectory - requires sampling mouse position during question display. May need a `useMouseTrajectory` hook that samples at 40ms intervals from question start until submit.
- Option B: Simpler approach - track cumulative `mouseMove` distance and start/end positions. On each move: `totalPathLength += distance(lastPoint, currentPoint)`. On submit: `idealDistance = distance(startPos, endPos)`; `cursorEntropy = totalPathLength / Math.max(idealDistance, 1)`.

**2.2 Integration**

- BehavioralTracker or a dedicated MouseTrajectoryTracker: start on question display, stop on submit.
- Attach `mousemove` listener to document or question container (with cleanup).
- Add `cursorEntropy` to trajectory_metrics or as top-level telemetry field.

### Phase 3: Hover Oscillation

**3.1 Sequence tracking**

- Extend BehavioralTracker: add `hoverSequenceRef: string[]` (e.g., `['A','B','A','B']`).
- In `recordHover` or a new `recordHoverEnter(optionLabel)`: append option label to sequence when cursor enters an option.
- On finalize: count adjacent pairs (A,B) and (B,A) in sequence. `hoverOscillationCount = countPairs(['A','B']) + countPairs(['B','A'])` for the two most hovered options, or count all A↔B transitions.
- Simpler: count transitions between any two options when they alternate (A→B→A→B = 3 oscillations).

**3.2 OptionHoverTracker**

- Currently records duration on mouseLeave. Add `onMouseEnter` callback to BehavioralTracker to record enter (option label, timestamp) for sequence.
- BehavioralTracker.recordHoverEnter(optionLabel) → push to sequence.

### Phase 4: Vignette Regression

**4.1 Scroll tracking**

- QuizView layout: vignette (stem) is in a scrollable container (e.g., `question-container` or a div with overflow). Identify the DOM structure.
- Track: `hasScrolledPastVignette` = true when user scrolls down past vignette height (e.g., scrollTop > vignetteHeight).
- Track: `vignetteRegressionCount` = increments when user scrolls back up such that vignette is in view again (scrollTop < vignetteHeight) after `hasScrolledPastVignette` was true.
- Use `onScroll` on the scroll container. May need `ref` to vignette to get its height/bounds.

**4.2 Edge cases**

- Single-column layout: vignette and answers in same scroll - scroll down to answers, scroll up to re-read vignette = 1 regression.
- Split-pane layout: vignette left, answers right - may have separate scroll. Regression = scrolling the vignette pane after having scrolled it down. Clarify layout.

**4.3 BehavioralTracker or separate hook**

- Add `VignetteScrollTracker` or extend BehavioralTracker with `recordScrollPosition(containerScrollTop, vignetteHeight)`.
- On finalize: include `vignetteRegressionCount`.

### Phase 5: Elimination Velocity

**5.1 Timestamps**

- QuizView `handleToggleEliminate`: in addition to updating `eliminatedAnswers` Set, record `eliminationTimestamps: number[]` (push Date.now() on each add).
- Or: maintain `firstEliminationTime` and `lastEliminationTime` (and count). `eliminationVelocity = count / ((last - first) / 1000)` eliminations per second, or per minute.

**5.2 Edge cases**

- 0 eliminations: velocity = null or 0.
- 1 elimination: velocity = undefined (no rate) or treat as instantaneous.

**5.3 Integration**

- Pass `eliminationVelocity` (and `eliminationTimestamps` if useful) in behaviorSignals or telemetry.

---

## Data Flow

```mermaid
flowchart LR
    subgraph Capture [Client Capture]
        BT[BehavioralTracker]
        MM[Mouse Trajectory]
        VS[Vignette Scroll]
        EL[Elimination Handler]
    end

    subgraph Payload [Telemetry Payload]
        CG[commitmentGapMs]
        CE[cursorEntropy]
        HO[hoverOscillation]
        VR[vignetteRegressionCount]
        EV[eliminationVelocity]
    end

    BT --> CG
    BT --> HO
    MM --> CE
    VS --> VR
    EL --> EV

    Payload --> API[/api/questions/attempt]
    Payload --> UBM[UserBehaviorMetrics]
```



---

## Schema and API Updates

**TelemetryData (types/telemetry.ts):**

- Add optional fields: `commitment_gap_ms?: number`, `cursor_entropy?: number`, `hover_oscillation_count?: number`, `vignette_regression_count?: number`, `elimination_velocity?: number`.
- Or extend `trajectory_metrics` with these if they fit conceptually.

**UserBehaviorMetrics (Prisma):**

- Already has `trajectoryData Json?` - can store extended metrics.
- Alternatively add columns: `commitmentGapMs Int?`, `cursorEntropy Float?`, `hoverOscillationCount Int?`, `vignetteRegressionCount Int?`, `eliminationVelocity Float?`.
- Prefer JSONB in telemetryJson for flexibility; add columns only if needed for indexing/analytics.

**implicitConfidenceInference.ts:**

- Extend `BehavioralSignals` to accept new metrics.
- Add signal weights for Commitment Gap (high gap → lower confidence), Cursor Entropy (high → lower), Hover Oscillation (high → lower), Vignette Regression (high → lower), Elimination Velocity (interpret: fast systematic vs slow uncertain - may need calibration).

---

## Inferred JOL Mapping (Proposed)


| Metric               | High Value            | Low Value      | JOL Contribution                                                                         |
| -------------------- | --------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Commitment Gap       | Verification anxiety  | Quick submit   | Lower confidence                                                                         |
| Cursor Entropy       | Confusion, meandering | Direct path    | Lower confidence                                                                         |
| Hover Oscillation    | 50/50 indecision      | Focused        | Lower confidence                                                                         |
| Vignette Regression  | Recall failure        | No look-back   | Lower confidence                                                                         |
| Elimination Velocity | Fast systematic       | Slow/uncertain | Context-dependent (fast + correct = confident strategy; slow + correct = less confident) |


---

## Files to Modify


| File                                                           | Changes                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `components/quiz/Tracker.tsx`                                  | Add lastSelectionTimestamp, commitmentGapMs, hoverEnter sequence, recordHoverEnter; extend BehavioralPayload |
| `hooks/useImplicitMetrics.ts`                                  | Record last selection time; include commitment gap in submit payload                                         |
| `components/session/QuizView.tsx`                              | Elimination timestamps; call recordHoverEnter; wire scroll tracker; pass new metrics to behavioralPayload    |
| `types/telemetry.ts`                                           | Add new optional fields to TelemetryData                                                                     |
| `lib/services/cognitiveScience/implicitConfidenceInference.ts` | Extend BehavioralSignals; add inference for new metrics                                                      |
| `lib/micro-kinetics.ts` or new `hooks/useMouseTrajectory.ts`   | Wire mouse path capture for Cursor Entropy                                                                   |
| `functions/api/_shared/schemas.ts`                             | Accept new fields in attempt/review payloads                                                                 |
| `functions/api/user/behavior-metrics.ts`                       | Persist new metrics to UserBehaviorMetrics (trajectoryData or new columns)                                   |


---

## Rollout Strategy

1. **Phase 1 (Commitment Gap)** - Low risk, high value. Add to BehavioralTracker and useImplicitMetrics.
2. **Phase 2 (Cursor Entropy)** - Requires mouse tracking; verify performance (throttle mousemove).
3. **Phase 3 (Hover Oscillation)** - Extend hover tracking; small change.
4. **Phase 4 (Vignette Regression)** - Layout-dependent; validate QuizView scroll structure.
5. **Phase 5 (Elimination Velocity)** - Straightforward; add timestamps in handleToggleEliminate.

All new metrics should be optional and degrade gracefully when unavailable.