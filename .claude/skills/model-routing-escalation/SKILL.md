---
name: model-routing-escalation
description: "Design and review AI model selection, routing, escalation, and cost optimization across PANaCEa's Gemini integration. Use when deciding which Gemini model to use for new features, optimizing AI costs, designing fallback chains, reviewing model selection appropriateness, or adding extended thinking/streaming—even if the user just says 'AI is too expensive' or 'should this use flash or pro?'"
tags:
  - ai
  - cost-optimization
  - model-selection
  - gemini
  - architecture
composes_with:
  - ai-generation-safety
  - clinical-content-gen
---

## Purpose
Use the cheapest model that produces acceptable quality. Escalate only when flash cannot meet quality requirements. Every Gemini call should justify its model choice: cost vs. capability.

## Current Model Inventory

| Model | Cost | Speed | Use Case | Quality |
|-------|------|-------|----------|---------|
| **gemini-2.5-flash** | $0.075/1M input | Fast | Default: Q generation, Ghost Grader, chat | Good for most tasks |
| **gemini-3-flash-preview** | Cheaper | Fast | Tutor extended thinking (Socratic dialogue) | Better reasoning |
| **gemini-1.5-pro** | $15/1M input | Slower | Medical image grading only | High precision |
| **text-embedding-005** | $0.02/1M | N/A | Semantic search (768-dim) | 768 dimensions |

**Cost multiplier:** Pro is ~200x Flash. Extended thinking adds ~2.5x cost. Don't use Pro without justification.

## PANaCEa's Current Routing

- **Question generation:** Flash (batch, 25 Qs/request)
- **Ghost Grader:** Flash + JSON mode; no fallback to local unless API fails
- **Tutor chat:** 3-flash-preview with `thinkingLevel` for clinical reasoning
- **Medical images:** 1.5-pro only (`gradeMedicalImage` in `services/ai/`)
- **Embeddings:** 005 for Knowledge Base semantic search
- **Streaming:** Web Streams API in `gemini/stream.ts` for real-time response

## Escalation Pattern

**Flash → Validate → Pro (only if necessary)**

1. Try Flash (with context, examples, structured prompt)
2. Validate output against rubric/ground truth
3. If quality <80% accuracy: escalate to Pro
4. Never default to Pro; always justify the jump

**Example:** Ghost Grader: "Try flash JSON mode first; if >2 failures in QA, add extended thinking or escalate."

## Extended Thinking Guidelines

- **When to enable:** Complex clinical reasoning, multi-step differential diagnosis, high-stakes assessment
- **Thinking level:** `MEDIUM` for tutor (cost ~2.5x), `LOW` if budget constrained
- **Cost impact:** ~2.5x model cost; validate ROI (accuracy gain must >250% justify cost)
- **File:** `services/ai/gemini/index.ts` — pass `thinkingLevel` param

## Streaming vs Batch

- **Batch:** Q generation, Ghost Grader (25+ questions), background jobs → `generateQuestions()`
- **Streaming:** Tutor chat, real-time feedback → Web Streams API in `gemini/stream.ts`
- **Cost:** Batch marginally cheaper (no setup per-request overhead); streaming better UX for <5s responses

## Cost Monitoring & Optimization

1. **Monitor:** Per-user rate limiting via KV (prevent abuse)
2. **Log:** Token usage in ReviewLog (Ghost Grader results already captured)
3. **Optimize:** Batch Q generation (25 per request, not 1); reuse embeddings
4. **Audit:** "Why this model?" in code comments; quarterly cost review

## Common Failure Modes

| Failure | Fix |
|---------|-----|
| Using Pro where Flash suffices | Add quality gate; validate Flash output first |
| No escalation path defined | Always plan Flash→Pro fallback |
| Missing extended thinking for reasoning tasks | Enable `thinkingLevel` in tutor for complex cases |
| Streaming entire Q bank instead of batching | Use batch APIs for generation |
| No cost tracking per feature | Log model + tokens in ReviewLog |

## Files to Inspect First

- `services/ai/` — 19+ AI service files; check for redundant Pro calls
- `services/ai/gemini/index.ts` — model selection, thinkingLevel param
- `services/ai/ghostGrader.ts` — Flash + JSON fallback pattern
- `lib/services/questionGenerationService.ts` — batch Q generation (25-per-request)
- `gemini/stream.ts` — streaming Web Streams API
- `services/ai/medicalImageGrader.ts` — only Pro usage (justified)

## Decision Tree

**New AI feature:**
1. Can Flash + JSON/structured output solve it? → Use Flash
2. Does it need reasoning (multi-step clinical logic)? → Try Flash first; add extended thinking if <80% acc
3. Does it involve medical image analysis? → Pro only
4. Does it need real-time UX? → Streaming; choose batch/stream based on latency <5s threshold
5. Is cost a blocker after optimization? → Escalate to Po or consider local fallback

---

**Cost baseline:** ~$500/month at scale (100K questions/month @ Flash rates). Pro medical image grading adds ~$2/graded image. Budget constraints? Reduce extended thinking, batch more aggressively, or implement local fallback for Ghost Grader.
