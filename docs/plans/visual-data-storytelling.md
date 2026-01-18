# Visual Data Storytelling Architecture

## Executive Summary

This document architects the "Clinical Triage" visualization layer for the Rolling 360 Dashboard, solving three key problems:

1. **Data Vomit**: 14 PANCE systems on a spider chart is unreadable
2. **Future Blindness**: Users don't see how inaction affects their score
3. **Effort Disconnect**: Users don't feel the immediate impact of their work

---

## 1. The "System Triage" Visualization

### Problem Statement

A 14-point Spider/Radar chart creates cognitive overload. The human eye can't quickly parse:

- CV: 85%, Pulm: 72%, GI: 68%, MSK: 91%, HEENT: 64%, Repro: 78%, Neuro: 55%, Psych: 82%, Endo: 71%, Derm: 88%, GU: 75%, Heme: 62%, ID: 69%, Renal: 59%

**Goal**: Instant "triage" - user should know in <2 seconds which systems need attention.

---

### Recommended Solution: **Weighted Triage Heatmap**

#### Design Concept: "The Body Map"

A stylized human silhouette where organ systems are **tile regions** with:

- **Size** = NCCPA Blueprint weight (Cardio is biggest, Emergency smallest)
- **Color** = Performance status (Red/Yellow/Green/Blue)
- **Pulsing** = Urgency indicator for critical systems

#### Color Coding (Clinical Triage Theme)

| Status   | Color             | Accuracy Range | Label             |
| -------- | ----------------- | -------------- | ----------------- |
| Critical | `#EF4444` (Red)   | <60%           | "Needs CPR"       |
| At Risk  | `#F59E0B` (Amber) | 60-75%         | "Unstable"        |
| Stable   | `#22C55E` (Green) | 75-90%         | "Stable"          |
| Mastered | `#0EA5E9` (Blue)  | >90%           | "Discharge Ready" |

#### Layout: Anatomical Grouping

```
┌─────────────────────────────────────────────────────────────┐
│                    PANCE SYSTEM TRIAGE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   NEURO     │  │   HEENT     │  │   PSYCH     │          │
│  │    7%       │  │    8%       │  │    7%       │          │
│  │  ████ 62%   │  │  ████ 78%   │  │  ████ 85%   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌───────────────────┐  ┌───────────────────┐               │
│  │    CARDIOVASCULAR  │  │      PULMONARY    │               │
│  │        11%         │  │         9%        │               │
│  │    ████████ 71%    │  │    ██████ 68%     │               │
│  └───────────────────┘  └───────────────────┘               │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   GI     │  │  ENDO    │  │  RENAL   │  │   GU     │     │
│  │   9%     │  │   6%     │  │   4%     │  │   5%     │     │
│  │ ████ 82% │  │ ███ 59%  │  │ ██ 55%   │  │ ███ 73%  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  REPRO   │  │   MSK    │  │  DERM    │  │   HEME   │     │
│  │   8%     │  │   9%     │  │   5%     │  │   4%     │     │
│  │ ████ 78% │  │ █████ 91%│  │ ████ 88% │  │ ██ 62%   │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                              │
│  ┌───────────────────────────────────────┐                  │
│  │        INFECTIOUS DISEASE  4%          │                  │
│  │            ████████ 69%                │                  │
│  └───────────────────────────────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Alternative: Condensed "Pill List" View

For mobile or when detail is needed, use a sorted pill list:

```
┌─────────────────────────────────────────┐
│ 🔴 Renal         55%  ■■■■■□□□□□  4%   │
│ 🔴 Neuro         62%  ■■■■■■□□□□  7%   │
│ 🟡 Pulmonary     68%  ■■■■■■■□□□  9%   │
│ 🟡 Cardiovasc    71%  ■■■■■■■□□□  11%  │
│ 🟢 GU            73%  ■■■■■■■□□□  5%   │
│ 🟢 Repro         78%  ■■■■■■■■□□  8%   │
│ ...                                     │
└─────────────────────────────────────────┘
```

#### Implementation Component

```typescript
// components/dashboard/Rolling360/SystemTriageHeatmap.tsx

interface SystemTriageProps {
  systemStats: Record<string, SystemStats>;
  blueprintWeights: Record<string, number>;
}

interface TriageCell {
  system: string;
  accuracy: number;
  weight: number;
  status: 'critical' | 'at_risk' | 'stable' | 'mastered';
  delta: number; // change since last session
}

function getTriageStatus(accuracy: number): TriageCell['status'] {
  if (accuracy < 60) return 'critical';
  if (accuracy < 75) return 'at_risk';
  if (accuracy < 90) return 'stable';
  return 'mastered';
}

const STATUS_COLORS = {
  critical: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
  at_risk: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
  stable: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400' },
  mastered: { bg: 'bg-sky-500/20', border: 'border-sky-500', text: 'text-sky-400' },
};
```

---

## 2. The "Drift Vector" Implementation Spec

### Problem Statement

Users see their current score but are blind to **where their knowledge is heading**. Without intervention, memories decay. We need to show them the "ghost line" of inevitable decline.

### Mathematical Foundation

#### FSRS Retrievability Decay Formula

For each FSRS card, retrievability decays exponentially:

```
R(t) = exp(-t/S)

Where:
- R(t) = Retrievability at time t (0.0 to 1.0)
- t = Days since last review
- S = Stability (days until R drops to ~37%)
```

#### Drift Vector Calculation

**Step 1: Current Aggregate Retrievability**

```typescript
function calculateAggregateRetrievability(cards: FSRSCard[], targetDate: Date): number {
  const now = new Date();

  let weightedSumR = 0;
  let totalWeight = 0;

  for (const card of cards) {
    const daysSinceReview =
      (targetDate.getTime() - card.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24);

    // FSRS decay formula
    const retrievability = Math.exp(-daysSinceReview / card.stability);

    // Weight by condition frequency/importance (optional)
    const weight = card.blueprintWeight || 1;

    weightedSumR += retrievability * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSumR / totalWeight : 0;
}
```

**Step 2: Project to Future Dates**

```typescript
interface DriftProjection {
  day: number; // Days from now
  retrievability: number; // Expected average R
  predictedAccuracy: number; // Mapped to accuracy
  predictedScore: number; // PANCE score (200-800)
}

function calculateDriftVector(cards: FSRSCard[], daysAhead: number = 14): DriftProjection[] {
  const projections: DriftProjection[] = [];
  const now = new Date();

  for (let day = 0; day <= daysAhead; day++) {
    const targetDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    const avgR = calculateAggregateRetrievability(cards, targetDate);

    // Map R to accuracy (R of 0.9 ≈ 90% accuracy assumption)
    const predictedAccuracy = avgR * 100;

    // Map accuracy to PANCE score (linear: 0% = 200, 100% = 800)
    const predictedScore = 200 + (predictedAccuracy / 100) * 600;

    projections.push({
      day,
      retrievability: avgR,
      predictedAccuracy,
      predictedScore: Math.round(predictedScore),
    });
  }

  return projections;
}
```

**Step 3: Calculate Score Decay**

```typescript
interface DriftVector {
  currentScore: number;
  projectedScoreDay7: number;
  projectedScoreDay14: number;
  dailyDecayRate: number; // Points/day
  daysUntilDanger: number; // Days until score drops below 350
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

function calculateDriftVector(projections: DriftProjection[]): DriftVector {
  const current = projections[0];
  const day7 = projections[7] || projections[projections.length - 1];
  const day14 = projections[14] || projections[projections.length - 1];

  const decayDay7 = current.predictedScore - day7.predictedScore;
  const dailyDecayRate = decayDay7 / 7;

  // Find when score crosses 350 (passing threshold)
  let daysUntilDanger = Infinity;
  for (const p of projections) {
    if (p.predictedScore < 350) {
      daysUntilDanger = p.day;
      break;
    }
  }

  // Determine urgency
  let urgency: DriftVector['urgency'] = 'low';
  if (daysUntilDanger <= 3) urgency = 'critical';
  else if (daysUntilDanger <= 7) urgency = 'high';
  else if (daysUntilDanger <= 14) urgency = 'medium';

  return {
    currentScore: current.predictedScore,
    projectedScoreDay7: day7.predictedScore,
    projectedScoreDay14: day14.predictedScore,
    dailyDecayRate: Math.round(dailyDecayRate * 10) / 10,
    daysUntilDanger,
    urgency,
  };
}
```

### Visual Representation: The Ghost Line

```
┌───────────────────────────────────────────────────────────┐
│ PANCE Score Trajectory                           🔴 -12pt │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  400 ─┼─●━━━━━━━━━━━━━━━━━━━━━ Current: 389              │
│       │  ╲                                                │
│       │   ╲ ·················→ Ghost: 377 (Day 7)        │
│  350 ─┼────╳─────────────────── PASSING THRESHOLD ────── │
│       │     ╲                                             │
│       │      ╲ ·············→ Ghost: 361 (Day 14)        │
│  300 ─┼───────────────────────────────────────────────── │
│       │                                                   │
│       └───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼ │
│         Now  2   4   6   8  10  12  14  Days             │
│                                                           │
│  ⚠️ Without review: -1.7 pts/day. You have 9 days.       │
└───────────────────────────────────────────────────────────┘
```

### Backend API Endpoint

```typescript
// functions/api/user/drift-projection.ts

export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context;
  const auth = await authenticateRequest(request, env);
  if (!auth) return unauthorized();

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get all user's FSRS cards
    const cards = await prisma.userProgress.findMany({
      where: { userId: auth.userId },
      select: {
        conditionId: true,
        fsrsStability: true,
        fsrsRetrievability: true,
        lastReviewedAt: true,
        system: true,
      },
    });

    const projections = calculateDriftVector(cards, 14);
    const drift = analyzeDrift(projections);

    return new Response(
      JSON.stringify({
        projections,
        drift,
        summary: {
          currentScore: drift.currentScore,
          day7Score: drift.projectedScoreDay7,
          decayRate: drift.dailyDecayRate,
          urgency: drift.urgency,
          message: getDriftMessage(drift),
        },
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

function getDriftMessage(drift: DriftVector): string {
  if (drift.urgency === 'critical') {
    return `⚠️ URGENT: Your score will drop below passing in ${drift.daysUntilDanger} days!`;
  }
  if (drift.urgency === 'high') {
    return `Your knowledge is decaying at ${drift.dailyDecayRate} pts/day. Study today to prevent drop.`;
  }
  if (drift.urgency === 'medium') {
    return `Projected ${drift.projectedScoreDay7 - drift.currentScore} point drop in 7 days without review.`;
  }
  return `Your knowledge is stable. Keep up the consistent reviews!`;
}
```

---

## 3. The "Session Post-Mortem" (Dopamine Hit)

### Problem Statement

After a grueling 20-question session, the user sees "75% Correct". This is **boring** and doesn't connect effort to outcomes.

### Design Philosophy

Transform the summary into a **victory lap** that shows:

1. **What you accomplished** (not just score)
2. **How you changed** (delta, not absolute)
3. **What disaster you prevented** (decay avoided)

### Session Summary Data Model

```typescript
interface SessionPostMortem {
  // Basic Stats
  questionsAnswered: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;

  // The DELTA (key dopamine driver)
  scoreChange: number; // e.g., +2.3 points
  memoriesStabilized: number; // Cards with stability increased
  decayPrevented: number; // Percentage of decay you just avoided

  // System-Level Impact
  systemImpact: {
    system: string;
    questionsAnswered: number;
    accuracyDelta: number; // e.g., +5% improvement
    newStatus: 'critical' | 'at_risk' | 'stable' | 'mastered';
    previousStatus: 'critical' | 'at_risk' | 'stable' | 'mastered';
  }[];

  // Streak/Achievement
  currentStreak: number;
  streakMilestone: string | null; // "🔥 7-day streak!"
  achievementUnlocked: string | null;

  // Ghost Line Update
  previousProjectedDay7: number;
  newProjectedDay7: number;
  projectionImprovement: number;

  // Motivational Message
  headline: string;
  subheadline: string;
}
```

### Visual Design: The Victory Screen

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                    🎉 SESSION COMPLETE 🎉                    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│           ┌─────────────────────────────────┐               │
│           │                                  │               │
│           │         +2.3 POINTS              │               │
│           │       Your PANCE Score ↑         │               │
│           │                                  │               │
│           │    389 → 391                     │               │
│           │                                  │               │
│           └─────────────────────────────────┘               │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   📊 SESSION IMPACT                                          │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  15/20 Correct                              75%    │    │
│   │  ━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│   │  5 Cards    │ │   -4.2%     │ │  +3 Days    │           │
│   │ Stabilized  │ │ Decay       │ │  Buffer     │           │
│   │  ⬆️ Memory   │ │ Prevented   │ │  Added      │           │
│   └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   🏥 SYSTEM TRIAGE UPDATE                                    │
│                                                              │
│   Cardiovascular:  🔴→🟡  65% → 71%   (+6%)                 │
│   Pulmonary:       🟡→🟡  68% → 70%   (+2%)                 │
│   Neurology:       🔴→🔴  55% → 58%   (+3%)                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   📈 TRAJECTORY UPDATE                                       │
│                                                              │
│   Before: Score projected to drop to 377 in 7 days          │
│   After:  Score projected to drop to 385 in 7 days          │
│                                                              │
│   ✅ You just bought yourself 3 extra days of buffer!       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   🔥 7-Day Study Streak!                                     │
│                                                              │
│   ┌────────────────────────────────────────────────┐        │
│   │  [Continue Streak]       [View Full Dashboard] │        │
│   └────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Calculations

```typescript
// Calculate decay prevented
function calculateDecayPrevented(
  cardsReviewed: ReviewedCard[],
  daysProjection: number = 7
): number {
  let totalDecayPrevented = 0;

  for (const card of cardsReviewed) {
    // What would R be at Day+7 WITHOUT this review?
    const oldR_day7 = Math.exp(-daysProjection / card.previousStability);

    // What will R be at Day+7 WITH this review?
    const newR_day7 = Math.exp(-daysProjection / card.newStability);

    // Decay prevented = new R - old R (positive means we helped)
    const decayPrevented = newR_day7 - oldR_day7;
    totalDecayPrevented += decayPrevented;
  }

  // Return as percentage of total possible decay
  return (totalDecayPrevented / cardsReviewed.length) * 100;
}

// Calculate score delta
function calculateScoreDelta(beforeStats: Rolling360Stats, afterStats: Rolling360Stats): number {
  const beforeScore = beforeStats.predictedScore || 200;
  const afterScore = afterStats.predictedScore || 200;
  return afterScore - beforeScore;
}

// Generate motivational headline
function generateHeadline(postMortem: SessionPostMortem): string {
  if (postMortem.scoreChange >= 5) {
    return '🚀 MASSIVE GAIN!';
  }
  if (postMortem.scoreChange >= 2) {
    return '💪 Strong Progress!';
  }
  if (postMortem.scoreChange > 0) {
    return '📈 Moving Forward';
  }
  if (postMortem.decayPrevented > 5) {
    return '🛡️ Knowledge Defended';
  }
  return '✅ Session Complete';
}
```

### Implementation Component

```typescript
// components/session/SessionPostMortem.tsx

interface SessionPostMortemProps {
  sessionId: string;
  onContinue: () => void;
  onViewDashboard: () => void;
}

export function SessionPostMortem({
  sessionId,
  onContinue,
  onViewDashboard
}: SessionPostMortemProps) {
  const { data, isLoading } = useSWR(
    `/api/session/${sessionId}/post-mortem`
  );

  if (isLoading) return <PostMortemSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="..."
    >
      {/* Score Delta Hero */}
      <ScoreDeltaHero delta={data.scoreChange} />

      {/* Impact Cards */}
      <ImpactCards
        stabilized={data.memoriesStabilized}
        decayPrevented={data.decayPrevented}
        bufferDays={data.projectionImprovement}
      />

      {/* System Triage Changes */}
      <SystemTriageChanges impact={data.systemImpact} />

      {/* Trajectory Update */}
      <TrajectoryUpdate
        before={data.previousProjectedDay7}
        after={data.newProjectedDay7}
      />

      {/* Streak/Achievement */}
      {data.streakMilestone && (
        <StreakBadge milestone={data.streakMilestone} />
      )}

      {/* CTAs */}
      <div className="flex gap-4">
        <PrimaryButton onClick={onContinue}>
          Continue Streak
        </PrimaryButton>
        <SecondaryButton onClick={onViewDashboard}>
          View Dashboard
        </SecondaryButton>
      </div>
    </motion.div>
  );
}
```

---

## Summary: Implementation Roadmap

### Phase 1: System Triage Heatmap (3-4 hours)

- [ ] Create `SystemTriageHeatmap.tsx` component
- [ ] Create `TriagePillList.tsx` for mobile/alt view
- [ ] Integrate with `SystemPerformanceWidget.tsx`
- [ ] Add animation for status transitions

### Phase 2: Drift Vector (4-5 hours)

- [ ] Create `lib/driftCalculator.ts` with FSRS decay math
- [ ] Create `functions/api/user/drift-projection.ts` endpoint
- [ ] Create `components/dashboard/charts/DriftVectorChart.tsx`
- [ ] Add urgency alerts to dashboard

### Phase 3: Session Post-Mortem (3-4 hours)

- [ ] Create `functions/api/session/[sessionId]/post-mortem.ts`
- [ ] Create `components/session/SessionPostMortem.tsx`
- [ ] Create impact calculation utilities
- [ ] Integrate with session completion flow

### Total Estimated Effort: 10-13 hours

---

## Appendix: NCCPA Blueprint Weights (2024)

| System             | Weight | Tile Size |
| ------------------ | ------ | --------- |
| Cardiovascular     | 11%    | XL        |
| Pulmonary          | 9%     | L         |
| Gastrointestinal   | 9%     | L         |
| Musculoskeletal    | 9%     | L         |
| HEENT              | 8%     | M         |
| Reproductive       | 8%     | M         |
| Neurological       | 7%     | M         |
| Psychiatry         | 7%     | M         |
| Endocrine          | 6%     | S         |
| Dermatology        | 5%     | S         |
| Genitourinary      | 5%     | S         |
| Hematology         | 4%     | XS        |
| Infectious Disease | 4%     | XS        |
| Renal              | 4%     | XS        |
