# Medical Content Implementation Plan

Date: 2026-05-02 00:08 EDT

## Goal

Move PANaCEa from a broad but inconsistent medical-content schema to a canonical, validated, relationship-rich knowledge layer that can power question generation, explanations, study plans, progress analytics, search, and spaced repetition.

Current grade: **60/100 (D)**. Target grade: **85/100 (B)** before production launch.

## Prioritized Phases

| Phase | File-Level Tasks | Complexity | Verification |
|---|---|---|---|
| A. Taxonomy | Normalize `config/topic-map.ts`, `lib/constants/blueprint.ts`, `lib/nccpa-question-weighting.ts`, `services/domain/panceDistributionService.ts` | Medium | Blueprint mapping tests |
| B. Safety gates | Disable or review-gate raw learner-facing pharm/guideline/placeholder generation paths | Medium | Endpoint safety tests |
| C. Identity contract | Add explicit `conditionRefId`/`medicalContentId` contract in `prisma/schema.prisma` and helper services | High | Prisma validate, identity unit tests |
| D. Seed backbone | Add versioned condition/med/procedure/presentation seed manifests | Medium | Seed dry-run manifests |
| E. Relationships | Seed condition-drug/procedure/lab/imaging/DDx links and question-drug links | Medium | Link completeness tests |
| F. Question generation | Ground all generation in canonical content ids and one metadata schema | Medium | Generation tests, validator tests |
| G. Explanations | Add `conditionId`/`medicalContentId` to explain-rag contract | Medium | RAG explanation tests |
| H. Progress/planning | Use entity-level weakness and normalized study/session joins | High | Study plan targeting tests |
| I. Cleanup | Deprecate empty/static and stale routes | Medium | Import/reference tests |

## Schema/Model Changes

1. Add `MedicalSystem`, `TaskCategory`, `DrugClass`, `ClinicalPresentation`, `PresentationConditionLink`, `MedicalEntityTag`, `QuestionDrugLink`.
2. Add `MedicalContent.conditionRefId` as FK to `Condition.id`.
3. Add explicit `UserProgress.medicalContentId`; backfill from legacy `conditionId`.
4. Add `MedicalContentRawBackup` for migration safety.
5. Add indexes for entity tags, presentation links, and study plan targeting.

## Canonical Taxonomy Plan

Use `lib/constants/blueprint.ts` as temporary canonical code source, then mirror it into `MedicalTaxonomy` and `SystemMapping`. Treat `config/topic-map.ts` as compatibility-only until replaced.

Immediate taxonomy tasks:

1. Populate `QuestionAttempt.systemNormalized` in `functions/api/questions/attempt.ts` and `lib/services/drillReviewService.ts`.
2. Add a migration fallback in blueprint gap analytics: normalize `systemNormalized ?? system`.
3. Replace Rolling360 default blueprint import with a named `NCCPA_2025_BLUEPRINT` import.
4. Remove the extra `/ 100` scaling from readiness projection where decimal weights are already used.
5. Convert `services/ai/geminiService.ts` prompt topic lists to canonical taxonomy output.

## Content Model Plans

| Entity | Plan |
|---|---|
| Conditions | Required fields: aliases, system, blueprint, presentation, workup, criteria, treatment, red flags, disposition, follow-up, education, evidence |
| Medications | Normalize classes; require MOA, indications, contraindications, adverse effects, monitoring, interactions, exam points |
| Procedures | Require indications, contraindications, equipment, steps, complications, aftercare, rotation relevance |
| Diagnostics | Split labs/imaging/decision rules; require indications, interpretation, first-line status, links |
| Presentations/DDx | Add explicit presentation model with emergent/common DDx, red flags, discriminators, initial workup |

## QA Plan

- Draft by default.
- Deterministic validation before promotion.
- Human review for therapeutic/emergency/safety-critical content.
- Citation/source metadata for all published content.
- Approved-only learner-serving queries.
- Fail closed for medication-sensitive drills unless referenced drugs have reviewed safety fields.
- Replace simulated compliance checks with deterministic source/review/staleness checks.
- Treat mock guideline search, placeholder infographic output, and placeholder calculators as unavailable in production until backed by reviewed sources.

## Rollback Plan

- Add schema fields as nullable first.
- Back up raw content before normalization.
- Dual-read and dual-write during migration.
- Keep legacy fields until parity checks pass.
- Roll back by disabling new reads, not by dropping columns.

## Verification Checklist

- `npx prisma validate --schema prisma/schema.prisma`
- `npx vitest run functions/api/_shared/condition-loader.test.ts`
- Seed dry-run report
- Link integrity report
- Question-serving approved-only tests
- Study plan targeting tests
- Blueprint distribution tests
- Pharm drill approved-only/safety tests
- Question-drug link integrity tests
- MedicalContent provenance audit
- StudySessionQuestion dual-write/read parity tests

## Launch Checklist

- No learner-facing pending/unreviewed questions.
- Every high-yield condition has complete required sections.
- Every high-risk medication/procedure has safety fields.
- Entity links exist for minimum viable graph.
- Dashboard and study plan metrics use canonical ids.
- No learner-facing medical route returns mock, placeholder, or unreviewed clinical artifacts as successful production content.
