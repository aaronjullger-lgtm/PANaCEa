# PANaCEa AI Integration Roadmap

Consolidated specification for multimodal AI features.  
**Tech Stack:** Cloudflare Workers, Prisma/Supabase, React, Google Vertex AI (Gemini), Adobe Firefly & PDF Services.

---

## Phase 1: The Core Intelligence (The "Brain")

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | **Infinite Context Engine** (Context Caching) | 🔴 | Gemini Explicit Context Caching; NCCPA Blueprint + textbooks; 60-min SessionCache for Weak Spot Profile |
| 2 | **Reasoning Tutor** (Gemini 3 + Thinking) | 🟡 | Tutor exists; add `thinking_level="high"` and Thought Signatures for reasoning chains |
| 3 | **External Brain** (Search Grounding) | 🟡 | `google_search` tool; keyword heuristic + optional `enableGoogleSearch: true` in tutor |

---

## Phase 2: Document Intelligence (The "Library")

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4 | **Smart Library** (Adobe PDF Extract) | 🔴 | Adobe PDF Extract → JSON tree; highlight boxes on frontend; coordinate conversion |
| 5 | **Liquid Mode Reader** | 🔴 | Adobe PDF Embed API with Liquid Mode for mobile |
| 6 | **Lecture Converter** (Audio Overviews) | 🟡 | `/api/lecture/script` + Toolkit UI; text → Host A/B script; TTS separate |

---

## Phase 3: Clinical Simulation (The "Voice")

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 7 | **Virtual Patient** (Gemini Live API) | ✅ | OSCELiveSession, get_vitals tool; add resumption tokens, interrupted handling |
| 8 | **Dynamic Vitals & Tools** | ✅ | get_current_vitals; add order_lab/order_drug; thoughtSignature validation |

---

## Phase 4: Visual Pedagogy (The "Eyes")

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 9 | **Visualizer** (Firefly / Nano Banana) | 🔴 | Anatomical illustrations; conversational editing; Thought Signatures |
| 10 | **Clinical Eye** (Spatial Understanding) | 🟡 | `/api/vision/analyze` + `/api/vision/grade-spatial`; SpatialAnswerCanvas; MediaAsset.spatialAnswerCoords cache |
| 11 | **Visual Code Execution** (ECG math) | 🔴 | Gemini + Code Execution; OpenCV/NumPy for heart rate from strip |

---

## Phase 5: Metacognition (The "Teacher")

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 12 | **Preceptor** (OSCE Grading) | ✅ | grade.ts, grade-soap.ts, CaseRubric, Red Flags; Ghost Listener soft_skills_report (Bedside Manner) |
| 13 | **Concept Gap Analysis** | ✅ | ConceptGap, ConfusionPair; feed into Context Cache for Tutor |
| 14 | **Gunner Board** | ✅ | UserRolling360Stats, BodyMapWidget, NCCPA blueprint; optional dedicated view |

---

## Labs-Tier & Experimental

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 15 | **GitHub Spark** (Micro-App Builder) | 🔴 | Instant Calc – generate calculators on demand; sandboxed embedding |
| 16 | **Nano Banana** (Image Editing) | 🔴 | Conversational editing; thoughtSignature for consistency |
| 17 | **Veo Clinical Motion** | ✅ | `/api/veo/generate` + `/api/veo/status`; Clinical Motion Flashcards in Toolkit; see [VEO_CLINICAL_MOTION_SPEC.md](./VEO_CLINICAL_MOTION_SPEC.md) |
| 18 | **Gemini Robotics** (Technique Check) | 🔴 | Student video of maneuver → spatial feedback; bounding box + critique |
| 19 | **Audio Overviews** (NotebookLM) | 🟡 | Lecture Converter in Toolkit; text → Host A/B script; TTS pipeline separate |
| 20 | **Ephemeral Tokens** | 🟡 | Token exchange for Live Patient; reduce key exposure |
| 21 | **Batch Nightly Study Plans** | 🔴 | Gemini Batch API; personalized Daily Review podcast |
| 22 | **Socratic Remediation** | ✅ | `/api/ai/learning/socratic` (AI Gateway `gateway.tutor()`); Tutor Me button + `SocraticTutorChat` in QuizView |

---

## Quick Links

- [Veo Clinical Motion Spec](./VEO_CLINICAL_MOTION_SPEC.md)
- [Voice-to-Voice Architecture](./VOICE_TO_VOICE_ARCHITECTURE.md)
- [Gemini Live & Smart Library](./GEMINI_LIVE_AND_SMART_LIBRARY.md)
