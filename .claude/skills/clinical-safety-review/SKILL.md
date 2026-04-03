---
name: clinical-safety-review
description: "Validate clinical/medical content for patient safety — correct visual hierarchy, no truncated safety information, proper tier assignment. Use this skill whenever touching clinical content in PANaCEa: reference configs, drug information, lab values, scoring systems, procedure details, clinical calculators, or any component that displays medical information a PA student might act on. Also trigger when the user mentions safety review, clinical audit, content review, or patient safety."
---

# Clinical Safety Review

PANaCEa is a medical education platform used by PA students during clinical rotations and PANCE preparation. Content displayed in this app may directly inform clinical decisions. This skill ensures every piece of safety-critical information is visually distinct, never truncated, and correctly categorized.

## Why This Matters

A PA student reviewing a drug reference card during a rotation might glance at it for 3 seconds. If "contraindicated in pregnancy" is rendered with the same visual weight as "commonly tested on PANCE," that's not a styling preference — it's a patient safety failure. The three-tier visual hierarchy exists specifically to prevent this.

## Safety Content Classification

When reviewing or creating clinical content, classify every field into one of these categories:

### CRITICAL (Tier 1) — Must use `detailSectionCritical()` or `detailListCritical()`

Content where missing it could lead to patient harm:

- **Contraindications** — absolute and relative (drugs, procedures, imaging)
- **Critical lab values** — values requiring immediate clinical action
- **Emergency/acute management** — what to do RIGHT NOW
- **Decompensation signs** — signals a patient is deteriorating
- **Red flag responses** — history findings that demand urgent workup
- **"When NOT to use"** — scoring system misapplication warnings
- **Drug interactions** — major/life-threatening interactions
- **Black box warnings** — FDA-mandated safety warnings
- **Complications** — serious procedural complications

Visual signature: red left-border (`#ef4444`), AlertTriangle icon, tinted background.

### CLINICAL (Tier 2) — Standard `detailSection()` / `detailList()`

Factual clinical information that's important but not immediately dangerous if missed:

- Descriptions, mechanisms, pathophysiology
- Indications, typical use, clinical context
- Technique, procedure steps
- Interpretation guidance
- Reference ranges (non-critical)
- Sensitivity/specificity, diagnostic accuracy
- Associated conditions, differential diagnosis

### STUDY (Tier 3) — `studyPanel()` accordion

Board-prep material that helps learning but isn't clinical reference:

- Board yield facts, clinical pearls
- Test question tips, common mistakes
- Mnemonics, memory aids
- PANCE-specific study notes

## Review Checklist

When reviewing any file that renders clinical content, check each of these:

### 1. Tier Assignment Audit
For every field rendered in a `detailRenderer`, verify the correct tier:
- Grep for safety-relevant terms: `contraindic`, `critical`, `emergency`, `acute`, `decompensation`, `red.flag`, `when.not`, `black.box`, `complication`, `interaction`
- Each match should use `detailSectionCritical()` or `detailListCritical()`, NOT `detailSection()` or `detailList()`
- If a field name contains these terms but uses standard rendering, flag it as a **HIGH severity** issue

### 2. Truncation Audit
No expanded clinical content should ever be clipped:
- Search for `overflow: hidden`, `textOverflow`, `ellipsis`, `max-height`, `line-clamp` in detail renderers
- These are ONLY acceptable on collapsed card previews (inside `!expanded` conditionals)
- In `detailRenderer`, `detailSection`, `detailSectionCritical`, `detailList` — content must be unbounded

### 3. Completeness Audit
Safety fields that exist in the data type but aren't rendered:
- Compare the TypeScript interface fields against what the `detailRenderer` actually displays
- Any safety-classified field that exists on the type but is missing from the renderer is a **HIGH severity** gap
- Pay special attention to optional arrays — `contraindications?: string[]` might exist but never get rendered if the config was written before the data was populated

### 4. Ordering Audit
Within each detail view, content should follow this order:
1. **Study panel** (PANCE Focus accordion) — at the very top
2. **Critical sections** (Tier 1) — immediately visible
3. **Clinical sections** (Tier 2) — main body
4. **Cross-reference hints** — at the bottom

If critical sections are buried below 5+ clinical sections, flag it. Students scanning quickly should see safety information without scrolling past routine content.

## Common Mistakes to Catch

1. **New entity config copies from existing one but drops safety fields** — when a developer copies `procedureConfig` to create a new config, they may remove fields they think are irrelevant, accidentally dropping safety sections.

2. **Pluralization confusion** — `contraindication` (singular) vs `contraindications` (plural) vs `absoluteContraindications` + `relativeContraindications`. Make sure the grep catches all variants.

3. **JSON-stringified safety data** — some fields arrive as `string | string[]` or even nested objects. If the renderer does `JSON.stringify(field)` for a safety field, flag it — raw JSON is not a safe way to display clinical warnings.

4. **Conditional rendering hides safety content** — `{data.contraindications && detailSectionCritical(...)}` is correct, but `{showAdvanced && data.contraindications && ...}` behind a toggle is dangerous — safety content should never be behind an extra click.

## Integration with Other Skills

This skill stacks with:
- **panacea-style-system** — provides the actual rendering helpers and tier definitions
- **panacea-verify** — after making changes, verify transpilation passes
- **panacea-component-sprint** — during improvement sprints, run this review on every modified config
