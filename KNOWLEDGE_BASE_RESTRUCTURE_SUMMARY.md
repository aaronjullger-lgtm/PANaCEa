# Knowledge Base vs Clinical Utilities Restructure - Implementation Summary

## Overview

Successfully restructured the app to separate **"The What"** (Knowledge Base) from **"The How"** (Clinical Utilities), eliminating redundancy and clarifying the distinction between static reference content and active clinical tools.

---

## Changes Completed

### 1. Navigation & Routes

**NavRail** (`components/layout/NavRail.tsx`)
- "Reference" → **"Knowledge Base"** (`/study/knowledge`)
- "Toolkit" → **"Clinical Utilities"** (`/study/utilities`)

**Routes** (`config/routes.ts`)
- Added: `STUDY_KNOWLEDGE`, `STUDY_UTILITIES`
- Deprecated: `STUDY_REFERENCE`, `STUDY_TOOLKIT` (backward compatibility preserved)

**App.tsx**
- Added redirects: `/study/reference` → `/study/knowledge`, `/study/toolkit` → `/study/utilities`
- Wired `KnowledgeBaseHub` for `/study/knowledge` path

---

### 2. Knowledge Base Hub (New)

**Component:** `components/knowledge/KnowledgeBaseHub.tsx`

**Structure:** 3-tab hub with persistent sidebar

| Tab                  | Content                                      | Source                        |
| -------------------- | -------------------------------------------- | ----------------------------- |
| **Condition Library** | Diseases/conditions by organ system          | `ClinicalReferenceLibrary`    |
| **Pharmacopeia**     | Drug reference by class (AB, CV, Endo, etc.) | Moved from ToolkitHub         |
| **Lab Reference**    | Normal values, clinical differentials        | `LabReferenceView` (new)      |

**Supporting Components:**
- `components/knowledge/PharmacopeiaView.tsx` - Extracted from ToolkitHub
- `components/knowledge/LabReferenceView.tsx` - New component using `/api/labs/tests`
- `components/knowledge/index.ts` - Barrel export

**API Used:**
- `/api/labs/tests` - Fetches `LabTest` with normal ranges, `increaseIndicates`, `decreaseIndicates`

---

### 3. Clinical Utilities Slim-Down

**Component:** `components/toolkit/ToolkitHub.tsx`

**Removed Tabs:**
- ~~Clinical Library~~ (redundant with Knowledge Base)
- ~~Pharmacopeia~~ (moved to Knowledge Base)
- ~~Physiology~~ (lab values → Lab Reference in Knowledge Base)
- ~~Imaging Atlas~~ (deprecated or relocate to Knowledge Base if needed)

**Retained & Refined:**
- **Calculators** - Risk scores, diagnostic criteria (unchanged)
- **Generators** - Mnemonics, study guides, clinical motion (unchanged)
- **Interpretation Assistants** (NEW) - ABG Interpreter, EKG Interpreter (placeholder cards)

**Branding:**
- Title: "Clinical Toolkit" → **"Clinical Utilities"**
- Description: "Reference & Calculators" → **"Tools & Calculators"**

---

## Interpretation Assistants (Stubs)

Two placeholder cards added to the "interpreters" tab in ToolkitHub:

### ABG Interpreter
- **Input:** pH, pCO₂, HCO₃, O₂
- **Output:** Acidosis/alkalosis, metabolic/respiratory, compensation, differential
- **Implementation:** Rule-based (Winter's formula, compensation rules)

### EKG Interpreter
- **Input:** Rhythm, rate, PR, QRS, QT, ST, T-wave
- **Output:** Diagnostic interpretation, DDx
- **Implementation:** Structured form → rule-based or AI-assisted; can leverage `ECGPattern` and `ECGConditionLink`

*Note: Full interpreter UIs are TODO - currently placeholder cards.*

---

## Migration Path

### For Bookmarks/Direct Links
- Old paths redirect automatically (handled in `App.tsx`)
- `/study/reference` → `/study/knowledge`
- `/study/toolkit` → `/study/utilities`

### For Users
- NavRail updated: "Reference" and "Toolkit" renamed
- Same URLs work (redirected)
- New structure: clearer separation between reference (Knowledge Base) and tools (Clinical Utilities)

---

## Files Modified

| File                                              | Changes                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| `components/layout/NavRail.tsx`                   | Labels and hrefs updated                             |
| `config/routes.ts`                                | New routes, deprecated old                           |
| `App.tsx`                                         | Redirects, KnowledgeBaseHub wired                    |
| `config/lazyComponents.tsx`                       | KnowledgeBaseHub lazy export                         |
| `components/toolkit/ToolkitHub.tsx`               | 6 tabs → 3 tabs, title updated                       |
| `components/knowledge/KnowledgeBaseHub.tsx`       | **New** - 3-tab hub                                  |
| `components/knowledge/PharmacopeiaView.tsx`       | **New** - extracted from ToolkitHub                  |
| `components/knowledge/LabReferenceView.tsx`       | **New** - lab values & differentials                 |
| `components/knowledge/index.ts`                   | **New** - barrel exports                             |
| `components/navigation/CommandCenterHub.tsx`      | "Clinical Reference" → "Knowledge Base" label update |

---

## Testing Checklist

- [ ] Navigate to `/study/knowledge` → Knowledge Base Hub loads
- [ ] Knowledge Base tabs: Condition Library, Pharmacopeia, Lab Reference
- [ ] Navigate to `/study/utilities` → Clinical Utilities Hub loads
- [ ] Clinical Utilities tabs: Calculators, Generators, Interpretation Assistants
- [ ] Legacy redirect: `/study/reference` → `/study/knowledge`
- [ ] Legacy redirect: `/study/toolkit` → `/study/utilities`
- [ ] NavRail labels: "Knowledge Base" and "Clinical Utilities" visible

---

## Next Steps (Optional)

1. **CommandCenterHub labels:** Update remaining references to "Clinical Reference Library" and "Calculators & Risk Scores" for consistency.
2. **Implement ABG Interpreter:** Full UI with pH, pCO₂, HCO₃, O₂ inputs and Winter's formula logic.
3. **Implement EKG Interpreter:** Structured form leveraging `ECGPattern` and `ECGConditionLink`.
4. **QuickReferenceDrawer:** Update tabs to deep-link to Knowledge Base (drugs, labs) and Clinical Utilities (calculators).
5. **Imaging Atlas:** Decide whether to add as 4th tab in Knowledge Base or keep separate.
