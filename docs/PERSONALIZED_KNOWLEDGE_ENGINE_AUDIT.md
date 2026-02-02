# Personalized Knowledge Engine – Implementation Audit

**Role:** Senior Full-Stack Architect & QA Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness/scalability, refactoring.  
**Reference:** `.cursor/plans/personalized_knowledge_engine_5ba76595.plan.md` and implementation in `functions/api/knowledge/`, `components/pages/MyLibraryPage.tsx`, `components/panels/ExplanationPanel.tsx`, streaming/gemini proxy, preferences.

---

## Critical Fixes

### 1. **Gemini proxy calls from the client do not send auth (401 in production)**

**Issue:** The Gemini **stream** endpoint (`/api/gemini/stream`) and the **non-stream** proxy (`/api/gemini`) both use `authenticateRequest(request, env)`, which reads **only** the `Authorization: Bearer <token>` header. The client never sends this header:

- **`lib/utils/streamingClient.ts`** – `streamGeminiText()` calls `fetch(..., { headers: { 'Content-Type': 'application/json' } })` with no `Authorization`.
- **`services/ai/geminiService.ts`** – `callGeminiText()` (non-stream) also uses `fetch(..., { headers: { 'Content-Type': 'application/json' } })` with no `Authorization`.

Every other authenticated API call in the repo (My Library, preferences, questionService, QuizView, etc.) uses `getToken()` from `useAuth()` and passes `Authorization: Bearer ${token}`. The Tutor (ExplanationPanel → callGeminiTextStreaming → streamGeminiText) and any other caller of these helpers will receive **401 Unauthorized** when the backend requires auth.

**Fix:**

1. **Streaming:** Add optional `token?: string` (or `getToken?: () => Promise<string | null>`) to `StreamOptions` in `lib/utils/streamingClient.ts`. When present, set `Authorization: Bearer ${token}` on the request. In `services/ai/geminiService.ts`, extend `callGeminiTextStreaming` options with `getToken`, await the token, and pass it into `streamGeminiText`. In **ExplanationPanel**, use `useAuth()` and pass `getToken` (or the resolved token) into the streaming call.
2. **Non-streaming:** Similarly, ensure `callGeminiText` (and any other direct proxy caller) receives and sends the Bearer token for requests that hit protected endpoints.

**Verification:** While signed in, open a quiz → answer a question → open explanation → click “Ask Tutor” and submit a question. Without the fix you should see a streaming or JSON error indicating 401; after the fix, the Tutor should stream a response.

---

### 2. **`customSettings` PATCH is full replace; concurrent updates can wipe keys**

**Issue:** `PATCH /api/user/preferences` does `data: { ...payload }` (e.g. `customSettings: { activeKnowledgeCacheName, activeKnowledgeCacheDisplayName }`). Prisma replaces the entire `customSettings` column. The **client** (My Library) merges existing `preferences.customSettings` before sending, so a single-tab flow is fine. However:

- Any other code that does `updatePreferences({ customSettings: { someOtherKey: value } })` **without** merging existing `customSettings` will overwrite the column and remove `activeKnowledgeCacheName` / `activeKnowledgeCacheDisplayName`.
- The plan/doc already called out: “Backend merge of `customSettings` on PATCH to avoid overwriting other keys from concurrent updates.”

**Fix (recommended):** In `functions/api/user/preferences.ts`, for PATCH when `payload.customSettings` is present, **merge** it into the existing `customSettings` instead of replacing:

- Read current `existing.customSettings` (as `Record<string, unknown>` or similar).
- Set `newCustomSettings = { ...existing.customSettings, ...payload.customSettings }`.
- Optionally: treat explicit `null` in payload as “remove key” (e.g. `activeKnowledgeCacheName: null` → delete key).
- Write `customSettings: newCustomSettings` in the update.

**Verification:** From two tabs, set “active library” in one and change another preference in the other; confirm both active library and the other preference persist.

---

### 3. **Expired “active” cache still sent to Tutor (poor UX / API errors)**

**Issue:** “Active” cache is stored only in preferences (`activeKnowledgeCacheName`). The list from `GET /api/knowledge/caches` returns only **non-expired** caches (`expiresAt > now`). So:

- User sets cache A as active; later A expires (e.g. after 1 hour).
- A disappears from the list, but preferences still have `activeKnowledgeCacheName: A`.
- ExplanationPanel still passes `cachedContent: A` to the Tutor. Gemini will reject or error (e.g. cache not found / expired).

**Fix options:**

1. **Client:** When loading My Library (or on app init), if `activeKnowledgeCacheName` is set and not present in the non-expired list, call “clear active” (or PATCH preferences to remove it).
2. **Or:** When building the Tutor request, only send `cachedContent` if the active cache is in a “valid” set (e.g. after a lightweight “list my caches” or a small cache of valid names). Simpler approach: clear active when it’s not in the current non-expired list (option 1).

**Verification:** Set a cache as active, wait until it expires (or mock expiry), open Tutor and ask a question; after fix, either active is cleared or Tutor no longer sends the expired cache and doesn’t show “Answering using: …” for it.

---

## Logical Omissions

### 1. **Plan: “optionally call Gemini cachedContents.list and merge with DB”**

Plan stated for `GET /api/knowledge/caches`: “list user’s caches (from DB); **optionally call Gemini cachedContents.list and merge with DB metadata**.” Current implementation only returns DB rows with `expiresAt > now`. No sync with Gemini. If a cache is deleted or expired in Gemini but the DB row remains (e.g. delete failed), we could show a stale entry. **Suggestion:** Either document “DB is source of truth; we do not merge with Gemini” or add an optional sync (e.g. filter out names that Gemini says are gone).

### 2. **MIME type in cache creation vs upload**

Upload allows `application/pdf`, `text/plain`, and `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. In `functions/api/knowledge/cache.ts`, the body to Gemini always sends `mimeType: 'application/pdf'`. Creating a cache from an uploaded .txt or .docx still sends PDF. **Suggestion:** Pass `mimeType` from upload response into cache creation (e.g. cache request body includes `mimeType` from client or from upload API), or restrict upload to PDF only and document it.

### 3. **“Chat with your Library” dedicated view**

Plan and file map mention a **“Chat with your Library” view**. Currently, “library” is used **only** via the Tutor in the explanation panel (Ask Tutor + active cache). There is no dedicated full-page “Chat with your Library” UI that sends queries to an endpoint (e.g. `POST /api/study/chat` with a resource or the user’s active cache). **Suggestion:** Either add a simple “Chat with your Library” page (query input + response, using active cache or selected cache) or explicitly document that the only “chat with library” experience is Ask Tutor in explanations.

### 4. **Study Companion (`/api/study/chat`) and My Library are separate**

`POST /api/study/chat` is resource-based (Supabase PDF + EducationalResource + optional Adobe Extract). My Library is user-upload → KnowledgeCache → preferences “active.” The plan’s “Intelligent Study Companion” and “Chat with your Textbook” are implemented in study/chat; “Chat with your Library” is implemented via Tutor + active cache. No link between the two (e.g. “use this EducationalResource as my active library” or vice versa). **Suggestion:** Document the two paths clearly; if product wants one unified entry, add a small design note or follow-up task.

---

## Technical Debt

### 1. **Upload handler opens Prisma but doesn’t use it**

In `functions/api/knowledge/upload.ts`, `createEdgePrismaClient(env.DATABASE_URL)` is created and `safePrismaDisconnect(prisma)` is in `finally`, but the handler never queries the DB. This adds a pointless connection on every upload. **Suggestion:** Remove Prisma from the upload handler (or use it only when you add DB logging); keep env checks and Gemini upload only.

### 2. **Duplicate “get user by clerkId” in knowledge routes**

`caches.ts`, `cache.ts`, and `cache/[name].ts` each do `prisma.user.findUnique({ where: { clerkId: auth.userId } })`. **Suggestion:** Extract a small helper (e.g. in `_shared` or knowledge) `getUserIdByClerkId(prisma, clerkId)` and reuse it to stay DRY and consistent.

### 3. **Inconsistent auth/middleware style in knowledge**

- Upload: `withMiddleware(withCors(), withErrorHandling(), withEnvCheck('FULL_STACK'), withAuth(), ...)`.
- Caches / cache (POST): `authenticatedEndpoint(...)`.
- Delete: `authenticateRequest(request, env)` + manual responses.

**Suggestion:** Prefer one pattern (e.g. `authenticatedEndpoint` or the same middleware stack) for all knowledge routes so behavior and error shapes are consistent.

### 4. **Active cache read duplicated**

ExplanationPanel and MyLibraryPage both read `activeKnowledgeCacheName` and `activeKnowledgeCacheDisplayName` from `preferences.customSettings` with the same casting. **Suggestion:** Add a tiny helper (e.g. `getActiveKnowledgeCache(preferences): { name?: string; displayName?: string }`) in a shared place (e.g. `utils/preferencesHelpers.ts` or next to preferences types) and use it in both components.

### 5. **No pagination or limit on GET /api/knowledge/caches**

Plan mentioned “Pagination or load more” as a possible next step. Currently all non-expired caches are returned. For users with many caches, this can grow. **Suggestion:** Add a limit (e.g. 50) and optional `cursor` or `page` for future pagination.

### 6. **Orphaned Gemini file if cache creation fails after upload**

If `POST /api/knowledge/upload` succeeds but `POST /api/knowledge/cache` fails (e.g. Gemini error), the file remains in Gemini with no DB row. **Suggestion:** Document this; consider a background job or “retry create cache” for the last uploaded fileUri, or accept as known limitation.

---

## Verification Steps

1. **Auth (critical):** Sign in → Quiz → Answer → Explanation → Ask Tutor. Confirm request includes `Authorization: Bearer …` and that you get a streamed answer, not 401. (Fix streaming + optionally non-stream proxy as above.)
2. **My Library E2E:** Open My Library → Upload a PDF → See it in the list → Set as active → See “Tutor is using your active library” and “Clear active” → Ask Tutor in quiz explanation → See “Answering using: [display name]” and a grounded answer. Clear active → Ask Tutor again → no “Answering using” line.
3. **Preferences merge:** After implementing server-side merge for `customSettings`, change active library in one place and another preference elsewhere; confirm both persist.
4. **Expired active:** With active set, expire the cache (wait or mock); open My Library or Tutor and confirm active is cleared or Tutor doesn’t send expired cache and doesn’t show “Answering using” for it.
5. **Delete:** In My Library, delete a cache (including the active one). Confirm it disappears and, if it was active, “active” is cleared and Tutor no longer uses it.
6. **API consistency:** Call `GET /api/knowledge/caches` and `DELETE /api/knowledge/cache/:name` with valid auth; confirm 200/204 and correct JSON. Call without auth or with invalid token; confirm 401.
7. **Run tests:** `npm run test -- tests/apiConfig.test.ts tests/knowledgeTutorCache.test.ts` – all should pass.

---

## Summary Table

| Category            | Severity   | Count |
|---------------------|------------|-------|
| Critical Fixes      | High       | 3     |
| Logical Omissions   | Medium     | 4     |
| Technical Debt      | Low/Medium | 6     |
| Verification Steps  | –          | 7     |

**Highest impact:** Fix client auth for Gemini proxy (streaming and non-stream) so Tutor and any other proxy callers work for signed-in users. Then address `customSettings` merge and expired active cache behavior for correctness and UX.
