---
name: "panacea-question-generation"
description: "Use to work on PANaCEa's AI question generation pipeline: primary generation, RAG generation, enhanced/CoVe generation, deep-context generation, batch/refill, staging preview, generation adapters, prompt engineering, and the canonical generated-question schema. Trigger when asked about question generation, AI-generated questions, content generation for study sessions, or the generation/staging pipeline."
---

# PANaCEa Question Generation Pipeline

You own the AI question generation pipeline end-to-end: from prompt engineering through staging preview to approved learner-serving content.

## First Files

- `CLAUDE.md` for AI gateway and safety rules
- `functions/api/questions/generate.ts` — primary generation
- `functions/api/questions/generate-rag.ts` — RAG-augmented generation
- `functions/api/questions/generate-enhanced.ts` — CoVe-enhanced generation
- `functions/api/questions/generate-deep.ts` — deep-context generation
- `functions/api/_shared/generated-question-preview.ts` — shared preview/staging helper
- `functions/api/_shared/canonical-question-mirror.ts` — mirror/approval boundary
- `functions/api/_shared/ai-gateway.ts` — AI gateway client
- `functions/api/admin/question-review.ts` — admin review/approval
- `functions/api/_shared/staging-questions.ts` — staging promotion
- `lib/ai/aiGateway.ts` — gateway abstraction
- `services/ai/batchGeneratorService.ts` — batch generation
- `services/ai/poolMonitorService.ts` — pool monitoring
- `lib/services/conceptQuestionSelector.ts` — serving selector
- `prisma/schema.prisma` — PreGeneratedQuestion, StagingQuestion, Question, QuestionIdentity models

## Architecture

```
Generation → Staging → Review → Approval → Mirror → Serving Pool
   ↑            ↑         ↑         ↑         ↑          ↑
 primary     preview   admin    auto/manual  canonical  selector
 rag         hold      queue    approve      upsert     picks from
 enhanced    staged                              └─ QuestionAnswerChoice
 deep         └─ StagingQuestion                 └─ QuestionExplanation
```

## Rules

- Generated questions must pass staging before they reach learners (fail-closed)
- CoVe-enhanced questions cannot promote live unless staging/provenance persists
- Deep-context generation output is admin-preview-only (`admin_preview_only`)
- Primary and RAG generation failures return typed errors, not exposed ephemeral content
- Pre-generated mirroring must be approved-only and preserve source identity
- Use the shared `generated-question-preview.ts` helper for all generation paths — no ad-hoc staging
- Question answers must normalize to `QuestionAnswerChoice` rows at mirror time (duplicate text guard)
- Explanations must normalize to `QuestionExplanation` with `version=1` and `CORRECT_RATIONALE` type

## Current Gaps (from production scorecard)

1. No canonical generated-question schema/prompt adapter shared across all generation routes
2. Remaining direct AI call sites in clinical-eye/analyze, visualizer routes, cron jobs
3. Vision/image generation routes not yet gateway-centralized
4. Batch/refill still using conservative serving
5. Generated content provenance and citation gaps

## Common Traps

- Letting staging-failed questions leak to learners
- Skipping staging persistence on enhanced/CoVe passed questions
- Using different prompt formats across generation routes
- Direct Gemini `fetch` calls instead of gateway
- Not preserving source identity through the mirror boundary
- Synthetic fallback prose in explanations (must fail closed)

## Tests To Look For

- `functions/api/questions/generate.test.ts`
- `functions/api/questions/generate-rag.test.ts`
- `functions/api/questions/generate-enhanced.test.ts`
- `functions/api/questions/generate-deep.test.ts`
- `functions/api/_shared/generated-question-preview.test.ts`
- `functions/api/_shared/canonical-question-mirror.test.ts`
- `functions/api/_shared/staging-questions.test.ts`
- `functions/api/admin/question-review.test.ts`
- `tests/conceptQuestionSelector.test.ts`

## Verification

```bash
npx vitest run functions/api/questions/generate*.test.ts functions/api/_shared/generated-question-preview.test.ts functions/api/_shared/canonical-question-mirror.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
```
