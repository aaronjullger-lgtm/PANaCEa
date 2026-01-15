# Clinical Precision Sprint - Phase 2.2
## From "Prototype" to "Clinical Candidate"

> **Status:** IN PROGRESS  
> **Created:** 2026-01-15  
> **Priority:** CRITICAL  
> **Sprint Duration:** 3-5 days

---

## Executive Summary

This sprint addresses the "Presentation Layer Debt" identified in the January 15 deep-dive audit. The goal is to transform PANaCEa from a "collection of disjointed tools" into a cohesive "Cognitive Prosthetic" that medical students can trust for 6+ hour study sessions.

---

## Pathologies Identified

### A. Visual & Cognitive Dissonance ("Button Soup") - CRITICAL
| Symptom | Root Cause | Solution |
|---------|------------|----------|
| Orange/Amber/Teal gradient buttons everywhere | Marketing-first design | Semantic Design System |
| High cognitive load | Inconsistent visual hierarchy | "Stormy Slate" theme |
| User confusion | Color used for branding, not data | Color reserved for data only |

### B. NaN Mathematical Failures - CRITICAL
| Symptom | Root Cause | Solution |
|---------|------------|----------|
| "NaN%" in Analytics | Division by zero | Defensive math patterns ✅ |
| Empty charts | Missing cold-start handling | Calibration Protocol UI ✅ |

**Status:** Already addressed in `ExamReadinessCard.tsx` with `CalibrationProtocolUI` component.

### C. Hierarchy Inversion - HIGH
| Symptom | Root Cause | Solution |
|---------|------------|----------|
| "Grand Rounds" visually prioritized | Feature drift | DOM reordering |
| Core PANCE not hero element | No design system | Semantic button variants |

### D. Telemetry Disconnect - MEDIUM
| Symptom | Root Cause | Solution |
|---------|------------|----------|
| Missing `time_to_first_click` | No button instrumentation | Button latency hook ✅ |
| Cannot detect hesitation | No FSRS v6 integration | `sessionStorage` pipeline ✅ |

---

## Implementation Progress

### ✅ Completed

#### 1. SemanticButton Component (`components/ui/SemanticButton.tsx`)
Created a new button system with:

**Variants:**
- `primary` - High-contrast white on slate (THE hero CTA)
- `secondary` - Glassmorphism slate (all other actions)
- `success` - Teal (confirmed positive states only)
- `danger` - Red (destructive actions only)
- `ghost` - Transparent (navigation/subtle)

**Features:**
- Built-in latency tracking via `useButtonLatency` hook
- Tracks `time_to_first_click` for FSRS v6 analysis
- Stores metrics in `sessionStorage` for offline analysis
- Framer Motion animations

**Convenience Exports:**
- `StartSessionButton` - Pre-configured hero CTA
- `ActionButton` - Secondary actions
- `GhostButton` - Navigation

#### 2. Button Latency Telemetry
Integrated into `SemanticButton`:
```typescript
// Tracks render-to-click delta
const { trackClick } = useButtonLatency('start-main-session');

// Stores in sessionStorage for FSRS analysis
sessionStorage.getItem('panacea_button_latencies')
```

### ✅ Completed

#### 3. ExamReadinessCard Button Migration (DONE)
Replaced amber/orange gradient buttons with semantic variants:

**Before:**
```jsx
className="bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25"
```

**After:**
```jsx
<StartSessionButton onClick={handleStartSession} isLoading={isGenerating} />
```

**Buttons Migrated:**
- `CollectingState` → `StartSessionButton` (primary, high-contrast white)
- `ProvisionalState` → `StartSessionButton` (primary, high-contrast white)
- `ConfidentState` → `SemanticButton` (success variant for passing, primary for needs work)

#### 4. CalibrationProtocolUI Button Migration (DONE)
Replaced the "Continue Calibration" button with `StartSessionButton`:
- Button now uses high-contrast white-on-slate design
- Includes latency tracking via `buttonId="start-session-calibration"`

### ✅ Completed

#### 5. Dashboard Hierarchy Audit (VERIFIED)
Reviewed `DashboardPage.tsx` DOM order:

**Current Layout (CORRECT):**
```
1. Header (Greeting)
2. Quick Stats Row (Streak, Cards, PANCE Predictor)
3. ✅ HERO ROW: ExamReadinessCard (left) + SystemPerformanceWidget (right)
4. Algorithm Status + FSRS Review Queue
5. Cognitive Health Charts (Decay Curve, Stability Pyramid)
6. Daily Practice (Wordle, Rapid Recall, Daily Triad)
```

**Findings:**
- ✅ `ExamReadinessCard` IS correctly positioned as hero (first major content row)
- ✅ Grid layout places it on left (primary visual position)
- ⚠️ Quick Stats row still uses marketing colors (orange-600, blue-600, purple-600)
- ⚠️ PANCE Predictor uses mock data (`mockPANCEPredictor = 78`)
- ⚠️ Legacy FSRS Review Queue uses old blue-600 styling

**No DOM reordering needed** - hierarchy is correct.

### ✅ Completed

#### 6. Tailwind Design Tokens (DONE)
Added Stormy Slate design tokens to `tailwind.config.js`:
```javascript
surface: { primary, secondary, glass, elevated }
action: { primary, secondary, primary-hover, secondary-hover }
data: { pass, fail, provisional, neutral }
```

#### 7. AnalyticsDashboard Empty State CTA (DONE)
Fixed the "Dead End" empty state in `components/analytics/AnalyticsDashboard.tsx`:
- Replaced static placeholder with actionable CTA
- Added "Start Calibration Session" button
- Uses high-contrast white button design (`bg-slate-100 text-slate-900`)
- Includes helpful context ("~15 minutes • Interleaved across 3+ organ systems")

### ❌ Not Started

#### 8. Full Color Sweep (Remaining)
- Search for all `amber-`, `orange-`, `purple-` gradients in non-data contexts
- Replace with semantic slate variants
- Preserve color ONLY for data visualization

---

## Design System Reference

### Color Usage Rules

| Color | Use Case | Examples |
|-------|----------|----------|
| `slate-100` (white) | Primary CTA only | "Start Session" button |
| `slate-800/60` | Secondary actions | Drill buttons, tools |
| `teal-500` | Success data | Pass probability bar, correct answers |
| `red-500` | Failure data | Wrong answers, warnings |
| `amber-400` | Provisional data | "Building Profile" state |
| **FORBIDDEN** | Marketing/branding | Orange gradients, purple gradients |

### Button Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════╗  │
│  ║     START MAIN SESSION (primary, xl)         ║  │
│  ╚═══════════════════════════════════════════════╝  │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Quick Drill     │  │ System Focus    │          │
│  │ (secondary)     │  │ (secondary)     │          │
│  └─────────────────┘  └─────────────────┘          │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Grand Rounds    │  │ Virtual OSCE    │          │
│  │ (secondary)     │  │ (secondary)     │          │
│  └─────────────────┘  └─────────────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## Migration Guide

### Replacing Old Buttons

**Old Pattern:**
```jsx
<motion.button
  className="bg-gradient-to-r from-amber-500 to-orange-500 
             hover:from-amber-400 hover:to-orange-400 
             text-white font-semibold rounded-xl
             shadow-lg shadow-amber-500/25"
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
  Start Session
</motion.button>
```

**New Pattern:**
```jsx
import { StartSessionButton } from '@/components/ui/SemanticButton';

<StartSessionButton 
  onClick={handleStartSession}
  isLoading={isGenerating}
  leftIcon={<PlayIcon className="w-6 h-6" />}
/>
```

### For Non-Hero Buttons:
```jsx
import { SemanticButton } from '@/components/ui/SemanticButton';

<SemanticButton
  variant="secondary"
  size="lg"
  onClick={handleDrillStart}
  leftIcon={<LightningBoltIcon className="w-5 h-5" />}
>
  Quick Drill
</SemanticButton>
```

---

## Files Modified

| Action | File | Description |
|--------|------|-------------|
| CREATE | `components/ui/SemanticButton.tsx` | Semantic button system |
| CREATE | `docs/plans/CLINICAL_PRECISION_SPRINT.md` | This document |
| UPDATED | `components/dashboard/Rolling360/ExamReadinessCard.tsx` | ✅ Button migration complete |
| UPDATED | `components/dashboard/Rolling360/CalibrationProtocolUI.tsx` | ✅ Button migration complete |
| UPDATED | `components/dashboard/DashboardPage.tsx` | ✅ Quick Stats colors converted to slate |
| UPDATED | `tailwind.config.js` | ✅ Design tokens added (surface, action, data) |
| UPDATED | `components/analytics/AnalyticsDashboard.tsx` | ✅ Empty state CTA added |

---

## Success Metrics

| Metric | Before | Target | Status |
|--------|--------|--------|--------|
| Distinct button colors | 5+ | 2 (white + slate) | ✅ (Hero CTAs) |
| Marketing gradients | Multiple | 0 (CTAs) | ✅ (CTAs done) |
| Button latency tracking | None | 100% of CTAs | ✅ |
| NaN errors | Possible | Impossible | ✅ |
| DOM hierarchy correctness | Unknown | Verified | ✅ |
| Quick Stats row colors | orange/blue/purple | slate | ✅ |

---

## Next Steps

1. **Immediate:** Update `ExamReadinessCard.tsx` to use `StartSessionButton`
2. **Immediate:** Update `CalibrationProtocolUI.tsx` to use semantic buttons
3. **Day 2:** Full color sweep across all dashboard components
4. **Day 3:** Dashboard hierarchy audit and DOM reordering
5. **Day 4:** E2E test to verify no visual regression

---

*Lead Architect's Note:* The goal is **Trust**. A medical student will not trust a dashboard that looks like a mobile game. They *will* trust a clean, slate-colored clinical dashboard that knows exactly what they need to study next.

*Document created: 2026-01-15*
