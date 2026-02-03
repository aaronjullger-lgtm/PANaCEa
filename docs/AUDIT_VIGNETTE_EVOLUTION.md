# Audit: Vignette Evolution (Adaptive Complexity)

## Goal

A **"Hard"** question should not be obscure trivia. It should be a **"messier" vignette**: more clinical data, pertinent negatives that rule out look-alikes, and vitals that function as clues (including relative baselines).

---

## 1. Pertinent Negatives

### Principle (Pertinent Negatives)

The vignette should **explicitly rule out** key differentials (look-alikes) so the student must use negative findings, not just positive ones.

### Audit Check

- **Bad:** Vignette only lists positive findings. "Patient has chest pain. Diaphoresis. ECG shows ST elevation." (No mention of what was ruled out.)
- **Good:** Vignette includes pertinent negatives that rule out distractors. Example: "Patient has chest pain. **No tenderness to palpation** (rules out costochondritis). **No pain with breathing** (rules out pleuritis). Diaphoresis. ECG shows ST elevation."
- **Requirement:** For harder or same-difficulty questions, include at least 1–2 pertinent negatives that rule out a plausible look-alike. The student must recognize that the negative finding excludes a distractor.

### Implementation (Pertinent Negatives)

- Generation prompts: Instruct the model to include **pertinent negatives** that rule out the "look-alike" diagnoses (the same conditions that appear as distractors). Format can be explicit ("No X → rules out Y") or implicit ("No tenderness to palpation" when costochondritis is a distractor).

---

## 2. Vitals as Clues (Not Filler)

### Principle (Vitals)

Vitals should be **clinically meaningful**. A "normal" value can be abnormal in context (relative to the patient's baseline). Do not use vitals as filler.

### Audit Check (Vitals)

- **Bad:** Vitals are generic filler. "BP 120/80, HR 72, RR 14, T 98.6°F" with no relevance to the case.
- **Good:** Vitals are clues. Example: "Patient has known hypertension, usually 160/90 on home meds. Today BP is **110/70**." That "normal" BP is **relative hypotension** for this patient and should inform the answer (e.g. bleeding, overdose, sepsis).
- **Requirement:** When vitals appear, they should (a) support or contradict a diagnosis, (b) reflect relative change from baseline when relevant (e.g. "normally hypertensive"), or (c) act as distractor normals that the student must ignore. Do not list vitals that add no information.

### Implementation (Vitals)

- Generation prompts: Instruct that **vitals are not filler**. Use relative baselines when appropriate (e.g. "BP 110/70; patient is normally hypertensive on lisinopril"). For harder questions, use "normal" vitals that are abnormal in context (relative hypotension, relative bradycardia, etc.) so the student must interpret them.

---

## 3. "Hard" = Messier Vignette (Not Just Zebra)

### Principle (Hard = Messier)

**Hard** should mean a **messier, more complex vignette** (more data, pertinent negatives, vitals as clues, comorbidities), not only a rarer diagnosis or obscure fact.

### Audit Check (Hard = Messier)

- **Bad:** "Hard" = zebra diagnosis with a short, simple vignette.
- **Good:** "Hard" = same or common diagnosis with a **messier** presentation: pertinent negatives that rule out look-alikes, vitals that require relative interpretation, red herrings, or multiple comorbidities. The student must synthesize rather than recall a fact.

### Implementation (Hard = Messier)

- Difficulty instructions for "harder": Explicitly require **pertinent negatives** (rule out look-alikes) and **vitals as clues** (relative baselines, meaningful numbers). Prefer "messier vignette" over "zebra only."

---

## 4. References in Codebase

- **Prompts:** `functions/api/questions/generate-enhanced.ts` (DIFFICULTY_INSTRUCTIONS, VIGNETTE section), `services/ai/geminiService.ts` (VIGNETTE STRUCTURE), `scripts/regenerate-pool-v2.ts`, `functions/api/questions/generate-batch.ts`.
