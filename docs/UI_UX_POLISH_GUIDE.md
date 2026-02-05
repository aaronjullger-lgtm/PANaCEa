# PANaCEa: UI/UX Polish & Seamless Integration Guide

**Version:** 1.0.0  
**Date:** February 5, 2026  
**Status:** ✅ Complete Polish Specification

---

## Overview

This document defines the **UI/UX polish layer** that connects all 5 modules into a seamless, cohesive experience. Every transition, animation, and interaction is designed to feel natural and intelligent.

---

## Table of Contents

1. [Unified Navigation System](#unified-navigation-system)
2. [Cross-Module Transitions](#cross-module-transitions)
3. [Persistent Context Layer](#persistent-context-layer)
4. [Smart Sidebar System](#smart-sidebar-system)
5. [Notification & Alert System](#notification-alert-system)
6. [Loading & Progress States](#loading-progress-states)
7. [Accessibility & Polish](#accessibility-polish)

---

## Unified Navigation System

### Global Navigation Bar

```
┌─────────────────────────────────────────────────────────────────┐
│  🏥 PANaCEa                          [Avatar]  [Streak: 10]  [≡] │
│  ──────────────────────────────────────────────────────────────  │
│  📚 Dashboard  │  🎤 OSCE  │  👁️ Clinical Eye  │  🔬 Sim Lab   │
│  ↑ Current                                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- **Active module highlighted** with underline + accent color
- **Progress indicators** show completion state per module
- **Quick switch** between modules with preserved context
- **Keyboard shortcuts**: Cmd+1 (Dashboard), Cmd+2 (OSCE), etc.

### Contextual Breadcrumbs

```
Dashboard > Cardiology > OSCE > Case #47 (STEMI) > Interview
                                                      ↑ Current step
```

**Features:**
- **Clickable path** to return to any previous step
- **Auto-updates** as you progress
- **Shows context** (system, case, phase)

### Module Status Cards (Dashboard)

```
┌──────────────────────────────────────────────────────────────┐
│  📚 TODAY'S LEARNING PATH                                    │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ 1. OSCE    │→ │ 2. Imaging │→ │ 3. Procedure│           │
│  │            │  │            │  │            │            │
│  │ ✅ Complete│  │ ⏳ Current │  │ 🔒 Locked  │            │
│  │ Score: 85  │  │ 2/5 done   │  │ Req: Pass 2│            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                               │
│  💡 Recommended Next: "Confirm STEMI diagnosis with ECG"     │
└──────────────────────────────────────────────────────────────┘
```

---

## Cross-Module Transitions

### Transition Animations

#### 1. Medical Scan Transition (OSCE → Imaging)

```css
/* Red scanning line effect (like CT scanner) */
@keyframes medicalScan {
  0% {
    clip-path: inset(0 0 100% 0);
    filter: hue-rotate(0deg);
  }
  50% {
    clip-path: inset(0 0 0 0);
    filter: hue-rotate(20deg);
  }
  100% {
    clip-path: inset(0 0 0 0);
    filter: hue-rotate(0deg);
  }
}

.medical-scan-transition {
  animation: medicalScan 0.8s ease-in-out;
}
```

**Use Case**: After ordering ECG in OSCE → Transition to Clinical Eye with scanning effect

#### 2. Zoom Transition (Imaging → Procedure)

```typescript
// Zoom into the finding, then expand to procedure view
const transition = gsap.timeline();
transition
  .to(currentView, { scale: 2, duration: 0.3, ease: 'power2.in' })
  .to(currentView, { opacity: 0, duration: 0.2 })
  .set(nextView, { opacity: 0, scale: 0.5 })
  .to(nextView, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
```

**Use Case**: Identified pneumothorax → Zoom in → Transition to chest tube procedure

#### 3. Fade Transition (Procedure → Review)

```css
/* Gentle fade for cognitive transition */
.fade-transition {
  animation: fadeOut 0.5s ease-out, fadeIn 0.5s ease-in 0.5s;
}

@keyframes fadeOut {
  to { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Use Case**: Complete procedure → Fade to debrief screen

### Context Carry-Over Visual

```
┌──────────────────────────────────────────────────────────────┐
│  [Transitioning: OSCE → Clinical Eye]                        │
│                                                               │
│  📋 Carrying over:                                           │
│  ✅ Patient: John Smith, 55yo M                             │
│  ✅ Diagnosis: STEMI (working)                              │
│  ✅ Ordered tests: ECG, Troponin                            │
│                                                               │
│  [Progress bar: ████████░░ 80%]                             │
└──────────────────────────────────────────────────────────────┘
```

**Display**: 1-second overlay during transition showing preserved context

---

## Persistent Context Layer

### Context Banner (Always Visible)

```
┌─────────────────────────────────────────────────────────────────┐
│  👤 Patient: John Smith, 55yo M  │  🩺 CC: Chest pain  │  ⏱️ 8:45│
│  🩹 Vitals: HR 110, BP 140/90, O2 94%  │  📋 Working Dx: STEMI │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Stays at top** of screen across all modules
- **Auto-updates** when vitals/diagnosis changes
- **Color codes** vitals (red if critical, yellow if warning)
- **Clickable** to expand full details

### Floating Action Button (FAB)

```
                                    ┌─────────┐
                                    │    ?    │ ← AI Tutor
                                    └─────────┘
                                         ↑
                                    [Hover menu]
                                    ┌─────────┐
                                    │ 💬 Ask  │
                                    │ 💡 Hint │
                                    │ 📖 Cite │
                                    └─────────┘
```

**Behavior:**
- **Always accessible** in bottom-right corner
- **Context-aware**: Offers relevant actions for current module
- **Pulsates** when AI Tutor has a suggestion
- **Badge count** shows unread insights

---

## Smart Sidebar System

### Adaptive Sidebar Content

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN CONTENT (OSCE)              │  SMART SIDEBAR              │
│  ┌─────────────────────────────┐  │  ┌───────────────────────┐ │
│  │ [Patient video]              │  │  │ 🤖 AI TUTOR          │ │
│  │                              │  │  │ "You're doing great!"│ │
│  │ [Vitality meter]             │  │  │                      │ │
│  └─────────────────────────────┘  │  │ Related Concepts:    │ │
│                                   │  │ • Inferior MI        │ │
│  [Voice controls]                 │  │ • RV involvement     │ │
│                                   │  │                      │ │
│                                   │  │ [Ask Question]       │ │
│                                   │  └───────────────────────┘ │
│                                   │                            │
│                                   │  ┌───────────────────────┐ │
│                                   │  │ 📊 REAL-TIME ANALYTICS│ │
│                                   │  │ Questions: 8          │ │
│                                   │  │ Efficiency: 85%       │ │
│                                   │  │ Time: 6:45            │ │
│                                   │  └───────────────────────┘ │
│                                   │                            │
│                                   │  ┌───────────────────────┐ │
│                                   │  │ 📝 DRAFT SOAP NOTE   │ │
│                                   │  │ Subjective: 55yo M..  │ │
│                                   │  │ [Auto-updating]       │ │
│                                   │  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Smart Behavior:**
1. **OSCE Module**: AI Tutor + Real-time analytics + Draft SOAP
2. **Clinical Eye Module**: Finding hints + Normal comparisons
3. **Sim Lab Module**: Step checklist + Safety warnings
4. **Review Module**: Performance breakdown + Next steps

**Responsive:**
- **Desktop**: 320px fixed width
- **Tablet**: 280px, collapsible
- **Mobile**: Hidden by default, swipe from right to reveal

---

## Notification & Alert System

### Notification Stack

```
┌─────────────────────────────────────────────┐
│  🎉 Achievement Unlocked!                   │
│  "Code Blue Survivor" (Epic)                │
│  [View Badge]  [Dismiss]                    │
└─────────────────────────────────────────────┘
      ↓ (stacks below)
┌─────────────────────────────────────────────┐
│  ⚠️ Critical Vital Change                   │
│  O2 dropped to 86%                          │
│  [Review State]                             │
└─────────────────────────────────────────────┘
      ↓ (stacks below)
┌─────────────────────────────────────────────┐
│  💡 AI Tutor Insight Available              │
│  "Consider RV involvement"                  │
│  [View]  [Dismiss]                          │
└─────────────────────────────────────────────┘
```

**Types:**
- **Success** (Green): Achievements, correct answers, milestones
- **Warning** (Yellow): Sub-optimal actions, approaching limits
- **Error** (Red): Critical vitals, contamination, failures
- **Info** (Blue): Tips, insights, context updates

**Behavior:**
- **Auto-dismiss** after 5 seconds (except critical)
- **Click to expand** for more details
- **Sound + haptic** for critical alerts
- **Stack limit**: Max 3 visible (older ones collapse)

### Critical Alert Overlay

```
┌─────────────────────────────────────────────────────────────────┐
│                     [BACKGROUND DIMMED]                          │
│                                                                  │
│           ┌───────────────────────────────────────┐            │
│           │  🚨 CRITICAL VITAL CHANGE             │            │
│           │                                        │            │
│           │  Patient's O2 saturation: 86% (↓12%)  │            │
│           │  Heart rate: 125 bpm (↑15)            │            │
│           │  Blood pressure: 90/60 mmHg (↓50/30)  │            │
│           │                                        │            │
│           │  ⚠️ Possible cardiogenic shock        │            │
│           │                                        │            │
│           │  Recommended Actions:                  │            │
│           │  • Assess perfusion                    │            │
│           │  • Consider pressors                   │            │
│           │  • Urgent cardiology consult           │            │
│           │                                        │            │
│           │  [Acknowledge] [Call Consult]         │            │
│           └───────────────────────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Triggers:**
- Critical vital changes (O2 < 88%, HR > 150, BP < 90 systolic)
- Patient decompensation (state machine transition to critical)
- Procedural errors (sterile field breach, geometry violation)

**Design:**
- **Modal overlay** with 0.5 opacity dark background
- **Pulsating border** (red glow)
- **Haptic alarm pattern**
- **Requires acknowledgment** before continuing

---

## Loading & Progress States

### Intelligent Loading States

```
┌──────────────────────────────────────────────────────────────┐
│  🎬 Generating Patient Video...                              │
│  [████████████░░░░░░░░] 65%                                  │
│                                                               │
│  💡 While you wait:                                          │
│  Did you know? Levine sign has 85% specificity for ACS.     │
│                                                               │
│  [Estimated: 8 seconds remaining]                            │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- **Show educational content** during waits
- **Accurate progress bars** (not fake spinners)
- **Time estimates** (from API responses)
- **Cancel option** when appropriate

### Module-Specific Loading

| Module | Loading State | Duration | Enhancement |
|--------|---------------|----------|-------------|
| **Module 1** | Generating patient video | 5-15s | Show chief complaint preview |
| **Module 2** | Analyzing image... | 2-5s | Show modality information |
| **Module 3** | Loading procedure... | 3-8s | Show indication/contraindication |
| **Module 4** | Generating SOAP note... | 2-5s | Show progress by section |
| **Module 5** | Updating avatar... | 1-2s | Show XP gained animation |

### Progressive Disclosure

```
[Initial State]
┌──────────────────────────────────────────────┐
│  📊 Session Summary                          │
│  Overall: 88/100 ✅                         │
│  [Show Details ▼]                            │
└──────────────────────────────────────────────┘

[Expanded State]
┌──────────────────────────────────────────────┐
│  📊 Session Summary                          │
│  Overall: 88/100 ✅                         │
│                                              │
│  History: 85/100                             │
│  Physical Exam: 78/100                       │
│  Diagnosis: 95/100                           │
│  Management: 82/100                          │
│                                              │
│  [Hide Details ▲]                            │
└──────────────────────────────────────────────┘
```

**Pattern**: Start collapsed, expand on demand to reduce cognitive load

---

## Persistent Context Layer

### Context Preservation Across Modules

**Scenario**: Student starts OSCE with chest pain → Orders ECG → Needs procedure

```typescript
// Context flows seamlessly
const context = {
  patient: {
    name: 'John Smith',
    age: 55,
    sex: 'M',
    chiefComplaint: 'Chest pain'
  },
  clinical: {
    vitals: { hr: 110, bp: '140/90', o2: 94 },
    findings: ['Levine sign', 'Diaphoresis'],
    workingDiagnosis: 'STEMI'
  },
  actions: [
    { action: 'order_ecg', timestamp: '08:10:45' },
    { action: 'order_troponin', timestamp: '08:11:20' }
  ]
};

// Module 1 (OSCE) → Module 2 (Clinical Eye)
// Context carries: patient, clinical, actions
// Clinical Eye displays: "Review ECG for John Smith, 55yo M with chest pain"

// Module 2 (Clinical Eye) → Module 3 (Sim Lab)
// Context carries: patient, clinical, diagnosis confirmed
// Sim Lab displays: "Emergency procedure for John Smith: Tension PTX"
```

### Context Banner Across All Modules

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT CASE: John Smith, 55yo M                               │
│  Chief Complaint: Chest pain                                    │
│  Working Dx: Inferior STEMI                                     │
│  Status: In Progress [6:45 elapsed]                             │
│  [Full Details ⓘ]                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Always visible at top**, updates in real-time

---

## Smart Sidebar System

### AI Tutor Sidebar (Context-Aware)

**In OSCE Module:**

```
┌───────────────────────────────────┐
│  🤖 AI TUTOR                      │
│  ─────────────────────────────────│
│  Current Topic: Inferior MI       │
│                                   │
│  💡 Real-time Insights:           │
│  "Patient's vitals suggest RV     │
│   involvement. Consider JVD       │
│   assessment."                    │
│                                   │
│  📖 Relevant Citation:            │
│  Harrison's Ch. 296, p. 2053      │
│  "RV infarction complicates 30-50%│
│   of inferior MIs"                │
│                                   │
│  [Ask Question]                   │
│  [Request Hint]                   │
└───────────────────────────────────┘
```

**In Clinical Eye Module:**

```
┌───────────────────────────────────┐
│  🤖 AI TUTOR                      │
│  ─────────────────────────────────│
│  Analyzing: Chest X-Ray           │
│                                   │
│  💡 What to look for:             │
│  • Lung field symmetry            │
│  • Pleural lines                  │
│  • Mediastinal position           │
│  • Costophrenic angles            │
│                                   │
│  🔍 Heatmap Available             │
│  [Reveal] (-20 points)            │
│                                   │
│  📖 Reference:                    │
│  "Chest X-Ray interpretation      │
│   systematic approach"            │
│                                   │
│  [Ask About This Image]           │
└───────────────────────────────────┘
```

**Sidebar Intelligence:**
- **Context updates** based on current module/activity
- **Proactive suggestions** when student struggles (>30s no action)
- **Citation preview** relevant to current content
- **Quick actions** specific to module

### Analytics Sidebar (Progress Tracking)

```
┌───────────────────────────────────┐
│  📊 LIVE ANALYTICS                │
│  ─────────────────────────────────│
│  ⏱️ Time Elapsed: 6:45            │
│                                   │
│  Questions Asked: 8               │
│  ├─ Essential: 6 ✅              │
│  ├─ Helpful: 2 ✅                │
│  └─ Unnecessary: 0 ✅            │
│                                   │
│  Efficiency: 85% ⚡               │
│  [View Echo Path]                 │
│                                   │
│  Critical Actions:                │
│  ✅ ECG ordered (45s)             │
│  ✅ Aspirin given (90s)           │
│  ⏳ Heparin pending               │
│                                   │
│  Next Milestone:                  │
│  Cath lab activation              │
└───────────────────────────────────┘
```

**Updates**: Real-time, no page refresh

---

## Notification & Alert System

### Layered Notifications

**Level 1: Subtle Toast (Bottom-Right)**

```
┌─────────────────────────────┐
│  ✅ SOAP note updated        │
│  [View Draft]                │
└─────────────────────────────┘
```

**Level 2: Banner Alert (Top)**

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ You asked about diet - this may not be high-yield for acute │
│     chest pain. Consider focusing on OPQRST. [Learn More]       │
└─────────────────────────────────────────────────────────────────┘
```

**Level 3: Modal Alert (Center)**

```
┌─────────────────────────────────────────────────────────────────┐
│                     [BACKGROUND DIMMED]                          │
│                                                                  │
│           ┌───────────────────────────────────────┐            │
│           │  🎖️ ACHIEVEMENT UNLOCKED!            │            │
│           │                                        │            │
│           │  [Epic Badge SVG]                      │            │
│           │                                        │            │
│           │  "The Code Blue Survivor"              │            │
│           │                                        │            │
│           │  Recognized and intervened in cardiac  │            │
│           │  arrest in under 2 minutes.            │            │
│           │                                        │            │
│           │  +50 XP  |  +10 Phantom Health        │            │
│           │                                        │            │
│           │  [Awesome!]                            │            │
│           └───────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**Rules:**
- **Subtle**: Informational updates, non-critical
- **Banner**: Warnings, suggestions, teaching points
- **Modal**: Achievements, critical alerts, important decisions

---

## Accessibility & Polish

### Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + 1-5` | Switch to Module 1-5 |
| `Cmd/Ctrl + T` | Toggle AI Tutor sidebar |
| `Cmd/Ctrl + /` | Search/command palette |
| `Cmd/Ctrl + K` | Quick actions |
| `Space` | Play/pause audio (OSCE) |
| `Esc` | Dismiss overlay/modal |
| `Tab` | Focus next interactive element |
| `Shift + Tab` | Focus previous |
| `?` | Show keyboard shortcuts |

### Focus States

```css
/* Custom focus rings matching brand */
*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}

/* Interactive elements glow on focus */
button:focus-visible,
a:focus-visible {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
}
```

### Screen Reader Announcements

```typescript
// Live region for dynamic updates
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Examples:
"Patient vital signs updated. Oxygen saturation now 86%."
"New achievement unlocked: Code Blue Survivor."
"SOAP note draft updated. Completeness: 72%."
"Module transition: Now entering Clinical Eye."
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Respects**: User preference for reduced motion (vestibular disorders, motion sickness)

---

## Micro-Interactions & Polish

### Button States

```css
/* Primary CTA */
.btn-primary {
  background: var(--color-primary);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.3);
}

/* Loading state */
.btn-primary.loading {
  pointer-events: none;
  opacity: 0.7;
}

.btn-primary.loading::after {
  content: '';
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
```

### Card Hover Effects

```css
.module-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.module-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.module-card:hover .card-glow {
  opacity: 1;
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }
}
```

### Progress Indicators

```typescript
// Animated progress bar
<div className="progress-bar">
  <div 
    className="progress-fill"
    style={{
      width: `${progress}%`,
      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
    }}
  >
    <span className="progress-shimmer" />
  </div>
</div>

// CSS
.progress-shimmer {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

---

## Intelligent Features

### Auto-Save & Recovery

```
┌──────────────────────────────────────────────────────────────┐
│  💾 Auto-saved 2 seconds ago                                 │
│  Connection: ●● Excellent (45ms)                             │
└──────────────────────────────────────────────────────────────┘
```

**Behavior:**
- **Auto-save every 5 seconds** (debounced)
- **Show save indicator** (subtle, bottom-right)
- **Connection quality indicator** (latency-based)
- **Offline mode**: Queue actions, sync when reconnected

### Smart Pause Detection

```
[Student inactive for 30 seconds]

┌──────────────────────────────────────────────────────────────┐
│  ⏸️ Paused - Take your time                                  │
│                                                               │
│  Need help? The AI Tutor is available.                       │
│  [Ask Question] [Continue]                                   │
└──────────────────────────────────────────────────────────────┘
```

**Triggers:**
- 30s no interaction → Pause hint
- 60s no interaction → Pause session (vitals freeze)
- 5min no interaction → Save and exit

### Contextual Help

```
[Student hovering over unfamiliar term]

┌──────────────────────────────────────┐
│  ℹ️ Levine Sign                      │
│  Patient clutching fist to chest     │
│  Sensitivity: 75% for ACS            │
│  [Learn More]                        │
└──────────────────────────────────────┘
```

**Features:**
- **Hover tooltips** for medical terms
- **Click to expand** to full AI Tutor explanation
- **Citation links** to textbook references

---

## Responsive Design

### Breakpoints

| Device | Width | Layout |
|--------|-------|--------|
| **Mobile** | < 768px | Single column, collapsible sidebar |
| **Tablet** | 768-1024px | Main + sidebar, smaller fonts |
| **Desktop** | 1024-1440px | Full layout, optimal |
| **Large Desktop** | > 1440px | Wide layout, extra sidebar space |

### Mobile Optimizations

```
[Mobile View - OSCE Module]

┌─────────────────────────────┐
│  🏥 PANaCEa        [≡]      │ ← Collapsed nav
├─────────────────────────────┤
│  Patient: John Smith, 55yo  │ ← Condensed context
├─────────────────────────────┤
│  [Full-screen patient video]│
│                             │
│                             │
│                             │
├─────────────────────────────┤
│  Vitals: HR 110 | O2 94%   │ ← Compact vitals
├─────────────────────────────┤
│  [🎤 Voice] [💬 Text]      │ ← Bottom controls
│  [Swipe up for AI Tutor ↑] │ ← Gesture hint
└─────────────────────────────┘
```

**Mobile-Specific:**
- **Gesture navigation**: Swipe left/right between modules
- **Bottom sheet**: Swipe up for AI Tutor
- **Floating controls**: Voice controls always accessible
- **Haptic feedback**: Enhanced on mobile for tactile response

---

## Performance Optimizations

### Lazy Loading

```typescript
// Lazy load modules as needed
const OSCEModule = lazy(() => import('@/components/modes/PatientEncounterMode'));
const ClinicalEyeModule = lazy(() => import('@/components/modes/ClinicalEyeMode'));
const SimLabModule = lazy(() => import('@/components/modes/SimLabMode'));

// With suspense boundary
<Suspense fallback={<ModuleLoadingScreen />}>
  {currentModule === 'osce' && <OSCEModule />}
  {currentModule === 'clinical_eye' && <ClinicalEyeModule />}
</Suspense>
```

### Resource Pre-Loading

```typescript
// Pre-load likely next module
function preloadNextModule(currentModule: string, context: UnifiedSessionState) {
  if (currentModule === 'osce' && context.osce?.diagnosis) {
    // Likely going to imaging next
    preload('clinical_eye');
    prefetchImages(['ecg', 'xray']);
  }
  
  if (currentModule === 'clinical_eye' && context.clinicalEye?.findingsIdentified.length > 0) {
    // Likely going to procedure next
    preload('sim_lab');
    prefetchVideos(['procedure_workflow']);
  }
}
```

### Video Optimization

```typescript
// Adaptive bitrate based on connection
const videoQuality = getOptimalQuality(connectionSpeed);

// Values:
// connectionSpeed > 10 Mbps: 1080p (5 Mbps bitrate)
// connectionSpeed 5-10 Mbps: 720p (2.5 Mbps bitrate)
// connectionSpeed < 5 Mbps: 480p (1 Mbps bitrate)

<video
  src={getVideoUrl(videoId, videoQuality)}
  preload="auto"
  loop
  muted
  playsInline
/>
```

---

## Error Handling & Graceful Degradation

### Progressive Enhancement

```typescript
// Check feature support
const features = {
  webgl: checkWebGLSupport(),
  webrtc: checkWebRTCSupport(),
  audioWorklet: checkAudioWorkletSupport(),
  haptic: 'vibrate' in navigator,
};

// Fallbacks
if (!features.webgl) {
  // Use 2D canvas for visualizations
  useCanvas2DVisualization();
}

if (!features.audioWorklet) {
  // Use ScriptProcessorNode (deprecated but compatible)
  useScriptProcessor();
}

if (!features.haptic) {
  // Use visual indicators only
  disableHapticFeedback();
}
```

### Error Recovery

```
[WebSocket Disconnected]

┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Connection Lost                                          │
│                                                               │
│  Attempting to reconnect... (Attempt 1 of 3)                 │
│  [████░░░░░░] 40%                                            │
│                                                               │
│  Your progress is saved. Don't worry!                        │
│                                                               │
│  [Retry Now] [Continue Offline]                             │
└──────────────────────────────────────────────────────────────┘
```

**Behavior:**
- **Auto-reconnect** with exponential backoff
- **Show progress** during reconnection
- **Offline mode** available for non-real-time activities
- **Sync when back online**

---

## Conclusion

These UI/UX polish guidelines ensure PANaCEa feels like a **cohesive, intelligent platform** rather than disconnected modules. Every transition is smooth, every interaction is delightful, and the system intelligently guides students through their learning journey.

**Key Principles:**
1. **Seamless transitions** between modules with context preservation
2. **Intelligent routing** based on performance and learning needs
3. **Persistent context** visible across all views
4. **Smart sidebar** that adapts to current activity
5. **Layered notifications** from subtle to critical
6. **Accessibility first** with keyboard nav and screen readers
7. **Performance optimized** with lazy loading and pre-fetching
8. **Graceful degradation** with progressive enhancement

The result: A platform that feels **alive, responsive, and intelligent**.

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`
