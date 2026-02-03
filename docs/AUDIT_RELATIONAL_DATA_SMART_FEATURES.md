# Relational Data for Smart Features Audit

**Date:** 2025-02-02  
**Scope:** Structured entity links enabling auto-generated mini modes (e.g., "Generate a quiz on ACE Inhibitors")

---

## 1. Audit Requirement

> **Linked Entities:** Questions must have hard links to entities so we can:
> - "Generate a quiz on ACE Inhibitors" → `SELECT * FROM questions WHERE related_drug_class = 'ACE_Inhibitor'`
> - "Quiz on Strep Throat" → Link to Disease:Pharyngitis
>
> **Why:** Without structured links, every mini-quiz must be hand-curated—unscalable.

---

## 2. Disease/Condition Links — ✅ PARTIAL

### Question → Condition (Disease)

| Model | conditionId | medicalContentId | Link Type |
|-------|-------------|------------------|-----------|
| **Question** | ✅ FK to Condition | ✅ FK to MedicalContent | Hard link |
| **PreGeneratedQuestion** | ✅ FK to Condition | ✅ FK to MedicalContent | Hard link |

- Questions can link to **Condition** (e.g., Pharyngitis, Strep Throat) via `conditionId`.
- **Condition** is the normalized disease entity (stable IDs).
- **Implementation:** `SELECT * FROM questions WHERE conditionId = 'pharyngitis'` or by condition name.
- **Gap:** Condition naming/ID convention must be consistent (e.g., "pharyngitis" vs "strep_throat"). No separate "Disease" entity—Condition serves that role.

---

## 3. Drug / Drug-Class Links — ❌ INSUFFICIENT

### Current state

| Model | relatedDrugs | relatedDiseases | drugClass | Hard link to Drug? |
|-------|--------------|-----------------|-----------|--------------------|
| **Question** | ✅ `String[]` | ✅ `String[]` | ❌ None | ❌ No |
| **PreGeneratedQuestion** | ❌ None | ❌ None | ❌ None | ❌ No |
| **Drug** | — | — | ✅ `String[]` | — |

### Limitations

1. **relatedDrugs** is a free-text array (e.g., `['Lisinopril', 'Amoxicillin']`), not a FK to `Drug`.
2. **No drugClass on Question** — cannot run `WHERE related_drug_class = 'ACE_Inhibitor'`.
3. **No QuestionDrugLink** — no junction table linking Question to Drug.
4. **Pharmacology drill** (`functions/api/questions/pharmacology-drill.ts`) references `question.drugClass` in its where clause, but **Question has no drugClass field** in the schema—likely a bug or reliance on an older/unused schema.

### Path to "questions about ACE Inhibitors"

| Approach | Feasible? | Notes |
|----------|-----------|-------|
| `WHERE related_drug_class = 'ACE_Inhibitor'` | ❌ | No such column |
| `WHERE 'ACE Inhibitor' = ANY(related_drug_classes)` | ❌ | No related_drug_classes |
| `WHERE relatedDrugs && (SELECT array_agg(genericName) FROM Drug WHERE 'ACE Inhibitor' = ANY(drugClass))` | ⚠️ | Possible but fragile; relatedDrugs are strings, not FKs |
| Via conditionId → DrugConditionLink → Drug | ⚠️ | Only for "conditions treated by ACE inhibitors," not "questions about ACE inhibitors" |

---

## 4. Polypharmacy Puzzle — Uses Drug Table, Not Questions

### Implementation

- **Source:** `Drug` table (`prisma.drug.findMany()`).
- **Flow:** Fetches drugs with `drugClass`, `sideEffects`, `interactions`; builds cases from `DEPRESCRIBING_SCENARIOS` and drug class matching.
- **Questions:** Does **not** use the Question table. Generates deprescribing cases dynamically from Drug registry.
- **Entity links:** Uses Drug ↔ drugClass. No Question involvement.

### Verdict

- Polypharmacy has the structured data it needs (Drug table with drugClass).
- It does **not** depend on Question entity links.
- It does **not** enable "generate a quiz on ACE inhibitors" from the Question pool.

---

## 5. Bug-Drug Mastery — Uses Guidelines, Not Questions

### Implementation

- **Source:** `AntibioticGuideline` (organism, effective, resistant) + `AntibioticConditionLink` (antibiotic ↔ condition).
- **UI:** AntibioticMode uses static `ANTIBIOTICS` plus API-fetched guidelines.
- **Questions:** No use of Question table. Drill presents organism → antibiotic coverage; no question bank.

### Entity links

- `AntibioticConditionLink`: AntibioticGuideline ↔ Condition.
- `AntibioticGuideline`: organism, effective, resistant arrays.
- No link from Question to AntibioticGuideline or organism.

### Verdict

- Bug-Drug has structured organism ↔ antibiotic data.
- It does **not** use Question entities.
- Cannot "generate a quiz on cephalosporins" from existing questions.

---

## 6. Mini-Mode Generation — Blocked

### Target feature

> "Generate a quiz on ACE Inhibitors"
>
> `SELECT * FROM questions WHERE related_drug_class = 'ACE_Inhibitor'`

### Current blockers

1. **No drugClass (or equivalent) on Question** — cannot filter by drug class.
2. **relatedDrugs** is free text — would require joining to Drug by name, which is brittle.
3. **No QuestionDrugLink** — no many-to-many between Question and Drug.
4. **PreGeneratedQuestion** has no drug-related fields — main session pool is unqueryable by drug class.

---

## 7. Recommendations

### 1. Add drug-class linkage to questions

**Option A (simple):** Add `relatedDrugClasses: String[]` to Question and PreGeneratedQuestion.

- Example: `['ACE Inhibitor', 'Beta Blocker']`.
- Query: `WHERE 'ACE Inhibitor' = ANY(related_drug_classes)`.
- Use a controlled vocabulary aligned with Drug.drugClass.

**Option B (normalized):** Add `QuestionDrugLink` junction.

- `questionId`, `drugId`, `relationshipType` (e.g., "tests", "mentions").
- Query: `JOIN QuestionDrugLink qdl ON q.id = qdl.questionId JOIN Drug d ON qdl.drugId = d.id WHERE 'ACE Inhibitor' = ANY(d.drugClass)`.
- More flexible but heavier.

### 2. Normalize relatedDrugs

- Prefer drug IDs over names where possible.
- Or ensure relatedDrugs values match Drug.genericName exactly for reliable joins.

### 3. Backfill and maintain

- Script to infer `relatedDrugClasses` from:
  - `relatedDrugs` + Drug table,
  - or conditionId → DrugConditionLink → Drug.
- Keep links updated when adding or editing questions.

### 4. Align pharmacology-drill with schema

- Remove or fix use of `question.drugClass` if Question has no such field.
- Use `relatedDrugs`, `relatedDrugClasses` (once added), or tags as the filtering basis.

---

## 8. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Question → Disease (Condition) | ✅ | conditionId, medicalContentId |
| Question → Drug (hard link) | ❌ | No FK or junction |
| Question.drugClass / relatedDrugClasses | ❌ | No drug-class field |
| relatedDrugs (usable for filtering) | ⚠️ | Free-text array; no normalization |
| PreGeneratedQuestion entity links | ❌ | No drug/condition links beyond conditionId |
| "Quiz on ACE Inhibitors" query | ❌ | Not possible today |
| "Quiz on Pharyngitis" query | ✅ | Via conditionId |
| Polypharmacy uses structured data | ✅ | Drug table; not Questions |
| Bug-Drug uses structured data | ✅ | AntibioticGuideline; not Questions |

---

## 9. References

- Question schema: `prisma/schema.prisma` (relatedDrugs, relatedDiseases, conditionId, medicalContentId)
- Drug schema: `prisma/schema.prisma` (drugClass, DrugConditionLink)
- AntibioticConditionLink: `prisma/schema.prisma`
- Polypharmacy: `functions/api/questions/polypharmacy-drill.ts`
- Bug-Drug: `functions/api/drills/antibiotics.ts`, `components/modes/AntibioticMode.tsx`
- Pharmacology drill: `functions/api/questions/pharmacology-drill.ts`
