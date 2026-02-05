# Veo Clinical Motion Flashcards – Technical Specification

**Status:** Spec complete; implementation pending Veo API availability  
**Blueprint Gap:** Neurology (7%) + Musculoskeletal (8%) – temporal pathologies

---

## 1. Pedagogy (The "Why")

Textbooks and static PDFs cannot effectively teach temporal pathologies. Students cannot learn:
- **Parkinsonian gait** (festinating gait, reduced arm swing)
- **Seizure vs. syncope** (motor patterns, onset, duration)
- **Cerebellar ataxia** (wide-based gait, dysmetria)
- **Antalgic gait** (limping, weight shift)
- **Hemiplegic gait** (circumduction, foot drop)

**Solution:** Veo fills this gap by turning text descriptions of movement mechanics into visual evidence.

---

## 2. Workflow

```
Text prompt → Veo API → 5s video clip → Clinical Motion Flashcard (student-facing)
```

| Step | Action |
|------|--------|
| 1 | Student selects pathology (e.g., "Parkinsonian Gait") |
| 2 | System sends curated prompt to Veo video generation API |
| 3 | Veo returns 5-second clip |
| 4 | Clip cached in Supabase/GCS; served as flashcard |
| 5 | Student reviews with PANCE-relevant teaching points |

---

## 3. Prompt Strategy

Use descriptive, medical prompts to force the model into a clinical context.

**Template:**
```
Cinematic shot, medical education context. [Demographic] patient demonstrating [specific movement pathology].
```

**Starter Prompts (Neuro/MSK):**

| Pathology | Prompt |
|-----------|--------|
| Parkinsonian gait | Cinematic shot, medical education context. An elderly male patient demonstrating a shuffling gait with reduced arm swing and festination. |
| Cerebellar ataxia | Cinematic shot, medical education context. A middle-aged patient demonstrating a wide-based, uncoordinated gait with heel-to-shin dysmetria. |
| Antalgic gait | Cinematic shot, medical education context. An adult patient with a limp favoring the right leg, shortened stance phase on the affected side. |
| Hemiplegic gait | Cinematic shot, medical education context. A patient post-stroke demonstrating circumduction of the affected leg with foot drop. |
| Seizure (tonic-clonic) | Cinematic shot, medical education context. Simulated generalized tonic-clonic seizure with rhythmic jerking of limbs. |
| Syncope (presyncope) | Cinematic shot, medical education context. A patient demonstrating gradual loss of postural tone and slumping. |
| Resting tremor | Cinematic shot, medical education context. An elderly patient with pill-rolling tremor of the hands at rest. |

---

## 4. Safety ("Board Alert")

> **Do not rely on Veo for diagnostic accuracy without human review.**

- Generative video can **hallucinate movements** just as LLMs hallucinate facts.
- Clips are for **educational visualization only**, not patient diagnosis.
- **Always verify** against PANCE Blueprint standards for Neurology and Musculoskeletal.
- Add human review/approval before exposing new clips to students.
- Display disclaimer: *"AI-generated for education. Verify with clinical reference."*

---

## 5. Tech Stack

| Component | Choice |
|-----------|--------|
| API | Google Veo (Vertex AI or AI Studio) – confirm availability |
| Storage | Supabase Storage or GCS for generated clips |
| Caching | Cache by prompt hash to avoid duplicate generation |
| Frontend | Extend Visualizer or add "Clinical Motion" mode |
| UI | Video player with teaching points overlay |

---

## 6. Implementation Checklist

- [ ] Verify Veo video generation API availability (Vertex AI / AI Studio)
- [ ] Create `functions/api/visualizer/veo-generate.ts` – proxy to Veo API
- [ ] Define prompt library (Neuro/MSK pathologies)
- [ ] Add storage + CDN path for generated clips
- [ ] Build Clinical Motion flashcard component
- [ ] Add human review workflow for new clips
- [ ] Display safety disclaimer on all clips
