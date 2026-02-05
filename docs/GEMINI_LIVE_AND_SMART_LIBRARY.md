# Gemini 3 / Live / Smart Library Implementation

Implementation notes for the five-phase plan: Deep Think Tutor, Clinical Eye, Anatomy Painter, Simulated Patient (OSCE), and Smart Library. Aligned with Gemini 3, Gemini Live, and Adobe Firefly Services documentation.

---

## Image editing: Gemini (Nano Banana) vs Adobe Firefly

Nano Banana (model family including Gemini 3 Pro Image) and Adobe Firefly differ in how they maintain anatomical or structural consistency when editing images. Use this comparison when choosing an approach for Phase 3 (Anatomy Painter) or other visual pipelines.

| Dimension | Gemini / Nano Banana (e.g. Gemini 3 Pro Image) | Adobe Firefly |
|-----------|-------------------------------------------------|---------------|
| **Editing mechanism** | Conversational editing with **Thought Signatures**: encrypted tokens from the previous turn let the model “think” through composition and logic before applying changes. Multi-turn, natural-language edits without manual selection areas. | **Generative Fill + Masks** or **Structure Reference**: upload source image + mask (B&W) to target regeneration area; for anatomy, Structure Reference locks skeletal geometry of a reference image while allowing texture/pathology to change. |
| **Anatomical precision** | Reasoning + optional real-time grounding (e.g. Google Search). No explicit anatomical benchmark details in docs. | Explicitly evaluated for anatomical accuracy (e.g. foot anatomy); supports **Custom Models** (10–30 high-quality anatomical assets) for brand/clinical consistency and to reduce hallucination. |
| **Workflow** | Multimodal API with structured outputs and reasoning; suited to **agentic** flows where the AI plans the edit. | Firefly Services (e.g. Photoshop API): endpoints for fill, expand, `structure_reference`; suited to **pipeline automation** with precise control over output structure. |

**When to use which:** Prefer **Gemini** for multi-turn, language-driven edits and agentic flows where the model reasons over context. Prefer **Firefly** when you need locked anatomy (Structure Reference), explicit masks, or Custom Models for clinical consistency (see Phase 3 below).

---

## Phase 1: Deep Think Clinical Tutor

**Endpoint:** `POST /api/tutor/chat` — implementation: `functions/api/tutor/chat.ts`.

**Student benefit:** Moves beyond multiple-choice memorization to testing *why* a diagnosis is correct. Forces students to construct a differential diagnosis like a clinician. Aligns with 2025 PANCE Blueprint: **"Formulating Most Likely Diagnosis"** (18%) and **"Clinical Intervention"** (16%).

### Gemini 3 "Thinking Tokens" (Benefits & Configuration)

Gemini 3 introduces **Thinking** (controlled via `thinking_level`), which is the architectural unlock for the "Deep Think" Cognitive Protocol.

**Benefit 1: Reasoning vs. Retrieval**

- Standard models predict the next likely word. Gemini 3 with `thinking_level="high"` generates hidden **thought tokens**—an internal monologue where it critiques its own logic before generating the final answer.
- **Medical use case:** When a student asks about a complex case (e.g. "Hypotension + Tachycardia + Clear Lungs"), the model uses thinking tokens to internally simulate a differential (Sepsis vs. Cardiogenic Shock) before outputting the answer, reducing hallucinated diagnoses.

**Benefit 2: Thought Signatures (Multi-Turn)**

- For multi-turn interactions (Tutor, Simulated Patient), the model returns encrypted **thoughtSignature** tokens. The client must send these back in the next API call (in `history` for the prior model turn, or in `previousThoughtSignatures` for the new user message).
- **Why it matters:** This preserves the model's "train of thought." If a student asks a follow-up ("Why not fluids?"), the model remembers why it ruled out hypovolemia in the previous turn.

**Configuration strategy:**

| Module | thinking_level | Rationale |
|--------|----------------|-----------|
| **Tutor / Clinical vignettes** | `high` | Maximize reasoning depth; differentials and follow-ups benefit from thought signatures. |
| **Rapid Fire** | `low` or minimal | Minimize latency and cost; use Gemini 3 Flash only when low thinking is sufficient. |

**Implementation logic:**
1. **Enable Thinking:** Use `gemini-3-flash-preview` (fallback: `gemini-2.5-flash`). Set `thinkingConfig: { thinkingLevel: "HIGH" }` so the model generates a hidden reasoning trace before replying.
2. **Preserve Thought Signatures:** The API returns `thoughtSignature` tokens in model parts. The backend extracts them; the frontend must send them back in the next turn (in `history` for the prior model turn, or in `previousThoughtSignatures` for the new user message). If missing, the model loses reasoning context ("lobotomy").
3. **Strict Citations:** When using `cachedContent` (Smart Library), system instruction tells the model to cite as `{{Page:N}}` / `{{Pages:N-M}}` so the frontend can highlight.
4. **Tool:** `enableGoogleSearch: true` (default) → `tools: [{ googleSearch: {} }]` so the model can verify current CDC guidelines if the textbook is outdated.

**Request body (wrapped in `body`):**
- `message` (required)
- `history` (optional): `[{ role: "user"|"model", text, thoughtSignature? }]`
- `cachedContent` (optional): e.g. `cachedContents/xxx`
- `previousThoughtSignatures` (optional): array from last model reply
- `modelName`, `thinkingLevel` (low|medium|high), `temperature`, `maxTokens`, `enableGoogleSearch`

**Response:** `{ data: { reply, thoughtSignatures?, model, usageMetadata } }`

---

## Phase 2: Clinical Eye (Visual Diagnostics)

**Endpoint:** `POST /api/vision/analyze` — implementation: `functions/api/vision/analyze.ts`.

**Student benefit:** Trains the eye to spot pathologies in X-rays, ECGs, and dermatological photos without "cheating" by reading the report. PANCE: **Dermatology** (4%), **Musculoskeletal** (8%). Pedagogical flow: student uploads unlabelled image, makes a guess, then the AI analyzes and draws bounding boxes only after the guess (frontend enforces this).

**Implementation logic:**
1. **Bounding box detection:** Use Gemini (default `gemini-3-pro-preview` for spatial understanding; fallback `gemini-2.5-pro` via `modelName`). Request JSON with `diagnosis`, `reasoning`, and `bounding_box` (or `box_2d`) as `[ymin, xmin, ymax, xmax]` normalized 0–1000.
2. **Coordinate mapping:** Gemini uses 0–1000; Adobe PDF Extract uses a different system. Use `useBoundingBox` from `@/hooks/useBoundingBox`: `toCSS(box)` → CSS `top/left/width/height` as percentages; `toPixels(box, width, height)` for pixel overlay on the image viewer.
3. **Code execution (ECGs):** For ECG images, set `isEcg: true` so the endpoint enables `tools: [{ code_execution: {} }]`. The model writes Python (numpy/PIL) to count pixels between R-waves and compute heart rate—no visual estimation.

**Request body (wrapped in `body`):** `imageBase64`, `mimeType`, optional `studentQuery`, `prompt`, `isEcg`, `modelName`.

**Response:** `{ data: { diagnosis, reasoning, bounding_box?, model?, usageMetadata } }`

**Frontend helper:** `useBoundingBox(containerSize?)` returns `{ toCSS, toPixels }`. `toCSS(box)` gives `{ top, left, width, height }` as percentage strings; `toPixels(box)` gives pixel values when container size is provided.

---

## Phase 3: Anatomy Painter (Firefly)

**Endpoint:** `POST /api/visualizer/generate` — implementation: `functions/api/visualizer/generate.ts`.

**Student benefit:** Custom, anatomically accurate diagrams for rare conditions not in standard atlases. Standard AI hallucinates extra bones; PA students need precision. Structure reference locks bone geometry.

**Implementation logic:**
1. **Structure reference (CRITICAL):** Do not just prompt "Ankle Sprain". Pass a reference image to Firefly's `structure` parameter: `structure: { imageReference: { source: { url } } }` or `source: { uploadId }`. Use `structureReferenceUrl`, `structureReferenceImageId` (uploadId), or `referenceAnatomyId` (resolved from DB: AnatomyStructure.imageUrl or MediaAsset URL). Locks bone geometry.
2. **Generative Fill:** Firefly "paints" inflammation/pathology over the validated structure.
3. **Labeling:** Gemini 2.5 Flash conversational segmentation → masks for ligaments vs bones (interactive/clickable).
4. **Style:** Force `contentClass: "art"` (Medical Illustration) or `"photo"` (Hyper-realistic).
5. **Storage:** Save generated asset to Supabase Storage (`medical-images/visualizer/`); log metadata in Prisma (`VisualizerGeneration`: userId, conditionId, prompt, contentClass, storagePath, storageUrl, referenceAnatomyId).

**Request body (wrapped in `body`):** `prompt`, `segmentationPrompt`, `structureReferenceUrl`, `structureReferenceImageId`, `referenceAnatomyId` (AnatomyStructure.id or MediaAsset.id), `contentClass`, `conditionId`.

**Response:** `{ data: { imageBase64 (data URL), imageMime, masks, conditionId, contentClass, storageUrl?, storagePath? } }`

**Env:** `GEMINI_API_KEY`, `ADOBE_CLIENT_ID` + `ADOBE_CLIENT_SECRET` (or `ADOBE_ACCESS_TOKEN`), optional `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for storage + Prisma logging.

---

## Phase 4: Simulated Patient (OSCE Live)

**Endpoints:** `GET /api/osce/live-config` — implementation: `functions/api/osce/live-config.ts`. `GET /api/osce/live-session-config` — implementation: `functions/api/osce/live-session-config.ts`.

**Student benefit:** Real-time, voice-to-voice practice for history taking. Tests soft skills and efficiency. PANCE: **History Taking** (16%). Latency kills immersion; standard chatbots are too slow. WebSocket + native audio avoids text round-trip.

**Implementation logic:**
1. **Protocol:** Use WebSockets (not REST). Client gets ephemeral token + `wsUrl` + model from `GET /api/osce/live-config`, then connects to Gemini Live (`BidiGenerateContent`). Upstream: `wss://generativelanguage.googleapis.com/ws/...v1beta.GenerativeService.BidiGenerateContent` (or v1alpha when specified).
2. **Audio:** Stream raw 16 kHz PCM audio chunks bi-directionally. Do not transcode to text first (adds latency).
3. **Barge-in:** The model handles interruptions natively. If the student speaks over the AI, the AI stops (like a real person).
4. **Configuration (from live-session-config):** `response_modalities: ["AUDIO"]`, `speech_config: { voice_name: "Aoede" }` (Conversational). System instruction: "You are a 55yo male with chest pain. You are scared. Be brief. If the student is empathetic, open up. If they are rude, shut down."
5. **Tooling:** Define `get_vitals()` (or `get_current_vitals`). When the student asks "What were your labs?" or "What's your blood pressure?", the model calls the tool; the client returns JSON (e.g. `{ BP: "160/95", HR: 110, ... }` from `getVitalsExample` or from `GET /api/osce/session/:sessionId/vitals`) and the AI reads it naturally.

**Client flow:** Fetch `GET /api/osce/live` (one-shot bootstrap) or live-config + live-session-config → connect WebSocket to Gemini `wsUrl` with `apiKey` → send first message: **setup** with model, systemInstruction, tools, generationConfig (responseModalities, speechConfig), and optionally **sessionResumption: {}** to receive sessionResumptionUpdate → stream PCM 16 kHz via realtimeInput.audio; on **toolCall** (get_vitals), GET /api/osce/session/:sessionId/vitals and send **toolResponse** with functionResponses[{ id, response: { vitals } }].

**Session Resumption (Board Alert):** If the student's WiFi drops, the "Patient" can remember context (e.g. "chest hurts"). When Gemini sends **sessionResumptionUpdate** with **newHandle**, the client must store it. On reconnect, call `GET /api/osce/live?sessionResumptionHandle=<storedHandle>` and send **setup** with **sessionResumption: { handle: storedHandle }** so the Live API restores the conversation state instead of restarting the interview.

---

## Phase 5: Smart Library (Context Caching + Citations)

**Student benefit:** "Chat with your Textbook." Ask "What is the first-line treatment for Lyme disease according to Harrison's?" and get a cited answer. Reduces hallucination; PANCE requires textbook-perfect answers. New tech: Gemini Context Caching + Adobe PDF Extract.

**Implementation logic (three-step pipeline):**

1. **Step 1 (Ingest):** Run the PDF through Adobe PDF Extract API (`@adobe/pdfservices-node-sdk`). Save `structuredData.json` (text + bounding boxes). Store in Supabase; set `adobeDataPath` on `EducationalResource`. This maps every sentence to a coordinate for citation highlighting.
2. **Step 2 (Cache):** Use Gemini Context Cache: `genai.caches.create` or POST `https://generativelanguage.googleapis.com/v1beta/cachedContents` with textbook text content. Set TTL to 2 hours (7200s). Store the `cacheName` in the database (`EducationalResource.geminiCacheName`, `geminiCacheExpiresAt`). Reduces token cost ~90% for subsequent queries.
3. **Step 3 (Query):** When a student asks a question, use `models.generateContent` (or `POST /api/library/query`) referencing `cachedContent`. The LLM must return citations in the format `{{Page:X}}` (single page) or `{{Pages:N-M}}` (range). Frontend matches this to the Adobe JSON bounds to draw a yellow highlight box on page X in the PDF viewer.

**Endpoints / scripts:**
- **Ingest (Step 1):** Node/offline: Adobe PDF Extract → `structuredData.json` → Supabase; set `adobeDataPath`. (Or use `functions/api/content/library/ingest.ts` if wired.)
- **Cache (Step 2):** `npx tsx scripts/library/ingest-cache.ts --textFile ./path/to/extracted.txt [--resourceId <id>] [--ttl 7200] [--model gemini-2.0-flash]`. Env: `GEMINI_API_KEY`, `DATABASE_URL` (when using `--resourceId`).
- **Query (Step 3):** `POST /api/library/query` — implementation: `functions/api/library/query.ts`. Body: `{ cachedContent: "cachedContents/xxx", query, maxTokens }`. Returns `answer`, `citations`, `pageNumbers`. System instruction enforces `{{Page:X}}` / `{{Pages:N-M}}`.

**Citation mapping:** `parsePageCitations()` in library/query extracts page numbers from the answer; frontend uses Adobe Extract JSON (keyed by page) to draw highlight boxes on the PDF viewer.

**With resource ID:** `POST /api/study/chat` uses or creates cache per resource and returns answer + citations; same `{{Page:X}}` format; frontend uses `adobeDataPath` to fetch Adobe JSON and highlight.

### Liquid Mode: Mobile Reading for Medical Students

**Frontend:** Adobe PDF Embed API (SmartPDFViewer) with **Liquid Mode** (`enableLinearization`) is the solution for dense medical PDFs (e.g. Harrison's Principles) on mobile during clinical rotations.

**Why:** Standard PDFs force students to pinch-and-zoom on 2-column medical text on a phone. Liquid Mode uses Adobe Sensei AI to analyze PDF geometry and **reflow** content into a responsive, HTML-like layout.

**Enhancements for students:**

1. **Reflowable layout:** Text scales automatically; images and tables are preserved but stacked vertically for readability.
2. **Collapsible outline:** Automatically generates a clickable outline from PDF headers so students can jump to "Treatment" or "Contraindications" without scrolling through dozens of pages.
3. **Readable tables:** Complex dosage tables become responsive so columns are not cut off off-screen.

**Board alert / technical constraint:** Liquid Mode has a **documented limitation**: it may fail on files **larger than ~200 pages**.

**Architectural fix:** Do not serve the entire Harrison's textbook (3,000+ pages) to the mobile client at once. The backend (using Adobe PDF Extract or a split pipeline) must **split the textbook into individual chapters** (e.g. `Cardiology.pdf`, `Pulmonary.pdf`) before serving them to the PDF Embed API so that each document is under the Liquid Mode limit and Liquid Mode functions correctly.
