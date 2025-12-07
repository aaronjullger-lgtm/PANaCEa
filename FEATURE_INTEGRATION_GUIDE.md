# PANaCEa Feature Integration Guide

This guide documents the newly integrated features and how to use them.

## 🎯 Completed Integrations

### 1. AI Content Generation in Admin CMS

**What's New:**
- Added "Generate with AI" button to ContentEditor component
- Automatically generates medical content using Gemini AI
- Creates draft records ready for review and approval

**How to Use:**
1. Open the ContentEditor for any condition
2. Click the purple "Generate with AI" button
3. AI will generate comprehensive medical content including:
   - Overview
   - Symptoms
   - Diagnosis (physical exam, labs, imaging)
   - Treatment (first-line and alternatives)
   - Complications
   - Clinical pearls

**Technical Details:**
- File: `components/admin/ContentEditor.tsx`
- API: `functions/api/admin/generate-draft.ts`
- Status: Drafts are created with `status: 'draft'` for review

### 2. AI Tutor Sidecar (Interactive Learning)

**What's New:**
- Added "Ask Tutor" button to ExplanationPanel
- Enables Socratic dialogue with AI tutor
- Dynamically answers follow-up questions

**How to Use:**
1. After answering a quiz question, view the explanation
2. Click the purple "Ask Tutor" button
3. Type questions like:
   - "Why isn't it B?"
   - "Explain like I'm 5"
   - "What's the pathophysiology?"
4. Get interactive, conversational responses

**Technical Details:**
- File: `components/ExplanationPanel.tsx`
- Service: `services/CoachingService.ts`
- Method: `analyzeAnswer()`

### 3. Enhanced Offline Sync with Dead Letter Queue

**What's New:**
- Increased retry attempts from 3 to 5
- Failed items moved to "Dead Letter Queue"
- Users can view and recover failed sync items
- Prevents silent data loss

**How to Use:**
1. Data syncs automatically when online
2. If sync fails permanently (after 5 attempts), item moves to dead letter queue
3. Access FailedSyncItems component to:
   - View failed items
   - Copy data to clipboard for manual recovery
   - Remove items once handled

**Technical Details:**
- File: `lib/services/sync/offlineSync.ts`
- Component: `components/FailedSyncItems.tsx`
- Storage: `localStorage` keys:
  - `panacea_offline_queue` - Pending items
  - `panacea_dead_letter_queue` - Permanently failed items

**Integration Example:**
```tsx
// Add to SettingsStatsModal or MenuView
import { FailedSyncItems } from './FailedSyncItems';
import { getDeadLetterQueue } from '../lib/services/sync/offlineSync';

const [showFailedItems, setShowFailedItems] = useState(false);
const failedCount = getDeadLetterQueue().length;

// In render:
{failedCount > 0 && (
  <button onClick={() => setShowFailedItems(true)}>
    ⚠️ {failedCount} Failed Sync Items
  </button>
)}

<FailedSyncItems
  isOpen={showFailedItems}
  onClose={() => setShowFailedItems(false)}
/>
```

### 4. Rotation Selector Component

**What's New:**
- Dropdown selector for clinical rotations
- Pre-configured rotation types:
  - Surgery
  - Internal Medicine
  - Emergency Medicine
  - Pediatrics
  - Family Medicine
  - Psychiatry
  - OB/GYN
  - Primary Care
- Filters training modes by relevance

**How to Use:**
1. Add to App.tsx header
2. User selects their current rotation
3. Training modes filter automatically

**Technical Details:**
- File: `components/RotationSelector.tsx`
- Export: `RotationSelector` component
- Utility: `getModesForRotation(rotation)` - returns filtered mode IDs

**Integration Example:**
```tsx
// In App.tsx header
import { RotationSelector, getModesForRotation } from './components/RotationSelector';

const [currentRotation, setCurrentRotation] = useState<Rotation>('all');
const filteredModes = getModesForRotation(currentRotation);

// In header render:
<RotationSelector
  currentRotation={currentRotation}
  onRotationChange={setCurrentRotation}
/>

// In MenuView/TrainingMenu, filter modes:
const displayModes = filteredModes.length > 0
  ? MODE_REGISTRY.filter(m => filteredModes.includes(m.id))
  : MODE_REGISTRY;
```

## ✅ Previously Implemented Features (Already Working)

### AR Anatomy Mode
- **Route:** `/ar-anatomy` (already in App.tsx)
- **Access:** via navigation handler
- **File:** `components/ar/ARAnatomyMode.tsx`

### PANRE-LA Simulator
- **Route:** `/panre-la` (already in App.tsx)
- **Access:** via navigation handler
- **File:** `components/lifelong-learning/PANRELASimulator.tsx`

### Integrations Hub
- **Route:** `/integrations`
- **Access:** `onNavigateToIntegrations()` in MenuView
- **File:** `components/integrations/IntegrationsHub.tsx`

### Command Palette
- **Shortcut:** `Cmd+K` or `Ctrl+K`
- **Status:** Fully integrated
- **File:** `components/CommandPalette.tsx`

### Wellness Check Modal
- **Status:** Integrated in QuizView
- **Triggers:** Rapid questions, late night study
- **File:** `components/wellness/WellnessCheckModal.tsx`

### Circadian Analytics
- **Status:** Recording performance data
- **Location:** Called in QuizView on every answer
- **File:** `services/circadianAnalyticsService.ts`

### Root Cause Analysis
- **Status:** Displayed in MenuView dashboard
- **Visualization:** Donut chart of error types
- **File:** `components/ProgressDashboard/RootCauseAnalysis.tsx`

### Study Guide Generator
- **Status:** Accessible in MenuView
- **Function:** Exports weakness cheatsheets
- **File:** `components/StudyGuideGenerator.tsx`

## 🔧 Recommended Next Steps

### Priority 1: User-Facing Integrations
1. **Add RotationSelector to App.tsx header**
   - Place next to Settings button
   - Wire to MenuView filtering logic

2. **Add Failed Sync Items button to Settings**
   - Show badge count when items exist
   - Open FailedSyncItems modal

### Priority 2: Admin Features
1. **Add media script buttons to Admin Dashboard**
   - "Auto-Find Images" (runs mediaIntegrator.ts)
   - "Match Infographics" (runs infographicMatcher.ts)
   - Wrap scripts in API endpoints

### Priority 3: Conflict Resolution UI
1. **Enhance sync endpoint with version checks**
   - Compare client version vs server version
   - Prompt user to merge on conflict

2. **Add merge UI for conflicting data**
   - Show diff between versions
   - Allow user to choose which to keep

## 📝 Testing Checklist

### AI Content Generation
- [ ] Open ContentEditor
- [ ] Click "Generate with AI"
- [ ] Verify draft content appears
- [ ] Check database for draft record

### AI Tutor
- [ ] Answer a quiz question
- [ ] Click "Ask Tutor"
- [ ] Type a follow-up question
- [ ] Verify response appears

### Offline Sync
- [ ] Go offline
- [ ] Make changes (answer questions)
- [ ] Go back online
- [ ] Verify sync completes
- [ ] Force failure (invalid data)
- [ ] Check dead letter queue

### Rotation Selector
- [ ] Open selector dropdown
- [ ] Select a rotation
- [ ] Verify modes filter correctly

## 🐛 Known Issues

1. **Sync Test Failure:** One pre-existing test fails in `useUserStats.test.ts` (GET vs POST method mismatch) - unrelated to new features

2. **Training Mode Label:** Test expects "Medical Wordle" but finds "Daily Term Challenge" - pre-existing issue

## 📚 Additional Resources

- [API Documentation](./functions/api/README.md)
- [Admin CMS Guide](./ADMIN_CMS_IMPLEMENTATION.md)
- [Content Generation Guide](./CONTENT_GENERATION_GUIDE.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
