# PANaCEa Pillar Architecture

## Mental Model: 5 Core Pillars

### 1. 🎯 Command Center
**Purpose**: Live status dashboard - what to study NOW

**Components**:
- **What to Study Now**: SRS-due count, flagged items, review queue
- **Benchmark Deltas**: Performance vs. baseline, trending up/down
- **Activity Feed**: Recent sessions, streaks, achievements
- **Quick Actions**: Start session, jump to drill, view analytics

**Location**: Main dashboard/home screen  
**Navigation**: Always accessible via home button

---

### 2. 📚 Main Session (Infinite Stream)
**Purpose**: Core question practice engine

**Modes**:
- **SRS-Due**: Spaced repetition scheduled reviews
- **Flagged**: Previously flagged questions for review
- **Random**: Endless practice stream
- **Topic Focus**: Filter by system/subcategory

**Features**:
- Infinite scroll of questions
- Real-time SRS scheduling
- Flag/unflag functionality
- Performance tracking
- Adaptive difficulty

**Location**: Primary study mode  
**Navigation**: "Start Session" from Command Center

---

### 3. 🩺 Diagnostic Drills
**Purpose**: Focused skill-building in specific domains

**Categories** (as defined):

#### Clinical Diagnosis (Interpretation-based)
- Virtual OSCE
- Hydro Mode
- Mini-Labs
- ECG Interpretation
- Radiology Interpretation
- Code Blue
- DDx Compare
- Ventilator Mode

#### Quick-Fire (Rapid recall)
- Buzzword Mode
- Derm Photos
- Bug-Drug Mastery
- First-Line Treatments
- Daily Term
- Polypharmacy

**Location**: `DiagnosticDrillHub.tsx`  
**Navigation**: Separate hub with category filtering

---

### 4. 🛠️ Clinical Toolkit
**Purpose**: Pure reference and calculators (NO questions)

**Structure**:
```
Clinical Toolkit
├─ Reference Library
│  ├─ Category Selection
│  │  ├─ Pharmacology
│  │  ├─ Clinical Medicine
│  │  ├─ Physiology
│  │  └─ Anatomy
│  ├─ System Selection (14 PANCE systems)
│  └─ Subcategory > Specific Content
│     ├─ Conditions
│     ├─ Drugs
│     ├─ Procedures
│     └─ Guidelines
│
└─ Clinical Calculators
   ├─ Risk Scores (CURB-65, CHA₂DS₂-VASc)
   ├─ Diagnostic Tools (Wells', PERC)
   ├─ Lab Calculators (GFR, Anion Gap)
   ├─ Dosing (Pediatric)
   └─ Guidelines (Clinical criteria)
```

**Features**:
- Searchable across all content
- Hierarchical navigation (Category → System → Subcategory → Specific)
- Quick reference cards
- Calculators with clinical recommendations
- Radiology scroll (imaging library)
- Lab normals reference

**Location**: `ToolkitHub.tsx`  
**Navigation**: Reference wing, no testing

---

### 5. 📊 Intelligence Hub
**Purpose**: Deep-dive analytics and performance insights

**Structure**:
```
Intelligence Hub
├─ Performance Analytics
│  ├─ System-Level View (14 PANCE systems radar chart)
│  ├─ Subcategory Drilldown (Progress bars, retention scores)
│  └─ Condition Deep Dive (Individual performance, SRS data)
│
├─ High-Yield Gaps
│  └─ Top 3 priority areas (exam weight × performance gap)
│
├─ Trends & Insights
│  ├─ Decision Speed Trends
│  ├─ Retention Score Over Time
│  ├─ Accuracy by Difficulty
│  └─ Session History
│
└─ Benchmarks & Goals
   ├─ PANCE Readiness Score
   ├─ System Mastery Progress
   └─ Custom Goals Tracking
```

**Features**:
- 3-level hierarchical navigation (System → Subcategory → Condition)
- Interactive radar charts
- Retention score calculations (FSRS-based)
- Triage priority rankings
- Decision speed analytics
- Breadcrumb navigation

**Location**: `IntelligenceHub.tsx`  
**Navigation**: Analytics/insights section

---

## Navigation Flow

```
┌─────────────────────────────────────────────────────────┐
│                    COMMAND CENTER                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Study Now│ │Benchmarks│ │ Activity │ │Quick Acts│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
                        ▼
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌────────────────┐              ┌────────────────┐
│  MAIN SESSION  │              │ DIAGNOSTIC     │
│                │              │ DRILLS HUB     │
│ • SRS-Due      │              │                │
│ • Flagged      │              │ • Clinical     │
│ • Random       │              │   Diagnosis    │
│ • Topic Focus  │              │ • Quick-Fire   │
└────────────────┘              └────────────────┘
        ▼                               ▼
┌────────────────┐              ┌────────────────┐
│ CLINICAL       │              │ INTELLIGENCE   │
│ TOOLKIT        │              │ HUB            │
│                │              │                │
│ • Reference    │              │ • Analytics    │
│   Library      │              │ • High-Yield   │
│ • Calculators  │              │   Gaps         │
│ • Guidelines   │              │ • Trends       │
│ • Imaging      │              │ • Benchmarks   │
└────────────────┘              └────────────────┘
```

---

## File Structure

```
components/
├─ CommandCenter.tsx (Dashboard with live widgets)
├─ MainSession.tsx (Infinite question stream)
├─ DiagnosticDrillHub.tsx (Skill drills) ✅ COMPLETE
├─ ToolkitHub.tsx (Reference + calcs) ✅ COMPLETE
├─ analytics/
│  └─ IntelligenceHub.tsx (Analytics) ✅ COMPLETE
└─ drill/
   ├─ DrillShell.tsx (Wrapper) ✅ COMPLETE
   └─ [individual drill components]
```

---

## Implementation Checklist

### ✅ Completed
- [x] DiagnosticDrillHub with 2 categories (Clinical Diagnosis, Quick-Fire)
- [x] ToolkitHub with calculators and reference library structure
- [x] IntelligenceHub with 3-level hierarchy and analytics
- [x] DrillShell standardized wrapper
- [x] Guidelines moved to Toolkit as calculator

### 🔄 To Implement
- [ ] Command Center dashboard component
- [ ] Main Session infinite stream
- [ ] Update App.tsx routing to match pillar structure
- [ ] Add navigation between pillars
- [ ] Integrate SRS-due logic into Command Center
- [ ] Add "What to Study Now" widget
- [ ] Implement benchmark delta calculations
- [ ] Create activity feed component

---

## Key Principles

1. **Command Center = Starting Point**
   - User lands here, sees what to do NOW
   - Live data, no static content

2. **Main Session = Primary Study Mode**
   - Infinite stream of questions
   - SRS drives what shows up
   - No navigation menus, pure focus

3. **Diagnostic Drills = Skill Building**
   - Targeted practice in specific areas
   - Clear entry/exit points
   - DrillShell wrapper for consistency

4. **Clinical Toolkit = Reference Only**
   - NO questions or testing
   - Hierarchical content browsing
   - Calculators for clinical decisions
   - Search-first interface

5. **Intelligence Hub = Performance Insights**
   - Deep analytics, not live status
   - Hierarchical data exploration
   - Identify weak areas for targeted study

---

## User Journey Examples

### Journey 1: Daily Study Session
1. Land on **Command Center**
2. See "47 SRS-due items" widget
3. Click "Start Session"
4. Enter **Main Session** (Infinite Stream)
5. Complete reviews, SRS updates
6. Exit back to Command Center

### Journey 2: Targeted Skill Practice
1. **Command Center** shows "ECG: 45% accuracy"
2. Click "Practice ECG" quick action
3. Navigate to **Diagnostic Drills Hub**
4. Select "ECG Interpretation"
5. Complete drill session
6. Return to hub or Command Center

### Journey 3: Reference Lookup
1. During study, need drug mechanism
2. Open **Clinical Toolkit**
3. Navigate: Pharmacology → CV → Beta Blockers → Metoprolol
4. Read reference, close toolkit
5. Return to study session

### Journey 4: Performance Analysis
1. Completed 500 questions this week
2. Open **Intelligence Hub**
3. View radar chart (weak in GI)
4. Drill down: GI → IBD → Crohn's Disease
5. See retention score, SRS schedule
6. Identify high-yield gaps
7. Return to Command Center with targets

---

## Design Consistency

### Navigation Patterns
- **Home button**: Always returns to Command Center
- **Breadcrumbs**: Show current location in hierarchy
- **Back button**: One level up
- **Exit button**: Return to previous pillar

### Visual Hierarchy
- **Pillar headers**: Large, bold, with icon
- **Category sections**: Gradient backgrounds
- **Content cards**: Consistent padding, hover states
- **Actions**: Primary (accent color), Secondary (muted)

### Color Coding
- **Command Center**: Teal/Cyan (active, live)
- **Main Session**: Purple/Indigo (focus, study)
- **Diagnostic Drills**: Blue/Orange (skills, practice)
- **Clinical Toolkit**: Green/Emerald (reference, safe)
- **Intelligence Hub**: Pink/Rose (insights, analytics)

---

## API Integration Points

### Command Center
- GET `/api/srs/due-count` - SRS items due today
- GET `/api/performance/benchmarks` - Trending deltas
- GET `/api/activity/recent` - Recent sessions

### Main Session
- GET `/api/questions/next` - Next question in stream
- POST `/api/performance/record` - Submit answer
- PUT `/api/srs/update` - Update SRS schedule

### Intelligence Hub
- GET `/api/analytics/system-stats` - System-level data
- GET `/api/analytics/high-yield-gaps` - Priority areas
- GET `/api/analytics/trends` - Performance over time

---

## Mobile Considerations

All pillars must be mobile-responsive:
- Command Center: Stack widgets vertically
- Main Session: Full-screen question view
- Diagnostic Drills: Grid → list view on mobile
- Clinical Toolkit: Collapsible navigation
- Intelligence Hub: Touch-friendly charts, swipe navigation

---

## Future Enhancements

1. **Command Center**
   - Daily challenge widget
   - Peer comparison (anonymous)
   - Study streak calendar

2. **Main Session**
   - Voice answer mode
   - Timer challenges
   - Collaborative sessions

3. **Diagnostic Drills**
   - User-created custom drills
   - Drill leaderboards
   - Achievement badges

4. **Clinical Toolkit**
   - AI-powered search
   - Personalized bookmarks
   - Export to Anki

5. **Intelligence Hub**
   - Predictive PANCE score
   - Recommended study plans
   - Share progress reports
