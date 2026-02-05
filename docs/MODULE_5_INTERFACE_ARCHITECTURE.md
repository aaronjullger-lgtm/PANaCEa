# Module 5: Interface Fabric & Gamification Architecture

**Version:** 1.0.0  
**Date:** February 5, 2026  
**Status:** ✅ Design Complete - Implementation Pending

---

## Table of Contents

1. [Overview](#overview)
2. [Circadian UI (lumina)](#circadian-ui)
3. [Avatar & Progression System](#avatar-progression)
4. [Achievement Badges](#achievement-badges)
5. [Phantom Patient System](#phantom-patient-system)
6. [Audio-First Reviews](#audio-first-reviews)
7. [Consult System](#consult-system)
8. [Metacognition Widgets](#metacognition-widgets)
9. [Implementation Guide](#implementation-guide)

---

## Overview

**Module 5** is the **interface fabric** that makes PANaCEa feel alive and personalized. It adapts to user circadian rhythms, gamifies progression, and provides creative engagement features.

**Core Purpose**: Create an adaptive, engaging, personalized interface that enhances learning

**Key Technologies:**
- `lumina`: Adaptive dashboard aesthetics
- `svg_generator`: Avatar and badge generation
- `veo_cameos`: Phantom patient videos
- `voice-library`: Audio podcast generation

---

## Circadian UI (lumina)

### Concept

**Traditional Approach**: Static theme (light/dark toggle)

**PANaCEa Approach**: Dynamic UI that adapts to user's circadian rhythm and cognitive state

### UI Modes

| Mode | When | Characteristics | Use Case |
|------|------|-----------------|----------|
| **Focus** | Peak hours (9 AM - 12 PM) | High contrast, minimal blur, reduced animations, compact spacing | Deep study, OSCE sessions, challenging cases |
| **Review** | Low energy (2-4 PM, 7-9 PM) | Warmer tones, softer contrast, full animations, relaxed spacing | Passive review, podcasts, flashcards |
| **Rest** | Late evening (10 PM+) | Subdued colors, low saturation, gentle animations, maximum spacing | Light reading, gentle nudge to sleep |
| **Standard** | Other times | Balanced | Default mode |

### Example: Focus Mode vs. Review Mode

**Focus Mode (9 AM):**

```css
--color-bg-primary: #0a0e27;     /* Dark blue-black */
--color-text-primary: #f8fafc;   /* High contrast white */
--contrast: 120%;
--saturation: 90%;
--blur-intensity: 0px;
--animation-duration: 0.1s;      /* Reduced motion */
```

**Review Mode (7 PM):**

```css
--color-bg-primary: #1e1b29;     /* Warm purple-black */
--color-text-primary: #fef3c7;   /* Warm yellow-white */
--contrast: 100%;
--saturation: 110%;
--blur-intensity: 8px;           /* Soft blur */
--animation-duration: 0.3s;      /* Full animations */
```

### Implementation

```typescript
const uiService = createAdaptiveUIService();

// Get user's circadian profile from DB
const profile: UserCircadianProfile = {
  userId: 'user-123',
  peakHours: [9, 10, 11],
  lowEnergyHours: [14, 15],
  preferredStudyTimes: [
    { dayOfWeek: 1, startHour: 9, endHour: 12 },  // Monday 9-12
    { dayOfWeek: 3, startHour: 14, endHour: 17 }  // Wednesday 2-5
  ],
  timezone: 'America/New_York',
  updatedAt: '2026-02-05T00:00:00Z'
};

// Determine UI mode
const mode = uiService.determineUIMode(profile, new Date());
// → Returns "focus" if current time is 9 AM

// Get theme config
const theme = uiService.getThemeConfig(mode);

// Apply to DOM
uiService.applyTheme(theme);
```

---

## Avatar & Progression System

### Concept

**Traditional Approach**: Static profile picture

**PANaCEa Approach**: Evolving avatar that reflects mastery progression

### Progression Stages

| Stage | Requirements | Visual | Accessories Available |
|-------|--------------|--------|----------------------|
| **Student Year 1** | Onboarding complete | Short white coat | None |
| **Student Year 2** | 50% system mastery | Short white coat | Stethoscope (on 1 system 100%) |
| **Clinical Year** | 75% system mastery | Long white coat | Badge, lapel pins |
| **Graduate** | 90% system mastery | Long white coat | Multiple pins, tools |
| **Practicing PA** | 100% mastery + 100-day streak | Scrubs option | Full equipment |

### Accessory Unlocks

```typescript
const AVATAR_MILESTONES = {
  stethoscope: {
    name: 'Stethoscope',
    requirement: 'Cardiology 100% mastery',
    svgPath: '...'
  },
  long_coat: {
    name: 'Long White Coat',
    requirement: '80% all systems mastery',
    svgPath: '...'
  },
  cardiology_pin: {
    name: 'Cardiology Mastery Pin',
    requirement: 'Cardiology 100% + 10 OSCE cases passed',
    svgPath: '...'
  },
  trauma_shears: {
    name: 'Trauma Shears',
    requirement: 'Emergency Medicine 100%',
    svgPath: '...'
  }
};
```

### SVG Generation

```typescript
// Generate avatar with accessories
const avatar: UserAvatar = {
  id: 'avatar-user-123',
  userId: 'user-123',
  stage: 'clinical_year',
  baseSvg: '<svg>...</svg>',
  equippedAccessories: [
    AVATAR_MILESTONES.long_coat,
    AVATAR_MILESTONES.stethoscope,
    AVATAR_MILESTONES.cardiology_pin
  ],
  unlockedAccessories: [/* all unlocked */],
  metadata: {
    createdAt: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-02-05T00:00:00Z',
    totalAccessories: 12,
    progressPercentage: 75
  }
};

const svgMarkup = await gamificationService.generateAvatarSVG(avatar);
// → Returns layered SVG with coat, stethoscope, and pin
```

---

## Achievement Badges

### Rarity Tiers

| Rarity | Color | Unlock Rate | Examples |
|--------|-------|-------------|----------|
| **Common** | Gray | 50-70% | "First OSCE", "10 Questions Answered" |
| **Uncommon** | Green | 30-50% | "Perfect SOAP Note", "5-Day Streak" |
| **Rare** | Blue | 10-30% | "10 Correct Diagnoses in a Row" |
| **Epic** | Purple | 5-10% | "Code Blue Survivor (< 2 min)" |
| **Legendary** | Gold | < 5% | "100-Day Streak", "All Systems 100%" |

### Example Badges

**1. The Code Blue Survivor (Epic)**

```typescript
{
  id: 'code-blue-survivor',
  name: 'The Code Blue Survivor',
  category: 'clinical_performance',
  description: 'Recognized and intervened in cardiac arrest in < 2 minutes',
  criteria: {
    type: 'time_to_action',
    threshold: 120  // 2 minutes
  },
  rarity: 'epic',
  svgBadge: '<svg><!-- Purple badge with heart and lightning --></svg>'
}
```

**2. 100-Day Streak Warrior (Legendary)**

```typescript
{
  id: 'streak-warrior-100',
  name: '100-Day Streak Warrior',
  category: 'study_consistency',
  description: 'Studied for 100 consecutive days without missing a day',
  criteria: {
    type: 'study_streak',
    threshold: 100
  },
  rarity: 'legendary',
  svgBadge: '<svg><!-- Gold badge with flame --></svg>'
}
```

**3. Diagnostic Ace (Rare)**

```typescript
{
  id: 'diagnostic-ace',
  name: 'Diagnostic Ace',
  category: 'clinical_performance',
  description: '10 correct diagnoses in a row across different systems',
  criteria: {
    type: 'correct_diagnoses',
    threshold: 10
  },
  rarity: 'rare',
  svgBadge: '<svg><!-- Blue badge with magnifying glass --></svg>'
}
```

---

## Phantom Patient System

### Concept

**Inspiration**: Tamagotchi + Duolingo owl

**Implementation**: A "ghost patient" visible in the background of the dashboard who "ages" or "heals" based on study activity

### Health States

| State | Health Range | Video | Message | Trigger |
|-------|--------------|-------|---------|---------|
| **Healthy** | 80-100% | Sitting up, smiling, reading | "Looking great! Keep studying." | Daily study |
| **Stable** | 60-79% | Resting comfortably | "Doing okay, but could use attention." | 1-2 days inactive |
| **Declining** | 40-59% | Uncomfortable, restless | "Not feeling well. When was your last session?" | 3-5 days inactive |
| **Critical** | 1-39% | Severe distress, alarming | "I really need help! You haven't studied in a while!" | 6+ days inactive |
| **Recovered** | 100% | Discharged, waving | "Fully recovered! Your consistency paid off." | Return to daily study |

### Health Mechanics

- **Decay Rate**: -5 points per day of inactivity
- **Healing Rate**: +10 points per study session
- **Visual Feedback**: Video regenerates when crossing state thresholds

### Example: 7-Day Inactivity

```
Day 0: Health = 100% (Healthy) - "Looking great!"
Day 1: Health = 95% (Healthy)
Day 2: Health = 90% (Healthy)
Day 3: Health = 85% (Healthy)
Day 4: Health = 80% (Healthy → Stable transition)
        [Video regenerates: Now resting in bed, less energetic]
        Message: "Doing okay, but could use your attention."
Day 5: Health = 75% (Stable)
Day 6: Health = 70% (Stable)
Day 7: Health = 65% (Stable)
Day 8: Health = 60% (Stable → Declining transition)
        [Video regenerates: Uncomfortable, worried expression]
        Message: "Not feeling well. When was your last study session?"

[Student logs in and completes 1 session]
Day 8: Health = 60 + 10 = 70% (Stable)
        Message: "Thank you! I'm feeling a bit better already."
```

### Psychological Design

- **Subtle**: No aggressive notifications, just gentle visual presence
- **Positive Reinforcement**: Patient heals when you study
- **Social Commitment**: "Someone" is counting on you
- **Non-Intrusive**: Lives in corner of dashboard, not in your face

---

## Audio-First Reviews

### Concept

**Problem**: Students don't have time to review weak areas

**Solution**: 5-minute AI-generated podcast summarizing recent mistakes, playable during commute

### Generation Process

1. **Analyze Last N Sessions** (default: 50 questions or 10 OSCE cases)
2. **Identify Weak Areas** (systems with < 70% accuracy)
3. **Extract Top Missed Questions** (most impactful for learning)
4. **Generate Script** (conversational, educational tone)
5. **Synthesize Audio** (using `voice-library` with pleasant, clear voice)
6. **Deliver to User** (downloadable, streamable)

### Example Script

```
[Opening]
"Welcome to your personalized PANaCEa review podcast. In this 5-minute session, 
we'll review your recent performance and focus on your weak areas.

[Weak Areas]
Your main areas for improvement are: Cardiology differential diagnosis, 
ECG interpretation, and STEMI management.

[Question 1]
Recently, you confused STEMI and NSTEMI. Here's the key difference:

STEMI shows ST-elevation on ECG and represents complete coronary occlusion. 
This requires immediate cath lab activation. Door-to-balloon time should be 
under 90 minutes.

NSTEMI shows ST-depression or T-wave inversion and represents partial occlusion. 
This is managed medically first, with cath within 24-72 hours.

Remember: Elevation = Emergency.

[Question 2]
You also missed the importance of assessing JVD in inferior MI...

[Teaching Point]
Harrison's Principles reminds us: "RV infarction complicates 30-50% of 
inferior MIs and requires volume resuscitation, not diuretics."

[Closing]
Great work on your 10-day study streak! Keep it up. Next recommended case: 
Right ventricular infarction. Talk to you soon!"
```

### Voice Configuration

```typescript
const podcastVoice = {
  voiceId: 'Aoede',  // Pleasant, educational voice
  rate: 1.0,         // Normal pace
  tone: 'educational'
};
```

### Usage

```typescript
const podcast = await gamificationService.generateAudioReview(
  userId,
  ['Cardiology', 'ECG interpretation'],
  missedQuestions
);

// podcast.audioUrl → https://cdn.panacea.app/podcasts/user-123-2026-02-05.mp3
// podcast.duration → 300 seconds (5 minutes)
```

---

## Consult System

### Concept

**Problem**: Students don't practice concise professional communication (SBAR)

**Solution**: AI consultant personas who demand structured communication or "hang up"

### Consultant Personas

#### 1. Dr. Johnson (Cardiologist) - Busy

```typescript
{
  name: 'Dr. Johnson',
  type: 'cardiologist',
  personality: 'busy',
  voice: {
    voiceId: 'Puck',
    rate: 1.2,  // Fast talker
    toneDescriptors: ['hurried', 'professional', 'impatient']
  },
  behavior: {
    patienceThreshold: 45,      // Hangs up after 45s if rambling
    requiresSBAR: true,
    interruptsIfRambling: true,
    asksClarifyingQuestions: true
  }
}
```

#### 2. Dr. Martinez (Surgeon) - Grumpy

```typescript
{
  name: 'Dr. Martinez',
  type: 'surgeon',
  personality: 'grumpy',
  voice: {
    voiceId: 'Charon',
    rate: 0.9,
    pitch: -1,
    toneDescriptors: ['gruff', 'direct', 'no-nonsense']
  },
  behavior: {
    patienceThreshold: 30,      // Even less patient
    requiresSBAR: true,
    interruptsIfRambling: true,
    asksClarifyingQuestions: false  // Just wants facts
  }
}
```

### SBAR Evaluation

**Expected Elements:**

- **Situation**: Age, sex, chief complaint, acute change
- **Background**: Relevant PMH, medications, allergies
- **Assessment**: Your clinical impression
- **Recommendation**: What you want from the consultant

**Example: Good SBAR**

```
Student: "Dr. Johnson, I have a 55-year-old male presenting with 
crushing substernal chest pain times 30 minutes.

Background: No prior cardiac history, but risk factors include 
hypertension, diabetes, and 40 pack-year smoking history.

Assessment: ECG shows ST-elevation in leads II, III, and aVF, 
consistent with inferior STEMI.

Recommendation: I'd like to activate the cath lab and start 
dual antiplatelet therapy. Do you agree?"

Score: 95/100 ✅
Feedback: "Excellent SBAR format! Clear, concise, actionable."
```

**Example: Poor SBAR**

```
Student: "So, um, I have this patient who came in today with chest 
pain, and he was mowing his lawn, and he's had hypertension for a 
while, and he smokes, and I think maybe it's his heart, so I was 
wondering if maybe we should do something about it?"

Dr. Johnson: "SBAR format, please. I'm busy."

[Student continues rambling]

Dr. Johnson: "Look, I don't have time for a story. Page me when you 
can present clearly." [Hangs up]

Score: 35/100 ❌
Feedback: "Missing SBAR structure. Recommendation unclear. Too much 
extraneous detail."
```

### Implementation

```typescript
// Request consult
const consult = await gamificationService.requestConsult(
  sessionId,
  studentId,
  'cardiologist',
  CONSULTANT_PERSONAS.cardiologist
);

// [Voice conversation via native_audio with different persona]

// Evaluate SBAR
const evaluation = gamificationService.evaluateSBAR(
  consult.sbar,
  {
    situation: ['age', 'sex', 'chief complaint', 'acute change'],
    background: ['pmh', 'risk factors'],
    assessment: ['clinical impression', 'diagnosis'],
    recommendation: ['requested action']
  }
);

// evaluation.score → 85
// evaluation.feedback → "Good SBAR. Consider adding troponin result."
```

---

## Metacognition Widgets

### Concept

**Traditional Approach**: Stats hidden in analytics tab

**PANaCEa Approach**: Embed metacognition directly into study flow

### Widget Types

| Widget | Purpose | Position | Update Frequency |
|--------|---------|----------|------------------|
| **Retention Probability** | Show FSRS retention estimate | Inline next to "Start Quiz" | Daily |
| **Mastery Progress** | System-by-system mastery | Dashboard cards | Real-time |
| **Time to Review** | When next review due | Card badge | Real-time |
| **Weak Areas** | Systems needing attention | Alert banner | Per session |
| **Study Streak** | Consecutive study days | Header | Daily |
| **Performance Trend** | 7-day trend | Dashboard chart | Daily |
| **Confidence Calibration** | Confidence vs. accuracy | Post-question | Per question |

### Example: Retention Probability Widget

```
┌────────────────────────────────────────────────────────────┐
│  📚 Cardiology Review                                      │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Retention Probability: 87% ✅                      │   │
│  │  [Progress bar: ████████░]                         │   │
│  │  💡 "You're ready for high-yield cases"            │   │
│  │                                                     │   │
│  │  [Start OSCE Session]                              │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

**Psychological Impact**: Student sees they're ready, increases confidence, clicks "Start"

### Example: Weak Areas Alert

```
┌────────────────────────────────────────────────────────────┐
│  ⚠️ WEAK AREA DETECTED                                    │
│  Pulmonology accuracy has dropped to 68% (was 82%)        │
│  Recommended: Review 15 questions today                    │
│  [Start Pulmonary Review]                                  │
└────────────────────────────────────────────────────────────┘
```

---

## Integration with Existing Modules

### Module 1 (OSCE) + Module 5

- **Phantom Patient**: Heals +10 health after OSCE completion
- **Avatar**: +15 XP after OSCE
- **Badges**: "Code Blue Survivor" if time < 2 min
- **UI**: Focus Mode during active session

### Module 2 (Clinical Eye) + Module 5

- **Avatar**: Unlock "Radiology Badge" after 20 point-and-click correct
- **Badges**: "Eagle Eye" for 95% accuracy
- **UI**: Standard Mode for visual tasks

### Module 3 (Sim Lab) + Module 5

- **Avatar**: Unlock "Trauma Shears" after 5 procedures
- **Badges**: "Sterile Ace" for 0 contaminations
- **UI**: Focus Mode for procedures (high concentration)

### Module 4 (Smart Scribe) + Module 5

- **Phantom Patient**: Heals +5 per complete SOAP note
- **Badges**: "Documentation Master" for 10 perfect SOAP notes
- **Audio Review**: Generated from Module 4 analytics

---

## File Manifest

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **Types** | `types/interface-fabric-system.ts` | 750 | All Module 5 types |
| **Adaptive UI** | `services/ui/adaptiveUIService.ts` | 420 | lumina integration |
| **Gamification** | `services/gamification/gamificationService.ts` | 580 | Avatar, badges, phantom, consult |
| **Documentation** | `docs/MODULE_5_INTERFACE_ARCHITECTURE.md` | 1,200 | This document |
| **End-to-End** | `docs/END_TO_END_WORKFLOW.md` | 1,400 | Complete workflow |

**Total**: ~4,350 lines

---

## Implementation Roadmap

### Phase 1: Circadian UI (Week 1)

- [ ] Implement AdaptiveUIService
- [ ] Create 4 UI mode themes (Focus, Review, Rest, Standard)
- [ ] Test lumina API integration
- [ ] Deploy circadian detection
- [ ] User preference override UI

### Phase 2: Avatar System (Week 2)

- [ ] Design 12 accessories (coat, stethoscope, pins, tools)
- [ ] Implement progression milestones
- [ ] Test svg_generator API
- [ ] Create avatar customization UI
- [ ] Deploy progression tracking

### Phase 3: Achievement System (Week 3)

- [ ] Define 30 achievement badges
- [ ] Implement badge unlock logic
- [ ] Generate badge SVGs (svg_generator)
- [ ] Create achievement notification UI
- [ ] Deploy badge display (profile + dashboard)

### Phase 4: Creative Features (Week 4)

- [ ] Implement Phantom Patient system
- [ ] Generate 5 phantom patient videos (veo_cameos)
- [ ] Implement audio podcast generator (voice-library)
- [ ] Build consult system with 5 personas
- [ ] Test SBAR evaluation

### Phase 5: Metacognition Widgets (Week 5)

- [ ] Implement 7 widget types
- [ ] Integrate with FSRS retention calculations
- [ ] Create widget positioning system
- [ ] A/B test widget effectiveness
- [ ] Deploy to production

---

## Success Metrics

### Engagement

| Metric | Target |
|--------|--------|
| **Daily Active Users** | +30% (vs. no gamification) |
| **Session Duration** | +20% |
| **Streak Retention** | > 60% maintain 7-day streak |
| **Avatar Engagement** | > 70% customize avatar |

### Learning

| Metric | Target |
|--------|--------|
| **Retention Improvement** | +15% (with circadian UI) |
| **Completion Rate** | > 90% (vs. 75% without gamification) |
| **Weak Area Review** | 80% follow podcast recommendations |

### Satisfaction

| Metric | Target |
|--------|--------|
| **UI Satisfaction** | > 8.5/10 |
| **Phantom Patient Appeal** | > 7/10 |
| **Audio Review Usage** | > 40% of users |
| **Consult System Rating** | > 8/10 |

---

## Conclusion

Module 5 transforms PANaCEa from a functional platform into a **living, personalized learning companion**. The circadian UI optimizes cognitive performance, the avatar system provides tangible progression, and creative features (Phantom Patient, Audio Reviews, Consult System) increase engagement and retention.

**Key Innovations:**
1. **Adaptive UI** based on circadian rhythm and cognitive state
2. **Evolving avatar** reflecting clinical mastery
3. **Achievement system** with rarity tiers
4. **Phantom Patient** as subtle motivator
5. **Audio-first reviews** for hands-free learning
6. **Consult system** for communication skills
7. **Metacognition widgets** embedded in workflow

**Status**: ✅ Design Complete - Ready for Implementation

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`
