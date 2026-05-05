# Medical Database Final Report

Date: 2026-05-02 00:08 EDT

## Final Grade

Overall readiness: **60/100 (D), P1**

PANaCEa has the right ambition and many of the right tables, but the current medical database is not yet a production-grade medical knowledge layer. It is closer to a broad schema plus partial content pipelines than a verified, canonical, clinically complete graph. The second pass confirmed that live content volume exists, but provenance, question-entity linkage, and learner-facing safety gates are not strong enough for production medical learning.

## Required Tables

### Medical Database Category Readiness Table

| Category | Grade | Severity | Evidence | Main Blockers | Recommended Fix |
|---|---:|---|---|---|---|
| Medical database schema | 60 | P1 | `prisma/schema.prisma:543`, `:1705`, `:3902` | Split Condition/MedicalContent identity, legacy active paths | Add canonical FK and migration |
| Condition coverage | 56 | P1 | `config/conditionRegistry.ts:17`, live provenance probe | Empty source seed and no review metadata | Versioned seed package plus provenance gate |
| Medication coverage | 62 | P1 | `prisma/schema.prisma:984`, `functions/api/drills/pharm.ts:69` | String classes, no question-drug joins, raw drill generation | Normalize classes, add links, review-gate drills |
| Procedure coverage | 68 | P2 | `prisma/schema.prisma:2492` | Fragmented sources | Unified procedure seed |
| Diagnostics/labs/imaging | 76 | P2 | `prisma/schema.prisma:1530`, `:1434` | Weak condition-filtered links | Backfill links and endpoints |
| Clinical presentation/DDx | 70 | P1 | `prisma/schema.prisma:919` | No first-class presentation entity | Add `ClinicalPresentation` |
| Blueprint/taxonomy | 58 | P1 | `lib/constants/blueprint.ts:17`, `config/topic-map.ts:63`, `functions/api/analytics/blueprint-gaps.ts:92` | Duplicate weights/labels, missing normalized attempts | Canonical taxonomy lookup and write-path normalization |
| Relationships | 78 | P2 | `DrugConditionLink`, `ProcedureConditionLink`, `QuestionStudyTopic` | String arrays and parallel graph | Backfill entity tags |
| Question integration | 68 | P1 | `functions/api/questions/generate-batch.ts:314` | Some ungrounded generation | Require content ids |
| Explanation integration | 74 | P2 | `functions/api/questions/explain-rag.ts:100` | No content id contract | Add canonical ids |
| Study/progress | 70 | P1 | `prisma/schema.prisma:3905` | Misleading progress identity | Explicit `medicalContentId` |
| QA and versioning | 48 | P1 | `services/medicalComplianceService.ts:342`, live provenance probe | Simulated compliance, weak gates, no review metadata | Deterministic review workflow |

### Condition Coverage Table

| Condition | System | Blueprint/EOR Mapping | Content Depth | Meds Linked | Procedures Linked | Diagnostics Linked | Questions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|---|
| ACS/STEMI/NSTEMI | CV/EM | System-level | DB-dependent | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Verified source and links |
| Pulmonary embolism | PULM/CV | System-level | DB-dependent | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | DDx and diagnostic algorithm links |
| Asthma/COPD | PULM | System-level | DB-dependent | Schema-supported | Limited | Schema-supported | Schema-supported | Partial | Action plans, severity staging |
| Diabetes/DKA/HHS | ENDO/EM | System-level | DB-dependent | Schema-supported | N/A | Schema-supported | Schema-supported | Partial | Emergency management |
| Depression/suicidality | PSYCH | System-level | DB-dependent | Schema-supported | N/A | Screening not normalized | Schema-supported | Partial | Screening tools and red flags |

### Medication Coverage Table

| Medication/Class | Indications | Conditions Linked | MOA Present | Contraindications Present | Adverse Effects Present | Monitoring Present | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|
| Antibiotics | Partial registry | Schema-supported | Optional | Optional | Optional | Optional | Partial | Stewardship, allergies, resistance |
| CV drugs | Partial registry | Schema-supported | Optional | Optional | Optional | Optional | Partial | First-line conditions, monitoring |
| Diabetes drugs | Partial registry | Schema-supported | Optional | Optional | Optional | Optional | Partial | Renal/pregnancy/sick-day rules |
| Psych meds | Sparse | Schema-supported | Optional | Optional | Optional | Optional | No | Black-box warnings and interactions |
| Anticoagulants | Incomplete | Schema-supported | Optional | Optional | Optional | Optional | No | Reversal, procedures, pregnancy |
| Drug classes | Fragmented live strings | Linked only by string array | N/A | N/A | N/A | N/A | No | `DrugClass` model and aliases |
| Question-drug links | Absent in canonical questions | No | N/A | N/A | N/A | N/A | No | `QuestionDrugLink` and backfill |

### Procedure Coverage Table

| Procedure | System | Indications | Contraindications | Steps Present | Complications Present | Conditions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|
| Arthrocentesis | MSK | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Seeded PA skill details |
| Lumbar puncture | Neuro/ID | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | ICP safety and aftercare |
| Incision and drainage | Derm/EM | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | Antibiotic criteria |
| Airway procedures | EM/Pulm | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Schema-supported | Partial | RSI meds and failure plan |
| Surgery registry items | Surgery | Separate source | Unknown | Separate source | Unknown | Unknown | No | Unified Procedure migration |
| Sim-lab procedure | EM/Procedure | Hardcoded sample | Hardcoded sample | Hardcoded sample | Hardcoded sample | No | No | DB-backed reviewed procedure selection |

### Diagnostics Coverage Table

| Diagnostic/Lab/Imaging | Type | Indications | Interpretation Present | Conditions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|
| CBC/CMP markers | Lab | Registry-supported | Schema-supported | Link table exists | Partial | Verified ranges/critical values |
| Troponin/BNP/D-dimer | Lab | Registry-supported | Schema-supported | Link table exists | Partial | Decision thresholds, false positives |
| CXR/CT/MRI/US | Imaging | Registry-supported | Schema-supported | Link table exists | Partial | Condition-filtered endpoint |
| CTPA/VQ scan | Imaging | Registry-supported | Schema-supported | Link table exists | Partial | PE algorithm links |
| Clinical decision rules | Rule | Scoring systems exist | Partial | Some links exist | No | Wells, PERC, Centor, Ottawa, CURB-65 |

### Clinical Presentation/DDx Table

| Presentation | Emergent Diagnoses | Common Diagnoses | Initial Workup | Red Flags | Conditions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|
| Chest pain | ACS, dissection, PE, tamponade | GERD, MSK, pneumonia | ECG, troponin, CXR | instability, tearing pain | Link schema exists | Partial | Seeded presentation entity |
| Dyspnea | PE, pneumothorax, CHF, anaphylaxis | asthma, COPD, pneumonia | vitals, CXR, ECG, labs | hypoxia, shock | Link schema exists | Partial | DDx discriminators |
| Abdominal pain | ectopic, AAA, appendicitis, perforation | gastroenteritis, biliary disease | pregnancy test, labs, imaging | peritonitis, hypotension | Link schema exists | Partial | Age/pregnancy variants |
| Headache | SAH, meningitis, mass | migraine, tension | neuro exam, CT/LP when indicated | thunderclap, fever, neuro deficit | Link schema exists | Partial | Decision rules |

### Taxonomy Mapping Table

| Taxonomy Area | Current Source | Issues | Canonical Source | Migration Needed | Risk |
|---|---|---|---|---|---|
| Systems | `lib/constants/blueprint.ts`, `config/topic-map.ts` | Duplicate weights/labels | `lib/constants/blueprint.ts` then DB lookup | Yes | High |
| Tasks | constants, question weighting, distribution service | Multiple vocabularies | New `TaskCategory` lookup | Yes | High |
| Rotations | `config/rotation-systems.ts` | System-only mapping | `Course`/`StudyTopic` | Yes | Medium |
| Conditions | DB plus empty registry | No source-controlled seed | Versioned seed manifest | Yes | High |
| Question tags | JSON/string fields | Not entity-safe | `MedicalEntityTag` | Yes | Medium |

### Relationship Model Table

| Relationship | Current Support | Needed For | Missing Pieces | Recommended Model |
|---|---|---|---|---|
| Condition -> meds | `DrugConditionLink` | Pharm questions, treatment plans | Complete seeds | Keep and backfill |
| Condition -> procedures | `ProcedureConditionLink` | Procedures/drills | Complete seeds | Keep and backfill |
| Condition -> diagnostics | `LabConditionLink`, `ImagingConditionLink` | Workup reasoning | Direct filters and seeds | Keep and backfill |
| Condition -> presentations | DDx links only | Presentation learning | Presentation entity | Add presentation links |
| Question -> entities | Condition/MedicalContent + strings | Analytics/generation | Generic tags | Add entity tags |
| Progress -> entities | `UserProgress`, `UserTopicProgress` | Weakness tracking | Clear identity | Explicit FK names |

### Deprecated Medical Content Table

| File/Area | Issue | Evidence | Action | Risk |
|---|---|---|---|---|
| `config/conditionRegistry.ts` | Empty placeholder/stub | line 17 | Keep compatibility, stop calling it source of truth | Fresh seed confusion |
| `src/conditionContent.generated.json` | Empty generated fallback | 0 keys | Archive or regenerate from DB snapshot | False coverage signal |
| `scripts/deprecated/*` | Old generators | directory exists | Keep quarantined; document not production | Accidental use |
| `functions/api/srs/*.deprecated` | Deprecated endpoints | file suffix | Remove after route audit | Confusing API surface |
| `config/topic-map.ts` | Legacy blueprint deck | `PANCE_DECK` | Replace from canonical constants | Wrong distribution |
| `services/medicalComplianceService.ts` | Simulated random compliance | lines 347, 379, 553 | Do not use for safety gate | False safety assurance |
| `services/externalMedicalDatabaseService.ts` | Routed guideline search returns mock records | line 197 | Disable guideline search or return unavailable until sourced | Mock guidelines can appear authoritative |
| `functions/api/smart-scribe/generate-infographic.ts` | Placeholder infographic can return success-shaped response | line 55 | Return explicit degraded/non-ready response | Placeholder medical artifact risk |
| `functions/api/drills/pharm.ts` | Raw drug-row generated questions can bypass review gate | lines 69, 149 | Route through approved question pool or staging | Unreviewed medication safety questions |
| `scripts/regenerate-pool-v2.ts` | Active v2 script can clear/regenerate pool | package script `regenerate:pool-v2` | Require dry-run/explicit apply and archive old prompt | Destructive unreviewed question churn |
| `functions/api/conditions/[identifier]/extended.ts` | Header notes deprecated `Condition` identity | file header | Migrate to condition/content identity adapter | Detail modal reads wrong identity domain |

### Seed Data Plan Table

| Seed Area | Minimum Viable Scope | Priority | Source File | Validation Rules |
|---|---|---|---|---|
| Conditions | 120 high-yield conditions | P1 | New versioned manifest | Required sections and source |
| Medications | 150 drugs/classes | P2 | Expanded drug registry | Safety and monitoring fields |
| Procedures | 60 PA-relevant procedures | P2 | Unified procedure manifest | Indications/contraindications/steps |
| Diagnostics | 81 labs, 69 imaging plus links | P2 | Existing registries plus links | Interpretation and first-line status |
| Presentations | 25 high-yield presentations | P1 | New presentation manifest | DDx, red flags, workup |
| Drug classes | Canonical class aliases | P1 | New seed manifest | Unique class ids, alias validation |
| Question entity links | Medication/procedure/diagnostic links | P1 | Backfill script | Every linked entity exists |
| Provenance | Review/source fields for publishable rows | P1 | Seed metadata and review workflow | No published row without reviewer/source/year |

### Test Coverage Table

| Area | Existing Tests | Missing Tests | Priority | Recommended Test Type |
|---|---|---|---|---|
| Condition loader | Added `functions/api/_shared/condition-loader.test.ts` | DB integration test | P2 | Unit/integration |
| Taxonomy | Blueprint tests exist | Duplicate label rejection | P1 | Unit |
| Seeds | Some scripts/tests | Dry-run manifest validation | P1 | Script tests |
| Relationships | Some link tests | Full graph link completeness | P1 | DB integrity |
| Question serving | `tests/questionServingSafety.test.ts` | All learner paths approved-only | P1 | API tests |
| Study plan | Existing study plan tests | Entity-level targeting | P2 | Service tests |
| Blueprint analytics | Blueprint gap tests exist | Attempt write-path `systemNormalized` coverage | P1 | API/write-path tests |
| Pharm drill safety | Approved pharm question path has safety helper | Raw `/api/drills/pharm` safety test | P1 | API tests |
| Provenance QA | Completeness scripts exist | Review/source metadata audit | P1 | Read-only DB audit |
| Normalized session/study | Schema exists | Dual-write/read parity tests | P2 | Service/API tests |

## Red-Team Critique

The database is medically promising but not yet medically useful enough for production by itself. It can represent many concepts, but it cannot yet prove that those concepts are complete, reviewed, linked, and used consistently. Generated questions will become generic where generation is by system/category only. Students could be misled where treatment, contraindication, pregnancy, emergency disposition, or red flags are missing or unreviewed.

## Revised P0/P1 List

| Severity | Risk | Fix |
|---|---|---|
| P1 | Split canonical condition identity | Add condition/content identity migration |
| P1 | Empty source-controlled condition seed | Add versioned minimum viable seed |
| P1 | Pending questions can be served in some routes | Approved-only filter everywhere |
| P1 | Taxonomy duplicates produce wrong coverage analytics | Canonical taxonomy lookup |
| P1 | Compliance service is simulated | Replace with evidence-bearing QA gate |
| P1 | Progress identity is misleading | Rename/backfill explicit FK fields |
| P1 | Learner-facing pharm drill can bypass question approval | Gate or disable `/api/drills/pharm` |
| P1 | Blueprint analytics can under-report due missing `systemNormalized` | Populate on attempt write and add fallback |
| P1 | Clinical review/source metadata absent in live content | Require provenance before published learner use |
| P1 | Live mock/placeholder medical surfaces are routed | Return unavailable or hide until sourced |
