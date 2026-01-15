# Phase 3.5: The Nervous System - Implementation Report

**Date:** January 15, 2026  
**Status:** ✅ COMPLETE  
**Architect:** Cline (Forensic Audit)

---

## Executive Summary

The "Phase 3: Nervous System" roadmap was based on **stale documentation**. A forensic audit of the actual codebase revealed that **80-90% of the proposed features were already implemented**. This document records what existed vs. what was actually added.

---

## 🔍 Forensic Audit Results

### Already Implemented (NO ACTION REQUIRED)

| Feature | User's Assumption | Reality in Codebase |
|---------|-------------------|---------------------|
| **Blueprint Weights** | "Uses 13%/10%" | `lib/nccpa-blueprint.ts` → **Cardio: 0.11 (11%), Pulm: 0.09 (9%)** ✅ |
| **Behavioral Telemetry** | "Only explicit results" | `hooks/useImplicitMetrics.ts` → Full sensor: `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, `timezone` ✅ |
| **Backend Persistence** | "Need sensor layer" | Auto-POSTs to `/api/user/behavior-metrics` ✅ |
| **Database Schema** | "Need ReviewTelemetry" | `UserBehaviorMetrics` model exists with 15+ fields ✅ |
| **FSRS Optimization** | "Static parameters" | `PersonalizedFSRSParams` model + `UserSRSConfig` ✅ |
| **Interleaving** | Not mentioned | Full blueprint adherence scoring using cosine similarity ✅ |
| **Calibration Mode** | Not mentioned | `CalibrationProtocolUI.tsx` with 60-question threshold ✅ |

### Cognitive Psychometrics Infrastructure Found

```
lib/
├── micro-kinetics.ts      # Mouse/touch velocity tracking
├── typing-rhythm.ts       # Keystroke dynamics
├── fluency-scoring.ts     # Response fluency metrics
├── jol-calibration.ts     # "Judgment of Learning" calibration
├── circadian.ts           # Circadian rhythm context
├── error-diagnostics.ts   # Error pattern analysis
├── metacognition.ts       # Metacognitive prompts
├── implicit-metrics.ts    # Behavioral signal processing

hooks/
├── useImplicitMetrics.ts  # Core behavioral sensor ✅
├── useMouseTrajectory.ts  # Mouse path tracking ✅
├── useTelemetry.ts        # Content engagement metrics
```

---

## 🆕 Phase 3.5: TRUE Gaps Filled

### 1. CMRR Dynamic Retention Calculator

**File:** `lib/cmrr-optimizer.ts`

The FSRS engine used static `desired_retention = 0.90`. This module implements dynamic retention optimization:

```typescript
import { calculateOptimalRetention } from '@/lib/cmrr-optimizer';

const result = calculateOptimalRetention({
  reviewHistory,
  avgStudyTimeMinutes: 30,
  targetExamDate: new Date('2026-06-15'),
});

// Returns:
// {
//   optimalRetention: 0.87,
//   workloadEstimate: 45,      // reviews/day
//   knowledgeScore: 82,        // 0-100
//   efficiencyRatio: 1.82,
//   confidenceLevel: 'medium',
//   recommendation: 'With your available study time...',
//   sliderPosition: 41,        // For UI slider
// }
```

**Key Features:**
- Minimizes `Workload / Knowledge` ratio
- Adjusts for available study time
- Applies exam urgency factor
- Provides 5 preset retention levels

### 2. Epistemic Gauge Component

**File:** `components/ui/EpistemicGauge.tsx`

Implements "Visual Uncertainty" from Open Learner Models research:

```tsx
import { EpistemicGauge, CalibrationCTA } from '@/components/ui/EpistemicGauge';

// Usage in dashboard
<EpistemicGauge
  value={0.72}           // 72% accuracy
  dataPoints={35}        // Only 35 questions
  confidenceThreshold={60}
  label="Cardiovascular"
  colorScheme="blue"
/>

// Renders with:
// - opacity: 0.25 + (35/60 * 0.75) = 0.69
// - "Emerging Pattern" badge
// - Tooltip: "Complete 25 more questions for precise prediction"
```

**Key Features:**
- Confidence formula: `C = min(1, N_reviews / 60)`
- Opacity-based uncertainty visualization
- Blur overlay for very low confidence (<33%)
- Four calibration levels: Collecting → Emerging → Provisional → Confident
- `CalibrationCTA` component for NaN prevention
- `EpistemicRadialGauge` circular variant
- `EpistemicSystemGrid` for multi-system dashboards

---

## 📊 Database Schema Verification

The Prisma schema already contains comprehensive telemetry support:

### `UserBehaviorMetrics` Model (EXISTS ✅)
```prisma
model UserBehaviorMetrics {
  id           String @id
  userId       String
  questionId   String
  
  // Core timing
  timeToFirstClick  Int
  dwellTime         Int
  totalResponseTime Int
  
  // Interaction patterns
  answerChanges    Int @default(0)
  optionHovers     Int @default(0)
  scrollDepth      Int?
  
  // Behavioral signals
  hesitationEvents Int @default(0)
  backtrackCount   Int @default(0)
  
  // FSRS derivation
  derivedRating    Int?    // 1-4
  ratingConfidence Float?  // 0-1
  
  // Advanced (optional)
  trajectoryData Json?     // Mouse trajectory
  typingRhythm   Json?     // Keystroke timing
}
```

### `PersonalizedFSRSParams` Model (EXISTS ✅)
```prisma
model PersonalizedFSRSParams {
  id     String @id
  userId String @unique
  w      Json   // The 19 FSRS weights
  
  // Optimization metadata
  sampleSize             Int?
  lastOptimizedAt        DateTime?
  improvementOverDefault Float?
  
  // Per-system adjustments
  systemModifiers Json?
}
```

---

## 🎯 Integration Guide

### Using CMRR in Settings UI

```tsx
// components/settings/RetentionSettings.tsx
import { calculateOptimalRetention, getRetentionPresets } from '@/lib/cmrr-optimizer';

export function RetentionSettings() {
  const { reviewHistory, studyTime, examDate } = useUserProfile();
  
  const recommendation = calculateOptimalRetention({
    reviewHistory,
    avgStudyTimeMinutes: studyTime,
    targetExamDate: examDate,
  });
  
  const presets = getRetentionPresets();
  
  return (
    <div>
      <h3>Study Efficiency Slider</h3>
      <input
        type="range"
        min={0}
        max={100}
        value={recommendation.sliderPosition}
        // ...
      />
      <p>{recommendation.recommendation}</p>
    </div>
  );
}
```

### Using EpistemicGauge in Analytics

```tsx
// components/analytics/SystemMasteryPanel.tsx
import { EpistemicSystemGrid, CalibrationCTA } from '@/components/ui/EpistemicGauge';

export function SystemMasteryPanel({ systems, totalQuestions }) {
  if (totalQuestions < 20) {
    return (
      <CalibrationCTA
        currentCount={totalQuestions}
        targetCount={60}
        onStartCalibration={() => navigate('/study')}
      />
    );
  }
  
  return (
    <EpistemicSystemGrid
      systems={systems.map(s => ({
        system: s.name,
        accuracy: s.correct / s.total,
        dataPoints: s.total,
      }))}
      confidenceThreshold={60}
      onSystemClick={handleDrilldown}
    />
  );
}
```

---

## 📝 Files Created

| File | Purpose |
|------|---------|
| `lib/cmrr-optimizer.ts` | Dynamic retention calculator using CMRR algorithm |
| `components/ui/EpistemicGauge.tsx` | Uncertainty-aware visualization components |
| `docs/plans/PHASE_3_5_NERVOUS_SYSTEM.md` | This documentation |

---

## ❌ NOT Implemented (Deferred)

| Feature | Reason |
|---------|--------|
| Per-distractor hover tracking | `useImplicitMetrics` tracks `answerSwitches` but not per-option duration. Deferred to Phase 4. |
| CMRR Settings UI | Infrastructure ready, UI integration deferred |
| Keystroke-based rating derivation | `typing-rhythm.ts` exists but not integrated into FSRS rating |

---

## 🔑 Key Takeaways

1. **The codebase is more sophisticated than assumed.** Always audit before implementing.

2. **Blueprint weights are correct.** `lib/nccpa-blueprint.ts` uses 2024/2025 NCCPA weights.

3. **Behavioral telemetry is production-ready.** `useImplicitMetrics` + `UserBehaviorMetrics` + API endpoint.

4. **CMRR fills a genuine gap.** Dynamic retention optimization was truly missing.

5. **Epistemic uncertainty is now visualized.** No more NaN crashes - ghostly dashboards that solidify.

---

## 📚 References

- FSRS v5 Algorithm: https://github.com/open-spaced-repetition/fsrs4anki
- CMRR Paper: "Optimizing Spaced Repetition Schedule" (Ye et al., 2024)
- Open Learner Models: Visualizing Uncertainty in Education (Bull & Kay)
- NCCPA 2025 Blueprint: https://www.nccpa.net/pance-content-blueprint
