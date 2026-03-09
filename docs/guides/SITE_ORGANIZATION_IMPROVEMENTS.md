# Site Organization & Navigation Improvements

## Overview

This document outlines the comprehensive reorganization of PANaCEa to improve user experience, navigation clarity, and feature discoverability while maintaining the beloved navy blue and off-white color scheme.

## Navigation Structure

### Current Structure Issues

- Drill modes mixed with learning tools
- No clear hierarchy between training sessions and resources
- Settings and keyboard shortcuts take up prime header space
- Difficult to distinguish between active practice vs. reference materials

### New Structure

```
PANaCEa App
├── 🏠 Dashboard (Menu/Home)
│   ├── Start Training Session (Core Adaptive)
│   ├── Continue Active Session (if any)
│   ├── Performance Overview
│   └── Quick Actions (Review Due, Flagged, etc.)
│
├── 🎯 Training Modes
│   ├── Core Adaptive (main study session)
│   ├── Rapid Recall
│   ├── DDx Compare
│   ├── Streak Challenge
│   └── Cram Mode
│
├── 🎓 Drill Modes (organized by category)
│   │
│   ├── Visual Drills
│   │   ├── ECG Interpretation
│   │   ├── Derm Recognition
│   │   ├── Imaging Review
│   │   └── Mini Lab Mode
│   │
│   ├── Clinical Drills
│   │   ├── Patient Encounter (OSCE)
│   │   ├── Code Blue Speed
│   │   ├── Grand Rounds Live
│   │   └── Condition Drill
│   │
│   └── Pharmacology Drills
│       ├── First Line Treatment
│       ├── Pharmacology Quiz
│       ├── Bug-Drug Mastery
│       └── Hydro-Mode (Fluids)
│
├── 🧰 Toolkit Hub (Learning Resources - NEW!)
│   ├── 3D Anatomy AR
│   ├── Radiology Scroll
│   ├── Guideline Mode (Scoring Systems)
│   ├── Lab Normals Reference
│   └── Drug Reference
│
├── 🔗 Integrations
│   ├── Anki Export
│   ├── Notion Sync
│   └── Study Group Dashboard
│
└── ⚙️ Settings & Stats
    ├── Performance Analytics
    ├── Account Settings
    ├── Keyboard Shortcuts (Cmd+K)
    └── Theme Toggle

```

## Dashboard Focal Areas (Command Center)

The Command Center (`/` and `/study`) is the single home. Its layout prioritizes the most important actions above the fold:

1. **Hero Triple** – Three primary cards in one glance:
   - **Main Session** – Build Session / Start review (Core Adaptive)
   - **Live OSCE** – Start Encounter (voice patient, SOAP grading)
   - **Progress & Analytics** – Summary stats (streak, due, accuracy) + “View full analytics” (scrolls to Study Tools analytics tab)
2. **Core Adaptive Hero & OSCE Section** – Full cards for main session and Live OSCE immediately below the Hero Triple and Quick Stats.
3. **Study Tools** – Sticky tab bar with **Progress & Analytics** as the first tab, then Training Modes, then Clinical Resources. “View full analytics” from the Hero Triple scrolls to this section and opens the Analytics tab.

NavRail order: Dashboard → Progress → Start Session → Reference → Calculators → Menu. One primary CTA lives in content (Hero Triple); header actions remain secondary (icon-only).

## Key Changes

### 1. Toolkit Hub (NEW)

**Purpose**: Separate passive learning resources from active drill modes

**Features**:

- 3D Anatomy AR - Interactive anatomical visualization
- Radiology Scroll - Browse and learn imaging patterns
- Guideline Mode - Scoring systems and clinical criteria
- Lab Normals - Quick reference for lab values
- Drug Reference - Medication lookup and comparison

**Benefits**:

- Clear distinction between "active practice" and "reference materials"
- Students know where to find learning aids vs. where to test themselves
- More intuitive organization

### 2. Improved Drill Mode Categorization

**Visual Drills**: All image-based pattern recognition
**Clinical Drills**: Simulation-based scenarios
**Pharmacology Drills**: All medication-related content

### 3. Streamlined Header Navigation

**Before**:

- Logo, Settings Button, Keyboard Button, Theme Toggle (cluttered)

**After**:

- Logo (clickable to dashboard)
- Command Palette Icon (⌘K) - Access everything quickly
- Theme Toggle
- Clean, minimal, professional

**Keyboard Shortcuts Moved To**:

- Command Palette (⌘K opens it)
- Also accessible via Settings modal
- On-screen hint: "Press ⌘K for commands"

### 4. Command Palette Enhancement

**New Features**:

- Quick access to all drill modes
- Jump to toolkit resources
- Navigate to settings
- Start training sessions with filters
- Search for conditions/drugs

**Benefits**:

- Power users can navigate entirely by keyboard
- Reduces visual clutter in main UI
- Faster workflow for repeat users

## Visual Design Improvements

### Color Scheme (PRESERVED)

- Primary: Navy Blue (#1e3a8a to #1e40af range)
- Background Light: Off-White (#f8fafc)
- Background Dark: Navy/Charcoal (#0f172a)
- Accent: Maintains current system

### Icon Standardization

All drill modes now use **monochrome** icons with consistent styling:

- Same stroke width
- Same size proportions
- Colored by category (visual=blue, clinical=teal, pharma=purple)
- Consistent hover states

### Landing Page Consistency

Every drill mode now has:

1. Hero section with mode description
2. "How It Works" section
3. Customization options (where applicable)
4. Start button with clear CTA
5. Exit button (consistent position)

### Smooth Transitions

- Page transitions use consistent easing (cubic-bezier)
- Loading states are uniform
- No jarring theme switches
- Respects reduced motion preferences

## Implementation Priority

### Phase 1: Navigation Restructure (COMPLETE in this commit)

- [x] Create Toolkit Hub component
- [x] Reorganize MenuView with new structure
- [x] Update CommandPalette with toolkit options
- [x] Move keyboard shortcuts to Command Palette

### Phase 2: Drill Mode Standardization (IN PROGRESS)

- [x] **Shared landing layout:** Use [components/drill/DrillLandingPage.tsx](../components/drill/DrillLandingPage.tsx) as the standard. It provides: hero (title, description, icon), Back button, meta (estimated time, categories), one primary "Start Drill" CTA, optional "Learning Objectives", "How it Works" (instructions), stats, and optional children for mode-specific options.
- [ ] Standardize all drill mode landing pages to use DrillLandingPage (audit [config/training-modes.ts](../config/training-modes.ts) and each mode component; migrate custom landings to pass props into DrillLandingPage).
- [ ] Apply monochrome icons
- [ ] Ensure consistent theme usage
- [ ] Update each mode to use MiniModeLayout properly

### Phase 3: Patient Encounter Integration (COMPLETE in this commit)

- [x] Integrate EncounterSettings modal
- [x] Integrate ImagingViewer component
- [x] Add gamification elements
- [x] Connect OSCE chat history API
- [x] Implement achievement system

### Phase 4: Polish & Testing

- [ ] User testing with PA students
- [ ] A/B test navigation structures
- [ ] Performance optimization
- [ ] Accessibility audit

## Success Metrics

### Usability

- Time to find specific drill mode < 5 seconds
- User satisfaction with navigation > 4.5/5
- Reduced support questions about "where to find X"

### Engagement

- Increased usage of toolkit resources
- Higher session completion rates
- More drill mode variety in user sessions

### Performance

- Page load times < 1 second
- Smooth transitions (60fps)
- No theme flicker on mode switches

## User Benefits

1. **Clearer Mental Model**: Students understand what's for practice vs. reference
2. **Faster Navigation**: Command Palette + better organization
3. **Less Overwhelm**: Grouped features by purpose
4. **More Discoverable**: Toolkit Hub highlights underused features
5. **Professional Feel**: Consistent, polished UI throughout
6. **Personalization**: Enhanced customization in Patient Encounter
7. **Motivation**: Gamification elements encourage consistent practice

## Technical Implementation Notes

### Component Structure

```typescript
App.tsx
├── MenuView (Dashboard)
│   ├── TrainingMenu (sessions + drill modes)
│   └── ToolkitHub (NEW)
├── CommandPalette (enhanced)
├── SettingsStatsModal
└── Mode Components
    ├── PatientEncounterMode (enhanced)
    ├── [Other drill modes]
    └── Toolkit modes (AR, Radiology, etc.)
```

### Routing Strategy

- No change to actual React Router setup
- Navigation handled via view state in App.tsx
- **Route map:** See [docs/ROUTES_AND_VIEWS.md](../ROUTES_AND_VIEWS.md) for path → view and canonical paths (404 and nav).
- Command Palette updates view state directly
- Maintains SPA feel with instant transitions

### Theme Implementation

- CSS variables continue to drive theming
- No hardcoded colors in components
- All drill modes use `var(--color-*)` syntax
- Dark mode toggle affects all views consistently

## Future Enhancements

### Short Term

- Add "Recently Used" section in Command Palette
- Implement drill mode search in Toolkit Hub
- Add tooltips for first-time users
- Create onboarding tour highlighting navigation

### Long Term

- Customizable dashboard layouts
- Drag-and-drop drill mode favorites
- Personalized mode recommendations based on performance
- Integration with external calendar for study scheduling

## Conclusion

These improvements transform PANaCEa from a feature-rich but somewhat scattered app into a cohesive, professional learning platform. The reorganization respects the user's mental model, reduces cognitive load, and makes powerful features more discoverable—all while preserving the clean, professional aesthetic users love.
