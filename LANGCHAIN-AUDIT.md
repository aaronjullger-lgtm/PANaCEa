# LangChain Usage Audit

Date: 2026-04-13 | Score: PANaCEa

## Findings (8 total — all resolved)

1. FIXED - Deprecated model constructor parameters (Score 38/50)
   models.ts used openAIApiKey, anthropicApiKey, modelName
   Replaced with apiKey/model across all 3 provider blocks

2. FIXED - routeStructured manual JSON parsing (Score 36/50)
   Now uses withStructuredOutput() with JSON-prompt + Zod fallback

3. FIXED - Question generation no schema validation (Score 33/50)
   Added Zod QuestionItemSchema + QuestionResponseSchema

4. FIXED - Content generation no schema validation (Score 30/50)
   Added Zod schemas for all 5 content types

5. FIXED - Triplicated JSON parser (Score 22/50)
   parseJsonResponse exported from router.ts

6. FIXED - Base langchain package unused (Score 20/50)
   Uninstalled; using only @langchain/* modular packages

7. FIXED - globalThis mutation in Edge (Score 18/50)
   Migrated to per-request LangChainTracer callbacks via RunnableConfig
   configureLangSmithEnv deprecated (kept for backward compat)

8. FIXED - No LCEL usage (Score 15/50)
   Adopted ChatPromptTemplate.fromMessages() + formatMessages()
   for type-safe prompt construction in all chains
   Extracted generic generateContent<T>() helper in contentGeneration.ts

## Files Modified

- lib/langchain/models.ts — deprecated param cleanup
- lib/langchain/router.ts — tracing config, structured output, parseJsonResponse export
- lib/langchain/tracing.ts — rewritten to callback pattern, deprecated globalThis API
- lib/langchain/chains/questionGeneration.ts — LCEL template, Zod validation, error handling
- lib/langchain/chains/contentGeneration.ts — LCEL template, Zod schemas, generic helper
- lib/langchain/index.ts — added TracingConfigResult type alias
- lib/services/autoAuthor/langchainContentGenerator.ts — removed configureLangSmithEnv
- functions/api/questions/generate-rag.ts — removed configureLangSmithEnv
- functions/api/_shared/ai-service.ts — removed configureLangSmithEnv
- tests/langchain.test.ts — added ChatPromptTemplate + LangChainTracer mocks
- package.json — removed langchain base package

## Ownership: AI SDK for simple structured output, LangChain for multi-provider fallback

## Chain Inventory: 12 chains total, all with tracing and error handling
