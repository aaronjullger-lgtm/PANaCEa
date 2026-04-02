# PANaCEa Comprehensive Recommendation & Implementation Plan

**Date:** 2026-04-02
**Author:** Aaron Jullger + Claude (Architecture & Research)
**Status:** PLANNING — Ready for phased execution

---

## Executive Summary

This plan addresses three interconnected goals:

1. **Filtered Sessions** — System, subcategory, and condition-level study sessions
2. **Intelligent Personalization** — Role-aware dashboard and study experience
3. **Research-Backed Adaptive Learning** — Evidence-based efficiency, retention, and wellness

The critical finding from codebase analysis: **the session generation pipeline is broken**. `functions/api/study/session/generate.ts` returns 501 (stubbed). `CoreAdaptiveSession.tsx` calls it but gets nothing back. The blueprint resolver (`learnerStageBlueprint.ts`) works beautifully — it already handles DIDACTIC, CLINICAL, PANCE_PREP, and PANRE stages with weighted blending. But the question selector that should consume those weights doesn't exist yet.

**This is the single highest-priority fix.** Everything else (filtered sessions, personalization, adaptive learning) depends on a working question selection service.

---

## Part 1: Filtered Session Architecture

### Current State

| Component | Status | Notes |
|-----------|--------|-------|
| `learnerStageBlueprint.ts` | ✅ Working | Resolves DIDACTIC/CLINICAL/PANCE/PANRE with weighted blending |
| `/api/study/resolve-blueprint` | ✅ Working | Fetches user profile → calls resolveBlueprint() |
| `/api/study/check-distribution` | ✅ Working | Anti-gaming distribution enforcement |
| `/api/study/session/generate` | ❌ STUBBED (501) | Returns "Not implemented" |
| `CoreAdaptiveSession.tsx` | ⚠️ Broken | Calls the stubbed endpoint, gets nothing |
| `/api/questions/system-drill` | ✅ Working | Random question by system + optional subcategory |
| `/api/questions/condition-drill` | ✅ Working | Random questions by system/subcategory/difficulty |

### What Needs Building

#### 1.1 — Concept-Level Question Selector Service

**File:** `lib/services/conceptQuestionSelector.ts`

This is the missing "brain" of the session generator. It must:

- Accept blueprint weights, distribution constraints, and optional filters (system, subcategory, condition)
- Query UserProgress to find cards due for review (FSRS `nextReview <= now`)
- Mix due reviews with new cards (ratio: ~70% due / 30% new, adjustable by urgency)
- Respect blueprint weights when selecting new cards (e.g., if CV=11%, ~11% of new cards are CV)
- Apply anti-gaming caps from check-distribution
- Support three session modes:
  - **Full adaptive** (no filter) — weighted by blueprint
  - **System-scoped** — all questions from one system, FSRS-ordered
  - **Subcategory-scoped** — narrower filter within a system
  - **Condition-scoped** — drill into one condition

```typescript
interface SessionRequest {
  userId: string;
  mode: 'adaptive' | 'system' | 'subcategory' | 'condition';
  size: number;
  blueprintWeights: Record<string, number>;

  // Filters (used in scoped modes)
  system?: string;
  subcategory?: string;
  conditionId?: string;

  // Distribution constraints from check-distribution
  boostSystems?: string[];
  suppressSystems?: string[];
  perSystemCaps?: Record<string, number>;

  // Learner context
  blueprintStage: LearnerStage;
  urgencyMultiplier: number;
}

interface SessionResponse {
  sessionId: string;
  questions: Question[];
  metadata: {
    dueReviewCount: number;
    newCardCount: number;
    systemDistribution: Record<string, number>;
    estimatedMinutes: number;
  };
}
```

**Selection Algorithm:**

```
1. Query UserProgress WHERE userId = X AND nextReview <= NOW()
   → These are "due" cards. Order by: overdue ratio DESC (most overdue first)

2. Compute how many due cards to include: min(dueCount, size * 0.7)

3. For remaining slots, select NEW cards (no UserProgress entry):
   a. If mode = 'adaptive': sample from PreGeneratedQuestion proportional to blueprintWeights
   b. If mode = 'system': sample from PreGeneratedQuestion WHERE system = X
   c. If mode = 'subcategory': sample WHERE system = X AND subcategory = Y
   d. If mode = 'condition': sample WHERE conditionId = Z

4. Apply anti-gaming: enforce perSystemCaps, boost underrepresented systems

5. Shuffle the final list (interleave due + new to prevent blocking)

6. Create a StudySession record in DB, return questions
```

#### 1.2 — Implement session/generate.ts Endpoint

**File:** `functions/api/study/session/generate.ts` (replace stub)

Wire the conceptQuestionSelector into the Edge Function:

```typescript
export const onRequestPost = authenticatedEndpoint(SessionGenerateSchema, async (context) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    const session = await generateSession(prisma, {
      userId: context.auth.userId,
      ...context.validated.body,
    });
    return Response.json(session, { status: 200 });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
```

#### 1.3 — Session Scope UI

**File:** New component `components/session/SessionScopeSelector.tsx`

A pre-session configuration modal that appears when the user clicks "Study" from the dashboard or TrainingMenu:

- **Quick Start** (default) — Full adaptive, uses resolved blueprint. One click.
- **Focus on System** — Dropdown of all 15 systems. Shows question count + mastery % per system.
- **Focus on Subcategory** — After selecting a system, shows subcategories within it.
- **Focus on Condition** — After selecting subcategory, shows specific conditions.
- **Session Size** — Slider: 10 / 20 / 30 / 50 questions. Default scales with urgencyMultiplier.

This component should show the user what the blueprint resolver decided:
> "You're on Internal Medicine rotation. Session weighted 75% IM, 25% PANCE baseline."
> or: "Didactic Semester 2. Gated systems: Infectious Disease, Reproductive, Nephrology."

The user can override (choose system focus) but the default should be intelligent.

### Dependencies
- Prisma schema already has: `Question` (with system, subcategory, conditionId), `UserProgress` (with nextReview, stability, difficulty), `PreGeneratedQuestion`
- No schema changes needed for Phase 1

### Effort Estimate
- conceptQuestionSelector.ts: 2-3 days
- session/generate.ts implementation: 1 day
- SessionScopeSelector UI: 2 days
- Integration with CoreAdaptiveSession: 1 day
- **Total: ~6-7 days**

---

## Part 2: Intelligent Role-Based Personalization

### Current State

The blueprint resolver (`learnerStageBlueprint.ts`) already differentiates five learner stages:

| Stage | Trigger | Current Behavior |
|-------|---------|-----------------|
| `didactic_early` | trainingPhase=DIDACTIC, year 1 | Gates to semester-appropriate systems |
| `didactic_late` | trainingPhase=DIDACTIC, year 2+ | All systems, lower complexity |
| `clinical_rotation` | trainingPhase=CLINICAL + currentRotation | Blends EOR (55-85%) + PANCE (15-45%) |
| `pance_prep` | trainingPhase=CLINICAL, no rotation | Full PANCE blueprint |
| `panre` | lifecycleRole=PRACTICING_PA | PANRE blueprint |

**The problem:** This intelligence exists in the backend but the **dashboard and UI are identical for everyone.** A first-semester didactic student sees the same widgets, metrics, training modes, and language as a PA-C doing PANRE prep.

### What Needs Building

#### 2.1 — Dashboard Layout Engine

**File:** `lib/services/dashboardPersonalization.ts`

A configuration system that maps learner stage to dashboard layout:

```typescript
interface DashboardConfig {
  stage: LearnerStage;

  // Which widgets to show and in what order
  pilotWidgets: WidgetId[];
  dataWidgets: WidgetId[];

  // Training modes to surface (hide irrelevant ones)
  visibleModes: TrainingModeId[];

  // Language/framing
  examLabel: string;           // "PANCE" | "PANRE" | "EOR" | "Unit Exam"
  readinessLabel: string;      // "PANCE Readiness" | "EOR Readiness" | "Knowledge Maintenance"
  sessionCTA: string;          // "Start Studying" | "Quick Review" | "Daily Check-In"

  // Metrics emphasis
  primaryMetric: 'accuracy' | 'retention' | 'coverage' | 'mastery';
  showBlueprintGaps: boolean;
  showEorCountdown: boolean;
  showPanceCountdown: boolean;
  showRotationContext: boolean;
}
```

**Stage-specific configurations:**

**DIDACTIC EARLY (Semester 1-2):**
- Primary metric: **coverage** (how much of the curriculum they've seen)
- Hide: EOR countdown, rotation selector, PANRE modes
- Show: System mastery map (highlighting gated/locked systems), Curriculum progress ring
- Training modes: Main session, System drills, Flashcards, Contrastive drills
- Language: "Unit" instead of "Blueprint", "Your Progress" instead of "PANCE Readiness"
- CTA: "Continue Studying" (emphasize forward momentum, not exam anxiety)

**DIDACTIC LATE (Semester 3-4):**
- Primary metric: **accuracy** (shifting toward performance)
- Show: Blueprint gap heatmap, all systems unlocked
- Add: DDx drills, Pharmacology drills, Mini-lab interpretations
- Language: Start introducing "PANCE Blueprint" language
- CTA: "Start Session"

**CLINICAL ROTATION:**
- Primary metric: **retention** (are they maintaining breadth while going deep on rotation?)
- Show: EOR countdown (prominent), rotation context banner, blended weight visualization
- Show: "Rotation Focus" badge showing current blend (e.g., "75% IM / 25% PANCE")
- Training modes: Prioritize OSCE, condition drills, system-scoped sessions for rotation
- Add: "Quick PANCE Maintenance" mode (15 min, breadth-only, non-rotation systems)
- Language: "EOR Readiness" primary, "PANCE Baseline" secondary

**PANCE PREP:**
- Primary metric: **mastery** (are they board-ready?)
- Show: PANCE countdown (prominent), full blueprint gap analysis, calibration quadrant
- All modes visible, emphasis on full-length practice sessions
- Show: Predicted score range based on performance data
- Language: "PANCE Readiness", "Board Prep"
- CTA: "Start Practice Exam" or "Continue Review"

**PANRE (Practicing PA-C):**
- Primary metric: **retention** (knowledge maintenance)
- Hide: Didactic modes, curriculum progress, streak pressure
- Show: "Knowledge decay" forecast, systems needing refresh
- Rename: "Study" → "Review", "Drill" → "Check-In"
- Reduce session sizes (10-15 questions default vs 30 for students)
- Language: "PANRE-LA", "Knowledge Maintenance", "Recertification"
- CTA: "Quick Check-In" or "Refresh [System]"

#### 2.2 — Dashboard Component Updates

**File:** Modify `components/dashboard/DashboardPage.tsx`

```typescript
// Add at component top:
const { stage } = useResolvedBlueprint(); // New hook that calls /api/study/resolve-blueprint
const dashboardConfig = getDashboardConfig(stage);

// Conditionally render widgets:
{dashboardConfig.showEorCountdown && <EorCountdownCard />}
{dashboardConfig.showPanceCountdown && <ExamCountdownCard />}
{dashboardConfig.showRotationContext && <RotationContextBanner />}
```

**File:** Modify `components/dashboard/TrainingMenu.tsx`

Filter MODE_REGISTRY by `dashboardConfig.visibleModes`:

```typescript
const filteredModes = MODE_REGISTRY.filter(
  mode => dashboardConfig.visibleModes.includes(mode.id)
);
```

#### 2.3 — New Hook: useResolvedBlueprint

**File:** `hooks/useResolvedBlueprint.ts`

Wraps the `/api/study/resolve-blueprint` call with SWR caching:

```typescript
export function useResolvedBlueprint() {
  const { getToken } = useAuth();
  const { data, error, isLoading } = useSWR('/api/study/resolve-blueprint', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 min cache
  });
  return { blueprint: data, stage: data?.stage ?? 'general', isLoading, error };
}
```

#### 2.4 — Onboarding Wizard Enhancement

**File:** Modify `components/onboarding/` flow

The current onboarding collects career stage and rotation. Enhance to also collect:

- **Didactic students:** Current semester number, program start date, exam date (if known)
- **Clinical students:** Rotation schedule (start/end dates for each), EOR dates
- **PANCE prep:** Exam date (required), weak systems self-assessment
- **PA-C:** PANRE-LA cycle, preferred review frequency, speciality area

This data feeds into the database fields that `learnerStageBlueprint.ts` already reads: `trainingPhase`, `lifecycleRole`, `currentRotation`, `rotationEndDate`, `eorTestDate`, `examDate`, `yearInProgram`.

### Effort Estimate
- dashboardPersonalization.ts config system: 1-2 days
- DashboardPage + TrainingMenu modifications: 2-3 days
- useResolvedBlueprint hook: 0.5 day
- Onboarding enhancement: 2-3 days
- Testing across all 5 stages: 1-2 days
- **Total: ~7-10 days**

---

## Part 3: Research-Backed Adaptive Learning & Wellness

This is where PANaCEa becomes genuinely differentiated. Every feature below is grounded in published research.

### 3.1 — The 85% Rule (Optimal Challenge Calibration)

**Research:** Wilson et al. (2019), "The Eighty Five Percent Rule for Optimal Learning," Nature Communications. Found that the optimal error rate for learning is ~15.87%, meaning students learn fastest when getting ~85% correct.

**Implementation:**

**File:** `lib/services/difficultyCalibrator.ts`

```typescript
/**
 * Monitors the student's rolling accuracy and adjusts question difficulty
 * to maintain the ~85% sweet spot.
 *
 * If accuracy > 90% over last 30 questions → increase difficulty mix
 * If accuracy < 75% over last 30 questions → decrease difficulty mix
 * If accuracy 80-90% → optimal zone, maintain current mix
 */
export function calibrateDifficulty(
  recentAttempts: { wasCorrect: boolean; difficulty: string }[],
  currentMix: { easy: number; medium: number; hard: number }
): { easy: number; medium: number; hard: number } {
  const windowSize = 30;
  const recent = recentAttempts.slice(-windowSize);
  const accuracy = recent.filter(a => a.wasCorrect).length / recent.length;

  if (accuracy > 0.90) {
    // Too easy — shift toward harder questions
    return { easy: Math.max(0.1, currentMix.easy - 0.1),
             medium: currentMix.medium,
             hard: Math.min(0.5, currentMix.hard + 0.1) };
  }
  if (accuracy < 0.75) {
    // Too hard — shift toward easier questions
    return { easy: Math.min(0.5, currentMix.easy + 0.1),
             medium: currentMix.medium,
             hard: Math.max(0.1, currentMix.hard - 0.1) };
  }
  return currentMix; // In the zone
}
```

**Integration:** Feed this into the conceptQuestionSelector when selecting new cards. The difficulty mix determines what proportion of new cards are easy/medium/hard.

### 3.2 — Metacognitive Calibration Engine

**Research:** Kruger & Dunning (1999); "The Illusion of Knowing" (PMC, 2021). Structured metacognitive training combining psychoeducation about overconfidence with item-level judgement practice and feedback significantly improved calibration accuracy.

**Current State:** You already have `ConfidenceCalibration.tsx` (3-level: Very Sure / Somewhat Sure / Guessing) and `CalibrationQuadrantWidget.tsx` on the dashboard. You also have implicit confidence from behavioral telemetry.

**Enhancement:**

**File:** `lib/services/calibrationEngine.ts`

Build a 2×2 confidence-accuracy matrix that identifies four student states:

```
                    CONFIDENT       NOT CONFIDENT
CORRECT         |  Mastered       |  Underconfident  |
                |  (leave alone)  |  (build self-    |
                |                 |   efficacy)      |
INCORRECT       |  DANGEROUS      |  Acknowledged    |
                |  MISCONCEPTION  |  Gap             |
                |  (highest       |  (normal         |
                |   priority fix) |   learning)      |
```

**Dangerous Misconceptions** (confident + wrong) get:
- Flagged for immediate re-study with elaborative explanation
- FSRS stability reset to near-zero (aggressive rescheduling)
- Surfaced on dashboard: "3 misconceptions detected in Cardiology — review recommended"

**Underconfident Mastery** (not confident + correct) gets:
- Positive reinforcement: "You got this right even though you weren't sure — you know more than you think"
- Slight stability boost (the knowledge is there, confidence will follow)

**Integration:** The `CalibrationQuadrantWidget` already exists on the dashboard. Wire it to real data from the calibration engine. Add a "Misconception Alert" card that surfaces when dangerous misconceptions are detected.

### 3.3 — Circadian-Aware Session Optimization

**Research:** Peak cognitive performance occurs 10 AM–2 PM for most chronotypes. Post-lunch dip 2–4 PM. Evening (4–10 PM) is "acquisition mode" for new learning. Morning is better for consolidation/review. Chronotype (morning lark vs night owl) shifts these windows.

**Current State:** You already have `lib/circadian.ts` and `CircadianInsightCard.tsx`. You store circadian phase in ReviewLog telemetry.

**Enhancement:**

**File:** `lib/services/circadianScheduler.ts`

```typescript
/**
 * Given the user's chronotype and current time, determine optimal session type.
 *
 * Morning (user's peak alertness): Due reviews, hard questions, misconception remediation
 * Post-lunch dip: Light review, flashcards, lower cognitive load
 * Evening (acquisition window): New content, exploratory drills, OSCE practice
 * Pre-sleep: Quick flashcard review (sleep consolidation boost)
 */
export function getOptimalSessionType(
  chronotype: 'morning' | 'evening' | 'neutral',
  currentHour: number,
  wakeTime: number // from WakeTimeSettings
): SessionRecommendation {
  const hoursSinceWake = (currentHour - wakeTime + 24) % 24;

  if (hoursSinceWake <= 4) {
    // Peak alertness window
    return { type: 'review_hard', label: 'Peak Focus — tackle your toughest reviews' };
  }
  if (hoursSinceWake <= 7) {
    // Post-peak, pre-dip
    return { type: 'mixed', label: 'Great time for a balanced session' };
  }
  if (hoursSinceWake <= 9) {
    // Post-lunch dip
    return { type: 'light_review', label: 'Energy dip — try flashcards or light review' };
  }
  if (hoursSinceWake <= 13) {
    // Evening acquisition
    return { type: 'new_content', label: 'Learning window — explore new material' };
  }
  // Pre-sleep
  return { type: 'quick_flashcard', label: 'Quick review before sleep boosts retention' };
}
```

**Dashboard integration:** The `CircadianInsightCard` shows the recommendation. The "Start Session" CTA adapts: during dip, it suggests "Quick Flashcards (10 min)" instead of "Start 30-Question Session."

### 3.4 — Burnout Prevention System

**Research:** Over 50% of medical students experience burnout (PMC, 2024). Pass-fail grading is the only curricular intervention with evidence of reducing it. Technology interventions are emerging but under-studied. Key insight: **the app should not tell students to take care of themselves — it should make self-care the path of least resistance.**

**File:** `lib/services/wellnessEngine.ts`

#### 3.4a — Diminishing Returns Detector

```typescript
/**
 * Detects when continued studying has negative ROI.
 *
 * Signals:
 * - Accuracy declining within a session (fatigue curve)
 * - Response time increasing (cognitive depletion)
 * - Implicit confidence dropping (frustration)
 * - Session duration > 90 minutes continuous
 * - 3+ sessions in one day with declining performance
 *
 * Response: Gentle, non-judgmental nudge to stop.
 * NOT "You should take a break" but "You've covered 45 questions with
 * 87% accuracy — that's a strong session. Your retention will be better
 * if you come back tomorrow."
 */
export function detectDiminishingReturns(
  sessionAttempts: { wasCorrect: boolean; responseTimeMs: number; timestamp: Date }[]
): { shouldStop: boolean; reason: string; stats: SessionStats } {
  // Split into first half vs second half
  const mid = Math.floor(sessionAttempts.length / 2);
  const firstHalf = sessionAttempts.slice(0, mid);
  const secondHalf = sessionAttempts.slice(mid);

  const firstAccuracy = firstHalf.filter(a => a.wasCorrect).length / firstHalf.length;
  const secondAccuracy = secondHalf.filter(a => a.wasCorrect).length / secondHalf.length;
  const accuracyDrop = firstAccuracy - secondAccuracy;

  const firstAvgTime = avg(firstHalf.map(a => a.responseTimeMs));
  const secondAvgTime = avg(secondHalf.map(a => a.responseTimeMs));
  const timeIncrease = (secondAvgTime - firstAvgTime) / firstAvgTime;

  if (accuracyDrop > 0.15 && timeIncrease > 0.25) {
    return {
      shouldStop: true,
      reason: 'fatigue_detected',
      stats: { accuracyDrop, timeIncrease, questionsAnswered: sessionAttempts.length }
    };
  }
  // ... additional checks
}
```

#### 3.4b — Streak Freezes & Sustainable Goals

**Current gap:** Streak exists but no freeze mechanism. Missing a day resets to zero.

```typescript
// In streak calculation logic:
if (missedDay && user.streakFreezes > 0) {
  user.streakFreezes -= 1;
  // Streak continues — no reset
  // Show: "Streak freeze used! 🧊 You have X remaining"
}

// Weekend mode: if user.weekendModeEnabled, skip Sat/Sun from streak calc
```

**Quality-weighted goals** instead of raw question counts:
- Instead of "Answer 30 questions today" → "Earn 50 mastery points today"
- Points = f(difficulty, correctness, confidence calibration)
- Getting a hard question right while confident = 5 points
- Getting an easy question wrong while confident = -2 points (misconception penalty)
- This prevents spamming easy questions to hit a target

#### 3.4c — Session Pacing & Micro-Breaks

**File:** `components/session/SessionPacer.tsx`

After every N questions (configurable, default 15), insert a brief pause:

```
┌─────────────────────────────────────────────┐
│  ☕ Quick Pause                              │
│                                              │
│  12 of 30 questions done                     │
│  Current accuracy: 83% — right in the zone   │
│                                              │
│  Take a breath. Look away from the screen    │
│  for 20 seconds.                             │
│                                              │
│  [Continue] (auto-resumes in 30s)            │
└─────────────────────────────────────────────┘
```

This is NOT optional-feeling. It's built into the flow as a feature, not a nag. The timer auto-resumes so it doesn't feel like an interruption they have to dismiss.

#### 3.4d — "Good Enough" Session Endings

Instead of fixed session sizes, allow the system to suggest stopping:

> "You've answered 22 questions with 88% accuracy. Your FSRS queue is clear for today.
> **End session** (recommended) or Continue (+10 questions)"

The key: frame stopping as the **recommended action**, not continuing. Reframe rest as strategy, not weakness.

### 3.5 — Interleaving Engine

**Research:** Interleaved practice improves performance by 9 percentage points vs blocked practice (Brunmair & Richter, 2019, Psychological Bulletin). Forces discrimination between similar concepts.

**Implementation:** The conceptQuestionSelector should, by default, interleave questions from different systems and conditions. Never serve 3+ questions from the same system in a row. After a Cardiology question, insert a Pulmonary or Neuro question before returning to Cardiology.

```typescript
function interleaveQuestions(questions: Question[]): Question[] {
  // Sort by system, then spread them out
  const bySystem = groupBy(questions, q => q.system);
  const result: Question[] = [];
  const iterators = Object.values(bySystem).map(qs => qs[Symbol.iterator]());

  // Round-robin across systems
  while (result.length < questions.length) {
    for (const iter of iterators) {
      const next = iter.next();
      if (!next.done) result.push(next.value);
    }
  }
  return result;
}
```

### 3.6 — Confusion Pair Surfacing

**Current State:** `drillReviewService.ts` already tracks confusion pairs. This data exists but isn't surfaced to the student.

**Enhancement:**

**File:** `components/dashboard/ConfusionPairAlert.tsx`

When the system detects the student consistently confuses two conditions (e.g., Crohn's vs UC, PE vs pneumothorax):

```
┌─────────────────────────────────────────────┐
│  🔍 Pattern Detected                        │
│                                              │
│  You've confused Crohn's Disease and         │
│  Ulcerative Colitis on 4 of your last 6     │
│  GI questions.                               │
│                                              │
│  [Start Contrastive Drill: Crohn's vs UC]   │
│  [Dismiss]                                   │
└─────────────────────────────────────────────┘
```

This auto-generates a targeted session using the existing Contrastive drill type, pre-loaded with the confused pair.

### 3.7 — Blueprint Gap Visualization

**File:** `components/dashboard/BlueprintGapCard.tsx`

Overlay PANCE blueprint percentages against the student's actual practice distribution:

```
Cardiovascular:  Blueprint 11% | Your practice 6%  → GAP: -5% ⚠️
Pulmonary:       Blueprint 9%  | Your practice 4%  → GAP: -5% ⚠️
GI:              Blueprint 10% | Your practice 12% → OK ✓
Musculoskeletal: Blueprint 8%  | Your practice 15% → OVER +7%
```

Color-code: red for underrepresented (>3% gap), amber for slight gap, green for on-target. This tells the student exactly where to focus without them having to figure it out.

### 3.8 — Overlearning Detection (When to Stop)

**Research:** After a concept reaches high stability in FSRS (e.g., stability > 30 days), additional practice within that interval has diminishing returns. The student's time is better spent on weaker areas.

**File:** `lib/services/overlearningDetector.ts`

```typescript
/**
 * Identifies concepts the student is over-practicing relative to their FSRS stability.
 *
 * If a card has stability > 30 days and the student reviews it within 3 days of last review,
 * the ROI of that review is very low. The system should redirect to weaker material.
 */
export function detectOverlearning(
  progress: UserProgress[],
  recentAttempts: QuestionAttempt[]
): OverlearningReport {
  const overlearned = progress.filter(p => {
    const stability = p.stability ?? 0;
    const daysSinceReview = daysBetween(p.lastReviewedAt, new Date());
    return stability > 30 && daysSinceReview < 3;
  });

  return {
    overlearnedCount: overlearned.length,
    timeSavedMinutes: overlearned.length * 1.5, // ~90s per question redirected
    redirectSuggestion: getWeakestSystem(progress), // Where to spend that time instead
  };
}
```

Surface on dashboard: "You've mastered 23 Cardiology concepts — your time is better spent on Pulmonary (4 cards due)."

---

## Part 4: Implementation Sequence

### Phase 1: Foundation (Week 1-2)
**Unblocks everything else.**

1. Build `conceptQuestionSelector.ts` — the question selection service
2. Implement `session/generate.ts` — replace the stub
3. Build `SessionScopeSelector.tsx` — system/subcategory/condition filtering UI
4. Wire into `CoreAdaptiveSession.tsx`
5. Verify end-to-end: user clicks Study → blueprint resolves → questions load

### Phase 2: Personalization (Week 2-3)
**Makes the app feel different for each role.**

6. Build `dashboardPersonalization.ts` config system
7. Modify `DashboardPage.tsx` to consume config
8. Modify `TrainingMenu.tsx` to filter modes by stage
9. Enhance onboarding wizard with stage-specific data collection
10. Build `useResolvedBlueprint` hook for client-side blueprint access

### Phase 3: Intelligence (Week 3-5)
**Research-backed learning optimization.**

11. Build `difficultyCalibrator.ts` (85% rule)
12. Build `calibrationEngine.ts` (misconception detection)
13. Build `wellnessEngine.ts` (diminishing returns, session pacing)
14. Implement streak freezes + quality-weighted goals
15. Build `SessionPacer.tsx` micro-break component
16. Implement interleaving in question selector
17. Build `ConfusionPairAlert.tsx`
18. Build `BlueprintGapCard.tsx`
19. Build `overlearningDetector.ts`

### Phase 4: Integration & Polish (Week 5-6)
**Connect everything, test across all 5 learner stages.**

20. Circadian scheduler integration with session recommendations
21. Dashboard widget rendering for all 5 stages
22. End-to-end testing: onboarding → dashboard → session → post-session for each stage
23. UX copy audit (stage-appropriate language)
24. Performance testing (ensure new services don't slow Edge Functions)

---

## Research Citations

- Wilson, R.C., et al. (2019). "The Eighty Five Percent Rule for Optimal Learning." *Nature Communications*, 10, 4646. https://www.nature.com/articles/s41467-019-12552-4
- Kruger, J. & Dunning, D. (1999). "Unskilled and Unaware of It." *Journal of Personality and Social Psychology*, 77(6), 1121-1134.
- "The Illusion of Knowing in College" (2021). *PMC*. https://pmc.ncbi.nlm.nih.gov/articles/PMC7909201/
- Brunmair, M. & Richter, T. (2019). "Similarity Matters: A Meta-Analysis of Interleaved Learning." *Psychological Bulletin*, 145(11), 1029-1052.
- "Physician and Medical Student Burnout" (2024). *PMC*. https://pmc.ncbi.nlm.nih.gov/articles/PMC11989521/
- "Burnout in medical education: interventions from a co-creation process" (2025). *BMC Medical Education*. https://link.springer.com/article/10.1186/s12909-025-06833-4
- "Medical Trainees and the Dunning-Kruger Effect" (2020). *PMC*. https://pmc.ncbi.nlm.nih.gov/articles/PMC7594774/
- "Chronotype and synchrony effects in human cognitive performance" (2025). *Chronobiology International*. https://www.tandfonline.com/doi/full/10.1080/07420528.2025.2490495
- "Cognitive Load Theory: Understanding and Optimizing Learning" (2021). *Educational Psychology Review*. https://link.springer.com/article/10.1007/s10648-021-09624-7
- "Calibration Toolkit for Teachers" (2024). *Structural Learning*. https://www.structural-learning.com/post/illusion-of-knowing-calibration

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Question pool too small for filtered sessions | Medium | High | Show "X questions available" in scope selector; fallback to broader scope |
| Blueprint weights not seeded in ExamBlueprintSystem | Medium | High | Hardcoded NCCPA_2025_BLUEPRINT fallback already exists |
| Edge Function timeout on complex queries | Low | Medium | Use Prisma select (not include), limit result sets, use KV cache |
| Users confused by role-specific UI changes | Low | Medium | Show "Why am I seeing this?" tooltips explaining personalization |
| Over-aggressive burnout nudges feel patronizing | Medium | Medium | Frame as strategy, not health advice. "Optimal" not "you need rest" |
