# Core Session Audit — Summary Checklist

Single checklist for the main session and OSCE audits. Use this to track implementation status.

---

## 1. Highlighter & Strikethrough (Main Session UI)

**Goal:** Text highlighting and answer strike-through in the Main Session UI.

| Check | Status | Notes |
|-------|--------|--------|
| Text highlighting | ✅ Implemented | `QuizView` → `QuestionDisplay`: user selection wraps in `span.user-highlight`; "Clear highlights" button and `ClearHighlightIcon` in header. |
| Answer strike-through | ⚠️ Partial | **Elimination:** `AnswerChoice` uses `line-through` for user-eliminated options (X icon). **After submit:** Wrong answers get red (selected) or dimmed (others); no explicit strikethrough on wrong answers post-submit. |

**Action:** [ ] Add optional strikethrough (or stronger visual) on wrong answers after submission if desired for clarity.

---

## 2. Normal Lab Reference (During Questions)

**Goal:** Slide-out "Normal Labs" reference panel available during questions.

| Check | Status | Notes |
|-------|--------|--------|
| Normal Labs panel | ❌ Not implemented | No slide-out or drawer for "Normal Labs" in `QuizView` or session layout. Backend: `scripts/seed/seed-normal-lab-values.ts` and `prisma` schema exist for normal lab data; `docs/PRODUCTION_READINESS_MASTER_PLAN.md` and `SPRINT_PLAN_10.md` reference a Normal Lab/Imaging reference system but no in-session UI. |

**Action:** [ ] Add a slide-out or tab "Normal Labs" (e.g. drawer from right) in the main session UI, populated from seeded normal lab reference data, available while answering questions.

---

## 3. "Vague" Patient AI (OSCE)

**Goal:** Tune the OSCE AI prompt so the patient responds initially in non-medical terms and requires OPQRST-style digging.

| Check | Status | Notes |
|-------|--------|--------|
| Vague / lay first response | ⚠️ Partial | Case generator uses "patient's own words" for chief complaint. Patient simulator says "do not volunteer information" and supports persona; **no explicit rule** that the patient must answer only in lay terms and withhold medical phrasing until OPQRST-style questions. |

**Action:** [ ] In `chatWithPatientSimulator` (e.g. `services/ai/geminiService.ts`), add an instruction such as: *"Answer in the patient's own words (lay language). Do not use medical terms unless the student has already asked clarifying questions (e.g. location, character, radiation, timing)."*

**Ref:** `docs/AUDIT_VIRTUAL_OSCE_AI_PATIENT.md` § 1.1.

---

## 4. Specific Exam Triggers (OSCE)

**Goal:** OSCE AI reveals exam findings only for the specific body systems requested (no dump for "full physical exam").

| Check | Status | Notes |
|-------|--------|--------|
| One maneuver → one finding | ⚠️ Vulnerability | Prompt says give "the specific finding" for phrases like "listen to heart" or "examine abdomen," but does **not** forbid returning all systems when the user says "I do a full physical exam." Full `physicalExamData` is in the prompt, so the model can dump everything. |

**Action:** [ ] In the patient simulator instructions, add: *"Return ONLY the physical exam finding(s) for the specific maneuver(s) the student just described. If they said only 'listen to heart', return only cardiac findings. Do not return abdominal, lung, or other system findings unless they explicitly performed or asked for that part of the exam. If the student says only 'I do a physical exam' or 'full exam' without specifying systems, respond with: 'Which part of the exam would you like to do? (e.g. heart, lungs, abdomen)'."*

**Ref:** `docs/AUDIT_VIRTUAL_OSCE_AI_PATIENT.md` § 2.1.

---

## 5. Critical Action Grading (OSCE)

**Goal:** Grade OSCEs using a "Critical Actions" checklist (e.g. "Ordered EKG"), not just conversation style.

| Check | Status | Notes |
|-------|--------|--------|
| Critical actions in code | ✅ Present | `services/domain/osceScoringEngine.ts` defines condition-specific critical actions (e.g. ACS: order ECG within 10 min). `functions/api/osce/analysis/grade.ts` grades against a per-case `CaseRubric` (checklist + red flags). |
| Wired to results UI | ❌ Gap | On "End Encounter," `PatientEncounterMode` calls Virtual Preceptor (`generateDebrief`) and enhanced OSCE report; it does **not** call `POST /api/osce/analysis/grade`. So the rubric checklist (item + PASS/FAIL + feedback) is not shown. |

**Action:** [ ] Either (1) call the grade API when ending the encounter and display its `checklist` and `redFlagsMissed` in the results view, or (2) ensure the Preceptor / enhanced report explicitly lists "Critical actions: done / missed" in the results UI.

**Ref:** `docs/AUDIT_VIRTUAL_OSCE_AI_PATIENT.md` § 3.1, 3.3.

---

## 6. Distractor Explanations (Main Session)

**Goal:** Question explanations specifically address why the wrong answers are wrong.

| Check | Status | Notes |
|-------|--------|--------|
| Generation | ✅ Required | Question generation (e.g. `services/ai/geminiService.ts`, enhanced generator) requires rationale to explain why each wrong answer is incorrect (e.g. whyIncorrectB/C/D in JSON). |
| Main session UI | ⚠️ Partial | `QuizView` renders `currentQuestion.rationale` as a single HTML blob (`dangerouslySetInnerHTML`). Question type uses `rationale: string`. So whether "why wrong" is visible depends on **content** of that string; there is no structured per-option "Why Incorrect" in the main session. `components/questions/ExplanationPanel.tsx` supports structured rationale (whyCorrect, whyIncorrectA/B/C/D) but is not used in the main QuizView. |

**Action:** [ ] Ensure explanations in the main session explicitly address wrong answers: either (1) have the main session use a panel that supports structured rationale (whyCorrect + whyIncorrect per option) when available, or (2) keep string rationale but enforce in generation that the rationale string includes a clear "why each wrong answer is wrong" section and optionally style it (e.g. subhead "Why the other answers are wrong"). Verify one generator path outputs whyIncorrect-style content and that it is shown.

**Ref:** Generation prompts (e.g. "The rationale MUST explain why each wrong answer is incorrect"); `components/questions/ExplanationPanel.tsx` (structured rationale UI).

---

## Checklist Summary (Copy-Paste)

```text
1. [ ] Highlighter & Strikethrough: Implement text highlighting and answer strike-through in the Main Session UI.
     → Highlighting: done. Strikethrough: done for eliminated options; [ ] add strikethrough for wrong answers after submit if desired.

2. [ ] Normal Lab Reference: Add a slide-out "Normal Labs" reference panel available during questions.
     → Not implemented. [ ] Add slide-out/drawer with normal lab reference in QuizView (or session layout).

3. [ ] "Vague" Patient AI: Tune the OSCE AI prompt to be initially non-medical and require "OPQRST" digging.
     → Partial. [ ] Add explicit lay-language / withhold-medical-terms-until-OPQRST instruction in chatWithPatientSimulator.

4. [ ] Specific Exam Triggers: Ensure the OSCE AI only reveals exam findings for the specific body systems requested.
     → Vulnerability. [ ] Add strict one-maneuver-one-finding rule and "Which part?" for generic "full exam."

5. [ ] Critical Action Grading: Grade OSCEs based on a "Critical Actions" checklist (e.g., "Ordered EKG"), not just conversation style.
     → Logic exists; not wired to UI. [ ] Call grade API on end encounter and show checklist + redFlagsMissed in results.

6. [ ] Distractor Explanations: Ensure question explanations specifically address why the wrong answers are wrong.
     → Generation requires it; main session shows single rationale string. [ ] Use structured rationale UI in main session or enforce + surface "why wrong" in string rationale.
```

---

## References

- **Virtual OSCE audit:** `docs/AUDIT_VIRTUAL_OSCE_AI_PATIENT.md`
- **Clinical Fidelity audit:** `docs/AUDIT_CLINICAL_FIDELITY.md`
- **OSCE grading audit:** `docs/OSCE_GRADING_AUDIT.md`
- **QuizView:** `components/session/QuizView.tsx` (highlighting, rationale display)
- **AnswerChoice:** `components/quiz/AnswerChoice.tsx` (elimination strikethrough)
- **Patient simulator:** `services/ai/geminiService.ts` → `chatWithPatientSimulator`
- **Grade API:** `functions/api/osce/analysis/grade.ts`
- **Structured rationale UI:** `components/questions/ExplanationPanel.tsx`
