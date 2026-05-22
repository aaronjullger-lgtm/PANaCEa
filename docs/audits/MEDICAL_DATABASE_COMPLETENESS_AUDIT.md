# Medical Database Completeness Audit

Date: 2026-05-02 00:08 EDT
Second-pass update: 2026-05-02

## Executive Summary

Current readiness grade: **60/100 (D), P1**.

PANaCEa has a strong medical schema foundation, but the database is not yet a complete production medical knowledge layer. The main blockers are split clinical identity, empty source-controlled condition content, duplicate taxonomy sources, weak clinical provenance, learner-facing medication generation that can bypass review gates, and incomplete proof that relationships between conditions, medications, procedures, diagnostics, questions, study plans, and progress are populated.

## Medical Knowledge Architecture Map

| Layer | Current Files/Models | Status |
|---|---|---|
| Canonical condition identity | `Condition` in `prisma/schema.prisma:543` | Strong schema, DB-dependent data |
| Detailed condition content | `MedicalContent` in `prisma/schema.prisma:1705` | Rich but split from `Condition` |
| Medications | `Drug`, `DrugConditionLink`, `src/registries/drugRegistry.ts` | Good partial seed |
| Procedures | `Procedure`, `ProcedureConditionLink`, treatment/surgery registries | Fragmented |
| Diagnostics | `LabTest`, `ImagingStudy`, link tables, generated cases | Good schema, weak canonical case model |
| Presentations/DDx | `DifferentialDiagnosis`, static clinical cases | Partial; missing first-class presentation |
| Blueprint/taxonomy | `lib/constants/blueprint.ts`, `config/topic-map.ts`, `MedicalTaxonomy` | Duplicate sources |
| Questions | `Question`, `PreGeneratedQuestion`, generators, validators | Mixed grounded and ungrounded paths |
| Explanations | `QuestionExplanation`, `QuestionExplanationCitation`, `explain-rag` | Good model, weak id contract |
| Progress/study | `UserProgress`, `UserTopicProgress`, `StudyPlan`, `StudyTopic` | Good foundation, identity ambiguity |

Second-pass architecture additions:

- `StudySessionQuestion`, `StudyPlan`, `StudyPlanItem`, `QuestionStudyTopic`, `QuestionAnswerChoice`, and `QuestionExplanationCitation` now provide a stronger normalized study layer, but active session generation still uses `StudySession.questionIds` compatibility arrays and daily plans still rely heavily on `DailyStudyPlan.recommendedSessions` JSON.
- Live DB probe from the medication audit found 1,000 `Drug` rows and 13,213 `DrugConditionLink` rows, but 1,003 unique drug-class strings and 0 canonical `Question.relatedDrugs` rows, confirming strong drug-condition content with poor medication-to-question analytics.
- Live DB probe found 1,316 `MedicalContent` rows with 0 `lastClinicalReviewAt` and 0 guideline/evidence metadata rows, making clinical provenance a P1 even where content volume exists.

## Category Grades

| Category | Grade | Severity | Evidence | Main Blockers | Recommended Fix |
|---|---:|---|---|---|---|
| Medical database schema | 60 | P1 | `prisma/schema.prisma:543`, `:1705`, `:3902` | Split identity, legacy active paths | Canonical FK migration |
| Condition/disease coverage | 56 | P1 | `config/conditionRegistry.ts:17`, empty generated JSON, DB provenance probe | No verified source seed or review metadata | Seed manifest and provenance gate |
| Medication coverage | 62 | P1 | `prisma/schema.prisma:984`, `functions/api/drills/pharm.ts:69` | Unnormalized classes, unreviewed drill path | Normalize classes, review-gate drills |
| Procedure coverage | 68 | P2 | `prisma/schema.prisma:2492` | Fragmented sources | Unified procedure seed |
| Diagnostics/lab/imaging | 76 | P2 | `prisma/schema.prisma:1530`, `:1434` | Under-modeled lab cases | Extend models and links |
| Clinical presentation/DDx | 70 | P1 | `prisma/schema.prisma:919` | No presentation entity | Add `ClinicalPresentation` |
| Treatment/management | 66 | P1 | condition content strings | Safety fields not normalized | Normalize sections |
| Emergency/red flags | 60 | P1 | optional fields/generators | Incomplete proof | Required safety validation |
| Preventive care | 55 | P2 | no clear seed | Sparse | Preventive seed wave |
| PANCE blueprint mapping | 58 | P1 | `lib/constants/blueprint.ts`, `config/topic-map.ts`, `functions/api/analytics/blueprint-gaps.ts:92` | duplicate weights, missed attempt normalization | Canonical lookup and attempt normalization |
| EOR/rotation mapping | 66 | P2 | `config/rotation-systems.ts` | rotation-only system mapping | Course/topic mapping |
| Relationship modeling | 78 | P2 | link tables | not fully seeded | Backfill links |
| Question generation | 68 | P1 | `generate-batch.ts`, loader bug fixed | ungrounded paths | require content ids |
| Explanations | 74 | P2 | `explain-rag.ts` | no ids | add id contract |
| Study planning/progress | 70 | P1 | `UserProgress.conditionId` | misleading FK | explicit ids |
| Seed completeness | 55 | P1 | empty condition registry | no production seed | versioned seed package |
| Content validation/QA | 48 | P1 | `services/medicalComplianceService.ts:342`, DB provenance probe | simulated compliance and no review metadata | deterministic QA workflow |
| Deprecated/conflicting content | 52 | P1 | `services/externalMedicalDatabaseService.ts:197`, `scripts/regenerate-pool-v2.ts:1` | live placeholder/mock surfaces | block, archive, or label unavailable |
| Testing/verification | 64 | P2 | targeted tests exist | missing integrity tests | CI checks |

## Required Coverage Tables

### Condition Coverage Table

| Condition | System | Blueprint/EOR Mapping | Content Depth | Meds Linked | Procedures Linked | Diagnostics Linked | Questions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|---|
| ACS/STEMI/NSTEMI | CV/EM | System-level | DB-dependent | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Verified row depth, source, links |
| Pulmonary embolism | PULM/CV | System-level | DB-dependent | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Algorithm and DDx links |
| Asthma/COPD | PULM | System-level | DB-dependent | Schema-supported | Limited | Schema-supported | Schema-supported | Partial | Severity, action plan |
| Depression/suicidality | PSYCH | System-level | DB-dependent | Schema-supported | N/A | Screening not normalized | Schema-supported | Partial | Safety red flags |

### Medication Coverage Table

| Medication/Class | Indications | Conditions Linked | MOA Present | Contraindications Present | Adverse Effects Present | Monitoring Present | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|
| Antibiotics | Partial | Schema-supported | Optional | Optional | Optional | Optional | Partial | Stewardship, resistance |
| CV drugs | Partial | Schema-supported | Optional | Optional | Optional | Optional | Partial | First-line links |
| Diabetes drugs | Partial | Schema-supported | Optional | Optional | Optional | Optional | Partial | Renal/pregnancy rules |
| Anticoagulants | Incomplete | Schema-supported | Optional | Optional | Optional | Optional | No | Reversal, monitoring |

### Procedure Coverage Table

| Procedure | System | Indications | Contraindications | Steps Present | Complications Present | Conditions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|
| Arthrocentesis | MSK | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Verified seed |
| Lumbar puncture | Neuro/ID | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | ICP safety |
| Incision and drainage | Derm/EM | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Antibiotic criteria |

### Diagnostics Coverage Table

| Diagnostic/Lab/Imaging | Type | Indications | Interpretation Present | Conditions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|
| CBC/CMP | Lab | Registry-supported | Schema-supported | Link table exists | Partial | Complete ranges |
| Troponin/BNP/D-dimer | Lab | Registry-supported | Schema-supported | Link table exists | Partial | Algorithms |
| CXR/CT/MRI/US | Imaging | Registry-supported | Schema-supported | Link table exists | Partial | Condition filters |

### Clinical Presentation/DDx Table

| Presentation | Emergent Diagnoses | Common Diagnoses | Initial Workup | Red Flags | Conditions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|
| Chest pain | ACS, PE, dissection | GERD, MSK | ECG, troponin, CXR | shock, tearing pain | Link schema exists | Partial | Presentation model |
| Dyspnea | PE, pneumothorax, CHF | asthma, COPD | vitals, CXR, ECG | hypoxia, shock | Link schema exists | Partial | Discriminators |
| Abdominal pain | ectopic, AAA, perforation | gastroenteritis | labs, pregnancy, imaging | peritonitis | Link schema exists | Partial | Age/pregnancy variants |

### Taxonomy Mapping Table

| Taxonomy Area | Current Source | Issues | Canonical Source | Migration Needed | Risk |
|---|---|---|---|---|---|
| Systems | `lib/constants/blueprint.ts`, `config/topic-map.ts` | Duplicate weights | Canonical constants/DB | Yes | High |
| Tasks | Multiple services | Multiple labels | New lookup | Yes | High |
| Rotations | `config/rotation-systems.ts` | System-only | Course/topic DB | Yes | Medium |

### Relationship Model Table

| Relationship | Current Support | Needed For | Missing Pieces | Recommended Model |
|---|---|---|---|---|
| Condition -> meds | `DrugConditionLink` | Treatment/pharm | Seed completeness | Keep/backfill |
| Condition -> procedures | `ProcedureConditionLink` | Procedures | Seed completeness | Keep/backfill |
| Question -> entities | IDs plus strings | Analytics | Generic tags | `MedicalEntityTag` |

### Seed Data Plan Table

| Seed Area | Minimum Viable Scope | Priority | Source File | Validation Rules |
|---|---|---|---|---|
| Conditions | 120 high-yield | P1 | New manifest | Required sections/source |
| Medications | 150 high-yield | P2 | Expanded registry | Safety required |
| Presentations | 25 | P1 | New manifest | DDx/red flags |

### Deprecated Medical Content Table

| File/Area | Issue | Evidence | Action | Risk |
|---|---|---|---|---|
| `config/conditionRegistry.ts` | Empty source | line 17 | Compatibility only | False seed confidence |
| `src/conditionContent.generated.json` | Empty fallback | 0 keys | Archive/regenerate | False coverage |
| `config/topic-map.ts` | Legacy deck | `PANCE_DECK` | Replace | Wrong distribution |

### Test Coverage Table

| Area | Existing Tests | Missing Tests | Priority | Recommended Test Type |
|---|---|---|---|---|
| Loader | `condition-loader.test.ts` | DB integration | P2 | Unit/integration |
| Taxonomy | Some blueprint tests | Duplicate rejection | P1 | Unit |
| Seeds | Some scripts | Dry-run manifest | P1 | Script |

## P0 Launch Blockers

No P0 was proven from source alone. The closest risks are P1 launch blockers for clinical production.

## P1 Serious Risks

- Split `Condition` and `MedicalContent` identity.
- Empty source-controlled condition seed.
- Pending/unreviewed question serving in some paths.
- Duplicate system/task taxonomies.
- Misleading `UserProgress.conditionId`.
- Simulated compliance checks.
- `/api/drills/pharm` can generate learner-facing medication items from raw drug rows without the approved-question gate used by `/api/questions/pharmacology-drill`.
- Blueprint gap analytics can under-report current attempts because `functions/api/analytics/blueprint-gaps.ts` filters on `systemNormalized` while major attempt writers populate `system`.

## Second-Pass Findings

| Finding | Status | Evidence | Action |
|---|---|---|---|
| Medical topics hardcoded in legacy maps | Confirmed | `config/topic-map.ts` | Replace with canonical taxonomy |
| Medication/procedure links not guaranteed | Confirmed | link tables exist, seeds not proven | Backfill and report |
| Questions not always linked to medical entities | Confirmed | `generate-batch.ts` | Require content ids |
| Progress tracked at broad system in analytics | Confirmed | allocator and analytics services | Add entity-level reports |
| Mock/static data masquerades as product data | Confirmed | empty generated JSON, generated cases | Archive or promote through seed pipeline |
| Stale prompt/topic lists | Confirmed | multiple generation services | Centralize taxonomy |
| New normalized study tables exist but active paths still use legacy arrays/JSON | Confirmed | `StudySession.questionIds`, `DailyStudyPlan.recommendedSessions` | Dual-write and migrate readers |
| Drug classes are fragmented in live data | Confirmed | 1,000 drugs / 1,003 class strings | Add `DrugClass` and migration |
| Question-drug linkage is absent in canonical questions | Confirmed | live probe found 0 `relatedDrugs` rows | Add `QuestionDrugLink` |
| Clinical review/source metadata is missing in live content | Confirmed | 1,316 content rows, 0 review/source metadata | Require provenance before published/approved use |
| Live mock/placeholder medical surfaces remain routed | Confirmed | medical database guideline mock, smart-scribe placeholder, calculator placeholders | Disable or mark unavailable |

## Recommended Implementation Order

1. Canonical taxonomy and identity contract.
2. Approved-only question serving enforcement.
3. Minimum viable condition seed package.
4. Relationship backfill.
5. Question/explanation grounding by canonical ids.
6. Study plan/progress entity targeting.
7. Deprecated content cleanup.
8. Full verification suite.
