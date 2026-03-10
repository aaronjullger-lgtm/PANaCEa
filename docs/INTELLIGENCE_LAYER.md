# PANaCEa Intelligence Layer

The Intelligence Layer adds five advanced AI-powered modules on top of the core platform. This document describes each module, required environment variables, and how to run optional services.

---

## Modules Overview

| Module | Purpose | Entry Points |
|--------|---------|--------------|
| **1. Hyper-Real Simulated Patient** | Voice-based OSCE via Gemini Live; vitals via tool | Virtual OSCE → Live voice button (during encounter) |
| **2. Clinical Eye Tutor** | Image analysis with Gemini 2.5 Flash + code execution | Command Center → Clinical Resources → Clinical Eye |
| **3. Infinite Smart Library** | Per-user context caching (e.g. “study brain”) for Gemini | Used by chat/proxy when `cachedContent` is supplied |
| **4. The Visualizer** | Adobe Firefly generation + Gemini conversational image editing | Command Center → Clinical Resources → Visualizer |
| **5. Audio Lecture Converter** | PDF → script (Gemini) → TTS → podcast | Optional Node service; proxy at `/api/podcast/generate` |

---

## Environment Variables

### Core (required for main app)

- **GEMINI_API_KEY** – Used by Edge/Express APIs for Gemini (generateContent, Live config, clinical-eye, visualizer, knowledge cache).
- **DATABASE_URL** – PostgreSQL (Prisma). Required for sessions, knowledge cache, vitals.
- **Clerk** – `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (or env in Cloudflare).

### Module-specific

- **Module 1 (OSCE Live)**  
  - Live config and vitals use the same auth and DB as the rest of the app. No extra env.  
  - **Security:** `GET /api/osce/live-config` returns a **short-lived ephemeral token** (1 min to start session, 30 min to send messages), not the long-lived `GEMINI_API_KEY`. The key stays on the server; the client uses the token only for the Live WebSocket connection.

- **Module 2 (Clinical Eye)**  
  - Uses `GEMINI_API_KEY` in the Edge function that calls Gemini 2.5 Flash.

- **Module 3 (Knowledge Cache)**  
  - Uses `GEMINI_API_KEY` and `DATABASE_URL`. Caches are stored in `KnowledgeCache`; create/list/delete via `/api/knowledge/*`.  
  - **Upload limit:** Max file size for `POST /api/knowledge/upload` is **50MB** (Edge limit); larger files require resumable upload or a separate job.

- **Module 4 (Visualizer)**  
  - **ADOBE_CLIENT_ID**, **ADOBE_CLIENT_SECRET** – For Firefly image generation. If unset, the generate endpoint may return an error or skip Firefly.
  - **VISUALIZER_EDIT_MODEL** (optional) – Gemini image-edit model override for `POST /api/visualizer/edit` (defaults to `gemini-2.0-flash-exp`).

- **Toolkit AI add-ons**
  - **SPARK_API_KEY** (optional) – Enables `POST /api/spark/instant-calc`; when missing, endpoint returns `501` with a fallback hint.

- **Module 5 (Podcast)**  
  - **PODCAST_SERVICE_URL** – Base URL of the Node podcast service (e.g. `http://localhost:3001`). If unset, `POST /api/podcast/generate` returns 501.  
  - **Podcast-service (Node)** – In `podcast-service/`: **GEMINI_API_KEY** (script generation). Optional: **GOOGLE_APPLICATION_CREDENTIALS** for Google Cloud TTS (if unset, only script is returned).

---

## Running the Podcast Service (Module 5)

The lecture-to-podcast pipeline runs as a separate Node service (Express). It is not part of the Edge runtime.

1. **Install and run**

   ```bash
   cd podcast-service
   npm install
   npm run dev
   ```

   Server listens on **port 3001** by default (override with `PORT`).

2. **Configure the app to use it**

   Set `PODCAST_SERVICE_URL` to the service URL (e.g. `http://localhost:3001` for local). The Edge function at `/api/podcast/generate` proxies `POST` requests to this URL.

3. **Optional: Google Cloud TTS**

   Set `GOOGLE_APPLICATION_CREDENTIALS` to a path to a service account key JSON. If set, the service synthesizes audio and returns `audioBase64`; otherwise it returns only the script.

See `podcast-service/README.md` for more detail.

---

## API Endpoints (summary)

- **OSCE Live:** `GET /api/osce/live-config`, `GET /api/osce/session/:sessionId/vitals`
- **Clinical Eye:** `POST /api/clinical-eye/analyze`
- **Technique Check:** `POST /api/technique-check/analyze` (multipart `video` + `query`, max video size 20MB)
- **Knowledge:** `POST /api/knowledge/upload`, `POST /api/knowledge/cache`, `GET /api/knowledge/caches`, `DELETE /api/knowledge/cache/:id`, `POST /api/knowledge/cache/student-context`
- **Visualizer:** `POST /api/visualizer/generate`, `POST /api/visualizer/edit`
- **Spark calculators:** `POST /api/spark/instant-calc`
- **Podcast:** `POST /api/podcast/generate` (proxies to podcast-service when `PODCAST_SERVICE_URL` is set)
- **Gemini proxy:** `POST /api/gemini`, `POST /api/gemini/stream` – accept optional `cachedContent` for context caching

---

## References

- Master documentation: [MASTER_DOCUMENTATION.md](./MASTER_DOCUMENTATION.md)
- Cloudflare deployment: [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)
