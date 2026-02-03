# Virtual OSCE (AI Patient) Audit

**Goal:** Simulate a real 15-minute clinical encounter, not just a chatbot.

**Scope:** AI patient dialogue behavior, physical exam simulation, and post-encounter grading/rubric visibility.

---

## 1. The "Uncanny Valley" of Chat

### Context

AI chatbots can be too verbose or too helpful. Real patients are often vague, annoyed, or misleading. The simulation should force students to use OPQRST and handle red herrings.

---

### 1.1 "Vagueness" Parameter

**Audit question:** Does the AI patient initially answer in vague, lay terms (e.g., "My stomach hurts") instead of medical language ("I have epigastric pain radiating to the back") so the student must ask clarifying questions (OPQRST)?

**Current state:**

| Area | Finding |
|------|--------|
| **Case design** | **Partial.** The patient case generator (`scripts/generators/patientEncounterCase-generator.ts`) explicitly requires: *"Chief Complaint: Use the patient's own words, not medical terminology. Include duration."* So chief complaints are intended to be lay-language. |
| **Display** | The chief complaint is shown as **structured data** in the UI (e.g. "Chief Complaint" card in `PatientEncounterMode.tsx`), not as the patient's first spoken line in chat. The student sees it before typing anything. So the student does not have to "ask what brings them in" to get the chief complaint—they already see it. |
| **Chat behavior** | The patient simulator prompt (`services/ai/geminiService.ts` → `chatWithPatientSimulator`) says: *"Do not volunteer information unless specifically asked"* and *"If a persona is provided, let it influence how forthcoming or guarded the patient is."* Persona can be Confused/Hostile/etc. There is **no explicit instruction** that the patient must answer *only* in vague/lay terms initially and require OPQRST-style follow-up before giving specifics. |
| **Difficulty** | `config/osce-settings.ts` has difficulty levels: cooperative (clear answers), difficult ("vague, distracted, incomplete answers"), very_difficult (fragmented, contradictory). The **difficult** modifier is a single prompt string; it is not clear if it is injected into the patient simulator. |

**Verdict:** **Partial.** Vagueness is supported by (1) chief complaint in "patient's own words" in case data, and (2) personality/difficulty modifiers. There is **no dedicated "vagueness" parameter** that guarantees the patient *always* starts in lay terms and withholds medical phrasing until the student asks OPQRST-style questions. Recommendation: add an explicit instruction in the patient simulator, e.g. *"Answer in the patient's own words (lay language). Do not use medical terms unless the student has already asked clarifying questions (e.g. location, character, radiation, timing)."*

---

### 1.2 "Red Herring" Logic

**Audit question:** Does the AI occasionally mention irrelevant information? (e.g., "I also broke my toe last year" when presenting for chest pain.)

**Current state:**

| Area | Finding |
|------|--------|
| **Case content** | **Yes.** The case generator prompt says: *"Include subtle red flags and risk factors... Add 1-2 misleading details that test clinical reasoning"* and defines *"Unnecessary Questions: Time-wasters that a skilled interviewer would skip."* So red herrings and distractors are **in the case content** (history, unnecessary questions). |
| **Chat behavior** | The patient simulator is given full `historyData` and instructed to reveal only when asked. There is **no explicit instruction** to "occasionally volunteer irrelevant or tangential information (e.g. past unrelated injuries)" as a *conversational* red herring. Red herrings are therefore present as **content** (what the patient says when asked about history) rather than as a modeled behavior (random irrelevant asides). |

**Verdict:** **Partial.** Red herrings exist in case design (misleading details, unnecessary questions). Conversational red herrings (irrelevant asides) are not explicitly instructed. Recommendation: add to the patient simulator, e.g. *"Occasionally include one irrelevant detail when answering (e.g. an unrelated past event or complaint) to simulate a real patient who goes off-topic; do not overdo it."*

---

## 2. Physical Exam Simulation

### Context

The user cannot touch a virtual patient. If typing "I do a physical exam" causes the AI to dump all findings, that is cheating. Findings should be tied to specific actions (e.g. "Listen to heart" → heart sounds only).

---

### 2.1 Specific Actions (No Dump-All)

**Audit question:** Must the user type specific actions ("Listen to heart", "Palpate abdomen") to get findings? Should they **not** get abdominal exam if they only asked for heart exam?

**Current state:**

| Area | Finding |
|------|--------|
| **Patient simulator** | `chatWithPatientSimulator` (geminiService.ts) includes: *"PHYSICAL EXAMS: If the user says 'I listen to the heart' or 'Examine abdomen', provide the **specific** finding from the PHYSICAL EXAM FINDINGS section."* It does **not** say: "Return **only** the finding(s) for the maneuver(s) the student just performed; if they said only 'listen to heart', do **not** return abdominal or other system findings." |
| **Vulnerability** | The full `physicalExamData` object is in the prompt. A student could type "I do a full physical exam" or "Complete physical exam" and the model might return **all** findings in one response. There is no strict rule forbidding that. |
| **Dedicated exam API** | `performPhysicalExam(action, caseData)` (geminiService.ts) is written for **one** user action and says: *"If the user asks for a general exam (e.g., 'listen to heart', 'examine abdomen'), return the **corresponding** finding."* So for a single action it is one finding. But the **main chat flow** uses `chatWithPatientSimulator`, which handles mixed dialogue (history + exam + orders) and does not enforce one-maneuver-one-finding. |

**Verdict:** **Vulnerability.** The intent is specific findings per action, but the chat simulator does not explicitly forbid returning multiple systems for a generic "physical exam" request. Recommendation: add to the patient simulator instructions: *"Return ONLY the physical exam finding(s) for the specific maneuver(s) the student just described. If they said only 'listen to heart', return only cardiac findings. Do not return abdominal, lung, or other system findings unless they explicitly performed or asked for that part of the exam. If the student says only 'I do a physical exam' or 'full exam' without specifying systems, respond with: 'Which part of the exam would you like to do? (e.g. heart, lungs, abdomen)'."*

---

### 2.2 Media Integration (e.g. "Look at the rash")

**Audit question:** When the user asks to "Look at the rash," does the UI show an actual image of the rash, or only a text description?

**Current state:**

| Area | Finding |
|------|--------|
| **Rash / skin images** | **No.** There is no flow in `PatientEncounterMode` that shows an image when the user asks to look at a rash or skin finding. Physical exam results are **text only** (simulator returns a string; UI displays it in chat or in the Physical Exam log). |
| **Multimedia** | `ClinicalFidelitySettings` includes `multimediaAuscultation` (heart/lung **sounds**). There are references to audio for murmurs and lung sounds (e.g. `SettingsStatsModal`, `AuscultationMode`). So **audio** for auscultation is considered; **images** for dermatologic (or other visual) findings are not implemented in the encounter flow. |
| **Docs** | `docs/PRODUCTION_READINESS_MASTER_PLAN.md` lists "Physical Exam Finding Images" as a gap: "No dedicated physical exam finding images" and suggests mapping findings to images (e.g. fundoscopy, otoscopy, throat, rash). |

**Verdict:** **Gap.** "Look at the rash" (or any visual exam) yields only a text description. Image popup for dermatologic (and other visual) findings is not implemented. Recommendation: add optional media (image URL or asset id) to case data for key visual findings and, when the student requests to look at that finding, show the image in the UI (e.g. modal or inline).

---

## 3. Assessment & Plan (Grading)

### Context

After the encounter, grading should reflect critical actions, dangerous actions (e.g. antibiotics for viral infection), and the rubric should be visible ("You missed: X").

---

### 3.1 Critical Actions Checklist

**Audit question:** Did the student perform the "must-do" items? (e.g. Chest pain: order EKG within first 5–10 minutes?)

**Current state:**

| Area | Finding |
|------|--------|
| **Scoring engine** | `services/domain/osceScoringEngine.ts` defines **condition-specific critical actions** (e.g. ACS: order ECG within 10 minutes, serial troponins, aspirin). These are used to build an `OSCEScoreReport` with `criticalActions` (triggered vs missed). |
| **Grade API** | `functions/api/osce/analysis/grade.ts` grades against a **CaseRubric** (checklist with optional `isRedFlag`). The rubric is per-case and comes from the DB; it is not the same as the hardcoded `CONDITION_CRITICAL_ACTIONS` in osceScoringEngine. |
| **Results flow** | On "End Encounter," `PatientEncounterMode` calls `generateDebrief` (Virtual Preceptor) and `enhancedOSCE.generateScoreReport`. It does **not** call `POST /api/osce/analysis/grade`. So the **rubric-based checklist** (item + status + feedback) from the grade API is **not** shown in the current results screen. |
| **What is shown** | The results view shows **PreceptorFeedback**: score, clinicalReasoning breakdown, missedCriticalCues, areasForImprovement, strengths, differentialDiagnosis. The **Enhanced OSCE** report (ScoreReport with Critical Actions) is generated but the results view is dominated by the Preceptor debrief; the Critical Actions list from the scoring engine is in the enhanced report object but may not be surfaced in the same place as the rubric. |

**Verdict:** **Partial.** Critical actions exist in code (osceScoringEngine and CaseRubric). The **faculty-style rubric** (checklist PASS/FAIL per item) is produced only by the grade API, which is **not** invoked in the end-encounter flow. So the "critical actions checklist" as a visible rubric is not fully wired to the main results UI. Recommendation: either (1) call the grade API when ending the encounter and display its checklist (and redFlagsMissed), or (2) ensure the Preceptor and/or enhanced report explicitly list "Critical actions: done / missed" in the results view.

---

### 3.2 Dangerous Actions Penalty

**Audit question:** Is there a major point deduction for dangerous actions? (e.g. prescribing antibiotics for a viral infection.)

**Current state:**

| Area | Finding |
|------|--------|
| **Virtual Preceptor** | `services/ai/virtualPreceptorService.ts` asks: *"Was the treatment plan **safe and appropriate**?"* and *"Did they address immediate threats?"* There is **no** explicit instruction such as "Apply a **major deduction** if the student prescribed antibiotics for a clearly viral illness" or "List dangerous actions and their impact on score." |
| **Grade API** | Uses **red flags**: rubric items can be marked `isRedFlag`; the grader returns `redFlagsMissed`. So if a rubric item is "Did not prescribe antibiotics for viral URI," missing it could be a red flag. Dangerous actions are therefore **modelable** via the rubric, but the rubric is case-specific and may not exist for all cases (see `OSCE_GRADING_AUDIT.md`: no path to create CaseRubric for every case). |
| **Preceptor output** | Preceptor returns narrative feedback, missedCriticalCues, areasForImprovement—not a dedicated "dangerousActions" list or a numeric penalty field. |

**Verdict:** **Partial.** Safety is evaluated in narrative form. Explicit "dangerous action" penalties exist in the grade API only when the CaseRubric includes such items as red flags. The Preceptor does not have a dedicated dangerous-actions list or fixed major deduction. Recommendation: (1) Add to the Preceptor prompt: "Identify any dangerous or inappropriate actions (e.g. antibiotics for viral infection, missing critical workup). List them in areasForImprovement and apply a significant score reduction for management when such actions occur." (2) Ensure rubrics (or a default rubric builder) include dangerous-action red flags where applicable.

---

### 3.3 Rubric Visibility ("You missed: X")

**Audit question:** After the session, does the UI show the exact rubric: e.g. "You missed: Asking about travel history"?

**Current state:**

| Area | Finding |
|------|--------|
| **Preceptor** | Shows **missedCriticalCues** ("The patient mentioned these important details that you didn't follow up on") and **areasForImprovement** (actionable improvements). That is rubric-**like** but not the literal checklist from CaseRubric. |
| **Grade API** | Returns `checklist: [{ item, status: "PASS"|"FAIL", feedback }]` and `redFlagsMissed`. This is the exact rubric. The API is **not** called in the end-encounter flow, so this checklist is **not** displayed in the current results view. |
| **ScoreReport (Enhanced OSCE)** | Shows "Critical Actions" with triggered vs total. That is a different list (from osceScoringEngine) than the CaseRubric checklist. |

**Verdict:** **Partial.** "You missed" is partially visible via **missedCriticalCues** and **areasForImprovement**. The **exact** CaseRubric checklist (item + PASS/FAIL + feedback) is not shown because the grade API is not used in the results flow. Recommendation: Integrate the grade API into the end-encounter flow and display the checklist (and redFlagsMissed) in the results screen, e.g. "Rubric: You passed/missed [item] — [feedback]."

---

## Summary Table

| Audit check | Status | Notes |
|-------------|--------|--------|
| Vagueness (lay terms, OPQRST) | Partial | Case uses "patient's own words"; no explicit chat rule to withhold medical terms until OPQRST. |
| Red herring (irrelevant info) | Partial | In case content; not explicit as conversational asides. |
| Physical exam: specific actions only | Vulnerability | Chat can return all findings for "full physical exam"; add strict one-maneuver-one-finding rule. |
| Physical exam: rash/image media | Gap | Text only; no image popup for "look at the rash." |
| Critical actions checklist | Partial | In code and rubric; grade API not called; checklist not shown in results. |
| Dangerous actions penalty | Partial | Safety in narrative; no explicit major deduction or dangerous-actions list in Preceptor. |
| Rubric visibility ("You missed: X") | Partial | MissedCriticalCues + areasForImprovement shown; CaseRubric checklist not shown. |

---

## References

- `services/ai/geminiService.ts`: `chatWithPatientSimulator`, `performPhysicalExam`
- `services/ai/virtualPreceptorService.ts`: `generateDebrief`
- `services/domain/osceScoringEngine.ts`: critical actions
- `functions/api/osce/analysis/grade.ts`: rubric grading, redFlagsMissed
- `components/modes/PatientEncounterMode.tsx`: encounter flow, results view
- `scripts/generators/patientEncounterCase-generator.ts`: case and chief complaint design
- `config/osce-settings.ts`: difficulty (vague/challenging)
- `docs/OSCE_GRADING_AUDIT.md`: CaseRubric and grading flow
