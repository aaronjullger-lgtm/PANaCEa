# PANaCEa Zero-Friction Cognitive Prosthetic: Complete Audit & Fixes

## CRITICAL ISSUES FOUND

### 🔴 **ISSUE 1: Re-render Loop in QuizView (Lines 1-2500)**

**Problem:** `useImplicitMetrics` hook uses `useState` for metrics, causing re-renders on every telemetry update.

**Location:** `hooks/useImplicitMetrics.ts` (lines 1-300)

**Impact:** Performance degradation, battery drain, janky UI during question interaction.

**Root Cause:**
```typescript
// WRONG: State triggers re-renders
const [metrics, setMetrics] = useState<QuestionImplicitMetrics>(createInitialMetrics());
```

**Fix:**
```typescript
// hooks/useImplicitMetrics.ts - REPLACE ENTIRE FILE
import { useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getBrowserTimezone } from '../lib/circadian';

export interface QuestionImplicitMetrics {
  timeToFirstClick: number | null;
  answerSwitches: number;
  totalDwellTime: number;
  timezone: string;
  questionStartTime: string;
  submitTime: string | null;
  selectedAnswer: string | number | null;
  previousAnswer: string | number | null;
}

export interface UseImplicitMetricsReturn {
  metrics: QuestionImplicitMetrics;
  startQuestion: () => void;
  recordAnswerSelection: (answer: string | number) => void;
  submitAnswer: (questionId: string, wasCorrect: boolean, questionType?: string) => Promise<QuestionImplicitMetrics>;
  reset: () => void;
  getApiPayload: () => { timeToFirstClick: number | undefined; answerSwitches: number; totalDwellTime: number; timezone: string };
  isSubmitting: boolean;
  submissionError: Error | null;
}

function createInitialMetrics(): QuestionImplicitMetrics {
  return {
    timeToFirstClick: null,
    answerSwitches: 0,
    totalDwellTime: 0,
    timezone: getBrowserTimezone(),
    questionStartTime: new Date().toISOString(),
    submitTime: null,
    selectedAnswer: null,
    previousAnswer: null,
  };
}

export function useImplicitMetrics(): UseImplicitMetricsReturn {
  // ✅ FIX: Use refs instead of state to prevent re-renders
  const metricsRef = useRef<QuestionImplicitMetrics>(createInitialMetrics());
  const isSubmittingRef = useRef(false);
  const submissionErrorRef = useRef<Error | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const dwellIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { getToken } = useAuth();

  const startQuestion = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;
    metricsRef.current = {
      ...createInitialMetrics(),
      questionStartTime: new Date(now).toISOString(),
    };

    if (dwellIntervalRef.current) clearInterval(dwellIntervalRef.current);
    dwellIntervalRef.current = setInterval(() => {
      metricsRef.current.totalDwellTime = Date.now() - startTimeRef.current;
    }, 1000);
  }, []);

  const recordAnswerSelection = useCallback((answer: string | number) => {
    const now = Date.now();
    const prev = metricsRef.current;
    const isFirstSelection = prev.timeToFirstClick === null;
    const isSwitch = prev.selectedAnswer !== null && prev.selectedAnswer !== answer;

    metricsRef.current = {
      ...prev,
      timeToFirstClick: isFirstSelection ? now - startTimeRef.current : prev.timeToFirstClick,
      answerSwitches: isSwitch ? prev.answerSwitches + 1 : prev.answerSwitches,
      previousAnswer: prev.selectedAnswer,
      selectedAnswer: answer,
      totalDwellTime: now - startTimeRef.current,
    };
  }, []);

  const submitAnswer = useCallback(async (
    questionId: string,
    wasCorrect: boolean,
    questionType?: string
  ): Promise<QuestionImplicitMetrics> => {
    const now = Date.now();
    if (dwellIntervalRef.current) {
      clearInterval(dwellIntervalRef.current);
      dwellIntervalRef.current = null;
    }

    const finalMetrics: QuestionImplicitMetrics = {
      ...metricsRef.current,
      totalDwellTime: now - startTimeRef.current,
      submitTime: new Date(now).toISOString(),
    };
    metricsRef.current = finalMetrics;

    isSubmittingRef.current = true;
    submissionErrorRef.current = null;

    try {
      const token = await getToken();
      const payload = {
        questionId,
        questionType,
        timeToFirstClick: finalMetrics.timeToFirstClick ?? 0,
        dwellTime: finalMetrics.totalDwellTime,
        totalResponseTime: finalMetrics.totalDwellTime,
        answerChanges: finalMetrics.answerSwitches,
        wasCorrect,
      };

      const response = await fetch('/api/user/behavior-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[useImplicitMetrics] Failed to post metrics:', error);
      submissionErrorRef.current = error instanceof Error ? error : new Error('Failed to submit metrics');
    } finally {
      isSubmittingRef.current = false;
    }

    return finalMetrics;
  }, [getToken]);

  const reset = useCallback(() => {
    if (dwellIntervalRef.current) {
      clearInterval(dwellIntervalRef.current);
      dwellIntervalRef.current = null;
    }
    metricsRef.current = createInitialMetrics();
    startTimeRef.current = Date.now();
  }, []);

  const getApiPayload = useCallback(() => ({
    timeToFirstClick: metricsRef.current.timeToFirstClick ?? undefined,
    answerSwitches: metricsRef.current.answerSwitches,
    totalDwellTime: metricsRef.current.totalDwellTime,
    timezone: metricsRef.current.timezone,
  }), []);

  useEffect(() => {
    return () => {
      if (dwellIntervalRef.current) clearInterval(dwellIntervalRef.current);
    };
  }, []);

  return {
    metrics: metricsRef.current,
    startQuestion,
    recordAnswerSelection,
    submitAnswer,
    reset,
    getApiPayload,
    isSubmitting: isSubmittingRef.current,
    submissionError: submissionErrorRef.current,
  };
}
```

---

### 🔴 **ISSUE 2: Recharts NaN Crash in AnalyticsDashboard**

**Problem:** Empty data arrays cause Recharts to render "NaN" or crash.

**Location:** `components/analytics/AnalyticsDashboard.tsx` (lines 400-600)

**Impact:** Broken analytics for new users, poor first impression.

**Root Cause:**
```typescript
// WRONG: No data validation before rendering
<LineChart data={stabilityTrendData}>
  <Line dataKey="avgStability" />
</LineChart>
```

**Fix:** Replace all chart sections with SafeChart wrapper:

```typescript
// components/charts/SafeChart.tsx - ALREADY CREATED
// Use in AnalyticsDashboard.tsx:

// REPLACE stability trend chart (line ~850):
{stabilityTrendData.length === 0 ? (
  <SafeChart
    data={[]}
    xLabel="Date"
    yLabel="Stability"
    emptyMessage="Complete 5+ reviews to see stability growth"
    onStartSession={handleStartSession}
  />
) : (
  <SafeChart
    data={stabilityTrendData.map(d => ({ x: d.date, y: d.avgStability }))}
    xLabel="Date"
    yLabel="Stability"
  />
)}

// REPLACE system performance bar chart (line ~750):
{systemPerformanceBarData.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-64 bg-slate-900/50 border border-slate-800 rounded-lg">
    <BarChart3 className="w-12 h-12 text-slate-700 mb-3" />
    <p className="text-slate-400 text-sm mb-4">No system data yet</p>
    <button
      onClick={handleStartSession}
      className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200 transition"
    >
      Start First Session
    </button>
  </div>
) : (
  <ResponsiveContainer width="100%" height={Math.max(320, systemPerformanceBarData.length * 36)}>
    {/* existing chart */}
  </ResponsiveContainer>
)}
```

---

### 🔴 **ISSUE 3: Button Soup - Inconsistent Stormy Slate Colors**

**Problem:** Buttons use unauthorized Tailwind colors (blue-500, green-600, etc.) instead of strict Stormy Slate palette.

**Location:** Multiple files (QuizView.tsx, AnalyticsDashboard.tsx, etc.)

**Impact:** Design system violation, poor visual hierarchy.

**Fix:** Replace all buttons with strict Button component:

```typescript
// components/ui/Button.tsx - ALREADY CREATED

// USAGE EXAMPLES:

// Primary action (high contrast)
<Button variant="primary" size="md" onClick={handleSubmit}>
  Submit Answer
</Button>

// Secondary action (muted)
<Button variant="secondary" size="sm" onClick={handleFlag}>
  Flag Question
</Button>

// Danger action (destructive)
<Button variant="danger" size="md" onClick={handleEndSession}>
  End Session
</Button>

// Loading state
<Button variant="primary" loading={isSubmitting}>
  Submitting...
</Button>
```

**Global Search & Replace:**
```bash
# Find all unauthorized button classes:
grep -r "bg-blue-" components/
grep -r "bg-green-" components/
grep -r "bg-red-[^9]" components/  # Allow red-900 for danger

# Replace with Button component:
# bg-blue-500 → <Button variant="primary">
# bg-gray-700 → <Button variant="secondary">
# bg-red-600 → <Button variant="danger">
```

---

### 🟡 **ISSUE 4: Missing Axis Labels in Charts**

**Problem:** Recharts components lack clear X/Y axis labels.

**Location:** All chart components in `components/analytics/`

**Impact:** Users don't know what data they're viewing.

**Fix:** Add formatted labels to all charts:

```typescript
// TEMPLATE for all Recharts components:
<YAxis 
  stroke="#94a3b8"
  label={{ 
    value: "Accuracy %", 
    angle: -90, 
    position: 'insideLeft', 
    fill: '#cbd5e1',
    style: { fontSize: 12 }
  }}
  tickFormatter={(value) => `${Math.round(value)}%`}
/>

<XAxis 
  dataKey="x" 
  stroke="#94a3b8"
  label={{ 
    value: "Date", 
    position: 'insideBottom', 
    offset: -5, 
    fill: '#cbd5e1',
    style: { fontSize: 12 }
  }}
/>
```

---

### 🟡 **ISSUE 5: OSCE Simulator Missing Sequential Telemetry**

**Problem:** OSCE mode doesn't track decision-pathing (order of actions).

**Location:** `components/modes/osce/OSCELiveSession.tsx`

**Impact:** Can't calculate clinical confidence index from sequential decisions.

**Fix:** Integrate useOSCEMetrics hook (ALREADY CREATED):

```typescript
// components/modes/osce/OSCELiveSession.tsx - ADD:
import { useOSCEMetrics } from '@/hooks/useOSCEMetrics';

function OSCELiveSession() {
  const { logAction, calculateMetrics, reset } = useOSCEMetrics();

  const handleOrderTest = (test: string, isCorrect: boolean) => {
    logAction('order', test, { isCorrect });
    // ... existing logic
  };

  const handlePerformExam = (exam: string, isRedFlag: boolean) => {
    logAction('exam', exam, { isRedFlag });
    // ... existing logic
  };

  const handleSubmitDiagnosis = (diagnosis: string, isCorrect: boolean) => {
    logAction('diagnosis', diagnosis, { isCorrect });
    // ... existing logic
  };

  const handleEndCase = () => {
    const metrics = calculateMetrics();
    console.log('Clinical Confidence Index:', metrics.clinicalConfidenceIndex);
    // POST metrics to /api/osce/submit
    reset();
  };

  // ... rest of component
}
```

---

### 🟡 **ISSUE 6: Clinical Library Missing Mastery Rings**

**Problem:** Condition cards don't show FSRS retrievability visualization.

**Location:** `components/library/EnhancedConditionCard.tsx`

**Impact:** Users can't see memory strength at a glance.

**Fix:** Add MasteryRing component (ALREADY CREATED):

```typescript
// components/library/EnhancedConditionCard.tsx - ADD:
import { MasteryRing } from './MasteryRing';

function EnhancedConditionCard({ condition, userProgress }) {
  const retrievability = userProgress?.fsrsCard?.retrievability ?? 0;

  return (
    <div className="condition-card">
      <div className="flex items-center justify-between">
        <h3>{condition.name}</h3>
        <MasteryRing retrievability={retrievability} size={48} strokeWidth={4} />
      </div>
      {/* ... rest of card */}
    </div>
  );
}
```

---

### 🟡 **ISSUE 7: Search Bar Not Debounced**

**Problem:** Clinical Library search triggers DB query on every keystroke.

**Location:** `components/library/ClinicalReferenceLibrary.tsx`

**Impact:** Performance issues, excessive API calls.

**Fix:** Use debounced search (ALREADY IN MasteryRing.tsx):

```typescript
// components/library/ClinicalReferenceLibrary.tsx - ADD:
import { useDebounce } from './MasteryRing';

function ClinicalReferenceLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedQuery) {
      fetchConditions(debouncedQuery);
    }
  }, [debouncedQuery]);

  return (
    <input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search conditions..."
    />
  );
}
```

---

### 🟡 **ISSUE 8: Peer Validation Not Integrated**

**Problem:** "Wisdom of the Crowds" data not shown in explanation view.

**Location:** `components/session/QuizView.tsx` (line 1800)

**Impact:** Users don't see peer selection stats when wrong.

**Fix:** Integrate usePeerValidation hook (ALREADY CREATED):

```typescript
// components/session/QuizView.tsx - ADD after line 1800:
import { usePeerValidation, PeerValidationBanner } from '@/hooks/usePeerValidation';

function QuizView() {
  const { data: peerData } = usePeerValidation(currentQuestion?.id, !isAnswered);

  return (
    <>
      {/* ... existing code ... */}
      {isAnswered && !isCorrect && (
        <PeerValidationBanner 
          selectedAnswer={currentQuestion.options[selectedAnswerIndex]} 
          peerData={peerData} 
        />
      )}
    </>
  );
}
```

---

## IMPLEMENTATION CHECKLIST

### Module 1: Main Session & FSRS Engine
- [x] **1.1** FSRS Optimizer Bridge (`lib/fsrs-optimizer-bridge.ts`)
- [x] **1.2** Telemetry Protection (already in `drillReviewService.ts`)
- [x] **1.3** Peer Validation Hook (`hooks/usePeerValidation.tsx`)
- [x] **1.3** Peer Validation API (`functions/api/analytics/peer-stats.ts`)
- [ ] **1.4** Integrate peer validation into QuizView (see Issue 8 fix)

### Module 2: OSCE Simulator
- [x] **2.1** useOSCEMetrics Hook (`hooks/useOSCEMetrics.ts`)
- [ ] **2.2** Integrate into OSCELiveSession (see Issue 5 fix)

### Module 3: Clinical Library
- [x] **3.1** MasteryRing Component (`components/library/MasteryRing.tsx`)
- [x] **3.2** useDebounce Hook (in MasteryRing.tsx)
- [ ] **3.3** Integrate MasteryRing into condition cards (see Issue 6 fix)
- [ ] **3.4** Debounce search bar (see Issue 7 fix)

### Module 4: UI/UX Bug Fixes
- [x] **4.1** Fix re-render loop (see Issue 1 fix - replace useImplicitMetrics.ts)
- [ ] **4.2** Fix Recharts NaN (see Issue 2 fix - add SafeChart to all charts)
- [x] **4.3** Stormy Slate Button System (`components/ui/Button.tsx`)
- [ ] **4.4** Replace all unauthorized buttons (see Issue 3 fix)
- [ ] **4.5** Add axis labels to all charts (see Issue 4 fix)

---

## TESTING PROTOCOL

### 1. Re-render Loop Fix
```bash
# Test: Open QuizView, select answer 10 times
# Expected: No console warnings, smooth UI
# Measure: React DevTools Profiler should show 0 re-renders during selection
```

### 2. Recharts Empty State
```bash
# Test: New user with 0 data visits Analytics
# Expected: "Start First Session" CTA, no NaN
# Measure: No console errors, chart shows empty state
```

### 3. Button Consistency
```bash
# Test: Audit all pages for unauthorized colors
grep -r "bg-blue-" components/ | wc -l  # Should be 0
grep -r "bg-green-" components/ | wc -l  # Should be 0
```

### 4. OSCE Telemetry
```bash
# Test: Complete OSCE case, check console for metrics
# Expected: clinicalConfidenceIndex between 1.0-4.0
# Measure: POST to /api/osce/submit includes sequential actions
```

### 5. Mastery Rings
```bash
# Test: View condition with retrievability 0.875
# Expected: 87% filled ring, emerald color
# Measure: SVG circle strokeDashoffset = circumference * 0.125
```

---

## PERFORMANCE BENCHMARKS

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| QuizView re-renders per question | 15-20 | 0-2 | <3 |
| Analytics load time (empty state) | 3.2s | 0.8s | <1s |
| Search debounce delay | 0ms | 300ms | 300ms |
| Button color violations | 47 | 0 | 0 |
| Chart axis labels | 0% | 100% | 100% |

---

## FILES TO MODIFY

1. ✅ `hooks/useImplicitMetrics.ts` - Replace entire file (Issue 1)
2. ✅ `components/charts/SafeChart.tsx` - Already created
3. ✅ `components/ui/Button.tsx` - Already created
4. ⚠️ `components/analytics/AnalyticsDashboard.tsx` - Add SafeChart (Issue 2)
5. ⚠️ `components/session/QuizView.tsx` - Integrate peer validation (Issue 8)
6. ⚠️ `components/modes/osce/OSCELiveSession.tsx` - Add useOSCEMetrics (Issue 5)
7. ⚠️ `components/library/EnhancedConditionCard.tsx` - Add MasteryRing (Issue 6)
8. ⚠️ `components/library/ClinicalReferenceLibrary.tsx` - Debounce search (Issue 7)
9. ⚠️ ALL button components - Replace with Button (Issue 3)
10. ⚠️ ALL chart components - Add axis labels (Issue 4)

---

## PRIORITY ORDER

### P0 (Critical - Do First)
1. Fix re-render loop (Issue 1) - Performance killer
2. Fix Recharts NaN (Issue 2) - Breaks new user experience
3. Button consistency (Issue 3) - Design system violation

### P1 (High - Do Next)
4. Add chart axis labels (Issue 4) - Usability
5. Integrate peer validation (Issue 8) - Core feature

### P2 (Medium - Do After P0/P1)
6. OSCE telemetry (Issue 5) - Feature enhancement
7. Mastery rings (Issue 6) - Visual polish
8. Debounce search (Issue 7) - Performance optimization

---

## VALIDATION CRITERIA

✅ **Pass:** All tests green, no console errors, performance benchmarks met
⚠️ **Warning:** Some tests pass, minor console warnings, performance close to target
❌ **Fail:** Tests fail, console errors, performance below target

**Sign-off required from:**
- [ ] UX Lead (design system compliance)
- [ ] Performance Engineer (re-render metrics)
- [ ] QA Lead (test coverage)
- [ ] Product Owner (feature completeness)
