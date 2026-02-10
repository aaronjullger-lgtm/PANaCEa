# Condition Library: Grouping Logic & Data Integrity

**Purpose:** Root-cause reference for how condition grouping works and when to fix issues at the DB vs UI layer.

---

## How Grouping Works (UI/API)

1. **API** (`GET /api/content/library`) returns `MedicalContent` rows with `system` and `subcategory` (plain strings). No joins to a separate “category” or “label” table; the strings on each row are the source of truth.
2. **Client** (`ClinicalReferenceLibrary`) groups by **composite (system, subcategory)** so that:
   - Each group header is derived only from the conditions in that group (no ID→label lookup).
   - When viewing “All Systems,” headers show system + subcategory (e.g. `EENT — Tympanic Disorders`) so ENT conditions never appear under a Psych header.

So **wrong groupings (e.g. an ENT condition under “ANXIETY DISORDERS”) can only occur if that condition’s row in `MedicalContent` has incorrect `system` or `subcategory` values.**

---

## Data Model

| Table           | system   | subcategory | Notes                          |
|----------------|----------|-------------|--------------------------------|
| `Condition`    | required | optional    | Canonical condition taxonomy   |
| `MedicalContent` | required | required  | 1:1 per condition (conditionId unique); used by library API |

The library reads only from `MedicalContent`. If `Condition` is the canonical source for system/subcategory, then `MedicalContent.system` and `MedicalContent.subcategory` should be kept in sync when conditions are created/updated.

---

## When to Fix at the DB Level

- **Symptom:** A condition appears under the wrong system or subcategory header (e.g. Tympanic Membrane Perforation under “ANXIETY DISORDERS”).
- **Cause:** The `MedicalContent` row for that condition has the wrong `system` or `subcategory`.
- **Fix options:**
  1. **One-off correction:** Update the row:
     ```sql
     UPDATE "MedicalContent"
     SET system = 'EENT', subcategory = 'Tympanic / Ear'
     WHERE conditionId = (SELECT id FROM "Condition" WHERE name ILIKE '%Tympanic Membrane Perforation%' LIMIT 1);
     ```
  2. **Bulk sync from Condition:** If `Condition` is the source of truth, run a script or migration that sets `MedicalContent.system` and `MedicalContent.subcategory` from the linked `Condition` (join on `MedicalContent.conditionId = Condition.id`).
  3. **Validation query:** To find possible mismatches (e.g. ENT-like conditions with Psych system):
     ```sql
     SELECT mc.id, mc.condition, mc.system, mc.subcategory
     FROM "MedicalContent" mc
     WHERE mc.system = 'PSYCH'
       AND (mc.condition ILIKE '%tympanic%' OR mc.condition ILIKE '%ear%' OR mc.condition ILIKE '%otitis%');
     ```

---

## Summary

- **UI/API:** Grouping uses each row’s own `system` and `subcategory`; no separate label table, so no ID/label mix-up in code.
- **Wrong headers:** Fix by correcting `MedicalContent.system` / `MedicalContent.subcategory` (and optionally syncing from `Condition` or adding validation).
