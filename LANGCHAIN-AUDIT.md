# LangChain Usage Audit

Date: 2026-04-13 | Score: PANaCEa

## Findings

1. FIXED - Deprecated model constructor parameters (Score 38/50)
   models.ts used openAIApiKey, anthropicApiKey, modelName

2. FIXED - routeStructured manual JSON parsing (Score 36/50)
   Now uses withStructuredOutput with fallback

3. FIXED - Question generation no schema validation (Score 33/50)
   Added Zod QuestionItemSchema + QuestionResponseSchema

4. FIXED - Content generation no schema validation (Score 30/50)
   Added Zod schemas for all 5 content types

5. FIXED - Triplicated JSON parser (Score 22/50)
   parseJsonResponse exported from router.ts

6. DEFERRED - Base langchain package unused (Score 20/50)
   Needs Aaron approval to uninstall

7. DEFERRED - globalThis mutation in Edge (Score 18/50)
   Low risk single-tenant

8. ACKNOWLEDGED - No LCEL usage (Score 15/50)
   Improvement opportunity only

## Ownership: AI SDK for simple structured output, LangChain for multi-provider fallback

## Chain Inventory: 12 chains total, all with tracing and error handling

See full audit in conversation for detailed evidence and code changes.
