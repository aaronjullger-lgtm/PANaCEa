---
name: Main OSCE Clinical Library
overview: Plan for 10 improvements across Main Session (4), OSCE (4), and Clinical Library (2). Several items are already implemented; this plan focuses on remaining work and verification.
todos: []
isProject: false
---

# Main Session, OSCE, and Clinical Library Improvements Plan

## Summary of Current State

Research shows several items from the improvement list are **already implemented**:

- **Normal Labs slide-out panel** ([QuizView.tsx](components/session/QuizView.tsx), [NormalLabsPanel.tsx](components/session/NormalLabsPanel.tsx)) – toggle button and slide-out exist
- **EMR tabbed layout** ([PatientEncounterMode.tsx](components/modes/PatientEncounterMode.tsx) lines 1660–1689) – HPI | PMH | Meds | Vitals | Labs when `clinicalFidelity.emrInterface` is on
- **Vague patient / OPQRST** ([geminiService.ts](services/ai/geminiService.ts) lines 1605–1606) – "VAGUE PATIENT / LAY LANGUAGE" in `chatWithPatientSimulator` prompt
- **Specific exam triggers** (same prompt line 1607) – "Which part of the exam would you like to do?" for generic "full exam"
- **Clinical library error display** ([ClinicalReferenceLibrary.tsx](components/library/ClinicalReferenceLibrary.tsx) lines 597–601, 694–696) – `ErrorState` shown for `systemsError` and `error`
- **Offline review retry** ([syncManager.ts](lib/services/sync/syncManager.ts)) – `syncReviews` uses `syncAttempts < 5` and `scheduleRetry` on failure

**Recommendation:** Update [AUDIT_COMPREHENSIVE_POST_IMPLEMENTATION.md](docs/AUDIT_COMPREHENSIVE_POST_IMPLEMENTATION.md) to mark these as implemented. Remaining work:

---

## 1. Main Session (4 items)

### 1.1 Normal Labs panel (verify / audit update)

**Status:** Implemented.

- [QuizView.tsx](components/session/QuizView.tsx) imports `NormalLabsPanel`, uses `showNormalLabsPanel` state and Beaker toggle
- [NormalLabsPanel.tsx](components/session/NormalLabsPanel.tsx) fetches from `/api/reference/normal-labs`, shows categories and ranges
- **Action:** Update audit doc and confirm UX (visibility, position, behavior)

### 1.2 Distractor explanations (structured rationale)

**Status:** Partially implemented.

- [ExplanationPanel.tsx](components/questions/ExplanationPanel.tsx) defines `StructuredRationale` with `whyIncorrectA/B/C/D`
- QuizView (lines 1887–1891) parses these and builds rationale sections
- Improvement: ensure question generation/API populates these, and surface them clearly (e.g. collapsible "Why the others were wrong")

**Plan:**

- Audit question generation ([functions/api/questions/generate.ts](functions/api/questions/generate.ts)) and confirm rationale schema includes `whyIncorrectA/B/C/D`
- Add or refine a collapsible "Why wrong" section in QuizView/ExplanationPanel when `whyIncorrect`* exist, with option labels (A/B/C/D)

### 1.3 Strikethrough on wrong answers after submit

**Status:** Not implemented.

- [AnswerChoice.tsx](components/quiz/AnswerChoice.tsx) uses `opacity-60` for wrong options when `isAnswered && !isCorrect && !isSelected` (lines 95–97)
- No `line-through` applied

**Plan:**

- Add `line-through` (e.g. `decoration-line-through`) to wrong options when `isAnswered` (i.e. `isAnswered && !isCorrect && !isSelected`)

### 1.4 Offline review retry visibility

**Status:** Backend retry logic exists; UX visibility is minimal.

- `syncManager` has `queueReview`, `syncReviews`, `syncAttempts < 5`, `scheduleRetry`
- UI likely does not surface "X reviews pending sync" or explicit retry

**Plan:**

- Inspect `useSyncStatus` / `useOfflineSync` and any sync status UI (e.g. dashboard, header)
- Add or extend sync status to show `pendingReviews` and a retry control when sync fails
- Optionally add toast when reviews fail to sync and retry is scheduled

---

## 2. OSCE (4 items)

### 2.1 Vague patient AI (verify / strengthen)

**Status:** Implemented in prompt.

- `chatWithPatientSimulator` (lines 1605–1606) includes "VAGUE PATIENT / LAY LANGUAGE" and OPQRST example
- **Action:** Optionally expand lay-language examples in the prompt; then update audit

### 2.2 Specific exam triggers (verify)

**Status:** Implemented in prompt.

- Same prompt (line 1607): generic "full exam" triggers "Which part of the exam would you like to do?"
- `performPhysicalExam` prompt also has similar behavior
- **Action:** Update audit; optionally add tests or logs if behavior needs validation

### 2.3 EMR tabbed layout (verify / audit update)

**Status:** Implemented.

- PatientEncounterMode uses `clinicalFidelity.emrInterface` and renders HPI | PMH | Meds | Vitals | Labs
- **Action:** Update audit doc

### 2.4 Physical exam finding images

**Status:** Not implemented.

- `performPhysicalExam` and patient case data return text only; no image URLs

**Plan:**

- Extend case schema to support optional image URLs per finding (e.g. rash, edema)
- Update `PatientEncounterCase` / `physicalExamData` types
- Modify `performPhysicalExam` to include image URLs when available
- Render images in the chat/response UI (e.g. when user asks for a visual exam like "show me the rash")

---

## 3. Clinical Library (2 items)

### 3.1 User-visible error handling (verify / add toast)

**Status:** ErrorState is shown.

- `ClinicalReferenceLibrary` shows `ErrorState` for `systemsError` and `error` (lines 597–601, 694–696)
- Improvement: add toast for critical failures so users see feedback even if they scroll past the error area

**Plan:**

- Import `toast` (e.g. from `@/lib/toast`)
- Call `toast.error(message)` when `setError` or `setSystemsError` is used
- Keep existing `ErrorState` as primary in-context display

### 3.2 Normal Labs view in Clinical Library

**Status:** Not implemented.

- Normal Labs exist in main session via `NormalLabsPanel`
- No Normal Labs section in Knowledge Base / Condition Library

**Plan:**

- Add a "Normal Labs" tab or section in [KnowledgeBaseHub.tsx](components/knowledge/KnowledgeBaseHub.tsx) or in the Clinical Library layout
- Reuse [NormalLabsPanel](components/session/NormalLabsPanel.tsx) or its API (`/api/reference/normal-labs`) in a library-style layout
- Ensure auth and category filter work in library context

---

## Implementation Order


| Priority | Item                            | Complexity | Dependencies                 |
| -------- | ------------------------------- | ---------- | ---------------------------- |
| 1        | Strikethrough wrong answers     | Low        | None                         |
| 2        | Clinical library toast on error | Low        | None                         |
| 3        | Distractor rationale visibility | Medium     | Question generation schema   |
| 4        | Offline review retry UI         | Medium     | useSyncStatus/useOfflineSync |
| 5        | Normal Labs in Clinical Library | Medium     | NormalLabsPanel API          |
| 6        | Physical exam finding images    | High       | Case schema, generation, UI  |
| 7        | Audit doc updates               | Low        | None (all items)             |


---

## Key Files

- [components/session/QuizView.tsx](components/session/QuizView.tsx) – rationale, Normal Labs
- [components/quiz/AnswerChoice.tsx](components/quiz/AnswerChoice.tsx) – strikethrough
- [components/questions/ExplanationPanel.tsx](components/questions/ExplanationPanel.tsx) – structured rationale
- [lib/services/sync/syncManager.ts](lib/services/sync/syncManager.ts) – offline review retry
- [services/ai/geminiService.ts](services/ai/geminiService.ts) – patient simulator prompts
- [components/modes/PatientEncounterMode.tsx](components/modes/PatientEncounterMode.tsx) – EMR layout
- [components/library/ClinicalReferenceLibrary.tsx](components/library/ClinicalReferenceLibrary.tsx) – error handling
- [components/knowledge/KnowledgeBaseHub.tsx](components/knowledge/KnowledgeBaseHub.tsx) – library tabs

