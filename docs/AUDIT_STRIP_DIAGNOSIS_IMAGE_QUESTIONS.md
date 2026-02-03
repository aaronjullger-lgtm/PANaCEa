# Audit: Strip Diagnosis from Image-Based Questions

## Goal

For any question that **displays an image** (X-ray, CT, dermatology, pathology), the **text must not state the finding or diagnosis**. Force the image to do the work.

**Rule (Hidden Image):**  
- BAD: "Patient has a fracture of the distal radius (see image)."  
- GOOD: "Patient fell on an outstretched hand. Radiograph is shown."

---

## Checklist for Image-Based Questions

1. **Identify image-based items**
   - Quiz/session questions with `imageUrl` (or equivalent).
   - Photo drill items (radiology, derm, etc.).
   - Imaging drill items.
   - Any content where a vignette/caption is shown alongside an image.

2. **For each item, check the text (vignette, question, caption)**
   - Does it name the finding? (e.g. "fracture," "pneumonia," "melanoma")
   - Does it state the diagnosis? (e.g. "distal radius fracture," "community-acquired pneumonia")
   - If yes → **strip or rewrite**: keep only clinical scenario (mechanism, complaint, history) + "Radiograph is shown" / "Image is shown" (or equivalent). Do not state what the image shows.

3. **Generation and curation**
   - All generators that create image-based questions must follow the Hidden Image rule (see AUDIT_INTERACTIVE_LAB.md).
   - When importing or curating image questions, apply the same rule before publishing.

---

## Where to Look in Codebase

- **Quiz questions with image:** `Question.imageUrl`; display in `QuizView.tsx`. Text: `question`, `vignette`.
- **Photo drill:** `PhotoDrillCard`, `use-photo-drill`; question/caption text in drill data.
- **Imaging drill:** `ImagingDrillSession`, imaging content with captions.
- **DB/content:** Any table or JSON that stores `imageUrl` (or media) plus `question`/`vignette`/`caption` text.

---

## Script / Manual Audit

- **Query:** Find all questions (or drill items) where `imageUrl` (or media) is non-null.
- **For each:** Search the associated text for diagnosis/finding keywords (e.g. "fracture," "pneumonia," "infiltrate," "mass," "melanoma," "cellulitis"). If the text would give away what the image shows, flag for rewrite.
- **Fix:** Replace with scenario-only + "Image is shown" (or "Radiograph is shown") and optional anatomic/technique note (e.g. "PA and lateral wrist radiographs are shown.") without stating the finding.

---

## References

- **Hidden Image rule:** `docs/AUDIT_INTERACTIVE_LAB.md`
- **Action plan:** `docs/IMMEDIATE_CONTENT_ACTION_PLAN.md`
