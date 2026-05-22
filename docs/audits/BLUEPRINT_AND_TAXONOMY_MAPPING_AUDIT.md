# Blueprint And Taxonomy Mapping Audit

Date: 2026-05-02 00:08 EDT

## Grade

Blueprint/taxonomy grade: **58/100 (F), P1**

There is a canonical-looking NCCPA source in `lib/constants/blueprint.ts`, but older maps and decks remain active. System labels and task categories use multiple vocabularies.

Second-pass update: taxonomy drift is now a confirmed runtime analytics risk, not only a cleanup problem. `functions/api/analytics/blueprint-gaps.ts` filters attempts on `systemNormalized`, but main attempt writers populate `system` and not `systemNormalized`; Rolling360 uses the default export from `lib/nccpa-blueprint.ts` as if it were a system-weight map; readiness projection divides already-decimal blueprint weights by 100.

## Taxonomy Mapping Table

| Taxonomy Area | Current Source | Issues | Canonical Source | Migration Needed | Risk |
|---|---|---|---|---|---|
| PANCE system weights | `lib/constants/blueprint.ts:17` | Full names; includes Emergency Medicine and General | Keep this | Add DB lookup mirror | Medium |
| Jan 2025 simulation weights | `lib/constants/blueprint.ts:64` | Different labels: EENT, Gastrointestinal/Nutrition, Professional Practice | Keep as exam-mode variant | Map to canonical system ids | Medium |
| Legacy topic map | `config/topic-map.ts:3` | Different weights and `PANCE_DECK`; no Emergency Medicine | Deprecate after callers migrate | Replace deck from canonical weights | High |
| Rotation systems | `config/rotation-systems.ts:34` | Abbreviation-only; excludes some system codes | Canonical systems + rotation join | Backfill `Course`/`StudyTopic` | Medium |
| Task categories | `lib/constants/blueprint.ts:87`, `lib/nccpa-question-weighting.ts:37`, `services/domain/panceDistributionService.ts:12` | At least three vocabularies | Canonical `TaskCategory` lookup | Normalize question generation and analytics | High |
| Question tags | `Question.tags`, `relatedDrugs`, `relatedDiseases` | JSON/string arrays | Entity tags | Backfill joins | Medium |
| Blueprint gap analytics | `functions/api/analytics/blueprint-gaps.ts:92` | Reads only `systemNormalized` | Canonical attempt normalizer | Populate on write and read fallback | High |
| Rolling360 heatmap | `components/dashboard/Rolling360/SystemTriageHeatmap.tsx:281` | Iterates wrapper default export, not weight map | `NCCPA_2025_BLUEPRINT` | Import named constant | High |
| Readiness projection | `lib/services/readinessProjectionService.ts:243` | Divides decimal weights by 100 | `NCCPA_2025_BLUEPRINT` decimals | Remove extra scaling and normalize aliases | Medium |
| Prompt topic list | `services/ai/geminiService.ts:1171` | Uses legacy `PANCE_TOPICS` | Canonical taxonomy service | Inject canonical topics | High |

## Duplicate Or Invalid Labels

| Label Set | Conflict | Severity | Fix |
|---|---|---|---|
| GI | `Gastrointestinal`, `Gastrointestinal/Nutrition`, `GI` | P2 | Alias table |
| HEENT | `HEENT`, `EENT`, `Eyes, Ears, Nose, and Throat` | P2 | Alias table |
| Neuro | `Neurological`, `Neurologic`, `NEURO` | P2 | Alias table |
| ID | `Infectious Disease`, `Infectious Diseases`, `ID` | P2 | Alias table |
| Professional practice | `PRO` in topic map but not canonical 2025 weights | P1 | Decide exam-specific handling |
| Renal/nephrology | Rolling360 maps `RENAL -> Renal`, canonical uses `Nephrology` | P2 | Alias table |
| Task category terms | `management`, `diagnostics`, `professional` vs `clinical_intervention`, `diagnostic_lab`, `professional_practice` | P1 | One generator/analytics contract |

## Compatibility Plan

1. Keep `lib/constants/blueprint.ts` as code canonical source for now.
2. Seed `MedicalTaxonomy`/`SystemMapping` from that file, not `config/topic-map.ts`.
3. Replace `PANCE_DECK` with generated deck from canonical percentages.
4. Add task-category normalizer and reject unknown task strings at generation time.
5. Backfill existing questions and attempts to canonical system/task ids while preserving original labels.
6. Populate `QuestionAttempt.systemNormalized` at every write path and add analytics fallback to `system` during migration.
7. Replace prompt-embedded topic lists with canonical taxonomy service output.
8. Add regression tests for Rolling360/readiness projection using named canonical constants.
