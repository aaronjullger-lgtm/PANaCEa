# PANaCEa: Complete Multi-Modal Simulation System

**Date:** February 5, 2026  
**Branch:** `cursor/patient-encounter-state-machine-7530`  
**Status:** ✅ Architecture Complete - Ready for Implementation

---

## Overview

A comprehensive **event-driven, multi-modal clinical simulation platform** integrating:

1. **Module 1**: Living Patient Encounter (Voice + Video + Clinical State Machine)
2. **Module 2**: Clinical Eye (Interactive Visual Diagnostics)
3. **Module 3**: Digital Sim Lab (Procedural Simulation)
4. **AI Tutor System**: RAG-based tutoring with textbook citations

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE LAYER                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ AI Tutor (ask_the_manual)                                     │  │
│  │ - Harrison's Principles, Cecil Medicine, CMDT                 │  │
│  │ - PANCE Review Materials, Clinical Guidelines                 │  │
│  │ - RAG with citations                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Grounded Knowledge
                                 │
┌─────────────────────────────────┼───────────────────────────────────┐
│                        SIMULATION MODULES                            │
│                                 │                                    │
│  ┌─────────────────┐   ┌────────▼───────┐   ┌──────────────────┐  │
│  │  Module 1       │   │  Module 2      │   │  Module 3        │  │
│  │  Living Patient │   │  Clinical Eye  │   │  Digital Sim Lab │  │
│  │                 │   │                │   │                  │  │
│  │  - Voice (Gemini│   │  - Veo Videos  │   │  - Workflows     │  │
│  │    Audio)       │   │  - Point&Click │   │  - Equipment Tray│  │
│  │  - Video (Veo)  │   │  - Heatmaps    │   │  - Sterile Field │  │
│  │  - State Machine│   │  - Spatial-    │   │  - Geometry      │  │
│  │  - Triggers     │   │    Understanding│   │    Validation    │  │
│  └─────────────────┘   └────────────────┘   └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Analytics
                                 │
┌─────────────────────────────────▼───────────────────────────────────┐
│                     INVISIBLE PRECEPTOR                              │
│  - Clinical reasoning pathways (echo_paths)                         │
│  - Time-to-action metrics (echoscript)                              │
│  - Multi-modal performance tracking                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### Module 1: The Living Patient Encounter

**Purpose**: Affective, voice-responsive patients with dynamic audio-visual states

**Key Technologies:**
- `native_audio_function_call_sandbox` (Gemini Multimodal Live)
- `veo_cameos` (Dynamic video loops)
- `voice-library` (Diverse voice models)

**Core Innovation**: JSON State Machine mapping clinical triggers → AV states

**Example:**

```
O2 sat drops to 86% → Trigger "hypoxia_severe" → State: "severe_hypoxia"
  ↓
  Voice: Gasping, rate=0.7, pitch=+2
  Video: Tripod position, accessory muscle use
  Prompt: "You can only speak 2-3 words at a time"
```

**Deliverables:**
- 730-line type system (`types/patient-av-state-machine.ts`)
- 520-line runtime engine (`services/av/patientAVEngine.ts`)
- 380-line video service (`services/av/veoCameosService.ts`)
- 420-line Durable Object (`worker/src/PatientVoiceSession.ts`)
- 1,100-line architecture doc
- 600-line quick start guide

**Status**: ✅ Design Complete

---

### Module 2: The Clinical Eye

**Purpose**: Interactive visual diagnostics replacing static multiple-choice

**Key Technologies:**
- `veo_cameos` (Standardized patient videos with physical findings)
- `spatial-understanding` (AI-generated heatmaps for radiology/pathology)

**Core Features:**

1. **Standardized Patient Videos**
   - Levine sign, tripod position, facial droop, etc.
   - Dynamic backgrounds (ED, clinic, home)
   - 5-second seamless loops

2. **Point-and-Click Diagnostics**
   - "Click on the pneumothorax line" (not A/B/C/D)
   - Pixel-level accuracy scoring
   - Distance-based partial credit

3. **Reveal-on-Hover Heatmaps**
   - AI-generated probability overlays
   - Hover 2 seconds → fade in to 40% opacity
   - -20 point penalty for using hint

4. **Comparative Anatomy**
   - Side-by-side normal vs. abnormal
   - Slider, overlay, or blink toggle modes

**Example:**

```
Question: Identify the pneumothorax on this chest X-ray.

[Interactive Image]
- Student clicks at (x: 0.68, y: 0.25)
- System calculates distance from finding
- Feedback: "Excellent! You correctly identified the pleural line."

Hover Hint Available (penalty: -20 points)
```

**Deliverables:**
- 520-line type system (`types/clinical-eye-system.ts`)
- Comprehensive examples (pneumothorax, Levine sign)

**Status**: ✅ Design Complete

---

### Module 3: The Digital Sim Lab

**Purpose**: Procedural simulation with sterile field tracking and geometry validation

**Key Technologies:**
- `bring_any_idea_to_life` (Step-by-step procedure animations)
- `robotics_franka_pick_and_place` concepts (Instrument handling geometry)

**Core Features:**

1. **Workflow Animations**
   - 15-second animated demonstrations per step
   - First-person view with annotations
   - Slow-motion segments for critical actions

2. **Equipment Tray "Game"**
   - Drag-and-drop correct instruments
   - Missing item: -20 points
   - Unnecessary item: -5 points
   - Must complete before procedure starts

3. **Sterile Field Tracking**
   - Mouse/touch contamination detection
   - Safe zone (green), border zone (yellow), contamination (red)
   - Breach triggers "Contamination Fail State"

4. **Surgical Geometry Validation**
   - Entry angle validation (e.g., 30-45° for central line)
   - Depth measurement
   - Avoidance zone detection (carotid artery, pleura)
   - Real-time trajectory visualization

5. **Landmark Identification**
   - Click-to-identify anatomical landmarks
   - Must pass quiz before procedure

**Example:**

```
Procedure: Central Line Placement

1. Equipment Tray:
   ✅ Central line kit
   ✅ Ultrasound
   ✅ Sterile gown
   ❌ [Missing: Chlorhexidine] (-20 points)

2. Landmark ID:
   "Click on the apex of the SCM triangle"
   [Student clicks]
   ✅ Correct (within 5% tolerance)

3. Sterile Field:
   [Green overlay indicating safe zone]
   [Student's cursor leaves safe zone]
   🚨 "CONTAMINATION! Sterile field breached."
   [Procedure must restart]

4. Insertion Geometry:
   Entry angle: 35° (Ideal: 30-45°) ✅
   Depth: 2.2cm (Ideal: 2cm) ✅
   Distance from carotid: 8mm ✅
   [Green trajectory line]
```

**Deliverables:**
- 650-line type system (`types/digital-sim-lab-system.ts`)
- Complete central line workflow example

**Status**: ✅ Design Complete

---

### AI Tutor System (ask_the_manual)

**Purpose**: Replace static database with RAG-backed tutoring using clinical textbooks

**Key Technology:** Google AI Studio `ask_the_manual` (Grounding API)

**Knowledge Base:**
- **Textbooks**: Harrison's, Cecil, CMDT, Oxford Handbook
- **Guidelines**: AHA ACLS, ATS Respiratory, IDSA
- **Study Materials**: Davis PANCE Review, Kaplan, Rosh Review
- **Lecture Notes**: PA program slides (uploaded PDFs)

**Core Features:**

1. **Context-Aware Querying**
   ```typescript
   Query: "What are the key features of acute MI?"
   Context: {
     patientAge: 55,
     chiefComplaint: "Chest pain",
     vitals: { hr: 110, bp: "140/90" }
   }
   
   Response: [Answer with citations from Harrison's + AHA Guidelines]
   ```

2. **Progressive Hints**
   - **Subtle**: "Think about cardiac risk factors"
   - **Moderate**: "Consider acute coronary syndrome"
   - **Explicit**: "Order ECG for STEMI"
   - **Answer**: "This is an inferior STEMI..."

3. **Post-OSCE Debrief**
   - Strengths: "Correctly identified MI"
   - Areas for improvement: "Missed RV involvement assessment"
   - Teaching points with citations
   - Recommended study resources

4. **Contextual Interventions**
   - Triggers: time_elapsed, wrong_action, missed_finding
   - Real-time guidance during OSCE

**Example:**

```
[During OSCE]
Student: "What causes this chest pain?"
AI Tutor: "Based on the patient's presentation (55yo male, diaphoresis, 
Levine sign), consider life-threatening cardiac causes. Key features of acute 
MI include:
1. Substernal chest pressure (Harrison's 21e, Ch. 296)
2. Radiation to left arm/jaw
3. Associated diaphoresis and nausea
4. ST-elevation on ECG (AHA STEMI Guidelines 2023)

Immediate next step: Order 12-lead ECG and troponin."

Citations:
[1] Harrison's Principles, 21st Ed., Chapter 296, p. 2051-2065
[2] AHA/ACC 2023 STEMI Guidelines
```

**Advantages Over Static Database:**

| Feature | Static DB | ask_the_manual |
|---------|-----------|----------------|
| Content Depth | Limited | Full textbooks |
| Citations | None | Page-level refs |
| Context Awareness | Generic | Scenario-specific |
| Updates | Manual | Upload new editions |
| Exam Prep | PANaCEa only | PANCE + textbooks |

**Deliverables:**
- 450-line type system (`types/ai-tutor-system.ts`)
- 580-line service (`services/ai/aiTutorService.ts`)
- Complete integration examples

**Status**: ✅ Design Complete

---

## Technical Specifications

### Deployment Architecture

**Edge-Native (Cloudflare):**
- **Workers**: API endpoints, WebSocket proxies
- **Durable Objects**: PatientVoiceSession (persistent WebSocket)
- **R2**: Video/image CDN
- **Pages**: Frontend (React 19)

**External APIs:**
- **Gemini Multimodal Live**: Voice interaction
- **Gemini Grounding (ask_the_manual)**: RAG with textbooks
- **Gemini Spatial Understanding**: Heatmap generation
- **Veo Cameos**: Video generation
- **Bring Any Idea to Life**: Workflow animations

### Performance Targets

| Metric | Target |
|--------|--------|
| **Module 1**: State Transition Latency | < 200ms |
| **Module 1**: Voice Modulation Update | < 100ms |
| **Module 2**: Point-and-Click Response | < 50ms |
| **Module 2**: Heatmap Generation | < 5s |
| **Module 3**: Geometry Validation | < 100ms |
| **AI Tutor**: Query Response Time | < 3s |

### Data Requirements

**Audio:**
- Format: 16-bit PCM, 16 kHz, mono
- Chunk size: 100ms (~3.2 KB)

**Video:**
- Format: MP4 (H.264), 1920x1080, 30fps
- Duration: 5 seconds (seamless loop)
- Bitrate: 5 Mbps

**Images:**
- Format: JPEG/PNG
- Resolution: 1024x1024 or higher
- Heatmaps: 32-bit RGBA PNG

---

## Implementation Roadmap

### Phase 1: AI Tutor Foundation (Weeks 1-2)

- [ ] Upload 5 core textbooks to Gemini corpus
- [ ] Implement AITutorService
- [ ] Test query with citations
- [ ] Deploy sidebar tutor UI
- [ ] Integrate with existing OSCE mode

### Phase 2: Module 1 Prototype (Weeks 3-4)

- [ ] Deploy PatientVoiceSession Durable Object
- [ ] Create 1 pilot case (COPD) with 3 states
- [ ] Connect to Gemini Multimodal Live
- [ ] Generate 3 pilot videos (veo_cameos)
- [ ] Test full audio-video-state synchronization

### Phase 3: Module 2 Implementation (Weeks 5-6)

- [ ] Generate 20 standardized patient videos
- [ ] Implement point-and-click diagnostic engine
- [ ] Integrate spatial-understanding for heatmaps
- [ ] Create hover-reveal interaction
- [ ] Build 10 pilot questions (5 radiology, 5 physical exam)

### Phase 4: Module 3 Implementation (Weeks 7-8)

- [ ] Generate workflow animations for 5 procedures
- [ ] Implement equipment tray drag-and-drop
- [ ] Build sterile field tracking
- [ ] Create geometry validation engine
- [ ] Implement landmark identification quizzes

### Phase 5: Integration & Polish (Weeks 9-10)

- [ ] Unified dashboard across all 3 modules
- [ ] Cross-module analytics (Invisible Preceptor)
- [ ] Comprehensive testing (unit + integration + E2E)
- [ ] User acceptance testing with PA students
- [ ] Performance optimization
- [ ] Documentation finalization

---

## File Manifest

### Module 1: Living Patient

| File | Lines | Purpose |
|------|-------|---------|
| `types/patient-av-state-machine.ts` | 730 | State machine types, examples |
| `services/av/patientAVEngine.ts` | 520 | Runtime engine |
| `services/av/veoCameosService.ts` | 380 | Video generation |
| `worker/src/PatientVoiceSession.ts` | 420 | Durable Object |
| `docs/MODULE_1_AV_ARCHITECTURE.md` | 1,100 | Architecture guide |
| `docs/MODULE_1_QUICKSTART.md` | 600 | Quick start |
| `docs/MODULE_1_IMPLEMENTATION_SUMMARY.md` | 700 | Summary |

**Subtotal**: **4,450 lines**

### Modules 2 & 3 + AI Tutor

| File | Lines | Purpose |
|------|-------|---------|
| `types/ai-tutor-system.ts` | 450 | AI Tutor types |
| `services/ai/aiTutorService.ts` | 580 | AI Tutor service |
| `types/clinical-eye-system.ts` | 520 | Module 2 types |
| `types/digital-sim-lab-system.ts` | 650 | Module 3 types |
| `docs/MODULES_2_3_ARCHITECTURE.md` | 1,500 | Architecture guide |

**Subtotal**: **3,700 lines**

### Summary & Meta

| File | Lines | Purpose |
|------|-------|---------|
| `docs/COMPLETE_SYSTEM_SUMMARY.md` | 800 | This document |

**Subtotal**: **800 lines**

---

## **GRAND TOTAL: ~9,000 lines of architecture + documentation**

---

## Success Metrics

### Educational Outcomes

| Metric | Target |
|--------|--------|
| **Diagnostic Accuracy** | > 80% |
| **Time to Recognition** | < 60s for critical findings |
| **Engagement** | > 90% session completion |
| **Student Satisfaction** | > 8.5/10 |
| **PANCE Pass Rate** | > 95% (baseline: 93%) |

### Technical Metrics

| Metric | Target |
|--------|--------|
| **System Uptime** | > 99.5% |
| **WebSocket Stability** | > 99% connection success |
| **API Latency (p95)** | < 500ms |
| **Video Load Time** | < 3s |
| **Concurrent Users** | 100+ |

### Content Metrics

| Metric | Target (End of Q1 2026) |
|--------|-------------------------|
| **OSCE Cases** | 10+ conditions |
| **Clinical Eye Questions** | 50+ (25 radiology, 25 physical exam) |
| **Sim Lab Procedures** | 10+ procedures |
| **AI Tutor Resources** | 20+ textbooks/guidelines |

---

## Cost Estimates (Monthly, 1000 Active Students)

| Service | Usage | Cost |
|---------|-------|------|
| **Gemini Multimodal Live** | 500 hours audio | $500 |
| **Veo Cameos** | 100 videos (pre-generated) | $200 |
| **Gemini Grounding (ask_the_manual)** | 10,000 queries | $300 |
| **Gemini Spatial Understanding** | 2,000 heatmaps | $100 |
| **Cloudflare Workers/DO** | 1M requests | $50 |
| **R2 Storage** | 500GB video/images | $10 |
| **Bandwidth** | 10TB egress | $100 |

**Total**: ~$1,260/month (~$1.26 per student)

---

## Competitive Advantage

### vs. Traditional Question Banks (UWorld, Rosh Review)

| Feature | Traditional | PANaCEa |
|---------|------------|---------|
| **Interactivity** | Static MCQ | Voice, video, point-and-click |
| **Realism** | Text vignettes | Voice-responsive patients |
| **Visual Diagnostics** | Static images | Interactive heatmaps |
| **Procedures** | None | Full simulation with sterile field |
| **Tutoring** | Pre-written explanations | RAG with textbook citations |
| **Adaptivity** | None | State-driven scenario branching |

### vs. Medical Simulation Labs (Standardized Patients)

| Feature | Physical Lab | PANaCEa |
|---------|-------------|---------|
| **Cost** | $200-500/session | $1.26/student/month |
| **Scalability** | Limited by space/actors | Unlimited concurrent |
| **Availability** | Scheduled sessions | 24/7 on-demand |
| **Variety** | Limited by actor pool | Infinite scenarios |
| **Feedback** | Manual grading | Instant AI feedback |
| **Sterile Field** | Physical drapes | Digital tracking |

---

## Next Steps

### Immediate (This Week)

1. **Review architecture** with development team
2. **Prioritize Phase 1** (AI Tutor) for immediate value
3. **Select pilot cases** for Module 1 (COPD, MI, Stroke)
4. **Set up Gemini API access** (ask_the_manual corpus)

### Short-Term (Next Month)

1. **Deploy PatientVoiceSession** Durable Object (staging)
2. **Upload Harrison's + CMDT** to Gemini corpus
3. **Generate 10 pilot videos** with veo_cameos
4. **Build COPD state machine** (3 states)
5. **Alpha test** with internal team

### Medium-Term (Q1 2026)

1. **Launch Module 1** with 5 cases
2. **Launch AI Tutor** with 10 textbooks
3. **Launch Module 2** with 25 questions
4. **Launch Module 3** with 5 procedures
5. **Beta test** with 50 PA students
6. **Production launch** with full analytics

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| **Gemini API rate limits** | Implement caching, queue system |
| **Veo video generation time** | Pre-generate common scenarios |
| **WebSocket connection drops** | Auto-reconnect with state recovery |
| **Heatmap quality** | Validate with radiologist review |

### Content Risks

| Risk | Mitigation |
|------|------------|
| **Medical accuracy** | Faculty review process |
| **Copyright (textbooks)** | Institutional licenses or public domain |
| **PANCE blueprint misalignment** | Regular blueprint review |

### User Experience Risks

| Risk | Mitigation |
|------|------------|
| **Learning curve** | Tutorial mode, tooltips |
| **Frustration (difficult cases)** | Progressive hint system |
| **Audio quality** | High-quality voice models, noise reduction |

---

## Conclusion

This architecture provides a **production-ready blueprint** for transforming PANaCEa from a traditional question bank into a **next-generation, multi-modal clinical simulation platform** that rivals physical simulation labs at 1/100th the cost.

**Key Innovations:**
1. **Event-driven state machines** for realistic patient responses
2. **RAG-backed tutoring** with textbook citations
3. **Interactive visual diagnostics** replacing static MCQ
4. **Digital procedural simulation** with sterile field tracking

**Total Scope:**
- **~9,000 lines** of architecture and documentation
- **4 integrated modules** (OSCE, Visual, Procedural, AI Tutor)
- **10-week implementation roadmap**
- **$1.26/student/month** operating cost

**Status**: ✅ Design Complete - Ready for Prototype Phase

---

**Prepared by**: A/V Systems Architect  
**Date**: February 5, 2026  
**Branch**: `cursor/patient-encounter-state-machine-7530`  
**Commits**: `b815ac55`, `d807fcac`, `a4137f78`  
**Pull Request**: https://github.com/aaronjullger-lgtm/PANaCEa/pull/new/cursor/patient-encounter-state-machine-7530
