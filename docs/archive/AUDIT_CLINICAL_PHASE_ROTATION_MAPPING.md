# Clinical Phase Metadata (Rotation Mapping) Audit

**Date:** 2025-02-02  
**Scope:** Rotation tagging and filtering for Surgery/ER/Psych decks

---

## 1. Audit Requirement

> **Rotation Tagging:** Every question needs a `clinical_setting` tag array:
> - Example: "Acute Appendicitis Management" → Tags: System:GI, Setting:[Emergency, Surgery, Family_Med]
>
> **Why:** When a user selects "Surgery Rotation," filter by `Setting CONTAINS 'Surgery'`. Without this tag, you cannot cleanly serve a "Surgery" deck because "GI" also includes IBS (which is effectively never a surgery question).

---

## 2. Schema Support — PARTIAL

### clinicalSettings field

| Model | clinicalSettings | Populated? | Used for filtering? |
|-------|------------------|------------|---------------------|
| **Question** | ✅ `clinicalSettings String[] @default([])` | ❌ Default empty | ❌ No |
| **PreGeneratedQuestion** | ❌ None | — | — |

- `Question` has `clinicalSettings` in the schema (migration `20260131000000`).
- **No code** reads or writes `clinicalSettings` for filtering. It is never used.
- **PreGeneratedQuestion** has no clinical-setting field.

---

## 3. Current Rotation Logic — SYSTEM ONLY

### How rotation mode works today

**Config:** `config/rotation-systems.ts`

```typescript
ROTATION_SYSTEMS: Record<ClinicalRotation, SystemCode[]> = {
  Surgery: ['GI', 'CV', 'MSK', 'RENAL', 'HEENT', 'GU', 'ID', 'HEME'],
  'Emergency Medicine': ['CV', 'PULM', 'GI', 'MSK', 'HEENT', 'ID', 'NEURO', ...],
  // ...
};
```

**Flow (Clinical 60/40):** `services/questionService.ts`

1. User selects "Surgery" rotation.
2. `getSystemsForRotation('Surgery')` → `['GI', 'CV', 'MSK', 'RENAL', 'HEENT', 'GU', 'ID', 'HEME']`.
3. Fetch 60% of questions from pool where `system IN (GI, CV, MSK, ...)`.
4. Fetch 40% from background (other systems).
5. Merge and shuffle.

### Problem

- Filtering is by **system only**.
- Surgery rotation receives **all GI questions**—including:
  - Acute Appendicitis (surgery-relevant) ✅
  - IBS, IBD medical management, GERD (outpatient, non-surgical) ❌
- There is no `clinicalSettings CONTAINS 'Surgery'` filter.
- "Surgery" is a **setting**, not a PANCE system. The current mapping (Surgery → GI, CV, MSK, …) is a rough proxy; it does not distinguish surgery-relevant from non-surgery content within those systems.

---

## 4. API Support — NO clinicalSettings

### Session and pool APIs

| API | Filters supported | clinicalSettings? |
|-----|-------------------|-------------------|
| `/api/questions/session` | system, conditionId, mode | ❌ |
| `/api/questions/pool` | system, systems, category, difficulty | ❌ |
| SessionService.fetchFromPool | system, conditionId, difficulty | ❌ |
| getFromPreGeneratedPool | system, systems, category, difficulty | ❌ |

- No endpoint accepts `clinicalSettings` or `rotation` as a filter.
- Pool and session logic only use system/category/difficulty.

---

## 5. Rotation Selector vs Question Filtering

### UI

- **RotationSelector** lets the user pick a rotation (Surgery, ER, Psych, etc.).
- Choice is stored in `userProfile.currentRotation` and `localStorage`.
- **Question filtering** uses `getSystemsForRotation(rotation)` → systems, not `clinicalSettings`.

### Outcome

- Rotation affects **which systems** are sampled (system-level filter).
- It does **not** filter by clinical setting within those systems.
- A clean "Surgery deck" (only surgery-relevant questions) is not possible today.

---

## 6. Example: Acute Appendicitis vs IBS

| Question | System | Current Surgery filter | Desired |
|----------|--------|------------------------|---------|
| Acute Appendicitis Management | GI | ✅ Included (GI in Surgery systems) | ✅ Setting:[Surgery, Emergency] |
| IBS management, dietary counseling | GI | ✅ Included (same) | ❌ Setting:[Family_Med] only |
| Appendectomy complications | GI | ✅ Included | ✅ Setting:[Surgery] |

With system-only filtering, IBS questions are incorrectly included in a Surgery deck. With `clinicalSettings CONTAINS 'Surgery'`, only surgery-relevant GI (and other systems) would be included.

---

## 7. Recommendations

### 1. Populate clinicalSettings

- Define a controlled vocabulary: e.g. `Surgery`, `Emergency`, `Family_Med`, `Inpatient`, `Outpatient`, `Psychiatry`, etc.
- Add `clinicalSettings` (or equivalent) to **PreGeneratedQuestion** as well as Question.
- Populate during:
  - Question generation (from prompts/rubrics),
  - Condition/content mapping (e.g. appendicitis → Surgery, Emergency),
  - Manual curation.

### 2. Add rotation/setting filter to APIs

- Extend pool and session APIs with `clinicalSettings` or `rotation`:
  - `?rotation=Surgery` → `WHERE 'Surgery' = ANY(clinicalSettings)`
  - Or `?clinicalSettings=Surgery,Emergency` for explicit settings.
- Ensure SessionService, Pool API, and questionService support this filter.

### 3. Integrate into Clinical 60/40

- When `currentRotation` is set (e.g. Surgery):
  - Keep system filter from `getSystemsForRotation`.
  - Add `clinicalSettings && ARRAY[currentRotation]` (or equivalent) so that only questions tagged for that rotation are included.
- Fallback: if few or no questions match both system and setting, relax the setting filter and log for content review.

### 4. Question generation

- When generating questions (AI or templates), require or infer `clinicalSettings` from:
  - Condition (appendicitis → Surgery, Emergency),
  - Vignette (e.g. OR, ED, clinic),
  - Task type (surgical vs medical management).

---

## 8. Summary

| Check | Status | Notes |
|-------|--------|-------|
| clinicalSettings on Question | ✅ | Schema exists, default [] |
| clinicalSettings on PreGeneratedQuestion | ❌ | No field |
| clinicalSettings populated | ❌ | Not written anywhere |
| clinicalSettings used for filtering | ❌ | Never queried |
| Rotation filters by system | ✅ | getSystemsForRotation |
| Rotation filters by setting | ❌ | No setting filter |
| "Surgery deck" excludes IBS | ❌ | System-only; IBS included |
| API supports clinicalSettings filter | ❌ | Not implemented |

---

## 9. References

- Schema: `prisma/schema.prisma` (Question.clinicalSettings)
- Rotation config: `config/rotation-systems.ts`
- Question service: `services/questionService.ts` (Clinical 60/40)
- Pool API: `functions/api/questions/pool.ts`
- Session API: `lib/services/session/sessionService.ts`
