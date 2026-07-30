# Intelligence Layer & Repository Audit

**Role:** Senior Full-Stack Architect & Quality Assurance Lead  
**Scope:** Work performed for the PANaCEa Intelligence Layer (five modules), integration into PatientEncounterMode, documentation, and repository consistency.  
**Reference plan:** `.cursor/plans/personalized_knowledge_engine_5ba76595.plan.md` (Phase 1–3, Context Caching, Clinical Eye, Study Companion).

---

## 1. Plan Fidelity

### Implemented vs plan

- **Phase 1 (Context Caching + “Chat with your Library”)**
  - **Backend:** Gemini Files upload, cachedContents create/list/delete, DB `KnowledgeCache`, optional `cachedContent` on `/api/gemini` and `/api/gemini/stream` — **done**.
  - **APIs:** `POST /api/knowledge/upload`, `POST /api/knowledge/cache`, `GET /api/knowledge/caches`, `DELETE /api/knowledge/cache/:id`, plus `DELETE /api/knowledge/cache/:name` and `POST /api/knowledge/cache/student-context` — **done**.
  - **Client:** My Library (MyLibraryPage, Command Center), set active cache in preferences, Tutor (ExplanationPanel) sends `cachedContent` when active — **done**.
- **Phase 2 (Google Drive import):** Not implemented; plan left as “clarify before implementation.”
- **Phase 3:** Clinical Eye (image + code execution + bounding box), Visualizer (Firefly + Gemini segmentation), Lecture-to-Podcast (Node service + proxy) — **done**. Video timestamp search and Anki Remix — not in current scope.
- **Study Companion (unified study/chat):** `functions/api/study/chat.ts` exists (Supabase + Gemini cache + Adobe Extract); separate from the five-module Intelligence Layer.

### Edge cases / sub-requirements

- **Cache delete by name:** Client sends `encodeURIComponent(geminiCacheName)` (e.g. `cachedContents%2Fxyz`). `functions/api/knowledge/cache/[name].ts` uses `params.name` as-is. If the platform does not decode path params, `params.name` is `cachedContents%2Fxyz`, so `name.startsWith('cachedContents/')` fails and delete-by-name returns 400. **Recommendation:** Decode with `decodeURIComponent(params.name ?? '')` before validation and use.
- **Student-context cache in UI:** API `POST /api/knowledge/cache/student-context` exists. No dedicated “Use my weak spots” / “Study brain” button in My Library or Tutor that creates this cache and sets it as active. Plan’s “active cache” flow is generic; student-context is an optional enhancement.
- **Large PDF / upload limits:** Plan: “cap file size in UI and document limits.” Upload enforces 50MB and validates MIME; doc in INTELLIGENCE_LAYER.md does not state the 50MB limit — worth adding.

---

## 2. Repo Consistency

### Naming and structure

- **Functions:** New routes follow existing layout: `functions/api/<area>/<action>.ts` or `functions/api/<area>/<resource>/[id].ts`. Knowledge uses `cache/[id].ts`, `cache/[name].ts`, `cache/student-context.ts` — consistent with other areas.
- **Auth pattern:** Most new endpoints use `authenticatedEndpoint` from `_shared/middleware`; `functions/api/knowledge/cache/[name].ts` uses `authenticateRequest` + manual CORS/response from `_shared/auth`. `functions/api/podcast/generate.ts` now enforces auth via `withAuth()`.
- **Prisma:** New code uses `createEdgePrismaClient(env.DATABASE_URL)` and `safePrismaDisconnect` in `finally` — matches repo.
- **Env:** New code uses `context.env` / `env.GEMINI_API_KEY` etc., not `process.env` — correct for Edge.

### Styling and frontend

- **OSCELiveSession / PatientEncounterMode:** Use `var(--color-*)` and Tailwind; consistent with existing modes. Live voice button uses Lucide `Phone`; overlay is fixed + backdrop.

### Inconsistencies

- **knowledge/upload.ts:** Creates a Prisma client and calls `safePrismaDisconnect` in `finally` but never uses Prisma (upload is stateless). Either remove Prisma from this handler or document why it’s there (e.g. future audit log).
- **Two delete flows for knowledge cache:** Delete by DB `id` (`cache/[id].ts`) and by Gemini name (`cache/[name].ts`). Different middleware (authenticatedEndpoint vs authenticateRequest). Consider standardizing on one pattern and documenting when to use id vs name.

---

## 3. Logic & Security

### Critical fixes

1. **GEMINI_API_KEY exposed to client (live-config)** — **FIXED.**  
   `GET /api/osce/live-config` now requests a **short-lived ephemeral token** from Gemini’s `v1alpha/auth_tokens` API (server-side, using `GEMINI_API_KEY`) and returns only that token name to the client. The long-lived key never leaves the server. Client still uses the returned value as `apiKey` for `GoogleGenAI` and `live.connect()`; the SDK accepts the token name for Live API. Token: 1 min to start new session, 30 min to send messages (Gemini defaults).

2. **Podcast proxy authentication** — **FIXED.**  
   `functions/api/podcast/generate.ts` now wraps the handler with `withAuth()` (via `withMiddleware`). Unauthenticated callers receive `401` and cannot invoke the Node podcast service.

3. **Knowledge cache delete by name: param encoding**  
   Client sends DELETE to `/api/knowledge/cache/${encodeURIComponent(name)}` (e.g. `cachedContents%2Fxyz`). In `cache/[name].ts`, `params.name` may be the raw segment. If it is not decoded, `name.startsWith('cachedContents/')` fails and valid deletes return 400. **Fix:** Use `const name = decodeURIComponent(params.name ?? '')` before validation and DB/Gemini calls.

### Silent errors and data fetching

- **Vitals:** `PatientEncounterCase.vitalSigns` is `Json`. The vitals API normalizes with fallbacks (`bp ?? vitals.bloodPressure ?? '160/90'`, etc.). If the schema changes (e.g. different keys), some fallbacks may still apply but responses could be inconsistent. Consider a small Zod shape or typed interface for vitals.
- **OSCE Live:** `onclose` callback in OSCELiveSession uses `status` from closure; React state may be stale. Prefer a ref for “current status” in callbacks or a functional update so disconnect/close always sees the latest state.
- **Knowledge student-context:** Fetches last 50 incorrect `QuestionAttempt`s with nested `question`. No explicit error if `questionAttempt` or `question` is missing for some rows; formatting could produce incomplete “Weak Spot Profile” text. Defensive checks or logging for missing relations would help.

### Environment and secrets

- **Env usage:** New endpoints use `env.GEMINI_API_KEY`, `env.DATABASE_URL`, `env.ADOBE_*`, `env.PODCAST_SERVICE_URL` — no `process.env` in Edge code. Good.
- **Logging:** No logging of raw API keys; `secureLogger` and redacted URLs used in gemini/stream. Good.
- **Supabase/RLS:** Plan and new Intelligence Layer code do not introduce Supabase RLS; `study/chat.ts` uses Supabase with a service role. RLS is out of scope for this audit.

---

## 4. Holes & Scalability

### Brittleness

- **Vitals JSON shape:** OSCE vitals API and Live tool assume `vitalSigns` has `bp`, `hr`, `rr`, `temp`, `o2` (or alternate names). If `PatientEncounterCase.vitalSigns` schema changes, both the API and the Gemini tool response format should be updated together; otherwise the voice model may receive wrong or missing vitals.
- **KnowledgeCache.source:** Stored as string (`'upload' | 'drive' | 'student-context'`). Student-context reuse query filters by `source: 'student-context'`. If new sources are added, ensure they don’t collide with this filter.
- **Delete by name route:** Single segment `[name]`; client encodes `cachedContents/xxx` as one segment. If Gemini ever returns cache names with more slashes, this route would need a catch-all segment (e.g. `[[name]].ts`) and careful encoding/decoding.

### Load and scaling

- **live-config:** Returns the same API key to all users; key abuse or burst traffic hits one Gemini quota. Consider per-user or per-tenant keys or a backend proxy to throttle and attribute cost.
- **Visualizer:** Fetches a new Adobe access token on every request. Under load, this increases latency and token endpoint rate limits. Consider in-memory or KV cache of the token with TTL (e.g. 50 minutes).
- **Podcast proxy:** Forwards the full request body (including large PDFs) to the Node service. No body size limit in the Edge function; very large uploads could cause timeouts or memory pressure. Consider a max body size check (e.g. 50MB) and 413 response.
- **Student-context:** Loads up to 50 `QuestionAttempt` rows with nested `question`. For users with large histories, the query is bounded but could still be slow; indexing on `(userId, wasCorrect, createdAt)` is important (exists via `userId` and typical usage).

---

## 5. Refactoring Opportunities

### Code smells and DRY

- **Unused Prisma in upload:** `functions/api/knowledge/upload.ts` creates and disconnects Prisma without running any query. Remove it or add a clear reason (e.g. future audit table).
- **Dead code in OSCELiveSession:** `responseQueue` is pushed to but never read. Remove it or use it (e.g. for debugging or replay).
- **Duplicate env validation:** Several handlers do `validateFunctionEnv(env, 'GEMINI')` (or similar) and catch `MissingEnvError` to return a response. This could be centralized in a single middleware (e.g. `withEnvCheck('GEMINI')`) so handlers don’t repeat the try/catch.
- **Two knowledge delete endpoints:** `DELETE .../cache/:id` and `DELETE .../cache/:name`. Both are valid (id for UI list rows, name for “delete this cache by Gemini name”). Consider a single handler that accepts either `id` or `name` in the body or as query params to reduce duplicate auth and DB logic; or document clearly when the client should use which.
- **PatientEncounterMode:** Large file with many pre-existing linter issues (unused imports, cognitive complexity, deprecated `onKeyPress`, array index as key). Worth a separate refactor pass: extract subcomponents, remove dead code, fix a11y and keys.

### Consistency

- **knowledge/cache/[name].ts:** Uses `authenticateRequest`, `createErrorResponse`, `createSuccessResponse`, `handleCorsOptions` from `_shared/auth`. Other knowledge routes use `authenticatedEndpoint` and `withCors()` from middleware. Align on one pattern for easier maintenance and consistent CORS/error shapes.

---

## Output Summary

### Critical Fixes

| Priority | Issue | Location | Recommendation |
|---------|--------|----------|----------------|
| High | GEMINI_API_KEY returned to client | `functions/api/osce/live-config.ts` | Use short-lived token or backend WebSocket proxy; avoid exposing main key. |
| Resolved | Podcast proxy authentication | `functions/api/podcast/generate.ts` | `withAuth()` middleware is now enforced for POST calls. |
| Medium | Delete-by-name may get encoded param | `functions/api/knowledge/cache/[name].ts` | Use `decodeURIComponent(params.name ?? '')` before validation and DB/Gemini. |

### Logical Omissions

- **Student-context in UI:** No dedicated flow (e.g. “Use my weak spots”) that calls `POST /api/knowledge/cache/student-context` and sets the returned cache as the active library. Optional per plan but improves value of the “study brain” feature.
- **Documentation:** INTELLIGENCE_LAYER.md does not state the 50MB upload limit; add it under Knowledge/upload.
- **Phase 2 (Drive):** Intentionally not implemented; confirm with product whether and when to add.

### Technical Debt

- Remove or justify Prisma in `knowledge/upload.ts` (currently unused).
- Remove or use `responseQueue` in `OSCELiveSession.tsx`.
- Standardize knowledge delete: one auth/CORS pattern and document id vs name usage; consider single endpoint with id/name option.
- Align `knowledge/cache/[name].ts` with middleware-based auth/CORS used elsewhere.
- Centralize env validation (e.g. `withEnvCheck`) to avoid repeated try/catch in handlers.
- Refactor PatientEncounterMode (extract components, fix linter, a11y, keys).

### Verification Steps

1. **Auth and security**
   - Call `GET /api/osce/live-config` without `Authorization` → expect 401.
   - Call `POST /api/podcast/generate` without auth → expect `401` unauthenticated.
   - Call `GET /api/osce/session/:sessionId/vitals` with another user’s sessionId → expect 404 (vitals already scoped to `userId`).

2. **Knowledge cache**
   - Create cache via `POST /api/knowledge/cache` (after upload). List via `GET /api/knowledge/caches`. Delete by id `DELETE /api/knowledge/cache/:id`.
   - Delete by name: from list, take `geminiCacheName` (e.g. `cachedContents/xxx`), call `DELETE /api/knowledge/cache/${encodeURIComponent(name)}`. Verify 200 and cache removed; if 400, add `decodeURIComponent` in `[name].ts` and retry.
   - Set active cache in My Library → open a drill → get explanation → in network tab confirm request to `/api/gemini` or stream includes `cachedContent` when active cache is set.

3. **OSCE Live**
   - Start Virtual OSCE, start encounter (so session has id). Open Live voice overlay, connect. Ask “What’s my blood pressure?” → confirm tool is called and vitals returned (check network for `/api/osce/session/:sessionId/vitals`). Confirm voice persona matches current case (name, chief complaint) when patientContext is passed.

4. **Clinical Eye & Visualizer**
   - Clinical Eye: upload image, send prompt → expect JSON with text and optional bounding box. Visualizer: send prompt with Adobe configured → expect image + segmentation; with Adobe unset → expect clear error or fallback behavior.

5. **Podcast**
   - With `PODCAST_SERVICE_URL` set: POST PDF (or pdfUrl) to `/api/podcast/generate` → expect script (+ audioBase64 if TTS configured). With `PODCAST_SERVICE_URL` unset → expect 501.

---

*Audit complete. Address Critical Fixes first; then Logical Omissions and Technical Debt as capacity allows; run Verification Steps after any change to auth or knowledge/OSCE flows.*
