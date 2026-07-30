---
name: panacea-blueprint-checker
description: Check NCCPA blueprint coverage gaps in the PANaCEa question bank. Use when generating questions, auditing content coverage, or ensuring no organ system is under-represented.
---

# NCCPA Blueprint Coverage Checker

## When to Use
- Before generating new questions to identify gaps
- During content audits to find under-represented areas
- When planning study sessions to ensure balanced coverage

## Blueprint Structure
The PANCE blueprint has two dimensions:

### Organ Systems (12)
1. Cardiovascular (CV)
2. Pulmonary (PULM)
3. Gastrointestinal/Nutritional (GI)
4. Endocrine (ENDO)
5. Genitourinary (GU)
6. Obstetrics/Gynecology (OB/GYN)
7. Musculoskeletal (MSK)
8. Neurologic (NEURO)
9. Skin/Dermatology (DERM)
10. Hematologic (HEM)
11. Infectious (INFECT)
12. Psychiatric/Behavioral (PSYCH)

### Task Categories (10)
1. History & Physical
2. Diagnosis (most common)
3. Pharmacotherapy
4. Intervention/Procedure
5. Health Maintenance

## How to Check Coverage

1. Query the question bank by organ system:
```sql
SELECT "organSystem", COUNT(*) FROM "Question" WHERE "lifecycleStatus" = 'approved' GROUP BY "organSystem";
```

2. Query by task category:
```sql
SELECT "taskCategory", COUNT(*) FROM "Question" WHERE "lifecycleStatus" = 'approved' GROUP BY "taskCategory";
```

3. Compare against NCCPA blueprint weights (from `lib/constants/blueprint.ts`):
- CV: 16%, PULM: 10%, GI: 9%, ENDO: 6%, GU: 5%, OB/GYN: 7%, MSK: 10%, NEURO: 7%, DERM: 5%, HEM: 4%, INFECT: 6%, PSYCH: 5%
- Diagnosis: ~40%, Pharmacotherapy: ~20%, History/Physical: ~15%, Intervention: ~15%, Health Maintenance: ~10%

4. Flag any system with < 50% of expected coverage as a HIGH priority gap.
5. Flag any task category with < 40% of expected coverage as a HIGH priority gap.

## Output Format
Report gaps as: "ORGAN_SYSTEM: has X questions, expected ~Y (Z% of target). PRIORITY: HIGH/MEDIUM/LOW"

Recommend specific topics within the gap system that need questions (e.g., "CV: needs questions on arrhythmias, heart failure management, lipid guidelines").
