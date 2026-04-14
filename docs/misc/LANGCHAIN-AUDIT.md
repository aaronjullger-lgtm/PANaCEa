# LangChain Usage Audit

Date: 2026-04-13 | Project: PANaCEa

## Round 1 Findings (8 total — all resolved)

1. FIXED - Deprecated model constructor parameters
   models.ts used openAIApiKey, anthropicApiKey, modelName → replaced with apiKey/model

2. FIXED - routeStructured manual JSON parsing
   Now uses withStructuredOutput() with JSON-prompt + Zod fallback

3. FIXED - Question generation no schema validation
   Added Zod QuestionItemSchema + QuestionResponseSchema

4. FIXED - Content generation no schema validation
   Added Zod schemas for all 5 content types

5. FIXED - Triplicated JSON parser
   parseJsonResponse exported from router.ts

6. FIXED - Base langchain package unused
   Uninstalled; using only @langchain/* modular packages

7. FIXED - globalThis mutation in Edge
   Migrated to per-request LangChainTracer callbacks via RunnableConfig

8. FIXED - No LCEL usage
   Adopted ChatPromptTemplate.fromMessages() + formatMessages() in all chains

## Round 2 Findings (5 total — all resolved)

9. FIXED - autoAuthor not wired to LangChain
   index.ts now uses langchainContentGenerator instead of direct Gemini SDK

10. FIXED - ContentGenerationResult type mismatch
    Unified provider/latencyMs/tokensUsed across autoAuthor types and chain types

11. FIXED - content-quality-loop direct API call
    Replaced raw fetch to generativelanguage.googleapis.com with routeTask

12. FIXED - configureLangSmithEnv still exported
    Removed from tracing.ts, index.ts barrel, and tests (zero callers)

13. FIXED - No content generation chain tests
    Added 8 tests covering all 5 content generation functions + error paths

## Files Modified (Round 1)

- lib/langchain/models.ts, router.ts, tracing.ts, index.ts
- lib/langchain/chains/questionGeneration.ts, contentGeneration.ts
- lib/services/autoAuthor/langchainContentGenerator.ts
- functions/api/questions/generate-rag.ts, functions/api/_shared/ai-service.ts
- tests/langchain.test.ts, package.json

## Files Modified (Round 2)

- lib/services/autoAuthor/types.ts — widened ContentGenerationResult
- lib/langchain/chains/contentGeneration.ts — added tokensUsed field
- lib/services/autoAuthor/langchainContentGenerator.ts — pass through provider/latencyMs
- lib/services/autoAuthor/index.ts — switched to LangChain content generator
- functions/api/cron/content-quality-loop.ts — replaced direct fetch with routeTask
- lib/langchain/tracing.ts — removed configureLangSmithEnv
- lib/langchain/index.ts — removed configureLangSmithEnv from exports
- tests/langchain.test.ts — removed deprecated tests, added 8 content gen tests

## Test Coverage

- Round 1: 31 tests (config, models, env adapter, tracing, router, question gen)
- Round 2: +8 tests (37 total — all 5 content gen functions + error paths + metadata)
- Full suite: 233/233 test files pass, 3706/3707 tests pass

## Out of Scope (intentional)

- 144 files using direct Gemini SDK (vision, embeddings, streaming — specialized)
- Developer scripts with direct AI (not production code)
- Vercel AI SDK endpoints (intentional dual-stack architecture)
- lib/services/question/generationService.ts (separate concern from autoAuthor)
