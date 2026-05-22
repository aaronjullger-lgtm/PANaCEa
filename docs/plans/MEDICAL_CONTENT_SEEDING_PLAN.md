# Medical Content Seeding Plan

Date: 2026-05-02 00:08 EDT

## Grade

Seed completeness grade: **52/100 (F), P1**

The repo has strong generator and registry infrastructure, but no source-controlled, versioned, clinically complete seed package for conditions. Drug, lab, and imaging registries are useful starts. Condition coverage depends on live DB state.

Second-pass update: live DB content exists, but clinical provenance is not populated. Seed completeness therefore must measure both volume and review metadata. A row without source/review fields should remain draft/internal even if the educational text is long.

## Seed Data Plan Table

| Seed Area | Minimum Viable Scope | Priority | Source File | Validation Rules |
|---|---|---|---|---|
| Conditions | 120 high-yield conditions across all systems | P1 | New `scripts/seed/medical-content/v1/conditions.json` | Required overview, presentation, diagnostics, treatment, red flags, source |
| Medications | 150 high-yield drugs plus classes | P2 | `src/registries/drugRegistry.ts` plus expansion | Required class, indications, contraindications, adverse effects, monitoring |
| Procedures | 60 PA-relevant procedures | P2 | Unified procedure seed manifest | Required indications, contraindications, steps, complications, aftercare |
| Labs | Existing 81 plus links | P2 | `src/registries/labTestRegistry.ts` | Required range/interp/critical values for common labs |
| Imaging | Existing 69 plus links | P2 | `src/registries/imagingRegistry.ts` | Required indications, contraindications, normal/abnormal findings |
| Presentations/DDx | 25 high-yield presentations | P1 | New presentation seed manifest | Required emergent/common DDx, red flags, initial workup |
| Questions | Approved-only production pool | P1 | Staging pipeline | Must resolve condition/content id and pass validator |
| Drug classes | Canonical class list and aliases | P1 | New `scripts/seed/medical-content/v1/drug-classes.json` | Unique class ids; aliases mapped; no free-text-only classes |
| Question-drug links | Links for every medication/pharm question | P1 | New backfill/import step | Every linked drug id exists; relationship role required |
| Content provenance | Source/review metadata for published content | P1 | Seed manifests and reviewer workflow | No published row without source, year, review date, reviewer |

## Minimum Viable Production Seed Set

Seed a small but complete graph first:

- Emergency: ACS/STEMI/NSTEMI, PE, stroke/TIA, sepsis, anaphylaxis, DKA/HHS, ectopic pregnancy, appendicitis, meningitis, status epilepticus.
- Internal/family: HTN, HF, COPD, asthma, CAP, diabetes, CKD, anemia, thyroid disease, GERD/PUD.
- Psychiatry: MDD, anxiety, bipolar disorder, schizophrenia, substance use, suicidality.
- Pediatrics: otitis media, bronchiolitis, asthma, dehydration, fever, immunizations.
- OB-GYN: ectopic pregnancy, preeclampsia, abnormal uterine bleeding, PID, prenatal care.
- Surgery/MSK: appendicitis, cholecystitis, bowel obstruction, fractures, septic arthritis.

## Import Strategy

1. Create JSON seed manifests with explicit version and source metadata.
2. Dry-run imports and emit a manifest: created, updated, skipped, rejected.
3. Insert clinical content as `draft` unless reviewer/source fields are present.
4. Insert questions into staging/pending only.
5. Backfill links after entity creation.
6. Run content completeness and integrity scripts.
7. Promote with review gate.
8. Emit a provenance report: published rows, reviewed rows, stale rows, source-missing rows.
9. Emit relationship reports for drug-condition, procedure-condition, diagnostic-condition, presentation-condition, and question-entity links.

## Validation Rules

- No placeholders such as "Content to be generated".
- No published clinical content without `approvedBy`, `approvedAt`, `lastClinicalReviewAt`, `evidenceGrade`, and `guidelineSource`.
- Required safety fields for emergency, medication, procedure, pregnancy, pediatrics, dosing, and anticoagulation content.
- Idempotent upserts by stable id.
- Link validation: every condition in a link table exists.
- Medication-sensitive content cannot publish unless contraindications, serious warnings, monitoring, pregnancy/lactation where relevant, renal/hepatic where relevant, and source metadata are present.
- Static clinical/lab case seeds must include canonical `conditionId`/`medicalContentId` before they can feed learner-facing features.
