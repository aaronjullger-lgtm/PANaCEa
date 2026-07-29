# AI Gateway — Call-Site Inventory (Sprint 0)

**Date:** 2026-04-17
**Scope:** Every direct Gemini / `GoogleGenerativeAI` / `GoogleGenAI` usage in the repo, plus every caller of the existing `ai-service.ts` helpers.
**Mandate:** Unify all AI access behind `lib/ai/aiGateway.ts`. No direct model calls outside the gateway.

---

## Current state

The existing `functions/api/_shared/ai-service.ts` (692 lines) is already a partial gateway:

- `callGemini` — direct Gemini REST call with token tracking + Langfuse + CF AI Gateway routing
- `streamGemini` — SSE streaming variant
- `callAIMultiProvider` — routes through `lib/langchain/router.ts` (Gemini → OpenAI → Anthropic → DeepSeek fallback) with fallback to `callGemini` on failure
- `GeminiModel` enum, `selectModel(task)`, `thinkingBudget(level)`

What it's **missing** per the mandate:
- Zod-validated structured outputs per task contract (grading, tutoring, generation, extraction, enrichment)
- Trace IDs / request IDs surfaced in response
- Cost estimates surfaced in response (tokenTracking has them internally but they don't propagate)
- Latency histogram buckets
- Fallback-frequency counter
- Deterministic JSON parser (every caller reimplements regex extraction)
- Explicit retry policy at gateway level (LangChain has retries; direct `callGemini` does not)

The new `lib/ai/aiGateway.ts` wraps `ai-service.ts` and adds the above. Existing callers keep working; new callers use the cleaner surface.

---

## Caller classes

### A. Already routed through `ai-service.ts` (GOOD — mostly)

| File | Function used | Notes |
|---|---|---|
| `functions/api/ai/tutor/chat.ts` | `callGemini` | Needs migration to `gateway.tutor()` for streaming + Zod |
| `functions/api/ai/vision/analyze.ts` | `callGemini` | Extraction contract |
| `functions/api/ai/vision/analyze-3d.ts` | `callGemini` | Extraction contract |
| `functions/api/ai/vision/grade-spatial.ts` | `callGemini` | Grading contract |
| `functions/api/ai/models/index.ts` | `callGemini` | Health/probe endpoint |
| `functions/api/ai/mnemonics/generate.ts` | `callAIMultiProvider` | Generation contract |
| `functions/api/ai/learning/socratic.ts` | `gateway.tutor()` | **Migrated** — ZPD-calibrated Socratic remediation |
| `functions/api/ai/chat/stream.ts` | `streamGemini` (mentioned) | Tutoring stream |
| `functions/api/causal-chain/generate.ts` | `callAIMultiProvider` | Generation contract |
| `functions/api/cron/content-quality-loop.ts` | `routeTask` (direct) | Bypasses ai-service; should go via gateway |
| `lib/services/agents/geminiAgentClient.ts` | `callGemini` | Agent framework |
| `lib/services/contentQualityLoop.ts` | `callGemini` | Content critique/rewrite |

### B. Edge functions bypassing the gateway (HIGH priority migrate)

| File | Subsystem | Model | Fix |
|---|---|---|---|
| `functions/api/questions/generate-enhanced.ts` | Batch generation | `gemini-*` | `gateway.generate()` |
| `functions/api/drills/elaboration/grade.ts` | Grading | `gemini-2.5-flash` | `gateway.grade()` — **migrated in this sprint** |
| `functions/api/drills/contrastive/generate.ts` | Generation | `gemini-2.5-flash` | `gateway.generate()` |
| `functions/api/admin/generate-draft.ts` | Generation (admin) | — | `gateway.generate()` |
| `functions/api/_shared/staging-questions.ts` | Generation helper | — | `gateway.generate()` |
| `functions/api/_shared/question-generator.ts` | Generation helper | — | `gateway.generate()` |

### C. Server-side services bypassing the gateway (MEDIUM priority)

| File | Subsystem | Fix |
|---|---|---|
| `lib/services/session/sessionService.ts` (line 972, 1033) | Session analysis | `gateway.extract()` |
| `lib/services/question/generationService.ts` | Generation pipeline | `gateway.generate()` |
| `lib/services/autoAuthor/contentGenerator.ts` | Enrichment | `gateway.enrich()` |
| `lib/services/causalChainService.ts` | Generation | `gateway.generate()` |
| `lib/services/soapGradingService.ts` | Grading | `gateway.grade()` |
| `lib/services/search/contextualRetrieval.ts` | Enrichment | `gateway.enrich()` |
| `lib/services/semanticValidationService.ts` | Extraction | `gateway.extract()` |
| `services/ai/contextAwareOrchestrator.ts` | Multi (generation + grading) | Split + route |
| `services/ai/automatedContentPipeline.ts` | Enrichment | `gateway.enrich()` |
| `services/ai/batchGeneratorService.ts` | Batch generation | `gateway.generate()` |
| `services/ai/geminiService.ts` | Generic wrapper | **DELETE** after migration |
| `services/core/CoachingService.ts` | Tutoring | `gateway.tutor()` |
| `services/core/stagingQuestionService.ts` | Generation | `gateway.generate()` |
| `services/scribe/soapNoteService.ts` | Grading | `gateway.grade()` |
| `services/domain/geminiService.ts` | Generic wrapper | **DELETE** — duplicate |
| `services/domain/imageQualityService.ts` | Extraction | `gateway.extract()` (vision) |
| `services/domain/educationalResourceService.ts` | Extraction | `gateway.extract()` (vision) |
| `services/domain/clinicalPearlService.ts` | Generation | `gateway.generate()` |
| `lib/questionGenerator.ts` | Generation | `gateway.generate()` |
| `lib/config/environment.ts` | Config only | Keep; references env |

### D. Frontend-side AI call (SECURITY RED FLAG)

| File | Issue |
|---|---|
| `components/modes/osce/OSCELiveSession.tsx` (line 143) | `new GoogleGenAI({ apiKey })` in the **browser**. API key exposed. MUST be moved server-side via `functions/api/osce/live*.ts` + `gateway.tutor()` streaming. |

### E. OSCE engine callers (already partly in ai-service flow)

| File | Subsystem | Notes |
|---|---|---|
| `functions/api/osce/live.ts` | OSCE engine | Inspect for direct calls |
| `functions/api/osce/live-engine.ts` | OSCE engine | Inspect for direct calls |
| `functions/api/osce/evaluate.ts` | Grading | `gateway.grade()` — **migrated** (SPBench 8-dimension rubric) |
| `functions/api/osce/analysis/grade.ts` | Grading | Inspect; likely needs `gateway.grade()` |

### F. Scripts (LOW priority — non-production)

**Active scripts (migrate if still used):**
- `scripts/addNewConditions.ts`, `scripts/addNewTreatments.ts`
- `scripts/content-enrichment.ts`, `scripts/ecg-content-enricher.ts`
- `scripts/condition-doctor.ts`
- `scripts/finalQualityUpgrade.ts`, `scripts/polishAndFillContent.ts`
- `scripts/generateAnatomyContent.ts`, `scripts/generate_content.ts`
- `scripts/generateBasicScienceLinks.ts`
- `scripts/weekly-maintenance.ts`, `scripts/automation/hourlyTasks.ts`
- `scripts/seed-question-pool.ts`
- `scripts/fixes/phase1c-subcategorize.ts`, `phase3c-antibiotic-links.ts`, `phase3c-scoring-system-links.ts`, `phase4a-add-missing-conditions.ts`
- `scripts/generators/*.ts` — all ~20 generator scripts
- `scripts/images/fetch-xray-images.ts`

**Deprecated (DELETE after migration lockdown):**
- `scripts/deprecated/*` — ~12 legacy generator scripts, all with `new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')`

### G. Tests

- `tests/langchain.test.ts` — exercises `routeTask`/`routeStructured`. Keep.
- `tests/aistack-upgrades.test.ts` — keep.
- `tests/errorTypes.test.ts` — keep.
- Gateway tests will live at `lib/ai/aiGateway.test.ts`.

---

## Counts

- **Total files with direct Gemini imports or helper calls:** ~110 (minus docs, configs, package files)
- **Already on gateway helpers:** ~12 endpoints + 2 services
- **Edge endpoints bypassing:** 6 endpoints
- **Server services bypassing:** ~20 files
- **Frontend leak:** 1 file
- **Active scripts:** ~30
- **Deprecated scripts:** ~12

## Migration order (production-risk-weighted)

1. **Sprint 2 (this sprint):** Build `lib/ai/aiGateway.ts` + contracts + schemas
2. **Sprint 3:** Inventory and consolidate prompts into `lib/ai/prompts/*`
3. **Sprint 4 — Ghost Grader / grading:** `drills/elaboration/grade.ts`, `drills/teachback/grade.ts`, `ai/vision/grade-spatial.ts`, `soapGradingService.ts`, `services/scribe/soapNoteService.ts`, `osce/analysis/grade.ts`
4. **Sprint 5 — Socratic tutor:** `ai/tutor/chat.ts`, ~~`ai/learning/socratic.ts`~~ ✅, `ai/chat/stream.ts`, `services/core/CoachingService.ts`
5. **Sprint 6 — OSCE engine:** `osce/live.ts`, `osce/live-engine.ts`, **remove AI from `OSCELiveSession.tsx`** (security critical)
6. **Sprint 7 — Batch generation:** `questions/generate*.ts`, `drills/contrastive/generate.ts`, `admin/generate-*.ts`, `_shared/staging-questions.ts`, `_shared/question-generator.ts`, `lib/services/question/generationService.ts`, `services/ai/batchGeneratorService.ts`, `services/core/stagingQuestionService.ts`, `lib/questionGenerator.ts`, `services/domain/clinicalPearlService.ts`
7. **Sprint 8 — Enrichment + extraction:** `autoAuthor/contentGenerator.ts`, `automatedContentPipeline.ts`, `contextualRetrieval.ts`, `semanticValidationService.ts`, `sessionService.ts` AI path, `services/domain/image*/educational*.ts`
8. **Sprint 9 — Observability + tests + admin panel:** Wire gateway telemetry to Sentry + admin dashboard. Delete `services/{ai,domain}/geminiService.ts`. Purge `scripts/deprecated/*`.

## Architectural rules enforced by the gateway

- No `new GoogleGenerativeAI(...)` anywhere except `functions/api/_shared/ai-service.ts` (which the gateway wraps).
- No `JSON.parse` on model output anywhere except `lib/ai/jsonParser.ts`.
- No hidden fallback: every fallback step emits a counter increment + telemetry event.
- No prompt duplication: prompts live in `lib/ai/prompts/` with typed builders.
- Every task contract has a Zod schema; gateway rejects and retries (with repair prompt) on validation failure.
