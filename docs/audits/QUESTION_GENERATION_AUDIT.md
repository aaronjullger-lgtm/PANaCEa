# Question Generation Audit

Date: 2026-05-02

Readiness after this pass: **72/100 (C)**. The learner-facing study-session dynamic generation blocker was fixed, but generated content still needs a single schema, prompt registry, and validation workflow before it can be trusted broadly.

## Question Generation Table

| Step | Current Logic | Expected Logic | Files | Status | Blockers | Fix |
|---|---|---|---|---|---|---|
| Input selection | Topic/system/difficulty assembled in several routes | Canonical request object with user goal, exam, topic, difficulty | `generate-enhanced.ts`, `generate-batch.ts`, `_shared/question-generator.ts` | Fragmented | Inconsistent difficulty/taxonomy | Create `GeneratedQuestionRequest` |
| Prompt construction | Hardcoded prompts in multiple files | Central prompt templates with version IDs | Same plus `lib/questionGenerator.ts` | P1 | Duplicate prompts | Move to prompt registry |
| AI call | Gateway in some paths; direct/manual in others | Gateway structured call with timeout and model policy | `aiGateway.ts`, direct Gemini routes | P1 | Provider bypass | Enforce gateway |
| Response parsing | `JSON.parse`, regex extraction, some Zod | Strict schema parse; no fallback raw object | `lib/questionGenerator.ts`, `parseQuestionResponse` | P1 | Bad AI can pass | Fail closed on schema errors |
| Answer validation | Some checks for answer/options | Correct answer must match exactly one option | validators, `_shared/question-generator.ts` | Partial | Contract drift | Shared validator |
| Distractor rationales | Required in some schemas, absent in examples | One rationale per incorrect choice | `question-schema.ts`, prompts | P1 | Mismatched keys | Choice-ID keyed rationales |
| Metadata | Free strings and inconsistent maps | Canonical system/category/topic/blueprint IDs | `blueprint.ts`, `topic-map.ts` | P1 | Taxonomy drift | Normalize before storage |
| Storage | Staging and pregenerated content; session shortage now fails safe | Stage only until validated/approved | `study/session/generate.ts`, staging files | Fixed/P1 | Remaining schema/review fragmentation | Keep generated content pending until review |
| Retrieval | Selectors mix active production filters | Shared `isProductionStudyQuestion` predicate | `custom-session.ts`, `smart-review.ts` | P1 | Filter bypass | Apply shared predicate |

## Blockers

- **P0 Fixed:** `functions/api/study/session/generate.ts` previously generated missing questions on demand, persisted `PreGeneratedQuestion` records as approved, and served them immediately. It now logs the shortage, returns only safe available content, and the unused persistence helper writes `pending` records if reactivated.
- **P1 Confirmed:** `functions/api/_shared/question-generator.ts` prompt examples and schema expectations disagree around explanation/distractor fields.
- **P1 Confirmed:** `functions/api/questions/generate-enhanced.ts` can return `verified: false` content to callers.
- **P1 Confirmed:** `lib/langchain/chains/questionGeneration.ts` falls back to returning raw parsed JSON after schema validation failure.
- **P1 Confirmed:** Several session/review routes do not consistently enforce approved-content lifecycle fields.

## File-Level Repair Plan

1. `lib/schemas/generatedQuestion.ts`: create canonical Zod schema with stem, choices, correct choice ID, explanation, distractor rationales, learning objective, taxonomy, difficulty, and source/provenance fields.
2. `lib/ai/prompts/questionGeneration.ts`: centralize prompt variants with a required schema version.
3. `functions/api/_shared/question-generator.ts`: replace prompt-local contracts with canonical prompt/schema; fail closed on parse errors.
4. `lib/langchain/chains/questionGeneration.ts`: remove raw-object fallback after Zod failure.
5. `functions/api/study/session/generate.ts`: completed active-path learner-facing dynamic generation block; add dedicated regression coverage around shortage metadata and pending-only generated persistence if this helper is kept.
6. `lib/services/questionEligibility.ts`: add shared production eligibility predicate and reuse in all selectors.
7. Tests: add valid, malformed, missing-rationale, invalid-correct-answer, invalid-taxonomy, and route-safety cases.

## Verification

- Unit tests for schema validation and rejection reasons.
- Route tests proving no unvalidated generated question is returned to a study session.
- Integration test from generation request to staged question, admin validation, promotion, and session retrieval.
