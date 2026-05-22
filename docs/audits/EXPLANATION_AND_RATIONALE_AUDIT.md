# Explanation and Rationale Audit

Date: 2026-05-02

Readiness: **70/100 (C)**. Explanations exist in several forms, but the app needs one backend/frontend contract so generated explanations consistently teach clinical reasoning and support weakness remediation.

## Explanation Quality Table

| Requirement | Current Status | Evidence | Risk | Fix |
|---|---|---|---|---|
| Why correct answer is correct | Often present | Question prompts and `explain-rag.ts` | Variable depth | Required `correctRationale` |
| Why each distractor is wrong | Inconsistent | Prompt/schema mismatch in `_shared/question-generator.ts` | Learner cannot debug misconceptions | Required per-choice `distractorRationales` |
| Clinical reasoning chain | Partial | `explain-rag.ts`, question prompts | Explanations can become fact lists | Required `reasoningSteps` |
| High-yield takeaway | Partial | Some prompts ask for takeaway | Missing concise retention cue | Required `takeaway` |
| Common trap/misconception | Partial | Not consistent across schemas | Weakness remediation loses specificity | Required `commonTrap` |
| PA-level scope | Prompt-only | Prompt wording | Unsafe or too specialist | Add clinical safety rubric |
| Source/grounding | Limited | RAG path only | Unsupported claims | Add optional citations/source IDs |
| Frontend contract | Fragmented | `QuestionExplanation` model vs plain strings | UI cannot reliably render rationales | Canonical serialized explanation |

## Recommended Explanation Schema

```ts
type ExplanationV1 = {
  schemaVersion: 'explanation.v1';
  correctChoiceId: string;
  correctRationale: string;
  distractorRationales: Array<{
    choiceId: string;
    rationale: string;
    misconception?: string;
  }>;
  reasoningSteps: string[];
  highYieldTakeaway: string;
  commonTrap?: string;
  learningObjective: string;
  relatedWeaknessTags: string[];
  citations?: Array<{ label: string; url?: string; sourceId?: string }>;
};
```

## Backend/Frontend Contract

- Backend stores `ExplanationV1` either in `QuestionExplanation` rows or a versioned JSON field.
- Frontend renders correct rationale, each distractor rationale, takeaway, and weakness tag consistently.
- If explanation generation fails, the learner sees the validated stored explanation or a safe unavailable state; the app should not invent an unvalidated fallback as if it were authoritative.

## Repair Plan

1. Centralize `ExplanationV1` schema and validator.
2. Require explanation fields in generated-question validation.
3. Update `functions/api/questions/explain-rag.ts` to use gateway structured output and schema validation.
4. Migrate plain explanation strings into structured display format where feasible.
5. Add tests for missing distractor rationales, unsupported correct answer, invalid choice IDs, and frontend rendering compatibility.
