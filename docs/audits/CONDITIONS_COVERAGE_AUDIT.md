# Conditions Coverage Audit

Date: 2026-05-02 00:08 EDT

## Grade

Conditions coverage grade: **56/100 (F), P1**

The schema and APIs can support condition-based learning, but checked-in source-controlled condition content is not production-complete. `config/conditionRegistry.ts` contains an empty registry, and `src/conditionContent.generated.json` is an empty object. Production readiness depends on an external populated database or repeatable import pipeline.

Second-pass update: DB-backed content volume appears non-trivial, but source and review metadata are not populated. A read-only medication/QA probe found 1,316 `MedicalContent` rows with 0 `lastClinicalReviewAt` and 0 guideline/evidence metadata rows. That moves condition coverage from "unknown DB-dependent" to "content exists but not production-reviewed."

## Source Map

| Source | Count / Shape | Role | Evidence | Risk |
|---|---:|---|---|---|
| `Condition` table | DB only | Canonical clinical anchor | `prisma/schema.prisma:543` | Good model, unknown live row completeness |
| `MedicalContent` table | DB only | Detailed condition content | `prisma/schema.prisma:1705` | Split identity from `Condition` |
| Static registry | 0 entries | Legacy/source seed | `config/conditionRegistry.ts:17` | Fresh source seed creates no conditions |
| Generated JSON | 0 keys | Legacy static fallback | `src/conditionContent.generated.json:1` | No offline baseline |
| Extra condition candidates | 1,102 rows | Taxonomy-only expansion candidate set | `data/extra-conditions.json` | Not clinically complete content |
| Static clinical cases | 250 cases / 66 unique diagnoses | Presentation prototype | `src/data/clinicalCases.json` | No condition/content FK, source, validation, or provenance |
| Category mappings | 1223 mappings | Taxonomy mapping data | `data/condition-category-mappings.json` | Not clearly canonical runtime source |
| API condition search | DB-first | Runtime lookup | `functions/api/conditions/search.ts:200` | Depends on DB content quality |

## Condition Coverage Table

| Condition | System | Blueprint/EOR Mapping | Content Depth | Meds Linked | Procedures Linked | Diagnostics Linked | Questions Linked | Production Ready | Missing Info |
|---|---|---|---|---|---|---|---|---|---|
| Acute coronary syndrome | CV | Partial by system/category | Unknown DB-dependent | Supported by schema | Supported by schema | Supported by schema | Supported by schema | No | Verified row depth, source, medication/procedure links |
| Pulmonary embolism | PULM/CV | Partial by system/category | Used in tests/prompts | Supported by schema | Supported by schema | Supported by schema | Supported by schema | Partial | Canonical condition/content identity, DDx links |
| Asthma | PULM | Partial | Registry/API-dependent | Supported by schema | Supported by schema | Supported by schema | Supported by schema | Partial | Verified first-line meds, red flags, action plan |
| Diabetes mellitus | ENDO | Partial | Registry/API-dependent | Supported by schema | Limited | Labs supported | Supported by schema | Partial | Medication classes, monitoring, complications |
| Depression | PSYCH | Partial | Registry/API-dependent | Supported by schema | N/A | Screening not modeled as diagnostic entity | Supported by schema | Partial | Screening tools, suicidality red flags |
| Appendicitis | GI/Surgery | Partial | Registry/API-dependent | Supported by schema | Supported by schema | Imaging/labs supported | Supported by schema | Partial | Surgical disposition, pediatric/pregnancy variants |
| Ectopic pregnancy | REPRO/EM | Partial | Registry/API-dependent | Supported by schema | Supported by schema | Labs/imaging supported | Supported by schema | Partial | Emergency workflow and contraindications |
| Sepsis | ID/EM | Partial | Registry/API-dependent | Supported by schema | Supported by schema | Labs supported | Supported by schema | Partial | Time-critical management, source control |

## Findings

| Finding | Severity | Evidence | Problem | Recommended Fix | Verification |
|---|---|---|---|---|---|
| Source-controlled condition baseline is empty | P1 | `config/conditionRegistry.ts:17`, `src/conditionContent.generated.json:1` | New environments cannot prove coverage without DB snapshot | Create versioned seed manifest and minimum viable condition seed | Run seed dry-run and count non-placeholder published rows |
| Condition and MedicalContent identities are split | P1 | `prisma/schema.prisma:543`, `prisma/schema.prisma:1705` | Links can attach to either entity | Add canonical FK and identity contract | Unit tests for condition/content resolution |
| Content depth cannot be graded from repo alone | P1 | DB-first APIs in `functions/api/conditions/index.ts` | Production state is opaque | Add completeness dashboard output/fixture to repo | CI completeness report |
| Live clinical review metadata is absent | P1 | DB probe: 1,316 `MedicalContent` rows, 0 reviewed/source rows | Content may look complete but lacks source currency | Require source/review fields before published learner use | Read-only provenance audit |
| Static clinical/lab cases are not linked to canonical entities | P2 | `src/data/clinicalCases.json`, `src/data/labCases.json` | Presentation learning cannot update condition-level progress | Migrate reviewed cases into DB with condition/content IDs | FK/link completeness report |
| Clinical safety fields are not consistently normalized | P1 | `MedicalContent` text fields plus JSON fields | Red flags/emergency management may be buried | Add normalized safety sections | Validation test for required safety fields |

## Production Readiness

Condition-based study is not production-ready until a verified DB snapshot or deterministic seed pipeline proves:

- published condition count by system;
- non-placeholder overview, presentation, diagnostics, treatment, red flags, and follow-up;
- links to drugs, procedures, labs/imaging, DDx, questions, and study topics;
- reviewer/source metadata for published content.
