# The AI tooling stack PANaCEa actually needs

The single highest-impact upgrade for PANaCEa is adopting the **Vercel AI SDK v6** (`ai` + `@ai-sdk/google`) as the core LLM interface layer, paired with **hybrid search via pg_textsearch + pgvector** in the existing Supabase database. This combination delivers streaming, structured outputs, tool calling, and multi-model routing — all edge-native and Gemini-first — without the abstraction tax of heavier frameworks. LangChain.js has matured to v1.0 but introduces measurable overhead (**2.7× more tokens** per RAG query in benchmarks) and debugging complexity that a solo developer on edge infrastructure should avoid. The rest of this report maps every major tool category to PANaCEa's specific needs, prioritized by incremental adoption cost and clinical impact.

---

## The Vercel AI SDK outperforms LangChain for edge-deployed Gemini apps

**Vercel AI SDK v6** has emerged as the dominant TypeScript LLM framework with **20+ million monthly npm downloads**, used in production by Thomson Reuters, Clay, and Fortune 500 companies. It is not tied to Vercel's hosting — it works on **Cloudflare Workers and Pages Functions** natively because it builds on standard Web APIs (fetch, ReadableStream). Its `@ai-sdk/google` provider offers **first-party Gemini support** including the latest models (gemini-2.5-flash, gemini-3-flash-preview, gemini-3-pro) with thinking budget controls (`thinkingBudgetTokens` for 2.5, `thinkingLevel` for 3.x).

For PANaCEa's existing capabilities, the AI SDK maps cleanly. Clinical tutor streaming becomes `streamText()` with `toDataStreamResponse()` returning SSE-formatted output that a React `useChat` hook consumes directly. OSCE simulation tools become Zod-schema-defined `tool()` functions — `get_vitals`, `reveal_lab`, `perform_physical_exam` — with `stopWhen: stepCountIs(5)` to bound agent loops. Ghost Grader's structured confidence analysis uses `generateObject()` with a Zod schema, producing fully typed output identical to the current approach but with automatic retries and streaming support baked in. The model registry pattern (`createProviderRegistry`) enables routing **gemini-2.5-flash** for quick factual lookups and **gemini-2.5-pro** for complex differential diagnosis — a one-line model switch per endpoint.

**LangChain.js v1.0** (released October 2025) is legitimately production-ready with Cloudflare Workers support via `@langchain/cloudflare`, Supabase vector store integration, and a new `createAgent()` API built on LangGraph. The Gemini integration has consolidated into `@langchain/google` (unified package supporting both AI Studio and Vertex AI). However, the framework's value proposition — provider abstraction, complex chain composition, middleware hooks — primarily benefits teams switching between multiple LLM providers or building intricate multi-step agent workflows. For a Gemini-exclusive app, LangChain's abstractions add bundle weight, token overhead from internal prompt management, and debugging indirection without proportional benefit. The documented **2.7× token inflation** on RAG queries stems from hidden internal LLM calls, suboptimal batching, and redundant context injection that direct SDK calls avoid entirely.

**LlamaIndex.TS** (v0.12.1) remains pre-1.0 with marginal edge compatibility. Its full package **exceeds Cloudflare's 1MB bundle limit**, and its strongest features — PropertyGraphIndex for knowledge graphs, KnowledgeGraphQueryEngine — exist only in the Python version. The TypeScript port is functional for basic RAG prototyping but adds abstraction without edge reliability. Skip it.

The practical recommendation is clear: adopt `ai` + `@ai-sdk/google` for all LLM interactions, replacing direct `@google/generative-ai` SDK calls. The migration is incremental — each endpoint can be converted independently, and the AI SDK's tool-calling and streaming patterns subsume what LangChain's chains would provide with a fraction of the complexity.

---

## Hybrid search in Postgres eliminates the need for a dedicated vector database

At PANaCEa's expected scale of **50,000–200,000 clinical content chunks**, the existing Supabase pgvector + HNSW architecture is the right foundation. Dedicated vector databases — Pinecone ($0.33/hr pods), Weaviate Cloud ($25+/month), Qdrant Cloud ($25+/month) — add operational complexity, network latency from edge functions, and cost without meaningful performance gains at this vector count. The HNSW index in pgvector handles sub-10ms similarity search on datasets up to several hundred thousand vectors comfortably on a Supabase Pro instance.

The critical upgrade is adding **BM25 lexical search** alongside vector search for hybrid retrieval. Medical content has a unique failure mode: vector search excels at semantic matching ("what causes chest pain in young adults") but fails on exact terminology that clinicians depend on — drug names like "metoprolol succinate," ICD-10 codes like "E11.65," or abbreviations like "STEMI." BM25 catches these exact matches. Anthropic's benchmarks show hybrid search **reduces retrieval failures by 49%**, rising to **67% when reranking is added**.

**pg_textsearch** (from Timescale, currently in preview) brings native BM25 ranking directly into Postgres with a `USING bm25()` index type and a `<@>` operator. Combined with pgvector via **Reciprocal Rank Fusion (RRF)** in a single SQL query, this delivers hybrid search without leaving the database:

```sql
WITH bm25 AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY content <@> to_bm25query($1)) as rank
  FROM clinical_chunks LIMIT 20
),
vector AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $2) as rank
  FROM clinical_chunks LIMIT 20
)
SELECT id, 1.0/(60+bm25.rank) + 1.0/(60+vector.rank) as score
FROM bm25 FULL JOIN vector USING (id)
ORDER BY score DESC LIMIT 10;
```

If pg_textsearch isn't available on Supabase yet, **ParadeDB's pg_search** extension provides production-ready BM25 with phrase matching and fuzzy search. Either approach keeps the entire retrieval pipeline in Postgres, preserving ACID compliance and simplifying the architecture for a solo developer.

For embedding models, Google's text-embedding-005 is competent but not optimized for medical text. **MedTE** (2025) achieves state-of-the-art on the MedTEB benchmark (51 medical tasks), trained on PubMed, MIMIC-IV, ClinicalTrials.gov, and MedQA corpora. **PubMedBERT embeddings** (768-dim, 141K+ downloads) offer a proven baseline. For a production upgrade without self-hosting models, **Voyage 4** or **Gemini Embedding 2** (3072-dim, Matryoshka-capable) provide the best API-accessible retrieval quality. Matryoshka embeddings are particularly useful — store full 3072-dim vectors but use truncated 256-dim for fast preliminary filtering, then rerank with full dimensions.

---

## Advanced RAG patterns that matter most for clinical accuracy

Not all RAG improvements are equally valuable. For medical education content, three patterns deliver outsized impact while remaining practical for a solo developer.

**Contextual retrieval** is the highest-ROI improvement. Before embedding each chunk at ingestion time, an LLM prepends context explaining where the chunk fits in the source document. A chunk saying "the treatment protocol involves daily subcutaneous injections" becomes "This section from the Type 2 Diabetes management guidelines describes the insulin therapy protocol, specifically the treatment protocol involves daily subcutaneous injections." This one-time preprocessing step **reduces retrieval failure by 35%** with contextual embeddings alone. At roughly **$1.02 per million document tokens** of processing cost, it's a one-time investment that permanently improves every subsequent query. Gemini's prompt caching (75% discount on cached content via `@ai-sdk/google`) makes this even cheaper when processing documents in batches.

**Parent-child chunking** is the second priority. Create a two-tier hierarchy: parent chunks of 800–1,500 tokens preserving section context and child chunks of 200–400 tokens optimized for retrieval precision. Search against child embeddings but return parent chunks to the LLM. When a student queries "atrial fibrillation treatment," the child chunk about rate control matches precisely, but the parent returns the full cardiac arrhythmia classification with context about when rhythm control is preferred — exactly what a studying PA student needs.

**Corrective RAG** is essential for clinical safety. After retrieval, a lightweight grader (gemini-2.5-flash is fast and cheap enough) evaluates whether retrieved documents actually answer the query. If relevance scores fall below a threshold, the system triggers fallback retrieval from PubMed or clinical guideline databases before generating a response. For medical education, this self-correction loop prevents the system from hallucinating clinical information when the knowledge base lacks coverage — a critical safety property.

HyDE (Hypothetical Document Embeddings) adds value selectively for complex clinical reasoning queries but introduces per-query LLM latency. Route it through query classification: simple factual queries ("what is the half-life of warfarin") go straight to hybrid search, while complex reasoning queries ("how to manage a diabetic patient with renal complications and contraindications to metformin") get HyDE expansion first. GraphRAG — building knowledge graphs from medical literature for traversal-based retrieval — is powerful for differential diagnosis and drug interaction queries but represents a Phase 2 investment requiring a graph database (Neo4j) and substantially more engineering effort.

---

## Mastra is the TypeScript-native agent framework for OSCE simulation

For PANaCEa's OSCE live simulation, the agent framework choice is constrained by language and runtime. **CrewAI** (the leading multi-agent framework with PwC, IBM, and NVIDIA as users) is **Python-only with no official TypeScript SDK** and no published roadmap for one. **Microsoft's AutoGen** merged into the Microsoft Agent Framework in October 2025 and is now in maintenance mode — also Python/.NET only. Neither works on Cloudflare edge.

**Mastra** fills this gap as the production-ready TypeScript-native agent framework. Built by the founders of Gatsby.js with Y Combinator backing, it has **22,000+ GitHub stars** and **300,000+ weekly npm downloads**. Replit, PayPal, and Brex use it in production. Architecturally, Mastra is built on the Vercel AI SDK, so adopting both is complementary — Mastra adds structured agent orchestration, state-machine workflows with suspend/resume (critical for human-in-the-loop OSCE scenarios), and an evaluation framework for testing agent quality.

For OSCE encounters, the tool-use pattern maps directly. Define clinical tools as Zod-schema functions — `get_vitals({ patientId })`, `reveal_lab({ testName })`, `perform_physical_exam({ region })`, `check_medication({ drugName, includeInteractions })` — and let the agent decide when to expose information based on the student's questions, exactly mimicking how a standardized patient reveals clinical data only when asked appropriately. The state-machine workflow pattern handles the encounter flow: history → physical exam → differential → workup → diagnosis → management plan, with the ability to suspend for student input at each stage.

For simpler agent needs (single-agent tool loops without multi-agent orchestration), the **Vercel AI SDK's built-in `ToolLoopAgent`** is sufficient and avoids adding another dependency. Use Mastra when the OSCE simulation needs stateful multi-turn workflows with branching logic, and the AI SDK's native tool calling for straightforward tutor interactions.

---

## Medical APIs provide free clinical validation infrastructure

Three free government APIs can systematically validate AI-generated clinical content and enrich OSCE simulations.

**RxNorm** (NLM) provides normalized drug naming and interaction checking at **rxnav.nlm.nih.gov/REST** — no API key required, 20 requests/second rate limit. The `/interaction/interaction.json?rxcui={id}` endpoint returns drug-drug interactions sourced from DrugBank and ONCHigh. For question generation, every AI-produced medication reference can be validated against RxNorm's canonical naming, and every multi-drug clinical scenario can be checked for interaction accuracy. The standalone Drug-Drug Interaction API was discontinued in January 2024, but interaction data remains accessible through the main interaction endpoints.

**UMLS** (Unified Medical Language System) maps between **100+ medical vocabularies** — SNOMED CT, ICD-10, LOINC, MeSH, RxNorm, CPT — through a single API. With a free individual license, queries to `uts-ws.nlm.nih.gov/rest` can cross-reference any clinical concept across terminologies. For PANaCEa, this enables validating that AI-generated questions use standardized medical terminology and that differential diagnoses include appropriate ICD-10 mappings aligned with the **2025 PANCE Content Blueprint** (effective through 2027, covering 460+ specific clinical topics across organ systems).

**OpenFDA** provides structured drug labeling, adverse event reports (FAERS database), and recall data — valuable for generating pharmacology questions with real-world adverse event data. The caveat is clear: OpenFDA explicitly states data should not be used for clinical decisions, but it's ideal for educational content generation.

---

## Observability and evaluation tools close the quality loop

For a solo developer, the observability stack should be minimal but provide two critical capabilities: tracing individual LLM calls to debug quality issues, and systematically evaluating output quality over time.

**Langfuse** (open-source, MIT-licensed, **19K+ GitHub stars**) is the recommended observability platform. It's framework-agnostic (works with direct Gemini SDK calls, the Vercel AI SDK, or LangChain), self-hostable for data sovereignty, and its v3 architecture is fully OpenTelemetry-native. The free cloud tier provides **50,000 observations/month** — sufficient for development and early production. It tracks traces, manages prompt versions, and runs LLM-as-judge evaluations. For a Cloudflare-deployed app, Langfuse's cloud offering avoids self-hosting complexity.

For cost tracking and caching at the gateway level, **Cloudflare AI Gateway** is the zero-friction option — already in the deployment stack, providing analytics, response caching at edge (configurable TTL up to one month), and rate limiting across AI providers at no additional cost. This handles semantic caching for repeated similar queries (common in an education app where students ask variations of the same question) without adding infrastructure.

**DSPy** (Stanford, v2.x) deserves attention for question generation quality despite being Python-only. It programmatically optimizes prompts using evaluation data, delivering **10–40% quality improvements** on structured tasks in benchmarks. The workflow is: define input/output signatures, provide example evaluations, and DSPy's optimizers (MIPROv2, GEPA) compile optimal prompts automatically for roughly **$2 and 20 minutes** per optimization run. For PANaCEa, maintaining a Python script that periodically optimizes question-generation prompts using DSPy, then exporting the optimized prompts to the TypeScript app, is a practical hybrid approach.

For evaluating clinical question quality and RAG accuracy, **DeepEval** provides open-source multi-turn evaluation with metrics for hallucination, answer relevance, faithfulness, and contextual precision. **RAGAS** (Retrieval-Augmented Generation Assessment) specifically evaluates RAG pipeline quality with metrics like context recall, answer correctness, and faithfulness to retrieved sources — critical for verifying that clinical tutor responses accurately reflect the knowledge base.

---

## A phased adoption roadmap for a solo developer

Rather than a full rewrite, PANaCEa benefits from incremental upgrades prioritized by impact-to-effort ratio.

**Phase 1 (1–2 weeks): Core LLM interface upgrade.** Install `ai` + `@ai-sdk/google`. Migrate the clinical tutor endpoint to `streamText()` first — the highest-visibility improvement. Convert Ghost Grader to `generateObject()` with the existing Zod schemas. Set up `createProviderRegistry` for model routing. This phase requires zero architectural changes; each endpoint migrates independently.

**Phase 2 (2–4 weeks): Retrieval quality.** Add pg_textsearch for BM25 indexing alongside existing pgvector HNSW indexes. Implement RRF hybrid search in a single SQL function. Preprocess existing content chunks with contextual retrieval (batch job using gemini-2.5-flash). Implement parent-child chunking for new content ingestion. Benchmark retrieval accuracy before and after using RAGAS.

**Phase 3 (2–3 weeks): Clinical validation and observability.** Integrate RxNorm API for drug name validation in question generation. Add UMLS lookups for terminology standardization. Set up Langfuse for tracing all LLM calls. Enable Cloudflare AI Gateway caching for repeated queries. Add corrective RAG grading to the retrieval pipeline.

**Phase 4 (3–4 weeks): OSCE agent upgrade.** Convert OSCE simulation to AI SDK tool-calling pattern with clinical tools (vitals, labs, physical exam). If multi-turn state management proves complex, adopt Mastra for workflow orchestration. Add DeepEval-based evaluation for agent conversation quality. Consider DSPy optimization of question generation prompts.

**Phase 5 (ongoing): Advanced capabilities.** Evaluate medical embedding models (MedTE, PubMedBERT) against text-embedding-005 on PANaCEa's specific content. Explore GraphRAG for differential diagnosis training modules. Investigate Gemini fine-tuning for Ghost Grader's behavioral confidence model. Build systematic evaluation datasets aligned with the PANCE blueprint's 460+ topics.

## Conclusion

The AI tooling landscape for TypeScript edge applications has matured dramatically, but the optimal stack for PANaCEa is deliberately narrow. The Vercel AI SDK provides everything LangChain offers for Gemini-centric apps — streaming, structured outputs, tool calling, model routing — at a fraction of the bundle size and abstraction cost. Postgres-native hybrid search eliminates the vector database decision entirely. Free government medical APIs (RxNorm, UMLS, OpenFDA) provide clinical validation infrastructure that no commercial tool matches for accuracy. The most novel insight from this research is that **contextual retrieval at ingestion time** — a one-time preprocessing step costing roughly a dollar per million tokens — likely delivers more retrieval quality improvement than switching embedding models or vector databases. For a solo developer, the constraint isn't which tools exist but which sequence of adoption yields the fastest compounding improvement in clinical content quality.