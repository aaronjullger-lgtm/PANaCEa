# Audit: Interactive Lab Integration (Visual Vignettes)

## Goal

Move from **passive** presentation of labs and imaging to **active interpretation**: the student must perform the cognitive step (calculate the gap, read the image) rather than being given the answer in the text.

---

## 1. Uncalculated Labs ("Active Interpretation")

### Current State – Labs (Avoid)

- **Bad:** "Patient has an anion gap of 20."
- **Bad:** Stating derived values (anion gap, osmolar gap, corrected calcium, etc.) in the vignette or in displayed labs. If you give the gap, you rob the student of the cognitive step.

### Target – Labs (Kaplan-Level)

- **Good:** Give the **raw BMP** (e.g. Na 135, Cl 98, HCO3 12) in a table.
- **Requirement:** The student must **calculate the anion gap** themselves to realize it is metabolic acidosis (and then interpret etiology, next step, etc.).
- **Principle:** Text and displayed labs should provide only **raw/primary values**. Derived values (anion gap, osmolar gap, FENa, etc.) may be what the question asks for or what the student needs to derive; do not pre-calculate them in the vignette or in the lab panel.

### Audit Check (Labs)

- **Bad:** Any vignette or lab panel that states "Anion gap 20" or "Osmolar gap 18" when Na, Cl, HCO3 (or other raw values) are available for calculation.
- **Good:** BMP with Na, Cl, HCO3 (and other raw values only); question may ask "What is the anion gap?" or "What acid-base disorder?" so the student calculates.
- **Lab case generators:** Do not include "Anion Gap" (or other derived values) as a pre-calculated panel when BMP is present; provide raw BMP and let the student (or question stem) drive the calculation.

---

## 2. Hidden Image (Don’t Give Away the Finding in Text)

### Current State – Image (Avoid)

- **Bad:** "Patient has a fracture of the distal radius (see image)."
- **Bad:** Vignette text that states the radiologic or pathologic diagnosis when an image is shown. If the text gives it away, the image is useless decoration.

### Target – Image (Kaplan-Level)

- **Good:** "Patient fell on an outstretched hand. Radiograph is shown." (Or: "Wrist radiograph is shown.") The **text does not state the finding or diagnosis**; the student must **read the X-ray** to answer the question.
- **Requirement:** When a question **displays or references an image** (X-ray, CT, MRI, pathology, dermatology), the vignette must describe only:
  - Clinical scenario (mechanism of injury, chief complaint, relevant history), and
  - That an image/radiograph is shown (e.g. "Radiograph is shown." / "Image is shown.").
- The **finding or diagnosis must not appear in the vignette text**; the student must interpret the image to answer.

### Audit Check (Image)

- **Bad:** Vignette says "fracture of the distal radius" or "pneumonia on CXR" when an image is displayed or referenced.
- **Good:** Vignette says "Patient fell on outstretched hand. Radiograph is shown." or "Chest radiograph is shown." and the question stem asks for the finding, next step, or diagnosis based on the image.
- **Text-only questions (no image):** It is still fine to provide a "Radiologist's Report" as descriptive text (e.g. "Chest radiography demonstrates a focal consolidation in the RLL with air bronchograms") when there is no image—the student is interpreting the description. The "Hidden Image" rule applies when an **image is actually shown**; then the text must not state the finding/diagnosis.

---

## 3. Implementation Summary

- **Question generation prompts** (generate-enhanced, geminiService, generate-batch, regenerate-pool-v2): Include **Uncalculated Labs** (raw BMP only; no anion gap/osmolar gap in vignette) and **Hidden Image** (when image is referenced, vignette = scenario + "Radiograph/Image is shown"; no finding/diagnosis in text).
- **Lab case generation** (e.g. generateLabContent.ts): Do not add pre-calculated Anion Gap (or other derived panels) when raw BMP is present; provide raw values only so students (or question stems) drive calculation.
- **Imaging/photo drills:** When displaying an image, ensure vignette/caption does not state the finding or diagnosis—only scenario and "Image is shown."

---

## 4. References in Codebase

- **Question prompts:** `functions/api/questions/generate-enhanced.ts`, `services/ai/geminiService.ts`, `functions/api/questions/generate-batch.ts`, `scripts/regenerate-pool-v2.ts`.
- **Lab cases:** `scripts/generateLabContent.ts`, `functions/api/drills/lab-cases.ts`, `components/drill/MiniLabDrillSession.tsx`, `components/modes/FluidElectrolyteMode.tsx`.
- **Imaging/photo:** `components/drill/PhotoDrillCard.tsx`, `components/drill/ImagingDrillSession.tsx`, image-related prompts and captions.
