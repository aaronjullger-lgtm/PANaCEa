# GitHub Spark Calculator Protocol (PANaCEa)

GitHub Spark is the **AI Code Creation** layer of the stack. It allows you to build **micro-apps** (Sparks) using natural language, effectively bypassing the need to hard-code complex clinical scoring logic. This doc defines the protocol for deploying medical calculators as Sparks and integrating them with the dashboard, Tutor, and OSCE.

---

## 1. Concept: Text-to-Tool

**BLUF:** You do **not** write code for these calculators. You **prompt** the logic, and Spark builds the interactive component.

- **Problem:** Hard-coding a calculator for every PANCE scoring system (e.g. PERC, Wells, Ranson's, TIMI) is technical debt and brittle when guidelines change.
- **Solution:** Use GitHub Spark to generate ephemeral “intelligent apps” from **Clinical Logic Prompts**. Each Spark is an isolated, embeddable micro-app. When guidelines change, update the natural language prompt in Spark and redeploy; the codebase stays agnostic.
- **Workflow:** Phase A (select high-yield targets) → Phase B (Clinical Logic Prompts = "source code") → Phase C (deploy Spark, embed, surface contextually in Tutor/OSCE).

---

## 2. Phase A: High-Yield Targets (PANCE Alignment)

Target the highest-weight content categories and their scoring systems:

| PANCE Area        | %  | Scoring Systems |
|-------------------|----|------------------|
| Cardiovascular    | 11%| TIMI Risk (STEMI/NSTEMI), CHA₂DS₂-VASc (AF stroke risk) |
| Pulmonary         | 9% | Wells Criteria (PE), PERC Rule |
| Gastrointestinal  | 8% | Ranson’s Criteria (pancreatitis), MELD |
| Neurologic        | 7% | Glasgow Coma Scale (GCS) |

Additional high-yield: Wells DVT, CURB-65 (pneumonia).

---

## 3. Phase B: Clinical Logic Prompts (The “Source Code”)

These prompts are the **source of truth**. Paste them into GitHub Spark to generate the micro-app. When guidelines change, edit the prompt and regenerate; do not rewrite app code.

### Wells Score for Pulmonary Embolism

```
Create a medical calculator for the Wells Score for Pulmonary Embolism. It needs checkboxes for the following criteria:

• Clinical signs and symptoms of DVT (+3.0)
• PE is #1 diagnosis or equally likely (+3.0)
• Heart rate > 100 (+1.5)
• Immobilization at least 3 days or surgery in the previous 4 weeks (+1.5)
• Previous, objectively diagnosed PE or DVT (+1.5)
• Hemoptysis (+1.0)
• Malignancy w/ treatment within 6 months or palliative (+1.0)

Output Logic:
• Score > 6: High Risk
• Score 2–6: Moderate Risk
• Score < 2: Low Risk

Style: Clean, medical dark mode, high contrast for accessibility.
```

### CHA₂DS₂-VASc (Stroke Risk in Atrial Fibrillation)

```
Create a medical calculator for the CHA₂DS₂-VASc score (stroke risk in atrial fibrillation). Checkboxes or toggles for:

• CHF (+1)
• Hypertension (+1)
• Age ≥75 (+2) or Age 65–74 (+1)
• Diabetes (+1)
• Stroke/TIA/thromboembolism (+2)
• Vascular disease (MI, PAD, aortic plaque) (+1)
• Sex female (+1)

Output: Total score 0–9. Display risk category (e.g. low/moderate/high) and a short recommendation (e.g. “Consider anticoagulation if score ≥2 men, ≥3 women”). Style: Medical dark mode, accessible.
```

### PERC Rule

```
Create a medical calculator for the PERC Rule (pulmonary embolism rule-out). Eight yes/no criteria (all must be NO to rule out PE in low-risk patients):

• Age ≥50
• Heart rate ≥100
• O₂ saturation <95% on room air
• Hemoptysis
• Estrogen use or pregnancy
• Prior PE or DVT
• Unilateral leg swelling
• Surgery or trauma in prior 4 weeks

Output: If any criterion is YES → “PERC positive, cannot rule out PE.” If all NO → “PERC negative, PE ruled out in low pretest probability.” Style: Medical dark mode.
```

### TIMI Risk Score (STEMI)

```
Create a medical calculator for the TIMI Risk Score for STEMI. Inputs: Age ≥75 (1), Diabetes/HTN/Angina (1), SBP <100 (1), HR >100 (1), Killip II–IV (2), Weight <67 kg (1), Anterior ST elevation or LBBB (1), Time to treatment >4 h (1). Total 0–8. Output risk category and 30-day mortality estimate. Style: Medical dark mode.
```

### Ranson’s Criteria (Pancreatitis)

```
Create a medical calculator for Ranson’s Criteria (acute pancreatitis severity). On admission: Age >55, WBC >16, Glucose >200, LDH >350, AST >250. At 48 h: Hct drop >10%, BUN rise >5, Ca <8, PaO2 <60, Base deficit >4, Fluid sequestration >6 L. Sum 0–11. Output: <3 = mild, ≥3 = severe. Style: Medical dark mode.
```

### MELD Score

```
Create a medical calculator for the MELD score (liver disease severity). Inputs: Bilirubin (mg/dL), INR, Creatinine (mg/dL), dialysis (yes/no). Use standard MELD formula (with upper/lower bounds). Output: MELD 6–40, interpretation (e.g. transplant listing priority). Style: Medical dark mode.
```

### Glasgow Coma Scale (GCS)

```
Create a medical calculator for the Glasgow Coma Scale. Three subscales: Eye (1–4), Verbal (1–5), Motor (1–6). Dropdowns or buttons for each. Total 3–15. Output: Total score and severity (e.g. 3–8 severe, 9–12 moderate, 13–15 mild). Style: Medical dark mode, high contrast.
```

---

## 4. Phase C: Integration (Micro-App in PANaCEa)

- **Deploy:** Spark compiles the prompt into a functional micro-app (hosted e.g. on Azure via Spark). Export or copy the app URL.
- **Embed:** Treat each Spark as an external tool:
  - **Option A:** Embed via iframe (`src` = Spark app URL) in Calculator Hub or a dedicated “Spark Calculator” panel.
  - **Option B:** Link from the Toolkit to “Open in new tab” when a calculator is Spark-generated; keep existing React calculators as fallback when no Spark URL is set.
- **Registry:** In `calculatorRegistry.ts`, each calculator can have:
  - `sparkAppUrl?: string` — when set, open/embed the Spark app instead of (or in addition to) the in-app React component.
  - `sparkPromptRef?: string` — reference to this doc (e.g. `"docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md#wells-pe"`) for reproducibility.
- **Contextual surfacing:** When a student is in a "Cardiology" simulation and asks "What is the patient's stroke risk?", the system surfaces the CHA₂DS₂-VASc Spark. The student inputs the data; the Spark returns the risk. Same pattern for Wells, PERC, etc. (See Intent → Calculator map below.).

---

## 5. Pedagogical Value (The Why)

- **Active recall:** Instead of the AI just telling the student the risk score, the student must launch the Spark and **input the clinical data** from the case. This reinforces **"Using Diagnostic and Laboratory Studies"** (10% of PANCE).
- **Agility:** Medical guidelines change. If Ranson's Criteria is updated, you don't rewrite the codebase; you **update the natural language prompt in Spark** to Version 2.0 and regenerate.
- **Board Alert** (see §7): Do not just give the student the calculator. Configure recall mode so students must supply criterion weights—testing **"Applying Basic Scientific Concepts"** (8% PANCE).

---

## 6. Intent → Calculator Map (Contextual Surfacing)

Use this map to suggest or open a calculator from natural language in Tutor/OSCE:

| Intent / Query Keywords                    | Calculator Id |
|-------------------------------------------|---------------|
| stroke risk, afib, anticoagulation, CHADS  | chads2vasc    |
| PE, pulmonary embolism, wells, clot lung   | wells_pe      |
| DVT, deep vein thrombosis, leg swelling   | wells_dvt     |
| PERC, rule out PE, low risk PE            | perc          |
| TIMI, STEMI, NSTEMI, MI risk              | timi_stemi / timi_nstemi |
| Ranson, pancreatitis severity             | ranson        |
| MELD, liver, transplant                   | meld          |
| GCS, Glasgow, coma                        | gcs           |
| CURB, pneumonia severity                  | curb65        |

Implementation: `lib/calculatorIntents.ts` (or equivalent) exports `getCalculatorIdsForIntent(query: string): string[]` so the Tutor/OSCE can suggest “Open CHA₂DS₂-VASc calculator” when the student asks about stroke risk.

---

## 7. ⚡ Board Alert: Clinical Reasoning (Don't Just Give the Calculator)

**Rule:** Do not just give the student the calculator.

- **Trap:** Students memorize the calculator output but forget the criteria and point values.
- **PANaCEa twist:** Support a **recall mode** (Board Alert mode) where point values are **hidden**. The student must supply the weight for each criterion (e.g. “Does Hemoptysis add 1.0 or 3.0 points?”) before the total is calculated. This tests “Applying Basic Scientific Concepts” (8% PANCE) and reinforces active recall.
- **Implementation:** In-app calculators (e.g. Wells PE) accept a `recallMode` (or `boardAlertMode`) prop. When true:
  - Do not show “+3” or “+1.5” next to each criterion.
  - For each criterion, show a small input (dropdown or number) for “Points: __” with valid options (e.g. 0, 1, 1.5, 3 for Wells PE).
  - On submit, compare student-entered points to the correct total (or per-criterion) and show feedback (correct/incorrect, with teaching moment).
- **Sparks:** When building the same logic in Spark, add to the Clinical Logic Prompt: “Optional mode: hide point values and ask the user to enter the points for each criterion before calculating; validate and give feedback.” So Spark-generated apps can support the same pedagogy.

---

## 8. Summary

| Item                    | Action |
|-------------------------|--------|
| High-yield systems      | TIMI, CHA₂DS₂-VASc, Wells PE/DVT, PERC, Ranson’s, MELD, GCS (and CURB-65). |
| Source of truth         | Clinical Logic Prompts in this doc; update prompts when guidelines change. |
| Build                  | Use GitHub Spark to generate micro-apps from these prompts. |
| Embed                  | Spark app URL in registry; embed via iframe or link from Calculator Hub / Toolkit. |
| Surface in context     | Intent → calculator map; Tutor/OSCE suggests calculator by query. |
| Board Alert            | Recall mode: hide point values; student inputs weights; validate and give feedback. Do not just give the calculator. |
