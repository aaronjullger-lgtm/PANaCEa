# PANaCEa Master Sprint Plan

**Created:** 2026-04-02
**Author:** Aaron + Claude
**Scope:** UI fixes, dashboard overhaul, personalization, PA domain intelligence, question taxonomy, OSCE realism, clinical data integration, account lifecycle

---

## Audit Summary

### What Exists (Strong Foundation)
- FSRS v6 with implicit behavioral rating (no self-rated buttons) ✅
- NCCPA 2025 blueprint weighting (15 systems, correct percentages) ✅
- Circadian-aware scheduling with par time modifiers ✅
- OSCE patient simulator with personality matrix (8 styles), rapport meter, drug effects ✅
- Lab reference API with sex/age-specific ranges, critical thresholds ✅
- Preferences system (20+ settings, synced to DB) ✅
- Cascade deletes on 30+ user-related models ✅
- Question generation with Gemini structured output + validation ✅

### What's Missing (Gaps to Fill)
1. **No question order taxonomy** — Questions have continuous difficulty (0-1) but no 1st/2nd/3rd order tagging
2. **No progression-aware scheduling** — FSRS doesn't adapt to didactic vs clinical year
3. **Dashboard is analytics-heavy** — No actionable todo list, no "what to study next" guidance
4. **Notifications are ignorable** — Modal-based achievements, no contextual study nudges
5. **No account deletion endpoint** — Cascade exists at DB level but no user-facing delete flow
6. **OSCE lacks curriculum alignment** — No rotation-specific cases, no structured reasoning scaffold
7. **No PA domain knowledge layer** — Platform doesn't know about rotations, licensure, PACKRAT, EOC
8. **Clinical data (imaging, auscultation) not integrated** — Labs exist but imaging/sounds are missing
9. **UI alignment issues** — User reports "off centered thing" (needs visual audit)

---

## Sprint Structure

Each sprint is ~3-4 days of implementation. Sprints are ordered by user impact and dependency chain.

---

## Sprint 1: Dashboard Overhaul & Notification Fix
**Goal:** Make the dashboard actionable, not just informational. Fix notifications so they're useful, not annoying.

### 1A. Dashboard "What To Do" Section
**Problem:** Dashboard shows analytics but doesn't tell the student *what to study right now*.
**Solution:** Replace the pilot/data toggle with a single unified view:

**Files to modify:**
- `components/dashboard/DashboardPage.tsx` — New layout with priority action cards
- `components/dashboard/StudyActionCard.tsx` — NEW: "Start studying" card with context
- `components/dashboard/DailyPlanWidget.tsx` — NEW: Today's plan based on FSRS due items + blueprint gaps

**Action Cards (priority order):**
1. **Overdue Reviews** (red) — "You have 23 cards overdue. Start review →"
2. **Due Today** (amber) — "14 cards due today. 8 CV, 4 Pulm, 2 GI"
3. **Blueprint Gap** (blue) — "You're 15% behind on Pulm. Quick drill →"
4. **Streak Keeper** (green) — "Day 12! Complete 10 more cards to keep it"
5. **Rotation Focus** (purple) — "IM Rotation Week 3: Focus on CV + GI"

**Layout change:**
```
┌─────────────────────────────────────────┐
│ Welcome back, Aaron          Day 12 🔥  │
├───────────────┬─────────────────────────┤
│ Study Actions │ Quick Stats (3 cards)   │
│ (priority     │ Due / Learned / Streak  │
│  action list) │                         │
├───────────────┴─────────────────────────┤
│ Blueprint Progress (horizontal bar per system) │
├─────────────────────────────────────────┤
│ Analytics (collapsible, not default)    │
└─────────────────────────────────────────┘
```

### 1B. Notification Rework
**Problem:** Notifications are achievement modals that get ignored. No study-relevant nudges.
**Solution:** Replace modal-based notifications with a contextual toast system.

**Changes:**
- Keep `sonner` toast library but add study-context toasts:
  - "You've been studying for 90 min — take a 10 min break"
  - "Great session! You reviewed 24 cards with 87% accuracy"
  - "Your CV retention is dropping — quick 5-min drill?"
- Remove modal overlay for achievements → inline toast with confetti
- Add `useStudyNudges` hook that triggers context-sensitive suggestions
- Respect a new preference: `notificationLevel: 'all' | 'important' | 'minimal' | 'off'`

**Files:**
- `hooks/useStudyNudges.ts` — NEW: Context-aware notification logic
- `components/shared/AchievementNotification.tsx` — Refactor from modal → toast
- `hooks/usePreferences.ts` — Add notificationLevel preference

### 1C. UI Bug Audit
**Action:** Visual audit of dashboard and key pages for alignment issues.
- Check DashboardPage grid alignment at all breakpoints
- Verify NavRail icon centering
- Audit DrillHub card grid spacing
- Fix any "off centered" elements found

---

## Sprint 2: Question Order Taxonomy & Progression
**Goal:** Tag questions with clinical reasoning order (1st/2nd/3rd) and adapt question selection to student's school phase.

### 2A. Question Order Schema
**Add to question schema and DB:**

```typescript
// New enum for question order
type QuestionOrder = 'first' | 'second' | 'third';

// Map to Bloom's taxonomy for PA education:
// first  = Remember/Understand (recall a fact)
// second = Apply/Analyze (diagnose then treat — one intermediate step)
// third  = Evaluate/Create (multi-step vignette with confounders)
```

**Files:**
- `functions/api/_shared/question-schema.ts` — Add `questionOrder` field (enum)
- `functions/api/_shared/question-validator.ts` — Validate order matches difficulty range
- `functions/api/_shared/question-generator.ts` — Update prompt to explicitly request order
- `prisma/schema.prisma` — Add `questionOrder` to PreGeneratedQuestion

**Order-difficulty alignment:**
| Order | Difficulty Range | Bloom Level | PANCE Weight |
|-------|-----------------|-------------|--------------|
| 1st   | 0.2–0.4        | Remember    | ~10%         |
| 2nd   | 0.4–0.6        | Apply       | ~35%         |
| 3rd   | 0.6–0.9        | Evaluate    | ~55%         |

### 2B. Progression-Aware Selection
**Problem:** A PA-S1 in didactic year needs different questions than a PA-S2 on IM rotation.

**Add to User profile:**
```typescript
interface LearnerContext {
  phase: 'didactic' | 'clinical' | 'pance_prep';
  yearInProgram: 1 | 2 | 3;
  currentRotation?: string;  // already exists
  rotationWeek?: number;
  examDate?: Date;           // already exists
  eorTestDate?: Date;        // already exists
}
```

**Selection rules by phase:**
- **Didactic:** 30% first-order, 50% second-order, 20% third-order (building foundation)
- **Clinical:** 15% first-order, 40% second-order, 45% third-order (applying knowledge)
- **PANCE prep:** 10% first-order, 35% second-order, 55% third-order (match exam distribution)

**Files:**
- `lib/services/session/sessionService.ts` — Add phase-aware order distribution
- `lib/nccpa-question-weighting.ts` — Add order distribution constants
- `hooks/usePreferences.ts` — Surface phase in user context

### 2C. Task Category Tagging
**Add PANCE task categories to questions:**
```typescript
type TaskCategory = 'history_pe' | 'diagnostics' | 'management' | 'education' | 'professional';
```

Enable filtering: "Show me all CV diagnostics questions" or "All management questions."

**Files:**
- `functions/api/_shared/question-schema.ts` — Add `taskCategory` field
- `functions/api/_shared/question-generator.ts` — Prompt Gemini to tag task category
- Question filtering in session service

---

## Sprint 3: PA Domain Knowledge Layer
**Goal:** Make the platform *know* PA school the way a classmate would.

### 3A. Curriculum Knowledge Base
**Create a structured data file** with PA education domain knowledge:

```typescript
// lib/constants/pa-curriculum.ts
export const PA_CURRICULUM = {
  didacticCourses: [
    { name: 'Clinical Anatomy', systems: ['MSK', 'NEURO', 'CV'], semester: 1 },
    { name: 'Pharmacology', systems: ['ALL'], semester: 1 },
    { name: 'Clinical Medicine I', systems: ['CV', 'PULM', 'GI'], semester: 2 },
    // ... standard PA curriculum mapping
  ],
  clinicalRotations: [
    { name: 'Internal Medicine', weeks: 6, systems: ['CV', 'PULM', 'GI', 'ENDO', 'RENAL'], required: true },
    { name: 'Family Medicine', weeks: 6, systems: ['ALL'], required: true },
    { name: 'Emergency Medicine', weeks: 4, systems: ['CV', 'PULM', 'NEURO', 'EMERGENCY'], required: true },
    { name: 'Surgery', weeks: 6, systems: ['GI', 'MSK', 'CV'], required: true },
    { name: 'Pediatrics', weeks: 4, systems: ['ID', 'PULM', 'GI', 'DERM'], required: true },
    { name: 'Behavioral Health', weeks: 4, systems: ['PSYCH'], required: true },
    { name: "Women's Health", weeks: 4, systems: ['REPRO'], required: true },
    // Electives: Ortho, Derm, Cardiology, etc.
  ],
  milestones: {
    packrat: { description: 'PAEA PACKRAT (practice exam)', timing: 'End of didactic year' },
    eoc: { description: 'End of Curriculum exam', timing: 'Final 4 months of program' },
    osce: { description: 'Clinical skills assessment', timing: 'Before graduation, per ARC-PA' },
    pance: { description: 'National certification exam', timing: 'After graduation' },
  },
  licensure: {
    steps: [
      'Graduate from ARC-PA accredited program',
      'Pass PANCE (300+ out of 800 scaled score)',
      'Apply for state license',
      'Maintain via PANRE (every 10 years) + CME (100 hours/2 years)',
    ],
  },
};
```

### 3B. Rotation-Aware Study Intelligence
**When a student sets their current rotation, the platform adapts:**
- Dashboard highlights rotation-relevant systems
- FSRS prioritizes rotation-aligned content
- "Rotation Focus" drill mode auto-generates system-weighted sessions
- EOR countdown with preparation milestones

**Files:**
- `lib/constants/pa-curriculum.ts` — NEW: Curriculum data
- `lib/services/session/sessionService.ts` — Rotation-aware question selection
- `components/dashboard/RotationFocusCard.tsx` — NEW: Rotation context on dashboard

### 3C. Burnout Detection & Wellness
**Track study patterns and intervene:**
- Consecutive days studied (reward streaks but detect overwork)
- Session length trends (getting shorter = fatigue)
- Accuracy decline over time-of-day (circadian already tracked)
- Break suggestions after 90 min continuous study

**Files:**
- `hooks/useStudyWellness.ts` — NEW: Pattern detection
- `components/dashboard/WellnessWidget.tsx` — NEW: "Take a break" / "You're doing great"

---

## Sprint 4: OSCE Realism & Personality Adaptation
**Goal:** Make OSCE feel like a real clinical encounter, not a chatbot.

### 4A. Personality-Adaptive Encounters
**Current state:** 8 personality types exist but selection is random.
**Upgrade:** Personality adapts based on:
- Student's weak areas (anxious patient if student struggles with psych)
- Rotation alignment (surgical patient personality for surgery rotation)
- Progressive difficulty (start with cooperative → progress to evasive/angry)

**Files:**
- `hooks/useEnhancedOSCE.ts` — Adaptive personality selection
- `types/osce-enhanced.ts` — Add progression tracking

### 4B. Structured Reasoning Scaffold
**Add a "Clinical Reasoning Ladder" to OSCE:**
1. Read case → What history questions would you ask? (H&P)
2. See responses → What physical exam maneuvers? (PE)
3. See findings → What diagnostics to order? (Dx)
4. See results → What's your differential? (DDx)
5. Select diagnosis → What's your management plan? (Tx)

Each step scored independently. Gemini evaluates reasoning quality, not just correct/incorrect.

### 4C. Rotation-Specific Cases
**Map OSCE cases to rotation content:**
- IM rotation → ACS, CHF, COPD, DKA cases
- Surgery → Appendicitis, cholecystitis, bowel obstruction
- Peds → Asthma exacerbation, otitis media, febrile seizure
- Emergency → Trauma, PE, stroke, anaphylaxis

---

## Sprint 5: Clinical Data Integration
**Goal:** Integrate vitals, imaging, auscultation, and lab values throughout the platform.

### 5A. Imaging Reference Library
**Add imaging interpretation to the knowledge base:**
- X-ray patterns (CXR: pneumonia, pneumothorax, CHF, PE)
- CT findings (head CT: stroke, bleed; abdominal CT: appendicitis)
- ECG interpretation (AF, STEMI, heart blocks, axis deviation)

**Implementation:**
- Database: `ImagingReference` table (imageUrl, modality, findings, diagnosis, system)
- UI: `components/library/ImagingReferenceView.tsx`
- Drill: Image-based questions ("What does this CXR show?")

### 5B. Auscultation Audio Library
**Heart and lung sounds for clinical training:**
- Heart: S3, S4, murmurs (AS, MR, MVP), friction rub
- Lung: Crackles, wheezes, stridor, pleural rub, bronchial sounds
- Bowel: Hyperactive, hypoactive, absent

**Implementation:**
- Audio files hosted on R2/CDN
- `components/library/AuscultationView.tsx` — Audio player with waveform
- Drill integration: "Listen to this heart sound. What's the diagnosis?"

### 5C. Vitals Interpretation Drill
**Expand vitals beyond OSCE into standalone drills:**
- Given a set of vitals, identify the clinical scenario
- Vital trend interpretation (worsening vs improving)
- Pediatric vital ranges vs adult

---

## Sprint 6: Personalization & Account Lifecycle
**Goal:** Deep personalization based on learner profile. Clean account management.

### 6A. Adaptive Study Paths
**Based on learner phase, generate personalized study plans:**
- Didactic: System-by-system with spaced repetition emphasis
- Clinical: Rotation-aligned with rapid recall focus
- PANCE prep: Full blueprint coverage with weak-area targeting

### 6B. Account Deletion Flow
**Implement user-facing account deletion:**
- Settings → Account → Delete Account
- Confirmation modal with data summary ("This will delete X cards, Y sessions...")
- API endpoint: `functions/api/user/delete.ts`
- Clerk webhook to trigger cascade on external auth deletion
- 30-day grace period (soft delete → hard delete)

### 6C. Data Export
**Before deletion, let users export their data:**
- Study history (CSV)
- Performance analytics (PDF report)
- Saved questions and notes

---

## Sprint 7: Polish & Launch Readiness
**Goal:** Final UI pass, performance optimization, and content generation.

### 7A. Content Generation Sprint
- Generate 500+ questions for under-represented systems (CV, PULM target)
- Tag all existing questions with order (1st/2nd/3rd) and task category
- Create 20+ OSCE cases covering required rotations

### 7B. Performance Audit
- Lighthouse scores for key pages
- Edge function cold start optimization
- Database query performance review

### 7C. User Testing
- Recruit 3-5 PA students for beta testing
- Collect feedback on dashboard, drills, OSCE
- Iterate based on findings

---

## Priority Matrix

| Sprint | Impact | Effort | Dependencies |
|--------|--------|--------|-------------|
| 1: Dashboard + Notifications | 🔴 High | 🟡 Medium | None |
| 2: Question Taxonomy | 🔴 High | 🟡 Medium | None |
| 3: PA Domain Knowledge | 🔴 High | 🟢 Low | Sprint 2 |
| 4: OSCE Realism | 🟡 Medium | 🔴 High | Sprint 3 |
| 5: Clinical Data | 🟡 Medium | 🔴 High | Sprint 2 |
| 6: Personalization + Account | 🟡 Medium | 🟡 Medium | Sprint 3 |
| 7: Polish + Content | 🔴 High | 🟡 Medium | All above |

---

## Implementation Notes

### Prompt Engineering (per Claude docs)
When generating questions or OSCE content via Gemini:
1. **Few-shot with thinking tags** — Already implemented. Expand examples per order level.
2. **Structured output schema** — Already using `responseMimeType: 'application/json'`. Extend schema for new fields.
3. **Chain-of-thought prompting** — OSCE grading prompts should require step-by-step clinical reasoning.
4. **Negative examples** — Add "bad question" examples to the prompt to show what NOT to generate.
5. **Temperature tuning** — 0.7 for question generation (variety), 0.2 for grading (consistency).

### Testing Strategy
- Unit tests for all new utility functions (curriculum data, order selection, burnout detection)
- Integration tests for session service with order distribution
- E2E tests for dashboard action cards
- OSCE case validation against NCCPA blueprint

### Metrics to Track
- Dashboard engagement (click-through on action cards)
- Notification dismissal rate (are nudges useful?)
- Question order distribution per session
- OSCE completion rate and score trends
- Student retention (daily active users)
