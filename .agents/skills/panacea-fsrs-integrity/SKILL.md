---
name: panacea-fsrs-integrity
description: Verify FSRS pipeline integrity — binary ratings, implicit metrics, MVRT thresholds, correct ReviewLog writes. Use before modifying SRS/review logic or when debugging scheduling issues.
---

# FSRS Pipeline Integrity Checker

## Non-Negotiable Rules

### Binary Rating Only
- FSRS uses EXACTLY TWO rating values: 0 (Again) and 1 (Good)
- NEVER introduce rating values 2, 3, or 4
- Rating is IMPLICIT — derived from behavior, never user-selected

### Session Types That Update FSRS
- MAIN — yes, updates FSRS
- DRILL — yes, updates FSRS
- CRAM — NO, excluded
- RAPID_RECALL — NO, excluded
- Only review_type 'real' triggers FSRS updates

### MVRT Rapid-Guess Thresholds
- VIGNETTE: 3000ms — below this, skip FSRS entirely
- RECALL: 1500ms
- IMAGE: 2000ms
- If timeToFirstClick < threshold, the answer is a rapid guess, do not update FSRS

## Key Files (Read Before Modifying)
1. lib/fsrs.ts — FSRS v6 algorithm (21 parameters, schedulingStates)
2. lib/implicit-metrics.ts — behavioral to rating derivation
3. lib/services/drillReviewService.ts — main submission pipeline (2718 lines)
4. lib/confidence/ — 8-step confidence pipeline
5. functions/api/drills/submit-review.ts — drill submission endpoint
6. functions/api/questions/attempt.ts — main session submission

## Integrity Checklist

### Rating Derivation
- Rating is binary (0 or 1), never 2, 3, or 4
- Rating comes from implicit metrics, not user input
- No self-rated difficulty buttons in any UI component

### FSRS Gating
- Cram and rapid_recall sessions do NOT call FSRS update
- MVRT thresholds are per-question-type, not global
- Rapid guesses (below threshold) are skipped entirely

### Data Persistence
- QuestionAttempt, ReviewLog, and UserProgress are written atomically
- ReviewLog.sessionType maps correctly: drill maps to DRILL (not CRAM)
- safePrismaDisconnect is called in every Edge function finally block

### Confidence Pipeline
- Pipeline stages are in order (Step 1-8 plus Wave 1-3)
- Ghost Grader runs BEFORE the pipeline (can force Again on correct answer)
- Shadow calibration logger does NOT modify scheduling
- Wilson mastery and hypercorrection detection are read-only signals

## Debugging Scheduling Issues
1. Check ReviewLog for the affected question — is there a recent entry?
2. Verify rating value is 0 or 1 (not null, not 2/3/4)
3. Check sessionType is MAIN or DRILL (not CRAM)
4. Verify par time is per-question-type (not global)
5. Check if MVRT filtered the answer (timeToFirstClick < threshold)
