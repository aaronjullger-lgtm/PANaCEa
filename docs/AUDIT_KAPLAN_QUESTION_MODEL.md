# Audit: Kaplan-Level Question Model (3-Step Jump & Distractor Quality)

## Goal

Move from **first-order** questions (Diagnosis → Treatment) to **third-order** (Kaplan-style) questions and ensure **Kaplan-level distractors**: every wrong answer is the "right answer to a different question."

---

## 1. The "Double Jump" Rule (Third-Order Questions)

### Current State (Avoid)

- **First-order:** "A patient has a circular rash. What is the diagnosis?" → Answer: Lyme.
- **Second-order:** "A patient has a circular rash. What is the first-line treatment?" → Answer: Doxycycline.

### Target (Kaplan-Level)

- **Third-order:** "A patient has a circular rash. What is the mechanism of action of the first-line treatment for the likely complication if left untreated?"
- **Logic chain:**
  1. **Vignette** → Identify rash = Erythema migrans (Lyme).
  2. **Complication** → Untreated Lyme → e.g. neurologic/cardiac complications; first-line for early Lyme = Doxycycline.
  3. **Question answer** → "Inhibits 30S ribosomal subunit" (mechanism of doxycycline).

### Audit Check

- **Bad:** Stem asks only for diagnosis or only for treatment in a single step.
- **Good:** Stem requires at least two steps: e.g. (1) recognize diagnosis/complication, (2) then apply management, mechanism, or next best step.
- **Best:** Three steps: Vignette → Diagnosis → Complication/next step → Management/mechanism (or similar third-order endpoint).

---

## 2. Distractor Quality ("Right Answer to a Different Question")

### Current State (Avoid)

- **Bad distractors:** Obviously wrong (e.g., chemotherapy for simple otitis).
- **Weak distractors:** Vague or unrelated to the clinical scenario.

### Target (Kaplan-Level)

Each wrong answer should be **correct for a slightly different patient or scenario**.

**Example – Acute Otitis Media:**

| Option | Intended meaning | Scenario where it WOULD be correct |
|--------|-------------------|-------------------------------------|
| A | Antivirals / observation | Viral otitis or watchful waiting |
| B | Amoxicillin (or first-line abx) | **Answer** – bacterial AOM, no allergy |
| C | Tympanostomy tubes / referral | Recurrent otitis or effusion |
| D | Azithromycin / macrolide | Penicillin-allergic bacterial AOM |

### Audit Check

- **Bad:** Any distractor that would never be correct for a plausible clinical scenario.
- **Good:** Every distractor is a reasonable first-line or next step for *some* real scenario (different diagnosis, allergy, recurrence, severity, etc.).
- **Rationale:** For each wrong option, explanation should state *why* it is wrong *for this patient* (e.g. "Correct for penicillin-allergic patients, but this patient has no allergy").

---

## 3. Implementation Summary

- **Prompts:** All question-generation prompts (generate-enhanced, geminiService, generate-batch, _shared/question-generator, sessionService, lib/questionGenerator) include:
  - Double Jump / third-order stem requirement with Lyme/doxy/30S example.
  - Kaplan-level distractor rule with otitis example (viral / bacterial / recurrent / penicillin-allergic).
- **Validation:** `lib/distractorValidation.ts` and `services/core/questionQualityService.ts` document or suggest Kaplan-level distractors; validation reports can flag questions that lack plausible, scenario-specific distractors.
- **CoVe / quality:** generate-enhanced CoVe and any quality scoring continue to enforce medical accuracy and second/third-order stems.

---

## 4. References in Codebase

- **Generation:** `functions/api/questions/generate-enhanced.ts`, `services/ai/geminiService.ts`, `functions/api/questions/generate-batch.ts`, `functions/api/_shared/question-generator.ts`, `lib/services/session/sessionService.ts`, `lib/questionGenerator.ts`.
- **Distractor validation:** `lib/distractorValidation.ts`, `services/core/questionQualityService.ts`.
