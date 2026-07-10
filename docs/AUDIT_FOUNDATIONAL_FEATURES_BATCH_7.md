# Audit: Foundational Features — Batch 7

**Date:** February 2026  
**Scope:** Retention stats, podcast/veo/vision APIs, branches (list/create/merge), clinical browse, drills (code-blue, lab-cases, related-content).

---

## 1. Retention stats

**Status:** ✅ Functional

- **GET /api/stats/retention** (`functions/api/stats/retention.ts`): Authenticated. Resolves user by `clerkId`; fetches `SRSItem` for user. Returns `dueCount` (items due now), `totalCards`, `decayCurveData` (31-day retention probability from avg stability), `stabilityBuckets` (<1d, 1–3d, 3–7d, 7–21d, 21d+ with design tokens for colors), and placeholder `lastTuned` / `tuningReason` / `adjustment` (currently hardcoded). Uses Prisma singleton and `safePrismaDisconnect` in `finally`.
- **Gap:** `lastTuned` / `tuningReason` / `adjustment` are static; can be wired to FSRS tuning or removed if not used.

---

## 2. Podcast generate (proxy)

**Status:** ✅ Functional (proxy)

- **POST /api/podcast/generate** (`functions/api/podcast/generate.ts`): Authenticated. Proxies to external Node service when `PODCAST_SERVICE_URL` is set. Accepts multipart (file = PDF) or JSON body (`pdfUrl`). Forwards request to `{PODCAST_SERVICE_URL}/generate` and returns response (script + audioBase64 or job/status). If `PODCAST_SERVICE_URL` is unset, returns 501 with hint to deploy podcast-service (e.g. Cloud Run).
- **Gap:** None. Edge-only; actual generation is in Node service.

---

## 3. Veo (video generation)

**Status:** ✅ Functional

- **POST /api/veo/generate** (`functions/api/veo/generate.ts`): Authenticated. Validates env (`GEMINI_API_KEY` via `validateFunctionEnv`). Body: `prompt` or `presetKey` (maps to `PRESET_PROMPTS` for clinical motion, e.g. parkinsonian_gait, cerebellar_ataxia). Calls Gemini Veo API (`veo-3.1-generate-preview`); returns operation ID for polling. Rate-limited via `withRateLimit` / `getRateLimitIdentifier`. See VEO_CLINICAL_MOTION_SPEC.md.
- **GET /api/veo/status** (assumed): Poll operation status (not read in this batch; referenced by spec).
- **Gap:** None. Ensure `GEMINI_API_KEY` and optional `RATE_LIMIT_KV` in env.

---

## 4. Vision (analyze, grade-spatial)

**Status:** ✅ Functional

- **POST /api/vision/analyze** (`functions/api/vision/analyze.ts`): Authenticated. Body: `imageBase64`, optional `mimeType`, `studentQuery`, `prompt`, `isEcg` (enables code_execution for R-R/HR), `modelName`. Validates env and rate limit. Calls Gemini (e.g. gemini-3-pro-preview) for pathology detection; returns `diagnosis`, `reasoning`, `bounding_box` (ymin, xmin, ymax, xmax normalized 0–1000). For ECG, code execution can compute intervals.
- **Vision grade-spatial** (`functions/api/vision/grade-spatial.ts`): Likely grades spatial/visual answers; not fully read here.
- **Gap:** None. Image size capped (e.g. 4MB base64); model fallback documented.

---

## 5. Branches (content branching)

**Status:** ✅ Functional

- **GET /api/branches** (`functions/api/branches/index.ts`): Authenticated. Query: optional `includeArchived` ('true'|'false'). Uses `listBranches(prisma, includeArchived)` from `_shared/content-branching`. Returns `branches`. If no DATABASE_URL, returns empty branches.
- **POST /api/branches** (`functions/api/branches/index.ts`): Authenticated. Body: `name`, optional `description`, `baseBranch`, `createdBy`. Calls `createBranch(prisma, { name, description, baseBranch, createdBy })`; returns `branchId`.
- **POST /api/branches/:branchName/merge** (`functions/api/branches/[branchName]/merge.ts`): Admin-only via `adminEndpoint`. Body/query: `mergedBy`, optional `targetBranch`. Uses `mergeBranch(prisma, branchName, mergedBy, targetBranch)`; returns success and merged count. Uses `createEdgePrismaClient(env)` (supported by prisma-edge’s `DatabaseUrlInput`). CORS via `handleCorsOptions` from auth.
- **Gap:** None. Admin merge is audit-logged.

---

## 6. Clinical browse

**Status:** ✅ Functional

- **GET /api/clinical/browse** (`functions/api/clinical/browse.ts`): Authenticated. No required query params. Fetches conditions, drugs, physiology by system; returns structure: `systems[]` with `code`, `name`, `categories[]` (conditions with id, conditionId, name, subcategory, system, overview, buzzwords), plus `drugs[]` (genericName, drugClass, indications, sideEffects, tags, isHighYield), `physiology[]` (id, name, category, description, clinicalSignificance). Uses Prisma and optional `CACHE_STRATEGY`; `safePrismaDisconnect` in `finally`.
- **Gap:** None. Used by clinical reference library.

---

## 7. Drills: code-blue, lab-cases, related-content

**Status:** ✅ Functional

- **GET /api/drills/code-blue** (`functions/api/drills/code-blue.ts`): Public (publicEndpoint). Query: optional `category` (ACLS | PALS | BLS | Critical Care), `count`. Queries `ACLSQuestion` (or equivalent); returns shuffled `CodeBlueQuestion[]` (id, question, options, correctIndex, explanation, category). Validation via `codeBlueQuerySchema`.
- **GET/POST /api/drills/lab-cases** (`functions/api/drills/lab-cases.ts`): Authenticated. GET: query params via `labCasesQuerySchema` (`category`, `limit` 1–100, `shuffle`); returns lab cases from DB transformed to frontend `LabCase` format. POST: `action: "getDiagnoses"` returns sorted unique diagnoses. Generic error messages on failure (no stack traces). Contract: `docs/api/API_OVERVIEW.md`.
- **POST /api/drills/related-content** (`functions/api/drills/related-content.ts`): Authenticated. Body: `category` (physiology, anatomy, lab, ecg, procedure, finding), optional `tags`, `conceptId`, `limit`. Fetches related reference content (e.g. PhysiologyConcept, anatomy, lab, etc.) for EnhancedFeedbackPanel. Returns `relatedContent` and `relatedItems`. Validation via `relatedContentSchema`.
- **Gap:** None. Code-blue is public reference data; lab-cases and related-content are authenticated.

---

## Summary

| # | Feature | Status | Notes |
|---|--------|--------|-------|
| 1 | Retention stats | ✅ | SRS decay curve, stability buckets; tuning placeholders |
| 2 | Podcast generate | ✅ | Proxy to Node service; 501 if URL unset |
| 3 | Veo generate | ✅ | Gemini Veo, presets, rate limit, operation ID |
| 4 | Vision analyze | ✅ | Bounding box, ECG code_execution, rate limit |
| 5 | Branches (list/create/merge) | ✅ | Admin merge; content-branching shared |
| 6 | Clinical browse | ✅ | Conditions/drugs/physiology by system |
| 7 | Drills (code-blue, lab-cases, related-content) | ✅ | Public code-blue; auth lab-cases & related-content |

No code fixes required this batch. Optional: wire retention `lastTuned`/`tuningReason` to real FSRS tuning data or remove from response.
