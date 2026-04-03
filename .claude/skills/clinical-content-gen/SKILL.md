---
name: clinical-content-gen
description: "PANCE/PANRE question generation, NCCPA blueprint taxonomy, question order classification (Bloom's), task categories, and clinical rotation content. Use this skill whenever generating study questions, working with the NCCPA blueprint, classifying questions by Bloom's taxonomy level, mapping questions to organ systems or task categories, creating OSCE cases, working with clinical rotation content, or doing any content generation for the PA curriculum. Also trigger on mentions of 'generate questions', 'PANCE prep', 'NCCPA blueprint', 'question bank', 'Bloom's taxonomy', 'task category', 'clinical rotation content', 'EOR exam', or 'question order'. This skill stacks with fsrs-pipeline for scheduling and panacea-dev for architecture."
---

# Clinical Content Generation

PANaCEa generates PANCE/PANRE-aligned study content using the NCCPA blueprint taxonomy, Bloom's-mapped question ordering, and AI-powered question generation via Gemini. This skill covers the taxonomy system, generation patterns, and quality constraints.

## NCCPA Blueprint Taxonomy

### Organ Systems (13 systems)
The PANCE tests across these systems with approximate weight:

| System | PANCE Weight | Key Conditions |
|--------|-------------|----------------|
| Cardiovascular | 16% | MI, CHF, AFib, HTN, DVT/PE |
| Pulmonary | 12% | COPD, Asthma, Pneumonia, PE |
| GI/Nutrition | 10% | GERD, Appendicitis, Cirrhosis, IBD |
| Musculoskeletal | 10% | Fractures, OA, RA, Gout |
| Endocrine | 6% | DM, Thyroid, Adrenal, Pituitary |
| Neurologic | 6% | Stroke, Seizure, MS, Meningitis |
| Reproductive | 8% | Pregnancy, STIs, Breast, Prostate |
| Renal/Urinary | 6% | AKI, CKD, UTI, Nephrolithiasis |
| Dermatologic | 5% | Melanoma, Psoriasis, Eczema, Infections |
| HEENT | 7% | Otitis, Sinusitis, Glaucoma, Pharyngitis |
| Hematologic | 5% | Anemia, Leukemia, Clotting disorders |
| Infectious Disease | 5% | HIV, TB, Sepsis, Lyme |
| Behavioral/Psych | 6% | Depression, Anxiety, Substance use, Schizophrenia |

### Task Categories (8 categories)
Each question maps to one of 8 NCCPA task categories:

1. **History & Physical** — Gathering clinical information
2. **Diagnostic Studies** — Ordering/interpreting labs, imaging
3. **Diagnosis** — Identifying the condition
4. **Health Maintenance** — Screening, prevention, immunizations
5. **Clinical Intervention** — Treatment decisions
6. **Pharmaceutical Therapeutics** — Drug selection, dosing, interactions
7. **Clinical Therapeutics** — Non-drug treatments, procedures
8. **Applying Scientific Concepts** — Pathophysiology, mechanism-based reasoning

### Question Order (Bloom's Taxonomy Mapping)

Questions are classified by cognitive complexity:

| Order | Bloom's Level | Description | Example |
|-------|--------------|-------------|---------|
| `first` | Remember/Understand | Recall facts, identify definitions | "Which lab confirms DKA?" |
| `second` | Apply/Analyze | Apply knowledge to clinical scenarios | "A 55yo male presents with crushing chest pain..." |
| `third` | Evaluate/Create | Synthesize, prioritize, make complex decisions | "Given conflicting lab results, which diagnosis is most likely and what's your next step?" |

### Phase-Based Distribution

The mix of question orders shifts based on the learner's phase:

```typescript
// From lib/nccpa-question-weighting.ts
ORDER_DISTRIBUTION_BY_PHASE = {
  didactic:    { first: 0.50, second: 0.35, third: 0.15 },
  clinical:    { first: 0.20, second: 0.50, third: 0.30 },
  pance_prep:  { first: 0.15, second: 0.40, third: 0.45 },
}
```

Didactic students need more recall; PANCE-prep students need more synthesis.

## Question Data Schema

Every question stored in `PreGeneratedQuestion.questionData` follows this shape:

```typescript
interface QuestionData {
  stem: string;                    // The question text/vignette
  correctAnswer: string;           // The correct answer
  options: Array<{                 // Answer choices (usually 4-5)
    text: string;
    isCorrect: boolean;
  }>;
  rationale: string;               // Explanation of why the answer is correct
  system: string;                  // Organ system (from NCCPA list)
  taskCategory: string;            // One of 8 NCCPA task categories
  questionOrder: 'first' | 'second' | 'third';  // Bloom's level
  difficulty: number;              // 1-5 scale
  tags?: string[];                 // Additional topic tags
  relatedConditions?: string[];    // Linked conditions for confusion pairs
}
```

**Field name aliases to watch for**: `correctAnswer` vs `answer` vs `correct_option`, `stem` vs `questionText` vs `question`. The codebase has multiple conventions — always check which field name the consumer expects.

## Gemini Question Generation

Questions are generated via the Gemini API with strict schema enforcement. The generation prompt includes:

1. **System/topic targeting** — Specify the organ system and condition
2. **Order/taxonomy constraints** — Request specific Bloom's level
3. **Task category alignment** — Map to NCCPA task categories
4. **Distractor quality rules** — Distractors must be plausible, clinically relevant, and represent common misconceptions
5. **Vignette requirements** — Second/third-order questions need patient demographics, presenting complaint, relevant history, PE findings, and lab values

### Quality Constraints for Generated Questions

- **No "all of the above" or "none of the above"** options
- **Distractors must be clinically plausible** — not obviously wrong to a first-year student
- **Vignettes must include** age, sex, presenting complaint, relevant history, and at least one physical finding
- **Rationale must explain** why correct answer is right AND why each distractor is wrong
- **Answer position should be randomized** — correct answer shouldn't always be option C
- **Avoid negative stems** ("Which of the following is NOT...") — rephrase positively

## Clinical Rotation Content

From `lib/constants/pa-curriculum.ts`:

### Required Rotations (7)
Each rotation maps to specific organ systems and has high-yield conditions:

| Rotation | Duration | Systems | High-Yield Topics |
|----------|----------|---------|-------------------|
| Internal Medicine | 6 weeks | CV, Pulm, GI, Endo, Renal, Heme | CHF, COPD, DM, CKD, Anemia |
| Family Medicine | 6 weeks | All systems | Preventive care, chronic disease mgmt |
| Emergency Medicine | 6 weeks | CV, Pulm, Neuro, MSK, Trauma | Chest pain, Stroke, Fractures, Sepsis |
| General Surgery | 6 weeks | GI, MSK, General | Appendicitis, Cholecystitis, Hernias |
| Pediatrics | 6 weeks | All (pediatric-specific) | Well-child visits, Common illnesses |
| Behavioral Health | 4 weeks | Psych | Depression, Anxiety, Substance abuse |
| OB-GYN | 6 weeks | Repro | Prenatal care, Labor, Gynecologic conditions |

### Helper Functions
- `findRotation(name)` — Look up rotation by name
- `getRotationSystems(name)` — Get mapped organ systems
- `getRotationHighYield(name)` — Get high-yield conditions
- `inferPhase(user)` — Determine didactic/clinical/pance_prep from user profile

## OSCE Case Generation

For OSCE (Objective Structured Clinical Examination) patient simulation cases:

### Required Case Components
1. **Chief complaint** — What brings the patient in
2. **Patient demographics** — Age, sex, relevant background
3. **History elements** — HPI, PMH, medications, allergies, social/family history
4. **Physical exam findings** — Relevant positive and negative findings
5. **Diagnostic data** — Labs, imaging, ECG results as appropriate
6. **Correct diagnosis** — The primary diagnosis
7. **Differential diagnoses** — 2-3 plausible alternatives
8. **Recommended workup** — Appropriate diagnostic tests
9. **Treatment plan** — First-line and alternative treatments

### Rotation-Case Mapping
From `ROTATION_CASE_MAP` — 10+ rotation-to-condition mappings ensure OSCE cases align with the student's current clinical rotation.

### Adaptive Personality Selection
`services/domain/adaptivePersonalitySelector.ts` selects patient personality traits based on:
- Student weakness areas (targets conditions they struggle with)
- Progressive difficulty tiers
- Rotation-specific personality weights (e.g., anxious patients in behavioral health rotations)

## Content Gap Analysis

When generating content, check for under-represented areas:

1. Query existing question counts by system and task category
2. Compare against NCCPA blueprint weights
3. Prioritize generation for systems with the largest gap between target and actual representation
4. Current known gaps: CV and PULM are under-represented in the question bank

## Stacking with Other Skills

- **fsrs-pipeline**: Questions feed into the FSRS scheduler. `questionOrder` and `taskCategory` influence par time calculations and difficulty estimation.
- **panacea-dev**: Use the project patterns skill for understanding where generated content is stored and how it flows through the system.
- **cf-edge-api**: Question generation endpoints live in `functions/api/` and follow edge function patterns.
