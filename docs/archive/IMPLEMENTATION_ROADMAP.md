# Implementation Roadmap: UI/UX Overhaul & Feature Activation

## Executive Summary

**Status**: Foundation Complete (30%)
**Completed**: Schema updates, theme system, service layer
**Next**: UI refactoring, navigation updates, feature activation

---

## 🎯 Priority Order (As Requested)

1. ✅ **UI/Dark Mode Issues** - COMPLETE
2. 🔄 **Grand Rounds Mode** - Service done, UI needs refactor
3. ⏳ **Drill Mode Standardization** - Heavy focus required
4. ⏳ **Orphaned Features** - Quick wins
5. ⏳ **Basic Science Integration** - Needs discovery
6. ⏳ **OSCE Enhancements** - Schema done, implementation next
7. ⏳ **Photo Drill AI** - Complex, multi-step

---

## 📦 Deliverables Completed

### 1. Theme & Dark Mode System (✅ DONE)

**Files Modified**:
- `tailwind.config.js`: Semantic color tokens
- `index.css`: CSS variables for light/dark
- `components/SessionSetupModal.tsx`: Theme-aware buttons

**Color System**:
```css
Light: White (#FFFFFF) bg, Navy (#0F172A) text, Blue (#0284C7) accent
Dark: Navy (#0F172A) bg, Light (#F0F0F0) text, Bright Blue (#0EA5E9) accent
```

**Impact**: All components using `var(--color-*)` now auto-adapt to theme

### 2. Database Schema (✅ DONE)

**New Models**:
- `GrandRoundsChallenge`: Daily question sets (date, questionIds, seed)
- `GrandRoundsHistory`: User completions (score, time, rank)
- `EncounterChatHistory`: OSCE conversation logs (sessionId, role, message)

**Deprecated**:
- `Leaderboard` (commented out, safe to delete later)
- `LeaderboardEntry` (commented out, safe to delete later)

**Migration Required**:
```bash
npx prisma generate
npx prisma db push  # Or create migration
```

### 3. Grand Rounds Service (✅ DONE)

**File**: `services/grandRoundsService.ts`

**Functions**:
- `getTodaysChallenge()`: Fetch/create daily challenge
- `hasCompletedToday()`: Check completion status
- `submitCompletion()`: Submit with speed bonus
- `getTodaysLeaderboard()`: Global rankings
- `calculateScore()`: Speed-weighted algorithm

**Scoring**:
- Base: Points from correct answers
- Bonus: Up to +200 pts for speed (<5 min)
- Formula: `score = baseScore + floor((1 - time/300) * 200)`

---

## 🔧 Implementation Guide

### STEP 1: Grand Rounds UI Refactor

**File**: `components/modes/GrandRoundsMode.tsx`

**Changes Required**:
1. Import `grandRoundsService`
2. Replace `SAMPLE_QUESTIONS` with `getTodaysChallenge()`
3. Add `hasCompletedToday()` check on landing page
4. Call `submitCompletion()` after final question
5. Show "View Daily Rank" button instead of "Play Again"
6. Display `getTodaysLeaderboard()` in results view

**Example Refactor**:
```typescript
import { getTodaysChallenge, hasCompletedToday, submitCompletion } from '@/services/grandRoundsService';

// In component:
const [hasCompleted, setHasCompleted] = useState(false);

useEffect(() => {
  async function checkStatus() {
    const completed = await hasCompletedToday(userId);
    setHasCompleted(completed);
  }
  checkStatus();
}, [userId]);

// On start:
const challenge = await getTodaysChallenge();
setQuestions(challenge.questions);

// On completion:
const rank = await submitCompletion(userId, totalScore, timeMs, correctCount);
```

### STEP 2: Drill Mode Standardization

#### 2A: MiniLabDrillSession

**File**: `components/drill/MiniLabDrillSession.tsx`

**Current**: Custom full-screen layout
**Target**: Use `MiniDrillLayout` wrapper

**Refactor Steps**:
1. Import `MiniDrillLayout`
2. Wrap main content in `<MiniDrillLayout>`
3. Pass props: `title`, `score`, `totalAttempts`, `streak`
4. Pass `isFeedback`, `isCorrect` for flash overlay
5. Move feedback UI to `footer` prop
6. Remove custom header/exit/reset buttons

**Template**:
```typescript
import MiniDrillLayout from './MiniDrillLayout';

return (
  <MiniDrillLayout
    title="Mini Lab Drill"
    score={score}
    totalAttempts={totalAttempts}
    streak={streak}
    isFeedback={status === 'feedback'}
    isCorrect={isCorrect}
    onExit={handleExit}
    onReset={reset}
    footer={status === 'feedback' && <FeedbackUI />}
  >
    {/* Main content: lab panels, input, etc. */}
  </MiniDrillLayout>
);
```

#### 2B: GuidelineDrillSession

**File**: `components/drill/GuidelineDrillSession.tsx`

**Same refactor as MiniLabDrillSession**
- Wrap in `MiniDrillLayout`
- Pass scoring props
- Move feedback to footer

#### 2C: Add DrillLandingPage

**Missing Pre-Session Screens**:
- Photo Drill (all categories)
- Mini Lab
- Pharm
- First Line
- Guideline
- Rapid Recall
- DDx Compare

**Implementation**:
1. Import `DrillLandingPage`
2. Add `viewState` state: `'landing' | 'active'`
3. Show landing page when `viewState === 'landing'`
4. Call `onStart` to transition to `'active'`

**Template**:
```typescript
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { Microscope } from 'lucide-react'; // Drill-specific icon

const [viewState, setViewState] = useState<'landing' | 'active'>('landing');

if (viewState === 'landing') {
  return (
    <DrillLandingPage
      title="Mini Lab Drill"
      description="Interpret lab panels and diagnose conditions"
      icon={Microscope}
      accentColor="blue"
      stats={{
        totalAttempts: 42,
        averageScore: 78,
        bestScore: 95
      }}
      instructions={[
        "Review the complete lab panel",
        "Consider all values, not just abnormals",
        "Type your diagnosis with smart search"
      ]}
      onStart={() => setViewState('active')}
    />
  );
}

// Existing drill UI
return <MiniDrillLayout ...>...</MiniDrillLayout>;
```

### STEP 3: Orphaned Features Activation

#### 3A: AR Anatomy Mode

**File**: `App.tsx`

**Add Route**:
```typescript
const AR_ANATOMY: TrainingModeId = 'ar_anatomy';

// In View type:
type View = "menu" | "quiz" | ... | "ar_anatomy";

// In render logic:
{view === "ar_anatomy" && (
  <Suspense fallback={<Loader message="Loading AR Anatomy..." />}>
    <ARAnatomyMode onExit={() => setView("menu")} />
  </Suspense>
)}
```

**File**: `components/MenuView.tsx`

**Add Navigation Card** (find "Training Modes" section):
```typescript
<DrillCard
  icon={Scan}
  title="AR Anatomy"
  description="Interactive 3D anatomy viewer"
  accentColor="purple"
  onClick={() => onSelectMode('ar_anatomy')}
/>
```

#### 3B: PANRE-LA Simulator

**Same pattern as AR Anatomy**:
- Add route in `App.tsx`
- Add card in `MenuView.tsx`
- Ensure internal references (not UpToDate links)

### STEP 4: OSCE Implementation

**File**: `components/modes/PatientEncounterMode.tsx`

**Add Chat History Storage**:
```typescript
import type { EncounterChatHistory } from '@prisma/client';

// After each message:
async function saveMessage(role: 'user' | 'patient', message: string) {
  await fetch('/geminiProxy', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: 'osce/message',
      data: {
        sessionId,
        userId,
        role,
        message,
        phase: currentPhase
      }
    })
  });
}

// On encounter end:
async function clearHistory() {
  await fetch('/geminiProxy', {
    method: 'DELETE',
    body: JSON.stringify({
      endpoint: 'osce/session',
      params: { sessionId }
    })
  });
}
```

**Add Voice Mode**:
1. Create `hooks/useSpeechRecognition.ts`
2. Create `hooks/useSpeechSynthesis.ts`
3. Add toggle button for voice mode
4. Transcribe user input → send to AI
5. Speak AI responses via TTS

### STEP 5: Photo Drill AI Processing

**Create**: `services/imageProcessingService.ts`

**Functions**:
- `findClinicalImages(conditionId)`: Query MediaAsset table
- `gradeImage(imageUrl)`: Use Gemini Vision API (0-100 score)
- `processSingle(imageUrl)`: Crop, enhance, store to R2
- `linkToQuestion(imageId, questionId)`: Associate media

**Backend**: `functions/api/image-process.ts`
```typescript
export async function onRequestPost(context) {
  const { imageUrl, conditionId } = await context.request.json();
  
  // 1. Download image
  // 2. Run Gemini Vision analysis
  // 3. Crop/enhance
  // 4. Upload to R2
  // 5. Create MediaAsset record
  // 6. Return new asset ID
}
```

---

## 📝 Testing Plan

### Visual Testing
1. Toggle dark mode on every screen
2. Check button contrast
3. Verify text legibility
4. Test drill mode layouts

### Functional Testing
1. Complete Grand Rounds challenge
2. Check leaderboard ranking
3. Try OSCE conversation flow
4. Test photo drill image display
5. Navigate to AR Anatomy/PANRE-LA

### Database Testing
```bash
# Check Grand Rounds data
npx prisma studio
# Navigate to GrandRoundsHistory table
# Verify: userId, date, score, rank populated

# Check OSCE chat
# Navigate to EncounterChatHistory
# Verify: messages stored, sessionId consistent
```

---

## 🚧 Known Issues & Considerations

### Grand Rounds
- **Issue**: Need actual Question table queries, not sample data
- **Solution**: Update service to fetch from `Question` model by `questionIds`

### Leaderboard Removal
- **Issue**: `LeaderboardPanel.tsx` still in codebase
- **Solution**: Delete file, remove import from MenuView

### Basic Science
- **Issue**: Features not located yet
- **Solution**: Run `grep -r "basic.science\|physiology" components/`

### Photo Drill
- **Issue**: Complex AI pipeline (Vision API, R2, cropping)
- **Solution**: Implement in phases: 1) DB query, 2) AI grading, 3) Processing

---

## 🎓 Best Practices

### When Using MiniDrillLayout
- Always pass all required props
- Use `footer` for feedback UI
- Don't recreate header/controls
- Let layout handle theme/responsiveness

### When Adding DrillLandingPage
- Provide meaningful stats
- Keep instructions concise (3-5 items)
- Use appropriate icon and color
- Test on mobile (cards stack vertically)

### When Modifying Schema
- Always run `npx prisma generate` after changes
- Test migrations in dev first
- Keep old models commented (don't delete immediately)

### When Integrating Gemini API
- Use `/geminiProxy` endpoint for all calls
- Check rate limits (Pro vs Flash)
- Use **Pro** for medical content (accuracy critical)
- Use **Flash** for conversational/quick responses

---

## 📚 Reference Files

### Core Documentation
- `UI_UX_IMPLEMENTATION_STATUS.md`: Task tracker
- `REGISTRY_FIRST_ARCHITECTURE.md`: Content architecture
- `DATABASE_IMPLEMENTATION.md`: Schema details
- `DEVELOPER_GUIDE.md`: Full development guide

### Key Components
- `components/drill/MiniDrillLayout.tsx`: Standard drill wrapper
- `components/drill/DrillLandingPage.tsx`: Pre-session screen
- `components/modes/GrandRoundsMode.tsx`: Competitive mode
- `components/modes/PatientEncounterMode.tsx`: OSCE simulator
- `components/PhotoDrillSession.tsx`: Image-based drills

### Services
- `services/grandRoundsService.ts`: Daily challenge API
- `services/geminiService.ts`: AI question generation
- `services/offlineSync.ts`: Offline-first sync

---

## 🎯 Success Criteria

### Must Have (MVP)
- [x] Theme system working in both modes
- [x] Grand Rounds service layer complete
- [ ] Grand Rounds UI refactored (daily challenges work)
- [ ] 3+ drill modes use MiniDrillLayout
- [ ] 3+ drill modes have DrillLandingPage
- [ ] AR Anatomy accessible via navigation
- [ ] PANRE-LA accessible via navigation

### Should Have
- [ ] All 7 drill modes standardized
- [ ] OSCE chat history working
- [ ] Photo drill queries database first
- [ ] Basic science features integrated

### Nice to Have
- [ ] OSCE voice-to-voice mode
- [ ] Photo drill AI processing pipeline
- [ ] Gemini Vision image grading
- [ ] Cloudflare R2 media management UI

---

## 💡 Quick Wins

**30 minutes or less**:
1. Add AR Anatomy route and card
2. Add PANRE-LA route and card
3. Delete LeaderboardPanel.tsx
4. Add DrillLandingPage to PharmDrill

**1-2 hours**:
1. Refactor MiniLabDrillSession with MiniDrillLayout
2. Refactor GrandRoundsMode with service
3. Add DrillLandingPage to all 7 drills

**Half day**:
1. Implement OSCE chat history storage
2. Create image processing service foundation
3. Basic science feature discovery and integration

---

## 🔗 Next Session Checklist

Before starting next session:
- [ ] Run `npx prisma generate`
- [ ] Test dark mode on existing screens
- [ ] Review `UI_UX_IMPLEMENTATION_STATUS.md`
- [ ] Check which drill modes need landing pages
- [ ] Locate basic science features

First tasks to tackle:
1. Grand Rounds UI refactor (high impact)
2. MiniLabDrillSession standardization (quick win)
3. Add AR Anatomy navigation (quick win)

---

**Last Updated**: 2025-12-11
**Commits**: 8bb4da0, c8d7814
**Status**: Foundation complete, ready for UI implementation
