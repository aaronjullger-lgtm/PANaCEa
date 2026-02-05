# Adobe Document Services – Must-Haves & Roadmap

This doc maps product priorities (PDF Extract, PDF Embed, Document Generation, Sign API) to current implementation, env, and next steps.

---

## 1. PDF Extract (Essential)

**Why:** Converts medical textbooks/PDFs into structured data (text, tables, bounds) so you can feed them into Gemini and power citation highlights. Without it, AI features are harder to build.

### Current state

| Piece | Status | Notes |
|-------|--------|-------|
| **Storage of Extract output** | ✅ | `POST /api/content/library/ingest` accepts `resourceId` + `structuredData`, uploads JSON to Supabase, sets `EducationalResource.adobeDataPath`. |
| **Study Companion citations** | ✅ | `POST /api/study/chat` uses `adobeDataPath` to return citation highlight boxes; frontend overlays on PDF. |
| **Extract-from-PDF in app** | ✅ | `POST /api/content/library/extract` submits PDF to Adobe PDF Services (Extract), returns job ID; `GET /api/content/library/extract/status` polls job, on done downloads result zip, extracts `structuredData.json`, runs ingest. |
| **Offline / large PDFs** | Doc | For very large textbooks (e.g. 400+ pages), use a Node/script pipeline (e.g. `@adobe/pdfservices-node-sdk`) and then call **ingest** with the resulting JSON. |

### Env

- `ADOBE_CLIENT_ID`, `ADOBE_CLIENT_SECRET` (same as Firefly; PDF Services uses `https://pdf-services.adobe.io/token`).
- Hostnames: see `docs/deployment/ADOBE_ALLOWLIST.md` (including `pdf-services.adobe.io`, S3 storage host if not using external storage).

### API flow

1. **Start extract:** `POST /api/content/library/extract` with `resourceId` and `pdfUrl` (JSON body). Returns `202` with `jobId`, `resourceId`, `statusUrl`.
2. **Poll until done:** `GET /api/content/library/extract?jobId=...&resourceId=...`. When status is `done`, the server downloads the result zip, extracts `structuredData.json`, uploads to Supabase, updates `adobeDataPath`, and returns `{ status: "done", adobeDataPath }`.
3. **Optional:** Call **ingest** directly if you already have Extract JSON (e.g. from an offline job).

### Limits (Adobe)

- File size: max 100 MB. Page limits: non-scanned 400, scanned 150. Rate: &lt; 25 req/min. See [Extract API limits](https://developer.adobe.com/document-services/docs/overview/pdf-extract-api/howtos/extract-api/#api-limitations).

---

## 2. PDF Embed (Essential)

**Why:** Renders PDFs inside the app with a “premium” feel—students can view, highlight, and annotate directly in the browser.

### Current state

| Piece | Status | Notes |
|-------|--------|-------|
| **Viewer** | ✅ | `SmartPDFViewer` (`components/library/SmartPDFViewer.tsx`) loads Adobe PDF Embed SDK (`documentcloud.adobe.com/view-sdk/main.js`). |
| **Study Companion** | ✅ | Study Companion page uses SmartPDFViewer with `pdfUrl` and citation `highlights`; Ask the Tutor sends selected text to chat. |
| **Liquid Mode** | ✅ | Optional `enableLinearization` for mobile-friendly reflow (best for documents under ~200 pages per file). |

### Env

- **Client:** `VITE_ADOBE_PDF_EMBED_CLIENT_ID` (Adobe PDF Embed API client ID). Register the client for your app domain and `localhost` in [Adobe Document Services](https://developer.adobe.com/console).

### Client-side hostname

- `documentcloud.adobe.com` – only for browser (script + viewer). No server-side allowlist needed for Embed.

### References

- `docs/STUDY_COMPANION_ADOBE_EXTRACT.md` – JSON shape, coordinates, storage.
- `docs/GEMINI_LIVE_AND_SMART_LIBRARY.md` – Liquid Mode, chapter-level PDFs for large textbooks.

---

## 3. Document Generation (High Value)

**Why:** Great for generating “Study Guides” or “Mock Exams” that students can print or download.

### Current state

| Piece | Status | Notes |
|-------|--------|-------|
| **API** | ✅ | `POST /api/documents/generate` accepts `templateKey` (e.g. `study-guide`) or `templateAssetId` + `jsonDataForMerge`, calls Adobe Document Generation API, returns PDF. |
| **Templates** | Config | Use a Word template with Adobe tags; upload to Adobe as asset or provide `DOC_GEN_TEMPLATE_ASSET_ID` in env. |

### Env

- Same as PDF Extract: `ADOBE_CLIENT_ID`, `ADOBE_CLIENT_SECRET`.
- Optional: `DOC_GEN_TEMPLATE_ASSET_ID` – pre-uploaded template asset ID for default study guide / mock exam.

### Flow

1. Create a Word template (e.g. Study Guide) with [Document Generation tags](https://developer.adobe.com/document-services/docs/overview/document-generation-api/).
2. Upload template via PDF Services Assets API once; store returned `assetID` in env or in app config.
3. Call `POST /api/documents/generate` with `jsonDataForMerge` (e.g. title, sections, questions). Response is PDF bytes or a download URL.

### Hostnames

- Same as PDF Extract: `pdf-services.adobe.io`, S3 if not using external storage (see `ADOBE_ALLOWLIST.md`).

---

## 4. Sign API (Would be nice)

**Why:** PA students log “Patient Encounters” and get them signed off by a preceptor. A feature where the student sends a “Rotation Log” and the preceptor signs it inside the app.

### Current state

| Piece | Status | Notes |
|-------|--------|-------|
| **Implementation** | 🔴 Not started | Adobe Sign (or equivalent) would be used for sending agreements and capturing e-signatures. |

### Suggested approach

- Use [Adobe Sign API](https://developer.adobe.com/document-services/docs/overview/document-services-api/) (or another e-sign provider) to create an agreement from a “Rotation Log” PDF, send to preceptor, and record completion.
- Env: separate credentials for Sign if required by Adobe.
- Allowlist: add any Sign-specific hostnames to `functions/api/_shared/adobeAllowlist.ts` (and document in `docs/deployment/ADOBE_ALLOWLIST.md`) when you integrate.

---

## Summary

| Priority | Feature | Status | Key env / API |
|----------|---------|--------|----------------|
| Essential | PDF Extract | ✅ In-app + ingest | `ADOBE_*`, `/api/content/library/extract`, `/extract/status`, `/ingest` |
| Essential | PDF Embed | ✅ | `VITE_ADOBE_PDF_EMBED_CLIENT_ID`, SmartPDFViewer |
| High value | Document Generation | ✅ | `ADOBE_*`, optional `DOC_GEN_TEMPLATE_ASSET_ID`, `/api/documents/generate` |
| Nice-to-have | Sign API | 🔴 | Not started; doc when integrating |
