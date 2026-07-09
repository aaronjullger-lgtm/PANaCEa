# Audit: Standardized Rationale Template

## Goal

Replace **unstructured blocks of text** with a **five-section template** so review is faster and consistent. Each section has a clear content strategy.

---

## Proposed UI Layout for Explanations

| Section | Content Strategy |
|--------|-------------------|
| **1. The "Bottom Line"** | One sentence. "The diagnosis is X, and the treatment is Y." (For the student in a rush.) |
| **2. Why the Correct Answer is Right** | Walk through the vignette steps. "The patient's fever + murmur suggests Endocarditis. The 'Janeway Lesions' confirm it. Therefore, the next step is..." |
| **3. Why the Distractors are Wrong** | For each wrong option: explain **why a student might have chosen it**, then why it is wrong for this patient. Example: "Option A (Amoxicillin): Incorrect because this patient has a Penicillin allergy." |
| **4. High-Yield Image/Table** | Placeholder for auto-injected diagram or flow-chart (e.g. algorithm, DDx table). Optional; "N/A" or short description until media is available. |
| **5. The "Clinical Pearl"** | A memorable hook. "Remember: Pain out of proportion to exam = Mesenteric Ischemia until proven otherwise." |

---

## Rationale Object Schema (Standardized)

```ts
interface StandardizedRationale {
  bottomLine?: string;           // One sentence: diagnosis + treatment
  whyCorrect: string;             // Walk through vignette steps
  whyIncorrectA?: string;        // Option A (Name): Incorrect because...
  whyIncorrectB?: string;
  whyIncorrectC?: string;
  whyIncorrectD?: string;
  clinicalPearl?: string;        // Memorable hook
  highYieldImageOrTable?: string; // Optional: description or placeholder for diagram/table
}
```

---

## Implementation Summary

- **Generation prompts** (generate-enhanced, geminiService): Request rationale in this structure; require bottomLine (one sentence), whyCorrect (vignette walk-through), whyIncorrectA–D (explain why a student might have chosen each), clinicalPearl; optional highYieldImageOrTable.
- **QuizView**: When rationale is structured (object or parseable JSON), render the 5-section layout. When rationale is legacy string, render as HTML as before.
- **ExplanationPanel** (components/questions/ExplanationPanel.tsx): Extend StructuredRationale with bottomLine and highYieldImageOrTable; render sections in order: Bottom Line → Why Correct → Why Distractors → High-Yield → Clinical Pearl.
- **Types**: Question.rationale remains `string` for storage; at render time accept `string | StandardizedRationale` (parse JSON when needed).

---

## References in Codebase

- **Types:** `components/questions/ExplanationPanel.tsx` (StructuredRationale), `src/types/index.ts` (Question).
- **Text rendering:** `lib/study/renderStructuredRationale.ts` — `renderStructuredRationale`, `renderBriefRationale`, `renderDistractorRationale`, `resolveStructuredRationale`.
- **Generation:** `functions/api/questions/generate-enhanced.ts`, `services/ai/geminiService.ts`.
- **Display:** `components/session/QuizView.tsx`, `components/questions/ExplanationPanel.tsx`.
