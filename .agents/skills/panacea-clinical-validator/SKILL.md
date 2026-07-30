---
name: panacea-clinical-validator
description: Validate AI-generated clinical content for medical accuracy, correct answers, and patient safety. Use when reviewing generated questions, condition descriptions, or drug data.
---

# Clinical Content Validator

## When to Use
- After AI generates new questions (before staging)
- When auditing existing question bank for accuracy
- Before promoting staging questions to live
- When updating clinical reference content

## Validation Criteria

### Question Correctness
1. The marked correct answer must be unambiguously correct per current guidelines
2. If multiple answers could be correct, the vignette must narrow to one
3. No "trick" questions where the "correct" answer depends on semantics

### Distractor Quality
1. Wrong answers must be plausible (common misconceptions, not absurd)
2. No two answers that are effectively the same
3. Distractors should test a specific knowledge gap

### Vignette Completeness
1. Contains all information needed to answer (no external knowledge assumed)
2. Vital signs, labs, and imaging findings are specific enough to be diagnostic
3. Patient demographics are relevant to the condition (not stereotyped)

### Emergency Topic Safety
Extra scrutiny for questions about:
- Anaphylaxis, stroke/TIA, acute coronary syndrome, cardiac arrest
- Sepsis, septic shock, diabetic ketoacidosis
- Status epilepticus, aortic dissection, pulmonary embolism
- Tension pneumothorax, airway obstruction

These require mandatory human review before promotion to live (enforced in `staging-questions.ts`).

### Drug Safety
1. First-line treatments must match current guidelines (not outdated)
2. Contraindications must be accurate
3. Black box warnings mentioned when relevant
4. Dosing ranges must be correct for the patient type

## Review Process
1. Read the question/condition content
2. Cross-reference with `lib/constants/blueprint.ts` for system/task mapping
3. Check the condition database in `functions/api/conditions/` for consistency
4. Flag any uncertainty — when in doubt, require human review

## Output
```
VALIDATION: <question/condition ID>
STATUS: APPROVED / NEEDS REVISION / REJECTED
ISSUES: [list with severity]
```
