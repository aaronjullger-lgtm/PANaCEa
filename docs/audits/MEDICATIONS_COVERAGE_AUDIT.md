# Medications Coverage Audit

Date: 2026-05-02 00:08 EDT

## Grade

Medication coverage grade: **62/100 (D), P1**

The `Drug` schema is strong and live drug-condition linking is substantial, but production medication learning is not safe enough yet. Drug classes are string arrays, question-drug linkage is effectively absent, and one learner-facing pharm drill path can generate questions directly from raw drug fields without the approved-question gate.

Second-pass live probe:

- 1,000 `Drug` rows.
- 1,003 unique drug-class strings, confirming class fragmentation.
- 13,213 `DrugConditionLink` rows.
- 0 canonical `Question.relatedDrugs` rows and 0 approximate pharmacology questions in `Question`.

## Medication Coverage Table

| Medication/Class | Indications | Conditions Linked | MOA Present | Contraindications Present | Adverse Effects Present | Monitoring Present | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|
| Beta-lactam antibiotics | Registry class only | Schema supports links | Optional | Optional | Optional | Optional | Partial | Full indications, resistance, allergies |
| Fluoroquinolones | Registry includes black-box flag | Schema supports links | Optional | Optional | Optional | Optional | Partial | Tendon/QT/CNS warnings, stewardship |
| Macrolides | Registry class only | Schema supports links | Optional | Optional | Optional | Optional | Partial | QT/CYP interactions, CAP/STI indications |
| ACE inhibitors/ARBs | Registry present | Schema supports links | Optional | Optional | Optional | Optional | Partial | Pregnancy, renal/K monitoring |
| Beta blockers | Registry present | Schema supports links | Optional | Optional | Optional | Optional | Partial | Asthma/HF nuance, tapering |
| Insulin/metformin | Registry present | Schema supports links | Optional | Optional | Optional | Optional | Partial | Hypoglycemia, renal dosing, sick-day rules |
| SSRIs/SNRIs | Limited psych coverage | Schema supports links | Optional | Optional | Optional | Optional | No | Black-box suicidality, serotonin syndrome |
| Anticoagulants | Partial/unknown | Schema supports links | Optional | Optional | Optional | Optional | No | Reversal, monitoring, pregnancy, procedures |

## Evidence

| Area | Evidence | Notes |
|---|---|---|
| Drug schema | `prisma/schema.prisma:984` | Broad fields for MOA, indications, contraindications, dosing, monitoring, pregnancy, renal/hepatic dosing, warnings |
| Drug-condition links | `prisma/schema.prisma:1079` | Supports first-line and relationship type |
| Side effects | `prisma/schema.prisma:1063` | Structured side effects exist |
| Interactions | `prisma/schema.prisma:1100` | Pairwise interactions exist |
| Registry count | `src/registries/drugRegistry.ts:34` | 77 to 78 checked-in registry entries |
| API | `functions/api/drugs/library.ts:25` | Rich authenticated browse/search |
| Approved pharm drill path | `functions/api/questions/pharmacology-drill.ts:35` | Uses `withProductionQuestionSafety` |
| Unsafe pharm drill path | `functions/api/drills/pharm.ts:69`, `:149` | Dynamically generates learner-facing items from raw drug rows |

## Problems And Risks

| Problem | Severity | Production Risk | Recommended Fix | Verification |
|---|---|---|---|---|
| Drug classes are string arrays | P2 | Duplicate class labels, weak class-level analytics | Add `DrugClass` model and join table | Class uniqueness test |
| Registry is not comprehensive | P2 | Medication drills miss common PA exam drugs | Add high-yield class seed waves | Count coverage against blueprint medication list |
| Links to conditions are DB-dependent | P1 | Medication questions cannot target specific diseases reliably | Seed `DrugConditionLink` for first-line, contraindicated, emergency use | Link completeness report |
| Safety metadata may be optional | P1 | Unsafe therapy recommendations | Require contraindications/warnings for high-risk drugs | Clinical QA validation |
| Question-drug linkage is missing | P1 | Live probe found 0 canonical `relatedDrugs` rows | Add `QuestionDrugLink` and backfill from generated/staged question metadata | Question-drug link report |
| Learner-facing raw pharm generation bypasses QA | P1 | `functions/api/drills/pharm.ts` | Unreviewed contraindication/adverse-effect questions can be served | Route through staging/approved gate or disable learner path | Endpoint test: unreviewed drug rows cannot serve |
| Simulated medical compliance is not trustworthy | P1 | `services/medicalComplianceService.ts:342` | Random "verified" claims can create false assurance | Replace with deterministic source/review/audit checks | QA service tests |
