# High-Leverage Product Ideas (PANCE-Aligned)

> **Source:** Gemini Live API (Session Resumption), Adobe PDF Services (table extraction), Adobe Firefly, and findings from AI limitation studies (e.g., foot anatomy).  
> **Purpose:** Strategic feature ideas not yet covered in existing roadmaps; each ties to PANCE domains and a concrete tech stack.

---

## 1. The "Longitudinal" Patient (Chronic Care Simulation)

### Concept

Move beyond one-off acute visits. Create a patient who **returns weeks later**, remembering exactly what was prescribed and developing new complications based on that specific treatment.

### PANCE Impact

- **Domain:** Managing Patients (~16%)
- **Gap:** Most simulators reset after every session and fail to teach **continuity of care** (e.g., Hypertension → Heart Failure progression).

### Tech Stack

| Layer | Choice | Role |
|-------|--------|------|
| State persistence | **Gemini Live API — Session Resumption** | Serialize conversation state across sessions |
| Mechanism | `SessionResumptionUpdate` + `new_handle` | Save/restore "patient" memory without keeping connection open |

### Logic (Example)

- **Session 1:** Student prescribes Lisinopril → `new_handle` encodes that state.
- **Session 2:** Model loads via resumed session → "patient" presents with **dry cough** (ACE inhibitor side effect), forcing the student to connect cause and effect.

### Implementation Notes

- Store `new_handle` (and any minimal metadata) in DB per user/simulation; associate with "longitudinal patient" scenario.
- Schedule or user-trigger "follow-up visit" that rehydrates the same handle into a new Live API session.
- Design prompts so the resumed character consistently references prior prescriptions and timeline.

---

## 2. The Polypharmacy Synthesizer (Interaction Matrix)

### Concept

Instead of generic drug-interaction questions, the student **uploads real PDF package inserts** (5+ drugs). The system extracts **Contraindications / Drug Interactions** tables and synthesizes a **custom Interaction Matrix** for a complex patient.

### PANCE Impact

- **Domain:** Pharmaceutical Therapeutics (~15%)
- **Gap:** Multi-drug interactions are a major failure point; simple flashcards don’t cover dense, table-heavy insert content.

### Tech Stack

| Layer | Choice | Role |
|-------|--------|------|
| Table extraction | **Adobe PDF Extract API** | `ExtractElementType.TABLES` to parse Drug Interactions sections |
| Output | Structured CSV/XLSX | Preserve row/column logic that generic LLMs often miss |
| Reasoning | **Gemini (high thinking)** | Simulate metabolic competition (e.g., CYP450) across extracted data |

### Logic (Example)

- Ingest 5 package inserts → extract tables → normalize to a common schema (drug name, enzyme, contraindication, severity).
- Feed structured CSVs into Gemini with a prompt such as: *"Simulate metabolic competition for CYP450 enzymes between these 5 drugs and list high-risk combinations."*
- Present the synthesized matrix (and optional explanations) in the UI for study or quiz.

### Implementation Notes

- Edge/Cloudflare: proxy to Adobe PDF Services or run extraction in a worker-compatible way; avoid Node `fs` in `functions/`.
- Consider caching extracted tables per document hash to avoid re-extraction.
- Validate outputs (e.g., drug names, severity) against a known list where possible.

---

## 3. The Sterile Field Guardian (Spatial Compliance Monitor)

### Concept

An **AR-style safety monitor**: the student records themselves performing a procedure (e.g., sterile gloving, suturing). The AI analyzes the video to detect **breaches of the sterile field**.

### PANCE Impact

- **Domain:** Clinical Intervention (~16%)
- **Gap:** OSCE failures often stem from **contaminating the sterile field** without the student realizing it.

### Tech Stack

| Layer | Choice | Role |
|-------|--------|------|
| Spatial understanding | **Gemini (multimodal / vision)** | Bounding boxes for "sterile drape" and "student's hand" |
| Logic | Trajectory + boundaries | Trace hand trajectory; if it crosses non-sterile zones (e.g., below waist, touching mask), flag timestamp as **Critical Fail** |

### Logic (Example)

- **Prompts:** e.g. *"Generate a bounding box for the sterile drape"* and *"Generate a bounding box for the student's hand"* per frame or keyframes.
- Define rules: e.g. hand centroid or fingertips must stay above waist, never touch mask or non-sterile surfaces.
- Output: timeline of events + a single **Critical Fail** flag at first violation (with timestamp and reason).

### Implementation Notes

- Video upload and processing must comply with privacy and data retention policy; consider short-lived storage and user consent.
- Start with keyframe-based analysis to control cost; refine to full trajectory if needed.
- Integrate with existing OSCE/Clinical Intervention flows (e.g., score report, feedback panel).
- **3D spatial boxes:** For anatomy (and optionally sterile-field regions), use **3D bounding boxes** (depth, orientation, volume) via Gemini 2.5 Pro; see `docs/implementation/3D_SPATIAL_BOUNDING_BOXES.md` and `POST /api/vision/analyze-3d`.

---

## 4. Medical ASL Bridge (Inclusive Communication)

### Concept

A **generative video library** for **medical Sign Language (ASL)** focused on history-taking phrases (e.g., *"Does it hurt when I press here?"*). Targets phrases that are hard to film or find in standard dictionaries.

### PANCE Impact

- **Domain:** Patient Care & Communication; "diverse patient populations"
- **Gap:** Standard ASL resources lack **medical-specific phrasing**, which matters for PA students and electives (e.g., Medical Spanish/ASL).

### Tech Stack

| Layer | Choice | Role |
|-------|--------|------|
| Asset generation | **Adobe Firefly (Video/Image)** | Generate realistic hand/gesture sequences for signs |
| Use case | Visual flashcards | Proprietary library of medical signs for curriculum and electives |

### Logic (Example)

- Curate a list of medical history-taking phrases (e.g., pain location, consent, follow-up).
- Use Firefly to generate consistent, on-brand "visual flashcards" (short clips or images) for each phrase.
- Store in media library with metadata (phrase, ASL gloss, use case); expose in toolkit or elective modules.

### Implementation Notes

- Validate with Deaf community / ASL experts; avoid misrepresentation of signs (Firefly as augmentation, not replacement for expert review).
- Align with existing media approval and asset pipeline (e.g., `MediaApproval`, manifest) if applicable.
- Consider Medical Spanish as a parallel track (text/audio first; video if scope allows).

---

## 5. Spot the Hallucination (Adversarial Anatomy Game)

### Concept

Turn **AI’s known weaknesses** (e.g., subtle anatomy errors) into a **teaching tool**. The AI generates an anatomical diagram with **intentional subtle errors** (e.g., foot with 6 metatarsals, missing fibula). The student must **identify the error** to pass.

### PANCE Impact

- **Domain:** Applying Basic Scientific Concepts (~8%)
- **Gap:** Encourages **critical inspection** of anatomy instead of passive acceptance of diagrams; directly addresses studies showing AI struggles with complex structures (e.g., foot).

### Tech Stack

| Layer | Choice | Role |
|-------|--------|------|
| Erroneous image generation | **Adobe Firefly** | Custom prompts or models to induce subtle structural errors (e.g., *"skeletal hand with a subtle phalangeal error"*) |
| Grading | **Gemini Vision** | Compare student’s circled region (coordinates) to known "error" region; score correct/incorrect |

### Logic (Example)

- **Authoring:** For each item, store (1) the image (or Firefly prompt + seed), (2) the intended error region (e.g., bounding box or mask).
- **Play:** Student sees image, circles the error, submits.
- **Grade:** Gemini Vision (or deterministic overlap) checks submitted coordinates against expected region; provide feedback and explanation.

### Implementation Notes

- Firefly "Structure Reference" and prompt design: ensure we can reliably produce subtle errors without making them trivial or unrealistic.
- Fallback: use pre-authored images with known error coordinates if generative approach is inconsistent.
- Reuse existing quiz/attempt and analytics pipelines (e.g., `attemptService`, item tagging) for reporting and spaced repetition.

---

## Cross-Cutting Considerations

| Concern | Notes |
|--------|--------|
| **Edge runtime** | All logic in `functions/` must use Web APIs only; no Node `fs`/`path`/`process.cwd`. Adobe/Google APIs via `fetch` or serverless-compatible SDKs. |
| **Auth & privacy** | Longitudinal patient state, uploaded PDFs, and procedure videos are PII/sensitive; enforce auth, RLS, and retention policies. |
| **Cost** | Gemini Live resumption, high-thinking calls, and Firefly/PDF Extract have per-use cost; rate limit, cache, and scope to authenticated users. |
| **PANCE alignment** | Each idea maps to a content area; tag content and analytics so progress can be reported by domain (e.g., Managing Patients, Pharma, Clinical Intervention). |

---

## Next Steps

1. **Prioritize** against current roadmap (e.g., Strategic 10-Sprint) and resource constraints.
2. **Spike** one idea (e.g., Longitudinal Patient with a single resumption flow, or Polypharmacy with one PDF → table → CSV) to validate APIs and latency.
3. **Document** API contracts (Gemini Live resumption payload, Adobe Extract response shape) in `docs/` or OpenAPI once chosen.
4. **Update** `.github/copilot-instructions.md` or `.cursor/rules` with any new patterns (e.g., "Session Resumption state stored in DB only as handle + scenario id").
