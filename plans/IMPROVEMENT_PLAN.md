# PANaCEa Improvement Plan — Core Study Experience & Consistency

**Date:** 2026-03-30
**Goal:** Make PANaCEa's study experience cohesive — every drill feeds FSRS, every question gives structured feedback, and the architecture supports rapid iteration.

---

## The Core Problem

PANaCEa has sophisticated infrastructure (FSRS v6, implicit metrics, circadian scheduling, Ghost Grader) but **only 3 of 30+ drill types actually use it**. The result: most studying doesn't update the spaced repetition schedule, so the system can't effectively target weak areas or schedule reviews.

### What feeds FSRS today

| Component | Submits to `/api/drills/submit-review` |
|-----------|---------------------------------------|
| `QuizView.tsx` (main session) | Yes |
| `SmartReviewMode.tsx` | Yes |
| `use-condition-drill.ts` hook | Yes |
| PharmDrill, DDxDrill, AnatomyDrill, ECGDrill, ImagingDrill, DermDrill, SystemDrill, GuidelineDrill, FirstLineDrill, VentilatorDrill, PhysiologyDrill, etc. | **No** |

### What DrillShell does today

`DrillShell.tsx` (136 lines) is purely a **layout wrapper** — breadcrumb, back button, header content area. It has zero awareness of:
- Telemetry collection (timeToFirstClick, answerSwitches, dwellTime)
- FSRS submission
- Implicit metrics
- Session tracking

Only `ContrastiveDrillSession` uses it.

---

## Phase 1: Universal FSRS Integration (Highest Impact)

**Why first:** Until every question feeds FSRS, the scheduling algorithm has an incomplete picture of what the learner knows. This is the #1 gap identified in CLAUDE.md and the PDFs.

### 1A. Create `useDrillFSRS` hook

A shared hook that any drill component can use to submit answers to the FSRS pipeline. This avoids rewriting every drill.

**File:** `hooks/useDrillFSRS.ts`

**Interface:**
```typescript
interface UseDrillFSRSOptions {
  drillType: string;        // 'pharm', 'ddx', 'anatomy', etc.
  sessionType?: string;     // defaults to 'drill'
}

interface DrillAnswer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timeToFirstClick: number;
  answerSwitches: number;
  totalDwellTime: number;
  questionData?: Record<string, unknown>;
}

function useDrillFSRS(options: UseDrillFSRSOptions): {
  submitAnswer: (answer: DrillAnswer) => Promise<FSRSResult>;
  sessionMetrics: SessionLatencyStats;
  startQuestion: () => void;   // call when question appears (starts timer)
  recordSwitch: () => void;    // call on answer change
}
```

**What it does internally:**
1. Tracks `timeToFirstClick` and `totalDwellTime` automatically via `startQuestion()`
2. Counts `answerSwitches` via `recordSwitch()`
3. Calls `POST /api/drills/submit-review` with the telemetry
4. Maintains session-level latency stats for the implicit rating variance calculation
5. Returns the FSRS result (isCorrect, rating, stability, difficulty, nextReview)

**Implementation notes:**
- Reuse the existing `useImplicitMetrics` hook (`hooks/useImplicitMetrics.ts`) for telemetry collection
- The server-side `drillReviewService.ts` already handles everything — this hook just needs to POST correctly
- Consider whether drill-type answers should use `review_type: 'real'` or a new type like `'drill'` — the key decision is whether drill answers should influence FSRS scheduling with the same weight as main-session answers

### 1B. Wire existing drill hooks to `useDrillFSRS`

Each drill hook (`use-pharm-drill.ts`, `use-ddx-drill.ts`, etc.) already has an `answerQuestion()` or equivalent. Add `useDrillFSRS` calls inside them.

**Files to modify (in priority order):**
1. `hooks/game/use-pharm-drill.ts` — Pharmacology (high PANCE yield)
2. `hooks/game/use-ddx-drill.ts` — Differential diagnosis (high PANCE yield)
3. `hooks/game/use-anatomy-drill.ts` — Anatomy
4. `hooks/game/use-ecg-drill.ts` — ECG interpretation
5. `hooks/game/use-imaging-drill.ts` — Imaging
6. `hooks/game/use-derm-drill.ts` — Dermatology (visual)
7. `hooks/game/use-system-drill.ts` — System-based
8. `hooks/game/use-guideline-drill.ts` — Guidelines
9. `hooks/game/use-first-line-drill.ts` — First-line treatments
10. `hooks/game/use-ventilator-drill.ts` — Ventilator management

**Pattern for each:**
```typescript
// Inside existing drill hook
const { submitAnswer, startQuestion, recordSwitch } = useDrillFSRS({
  drillType: 'pharm'
});

// When question appears:
useEffect(() => { startQuestion(); }, [currentQuestion]);

// When user changes answer:
const handleSelect = (answer) => {
  if (selectedAnswer !== null) recordSwitch();
  setSelectedAnswer(answer);
};

// When user submits:
const handleSubmit = async () => {
  const fsrsResult = await submitAnswer({
    questionId: currentQuestion.id,
    selectedAnswer,
    isCorrect: selectedAnswer === currentQuestion.correctAnswer,
    timeToFirstClick: /* from hook */,
    answerSwitches: /* from hook */,
    totalDwellTime: /* from hook */,
  });
  // Continue with existing feedback logic...
};
```

### 1C. Fix review_type discrimination (CRITICAL — from existing audit)

**Existing audit finding (`docs/AUDIT_CONTAMINATION_NON_FSRS_MODES.md`):** The `submit-review` endpoint has NO `sessionType` or `review_type` parameter. ALL submissions update FSRS identically — there's no way to distinguish main-session reviews from drill reviews. The optimizer uses unfiltered data.

**Required changes:**
1. **Add `sessionType` to `DrillSubmitReviewSchema`** — `z.enum(['MAIN', 'DRILL', 'CRAM', 'RAPID_RECALL']).optional().default('DRILL')`
2. **Mode-specific behavior in `submitDrillReview`:**
   - `MAIN` → Full FSRS update + ReviewLog with `review_type: 'real'` + `isMainSession: true`
   - `DRILL` → FSRS update + ReviewLog with `review_type: 'drill'` (optimizer can weight separately)
   - `CRAM` / `RAPID_RECALL` → NO FSRS update, log only for analytics
3. **QuizView** must pass `sessionType: 'MAIN'` explicitly
4. **All drill hooks** pass `sessionType: 'DRILL'` via `useDrillFSRS`
5. **Optimizer sidecar** filters: include `review_type: 'real'` at full weight, optionally include `'drill'` at reduced weight

**This is the single most important architectural fix.** It must happen in Session 1 alongside `useDrillFSRS`.

---

## Phase 2: Structured Explanations Everywhere

**Why second:** After FSRS consistency, the next biggest learning impact is ensuring every answer gives meaningful feedback — not just "Correct/Incorrect" but *why*.

### 2A. Standardize explanation data shape

The `ExplanationPanel` component already supports structured rationale (whyCorrect, whyIncorrectA/B/C/D), but QuizView renders it from a single `rationale` string. Many drill types show even less.

**Create a canonical explanation type:**
```typescript
// types/explanation.ts
interface StructuredExplanation {
  whyCorrect: string;
  whyIncorrect: Record<string, string>; // keyed by option label
  clinicalPearl?: string;
  highYieldFact?: string;
  relatedConditions?: string[];
}
```

### 2B. ExplanationPanel in QuizView

QuizView already imports `ExplanationPanel` but the rationale data from questions may not have the structured fields. Two fixes:
1. **Generation:** Ensure all question generators (Gemini prompts) output structured rationale with per-distractor explanations
2. **Rendering:** Fall back gracefully — if structured fields exist, use them; if only a `rationale` string exists, render it as-is

### 2C. Shared `DrillFeedbackPanel` for mini-drills

The drill components use `EnhancedFeedbackPanel` for post-answer feedback. Ensure it:
1. Shows the FSRS result (next review date, stability trend) from `useDrillFSRS`
2. Displays structured rationale when available
3. Has a consistent look across all drill types

---

## Phase 3: DrillShell as the Standard Wrapper

**Why third:** Now that FSRS and explanations are consistent, formalize the architecture.

### 3A. Enhance DrillShell with telemetry + FSRS awareness

Add optional integration points to DrillShell:
```typescript
interface DrillShellProps {
  // ... existing props ...

  // NEW: Optional FSRS integration
  drillType?: string;
  showFSRSBadge?: boolean;     // Show stability/difficulty badge in header
  sessionStats?: {              // Show running session stats
    correct: number;
    total: number;
    avgStability?: number;
  };
}
```

DrillShell itself doesn't own the FSRS logic (that's in `useDrillFSRS`), but it can display session-level metrics in its header area.

### 3B. Migrate drill components to DrillShell

Wrap each drill session component in DrillShell for consistent navigation and layout. This is a lower-risk refactor since DrillShell is purely presentational.

**Priority order:** Same as Phase 1B (high PANCE-yield drills first).

---

## Phase 4: QuizView Decomposition

**Why fourth:** QuizView at 2274 lines is a maintenance bottleneck, but it works. Refactor for sustainability, not urgency.

### 4A. Extract from QuizView

1. **`QuestionRenderer`** — Question stem, options, highlighting, strikethrough
2. **`AnswerSubmissionHandler`** — Telemetry collection, FSRS submission (could reuse `useDrillFSRS`)
3. **`SessionProgressBar`** — Progress tracking, question counter
4. **`PostAnswerFeedback`** — ExplanationPanel + FSRS badge + "next question" flow

### 4B. Share extracted components with drill modes

Once QuizView's internals are extracted, the drill modes can use the same `QuestionRenderer` and `PostAnswerFeedback` components, further unifying the experience.

---

## Phase 5: Content Quality & Completeness

**Why fifth:** The infrastructure is consistent; now ensure the content is solid.

### 5A. Question data normalization

The `QuestionData` interface has multiple field names for the same concept (`correctAnswer` vs `answer` vs `correct_option`). Create a normalization layer:
```typescript
function normalizeQuestionData(raw: QuestionData): NormalizedQuestion {
  return {
    stem: raw.stem ?? raw.question ?? raw.vignette ?? raw.text ?? '',
    correctAnswer: raw.correctAnswer ?? raw.answer ?? raw.correct_option ?? raw.correctChoice ?? '',
    options: normalizeOptions(raw.options ?? raw.choices ?? []),
    rationale: raw.rationale ?? '',
    // ... structured explanation fields
  };
}
```

### 5B. Missing content backfill

From the V2 architecture audit:
- `gold_standard_dx`: ~45% missing
- `first_line_rx`: ~48% missing
- `mechanismOfAction`: ~60% missing

Use Gemini batch generation to fill gaps, with the existing `scripts/` infrastructure.

### 5C. Google Drive content ingestion

You mentioned medical content in Google Drive. The codebase already has `lib/google-drive.ts` and scripts like `refinery:ingest-drive-media`. Use these to pull your study materials into the database as enrichment content.

---

## Implementation Order (for Claude Code sessions)

Each of these is sized for a single focused Claude Code session:

| Session | Task | Files | Est. Complexity |
|---------|------|-------|----------------|
| 1 | Create `useDrillFSRS` hook | `hooks/useDrillFSRS.ts`, `types/drill-fsrs.ts` | Medium |
| 2 | Wire PharmDrill + DDxDrill to FSRS | `hooks/game/use-pharm-drill.ts`, `hooks/game/use-ddx-drill.ts` | Medium |
| 3 | Wire AnatomyDrill + ECGDrill + ImagingDrill | 3 hook files | Medium |
| 4 | Wire remaining drills (Derm, System, Guideline, FirstLine, Ventilator, Physiology) | 6 hook files | Medium |
| 5 | Standardize explanation types + update ExplanationPanel | `types/explanation.ts`, `ExplanationPanel.tsx` | Low |
| 6 | Create DrillFeedbackPanel with FSRS display | `components/drill/DrillFeedbackPanel.tsx` | Medium |
| 7 | Enhance DrillShell + migrate 3 highest-priority drills | `DrillShell.tsx` + 3 drill sessions | Medium |
| 8 | QuizView extraction: QuestionRenderer | Extract from `QuizView.tsx` | High |
| 9 | Question data normalization layer | `lib/questionNormalizer.ts` | Low |
| 10 | Content backfill with Gemini | Scripts + prompts | Medium |

---

## What NOT to Change

- **FSRS v6 algorithm** (`lib/fsrs.ts`) — Working correctly, well-tested
- **drillReviewService.ts** — The 803-line pipeline is solid; add to it, don't rewrite
- **Clerk auth** — Working, no gaps
- **Cloudflare Edge architecture** — Working, no gaps
- **Implicit metrics formula** — Evidence-based, well-documented

---

## Success Criteria

After this plan is implemented:
1. Every drill type submits answers to the FSRS pipeline
2. The "What to Study Now" recommendation uses data from ALL study modes
3. Every answered question shows structured feedback (why correct + why each wrong answer is wrong)
4. DrillShell wraps all drill types for consistent navigation
5. QuizView is under 1500 lines with extracted, reusable components
