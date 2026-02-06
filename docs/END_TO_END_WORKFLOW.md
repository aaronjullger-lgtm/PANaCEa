# PANaCEa: Complete End-to-End User Experience

**Date:** February 5, 2026  
**Status:** ✅ Complete Architecture

---

## The Complete Learning Loop

```
Login → Dashboard → Case Start → Interview → Exam/Labs → Procedure → Debrief → Remediation → Next Case
  ↓         ↓           ↓            ↓          ↓           ↓            ↓            ↓            ↓
Module 5  Module 5   Module 1    Module 1   Module 2   Module 3    Module 4    Module 4    AI Tutor
```

---

## Full Walkthrough: Acute MI Case

### Step 1: Login & Dashboard (Module 5)

**Technology**: `lumina` (Adaptive UI)

```
┌─────────────────────────────────────────────────────────────────┐
│  PANACEA DASHBOARD - Focus Mode (Peak Hours: 9 AM)             │
│                                                                  │
│  [Avatar: Student with short white coat]                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Phantom Patient: Sarah (Pneumonia)                       │  │
│  │  Health: █████████░ 92% (Stable)                         │  │
│  │  [Video: Patient sitting up, reading, comfortable]        │  │
│  │  Message: "Looking great! Keep up the studying."          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📚 Today's Rotation: Cardiology                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Retention Probability: 87% ✅                      │  │
│  │  │  [Progress bar: 87/100]                             │  │
│  │  │  💡 "You're ready for high-yield cases"            │  │
│  │  │  [Start OSCE Session]                               │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Recent Activity:                                               │
│  ✅ COPD case completed (Score: 85/100)                        │
│  ✅ 10-day study streak                                        │
│  🎵 [Audio Review Available: "Respiratory Weak Areas"]         │
└─────────────────────────────────────────────────────────────────┘
```

**UI Adaptation:**
- **Time**: 9 AM (Peak hours)
- **Mode**: Focus (High contrast, reduced animations, compact spacing)
- **Reasoning**: User is at peak cognitive performance
- **Metacognition Widget**: Retention probability inline with "Start" button

---

### Step 2: Case Start (Module 1)

**Technology**: `veo_cameos`, `voice-library`

```
┌─────────────────────────────────────────────────────────────────┐
│  OSCE SESSION: Case #47                                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Video: 55yo male in ED, clutching fist to chest         │  │
│  │   (Levine sign), grimacing, diaphoretic, cardiac monitor  │  │
│  │   visible in background]                                   │  │
│  │                                                             │  │
│  │  5-second seamless loop (veo_cameos)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Vitality Meter (Enhanced Audio Visualization)            │  │
│  │                                                             │  │
│  │     ████████                                                │
│  │    ██      ██     ← Blue/Yellow (O2=94%, HR=110)          │
│  │   ██   ●    ██                                             │
│  │    ██      ██      Pulse rate matches HR                   │
│  │     ████████                                                │
│  │                                                             │
│  │  [Haptic: Rhythmic pulse at 110 bpm]                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Vitals: HR 110 | BP 140/90 | O2 94% | RR 22 | Temp 98.6°F   │
│                                                                  │
│  [🎤 Connect Voice] [💬 Text Chat] [❓ Ask AI Tutor]          │
└─────────────────────────────────────────────────────────────────┘
```

**State Machine**: Initial state = `baseline_distress` (chest pain, diaphoresis)

---

### Step 3: Voice Interview (Module 1 + Module 4)

**Technology**: `native_audio_function_call_sandbox`, `gemini-dictation`

```
┌─────────────────────────────────────────────────────────────────┐
│  🎤 VOICE ACTIVE                              [Background: SOAP Note Drafting...]
│                                                                  │
│  [00:00] Student: "Hello Mr. Smith, what brings you in today?" │
│  [00:03] Patient: "I... I have terrible chest pain."           │
│          [Voice: Anxious, slightly breathless]                  │
│                                                                  │
│  [00:05] Student: "Can you describe the pain for me?"          │
│  [00:08] Patient: "It's... crushing. Right here." [touches chest]
│                                                                  │
│  [00:12] Student: "When did it start?"                         │
│  [00:14] Patient: "About 30 minutes ago. I was mowing the lawn."│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AI TUTOR (Sidebar - ask_the_manual)                      │  │
│  │  💡 Available if you need help                            │  │
│  │  [Ask Question]                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DRAFT SOAP NOTE (Real-time - gemini-dictation)          │  │
│  │  Subjective: 55yo M with sudden onset crushing            │  │
│  │  substernal chest pressure x 30 min, during exertion...   │  │
│  │  [Auto-updating every 5s]                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⏱️ Time Elapsed: 45s  |  Questions Asked: 3                  │
└─────────────────────────────────────────────────────────────────┘
```

**Background Processes:**
- **SOAP Note Generator**: Extracting HPI elements in real-time
- **Timing Analytics**: Tracking time to recognition
- **Echo Path**: Building conversation tree
- **State Machine**: Monitoring for trigger conditions

---

### Step 4: Student Orders ECG (Module 2 + AI Tutor)

**Technology**: `spatial-understanding`, `ask_the_manual`

```
┌─────────────────────────────────────────────────────────────────┐
│  DIAGNOSTIC WORKUP                                              │
│                                                                  │
│  [00:45] Student: "I need to order an ECG immediately."        │
│  [00:47] Patient: "Okay... is it serious?"                     │
│                                                                  │
│  ⏱️ Time to ECG Order: 45s ✅ (Target: < 10 min)              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ECG RESULT (Module 2: Point-and-Click)                   │  │
│  │                                                             │  │
│  │  [Interactive ECG Image]                                   │  │
│  │                                                             │  │
│  │  TASK: Click on the area showing ST-elevation             │  │
│  │                                                             │  │
│  │  [Student clicks on leads II, III, aVF]                   │  │
│  │  ✅ Correct! ST-elevation in inferior leads               │  │
│  │                                                             │  │
│  │  [Heatmap available - hover to reveal] (Penalty: -20pts)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Student asks AI Tutor: "What does inferior STEMI mean?"       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AI TUTOR RESPONSE (ask_the_manual)                       │  │
│  │                                                             │  │
│  │  "Inferior STEMI involves the inferior wall of the LV,    │  │
│  │  typically due to RCA occlusion. Key features:            │  │
│  │  - ST-elevation in leads II, III, aVF                     │  │
│  │  - May involve RV (check V4R)                             │  │
│  │  - Associated bradycardia (vagal response)                │  │
│  │                                                             │  │
│  │  Citations:                                                │  │
│  │  [1] Harrison's Principles, 21e, Ch. 296, p. 2053        │  │
│  │  [2] AHA 2023 STEMI Guidelines                            │  │
│  │                                                             │  │
│  │  Next step: Order troponin and prepare for cath lab."    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 5: Consult Request (Creative Feature)

**Technology**: `native_audio_function_call_sandbox` (different persona)

```
┌─────────────────────────────────────────────────────────────────┐
│  CONSULT SYSTEM                                                 │
│                                                                  │
│  [01:15] Student clicks: [📞 Call Cardiology Consult]          │
│                                                                  │
│  [Paging... 5 seconds]                                         │
│                                                                  │
│  [01:20] Dr. Johnson (Cardiologist): "Johnson here. Go."      │
│          [Voice: Hurried, professional, slightly impatient]    │
│                                                                  │
│  Student: "Hi Dr. Johnson, I have a 55-year-old male..."       │
│                                                                  │
│  Dr. Johnson: "SBAR format, please. I'm busy."                 │
│                                                                  │
│  Student: "Right. Situation: 55yo male with chest pain         │
│           x 30 minutes. Background: No prior cardiac hx,       │
│           risk factors HTN and smoking. Assessment: ECG        │
│           shows ST-elevation in II, III, aVF. Recommendation:  │
│           Activate cath lab?"                                  │
│                                                                  │
│  Dr. Johnson: "Good. Troponin?"                                │
│                                                                  │
│  Student: "Pending."                                            │
│                                                                  │
│  Dr. Johnson: "Activate cath lab. Give aspirin, heparin,       │
│              and call me with the trops. Out."                 │
│                                                                  │
│  [Call ended]                                                   │
│                                                                  │
│  SBAR Quality: 85/100 ✅                                       │
│  - Situation: Complete                                          │
│  - Background: Complete                                         │
│  - Assessment: Complete                                         │
│  - Recommendation: Clear                                        │
│  Feedback: "Excellent structured communication!"               │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- If student rambles > 45 seconds without SBAR: "Look, I don't have time for a story. SBAR, please."
- If student takes > 2 minutes: "I have to go. Page me when you have more info." [Hangs up]
- If student provides poor SBAR: Low score, feedback on missing elements

---

### Step 6: Student Realizes Need for Intervention (Module 1 State Transition)

```
┌─────────────────────────────────────────────────────────────────┐
│  CLINICAL STATE CHANGE                                          │
│                                                                  │
│  [Vitals Update Received]                                       │
│  O2 Sat: 94% → 88% (dropped)                                   │
│  HR: 110 → 125 (increased)                                      │
│  BP: 140/90 → 90/60 (hypotensive!)                            │
│                                                                  │
│  ⚠️ TRIGGER ACTIVATED: "cardiogenic_shock"                     │
│                                                                  │
│  STATE TRANSITION: baseline_distress → cardiogenic_shock        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Video crossfades with "medical scan" overlay]           │  │
│  │  New Video: Patient pale, diaphoretic, altered mental     │  │
│  │  status, multiple IV pumps, urgent scene                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Vitality Meter: [Shifts to RED]                          │  │
│  │  Background blur: Increases to 15px                       │  │
│  │  Haptic: ALARM pattern (long pulses)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Patient (Voice): "I... I feel dizzy..." [Gasping, rate=0.6]  │
│                                                                  │
│  🚨 CRITICAL: Time to intervention started                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 7: Procedure Decision (Module 3)

**Technology**: `bring_any_idea_to_life`, sterile field tracking

```
┌─────────────────────────────────────────────────────────────────┐
│  PROCEDURE: Central Line Placement (for pressors)              │
│                                                                  │
│  STEP 1: EQUIPMENT TRAY SETUP                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Equipment Bank: 30+ items]                              │  │
│  │  Drag items to tray:                                       │  │
│  │  ✅ Central line kit                                      │  │
│  │  ✅ Ultrasound machine                                    │  │
│  │  ✅ Sterile gown + gloves                                 │  │
│  │  ✅ Chlorhexidine                                         │  │
│  │  ✅ Lidocaine 1%                                          │  │
│  │  ❌ [Missing: Sterile drape] ⚠️                          │  │
│  │                                                             │  │
│  │  [Add Sterile Drape] → ✅ Tray Complete                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  STEP 2: LANDMARK IDENTIFICATION                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Image: Patient's neck]                                   │  │
│  │  TASK: Click on the apex of the SCM triangle              │  │
│  │  [Student clicks]                                          │  │
│  │  ✅ Correct! (2mm from ideal position)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  STEP 3: WORKFLOW ANIMATION (bring_any_idea_to_life)          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [15-second animation]                                     │  │
│  │  - Hand positioning                                        │  │
│  │  - Ultrasound probe placement                             │  │
│  │  - Needle insertion angle (30-45°)                        │  │
│  │  - [Slow motion during critical step]                     │  │
│  │  - Annotations: "Carotid", "IJV", "SCM"                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  STEP 4: STERILE FIELD SIMULATION                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Green overlay indicating safe zone]                     │  │
│  │  Instructions: Keep cursor within sterile field           │  │
│  │                                                             │  │
│  │  [Student's cursor approaches edge]                        │  │
│  │  ⚠️ [Yellow glow]: Approaching border                     │  │
│  │                                                             │  │
│  │  [Student keeps cursor inside]                             │  │
│  │  ✅ Sterile field maintained                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  STEP 5: INSERTION GEOMETRY                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [3D anatomy view with trajectory line]                   │  │
│  │  Entry angle: 35° ✅ (Ideal: 30-45°)                     │  │
│  │  Depth: 2.0cm ✅                                          │  │
│  │  Distance from carotid: 8mm ✅                            │  │
│  │  [Green trajectory - no avoidance zones hit]              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Procedure Score: 88/100 ✅                                    │
│  Time: 8 minutes (Target: 10-15 min)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 8: Debrief & Case File (Module 4)

**Technology**: `gemini-dictation`, `echoscript`, `echo_paths`, `info_genius`

```
┌─────────────────────────────────────────────────────────────────┐
│  POST-ENCOUNTER DEBRIEF                                         │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  📋 SOAP NOTE COMPARISON                                        │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  ┌─────────────────────┐       ┌─────────────────────────┐    │
│  │ YOUR NOTE           │       │ GOLD STANDARD           │    │
│  │ Score: 72/100       │       │ (AI-Generated)          │    │
│  ├─────────────────────┤       ├─────────────────────────┤    │
│  │ Subjective:         │       │ Subjective:             │    │
│  │ 55yo M with chest   │       │ 55yo M with sudden      │    │
│  │ pain                │       │ onset crushing          │    │
│  │ ❌ MISSING: Onset  │       │ substernal chest        │    │
│  │ ❌ MISSING: Character│      │ pressure x 30 min,      │    │
│  │ ❌ MISSING: Radiation│      │ radiating to L arm,     │    │
│  │                     │       │ during exertion,        │    │
│  │ Objective:          │       │ associated with         │    │
│  │ ✅ Vitals documented│       │ diaphoresis and nausea. │    │
│  │ ✅ Levine sign noted│       │ Risk factors: HTN, DM,  │    │
│  │ ❌ MISSING: JVD     │       │ smoking.                │    │
│  │                     │       │                         │    │
│  │ Assessment:         │       │ Objective:              │    │
│  │ ✅ STEMI (Correct!) │       │ Vitals: HR 110, BP      │    │
│  │                     │       │ 140/90, O2 94%          │    │
│  │ Plan:               │       │ Levine sign present     │    │
│  │ ✅ ECG ordered      │       │ JVD: Not elevated       │    │
│  │ ✅ Aspirin given    │       │                         │    │
│  │ ❌ MISSING: Heparin │       │ Assessment:             │    │
│  └─────────────────────┘       │ Inferior STEMI (RCA)    │    │
│                                │ DDx: PE, Aortic         │    │
│                                │ dissection              │    │
│                                │                         │    │
│                                │ Plan:                   │    │
│                                │ - Cath lab activation   │    │
│                                │ - ASA 325mg PO          │    │
│                                │ - Heparin bolus + gtt   │    │
│                                │ - Clopidogrel load      │    │
│                                └─────────────────────────┘    │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  ⏱️ TIMING ANALYTICS (echoscript)                              │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Key Metrics:                                                   │
│  - Time to Recognize STEMI: 45s ✅ (Target: < 60s)             │
│  - Time to ECG Order: 45s ✅                                   │
│  - Time to Aspirin: 90s ✅                                     │
│  - Total Session Time: 8 minutes                                │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  🌳 CONVERSATION TREE (echo_paths)                             │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  [Chief Complaint] ───────────────────┐                        │
│         │                              │                        │
│         ▼                              ▼                        │
│  [Describe pain] ✅            [Typical diet?] ❌              │
│   Green (Optimal)               Red (Rabbit hole, 3s wasted)   │
│         │                                                       │
│         ▼                                                       │
│  [When did it start?] ✅                                       │
│         │                                                       │
│         ▼                                                       │
│  [Order ECG] ✅                                                │
│                                                                  │
│  Efficiency Score: 83/100                                       │
│  Optimal Path: 5 steps                                          │
│  Your Path: 6 steps (1 rabbit hole)                            │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  🎯 PERSONALIZED PEARLS                                        │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  💡 MISSED FINDING: JVD Assessment                             │
│     Always assess JVD in inferior MI to detect RV involvement. │
│     RV infarction requires different management (avoid nitrates,│
│     give fluids).                                               │
│                                                                  │
│     📖 Harrison's Ch. 296: "RV infarction complicates 30-50%  │
│        of inferior MIs and requires aggressive volume          │
│        resuscitation rather than diuresis."                    │
│                                                                  │
│  💡 INEFFICIENT QUESTIONING: Diet History                     │
│     In acute chest pain, focus on OPQRST. Diet history is     │
│     low-yield in the acute setting.                            │
│                                                                  │
│  💡 TREATMENT GAP: Heparin                                     │
│     [Infographic Generated - info_genius]                      │
│                                                                  │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  STEMI Anticoagulation Protocol                      │   │
│     │                                                       │   │
│     │  Initial:                                             │   │
│     │  ├─ Aspirin 325mg PO (chewed)                        │   │
│     │  ├─ Clopidogrel 600mg PO (load)                      │   │
│     │  └─ Heparin 60 U/kg bolus → 12 U/kg/hr gtt          │   │
│     │                                                       │   │
│     │  Cath Lab:                                            │   │
│     │  └─ Continue heparin during PCI                      │   │
│     │                                                       │   │
│     │  Post-PCI:                                            │   │
│     │  └─ DAPT x 12 months                                 │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  🎖️ ACHIEVEMENTS UNLOCKED                                      │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  🏆 "The Code Blue Survivor" (Epic)                            │
│     Recognized and acted on cardiogenic shock in < 2 minutes    │
│     [SVG Badge Generated]                                       │
│                                                                  │
│  📈 Avatar Progression: +15 XP                                 │
│     Cardiology Mastery: 85% → 92%                              │
│     [Unlocked: Stethoscope accessory]                          │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  📥 CASE FILE EXPORT                                           │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Complete case file includes:                                   │
│  - Full transcript                                              │
│  - SOAP note comparison                                         │
│  - Timing analytics                                             │
│  - Echo path visualization                                      │
│  - Personalized pearls with infographics                       │
│  - AI tutor citations                                           │
│                                                                  │
│  [📄 Download PDF] [📊 View JSON] [📧 Email to Faculty]       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 9: Evening Review (Module 5 + Creative Features)

**Technology**: `lumina` (UI mode shift), `voice-library` (audio podcast)

**Time**: 7 PM (Low energy hours)

```
┌─────────────────────────────────────────────────────────────────┐
│  PANACEA DASHBOARD - Review Mode (Off-Hours: 7 PM)             │
│  [UI shifts to warmer tones, reduced contrast, softer colors]  │
│                                                                  │
│  [Avatar: Student with stethoscope (unlocked!)]                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Phantom Patient: Sarah (Pneumonia)                       │  │
│  │  Health: ████████░░ 82% (Stable → Improving!)            │  │
│  │  [Video: Patient resting comfortably, reading]            │  │
│  │  Message: "Thanks for practicing today! I'm feeling       │  │
│  │           much better."                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  🎵 NEW AUDIO REVIEW AVAILABLE (Audio-First Review)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  "Cardiology Weak Areas - 5 Minutes"                      │  │
│  │  Generated from your last 10 sessions                      │  │
│  │  Topics: RV infarction, JVD assessment, anticoagulation   │  │
│  │  [▶️ Play] [⏬ Download]                                   │  │
│  │  Perfect for your commute tomorrow!                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Today's Progress:                                              │
│  ✅ 1 OSCE completed (STEMI case, Score: 78/100)               │
│  ✅ 1 Procedure practiced (Central line, Score: 88/100)        │
│  ✅ 3 AI Tutor questions answered                              │
│  ✅ Study streak: 11 days                                      │
│                                                                  │
│  [Phantom Patient healed by +10 points]                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Integration Matrix

| Step | Module | Technology | Data Flow |
|------|--------|------------|-----------|
| **1. Login** | Module 5 | `lumina` | Circadian profile → UI theme |
| **2. Case Start** | Module 1 | `veo_cameos` | Case data → Video loop |
| **3. Interview** | Module 1 | `native_audio_function_call_sandbox`, `voice-library` | Audio ↔ Gemini |
| **3b. SOAP Draft** | Module 4 | `gemini-dictation` | Transcript → SOAP elements |
| **4. ECG Analysis** | Module 2 | `spatial-understanding` | Image → Point-and-click |
| **4b. Tutor Query** | AI Tutor | `ask_the_manual` | Question → Citations |
| **5. Consult** | Creative | `native_audio` (persona) | SBAR → Consultant response |
| **6. State Change** | Module 1 | State machine | Vitals → Trigger → Transition |
| **6b. Audio Viz** | Module 4 | `live_audio` | Vitals → Color/haptic |
| **7. Procedure** | Module 3 | `bring_any_idea_to_life` | Step → Animation |
| **8. Debrief** | Module 4 | `echoscript`, `echo_paths` | Session → Analytics |
| **8b. Infographic** | Module 4 | `info_genius` | Confusion → Visual aid |
| **9. Evening Review** | Module 5 | `lumina`, `voice-library` | Weak areas → Podcast |
| **9b. Phantom Update** | Creative | `veo_cameos` | Inactivity → Health decay |

---

## Data Flow Diagram

```
┌──────────────┐
│ User Login   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ LUMINA: Determine UI Mode (Peak hours → Focus Mode)      │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Dashboard: Show Phantom Patient + Metacognition Widgets  │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Start OSCE → VEO_CAMEOS: Generate patient video         │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Voice Interview → NATIVE_AUDIO: Stream to/from Gemini   │
│                   GEMINI-DICTATION: Draft SOAP note      │
│                   ECHOSCRIPT: Track questions            │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Student stumbles → ASK_THE_MANUAL: Query with citations │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Order ECG → SPATIAL-UNDERSTANDING: Point-and-click       │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Vitals worsen → STATE MACHINE: Trigger → Transition      │
│                 LIVE_AUDIO: Color shift + haptic alarm   │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Call Consult → NATIVE_AUDIO (Persona): Grumpy surgeon   │
│                Evaluate SBAR quality                      │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Procedure → BRING_ANY_IDEA_TO_LIFE: Workflow animation  │
│             Sterile field tracking                        │
│             Geometry validation                           │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Debrief → SOAP Comparison + Echo paths                   │
│            INFO_GENIUS: Generate comparison infographic   │
│            Generate PDF case file                         │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Avatar Update: Unlock stethoscope, +15 XP                │
│ Phantom Patient: Heal +10 health                         │
│ Badge: "Code Blue Survivor" unlocked                      │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Evening (7 PM) → LUMINA: Switch to Review Mode           │
│                  VOICE-LIBRARY: Generate podcast review   │
└──────────────────────────────────────────────────────────┘
```

---

## User Experience Timeline (Single Day)

| Time | Activity | Module | Technology |
|------|----------|--------|------------|
| **8:00 AM** | Login | Module 5 | lumina (Focus Mode activated) |
| **8:05 AM** | Check Dashboard | Module 5 | Phantom Patient healthy, 10-day streak |
| **8:10 AM** | Start OSCE (STEMI) | Module 1 | veo_cameos, native_audio |
| **8:15 AM** | Voice interview | Module 1 + 4 | native_audio, gemini-dictation (background) |
| **8:20 AM** | Order ECG | Module 2 | spatial-understanding |
| **8:22 AM** | Call Consult | Creative | native_audio (persona) |
| **8:25 AM** | Patient deteriorates | Module 1 | State machine transition |
| **8:30 AM** | Central line | Module 3 | bring_any_idea_to_life |
| **8:40 AM** | Session ends | Module 4 | Generate analytics |
| **8:45 AM** | Review SOAP comparison | Module 4 | Side-by-side display |
| **8:50 AM** | View infographic | Module 4 | info_genius (RV infarction) |
| **8:55 AM** | Download case file | Module 4 | PDF export |
| **9:00 AM** | Avatar updated | Module 5 | svg_generator (stethoscope unlocked) |
| **7:00 PM** | Evening login | Module 5 | lumina (Review Mode activated) |
| **7:05 PM** | Listen to podcast | Creative | voice-library (5-min review) |
| **11:00 PM** | Check dashboard | Module 5 | lumina (Rest Mode activated) |

---

## Psychological Design Principles

### 1. Phantom Patient (Subtle Motivation)

- **Week 1**: Patient healthy, smiling
- **Week 2** (3 days no study): Patient starts looking uncomfortable
- **Week 3** (7 days no study): Patient critical, monitors alarming
- **Week 4** (returns to study): Patient slowly heals, expresses gratitude

**Psychological Mechanism**: Social commitment, guilt avoidance, positive reinforcement

### 2. Audio-First Reviews (Convenience)

- **Problem**: Students don't have time to review weak areas
- **Solution**: 5-minute podcast they can listen to while driving/commuting
- **Content**: Top 5 missed questions, key teaching points, citations
- **Tone**: Conversational, motivational

### 3. Consult System (Communication Skills)

- **Problem**: Students don't practice concise professional communication
- **Solution**: AI consultant who demands SBAR format and hangs up if rambling
- **Outcome**: Forces clear, structured communication under pressure

### 4. Circadian UI (Cognitive Optimization)

- **Peak Hours (9 AM - 12 PM)**: Focus Mode (high contrast, minimal distractions)
- **Low Energy (2 PM - 4 PM)**: Review Mode (warmer tones, relaxed pacing)
- **Evening (7 PM - 10 PM)**: Review Mode (comfortable for passive review)
- **Late Night (10 PM+)**: Rest Mode (subdued, gentle nudge to sleep)

---

## Session Recording Example

### Input Data

```json
{
  "sessionId": "session-123",
  "userId": "user-456",
  "caseId": "stemi-001",
  "startTime": "2026-02-05T08:10:00Z",
  "endTime": "2026-02-05T08:40:00Z",
  "transcript": [
    { "speaker": "student", "text": "What brings you in today?", "timestamp": "08:10:00" },
    { "speaker": "patient", "text": "I have terrible chest pain", "timestamp": "08:10:03" }
  ],
  "vitalsHistory": [
    { "timestamp": "08:10:00", "vitals": { "hr": 110, "bp": "140/90", "o2": 94 } },
    { "timestamp": "08:25:00", "vitals": { "hr": 125, "bp": "90/60", "o2": 88 } }
  ],
  "studentActions": [
    { "action": "order_ecg", "timestamp": "08:10:45" },
    { "action": "administer_aspirin", "timestamp": "08:11:30" },
    { "action": "call_cardiology", "timestamp": "08:15:00" }
  ],
  "correctDiagnosis": "STEMI",
  "studentDiagnosis": "STEMI"
}
```

### Output: Automated Case File

```json
{
  "caseFileId": "casefile-123",
  "sessionId": "session-123",
  "case": {
    "patientName": "John Smith",
    "chiefComplaint": "Chest pain",
    "diagnosis": "Inferior STEMI",
    "specialty": "Cardiology"
  },
  "soapNotes": {
    "studentNote": { ... },
    "goldStandardNote": { ... },
    "comparison": {
      "scores": {
        "completeness": 72,
        "accuracy": 85,
        "overall": 78
      },
      "elementComparison": [
        {
          "section": "subjective",
          "elementType": "hpi.onset",
          "status": "missing",
          "feedback": "Missing onset: sudden onset 30 minutes ago",
          "severity": "critical"
        }
      ]
    }
  },
  "timingAnalytics": {
    "metrics": [
      {
        "name": "Time to recognize STEMI",
        "duration": 45,
        "target": 60,
        "status": "completed"
      }
    ],
    "echoPath": {
      "efficiencyScore": 83,
      "rabbitHoles": [
        {
          "content": "What's your typical diet?",
          "timeWasted": 3,
          "reason": "Excessive focus on lifestyle factors"
        }
      ]
    }
  },
  "clinicalPerformance": {
    "overallScore": 78,
    "categoryScores": {
      "history": 85,
      "physicalExam": 70,
      "diagnosis": 90,
      "management": 75
    }
  },
  "pearls": [
    {
      "category": "missed_finding",
      "title": "JVD Assessment in Inferior MI",
      "description": "Always assess JVD to detect RV involvement...",
      "infographic": {
        "imageUrl": "https://cdn.panacea.app/infographics/rv-infarction.svg",
        "title": "RV Infarction: Recognition and Management"
      }
    }
  ],
  "achievements": [
    {
      "badgeId": "code-blue-survivor",
      "unlockedAt": "2026-02-05T08:40:00Z"
    }
  ],
  "exportFormats": {
    "pdf": "https://cdn.panacea.app/case-files/casefile-123.pdf",
    "json": "https://api.panacea.app/case-files/casefile-123.json"
  }
}
```

---

## Conclusion

This end-to-end workflow demonstrates how **all 5 modules + AI Tutor + creative features** work together to create a cohesive, immersive learning experience:

1. **Adaptive UI** adjusts to cognitive state (peak vs. off-hours)
2. **Phantom Patient** provides subtle motivation
3. **Voice-responsive patient** with dynamic video transitions
4. **Real-time SOAP generation** removes documentation burden
5. **Point-and-click diagnostics** replace static MCQ
6. **Procedural simulation** with sterile field and geometry validation
7. **Consult system** trains communication skills
8. **Timing analytics** reveal efficient vs. wasteful questioning
9. **Dynamic infographics** address specific confusion points
10. **Audio reviews** enable hands-free studying
11. **Achievement system** rewards progress
12. **Comprehensive case files** as learning artifacts

The result is a **complete clinical simulation ecosystem** that rivals physical simulation labs at **1/100th the cost** while providing **personalized, data-driven feedback** impossible with human faculty alone.

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`
