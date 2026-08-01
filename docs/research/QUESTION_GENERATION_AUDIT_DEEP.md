# Question Generation Pipeline — Deep Audit Addendum

**Date:** 2026-04-06
**Scope:** Prompt internals, data format mismatches, variant lifecycle dead ends, statistical feedback gaps
**Builds on:** QUESTION_GENERATION_AUDIT.md

---

## A. Prompt Construction Analysis

Eight distinct generation paths exist, each with different prompt templates, models, context injection, and verification levels. This creates a fragmented generation system where question quality varies dramatically by entry point.

### A.1 Model Fragmentation

| Generation Path | Model | Temperature | System Instruction | Few-Shot | External Sources | Verification |
|---|---|---|---|---|---|---|
| `_shared/question-generator.ts` | gemini-2.5-flash | 0.7 | None | 2 examples (AFib, CAP) | Google Search + PubMed + OpenStax | None |
| `lib/questionGenerator.ts` | gemini-2.5-pro | default | Yes (full PANCE rules) | None | None | `validateQuestion()` |
| `lib/questionVariantGenerator.ts` | gemini-2.0-flash-exp | default | None | None | None | None |
| `generate-enhanced.ts` | gemini-2.5-pro | implicit | None (prompt-based) | None | MedicalContent JSONB | CoVe (4-step, 3 retries) |
| `generate-batch.ts` | gemini-2.0-flash | 0.8 | None | None | None | Distractor score ≥ 70 |
| `generate-deep.ts` | gemini-2.5-flash | 0.7 | None | None | Cached PANCE blueprint (1M+ tokens) | Field validation + optional shared quality gate (`ENABLE_QUALITY_GATE`) |
| `cove-verification.ts` (claims) | indirect | — | — | — | DB content as ground truth | Is the verifier |
| Variant generator | gemini-2.0-flash-exp | default | None | None | Original question only | None |

Three different models across six paths. The variant generator uses a hardcoded experimental model (`gemini-2.0-flash-exp`) that could be deprecated without warning.

### A.2 Context Injection Gaps

**What's available but NOT injected into prompts:**

| MedicalContent Field | Available | Injected in generate.ts | Injected in generate-enhanced.ts | Injected in generate-batch.ts | Injected in variant gen |
|---|---|---|---|---|---|
| overview | Yes | No | Yes | No | No |
| pathophysiology | Yes | No | Yes | No | No |
| symptoms | Yes | No | Yes | No | No |
| diagnostics | Yes | Yes (truncated 400ch) | Yes | No | No |
| treatment | Yes | Yes (truncated 300ch) | Yes | No | No |
| classic_patient | Yes | No | No | No | No |
| classic_triad | Yes | No | No | No | No |
| first_line_rx | Yes | No | No | No | No |
| gold_standard_dx | Yes | No | No | No | No |
| best_initial_test | Yes | No | No | No | No |
| mnemonic | Yes | No | No | No | No |
| pance_yield | Yes | No | No | No | No |
| differentialDiagnosis | Yes | No | Yes | No | No |

The high-value PANCE-specific fields (`classic_patient`, `classic_triad`, `first_line_rx`, `gold_standard_dx`, `best_initial_test`) are **never injected into any generation prompt**. These are exactly the fields that would most improve question accuracy and clinical relevance.

### A.3 Prompt Inconsistencies

**Option count:** `generate-enhanced.ts` instructs "4 options" while `generate-batch.ts` instructs "5 OPTIONS REQUIRED (A through E)". Other paths don't specify.

**Answer format:** `generate-enhanced.ts` uses `correctAnswerIndex` (number). `generate-batch.ts` uses `correctAnswer: "A"` (letter). `question-generator.ts` uses `correctAnswer: "full text"`. The variant generator returns `correctAnswer` as full text.

**Rationale structure:** `generate-enhanced.ts` requires a 5-section rationale object (bottomLine, whyCorrect, whyIncorrectA/B/C/D, clinicalPearl, highYieldImageOrTable). Other paths accept a simple string. This means questions from different paths have incompatible rationale formats.

### A.4 Few-Shot Examples Are Static

Only `_shared/question-generator.ts` uses few-shot examples (2 hardcoded: AFib third-order and CAP third-order). These are never rotated, updated, or A/B tested. The examples include `<thinking>` tags that model clinical reasoning chains — a good pattern, but the same two examples for every generation call means the model may overfit to cardio/pulm reasoning patterns.

---

## B. Data Format Mismatches (Critical)

The system stores question data in 5+ incompatible formats across two tables. This creates silent corruption bugs when variants are generated, stored, and served.

### B.1 The correctAnswer Problem

There are **four representations** of the correct answer across the codebase:

| Representation | Example | Used By |
|---|---|---|
| Full text string | `"Myocardial Infarction"` | Question table, variant generator output |
| Letter string | `"A"` | generate-batch.ts output, some PreGen questionData |
| Zero-based index | `2` (meaning option C) | generate-enhanced.ts, API responses, frontend |
| Letter-to-index map | `{A:0, B:1, C:2, D:3}` | due-siblings.ts parser |

**Where this breaks:** `parsePreGenToQuestion()` in `due-siblings.ts` converts correctAnswer to an index using a letter map (`{A:0, B:1, C:2, D:3}`). If correctAnswer is full text (e.g., `"Myocardial Infarction"`), the lookup returns `undefined`, the nullish coalescing (`?? 0`) silently falls back to index 0, and **the first option is marked as correct regardless of what it actually is.**

This is a **silent data corruption bug** that affects every variant served through the due-siblings endpoint when the source question used text-based correctAnswer.

### B.2 The Options Problem

The `options` field has three shapes in practice:

| Shape | Example | Where Created |
|---|---|---|
| `string[]` | `["MI", "Angina", "PE", "AD"]` | Most generators, variant generator |
| `Record<string,string>` | `{A:"MI", B:"Angina", C:"PE", D:"AD"}` | Some legacy imports |
| `Array<{value,text,label}>` | `[{value:"MI",text:"Myocardial..."}]` | Anki imports, some drill data |

`normalizeOptionsToArray()` handles shapes 1 and 2, but **drops all entries for shape 3** (object-array) because its filter is `typeof opt === 'string'`. This means imported questions from Anki or other object-format sources lose all their options during normalization.

### B.3 Silent Fallback Chain in ensureDueVariant

When generating a variant, `ensureDueVariant.ts` extracts the correct answer from the source question:

```
getCorrectAnswerString(data, options):
  1. Try data.correctAnswer ?? data.answer ?? data.correct_option ?? data.correctChoice
  2. If all null, try data.correctAnswerIndex or data.correctIndex as number
  3. If that fails, return options[0] ?? ''  ← SILENT FALLBACK TO FIRST OPTION
```

If the source question has a format that doesn't match any of the 4 field names, the variant is generated with the **first option as the "correct" answer**, which is then stored permanently in PreGeneratedQuestion. The incorrect correctAnswer then propagates through every subsequent serving of that variant.

### B.4 Rationale vs Explanation Field Name Drift

| Context | Field Name | Type |
|---|---|---|
| Question table schema | `explanation` | String |
| API QuestionResponse type | `rationale` | String |
| generate-enhanced.ts output | `rationale` | 5-section object |
| generate-batch.ts output | `rationale` | 5-section object |
| variant generator output | `explanation` | String |
| ensureDueVariant storage | `rationale: variant.explanation` | String (cross-named) |
| drillReviewService access | `data.rationale ?? data.explanation` | Fallback chain |

When a variant is generated, its `explanation` field is stored as `rationale` in the PreGeneratedQuestion. When that variant is later parsed for serving, code checks `data.rationale || data.explanation`. This works by accident but creates confusion when debugging — the field name changes meaning depending on which code path created the data.

---

## C. Variant Lifecycle Dead Ends

The variant system has **two parallel, disconnected storage paths** that don't communicate:

### C.1 The Two Tables Problem

```
Path A: submit-review.ts (incorrect) → ensureDueVariant() → PreGeneratedQuestion
Path B: srs/submit.ts (incorrect) → VariantQueueService → QuestionVariant

Serving:
  due-siblings.ts queries → PreGeneratedQuestion ONLY
  srs/next.ts queries → QuestionVariant ONLY
```

This means:
- Variants created by the drill/main session path (PreGeneratedQuestion) are **never served by SRS**
- Variants created by the SRS path (QuestionVariant) are **never served by due-siblings**
- The two pools grow independently with no cross-pollination

### C.2 SRS Next Has a Likely Bug

In `srs/next.ts`, the QuestionVariant query uses:
```typescript
WHERE baseQuestionId = topic.conditionId
```

This queries `baseQuestionId` (which should be a question ID) against `conditionId` (which is a condition ID). These are different ID spaces. Unless there's a convention where baseQuestionId stores conditionId (which contradicts the schema documentation), **this query will never match any rows**, making the entire SRS variant serving path non-functional.

### C.3 Second Chance Engine: Complete Dead Code

`secondChanceEngine.ts` (499 lines) has:
- `resolveLearningTarget()` — finds weakest subdomain per condition
- `selectSecondChanceQuestion()` — 4-strategy variant selection cascade
- `fetchSubdomainDueReviews()` — blueprint-weighted due review queries
- `buildSecondChanceReviewSet()` — full session builder

Zero callers. No API endpoint. No cron. No frontend integration. 499 lines of well-designed, research-backed dead code.

### C.4 Variant Usage Tracking Is Split

- `QuestionVariant.usedByUsers` — updated by `srs/submit.ts` when variant is answered
- `UserTopicProgress.variantsUsed` — referenced in secondChanceEngine (dead code)
- `PreGeneratedQuestion` — **no per-user usage tracking at all**

This means due-siblings can serve the same PreGeneratedQuestion variant to the same user repeatedly with no dedup.

---

## D. Statistical Feedback Gaps

### D.1 Data Collected But Never Used in Generation

| Signal | Collected Where | Read By | Fed Into Generation |
|---|---|---|---|
| Question miss rate | ReviewLog | contentHealthService (nightly) | **No** |
| FSRS difficulty mismatch | UserProgress | contentHealthService (nightly) | **No** |
| Content health score | contentHealthService | Question selection, auto-demotion | **No** |
| Confusion pairs | drillReviewService | confusionPairBoost (drill priority), ConfusionGraph (viz) | **No** |
| Weakness patterns | routes/analytics.ts | Emergency restore, verify scripts | **No** |
| Flag rate | /api/questions/flag | Auto-reject (PreGen only) | **No** |
| PreGen timesServed | **Never incremented** | — | — |
| PreGen timesCorrect/Incorrect | **Never incremented** | — | — |
| PreGen qualityScore | **Never written** | — | — |
| PreGen semanticHash | **Never written** | — | — |
| PreGen avgTimeMs | **Never written** | — | — |

**6 PreGeneratedQuestion fields exist in the schema but are never populated.** The `timesServed` field is particularly notable because the auto-reject kill switch (`flagRate > 0.15 AND timesServed >= 20`) can never trigger — `timesServed` is always 0.

### D.2 The Broken Kill Switch

PreGeneratedQuestion has a flag-rate auto-deprecation system:
- `flagRate > 0.1 AND timesServed >= 20` → `validationStatus = 'rejected'`

But `timesServed` is **never incremented anywhere in the codebase**. The condition `timesServed >= 20` is permanently false. The kill switch exists but can never fire.

### D.3 Generation Is Blueprint-Driven, Not Performance-Driven

`batch-generate-questions.ts` identifies gaps by counting active questions per system + taskCategory against blueprint targets. If Cardiovascular has 15 questions and the blueprint says 16%, it generates more CV questions.

What it doesn't consider:
- Whether existing CV questions have low accuracy (students struggle)
- Whether certain conditions within CV are weak (confusion pair data)
- Whether recently generated CV questions were rejected by review
- Whether the questions it generates overlap with existing ones

The generation pipeline is quantity-driven ("fill the gap") rather than quality-driven ("replace the weak ones" or "cover the confused areas").

### D.4 Content Health Score: Exists But Underused

The health score formula combines miss rate (30%), FSRS mismatch (30%), QA status (25%), and lifecycle (15%) into a 0-1 score. It's computed nightly and used for:
- Selection filtering (≥ 0.6 threshold)
- Auto-demotion (< 0.3 → DEPRECATED)

It's NOT used for:
- Prioritizing which conditions need new questions
- Informing generation prompts ("avoid creating questions similar to ID X which had 70% miss rate")
- Identifying conditions where all questions are low-quality
- Triggering variant generation for high-miss-rate questions

---

## E. Revised Findings Summary

### NEW CRITICAL Findings (from deep audit)

| # | Finding | Severity | Impact |
|---|---|---|---|
| DC1 | `parsePreGenToQuestion` silently corrupts correctAnswer when it's full text (falls back to index 0) | **Critical** | Wrong answer marked as correct for served variants |
| DC2 | SRS next.ts queries `baseQuestionId = conditionId` — wrong ID space, likely returns 0 rows always | **Critical** | SRS variant serving path non-functional |
| DC3 | Two parallel variant tables (PreGen vs QuestionVariant) are disconnected — no cross-serving | **High** | Variants created by one path invisible to the other |
| DC4 | PreGeneratedQuestion.timesServed never incremented — kill switch permanently disabled | **High** | Flagged low-quality questions can never be auto-rejected |
| DC5 | 6 PreGeneratedQuestion stat fields are vestigial (never written) | **High** | No performance tracking on generated questions |
| DC6 | Options format polymorphism causes silent empty arrays for object-format questions | **High** | Some questions serve with 0 options |
| DC7 | `generate-batch.ts` requests 5 options, all other paths request 4 — inconsistent pool | **Medium** | Mixed 4/5-option questions in same sessions |
| DC8 | PANCE-specific MedicalContent fields (classic_triad, first_line_rx, gold_standard_dx, best_initial_test) never injected into any prompt | **Medium** | Generation misses curated clinical anchors |
| DC9 | Few-shot examples are static (2 cardio/pulm only) — no rotation or system coverage | **Medium** | Model overfits to cardio/pulm reasoning patterns |
| DC10 | Second Chance Engine (499 lines) is complete dead code with zero callers | **Low** | Wasted engineering; good architecture unused |
| DC11 | Variant generator uses hardcoded `gemini-2.0-flash-exp` — experimental model risk | **Low** | Model could be deprecated, breaking variant gen silently |
| DC12 | Confusion pair data collected but never fed into generation prompts | **Medium** | Distractors don't target actual student misconceptions |
| DC13 | ensureDueVariant silently falls back to options[0] as correct answer on parse failure | **High** | Incorrect variants permanently stored and served |

### Mapping to Original Improvement List

| Deep Finding | Maps to Improvement # | Additional Action Needed |
|---|---|---|
| DC1, DC6, DC13 | NEW: Data normalization standardization | Centralized parser with logging, no silent fallbacks |
| DC2 | #1 (QuestionVariant migration) + bug fix in srs/next.ts | Fix the baseQuestionId query |
| DC3 | NEW: Unify variant storage into single table | Merge paths or add cross-query |
| DC4, DC5 | #5 (Attempt-data feedback loop) | Increment timesServed, populate stat fields |
| DC7 | #4 (Prompt version tracking) | Standardize option count |
| DC8 | #3 (Enrich prompts with MedicalContent) | Inject classic_triad, first_line_rx, etc. |
| DC9 | #4 (Prompt version tracking) | Rotate few-shot examples by system |
| DC10 | NEW: Wire secondChanceEngine to API endpoint | Or remove dead code |
| DC12 | #6 (Distractor engineering from confusion pairs) | Inject confusion data into prompts |
