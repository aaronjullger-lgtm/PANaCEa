# Lecture-to-Podcast Service

Node service for the PANaCEa Intelligence Layer: PDF → Gemini script → Google Cloud TTS → audio.

## Pipeline

1. **Ingest**: PDF via multipart `file` or body `pdfUrl`. Uses `pdf-parse` for text extraction (optionally replace with Adobe PDF Extract for figure descriptions).
2. **Script**: Gemini 1.5 Pro with long context; output JSON `[{ speaker, text }, ...]` (Dr. Smith / Sarah).
3. **TTS**: Google Cloud Text-to-Speech (`en-US-Journey-D`, `en-US-Journey-F`); concatenate MP3 buffers.
4. **Response**: `{ script, audioBase64? }`.

## Run locally

```bash
cd podcast-service
npm install
export GEMINI_API_KEY=your_key
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json  # optional, for TTS
npm start
```

POST `http://localhost:3001/generate` with multipart `file` (PDF) or JSON `{ "pdfUrl": "https://..." }`.

## Deploy (e.g. Cloud Run)

Build and deploy the container; set `GEMINI_API_KEY` and `GOOGLE_APPLICATION_CREDENTIALS` (or attach a service account with TTS). Then set `PODCAST_SERVICE_URL` in Cloudflare Pages to the service URL. The Edge function `POST /api/podcast/generate` will proxy to this service.

## Optional: Cloudflare proxy

When `PODCAST_SERVICE_URL` is set, `functions/api/podcast/generate.ts` forwards POST requests to the Node service. Add auth (e.g. `authenticatedEndpoint`) in production.
