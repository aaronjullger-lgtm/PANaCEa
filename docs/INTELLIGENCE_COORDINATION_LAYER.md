# Intelligence Coordination Layer

**Purpose:** Connect all AI services to work together as a unified intelligence

**Date:** February 5, 2026

---

## Overview

The **Intelligence Coordination Layer** ensures all 13 AI services work together harmoniously, sharing context and coordinating responses to create a cohesive, intelligent system.

---

## The Problem: Siloed AI Services

**Without Coordination:**

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Voice AI     │  │ SOAP AI      │  │ Tutor AI     │
│ (Module 1)   │  │ (Module 4)   │  │ (All)        │
│              │  │              │  │              │
│ No context   │  │ No context   │  │ No context   │
│ sharing      │  │ sharing      │  │ sharing      │
└──────────────┘  └──────────────┘  └──────────────┘

Result: Inconsistent, fragmented experience
```

**With Coordination:**

```
┌─────────────────────────────────────────────────────────────────┐
│              INTELLIGENCE COORDINATOR                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SHARED CONTEXT POOL                                        │ │
│  │  - Clinical scenario (patient, vitals, findings)            │ │
│  │  - Conversation history (all interactions)                  │ │
│  │  - Performance metrics (scores, mistakes, timing)           │ │
│  │  - User preferences (hints, audio, haptic)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────┬──────────────────┬────────┘
                   │                  │                  │
         ┌─────────▼────────┐  ┌──────▼──────┐  ┌──────▼──────┐
         │ Voice AI         │  │ SOAP AI     │  │ Tutor AI    │
         │ (Consistent)     │  │ (Consistent)│  │ (Consistent)│
         └──────────────────┘  └─────────────┘  └─────────────┘

Result: Cohesive, context-aware intelligence
```

---

## Shared Context Pool

### What's Shared

```typescript
interface SharedContext {
  // 1. CLINICAL CONTEXT (All AI services reference same patient state)
  clinical: {
    patientAge: 55,
    patientSex: 'M',
    chiefComplaint: 'Chest pain',
    vitals: { hr: 110, bp: '140/90', o2: 94 },
    physicalFindings: ['Levine sign', 'Diaphoresis'],
    workingDiagnosis: 'Inferior STEMI',
    testsOrdered: ['ECG', 'Troponin'],
    imagingResults: ['ST-elevation in II, III, aVF']
  },

  // 2. CONVERSATION HISTORY (Voice AI, SOAP AI, Tutor all see same transcript)
  conversation: [
    { speaker: 'student', content: 'What brings you in?', timestamp: '08:10:00' },
    { speaker: 'patient', content: 'Terrible chest pain', timestamp: '08:10:03' },
    { speaker: 'student', content: 'Can you describe it?', timestamp: '08:10:05' },
    { speaker: 'patient', content: 'Crushing, right here [chest]', timestamp: '08:10:08' }
  ],

  // 3. PERFORMANCE METRICS (Tutor adapts hint level, UI shows progress)
  performance: {
    currentScore: 85,
    recentMistakes: [],
    weakAreas: ['ECG interpretation'],
    strengths: ['History taking', 'Communication'],
    hintsUsed: 2,
    timeOnTask: 405
  },

  // 4. USER PREFERENCES (All services respect same settings)
  preferences: {
    hintThreshold: 0.7,        // When to auto-offer help
    audioVisualizationType: 'vitality_meter',
    hapticEnabled: true,
    uiModePreference: 'focus'
  }
}
```

### Context Synchronization

```typescript
// Module 1 (OSCE) updates vitals
voiceSession.emit('vitals_updated', { o2: 86, hr: 125 });

// Intelligence Coordinator receives update
coordinator.updateContext(sessionId, {
  clinical: { vitals: { o2: 86, hr: 125 } }
});

// All services automatically notified:
// 1. Voice AI (Module 1): Update voice modulation (gasping)
// 2. Audio Viz (Module 4): Shift color to red
// 3. SOAP Generator (Module 4): Add "Patient became hypoxic"
// 4. UI (Module 5): Show critical alert
// 5. Phantom Patient (Module 5): No health change (clinical context separate)
```

---

## Coordinated Actions

### Example 1: Diagnosis Made

**Trigger**: Student makes diagnosis in OSCE

**Coordinated Response:**

```
1. Module 1 (OSCE):
   - Mark diagnosis in session
   - Emit DIAGNOSIS_MADE event

2. Intelligence Coordinator:
   - Receive event
   - Update shared context
   - Trigger coordinated actions

3. Module 4 (SOAP):
   - Finalize assessment section
   - Add diagnosis to SOAP note

4. Module 4 (Timing):
   - End "time_to_diagnosis" metric
   - Calculate efficiency score

5. Module 5 (UI):
   - Show success notification
   - Update progress indicator

6. AI Tutor:
   - Prepare confirmation/correction
   - Queue citations if diagnosis incorrect

7. Recommendation Engine:
   - Suggest: "Confirm with ECG" (Module 2)
   - Pre-load imaging module
```

**User Experience:**
```
Student: "I think this is an inferior STEMI."

[Instant coordinated response]
✅ Diagnosis recorded
💾 SOAP note updated
⏱️ Time to diagnosis: 6:45
🎯 Next: "Review ECG to confirm"
[Smooth transition to Clinical Eye]
```

### Example 2: Mistake Made

**Trigger**: Student confuses Erythema Nodosum with Erythema Migrans

**Coordinated Response:**

```
1. Module 2 (Clinical Eye):
   - Mark answer incorrect
   - Emit MISTAKE_MADE event

2. Intelligence Coordinator:
   - Track confusion pair
   - Trigger remediation

3. Module 4 (Infographic):
   - Generate comparison infographic
   - "Erythema Nodosum vs. Migrans"

4. AI Tutor:
   - Offer explanation with citations
   - "Nodosum = nodules on shins, Migrans = bulls-eye"

5. Module 5 (Learning):
   - Add to weak areas
   - Update recommendation: "Review dermatology"

6. Phantom Patient:
   - No immediate effect (clinical vs. learning context separated)
```

**User Experience:**
```
[Student selects wrong answer]

❌ Incorrect

[2 seconds later]
💡 Common confusion! Let me help.

[Infographic fades in]
"Erythema Nodosum vs. Erythema Migrans"
[Side-by-side comparison with key differences]

[AI Tutor sidebar updates]
"Here's why: Nodosum appears as tender nodules on the shins, 
associated with systemic diseases. Migrans is the bulls-eye 
rash of Lyme disease. Key difference: location and appearance."

📖 Harrison's Dermatology, Ch. 54
```

### Example 3: Critical Vital Change

**Trigger**: O2 drops below 88%

**Coordinated Response:**

```
1. Module 1 (OSCE):
   - State machine detects trigger
   - Transition to critical state

2. Intelligence Coordinator:
   - Emit VITALS_CRITICAL event
   - Update shared context

3. Module 1 (Voice):
   - Update voice modulation (gasping)
   - Update system prompt

4. Module 1 (Video):
   - Crossfade to critical state video

5. Module 4 (Audio Viz):
   - Shift color to red
   - Increase blur intensity
   - Trigger haptic alarm pattern

6. Module 5 (UI):
   - Show critical alert modal
   - Highlight O2 value in red

7. Module 4 (Timing):
   - Start "time_to_intervention" metric

8. AI Tutor:
   - Prepare emergency guidance
   - "Hypoxia detected. Immediate oxygen required."
```

**User Experience:**
```
[O2 drops to 86%]

[All coordinated within 200ms:]
🚨 Visual: Video crossfades to tripod position
🚨 Audio: Voice becomes gasping + background alarm
🚨 Visual: Vitality meter turns red
🚨 Haptic: Long alarm pulse
🚨 UI: Critical alert modal appears
🚨 Tutor: "Patient is hypoxic. Immediate action required."

[Student has all sensory cues aligned]
```

---

## Intelligence Routing

### Smart Next-Step Suggestions

```
[After OSCE with correct STEMI diagnosis]

┌──────────────────────────────────────────────────────────────┐
│  💡 RECOMMENDED NEXT STEPS                                   │
│                                                               │
│  Based on your performance, we recommend:                    │
│                                                               │
│  1. ⭐ Confirm with ECG (Module 2)                   [Start] │
│     Reinforce diagnosis with visual pattern recognition      │
│     Estimated time: 3 minutes                                │
│     Expected benefit: +10% ECG mastery                       │
│                                                               │
│  2. Practice Central Line (Module 3)                 [Start] │
│     You'll need vascular access for pressors                 │
│     Estimated time: 8 minutes                                │
│                                                               │
│  3. Skip to Review                                  [Skip]   │
│     View your performance analytics now                      │
│                                                               │
│  [Auto-continue in 10 seconds: Option 1]                     │
└──────────────────────────────────────────────────────────────┘
```

**Intelligence:**
- **Analyzes current performance** to suggest next activity
- **Considers weak areas** (if ECG interpretation < 70%, prioritize Module 2)
- **Natural flow** (OSCE → Imaging → Procedure is typical clinical flow)
- **Time-aware** (if late evening, suggest shorter activities)
- **Auto-continue** with countdown (can override)

### Adaptive Difficulty

```typescript
// Intelligence coordinator adjusts difficulty based on performance

if (recentAccuracy < 60%) {
  // Student struggling
  nextCase.difficulty = 'easier';
  nextCase.hintsAvailable = 'all_levels';
  uiRecommendation = 'Consider reviewing basics first';
}

if (recentAccuracy > 90%) {
  // Student mastering
  nextCase.difficulty = 'harder';
  nextCase.hintsAvailable = 'limited';
  uiRecommendation = 'Challenge yourself with complex cases';
}

if (consecutiveCorrect >= 10) {
  // Unlock achievement + suggest variety
  unlockBadge('diagnostic_ace');
  uiRecommendation = 'Try a different system to build breadth';
}
```

---

## Context-Aware Features

### Example: AI Tutor Knows Everything

**Student in Module 2 (Clinical Eye), struggling with ECG:**

```
AI Tutor Context:
- From Module 1: Patient is 55yo M with chest pain, diaphoresis, Levine sign
- From Module 1: Student asked about onset (sudden), character (crushing)
- From Module 1: Vitals show HR 110, BP 140/90
- From Module 1: Working diagnosis was "STEMI"
- From Module 2: Currently viewing ECG image
- From Module 2: Student has spent 45 seconds without clicking

Tutor Response:
"Looking at this ECG for your patient with crushing chest pain and 
diaphoresis, notice the ST-elevation in leads II, III, and aVF. This 
confirms your suspicion of inferior STEMI, likely from RCA occlusion.

Remember from the encounter: he had the Levine sign, which is highly 
specific (85%) for cardiac ischemia.

Next step: Click on the leads showing ST-elevation."

📖 Harrison's Ch. 296: "Inferior MIs are characterized by ST-elevation 
in the inferior leads (II, III, aVF)."
```

**Why This Is Powerful:**
- Tutor **references the OSCE encounter** (Levine sign, crushing pain)
- Tutor **understands current task** (identifying ST-elevation on ECG)
- Tutor **provides contextual guidance** (not generic)
- Tutor **cites textbook** relevant to both OSCE and imaging

### Example: SOAP Generator Knows Everything

**SOAP Generator Context:**

```
From Module 1 (Voice Interview):
- Transcript: 45 exchanges
- Questions asked: "When did it start?" "Describe the pain?" "Radiation?"
- Patient responses: "30 minutes ago" "Crushing, substernal" "To my left arm"

From Module 1 (Vitals):
- Initial: HR 110, BP 140/90, O2 94%
- Updated: HR 125, BP 90/60, O2 86% (decompensation)

From Module 2 (Imaging):
- ECG reviewed: ST-elevation in II, III, aVF
- Student identified: Inferior STEMI (correct)

From Module 3 (Procedure):
- Central line placed
- Geometry validation: 88/100
- Sterile field: Intact

Generated SOAP Note:
"55yo M with sudden onset crushing substernal chest pressure x 30 min,
radiating to L arm, associated with diaphoresis and nausea. No
relieving factors. Risk factors: HTN, DM, smoking (40 pack-years).

Presented to ED with HR 110, BP 140/90, O2 94%. Levine sign noted.
Subsequently developed hypotension (90/60) and hypoxia (86%), 
concerning for cardiogenic shock.

ECG: ST-elevation in leads II, III, aVF (inferior STEMI).
Troponin: 2.5 ng/mL (elevated).

Assessment: Inferior STEMI complicated by cardiogenic shock, likely
RCA occlusion with possible RV involvement.

Plan:
1. Emergent cath lab activation (door-to-balloon time: 45 min)
2. Dual antiplatelet therapy (ASA 325mg, clopidogrel 600mg)
3. Anticoagulation (heparin bolus + gtt)
4. Central venous access obtained for pressors
5. Cardiology consulted, patient accepted for emergent PCI"
```

**Intelligence:**
- **Synthesizes** information from 3 modules
- **Tracks state changes** (initial stable → decompensation)
- **Includes procedures performed** (central line)
- **Follows chronological order**
- **Uses medical terminology appropriately**

---

## Coordinated Service Architecture

### Service Coordination Matrix

| Event | Voice AI | SOAP AI | Tutor | Timing | Infographic | UI |
|-------|----------|---------|-------|--------|-------------|-----|
| **Diagnosis Made** | - | Finalize assessment | Confirm/correct | End metric | - | Show success |
| **Mistake Made** | - | - | Offer help | - | Generate visual | Show feedback |
| **Critical Vital** | Update voice | Add to note | Alert guidance | Start metric | - | Show alert |
| **Procedure Start** | - | Add to plan | Prep hints | Start metric | Pre-load steps | Transition |
| **Hint Requested** | - | - | Provide hint | Track | Maybe generate | Show sidebar |
| **Session End** | Close connection | Finalize note | Generate debrief | Calculate all | Generate summary | Show rewards |

### Real-Time Coordination Example

**Scenario:** Student asks AI Tutor about RV infarction during OSCE

```
1. Student clicks: "Ask AI Tutor: What is RV infarction?"

2. Intelligence Coordinator:
   - Gathers context from Module 1 (current patient, vitals, diagnosis)
   - Checks conversation history
   - Notes: Student is in OSCE, patient has inferior MI

3. AI Tutor:
   - Query ask_the_manual with full context
   - Response: "RV infarction complicates 30-50% of inferior MIs. 
     In your current patient with inferior STEMI, you should assess 
     for RV involvement by checking JVD and obtaining right-sided 
     ECG leads (V4R)."
   - Citations: Harrison's Ch. 296

4. Module 1 (Voice AI):
   - Coordinator notifies: "Tutor discussed RV involvement"
   - Voice AI updates context: Student is now aware of RV infarction
   - Next patient response can reference: "Do you want to check my neck?"

5. Module 4 (SOAP):
   - Coordinator notifies: "Student learning about RV involvement"
   - SOAP AI adds to plan: "Assess for RV involvement (JVD, V4R)"

6. Module 4 (Timing):
   - Track: Query latency 2.5s
   - Track: Time spent learning (30s)

7. Module 5 (UI):
   - Show tutor response in sidebar
   - Highlight "JVD assessment" in next actions
```

**Result**: All services **know the student asked about RV infarction** and adjust accordingly

---

## Context-Aware Intelligence

### Scenario Awareness

**Example: Tutor adapts to clinical urgency**

```
Stable scenario (COPD, O2 = 92%):
Tutor: "Let's discuss the pathophysiology of COPD exacerbation. 
       It involves..."
[Detailed, educational tone]

Critical scenario (COPD, O2 = 84%):
Tutor: "Patient is critically hypoxic. Immediate priorities:
       1. High-flow oxygen
       2. Albuterol nebulizer
       3. Steroids
       Don't delay for detailed history."
[Concise, action-oriented]
```

**Intelligence:**
- Tutor **reads vitals** from shared context
- Adapts **tone and content** to clinical urgency
- Prioritizes **action over education** when critical

### Performance-Aware Hints

```
Student performance: 85% (doing well)
Hint level: Subtle → "Think about cardiac risk factors"

Student performance: 55% (struggling)
Hint level: Explicit → "Order ECG now. Look for ST-elevation in II, III, aVF."
```

**Automatic adaptation** based on performance context

### Time-Aware Recommendations

```
Time: 9:00 AM (Peak hours, Focus Mode)
Recommendation: "Try a challenging OSCE case (STEMI + complications)"

Time: 7:00 PM (Off-hours, Review Mode)
Recommendation: "Review today's cases with audio podcast"

Time: 11:00 PM (Late night, Rest Mode)
Recommendation: "Quick 10-minute flashcard review, then rest"
```

**Respects** circadian profile from Module 5

---

## Multi-Service Queries

### Example: Complex Question Requiring Multiple Services

**Student asks:** "Why did my patient's blood pressure drop?"

**Services Invoked:**

```
1. ask_the_manual (AI Tutor):
   Query: "Causes of hypotension in acute MI"
   Context: Patient has inferior STEMI, BP dropped 140/90 → 90/60
   
2. echoscript (Timing):
   Context: What actions preceded BP drop?
   Finding: BP dropped 3 minutes after diagnosis, no intervention given
   
3. spatial-understanding (if ECG available):
   Context: Analyze ECG for RV involvement signs
   Finding: ST-elevation in III > II (suggests RV)
   
4. info_genius (Infographic):
   Generate: "Hypotension in Inferior MI: RV Infarction"
   
5. SOAP Generator:
   Update assessment: "Inferior STEMI complicated by cardiogenic shock 
   secondary to RV involvement"
```

**Response (Synthesized):**

```
AI Tutor: "Your patient's blood pressure dropped because of likely RV 
involvement in this inferior STEMI. Notice:

1. [Infographic displayed] RV infarction complicates 30-50% of inferior MIs
2. [ECG highlighted] ST-elevation is greater in lead III than lead II (classic sign)
3. [Timeline shown] BP dropped 3 minutes after diagnosis with no intervention

Management:
- AVOID nitrates (will worsen hypotension)
- Give IV fluids (RV is preload-dependent)
- Check JVD (elevated in RV infarction despite hypotension)
- Obtain V4R lead (ST-elevation confirms RV involvement)

📖 Citations:
[1] Harrison's Ch. 296: "RV infarction requires aggressive volume resuscitation"
[2] Your echo path shows you haven't assessed JVD yet - do that next."
```

**Intelligence:**
- **5 AI services coordinated** to answer one question
- **Multi-modal response** (text + infographic + timeline + citation)
- **Actionable** (clear next steps)
- **Contextual** (references student's echo path)

---

## Unified Analytics Dashboard

### Cross-Module Performance View

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 TODAY'S PERFORMANCE ACROSS ALL MODULES                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Radar Chart]                                            │  │
│  │         Clinical Competence: 88                           │  │
│  │              /            \                                │  │
│  │    Documentation: 85    Visual Diagnostics: 90            │  │
│  │              \            /                                │  │
│  │        Procedural Skills: 88                              │  │
│  │               \                                            │  │
│  │          Communication: 85                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Module Breakdown:                                              │
│  📌 Module 1 (OSCE): 88/100 - Excellent clinical reasoning     │
│  📌 Module 2 (Clinical Eye): 90/100 - Strong visual skills     │
│  📌 Module 3 (Sim Lab): 88/100 - Good procedural technique     │
│  📌 Module 4 (Documentation): 85/100 - Improve HPI completeness│
│  📌 Module 5 (Engagement): +50 XP, 1 badge unlocked           │
│                                                                  │
│  🎯 Composite Score: 88/100 (Excellent)                        │
│                                                                  │
│  💡 AI Insights:                                               │
│  • Strength: Fast recognition (45s to STEMI diagnosis)         │
│  • Improvement: Remember to assess JVD in inferior MI          │
│  • Next focus: Practice ECG interpretation                     │
└─────────────────────────────────────────────────────────────────┘
```

**Coordination:**
- **Aggregates** data from all 5 modules
- **Calculates** composite scores
- **AI-generated insights** from analysis across modules
- **Actionable recommendations** for improvement

---

## Seamless Workflows

### Example: Complete Clinical Encounter Flow

```
Module 1 (OSCE) → Module 2 (ECG) → Module 2 (CXR) → Module 3 (Chest Tube) → Module 4 (Review)
      ↓               ↓                ↓                    ↓                      ↓
  Interview      Confirm STEMI    Find PTX          Place tube            Debrief
  [8 minutes]    [2 minutes]      [2 minutes]       [8 minutes]          [5 minutes]
      ↓               ↓                ↓                    ↓                      ↓
  Context:       Context:         Context:          Context:             Context:
  Patient age    + ECG result     + PTX confirmed   + Procedure done     + All data
  CC, vitals     + STEMI dx       + Critical status + Sterile field OK   + Analytics
  Diagnosis                                                               + SOAP note
```

**Total time**: 25 minutes  
**Modules used**: 4  
**Context carried**: Seamlessly throughout  
**Experience**: Feels like one continuous clinical encounter

---

## Conclusion

The Intelligence Coordination Layer transforms PANaCEa from **5 separate modules** into a **unified, intelligent learning companion**. By sharing context, coordinating actions, and routing intelligently, the system feels cohesive, responsive, and remarkably smart.

**Key Benefits:**
1. **No repeated information** - Services share knowledge
2. **Consistent experience** - All AI services aligned
3. **Intelligent guidance** - Smart routing based on performance
4. **Seamless transitions** - Context preserved across modules
5. **Coordinated responses** - Multiple services react to single event

The result: A platform that **feels alive and aware**, not mechanical and fragmented.

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`
