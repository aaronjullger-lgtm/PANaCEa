# Medical Knowledge Schema Audit

Date: 2026-05-02 00:08 EDT

## Grade

Overall schema grade: **60/100 (D), P1**

The database has a broad clinical graph foundation, but it is not yet a clean canonical medical knowledge layer. `Condition` is the best canonical diagnosis anchor, while `MedicalContent` duplicates condition identity and stores most condition detail in string/JSON fields.

Second-pass schema conclusion: the May 2026 normalized study layer improves the target architecture, but production paths have not fully adopted it. `StudySessionQuestion` and `StudyPlanItem` exist, while active session and daily-plan services still use compatibility arrays/JSON. This is a migration-in-progress, not a completed normalized study graph.

## Current Schema

| Area | Current Support | Evidence | Grade | Severity |
|---|---|---|---:|---|
| Condition identity | Rich `Condition` model with joins to drugs, procedures, labs, imaging, questions, attempts, reviews, study plan items, and blueprint conditions | `prisma/schema.prisma:543` | 78 | P2 |
| Medical content detail | `MedicalContent` has overview, diagnostics, treatment, differential, review metadata, evidence grade, search vector | `prisma/schema.prisma:1705` | 68 | P1 |
| Drugs | Rich `Drug`, side effects, interactions, and `DrugConditionLink` | `prisma/schema.prisma:984`, `prisma/schema.prisma:1079` | 82 | P2 |
| Procedures | Rich `Procedure` and `ProcedureConditionLink` | `prisma/schema.prisma:2492`, `prisma/schema.prisma:2540` | 78 | P2 |
| Labs/imaging | `LabTest`, `ImagingStudy`, and condition link tables exist | `prisma/schema.prisma:1530`, `prisma/schema.prisma:1434` | 80 | P2 |
| Presentations/DDx | `DifferentialDiagnosis` exists; no first-class `ClinicalPresentation` model | `prisma/schema.prisma:919` | 66 | P1 |
| Study taxonomy | `Course`, `StudyTopic`, `QuestionStudyTopic`, `StudyPlan` are present | `prisma/schema.prisma:428`, `prisma/schema.prisma:452`, `prisma/schema.prisma:2689` | 74 | P2 |
| Progress | `UserProgress` and `UserTopicProgress` exist but identity is ambiguous | `prisma/schema.prisma:3902`, `prisma/schema.prisma:4072` | 65 | P1 |
| Normalized session/study layer | `StudySessionQuestion`, `StudyPlan`, `StudyPlanItem`, `QuestionStudyTopic` exist | `prisma/schema.prisma:4546`, migration `20260502000000_normalized_study_schema` | 72 | P2 |

## Missing Models And Relations

| Gap | Evidence | Risk | Recommended Fix |
|---|---|---|---|
| `MedicalContent.conditionId` is not a Prisma FK to `Condition.id` | `prisma/schema.prisma:1707` | Split canonical identity | Add `conditionRefId -> Condition.id`, backfill, then migrate callers |
| `UserProgress.conditionId` points to `MedicalContent.id`, not `Condition.id` | `prisma/schema.prisma:3905`, `prisma/schema.prisma:3925` | FSRS and study plan bugs during condition-level work | Add explicit `medicalContentId`; keep legacy field until backfilled |
| Clinical presentation is represented by `DifferentialDiagnosis.presentingComplaint`, not a reusable entity | `prisma/schema.prisma:919` | Presentation-based learning cannot attach cases, questions, progress, red flags cleanly | Add `ClinicalPresentation`, `PresentationConditionLink`, `PresentationQuestionLink` |
| Medical entity tags are not generalized | `Question.relatedDrugs` and `relatedDiseases` are string arrays | Weak medication/procedure question targeting | Add `MedicalEntityTag` or per-entity question join tables |
| Drug classes are strings, not normalized | `prisma/schema.prisma:988` | Duplicate class names and weak class-level analytics | Add `DrugClass` and `DrugDrugClass` |
| Generated/canonical question identities are split | `PreGeneratedQuestion`, `QuestionAttempt.questionId`, `ReviewLog.questionId/questionFkId` | Attempts/reviews can point at mixed source IDs | Promote generated questions before serving or add typed source FK fields |
| Normalized session question join is not active everywhere | `StudySession.questionIds` remains in active generation/read paths | Resume and analytics miss source type/order metadata | Dual-write `StudySessionQuestion` and migrate reads |
| Daily plan JSON remains active beside `StudyPlanItem` | `DailyStudyPlan.recommendedSessions` | Study planning cannot reliably target canonical medical entities | Generate `StudyPlanItem` records and keep JSON as cache only |
| Content sections remain string/JSON caches | `prisma/schema.prisma:1718-1755` | Hard to validate completeness and safety fields | Add `MedicalContentSection`, `ConditionEvidenceSource`, `ConditionSafetyFlag` |
| Raw backup/versioning spec is partial | `docs/normalize-medical-content-spec.md:41`, `prisma/schema.prisma:1713` | Unsafe normalization migrations | Add `MedicalContentRawBackup` before bulk transforms |

## Unsafe Enum/String Usage

| Field Area | Current Pattern | Risk | Fix |
|---|---|---|---|
| Systems | `system` strings across `Condition`, `MedicalContent`, `Question`, `QuestionAttempt` | CV vs Cardiovascular vs Cardio drift | Canonical `MedicalSystem` lookup with aliases |
| Content status | `status` string on `Condition`/`MedicalContent` | Published without review metadata | `ContentStatus` enum or constrained lookup |
| Task category | Multiple string vocabularies | Analytics/generation mismatch | Canonical `TaskCategory` lookup |
| Evidence grade | Optional string | Invalid or stale source claims | constrained grade plus source/year/review date checks |
| Drug classes | `Drug.drugClass String[]` | 1,003 live class strings for 1,000 drugs | `DrugClass` plus aliases and join table |
| Review provenance | optional review/source fields on `MedicalContent` | live probe found 0 reviewed/source rows | require provenance for learner-facing published content |

## Recommended Canonical Schema

Use `Condition` as the canonical medical diagnosis/concept identity. Attach detailed education content through `MedicalContent.conditionRefId`, and keep `MedicalContent.conditionId` as a legacy slug until backfill is complete.

Recommended additions:

| Model | Purpose |
|---|---|
| `MedicalSystem` | Canonical system code, display name, NCCPA weight, aliases |
| `DrugClass` | Medication-class analytics and class-level study |
| `QuestionDrugLink` | Medication-level question targeting and progress analytics |
| `ClinicalPresentation` | Chest pain, dyspnea, abdominal pain, syncope, etc. |
| `PresentationConditionLink` | Emergent/common/rare DDx with discriminators |
| `MedicalContentSection` | Normalized overview/presentation/workup/treatment/safety sections |
| `ConditionSafetyFlag` | Red flags, emergency management, contraindications |
| `MedicalEntityTag` | Generic question/study/progress tagging across entity types |
| `MedicalContentRawBackup` | Safe JSON/string normalization rollback |

## Migration Plan

1. Add new nullable canonical FK fields and lookup tables without dropping existing columns.
2. Backfill `MedicalContent.conditionRefId` by exact condition id, then normalized condition name/system.
3. Backfill progress rows into explicit `medicalContentId` while preserving legacy `conditionId`.
4. Add compatibility views/helpers so old endpoints continue to read.
5. Add validation checks for canonical system/task/status/evidence values.
6. Backfill normalized sections from existing JSON/string content.
7. Add tests for identity resolution, taxonomy validation, and relationship traversal.
8. Rename misleading fields only after all reads and writes are migrated.
9. Dual-write normalized study/session records before removing legacy arrays or JSON caches.
10. Add a read-only identity audit to CI that reports orphaned question, progress, and session links before schema tightening.
