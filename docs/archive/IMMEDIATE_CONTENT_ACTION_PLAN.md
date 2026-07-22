# Immediate Content Action Plan

This plan shifts users from **memorizing facts** to **reasoning through cases**, aligned with PANCE and clinical practice.

---

## 1. Golden Master Questions (Triple-Jump Template)

**Goal:** One "Golden Master" question per major category (Cardio, Pulm, GI) that uses **Triple-Jump logic** (Vignette → Diagnosis → Complication/next step → Answer). Use as the template for content writers and the AI generator.

**Location:** `data/goldenMasterQuestions.ts` (and referenced in generation prompts).

**Audit:** New questions should follow the same structure: vignette with pertinent positives/negatives, vitals as clues, third-order stem (e.g. mechanism of first-line treatment for the complication), Kaplan-level distractors, standardized 5-section rationale.

---

## 2. Strip the Diagnoses (Image-Based Questions)

**Goal:** For image-based questions, **delete the diagnosis from the text**. Force the image to do the work.

**Rules (see AUDIT_INTERACTIVE_LAB.md – Hidden Image):**
- BAD: "Patient has a fracture of the distal radius (see image)."
- GOOD: "Patient fell on an outstretched hand. Radiograph is shown."

**Actions:**
- Audit existing image-based content (photo drill, imaging drill, quiz questions with `imageUrl`) for vignette/caption text that states the finding or diagnosis.
- Remove or rewrite so only scenario + "Radiograph/Image is shown" (or equivalent) remains.
- Generation prompts already enforce "Hidden Image"; apply the same rule when curating or importing image questions.

**Audit script:** See `docs/AUDIT_STRIP_DIAGNOSIS_IMAGE_QUESTIONS.md` for a checklist and, if needed, a script to find questions where `question` or `vignette` text contains a diagnosis when `imageUrl` is present.

---

## 3. Rationale UI (No Wall of Text)

**Goal:** Redesign the "Answer Reveal" screen to **strictly follow the 5-section table**. Do not allow "Wall of Text" explanations.

**Sections (see AUDIT_STANDARDIZED_RATIONALE.md):**
1. Bottom Line  
2. Why the Correct Answer is Right  
3. Why the Distractors Are Wrong  
4. High-Yield Image/Table (optional)  
5. Clinical Pearl  

**Implementation:**
- When rationale is **structured** (object with bottomLine, whyCorrect, whyIncorrectA–D, clinicalPearl, highYieldImageOrTable): render the 5-section layout (already in QuizView and ExplanationPanel).
- When rationale is **legacy string**: do not render a single unbroken paragraph. Either (a) show it inside a constrained "Rationale" section (e.g. max-height + scroll, clear section heading) and optionally parse first sentence as "Bottom line" and rest as body, or (b) prompt migration to structured rationale. No raw wall of text.

---

## 4. Lab Calculator Tool (Calc Button)

**Goal:** Add a built-in **"Calc"** button for **Anion Gap**, **Osmolar Gap**, and **Parkland Formula** directly inside the question interface to encourage active calculation.

**Implementation:**
- In the quiz/question view, add a "Calc" button (e.g. in the question toolbar or near lab/vitals).
- On click, open a popover or modal with quick access to: **Anion Gap**, **Osmolar Gap**, **Parkland Formula** (burn resuscitation).
- Use or extend existing calculator components (`AnionGapCalculator`, plus new `OsmolarGapCalculator`, `ParklandCalculator` if missing) so the student can calculate without leaving the question.

---

## References

- **Golden Masters:** `data/goldenMasterQuestions.ts`
- **Rationale template:** `docs/AUDIT_STANDARDIZED_RATIONALE.md`
- **Hidden Image / Uncalculated Labs:** `docs/AUDIT_INTERACTIVE_LAB.md`
- **Vignette Evolution:** `docs/AUDIT_VIGNETTE_EVOLUTION.md`
- **Kaplan question model:** `docs/AUDIT_KAPLAN_QUESTION_MODEL.md`
- **Strip diagnosis audit:** `docs/AUDIT_STRIP_DIAGNOSIS_IMAGE_QUESTIONS.md`
