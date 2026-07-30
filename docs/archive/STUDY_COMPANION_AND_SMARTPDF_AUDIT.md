# Study Companion & SmartPDFViewer – Audit Report

**Role:** Senior Full-Stack Architect & QA Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness, refactoring.  
**Artifacts:** Personalized Knowledge Engine plan, Study Companion endpoint, SmartPDFViewer component.

---

## 1. Critical Fixes

### 1.1 Study Chat: Supabase env not validated

**Location:** `functions/api/study/chat.ts`

The handler validates only `GEMINI` and `DATABASE`:

```ts
validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
validateFunctionEnv(env as unknown as Record<string, unknown>, 'DATABASE');
```

It then uses `env.SUPABASE_URL` and `env.SUPABASE_SERVICE_ROLE_KEY` for:

- `downloadPdfFromSupabase` when `resource.storagePath` is set (no `fileUrl`)
- `getCitationHighlightBoxes` when `resource.adobeDataPath` is set

If Supabase env is missing:

- PDF download throws `StudyChatError(400, 'Resource has no fileUrl or storagePath; Supabase env required for storagePath')` — **explicit**.
- Citation fetch **silently** returns fallback boxes: `{ top: 0, left: 0, width: 100, height: 10 }` for every page (no error, wrong UX).

**Fix:** Validate Supabase when the resource actually needs it (e.g. when `resource.storagePath != null` or `resource.adobeDataPath != null`), or add an optional `STORAGE_SUPABASE` preset that includes `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and call it before using Supabase. Optionally return a structured hint when citations are fallback (e.g. `citationsFallback: true`) so the client can hide or adjust overlays.

### 1.2 No authorization on EducationalResource access

**Location:** `functions/api/study/chat.ts`

The endpoint is auth’d (Clerk) but does **not** check whether the requesting user is allowed to use the given `resourceId`. Any authenticated user can call `POST /api/study/chat` with any UUID that exists in `EducationalResource`.

- If resources are meant to be global (e.g. curated textbooks), document that.
- If access should be scoped (e.g. by org, role, or “approved” only), add a check (e.g. `resource.approvalStatus === 'approved'` and/or a user–resource or org–resource check) and return 403 when not allowed.

### 1.3 SmartPDFViewer: Ask the Tutor bubble message is always the same

**Location:** `src/components/library/SmartPDFViewer.tsx` – `handleAskTutor`

The same bubble text is shown when:

- User did not select text (“Select text in the PDF, then click ‘Ask the Tutor’…”).
- User did select text and `onAskTutor` was called (“Sent to tutor” is not communicated).

**Fix:** Differentiate states, e.g.:

- No selection: “Select text in the PDF, then click ‘Ask the Tutor’ to send it to the chat.”
- Success: “Sent to tutor.” or “Context sent. Ask your question in the chat.”

Use a small state (e.g. `askBubbleType: 'hint' | 'sent' | null`) and clear after a timeout.

---

## 2. Logical Omissions

### 2.1 SmartPDFViewer and Study Chat are not wired end-to-end

**Plan:** “Chat with your Library” = PDF viewer + chat that uses `POST /api/study/chat` and displays answer + citation highlights.

**Current state:**

- `POST /api/study/chat` exists and returns `{ answer, citations }` (citations with `highlightBox` in percent).
- `SmartPDFViewer` exists and accepts `highlights` (including `highlightBox` shape) and `onAskTutor`.
- **No screen** in the app:
  - Renders `SmartPDFViewer` with a PDF URL from an `EducationalResource`.
  - Provides a chat input that calls `/api/study/chat` with `resourceId` + `userQuery`.
  - Displays the tutor `answer` and passes `citations` into `SmartPDFViewer` as `highlights`.
  - Wires “Ask the Tutor” to open or focus a Gemini Chat widget with the selected text as context.

So the **Intelligent Study Companion** flow (PDF + chat + citations + Ask the Tutor) is only partially implemented: backend and viewer component exist, but the **integration UI** is missing.

**Recommendation:** Add a “Chat with your Library” or “Study Companion” view (or extend an existing library view) that:

1. Resolves which `EducationalResource` to use (e.g. list/browse endpoint or a fixed resource for MVP).
2. Renders `SmartPDFViewer` with `pdfUrl` (from `resource.fileUrl` or a signed URL), `highlights={citations}` from the last chat response, and `onAskTutor` that opens/focuses the chat with the selected text.
3. Provides a chat input that POSTs to `/api/study/chat` with `resourceId` and `userQuery`, then updates answer and citations state.

### 2.2 No API to list or get EducationalResource for the app

**Location:** API surface

- `content/library` returns **MedicalContent** (conditions), not EducationalResource.
- There is no public/app endpoint that lists or fetches **EducationalResource** (e.g. for a dropdown or “Open textbook” flow).

So even with a Study Companion screen, the client has no standard way to discover which `resourceId` / PDF to use unless it is hardcoded or provided by another system.

**Recommendation:** Add e.g. `GET /api/study/resources` (auth’d) that returns approved EducationalResources with `id`, `title`, `fileUrl` (or signed URL), and optionally `adobeDataPath`; then the Study Companion UI can list or select a resource and pass `resourceId` + `pdfUrl` to the viewer and chat.

### 2.3 Adobe PDF Embed client ID not documented for frontend

**Location:** `SmartPDFViewer` requires `clientId` (Adobe PDF Embed API). No `VITE_*` or env doc references the **PDF Embed** client ID (only Firefly uses `ADOBE_CLIENT_ID` in visualizer).

**Recommendation:** Document that the app needs an Adobe PDF Embed API client ID (e.g. `VITE_ADOBE_PDF_EMBED_CLIENT_ID`) and pass it into SmartPDFViewer; add to env docs and example `.env.example` if present.

---

## 3. Technical Debt

### 3.1 Duplicate coordinate conversion (DRY)

**Locations:**

- `functions/api/study/chat.ts`: `adobeBoundsToPercent(x, y, width, height, pageWidth, pageHeight)` — PDF bottom-left to percent.
- `src/components/library/SmartPDFViewer.tsx`: `pdfBoundsToPercent(x, y, w, h, pageWidth, pageHeight)` — same formula.

Same math in two places; if the convention or clamping rules change, both must be updated.

**Recommendation:** Extract a small shared util (e.g. `lib/utils/pdfCoordinates.ts` or `functions/api/_shared/pdfCoordinates.ts`) that exports `pdfBoundsToPercent`. Backend and frontend can both use it; ensure the shared file has no Node-only or Prisma deps so it’s safe for Edge and client (or split into two thin wrappers that call one core implementation).

### 3.2 study/chat backend citation fallback is silent

**Location:** `functions/api/study/chat.ts` – `getCitationHighlightBoxes`

On Supabase fetch failure or missing `adobeDataPath`, the function returns one full-width box per page and does not signal that these are fallbacks. The frontend cannot tell “no real coordinates” from “one big highlight.”

**Recommendation:** Either return a flag (e.g. `citationsFallback: true`) when using fallback boxes, or return `citations: []` when no Adobe data is available and let the UI show only the answer (no overlays). Prefer explicit over silent fallback.

### 3.3 SmartPDFViewer: Liquid Mode re-init may leave previous viewer in DOM

**Location:** `src/components/library/SmartPDFViewer.tsx` – effect with `[..., liquidMode]`

When `liquidMode` toggles, the effect cleanup sets `viewerPromiseRef.current = null` and `setViewerReady(false)` but does not call any Adobe API to destroy the previous viewer. A new `previewFile` is then run on the same `divId`. Behavior depends on the SDK (often replaces content); if it does not, you could end up with duplicate or stale viewers.

**Recommendation:** Rely on Adobe docs for “re-init on same div”; if they recommend a destroy API, call it in the cleanup. Otherwise add a brief comment that cleanup only clears refs and that the SDK replaces content on the next `previewFile`.

### 3.4 Two “library” component roots

**Locations:** `components/library/` (root) vs `src/components/library/`

- Root: `ClinicalReferenceLibrary`, `LibrarySidebar`, etc.
- `src`: `SmartPDFViewer` (and its barrel).

Conventions allow both `@/` and `@src/`; the plan explicitly asked for `src/components/library/SmartPDFViewer.tsx`, so this is intentional. It does split “library” across two trees.

**Recommendation:** Keep as-is; document in a short “Library & Study” doc that condition/reference UI lives under `components/library/` and PDF/Study Companion UI under `src/components/library/`, so future contributors know where to add related code.

---

## 4. Verification Steps

Run these to confirm behavior and catch regressions:

1. **Study Chat API**
   - With valid auth, `POST /api/study/chat` with `{ resourceId: "<valid-UUID>", userQuery: "What is hypertension?" }`.
   - Expect 200 and `{ answer: string, citations: Array<{ page, highlightBox }> }`.
   - Use a `resourceId` that has `fileUrl` or `storagePath`, and (for citations) `adobeDataPath` set.
   - With missing Supabase env and a resource that has `adobeDataPath`: confirm you get 200 with fallback citation boxes (and no error). After adding env validation, confirm appropriate 500 or structured response when Supabase is required but missing.
   - With invalid or non-existent `resourceId`: expect 404.
   - Unauthenticated: expect 401.

2. **SmartPDFViewer**
   - Render `SmartPDFViewer` with a public PDF URL, valid `clientId`, and `highlights` (e.g. one item with `highlightBox: { top: 10, left: 10, width: 80, height: 5 }`). Confirm the overlay appears on the correct page.
   - Toggle Liquid Mode: confirm viewer re-inits and no duplicate iframe/viewer.
   - With Liquid Mode on and `highlights.length > 0`: confirm the amber “highlights disabled” banner.
   - Click “Ask the Tutor” with no selection: confirm the hint bubble. Select text, then “Ask the Tutor”: confirm `onAskTutor` is called with that text and (after fix) a “Sent”-style message.

3. **Integration**
   - When a “Chat with your Library” (or Study Companion) screen exists: open a resource, send a question, confirm answer and citation highlights appear and that “Ask the Tutor” sends selected text into the chat flow.

4. **Env**
   - Deploy or run study/chat with `DATABASE_URL` and `GEMINI_API_KEY` set but Supabase vars unset; use a resource with `storagePath` or `adobeDataPath`. Confirm behavior and that after fixes, validation or responses are clear.

5. **Security**
   - As user A, call study/chat with a `resourceId` that might “belong” to another org or be unapproved. After you add authorization, confirm 403 when not allowed.

---

## Summary Table

| Category           | Item                                      | Severity   | Status |
|--------------------|-------------------------------------------|------------|--------|
| Critical           | Supabase env not validated for study/chat | High       | **Fixed:** validate when resource has storagePath or adobeDataPath |
| Critical           | No resource-level auth on study/chat      | Medium–High| **Fixed:** 403 when approvalStatus !== 'approved' |
| Critical           | Ask the Tutor bubble same for all cases   | Low        | Differentiate “hint” vs “sent” |
| Logical Omission   | No UI wiring SmartPDFViewer + study/chat | High       | Open: add Study Companion view |
| Logical Omission   | No API to list/get EducationalResource    | High       | Open: add e.g. GET /api/study/resources |
| Logical Omission   | Adobe PDF Embed clientId not documented   | Low        | **Fixed:** docs/STUDY_COMPANION_ADOBE_EXTRACT.md |
| Technical Debt     | Duplicate pdfBoundsToPercent               | Low        | **Fixed:** lib/utils/pdfCoordinates.ts |
| Technical Debt     | Silent citation fallback                   | Medium     | **Fixed:** response includes citationsFallback when true |
| Technical Debt     | Liquid Mode cleanup / re-init              | Low        | Open: comment only |
| Technical Debt     | Two library component roots                | Doc-only   | Open |

This audit focuses on the Study Companion backend, SmartPDFViewer, and the missing integration layer; it does not re-audit the full Personalized Knowledge Engine plan (e.g. Drive, video, Anki) unless directly related to this flow.
