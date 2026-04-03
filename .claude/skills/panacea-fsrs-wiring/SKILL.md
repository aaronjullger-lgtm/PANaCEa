---
name: panacea-fsrs-wiring
description: "Ensure PANaCEa drill and session components correctly integrate with the FSRS spaced repetition pipeline. Use this skill when creating or modifying drill components, session types, quiz views, review submission logic, or any component that submits answers to the FSRS system. Also trigger when the user mentions FSRS, spaced repetition, drill submission, review pipeline, SRS integration, useDrillFSRS, submit-review, syncManager, implicit metrics, or when debugging why reviews aren't being recorded."
---

# PANaCEa FSRS Wiring

This skill ensures that drill and session components correctly submit to PANaCEa's FSRS v6 spaced repetition pipeline. A component that doesn't wire into FSRS correctly means students do reviews that never update their memory model — they study but the system doesn't learn from it. This is a silent failure with no error messages, which makes it particularly dangerous.

## FSRS Pipeline Overview

The submission flow has two paths depending on the component type:

### Path A: Main Session (QuizView)
```
QuizView.tsx
  → useImplicitMetrics() collects behavioral telemetry
  → syncManager.queueAnswer() batches submissions
  → POST /api/questions/attempt
  → Server: correctness → implicit rating → FSRS update
```

### Path B: Drill Components (all 13 active drills)
```
DrillComponent.tsx
  → useDrillFSRS(getToken) hook
  → onAnswer() called with { questionId, selectedAnswer, telemetry }
  → POST /api/drills/submit-review with sessionType: 'drill'
  → Server: drillReviewService pipeline
```

Path B is the one you'll encounter most often when creating or modifying drill components.

## The useDrillFSRS Hook

Every drill component must use `useDrillFSRS` from `hooks/game/useDrillFSRS.ts`. This hook:

1. Gets a Clerk JWT token via `useAuth().getToken()`
2. Collects implicit metrics (time-to-first-click, answer switches, dwell time)
3. Submits to `/api/drills/submit-review` with the correct payload shape
4. Returns `{ onAnswer, isSubmitting, lastResult }`

**Correct usage pattern:**
```tsx
import { useDrillFSRS } from '@/hooks/game/useDrillFSRS';
import { useAuth } from '@clerk/clerk-react';

function MyDrill() {
  const { getToken } = useAuth();
  const { onAnswer, isSubmitting } = useDrillFSRS(getToken);

  const handleSubmit = async (questionId: string, selected: string) => {
    const result = await onAnswer({
      questionId,
      selectedAnswer: selected,
      sessionType: 'drill',
      telemetry: {
        timeToFirstClick: /* ms from question display to first interaction */,
        answerSwitches: /* number of times answer changed */,
        totalDwellTime: /* total ms on question */,
      },
    });
    // result: { isCorrect, rating, stability, difficulty, nextReview, retrievability }
  };
}
```

**Critical details:**
- `getToken` MUST be passed from `useAuth()` — without it, every POST gets 401'd silently
- `sessionType` MUST be `'drill'` — if it's `'cram'` or `'rapid_recall'`, FSRS state updates are skipped entirely
- Telemetry fields are optional but strongly recommended — without them, the implicit rating falls back to binary correctness only

## What the Server Does

Understanding the server pipeline helps diagnose wiring issues. The full path through `drillReviewService.ts` (803 lines):

1. **Correctness resolution** — compares `selectedAnswer` against `correctAnswer` (handles multiple field names: `correctAnswer`, `answer`, `correct_option`)
2. **Implicit rating derivation** — `deriveContinuousRating()` converts telemetry to a [1.0-4.0] grade
3. **Par time calculation** — `calculateParTime()` with 15-second floor (prevents division-by-zero)
4. **Circadian context** — adjusts scheduling based on time of day
5. **FSRS update** — runs the FSRS v6 algorithm (21 parameters, binary Again=1/Good=3 rating)
6. **Database writes** — creates `QuestionAttempt`, updates `ReviewLog`, updates `UserProgress`
7. **Confusion pairs** — logs semantically similar questions the student confuses
8. **Sibling propagation** — propagates stability changes to related questions

**Gating logic (what gets FSRS updates):**
```ts
const isMainSession = sessionType === 'MAIN' || sessionType === 'DRILL';
const isRealReview = reviewType === 'real';
// FSRS update only runs if BOTH are true
```

If `sessionType` is anything other than `'MAIN'` or `'DRILL'`, the review is recorded but FSRS state is NOT updated.

## DrillShell Wrapper

All 13 active drill components use `DrillShell` for their landing, menu, and completion views. The active quiz content uses `MiniDrillLayout` for immersive full-screen display. This is the standard wrapper — don't create a custom landing/completion flow.

Active drills: Contrastive, Pharm, DDx, Condition, Anatomy, ECG, FirstLine, Imaging, Physiology, MiniLab, Guideline, Ventilator, Derm.

Three delegation wrappers (SubcategoryDrill, SystemDrill, PharmacologyDrill) inherit DrillShell from their target components — they don't need their own.

## Checklist for New or Modified Drill Components

### Must Have
- [ ] Uses `useDrillFSRS(getToken)` hook with Clerk auth
- [ ] Passes `sessionType: 'drill'` in submission payload
- [ ] Sends `questionId` that corresponds to a real `PreGeneratedQuestion.id`
- [ ] Collects and sends `timeToFirstClick` (ms from render to first user interaction)
- [ ] Collects and sends `answerSwitches` (count of answer changes before submission)
- [ ] Collects and sends `totalDwellTime` (total ms on question)
- [ ] Uses `DrillShell` for landing/menu/completion
- [ ] Uses `MiniDrillLayout` for active quiz

### Should Have
- [ ] Tracks `hintViewed` and `hintViewDurationMs` if the drill has a hint system
- [ ] Handles `isSubmitting` state to prevent double-submission
- [ ] Shows feedback from `lastResult` (isCorrect, retrievability)
- [ ] Respects MVRT — doesn't submit if dwell time < minimum valid response time (2000ms default)

### Must NOT Have
- [ ] Direct fetch to `/api/drills/submit-review` bypassing `useDrillFSRS` (loses auth and telemetry)
- [ ] `sessionType: 'cram'` or `'rapid_recall'` unless intentionally excluding from SRS
- [ ] Hardcoded question IDs or mock data in production code paths
- [ ] `useImplicitMetrics()` in a drill (that's for QuizView only — drills use `useDrillFSRS`)

## Debugging Silent Failures

If a drill seems to work but reviews aren't appearing in the user's history:

1. **Check auth** — is `getToken` being passed? Open Network tab, look for 401 responses to `/api/drills/submit-review`
2. **Check sessionType** — is it `'drill'` (string) or the enum `SessionType.DRILL`? The API expects the string.
3. **Check questionId** — does it match a real `PreGeneratedQuestion.id` in the database? Fabricated IDs cause the server to skip the review.
4. **Check MVRT** — if `totalDwellTime` < 2000ms, the server flags it as a rapid guess and skips FSRS updates.
5. **Check ReviewLog** — query the database for recent ReviewLogs with the user's ID. If entries exist but `fsrs_*` fields are null, the gating logic excluded them.

## Telemetry Quality

The server classifies each submission's telemetry quality:
- **full** — has first-click timing + answer switches + CRPL micro-kinetics
- **partial** — has first-click or switches but not both
- **minimal** — only has duration

Higher-quality telemetry produces better implicit ratings, which produce better FSRS scheduling. The FSRS optimizer also weights high-quality reviews more heavily when fitting personalized parameters. So collecting good telemetry isn't just nice-to-have — it directly improves the student's learning schedule.

## Integration with Other Skills

This skill stacks with:
- **panacea-component-sprint** — consult this during the implement phase when drill components are in scope
- **panacea-verify** — after wiring changes, run transpile verification
- **clinical-safety-review** — drills that display clinical content still need proper safety tiers
