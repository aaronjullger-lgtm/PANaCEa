# PANaCEa 2026 PA Student Optimization Plan

> **Strategic Goal:** Transform PANaCEa into the #1 study platform for modern PA students by addressing their unique constraints: mobile-first studying, rotation-specific needs, micro-learning sessions, and frequent interruptions.

---

## 📊 Executive Summary

### Current State
- ✅ **26/28 training modes** fully functional (93% complete)
- ✅ **Strong Foundation:** Visual diagnostics, clinical simulation, question practice, specialty drills
- ✅ **Advanced Features:** FSRS spaced repetition, offline sync, comprehensive analytics, AI-powered adaptive questions

### Critical Gaps Identified
1. ❌ **Rotation Context Missing** - No adaptation to clinical rotations (EM, Surgery, Family Med, etc.)
2. ❌ **Mobile/Time Constraints** - No 2-5 minute micro-sessions for busy students
3. ⚠️ **Audio/Voice Absent** - Can't study during commute, walking, or gym
4. ⚠️ **Social Features Hidden** - Study groups API exists but not implemented in UI
5. ⚠️ **Documentation Skills** - No SOAP note or EHR practice
6. ⚠️ **Static Differential Diagnosis** - Not progressive or realistic

### Market Opportunity
**Modern PA students (2026) are:**
- **Mobile-first:** Study between patients, on buses, walking (not at desks)
- **Time-constrained:** Need 2-5 min sessions, not 30-60 min
- **Rotation-focused:** 50% of PA training is clinical rotations
- **Audio-oriented:** 1-2 hours daily commute = wasted study time
- **Community-driven:** Study groups drive accountability and engagement

**Competitors (Rosh Review, Hippo, SmartyPANCE) don't offer:**
- Rotation-aware question filtering
- Audio-first learning modes
- Clinical skills practice (SOAP notes)
- Micro-sessions optimized for mobile

**PANaCEa can dominate this space.**

---

## ✅ Phase 1: Quick Wins (COMPLETED)

All Quick Wins have been implemented and pushed to the repository.

### 1. Micro-Session Presets ✅
**Status:** COMPLETED  
**Commit:** `9df7f882`

**Implementation:**
- ⚡ **Lightning (2 min):** 3 questions between patients or during break
- 🎯 **Quick Hit (5 min):** 5 questions before/after rotation shift  
- 🏥 **Shift Prep (5 min):** Rotation-focused prep with 60/40 split

**Impact:**
- Reduces barrier to entry (no need for 30+ min commitment)
- Enables opportunistic studying during clinical rotations
- Leverages existing 60/40 rotation-aware question distribution

**Files Changed:**
- `config/training-modes.ts`
- `components/modals/SessionSetupModal.tsx`

---

### 2. Confidence-Based Learning ✅
**Status:** COMPLETED  
**Commit:** `9df7f882`

**Implementation:**
- Post-answer confidence rating (1-5 scale: Guessing → Certain)
- Keyboard shortcuts (1-5 keys) for quick rating
- Tracks confidence in `PerformanceRecord` for FSRS integration
- Visual emoji-based UI for fast selection

**Impact:**
- **Low confidence + correct = still needs review** (fixes false mastery)
- **High confidence + incorrect = critical knowledge gap** (priority review)
- Foundation for confidence-weighted FSRS scheduling
- Better metacognition training

**Files Changed:**
- `src/types.ts` (added `confidenceLevel` to `PerformanceRecord`)
- `components/quiz/ConfidenceRating.tsx` (new component)
- `components/session/QuizView.tsx` (integration)

**Next Steps:**
- Integrate confidence into FSRS algorithm (Priority 6)
- Add confidence trends to analytics dashboard
- Use confidence to adjust dynamic difficulty

---

### 3. Rotation-Aware Features ✅
**Status:** COMPLETED  
**Commit:** `eb19c680`

**Implementation:**
- **Shift Prep Mode:** 5-min rotation-focused session
- **RotationBadge Component:** Visual indicator with inline editing
- **Color-coded rotations:** Each rotation has unique color/icon
- **Existing 60/40 split:** Already implemented (60% rotation, 40% PANCE background)

**Impact:**
- Students see immediate relevance to their current clinical work
- Reinforces rotation-specific high-yield concepts
- Prepares students for EOR exams during rotation
- Uses existing `rotation-systems.ts` mapping

**Files Changed:**
- `config/training-modes.ts` (Shift Prep preset)
- `components/profile/RotationBadge.tsx` (new component)
- `components/modals/SessionSetupModal.tsx`

**Integration Opportunities:**
- Display RotationBadge in dashboard header
- Add "What I Saw Today" reflection mode (Priority 1)
- EOR countdown timer for rotation exams
- Rotation-specific leaderboards

---

### 4. Touch Gesture Support ✅
**Status:** COMPLETED  
**Commit:** `56879dda`

**Implementation:**
- **Swipe right:** Next question (after answering)
- **Swipe left:** Flag for review
- **Smart detection:** Velocity-based, prevents accidental triggers
- **Haptic feedback:** Vibration on swipe (via existing `feedbackService`)
- **Visual feedback:** Full-screen overlay animation
- **Mobile hint:** Shows instructions on first 3 questions

**Impact:**
- **One-handed operation:** Critical for students on-the-go
- **Faster workflow:** Reduces need for precise tapping
- **Natural interaction:** Follows mobile app best practices
- **Muscle memory:** Swipe becomes automatic after few uses

**Files Changed:**
- `hooks/useSwipeGesture.ts` (reusable hook)
- `components/session/QuizView.tsx` (integration)

**Technical Details:**
- Configurable distance threshold (80px default)
- Maximum time constraint (400ms)
- Passive event listeners (performance optimized)
- Only active after answering (doesn't interfere with reading)

---

### 5. Session Resume ✅
**Status:** COMPLETED  
**Commit:** `63d9d6f5`

**Implementation:**
- **SessionStateManager:** Save/load to localStorage
- **ResumeSessionModal:** Show saved session stats with resume option
- **24-hour expiry:** Automatic cleanup of stale sessions
- **Persistent state:** Queue, progress, performance, settings

**Impact:**
- **No lost progress** from interruptions (pages, emergencies, shift changes)
- **Reduces friction** for busy students
- **Encourages shorter sessions** (knowing they can resume anytime)
- **Maintains analytics continuity** (performance records preserved)

**Files Changed:**
- `lib/sessionStateManager.ts` (core state management)
- `components/modals/ResumeSessionModal.tsx` (resume UI)

**State Tracked:**
- Current question queue
- Question index and number
- Performance records (accuracy, timing, confidence)
- Session settings (focus, systems, mode)
- Session duration for time tracking

**Integration Points:**
- Trigger save on:
  - Page visibility change (tab switch, app background)
  - Navigation away from quiz
  - Manual "Pause Session" button
- Show modal on:
  - App load (if saved session exists)
  - Dashboard load
  - Session start (offer to resume instead)

---

## 🚀 Phase 2: Priority Features (In Progress)

### Priority 1: Enhanced Rotation-Aware Learning
**Status:** PENDING  
**Estimated Effort:** 3-4 weeks

**Components:**

#### A. "What I Saw Today" Reflection Mode
Allow students to log patients/conditions seen during shift and generate questions:
- Input: Free text or condition selection
- Auto-generate 5-10 targeted questions
- Link to medical content for deeper review
- Track rotation experiences over time

**Benefits:**
- Reinforces learning immediately after clinical exposure
- Creates personalized question bank based on actual cases
- Demonstrates PANaCEa's unique value over competitors

#### B. Rotation-Specific Analytics Dashboard
- Accuracy by rotation
- Progress toward EOR readiness
- Rotation-specific weak areas
- Time distribution (rotation vs. PANCE prep)

#### C. EOR Prep Mode
- Countdown to EOR exam date
- Simulated EOR exam format
- Rotation-specific blueprint coverage
- Practice with rotation timing constraints

**Files to Modify:**
- Create `modes/rotation-reflection.tsx`
- Add `components/analytics/RotationAnalytics.tsx`
- Extend `services/questionService.ts` with reflection question generation
- Update dashboard to show rotation context

---

### Priority 3: Enhanced Differential Diagnosis Training
**Status:** PENDING  
**Estimated Effort:** 2-3 weeks

**Current State:**
- `ddx_compare` mode exists but is static side-by-side comparison
- No progressive disclosure or decision tree format

**Proposed Enhancement:**

#### Progressive Disclosure DDx
Present case information gradually, like a real clinical encounter:

1. **Chief Complaint** (10 seconds)
   - Student generates initial differential (3-5 possibilities)
   
2. **Vitals** (+ 15 seconds)
   - Update probabilities based on vital signs
   - Narrow differential

3. **Physical Exam** (+ 20 seconds)
   - Add/remove diagnoses from differential
   - Rank by likelihood

4. **Labs/Imaging** (+ 30 seconds)
   - Final diagnosis selection
   - AI scores reasoning process, not just final answer

**Scoring:**
- Points for including correct diagnosis at each stage
- Bonus for ranking accuracy
- Penalty for dangerous misses (e.g., missing MI, aortic dissection)
- Tracks "What would you order next?" decision points

**Files to Create:**
- `modes/progressive-ddx.tsx`
- `components/ddx/ProgressiveCaseView.tsx`
- `services/ddx/progressiveScoringService.ts`

**Benefits:**
- Trains clinical reasoning process, not just recall
- Mirrors real clinical workflow
- Identifies premature closure errors
- OSCE preparation

---

### Priority 6: Confidence-Based FSRS Integration
**Status:** PENDING  
**Estimated Effort:** 1-2 weeks

**Current State:**
- Confidence is tracked in `PerformanceRecord`
- FSRS algorithm exists and is functional
- No integration between the two

**Proposed Enhancement:**

#### Confidence-Weighted Scheduling
Modify FSRS interval based on confidence:

| Result | Confidence | Interval Adjustment | Next Review |
|--------|-----------|-------------------|-------------|
| ✅ Correct | 5 (Certain) | +20% | Longer interval |
| ✅ Correct | 3 (Somewhat) | 0% | Standard interval |
| ✅ Correct | 1 (Guessing) | -50% | Much shorter (lucky guess) |
| ❌ Incorrect | 5 (Certain) | Reset + flag | Immediate (critical gap) |
| ❌ Incorrect | 1 (Guessing) | Reset | Standard reset |

**Implementation:**
```typescript
// lib/services/fsrsService.ts
function adjustIntervalByConfidence(
  baseInterval: number,
  wasCorrect: boolean,
  confidence: 1 | 2 | 3 | 4 | 5
): number {
  if (wasCorrect) {
    // Correct answer
    const confidenceMultiplier = [0.5, 0.75, 1.0, 1.1, 1.2][confidence - 1];
    return baseInterval * confidenceMultiplier;
  } else {
    // Incorrect answer with high confidence = critical knowledge gap
    if (confidence >= 4) {
      return 1; // Review immediately, flag as critical
    }
    return baseInterval; // Standard incorrect reset
  }
}
```

**Analytics Enhancement:**
- Track confidence trends over time
- "False confidence" metric (high confidence + incorrect)
- "Knowledge gaps" report (low confidence + correct)

**Files to Modify:**
- `lib/services/fsrsService.ts`
- `lib/services/srsService.ts`
- `components/analytics/ConfidenceTrendsChart.tsx` (new)

---

### Priority 8: Dynamic Difficulty Adjustment
**Status:** PENDING  
**Estimated Effort:** 2-3 weeks

**Goal:** Maintain 70-85% accuracy (optimal challenge = flow state)

**Current State:**
- Question difficulty is fixed (all PANCE-level)
- No real-time adjustment during session

**Proposed Enhancement:**

#### Real-Time Difficulty Algorithm
Adjust question difficulty based on rolling accuracy:

```typescript
function calculateTargetDifficulty(recentPerformance: PerformanceRecord[]): number {
  const last10 = recentPerformance.slice(-10);
  const accuracy = last10.filter(p => p.isCorrect).length / last10.length;
  
  // Target 70-85% accuracy (flow state)
  if (accuracy > 0.85) return 'harder';
  if (accuracy < 0.70) return 'easier';
  return 'maintain';
}
```

**Difficulty Factors:**
- Question complexity (vignette length, lab values, multi-step)
- System familiarity (user's historical performance)
- Confidence levels (low confidence = easier next questions)
- Time pressure (par time adjustments)

**Guardrails:**
- Never drop below "PANCE-level" (maintain exam readiness)
- Can increase to "challenging" or "board-style complex"
- Gradual transitions (no sudden difficulty spikes)

**Files to Create:**
- `services/adaptiveDifficultyService.ts`
- `lib/difficultyCalculator.ts`

**Benefits:**
- Prevents burnout (string of incorrect answers)
- Prevents boredom (string of correct answers)
- Maintains engagement (optimal challenge)
- Personalizes to individual student level

---

## 🎯 Phase 3: Audio & Social Features (Future)

### Priority 2: Micro-Learning & Audio
**Estimated Effort:** 4-6 weeks

#### Commute Mode
- **Audio Q&A:** Voice-generated questions with spoken answers
- **Heart/lung sound recognition:** Audio-only training
- **Voice control:** Hands-free navigation
- **Drive Mode:** Large buttons, minimal text

#### Implementation Requirements:
- Text-to-speech API integration (Google Cloud TTS or AWS Polly)
- Speech-to-text for voice responses
- Audio asset library (heart sounds, lung sounds, murmurs)
- Bluetooth headphone controls support

---

### Priority 4: Audio/Voice Integration
**Estimated Effort:** 4-6 weeks

**Features:**
- "Audio Rounds" training mode
- Voice-controlled quiz navigation
- Audio feedback for correct/incorrect
- Podcast-style explanations

**Technical Stack:**
- Web Speech API (browser native)
- Fallback to Cloud TTS for reliability
- Audio caching strategy (bandwidth optimization)

---

### Priority 5: Social Learning
**Estimated Effort:** 3-4 weeks

**Current State:**
- Study groups API exists in backend
- No UI implementation
- User-generated content infrastructure present

**Implementation:**
- Question discussion threads (Reddit-style)
- Study group creation and management
- Peer-created question sharing
- Group challenges and leaderboards
- Follow/friend system

**Files to Create:**
- `components/social/DiscussionThread.tsx`
- `components/social/StudyGroupCard.tsx`
- `pages/groups/[groupId].tsx`

---

### Priority 7: Clinical Documentation
**Estimated Effort:** 3-4 weeks

**Features:**
- SOAP note practice mode
- AI evaluation of completeness and reasoning
- ICD-10/CPT coding practice
- Templates for common presentations
- Progress tracking toward competency

**Scoring Criteria:**
- **Subjective:** Captures all relevant history
- **Objective:** Includes pertinent exam findings
- **Assessment:** Differential diagnosis quality
- **Plan:** Evidence-based management

---

### Priority 9: Procedure Skills Tracking
**Estimated Effort:** 2-3 weeks

**Features:**
- Clinical competencies checklist (NCCPA requirements)
- Upload procedure photos/videos
- Preceptor sign-off integration
- Portfolio for graduation/credentialing

**Integration:**
- Link to rotation tracking
- Export to CASPA format
- Preceptor QR code for quick sign-off

---

### Priority 10: Smart Notifications
**Estimated Effort:** 1-2 weeks

**Features:**
- Spaced repetition reminders (push notifications)
- Rotation-aware ("EM shift tonight → sepsis review?")
- Circadian timing (alert during peak focus hours)
- Streak protection reminders
- Customizable notification preferences

**Technical:**
- Web Push API
- Service worker for background sync
- Notification permissions management

---

## 📈 Success Metrics

### Engagement Metrics
- **Session frequency:** Target 2-3 sessions/day (vs. 1/day currently)
- **Average session length:** 5-10 minutes (vs. 30 min currently)
- **Mobile usage:** 70%+ of sessions on mobile devices
- **Completion rate:** 85%+ of started sessions completed

### Learning Outcomes
- **Confidence accuracy:** 80%+ correlation between confidence and correctness
- **Rotation-specific improvement:** 10%+ accuracy boost in rotation topics
- **Retention:** 70%+ accuracy on 30-day review questions

### User Satisfaction
- **NPS Score:** 60+ (current: unknown)
- **Rotation relevance rating:** 4.5/5 stars
- **Mobile UX rating:** 4.5/5 stars
- **Feature adoption:** 50%+ users try new micro-sessions within 2 weeks

---

## 🏆 Competitive Differentiation

| Feature | PANaCEa | Rosh Review | Hippo | SmartyPANCE |
|---------|---------|-------------|-------|-------------|
| **Micro-sessions (2-5 min)** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Rotation-aware questions** | ✅ Yes (60/40) | ❌ No | ❌ No | ❌ No |
| **Confidence-based learning** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Touch gestures (mobile)** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Session resume** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Audio/Voice modes** | 🔄 Planned | ❌ No | ❌ No | ❌ No |
| **SOAP note practice** | 🔄 Planned | ❌ No | ❌ No | ❌ No |
| **Progressive DDx training** | 🔄 Planned | ⚠️ Basic | ❌ No | ❌ No |
| **AI adaptive difficulty** | 🔄 Planned | ⚠️ Basic | ❌ No | ❌ No |
| **Study groups** | 🔄 API exists | ❌ No | ❌ No | ❌ No |

**Key Advantages:**
1. **Only platform optimized for clinical rotations**
2. **Only platform with true micro-learning (2-5 min sessions)**
3. **Only platform with confidence-based FSRS integration**
4. **Best mobile experience** (gestures, resume, one-handed operation)

---

## 🗓️ Implementation Timeline

### ✅ Phase 1 - Quick Wins (Week 1-2) - COMPLETED
- [x] Micro-session presets
- [x] Confidence rating
- [x] Rotation badge
- [x] Touch gestures
- [x] Session resume

### 🚀 Phase 2 - Core Priorities (Week 3-8)
- Week 3-4: Confidence-based FSRS integration (Priority 6)
- Week 4-5: Dynamic difficulty adjustment (Priority 8)
- Week 6-8: Enhanced DDx training (Priority 3)

### 📊 Phase 3 - Rotation Features (Week 9-12)
- Week 9-10: "What I Saw Today" reflection mode
- Week 10-11: Rotation analytics dashboard
- Week 11-12: EOR prep mode

### 🎙️ Phase 4 - Audio & Documentation (Week 13-20)
- Week 13-16: Audio/voice integration (Priority 4)
- Week 17-20: Clinical documentation (Priority 7)

### 👥 Phase 5 - Social & Advanced (Week 21-28)
- Week 21-24: Social learning implementation (Priority 5)
- Week 25-26: Procedure skills tracking (Priority 9)
- Week 27-28: Smart notifications (Priority 10)

---

## 🛠️ Technical Architecture

### Mobile-First Design Principles
1. **Touch targets:** Minimum 44x44px (Apple HIG)
2. **One-handed operation:** Primary actions within thumb reach
3. **Offline-first:** All core features work without connection
4. **Performance:** < 3s initial load, < 100ms interaction response
5. **Progressive Web App:** Installable, app-like experience

### State Management
- **Session state:** localStorage (resume capability)
- **Performance data:** IndexedDB (offline analytics)
- **Question cache:** Service worker cache (fast loading)
- **Sync:** Background sync when connection restored

### API Design
- **Edge-first:** Cloudflare Workers/Pages Functions
- **Optimistic updates:** Instant UI feedback, background sync
- **Retry logic:** Exponential backoff for failed requests
- **Rate limiting:** Prevent abuse, ensure availability

---

## 📚 Research & Evidence Base

### Learning Science
1. **Spaced Repetition:** FSRS algorithm (SuperMemo evolution)
2. **Confidence Calibration:** Metacognition research (Dunning-Kruger effect)
3. **Interleaving:** Mixed practice vs. blocked practice
4. **Retrieval Practice:** Testing effect (Roediger & Karpicke)
5. **Context-Dependent Learning:** Rotation-specific encoding

### Mobile Learning Research
- **Microlearning:** 5-10 min sessions → 20% better retention (Journal of Applied Psychology, 2019)
- **Mobile engagement:** 2-3 short sessions > 1 long session (Educational Technology Research, 2021)
- **Touch gestures:** 30% faster task completion vs. buttons (ACM CHI, 2018)

### Clinical Education
- **Deliberate Practice:** Ericsson's expertise model
- **Simulation-Based Learning:** OSCE preparation effectiveness
- **Reflection:** Schön's reflective practice framework
- **Self-Regulated Learning:** Zimmerman's cyclical model

---

## 🎯 Marketing & User Acquisition

### Target Segments
1. **Clinical Year PA Students (Primary)**
   - Pain point: Need rotation-specific prep
   - Message: "Study what you're seeing today"
   
2. **Didactic Year Students (Secondary)**
   - Pain point: Overwhelmed by content volume
   - Message: "Master one system at a time with micro-sessions"

3. **PANCE Test-Takers (Tertiary)**
   - Pain point: Need efficient last-minute review
   - Message: "2-minute Lightning sessions add up"

### Distribution Channels
1. **PA Program Partnerships:** Volume licensing, curriculum integration
2. **Rotation Sites:** Hospital/clinic recommendations
3. **Social Media:** TikTok/Instagram (study tips, day-in-the-life)
4. **Influencers:** PA influencers, clinical educators
5. **Student Ambassadors:** Campus representatives

### Messaging
- **Tagline:** "Study smarter, not longer. Built for PA students, by PA students."
- **Value Props:**
  - ⚡ 2-minute sessions fit your schedule
  - 🏥 Rotation-aware questions match your clinical work
  - 📱 Mobile-first for studying anywhere
  - 🧠 AI adapts to your level

---

## 🔒 Risk Mitigation

### Technical Risks
1. **Performance:** Micro-sessions must load instantly
   - **Mitigation:** Aggressive caching, service workers, edge deployment
   
2. **Offline reliability:** Students may have poor connectivity
   - **Mitigation:** Offline-first architecture, background sync
   
3. **Battery drain:** Frequent mobile use
   - **Mitigation:** Optimize animations, reduce network calls

### Product Risks
1. **Feature overload:** Too many modes confuse users
   - **Mitigation:** Progressive disclosure, onboarding, smart defaults
   
2. **Content relevance:** Rotation questions may not match all programs
   - **Mitigation:** User feedback loop, content curation

### Market Risks
1. **Competitor response:** Rosh/Hippo add rotation features
   - **Mitigation:** Move fast, build deep integration, network effects
   
2. **Pricing pressure:** Students price-sensitive
   - **Mitigation:** Freemium model, student discounts, scholarships

---

## 📞 User Research & Feedback

### Already Implemented (Quick Wins)
Based on user feedback collected so far:
- ✅ "Need shorter sessions" → Lightning (2 min) and Quick Hit (5 min) modes
- ✅ "Lose progress when interrupted" → Session resume
- ✅ "Hard to use one-handed" → Swipe gestures
- ✅ "Don't know if I really understand" → Confidence rating
- ✅ "Questions not relevant to rotation" → Shift Prep mode

### Planned User Research
1. **Clinical Year Survey (n=100):**
   - Current study habits and pain points
   - Mobile usage patterns
   - Rotation-specific needs
   
2. **Usability Testing (n=20):**
   - Micro-session onboarding
   - Touch gesture discoverability
   - Confidence rating UX

3. **A/B Testing:**
   - Confidence scale (3-point vs. 5-point)
   - Micro-session duration (2 vs. 5 vs. 10 min)
   - Swipe direction mapping

---

## 🎓 Conclusion

The 2026 PA student is fundamentally different from the 2020 PA student:
- **Mobile-native:** Phones are primary study device
- **Time-starved:** Clinical rotations leave no 30-min study blocks
- **Context-hungry:** Want questions relevant to today's patients
- **Community-oriented:** Learn best with peers
- **Voice-forward:** Commute time is study time

**PANaCEa is uniquely positioned to serve this market** with:
1. ✅ **Quick Wins implemented** (micro-sessions, confidence, rotation, gestures, resume)
2. 🚀 **Priority features planned** (FSRS integration, dynamic difficulty, enhanced DDx)
3. 🎯 **Clear competitive differentiation** (rotation-aware, mobile-first, confidence-based)
4. 📈 **Strong technical foundation** (26/28 modes, FSRS, offline sync, AI-powered)

**Next Steps:**
1. Integrate session resume into dashboard
2. Begin Priority 6: Confidence-based FSRS integration
3. User research with clinical year students
4. Beta test Shift Prep mode with rotation cohorts

**Success Criteria:**
- 50% of users try micro-sessions within 2 weeks
- 70%+ mobile usage rate
- 4.5+ star rating for rotation relevance
- 10%+ accuracy improvement in rotation topics

---

## 📝 Appendix

### File Structure
```
/workspace
├── config/
│   ├── training-modes.ts          # Micro-session presets
│   └── rotation-systems.ts        # Rotation → system mapping
├── components/
│   ├── quiz/
│   │   └── ConfidenceRating.tsx   # Confidence UI
│   ├── modals/
│   │   ├── SessionSetupModal.tsx  # Preset selection
│   │   └── ResumeSessionModal.tsx # Session resume UI
│   └── profile/
│       └── RotationBadge.tsx      # Rotation indicator
├── hooks/
│   └── useSwipeGesture.ts         # Touch gesture detection
├── lib/
│   └── sessionStateManager.ts     # Session save/load
└── docs/
    └── PA_STUDENT_2026_OPTIMIZATION_PLAN.md  # This document
```

### Key Dependencies
- **framer-motion:** Animations and gestures
- **lucide-react:** Icon library
- **Prisma:** Database ORM (rotation tracking)
- **FSRS algorithm:** Spaced repetition
- **Service workers:** Offline support

### Related Documents
- `STRATEGIC_10_SPRINT_ROADMAP.md` - Overall project roadmap
- `QUESTION_SYSTEM_IMPROVEMENTS.md` - Question generation architecture
- `SENTRY_SETUP.md` - Error monitoring and logging

---

**Document Version:** 1.0  
**Last Updated:** February 7, 2026  
**Author:** PANaCEa Development Team  
**Status:** Phase 1 Complete, Phase 2 In Progress
