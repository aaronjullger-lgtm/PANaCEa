# Personalized Knowledge Engine (My Library & Tutor)

This doc summarizes the **My Library** and **Tutor + active cache** feature: upload PDFs, set an active document, and have the AI Tutor use it when answering questions in quiz explanations.

## User flow

1. **My Library** (Command Center → My Library): Upload PDFs; each becomes a **knowledge cache** (Gemini Context Caching, ~1h TTL). Set one cache as **active** (saved in user preferences).
2. **Quiz → Explanation → Ask Tutor**: When the user asks the Tutor a question, the streaming request includes the active cache as `cachedContent` so answers are grounded in that document. The UI shows “Answering using: [display name]” when an active library is set.

## Implemented pieces

| Area | Location | Notes |
|------|----------|--------|
| **My Library page** | `components/pages/MyLibraryPage.tsx` | List caches, set/clear active, upload (PDF), delete. Uses `usePreferences()` for active cache; stores `activeKnowledgeCacheName` and `activeKnowledgeCacheDisplayName` in `customSettings`. |
| **ExplanationPanel Tutor** | `components/questions/ExplanationPanel.tsx` | Reads active cache from preferences; passes `cachedContent` to `callGeminiTextStreaming`; shows “Answering using: [name]”. |
| **Knowledge API** | `functions/api/knowledge/` | `POST /upload`, `POST /cache`, `GET /caches`, `DELETE /api/knowledge/cache/:name`. Auth, rate limit, and error handling via shared middleware. |
| **Study Companion** | `functions/api/study/chat.ts` | Resource-based “Chat with your textbook” (cold start, cache reuse, citations). Separate from My Library; can be wired to resources later. |
| **Gemini proxy** | `functions/api/gemini/index.ts`, `stream.ts` | Accept optional `cachedContent`; forwarded to Gemini `generateContent` / `streamGenerateContent`. |
| **Frontend streaming** | `lib/utils/streamingClient.ts`, `services/ai/geminiService.ts` | `StreamOptions.cachedContent` passed through to the proxy. |

## API reference (Knowledge)

- **GET /api/knowledge/caches** – List current user’s non-expired caches. Response: `{ caches: [{ id, displayName, geminiCacheName, expiresAt, source, createdAt }] }`.
- **POST /api/knowledge/upload** – Multipart `file` (PDF, max 50MB). Response: `{ fileUri, name, mimeType }`.
- **POST /api/knowledge/cache** – Body: `{ displayName, fileUri, ttlSeconds?, systemInstruction? }`. Creates Gemini `cachedContent` and a `KnowledgeCache` row.
- **DELETE /api/knowledge/cache/:name** – `name` = `geminiCacheName` (e.g. `cachedContents/xxx`). Removes DB row and deletes cache in Gemini.

Preferences for the active library: `PATCH /api/user/preferences` with `customSettings: { activeKnowledgeCacheName, activeKnowledgeCacheDisplayName }`.

## Config & tests

- **apiConfig**: `KNOWLEDGE_CACHE_DELETE(name)` builds the delete path; My Library uses `getApiBaseUrl() + API_ENDPOINTS.KNOWLEDGE_CACHE_DELETE(geminiCacheName)`.
- **Tests**: `tests/apiConfig.test.ts` (path builder, URL construction), `tests/knowledgeTutorCache.test.ts` (streaming client includes `cachedContent` when provided).

## Possible next steps

- Pagination or “load more” for `GET /api/knowledge/caches` if users have many caches.
- Backend merge of `customSettings` on PATCH to avoid overwriting other keys from concurrent updates.
- Optional “Expires soon” warning in My Library when TTL &lt; 15 minutes.
- Metrics/alerts for cache creation and Tutor usage (cost visibility).
