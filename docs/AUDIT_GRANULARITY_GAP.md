# Granularity Gap Audit

**Date:** 2025-02-02  
**Scope:** Three-tier hierarchy for weakness study guides and FSRS targeting

---

## 1. Required Three-Tier Hierarchy

### Audit Requirement

> Every question should have at least 3 layers of tags:
> 1. **System** (e.g., Cardiology)
> 2. **Category** (e.g., Ischemic Heart Disease)
> 3. **Topic/Diagnosis** (e.g., Unstable Angina)
>
> Why: FSRS works best when it can predict "User is weak at Topic:Antibiotics" rather than penalizing all of Infectious Disease.

---

## 2. Schema Support — PARTIAL

### Models with hierarchy fields

| Model | System (Tier 1) | Category (Tier 2) | Topic/Diagnosis (Tier 3) | Notes |
|-------|-----------------|-------------------|--------------------------|-------|
| **MedicalContent** | `system` ✅ | `subcategory` ✅ | `condition` ✅ | Full 3-tier; subcategory + parent_category |
| **Question** | `system` ✅ | `category` ✅ (optional) | `topic` ✅ (optional) | Schema supports 3 tiers; often null |
| **PreGeneratedQuestion** | `system` ✅ | ❌ None | Via `conditionId` FK only | No category or topic column |
| **QuestionAttempt** | `system` ✅ | ❌ None | `conditionId` ✅ | System + condition only |
| **ReviewLog** | `system` ✅ | ❌ None | `conditionId`, `medicalContentId` | System + condition only |
| **UserProgress** | Via `conditionId` → MedicalContent | — | `conditionId` | No direct category/topic |
| **WeaknessPattern** | Via Condition | — | `conditionId` ✅ | Condition-level granularity |

### Summary

- **MedicalContent** and **Question** support 3 tiers.
- **PreGeneratedQuestion** (main drill/session source) has only system and conditionId; no category or topic.
- Most analytics and the FSRS optimizer work at **system** level only.

---

## 3. Weakness Study Guide — SYSTEM ONLY ❌

### Current implementation

`lib/weaknessCheatsheetExport.ts`:

```typescript
// Group by system, track errors
const systemErrorMap = new Map<SystemCode, ...>();
recentData.forEach((record) => {
  if (!record.system || record.system === 'OTHER') return;
  systemErrorMap.get(record.system)!.push({ ... });
});
```

- Weaknesses are grouped by **system** (CV, DERM, GI, etc.).
- Export sections are labeled by system name (e.g., "Cardiology", "Dermatology").
- No breakdown by category (e.g., Murmurs vs EKGs) or topic/diagnosis (e.g., Unstable Angina).

### Impact

- "Weak in Cardiology" does not distinguish Murmurs vs EKGs vs Ischemic Heart Disease.
- "Weak in Pharmacology" does not distinguish Antibiotics vs Hypertensives.
- Study guides are too broad for targeted review.

---

## 4. FSRS & Optimizer — SYSTEM LEVEL ONLY

### Current state

| Component | Granularity | Uses category/topic? |
|-----------|-------------|----------------------|
| **UserProgress** | Per `conditionId` | No |
| **FSRS per-condition** | Condition (topic/diagnosis) | ✅ Finest level |
| **systemModifiers** (optimizer) | Per system (CV, PULM, etc.) | ❌ No |
| **optimizeWithSystemModifiers** | Groups by system code | ❌ No |

- FSRS scheduling is per **condition** (good).
- Optimizer modifiers are per **system** only (too coarse).
- No per-category or per-topic modifiers.

---

## 5. Data flow gaps

### PreGeneratedQuestion

- Has `system`, `conditionId`, `medicalContentId`.
- No `category` or `topic`.
- Category and topic could be derived from MedicalContent via JOIN, but are not stored or used.

### PerformanceRecord / analytics

- `record.system` and `record.conditionId`/`record.condition` are present.
- Weakness logic groups by system; condition is used only to attach questions to sections, not to define focus areas.

### fsrs-params system extraction

- System codes come from `medicalContentId.split('-')[0]` (fragile; assumes format).
- Prefer: JOIN to MedicalContent and use `system`, `subcategory`, `condition`.

---

## 6. Recommendations

### 1. Enforce three tiers for content

- Ensure every Question and PreGeneratedQuestion has (or can resolve) system, category, topic/diagnosis.
- For PreGeneratedQuestion: add `category` and `topic`, or always JOIN to MedicalContent/Condition to derive them.

### 2. Weakness Study Guide

- Group by **category** (or category + system) in addition to system.
- Example: "Cardiology › Ischemic Heart Disease › Unstable Angina (5 errors)".
- Allow filtering/grouping by category for more focused guides.

### 3. FSRS system modifiers (optional)

- Add per-category modifiers when enough data exists (e.g., MIN_REVIEWS_PER_CATEGORY).
- Keep system-level modifiers; add category as a finer grain where useful.

### 4. Standardize naming

| Tier | Preferred name | MedicalContent | Question | PreGeneratedQuestion |
|------|----------------|----------------|----------|----------------------|
| 1 | System | `system` | `system` | `system` |
| 2 | Category | `subcategory` | `category` | Add or JOIN |
| 3 | Topic/Diagnosis | `condition` | `topic` / `condition` | Via `conditionId` |

### 5. Condition loader and APIs

- `condition-loader` and question APIs already expose `subcategory`.
- Ensure all question-returning APIs include `system`, `category`/`subcategory`, and `condition`/`topic` for clients that need granularity.

---

## 7. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Schema supports 3 tiers | ⚠️ Partial | MedicalContent, Question yes; PreGeneratedQuestion no |
| Every question has 3 layers | ❌ No | PreGeneratedQuestion missing category/topic |
| Weakness guide uses category/topic | ❌ No | Groups by system only |
| FSRS modifiers use category | ❌ No | System-level only |
| Condition-level FSRS | ✅ Yes | UserProgress is per condition |

---

## 8. References

- MedicalContent: `prisma/schema.prisma` (system, subcategory, parent_category, condition)
- Question: `prisma/schema.prisma` (system, category, topic)
- PreGeneratedQuestion: `prisma/schema.prisma` (system only; no category/topic)
- Weakness cheatsheet: `lib/weaknessCheatsheetExport.ts`
- FSRS optimizer: `lib/fsrs-optimizer.ts` (optimizeWithSystemModifiers)
- Condition loader: `functions/api/_shared/condition-loader.ts`
