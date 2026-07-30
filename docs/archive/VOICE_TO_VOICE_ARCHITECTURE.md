# Voice-to-Voice OSCE Architecture

Real-time, low-latency patient interaction with "barge-in" capability. Cloudflare Pages Functions cannot maintain persistent WebSocket connections; this document describes the required infrastructure.

## Overview

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Frontend | `components/osce/AudioInterface.tsx` | Capture PCM via Web Audio API, stream via WebSocket, send barge-in on user speech |
| Backend | PatientVoiceSession (Durable Object) | Maintains WebSocket, buffers audio, forwards to Gemini Multimodal Live API |
| Storage | PatientEncounterSession.messages | Persisted transcript on session close |

## Frontend (AudioInterface.tsx)

- **Capture**: ScriptProcessorNode (or AudioWorklet) → 16 kHz mono PCM
- **Stream**: Chunks (~100 ms) as base64 in JSON `{ type: 'audio', data: base64 }`
- **Barge-in**: On user speech (RMS > threshold) or explicit "Interrupt" button → send `{ type: 'barge_in' }`
- **Playback**: Receives `{ type: 'audio', data: base64 }` from backend, queues for playback

## Backend (Durable Object)

Deploy a **Cloudflare Worker + Durable Object** as a separate service (or alongside Pages):

```
worker/
  src/
    index.ts          # Worker entry, routes /voice/:sessionId to DO
    PatientVoiceSession.ts  # Durable Object
  wrangler.toml
```

### PatientVoiceSession (Durable Object)

1. **On WebSocket connect**:
   - Accept upgrade
   - Fetch `PatientEncounterCase` (vitalSigns) and `CaseRubric` from DB
   - Build system prompt: "You are [patientName], [age]yo [sex]. Chief complaint: [cc]. Vitals: [vitals]. Red flags: [rubric checklist]. If interrupted, stop immediately."

2. **On `audio` message**:
   - Buffer chunks
   - When buffer ≥ N ms, send to Gemini Multimodal Live API (or Speech-to-Text for STT path)
   - Stream AI response back as `{ type: 'audio', data: base64 }` or `{ type: 'transcript', text }`

3. **On `barge_in` message**:
   - Cancel in-flight TTS generation
   - Send `{ type: 'tts_cancel' }` to Gemini or stop playback stream
   - Switch to listening for user audio

4. **On session close**:
   - Transcribe full conversation (or collect transcript segments)
   - PATCH `PatientEncounterSession` with updated `messages` JSON

### Configuration

- `OSCEConfiguration.enableVoiceMode` (or `config/osce-settings.ts`) gates the Voice UI
- WebSocket URL: `wss://voice.panacea.example.com/voice/{sessionId}` or similar
- Pass sessionId so the DO can load case/rubric and persist transcript

## Gemini Integration

- **Option A**: Gemini Multimodal Live API (BidiGenerateContent) – native audio in/out, barge-in
- **Option B**: Separate STT (Speech-to-Text) + LLM + TTS pipelines – more control, higher latency

## Security

- Authenticate WebSocket upgrade (Clerk token in query or header)
- Verify session belongs to user before connecting
- Never expose GEMINI_API_KEY to client; DO holds it server-side

## Persistence

On disconnect:

```ts
await prisma.patientEncounterSession.update({
  where: { id: sessionId },
  data: {
    messages: [...existingMessages, { role: 'system', content: `[Voice transcript] ${transcript.join(' ')}` }],
    updatedAt: new Date(),
  },
});
```

## Implementation Status

- [x] `AudioInterface.tsx` – capture, stream, barge-in button
- [ ] Durable Object `PatientVoiceSession`
- [ ] wrangler.toml for Worker + DO
- [ ] WebSocket URL configuration
- [ ] Transcript persistence on close
