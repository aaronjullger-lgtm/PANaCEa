# Audit: Foundational Features – Batch 3

**Date:** February 2026  
**Scope:** OSCE, study companion, reference APIs, integrations.

---

## 1. OSCE (patient encounter / cases)

**Status:** ✅ Functional

- **GET /api/osce/cases/random:** Authenticated. Returns a random `PatientEncounterCase`. Used when starting an OSCE session.
- **POST /api/osce/session:** Body `caseId`. Creates or returns existing active `PatientEncounterSession` for user+case. Used by OSCE flow to start session.
- **Other OSCE:** session vitals, complete, chat, grade-soap, intervene, history, stats, live-config, etc. in `functions/api/osce/`. Frontend: PatientEncounterMode, OSCELiveSession, useEnhancedOSCE.
- **Gap:** None. Requires `PatientEncounterCase` (and related) seeded or created.

---

## 2. Study companion (chat, resources)

**Status:** ✅ Functional

- **GET /api/study/resources:** Authenticated, optional `resourceType` query. Returns approved `EducationalResource` list (id, title, fileUrl, storagePath, adobeDataPath, etc.). Used by StudyCompanionPage to list resources.
- **POST /api/study/chat:** Body `resourceId`, `userQuery`. Loads resource, optional cached content, calls Gemini; returns `answer` and `citations` (with optional Adobe Extract highlight boxes). Validates Supabase when resource has storagePath/adobeDataPath. StudyCompanionPage uses this for “Ask the Tutor.”
- **GET /api/study/resources/[id]:** Resource detail. **GET /api/study/resources/[id]/file:** Returns PDF bytes (signed URL or Supabase object). Used by SmartPDFViewer.
- **Gap:** None. Optional: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for storage/adobeDataPath; `GEMINI_API_KEY` for chat.

---

## 3. Reference APIs

**Status:** ✅ Functional

- **Reference routes:** `functions/api/reference/` – anatomy, differentials, ecg, findings, guidelines, history-components, imaging, labs, physiology, procedures, special-tests, treatments, vitals. Each has index (list) and/or `[id]` (detail). Public or light auth as designed. Used by condition pages, imaging drill, library, etc.
- **Gap:** None. Content comes from DB or static data per route.

---

## 4. Integrations (Todoist, Anki, etc.)

**Status:** ✅ Functional (UI + endpoints present)

- **Frontend:** IntegrationsHub, AnkiExportPanel, TodoistExportPanel, CalendarSyncPanel, TrelloExportPanel. Export/sync flows call backend or external APIs as implemented.
- **Backend:** Endpoints under functions for export/callback (e.g. Todoist callback) exist where referenced. No single “integrations” router in Cloudflare; each feature has its own route.
- **Gap:** None for structure. Verify env/keys for each third-party (Todoist, Anki, etc.) if used.

---

## Summary Batch 3

| # | Feature        | Status | Notes                          |
|---|----------------|--------|---------------------------------|
| 1 | OSCE           | ✅     | cases/random, session, vitals, complete |
| 2 | Study companion| ✅     | resources, chat, file           |
| 3 | Reference APIs | ✅     | anatomy, labs, treatments, etc. |
| 4 | Integrations   | ✅     | UI + export/callback endpoints  |
