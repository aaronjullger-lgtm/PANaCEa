# Markdown Table Audit Report

**Generated:** 2026-03-08T22:45:00Z  
**Objective:** Assess the need for Markdown formatting standardization across Supabase tables beyond `MedicalContent`.

## 1. Table Row Counts (Descending)

| Table | Row Count |
|-------|-----------|
| DrugConditionLink | 12731 |
| TreatmentConditionLink | 6825 |
| LabConditionLink | 6770 |
| ProcedureConditionLink | 4463 |
| ClinicalPearl | 4082 |
| FindingConditionLink | 2893 |
| FirstLineTreatment | 2777 |
| DifferentialConditionLink | 2624 |
| ImagingConditionLink | 2482 |
| Buzzword | 2390 |
| VitalSignConditionLink | 1678 |
| ScoringSystemConditionLink | 1469 |
| Condition | 1311 |
| MedicalContent | 1290 |
| medical_content_backup_20250308 | 1290 |
| PreGeneratedQuestion | 1138 |
| Drug | 1000 |
| UserQuestionSeen | 975 |
| Treatment | 848 |
| MediaAsset | 826 |
| ECGConditionLink | 670 |
| AnatomyConditionLink | 572 |
| ConditionRelation | 524 |
| SpecialTest | 476 |
| _ConditionToSpecialTest | 393 |
| AntibioticConditionLink | 390 |
| Question | 330 |
| LabTest | 311 |
| PatientEncounterCase | 304 |
| AnatomyStructure | 300 |
| PhysiologyConditionLink | 296 |
| DrugInteraction | 291 |
| PhysicalExamFinding | 261 |
| DifferentialDiagnosis | 255 |
| ImagingStudy | 231 |
| Procedure | 217 |
| HistoryComponent | 170 |
| PhysiologyConcept | 164 |
| ConfusionPair | 159 |
| QuestionSeed | 150 |
| ECGPattern | 83 |
| PracticeGuideline | 76 |
| ClinicalGuideline | 63 |
| LabCase | 63 |
| _prisma_migrations | 60 |
| AntibioticGuideline | 59 |
| NormalLabValue | 59 |
| ScoringSystem | 56 |
| VitalSignRange | 51 |
| ACLSAlgorithm | 50 |
| FluidCase | 46 |
| PerformanceRecord | 40 |
| NormalImagingFinding | 35 |
| QuestionAttempt | 33 |
| SRSItem | 32 |
| DiagnosticPuzzle | 30 |
| GrandRoundsChallenge | 30 |
| StudySession | 30 |
| NormalPhysicalExamFinding | 27 |
| UserBehaviorMetrics | 20 |
| UserQuestionHistory | 20 |
| NormalVitalSign | 17 |
| SessionAnalytics | 13 |
| SavedQuestion | 9 |
| ContrastiveSet | 5 |
| Guideline | 4 |
| User | 3 |
| NCCPABlueprintConfig | 1 |
| SourceMaterial | 1 |
| StudyRecommendation | 1 |
| UserLearningProfile | 1 |
| (other tables with 0 rows omitted) |

## 2. Tables with Potential Markdown Content

The following tables contain columns of type `text` or `character varying` that may store formatted text. Sampling detected Markdown formatting in the columns listed.

| Table | Row Count | Columns with Markdown | Current Formatting State | Recommendation |
|-------|-----------|----------------------|--------------------------|----------------|
| MedicalContent | 1290 | complications, diagnostics, differentialDiagnosis, epidemiology, etiology, first_line_rx, overview, pathophysiology, patient_education, physicalExam, prevention, prognosis, riskFactors, symptoms, treatment | Mixed Markdown & plain text | **Already standardized** via trigger `standardize_medical_content_markdown`. Ensure trigger is active and covers all columns. |
| medical_content_backup_20250308 | 1290 | Same as MedicalContent | Same as MedicalContent | Consider applying same trigger if this table is used for live queries; otherwise, monitor. |
| Treatment | 848 | description | Contains Markdown (bold, headers) | **Apply similar trigger** to standardize Markdown formatting in `description` column. |
| LabTest | 311 | interpretationSteps | Possible Markdown (numbered lists, asterisks) | Verify sample; if Markdown is intentional, apply trigger. |
| Drug | 1000 | (multiple text columns) | No Markdown detected | **No action needed.** Columns contain plain text descriptions, dosing, mechanisms, etc. |
| ClinicalPearl | 4082 | pearlText, fullExplanation | Unknown (not sampled) | Investigate; if Markdown present, consider standardization. |
| Question | 330 | vignette, explanation | Unknown (likely plain text) | Investigate; may contain Markdown for formatting. |
| DifferentialDiagnosis | 255 | workup, diagnosticAlgorithm, typicalPresentation, etc. | Unknown | Investigate. |
| ImagingStudy | 231 | description, indications, contraindications, etc. | Unknown | Investigate. |
| Procedure | 217 | description, technique, complications, etc. | Unknown | Investigate. |

## 3. Drug Table Detailed Analysis

The `Drug` table has **1000 rows** and contains 36 text columns. Sampled columns show **no Markdown formatting**; content is plain prose, dosing instructions, pharmacokinetic details, etc.

**Columns examined:** absorption, administrationTips, antidote, bioavailability, brandName, clinicalNotes, displayName, distribution, dosing, duration, elimination, eliminationRoute, genericName, geriatricDosing, geriatricNotes, halfLife, hepaticDosing, id, lactationNotes, lactationSafety, maxDailyDose, mechanismDetailed, mechanismOfAction, metabolism, metabolismDetail, onsetOfAction, peakEffect, pediatricDosing, pediatricNotes, pregnancyCategory, pregnancyNotes, renalDosing, reversalAgent, storageRequirements, toxicity, typicalCost.

**Sample from `administrationTips`:**
```
Administer orally on an empty stomach, at least 30 minutes before or 2 hours after meals, to maximize absorption. For IV administration, follow manufacturer’s dilution guidelines.
```

**Conclusion:** No Markdown standardization needed for the Drug table.

## 4. SQL Queries Used

### Row Counts
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

For each table:
```sql
SELECT COUNT(*) as count FROM public."<table_name>";
```

### Text Columns
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('text', 'character varying', 'varchar', 'char')
ORDER BY table_name, column_name;
```

### Sampling
```sql
SELECT "<column>" as value
FROM public."<table>"
WHERE "<column>" IS NOT NULL
  AND "<column>" != ''
  AND length("<column>") > 10
LIMIT 3;
```

### Markdown Detection
Used simple regex patterns for `**bold**`, `*italic*`, `` `code` ``, `# heading`, `[link]()`, `- list`, `1. list`, `___`, `~~strikethrough~~`.

## 5. Recommendations

### High Priority
1. **Apply Markdown trigger to `Treatment` table** – Create a trigger similar to `standardize_medical_content_markdown` that sanitizes the `description` column on insert/update.
2. **Audit `ClinicalPearl`, `Question`, `DifferentialDiagnosis`, `ImagingStudy`, `Procedure` tables** – Perform deeper sampling to determine if Markdown is present and whether standardization is warranted.
3. **Verify `LabTest.interpretationSteps`** – Determine if Markdown is intentional; if yes, apply trigger.

### Medium Priority
4. **Ensure existing trigger covers all MedicalContent columns** – Review the `standardize_medical_content_markdown` trigger to confirm it applies to all text columns (including newer ones like `patient_education`, `prevention`, etc.).
5. **Consider adding trigger to `medical_content_backup_20250308`** if it is used in live queries.

### Low Priority
6. **Monitor Drug table** – No action required; plain text is fine.
7. **Document formatting standards** – Create a style guide for content authors to ensure consistent use of Markdown across all content-generating pipelines.

## 6. Next Steps

- Draft a trigger function for `Treatment` table.
- Run a full scan on tables with unknown formatting (sample more rows).
- Update the audit script to produce a more precise detection (ignore false positives like numbered lists without Markdown).
- Integrate Markdown validation into CI/CD for content updates.

---

*This report was generated by an automated script. Please validate findings before implementing changes.*