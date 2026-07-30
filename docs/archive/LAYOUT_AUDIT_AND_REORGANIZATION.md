# Layout Audit & Reorganization Plan

**Date:** 2026-02-20  
**Status:** Implementation Ready  
**Priority:** High - UX Improvement

## Executive Summary

Current site layout has significant repetition, unclear navigation hierarchy, and scattered features. This audit identifies issues and provides a streamlined reorganization plan.

---

## 🔍 Current Issues

### 1. **Repetitive Navigation**
- **NavRail** (sidebar) + **CommandCenterHub tabs** + **Header buttons** = 3 overlapping navigation systems
- Same destinations accessible from multiple places (e.g., "Knowledge" in NavRail, "Clinical Resources" tab, "Knowledge Base" section)
- Students see 5+ ways to start a session (Hero, Triple cards, Time-box buttons, Grand Rounds, Training modes list)

### 2. **Unclear Information Architecture**
- "Study Tools" tab contains training modes, but "Practice" in NavRail also leads to training
- "Resources" tab duplicates NavRail "Knowledge" and "Utilities" links
- "Analytics" tab is separate from "Progress" NavRail item (same destination, different labels)

### 3. **Cognitive Overload**
- CommandCenterHub shows 8+ sections before fold on desktop
- Progressive disclosure ("Study Now" → "Choose Focus" → Mode list) adds unnecessary clicks
- Students must scroll through 15+ cards to find specific training mode

### 4. **Inconsistent Patterns**
- Some modes open in-place (Quiz), others navigate to new page (OSCE, Drills)
- Settings accessible via header button (modal) but no route
- Admin accessible via header shield icon AND `/admin` route

### 5. **Mobile Experience**
- Bottom tab bar (5 items) doesn't match desktop sidebar priorities
- Long vertical scroll on CommandCenter makes "below fold" content invisible
- Time-box buttons and countdown cards push main actions down

---

## ✅ Proposed Reorganization

### **Phase 1: Simplify Navigation (Week 1)**

#### A. Consolidate to Single Source of Truth
**NavRail becomes the ONLY primary navigation:**

```typescript
// Simplified NavRail structure
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home, href: '/study' },
  { id: 'practice', label: 'Practice', icon: Dumbbell, href: '/practice' }, // NEW: dedicated practice page
  { id: 'progress', label: 'Progress', icon: BarChart3, href: '/progress' }, // NEW: dedicated analytics page
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, href: '/knowledge' }, // Existing
  { id: 'tools', label: 'Tools', icon: Calculator, href: '/tools' }, // Existing (renamed from Utilities)
];
```

**Remove:**
- CommandCenterHub "Study Tools" tabs (Training/Resources/Analytics)
- Redundant section headers and navigation within CommandCenter
- "More options" buttons that open Settings modal

#### B. Flatten CommandCenter (Home Page)
**New Home structure (max 4 sections):**

1. **Hero: Quick Start** (above fold)
   - Single CTA: "Start Session" → opens focused modal with 3 choices:
     - "Core PANCE Simulation" (strict blueprint)
     - "Focus on Weak Areas" (adaptive)
     - "Review Due Questions" (FSRS)
   - Active session resume card (when applicable)
   - Quick stats bar (4 metrics)

2. **Daily Challenge** (above fold)
   - Grand Rounds OR Targeted Daily Question (single card)

3. **Recommended for You** (AI-driven, 3-4 cards max)
   - Uses RecommendationFeed (already implemented)
   - Personalized based on weak areas, time of day, exam date

4. **Exam Countdown + Time-box** (students only, collapsible)
   - Combined into single compact card
   - Defaults to collapsed after first visit

**Remove from Home:**
- OSCE section (move to Practice page)
- Residency Cockpit (move to Practice page)
- Current Curriculum grid (move to Settings modal)
- All training mode category sections (move to Practice page)
- Resources section (redundant with NavRail)
- Analytics section (redundant with NavRail)

#### C. Create Dedicated Practice Page (`/practice`)
**Replaces:** Current modal + CommandCenter "Training" tab

**Structure:**
```
/practice
├── Hero: "What do you want to practice?"
│   ├── Visual Diagnostics (Photo, ECG, Derm, Imaging)
│   ├── Clinical Simulation (OSCE, Patient Encounter, Code Blue)
│   ├── Question Practice (Core Adaptive, Custom Study, Cram)
│   └── Specialty Drills (Pharm, Labs, Anatomy, etc.)
├── Residency Cockpit (body map + system grid)
└── All Modes (searchable, filterable by category/time/difficulty)
```

**Benefits:**
- Single destination for all training modes
- No modal interruption
- Persistent URL for bookmarking
- Room for search/filter UI

#### D. Create Dedicated Progress Page (`/progress`)
**Replaces:** CommandCenter "Analytics" tab

**Structure:**
```
/progress
├── Quick Stats (streak, due, accuracy, today)
├── User-Friendly Stats (research-backed metrics)
├── Learning Profile (basic/advanced toggle)
├── System Heatmap (competency grid)
├── Gap Analysis (weak areas + recommendations)
├── Clinical Profile (timing, bias, strengths)
└── FSRS Schedule (Gantt chart)
```

**Benefits:**
- Dedicated space for analytics (no competing with training modes)
- Persistent URL for sharing/bookmarking
- Room for future analytics features

---

### **Phase 2: Improve Discoverability (Week 2)**

#### A. Add Search to Practice Page
```typescript
// Global search for training modes
<SearchInput
  placeholder="Search modes (e.g., 'ECG', 'pharmacology', 'quick review')"
  onSearch={(query) => filterModes(query)}
  shortcuts={['Photo Drill', 'OSCE', 'Cram Mode']}
/>
```

#### B. Add Quick Filters
```typescript
// Filter by time commitment
<FilterChips>
  <Chip active={filter === 'quick'}>Quick (5-10 min)</Chip>
  <Chip active={filter === 'medium'}>Medium (15-30 min)</Chip>
  <Chip active={filter === 'long'}>Long (45+ min)</Chip>
</FilterChips>
```

#### C. Add Breadcrumbs
```typescript
// Show current location
<Breadcrumbs>
  <Link to="/study">Home</Link>
  <ChevronRight />
  <span>Practice</span>
  <ChevronRight />
  <span>Photo Drill</span>
</Breadcrumbs>
```

---

### **Phase 3: Reduce Repetition (Week 3)**

#### A. Consolidate Session Start Flows
**Before:** 5+ ways to start session
- Hero "Start Session"
- Triple card "Build Session"
- Time-box buttons (5, 10, 20 min)
- Grand Rounds "Start"
- Training mode cards (20+ modes)

**After:** 2 clear paths
1. **Quick Start** (Home hero) → Modal with 3 focus options
2. **Specific Mode** (Practice page) → Direct to mode

#### B. Consolidate Settings Access
**Before:** 
- Header Settings button → Modal
- "More options" in Current Curriculum → Same modal
- No route for Settings

**After:**
- Header Settings button → Modal (keep)
- Add `/settings` route for deep linking
- Remove "More options" button (redundant)

#### C. Consolidate Knowledge Access
**Before:**
- NavRail "Knowledge" → KnowledgeBaseHub
- Resources tab "Knowledge Base" → Same destination
- Resources tab "My Library" → Different page
- Resources tab "Study Companion" → Different page

**After:**
- NavRail "Knowledge" → Single hub with tabs:
  - Reference (conditions, drugs, labs, anatomy)
  - My Library (uploaded PDFs)
  - Study Companion (PDF + chat)
  - Tutor Chat (reasoning tutor)

---

### **Phase 4: Mobile Optimization (Week 4)**

#### A. Simplify Bottom Tab Bar
**Current:** Home, Practice, Progress, Knowledge, Utilities (5 items)

**Proposed:** Home, Practice, Progress, More (4 items)
- "More" opens sheet with Knowledge, Tools, Settings, Admin

#### B. Add Pull-to-Refresh (Already implemented ✓)
- Refresh stats and recommendations on Home

#### C. Optimize Vertical Scroll
- Collapse exam countdown by default on mobile
- Lazy load "below fold" sections
- Add "Back to top" FAB when scrolled >50%

---

## 📊 Success Metrics

### Quantitative
- **Reduce clicks to start session:** 3 → 1 (67% improvement)
- **Reduce navigation items:** 15 → 5 (67% reduction)
- **Reduce Home page sections:** 8 → 4 (50% reduction)
- **Improve mobile scroll depth:** 80% users see main CTA (currently 45%)

### Qualitative
- Students can find any training mode in <10 seconds
- Clear mental model: Home = start, Practice = modes, Progress = analytics
- No duplicate navigation items
- Consistent interaction patterns (all modes navigate to dedicated page)

---

## 🚀 Implementation Plan

### Week 1: Navigation Consolidation
**Files to modify:**
- `App.tsx` - Add `/practice` and `/progress` routes
- `components/layout/NavRail.tsx` - Update nav items
- `components/navigation/CommandCenterHub.tsx` - Remove tabs, flatten sections
- `pages/PracticePage.tsx` - NEW: Dedicated practice hub
- `pages/ProgressPage.tsx` - NEW: Dedicated analytics hub

**Estimated effort:** 16 hours

### Week 2: Discoverability
**Files to modify:**
- `pages/PracticePage.tsx` - Add search, filters, breadcrumbs
- `components/shared/SearchInput.tsx` - NEW: Reusable search
- `components/shared/FilterChips.tsx` - NEW: Reusable filters

**Estimated effort:** 12 hours

### Week 3: Repetition Reduction
**Files to modify:**
- `components/navigation/CommandCenterHub.tsx` - Consolidate session start
- `components/modals/SessionSetupModal.tsx` - Simplify to 3 choices
- `pages/KnowledgeBaseHub.tsx` - Add tabs for Library, Companion, Tutor

**Estimated effort:** 10 hours

### Week 4: Mobile Polish
**Files to modify:**
- `components/layout/NavRail.tsx` - Simplify bottom bar to 4 items
- `components/navigation/CommandCenterHub.tsx` - Collapse exam countdown
- `components/shared/BackToTopFAB.tsx` - NEW: Floating action button

**Estimated effort:** 8 hours

**Total effort:** 46 hours (~1 sprint)

---

## 🎯 Quick Wins (Can implement today)

### 1. Remove CommandCenter Tabs (2 hours)
- Delete tab navigation from CommandCenterHub
- Move Analytics content to dedicated route
- Move Training modes to dedicated route

### 2. Flatten Home Page (3 hours)
- Remove OSCE section (keep in Practice page only)
- Remove Residency Cockpit (keep in Practice page only)
- Remove Resources section (redundant with NavRail)
- Collapse exam countdown by default

### 3. Add Breadcrumbs (1 hour)
- Add to all drill/mode pages
- Shows: Home > Practice > [Mode Name]

### 4. Consolidate Session Start (2 hours)
- Remove time-box buttons from Home (keep in modal)
- Remove triple cards (redundant with hero)
- Single "Start Session" CTA opens focused modal

**Total quick wins:** 8 hours

---

## 📝 Notes

### Backward Compatibility
- Keep old routes as redirects for 1 release cycle
- Add deprecation warnings in console for old navigation patterns
- Update all internal links to new structure

### User Communication
- Add "What's New" modal on first visit after update
- Highlight new Practice and Progress pages
- Show keyboard shortcuts ([ for sidebar, Cmd+K for search)

### Testing Checklist
- [ ] All NavRail links work on desktop and mobile
- [ ] Bottom tab bar works on mobile (<768px)
- [ ] Breadcrumbs show correct path
- [ ] Search filters training modes correctly
- [ ] Session start modal has 3 clear options
- [ ] No duplicate navigation items
- [ ] All old routes redirect to new structure
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Screen reader announces page changes

---

## 🔗 Related Documents

- [Navigation Config](../config/navigation.ts)
- [Routes Config](../config/routes.ts)
- [Training Modes Config](../config/training-modes.ts)
- [Gap Analysis](./GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md)
- [UX Optimization](./UX_OPTIMIZATION_FOR_PA_STUDENTS_2026.md)

---

**Next Steps:**
1. Review with team
2. Prioritize quick wins vs. full reorganization
3. Create Figma mockups for new Practice and Progress pages
4. Run usability test with 3-5 PA students
5. Implement in phases (1 week per phase)
