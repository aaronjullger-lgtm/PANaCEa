# RAG architecture for a medical education study platform

**Retrieval-Augmented Generation can transform PANaCEa from a static question bank into an evidence-grounded adaptive learning system — at near-zero marginal cost.** The research is unambiguous: medical RAG systems improve LLM accuracy by up to 18% over chain-of-thought prompting alone, with hybrid retrieval elevating GPT-3.5 to GPT-4-level performance on USMLE-style questions. However, naive RAG implementations are dangerous for clinical content — one study found unsupported claims rose from 5% to 43.6% with poorly implemented retrieval. The path forward requires advanced RAG patterns (corrective retrieval, self-reflection, hybrid search) combined with your existing Cloudflare + Supabase stack, achievable for roughly **$5–10/month** in additional infrastructure costs.

---

## The medical RAG landscape has matured rapidly since 2024

The foundational work is the **MedRAG toolkit** (Xiong et al., ACL 2024 Findings), which established the first systematic benchmark for medical RAG across 7,663 questions from five medical QA datasets (MedQA-USMLE, PubMedQA, BioASQ, MMLU-Med, MedMCQA). MedRAG's key insight: combining multiple medical corpora — PubMed abstracts, StatPearls clinical articles, medical textbooks, and clinical guidelines — always outperforms single-corpus retrieval. StatPearls, with **301,200 passages** from 9,300 peer-reviewed clinical articles organized by epidemiology, pathophysiology, and management, is particularly suited for board-exam preparation platforms like PANaCEa.

**Self-MedRAG** (Ryan et al., arXiv 2601.04531, January 2026) represents the current state of the art, combining hybrid retrieval (BM25 + Contriever via Reciprocal Rank Fusion) with self-reflective generation. It achieved **83.33% accuracy on MedQA** and **79.82% on PubMedQA** — significant improvements over single-retriever baselines. The self-reflective loop evaluates whether retrieved passages actually support generated answers, filtering out irrelevant context that would otherwise increase hallucination.

Three survey papers published in 2025 (PLOS Digital Health reviewing 70 studies, MDPI AI reviewing 30 studies, and JMIR reviewing 67 studies) converge on the same conclusion: **MedCPT + GPT-4** is the most common retriever-generator combination in medical RAG literature, with MedCPT used in 28% of published systems. The most critical finding across all reviews is that retrieval quality — not generator quality — is the binding constraint on medical RAG performance.

### Why naive RAG fails for clinical content

A large-scale expert evaluation (arXiv 2511.06738) with 18 medical experts and 80,000+ annotations found that standard RAG can actually **degrade** LLM performance on medical tasks. GPT-4o's factuality dropped ~2% and completeness dropped ~8% with RAG for patient queries. When the model incorporated irrelevant passages ("False Positive" retrieval), Llama-3.1 showed an **8% factuality drop**. A separate 2026 medRxiv preprint documented unsupported claims rising from 5.0% baseline to **43.6% with RAG** — an 8.7-fold increase — because the system retrieved semantically similar but factually irrelevant content.

The solution is not to avoid RAG but to implement it with guardrails. Self-reflective RAG reduced hallucination to 5.8% in clinical vignettes. MEGA-RAG (Frontiers in Public Health, 2025), which combines dense retrieval, BM25, biomedical knowledge graphs, and cross-encoder reranking with discrepancy-aware refinement, reduced hallucination rates by **over 40%**.

---

## Hybrid search is non-negotiable for medical terminology

Medical terminology has a unique property that makes pure vector search insufficient: highly specific terms like "pneumothorax," "aortic stenosis," "HbA1c," and ICD-10 codes like "I11.0" require **exact keyword matching**. Dense embedding models can fail to distinguish semantically similar but clinically different concepts (systolic vs. diastolic heart failure) and struggle with rare medical terminology underrepresented in training data.

Benchmark evidence across multiple papers shows that for medical domains, **two-thirds or more weight on BM25 remains optimal**, though hybridization with dense retrieval is necessary to capture terminological variability. Self-MedRAG's hybrid BM25 + Contriever via RRF significantly outperformed single-retriever baselines. The recommended fusion approach is **Reciprocal Rank Fusion (RRF) at k=60** as a zero-config default, with BM25 weight ≥ 0.6 for medical content.

Your existing Supabase PostgreSQL already supports this. The implementation combines pgvector's HNSW index with PostgreSQL's native full-text search (tsvector + GIN index), fused via an RRF SQL function:

```sql
CREATE TABLE document_sections (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content text,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  embedding vector(768),
  organ_system text,
  pance_category text,
  difficulty_level text
);

CREATE INDEX ON document_sections USING gin(fts);
CREATE INDEX ON document_sections USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

A `hybrid_search()` PostgreSQL function combines both signals, callable from Cloudflare Pages Functions via `supabase.rpc('hybrid_search', {...})`. The full-text component handles exact medical terminology matching while the vector component captures semantic similarity for paraphrased or conceptually related queries.

### Cross-encoder reranking doubles retrieval precision

After hybrid retrieval, adding a **cross-encoder reranker** provides the single largest precision improvement. A BioASQ 2025 study (Verma et al., CLEF 2025) showed MAP@10 jumping from **0.1895** (no reranker) to **0.4337** (fine-tuned ms-marco-MiniLM-L12, just 33.4M parameters) — more than doubling precision. An ensemble of cross-encoder + GPT reranker achieved **0.4551**. Surprisingly, the compact ms-marco-MiniLM-L12 outperformed much larger models like bge-reranker-large (560M params) after fine-tuning on biomedical data. For a production system, **Cohere Rerank 4.0** offers healthcare-specific support with 32K token context, while open-source options like BAAI/bge-reranker-base work well when self-hosted.

---

## Vector database and embedding model recommendations for the stack

### Supabase pgvector should be your primary vector store

Given that your data already lives in Supabase PostgreSQL, pgvector is the pragmatic choice for the bootstrapped phase. HNSW indexing delivers **<20ms query latency** at scales up to 5 million vectors, with **>95% recall** at default parameters. For PANaCEa's estimated ~10,000 clinical content chunks, this is massive overkill — which is exactly where you want to be for reliability.

Key pgvector advantages for this stack: zero additional infrastructure cost (included in Supabase plan), SQL-native queries that work with Prisma, ACID transactions across relational and vector data, row-level security for multi-tenant scenarios, and the hybrid search capability combining tsvector with vector similarity. The pgvector 0.8.0 release introduced iterative index scans that solve the filtered search problem and delivered **up to 9× faster query processing**.

### Cloudflare Vectorize as a future optimization layer

Cloudflare Vectorize offers co-located vector search with ~31ms median latency and native integration with Pages Functions. However, it has a critical limitation: **maximum 1,536 dimensions**, which excludes full-dimension Gemini or OpenAI embeddings at 3,072 dimensions. You'd need Matryoshka dimension reduction. Other limits include 10 million vectors per index, 10 KiB metadata per vector, and a maximum topK of 20 with metadata. Pricing is extremely low — roughly **$0.31/month** for 10,000 vectors with 1,000 daily queries.

The recommended architecture separates the two: pgvector as the primary store (data co-location, hybrid search), with Vectorize added later only if Supabase round-trip latency (50–150ms) becomes a UX bottleneck.

### Gemini Embedding 001 is the optimal embedding model

Since PANaCEa already uses the Gemini API, **gemini-embedding-001** eliminates an additional API dependency. It ranks #1 on the MTEB Multilingual leaderboard, produces 3,072 dimensions (reducible to 768 via Matryoshka for pgvector/Vectorize compatibility), costs $0.15/M tokens ($0.075 batch), and is **free via Google AI Studio** up to 1,500 requests/day — more than sufficient for a bootstrapped platform.

The research on medical-specific vs. general-purpose embeddings is nuanced. A study (arXiv 2401.01943) found that generalist sentence-transformer models outperformed clinical-specific models on short-context clinical search, with jina-embeddings-v2-base-en beating S-PubMedBERT by 6%. However, a newer MedTE benchmark (arXiv 2507.19407) showed that models fine-tuned on diverse medical corpora achieved SOTA on 51 medical tasks. The practical guidance: **start with Gemini embeddings, evaluate PubMedBERT (768D, free, Apache 2.0) or MedCPT if retrieval quality is insufficient**, then consider fine-tuning for +10–30% domain-specific gains.

| Model | Dimensions | Cost/M tokens | Best for |
|-------|-----------|---------------|----------|
| Gemini Embedding 001 | 3072 (→768) | Free (AI Studio) | Primary choice, already in stack |
| OpenAI text-embedding-3-small | 1536 | $0.02 | Cost-effective alternative |
| PubMedBERT Embeddings | 768 | Free (self-host) | Medical-specific baseline |
| Workers AI bge-base-en-v1.5 | 768 | Free tier | Edge-local query embedding |

---

## Chunking strategies that preserve clinical meaning

The most impactful finding on chunking comes from a Mayo Clinic study (Bioengineering, PMC 2025) comparing four strategies for clinical decision support using Gemini 1.0 Pro. **Adaptive chunking** — which aligns chunk boundaries with clinical discourse, preserving directives, timing, and exceptions within a single retrievable span — achieved **87% accuracy** (F1=0.64) versus just **50% accuracy** (F1=0.24) for fixed-token baseline chunking. This is a 74% relative improvement from chunking strategy alone.

Optimal chunk sizes vary by content type. Clinical guidelines and protocols work best at **400–600 tokens** with structure-aware boundaries that keep each recommendation with its evidence grade. Pathophysiology explanations need broader context for mechanism chains, performing best at **512–1,024 tokens**. Drug monographs should preserve dosage, contraindications, and interactions as atomic units at **300–500 tokens**. Diagnostic criteria (DSM criteria, Jones criteria, Duke criteria) must never be split — keep the entire criteria set as one chunk regardless of length.

### Hierarchical chunking enables multi-resolution retrieval

LlamaIndex's HierarchicalNodeParser with default levels of [2048, 512, 128] tokens creates parent-child relationships that support the AutoMergingRetriever pattern: search on fine-grained leaf nodes, but when a majority of a parent's children are retrieved, return the parent for fuller context. For medical textbooks, a three-tier hierarchy maps naturally:

- **Level 1 (2,048 tokens)**: Chapter or major organ system section
- **Level 2 (512 tokens)**: Clinical topic or disease entity
- **Level 3 (128 tokens)**: Individual concepts, definitions, key diagnostic findings

The Mix-of-Granularity (MoG) approach from COLING 2025 adds a trained router that dynamically selects chunk granularity based on query type — fine-grained for specific factual queries ("What is the dose of amoxicillin for strep pharyngitis?") and coarse-grained for conceptual queries ("Describe heart failure pathophysiology").

### Metadata enrichment transforms retrieval precision

Every chunk should carry structured metadata enabling filtered search:

```json
{
  "organ_system": "cardiovascular",
  "pance_blueprint_category": "cardiology",
  "difficulty_level": "intermediate",
  "blooms_taxonomy_level": "application",
  "content_type": "pathophysiology",
  "snomed_codes": ["84114007"],
  "mesh_terms": ["Heart Failure"],
  "keywords": ["HFrEF", "systolic dysfunction"]
}
```

Cloudflare Vectorize supports metadata filtering with `$eq`, `$ne`, `$in`, `$lt`, `$gt` operators (up to 10 metadata indexes per index). Supabase pgvector achieves the same via standard SQL WHERE clauses combined with vector similarity. Medical ontology tagging using **SNOMED CT** (300,000+ concepts), **ICD-10**, and **MeSH** enables cross-referencing and hierarchical navigation. The UMLS Metathesaurus integrates 200+ biomedical vocabularies with 3.6M+ concepts, providing the canonical mapping between "MI," "myocardial infarction," and "heart attack."

---

## Seven concrete use cases for RAG in PANaCEa

### RAG-grounded PANCE question generation

The highest-impact use case. When generating clinical vignettes, the current Gemini-only approach risks hallucinating clinical details. With RAG: embed the target topic → retrieve top 5 guideline chunks (ACS diagnostic criteria, troponin interpretation, treatment algorithms) → construct a grounded prompt that instructs Gemini to generate a PANCE-style question **using only the provided guidelines as reference**. Store source chunk IDs as citations. The i-MedRAG approach (PMC 2024–2025) showed that iterative follow-up queries — where the LLM generates sub-questions that each trigger separate retrievals — achieved **69.68% accuracy on MedQA** with zero-shot GPT-3.5, outperforming all existing prompt engineering methods.

### Personalized wrong-answer explanations

When a student answers incorrectly, construct a composite query from the question text, wrong answer, and correct answer. Embed this and retrieve the most relevant clinical content explaining the correct concept. The prompt instructs Gemini to explain why their specific answer was wrong and why the correct answer is right, grounded in the retrieved evidence. **Cache explanations keyed by (question_id, wrong_answer)** — since many students make the same mistakes, expected cache hit rates are 40–60%.

### OSCE simulation grounded in clinical presentations

Pre-fetch all relevant clinical presentation chunks into Cloudflare KV cache when an OSCE session starts. During the conversation, chunks are already locally available — no vector search needed per turn. This reduces per-turn latency to **<500ms to first token**. The patient's responses remain clinically consistent because they're grounded in actual presentation patterns rather than pure LLM generation.

### Semantic search replacing keyword search, spaced repetition source linking, clinical reasoning scaffolding, and drug interaction checking

The clinical reference library can be upgraded from keyword to semantic search with a single pgvector query — no LLM call needed, just embed → search → return ranked results in ~100–200ms. FSRS cards can be linked to source material at creation time (pre-computed) by embedding card content and finding matching document sections. For clinical reasoning, retrieving illness script components and differential diagnosis frameworks during tutoring sessions provides structured scaffolding. Pharmacology questions benefit from retrieving drug interaction databases to verify generated content.

---

## Advanced RAG patterns critical for clinical safety

**Corrective RAG (CRAG)** (Yan et al., arXiv 2401.15884) adds a lightweight retrieval evaluator (fine-tuned T5-large, 0.77B parameters) that classifies retrieved documents as Correct, Incorrect, or Ambiguous. When retrieval is Incorrect, the system triggers a web search fallback or flags for human review rather than generating from poor context. For PANaCEa, this means if no guideline passage matches a clinical question above threshold, the system either expands its search or returns a "no confident answer" signal rather than hallucinating.

**Self-RAG** (Asai et al., ICLR 2024 Oral) trains reflection tokens directly into the generation model — [Retrieve] decides when to retrieve, [IsRel] evaluates passage relevance, [IsSup] verifies generation is supported by evidence, [IsUse] rates overall utility. The "supported by evidence" critique is exactly what clinical applications need: every generated claim about diagnosis or treatment becomes traceable to a specific guideline.

**Graph RAG** using medical ontologies enables navigation of hierarchical relationships — from a symptom to differential diagnoses to diagnostic workups to treatments, all grounded in SNOMED CT, ICD-10, and UMLS. MedGraphRAG (Wu et al., ACL 2025) achieved **8% improvement** over standard RAG in medical QA and 10% in fact-checking using a three-tier hierarchical graph.

**Adaptive-RAG** routes queries by complexity: simple factual recall ("What class of drug is metformin?") skips retrieval entirely; moderate questions use single-pass hybrid retrieval; complex clinical reasoning ("55yo male with crushing chest pain, diaphoresis, ST elevation in V1-V4") triggers iterative multi-step retrieval. This saves latency and cost on simple queries while preserving thoroughness for complex ones.

---

## Building a self-improving retrieval system from student interactions

PANaCEa's FSRS spaced repetition system with implicit behavioral ratings generates a uniquely valuable feedback signal. Every answered question produces a triplet: (query, retrieved content, outcome). When a student answers correctly after seeing RAG-grounded content, that content was useful; when they answer incorrectly despite retrieved content, the retrieval or explanation failed.

The improvement loop works across multiple timescales. **Real-time**: adjust retrieval weights based on per-session signals. **Weekly**: analyze failed retrieval patterns to identify content gaps — queries where retrieval scores fall below threshold indicate missing knowledge base content. **Monthly**: fine-tune embedding models using accumulated (query, relevant_chunk, irrelevant_chunk) triplets via contrastive learning (MultipleNegativesRankingLoss). Published results show well-designed feedback mechanisms produce **25% improvement** in system performance over time, and domain-specific fine-tuning yields **+10–30% embedding quality gains**.

Content gap detection is particularly valuable: log every query where the highest retrieval similarity score falls below 0.5. These represent topics students are asking about that your clinical reference library doesn't adequately cover. Aggregate these gaps weekly to prioritize content creation.

---

## The implementation stack costs under $10/month

The complete architecture separates ingestion (offline/batch) from query (real-time/edge):

**Ingestion pipeline** (runs on content update via GitHub Action or Supabase Edge Function): read clinical content → chunk adaptively at 500–1,000 tokens → generate embeddings via Gemini Embedding 001 (free tier) → store in Supabase pgvector with HNSW index + metadata.

**Query pipeline** (Cloudflare Pages Function, <30s CPU): embed student query (20–30ms) → hybrid search via `supabase.rpc('hybrid_search')` (50–80ms) → assemble context (<1ms) → stream Gemini response (200–500ms to first token). With semantic caching via Cloudflare KV, 40–60% of queries return in **<10ms**.

| Component | Monthly cost |
|-----------|-------------|
| Embedding generation (Gemini free tier) | $0 |
| pgvector storage (included in Supabase plan) | $0 |
| Cloudflare Workers Paid plan | $5 |
| Cloudflare Vectorize (optional) | $0.31 |
| Cloudflare KV (caching) | ~$0.50 |
| **Total** | **~$5–6** |

### Framework and tooling choices

For the TypeScript/Cloudflare edge runtime, **Vercel AI SDK** provides the best streaming integration with React (67.5 KB gzipped, native edge support, `useChat`/`streamText` hooks). For RAG orchestration, **Cloudflare's AutoRAG** offers a fully managed pipeline (ingest from R2 → chunk → embed → Vectorize → retrieve → generate) with zero configuration. For more control, use direct Workers AI/Vectorize bindings in TypeScript. **LlamaIndex.TS** is now production-ready for complex patterns like hierarchical retrieval, but note that LangChain.js (~101 KB) is blocked on edge runtimes.

The essential GitHub repository to study is **Teddy-XiongGZ/MedRAG** (~402 stars, ACL 2024) — the most comprehensive medical RAG toolkit with MIRAGE benchmark support, multiple corpora, and MedCPT/Contriever/BM25 retrievers. For multimodal medical content, **BiomedCLIP** (microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224) embeds medical images and text into a shared 512–768D space, trained on 15 million biomedical image-text pairs from PubMed Central.

---

## Conclusion

The research points to a clear implementation sequence for PANaCEa. **Phase 1**: Add pgvector to your existing Supabase instance, implement hybrid search (BM25 + vector) with RRF fusion, and use Gemini Embedding 001 at 768 dimensions — this alone transforms the clinical reference library from keyword to semantic search and enables RAG-grounded question generation. **Phase 2**: Add CRAG-style retrieval evaluation to prevent hallucinated clinical content from reaching students, implement cross-encoder reranking (ms-marco-MiniLM-L12, fine-tuned) for precision, and build semantic caching with Cloudflare KV. **Phase 3**: Deploy feedback loops using FSRS interaction data, implement content gap detection, and consider embedding model fine-tuning on accumulated medical education data.

The most important architectural decision is not which vector database to use — it's implementing **retrieval quality guardrails**. Standard naive RAG is insufficient and potentially dangerous for medical education content. Every system generating clinical claims must implement retrieval relevance evaluation, generation grounding verification, and explicit uncertainty signaling when evidence is insufficient. The advanced RAG patterns (CRAG, Self-RAG, hybrid search with reranking) are not optional enhancements — they are safety requirements for any system generating content that students will use to prepare for clinical practice.