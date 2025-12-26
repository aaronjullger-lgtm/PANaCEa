# Content Standardization & Quality Enhancement Guide

## Overview

This guide documents the complete workflow for standardizing and enhancing medical content in the PANaCEa database using AI-powered tools.

## Scripts

### 1. **standardize-formatting.ts** - Text Formatting & Structure
**Purpose**: Enforce consistent markdown formatting and structural standards across all conditions.

**Features**:
- ✅ Text formatting (bold, italic, lists, line breaks)
- ✅ Structural validation (minimum word counts, item counts)
- ✅ AI-powered regeneration with Gemini 2.5 Pro
- ✅ System-specific targeting
- ✅ Dry-run mode for preview

**Structural Standards**:
```typescript
{
  overview: { minWords: 50 },
  etiology: { minWords: 40 },
  pathophysiology: { minWords: 50 },
  diagnostics: { minWords: 50 },
  treatment: { minItems: 3 },
  symptoms: { minItems: 4 },
  complications: { minItems: 3 }
}
```

**Formatting Rules**:
- **Bold**: Medical abbreviations (PANCE, MI, CHF, HTN), key terms (pathognomonic, first-line, gold standard)
- *Italic*: Generic drug names (-olol, -pril, -sartan), Latin terms (in situ, in vivo), organisms (Genus species)
- Lists: Consistent bullets (- item), proper nesting (2-4 spaces)
- Line breaks: Remove excessive breaks, consistent spacing

**AI Regeneration**: When 3+ structural issues detected, automatically regenerates inadequate fields using Gemini 2.5 Pro with field-specific prompts.

---

### 2. **assess-content-adequacy.ts** - Quality Assessment
**Purpose**: Evaluate content quality using metrics derived from top-performing conditions.

**Metrics**:
- Word counts: overview, etiology, pathophysiology, diagnostics
- Item counts: treatment, symptoms, complications, buzzwords, pearls
- Completeness score: 0-100% (required fields present)
- Depth score: 0-100% (sufficient detail)
- Overall score: weighted average (60% completeness + 40% depth)

**Quality Standards** (75th percentile):
- Overview: ≥143 words
- Etiology: ≥211 words
- Pathophysiology: ≥265 words
- Diagnostics: ≥135 words
- Treatment items: ≥3
- Symptoms: ≥4
- Complications: ≥3
- Buzzwords: ≥10
- Clinical pearls: ≥3

---

### 3. **content-doctor.ts** - Field-Specific Generation
**Purpose**: Generate or regenerate specific fields using AI.

**Modes**:
- `--phase1`: Gap analysis across all fields
- `--phase2`: Generate missing content
- `--buzzwords`: Regenerate buzzwords only
- `--mnemonics`: Regenerate mnemonics only
- `--guidelines`: Regenerate guidelines only
- `--triads`: Regenerate classic triads only
- `--pearls`: Regenerate clinical pearls only

---

## Recommended Workflow

### Phase 1: Initial Assessment
```bash
# Assess current content quality
npm run assess:adequacy

# Or target specific system
npm run assess:adequacy -- --system=CV
```

### Phase 2: Standardization (Dry Run)
```bash
# Preview formatting changes
npm run standardize:formatting:dry-run

# Preview on specific system
npm run standardize:formatting:dry-run -- --system=HEENT
```

### Phase 3: Apply Standardization with AI Enhancement
```bash
# CRITICAL: Unset API key first to avoid conflicts
unset GEMINI_API_KEY

# Test on small system first (HEENT has 109 conditions)
npm run standardize:formatting:regenerate -- --system=HEENT

# Review results, then expand to medium system
npm run standardize:formatting:regenerate -- --system=CV

# Finally, run on all 1,180 conditions
npm run standardize:formatting:regenerate
```

### Phase 4: Quality Verification
```bash
# Re-assess after standardization
npm run assess:adequacy

# Check specific system
npm run assess:adequacy -- --system=CV
```

### Phase 5: Targeted Field Enhancement (if needed)
```bash
# If specific fields need improvement
npm run content-doctor:mnemonics -- --system=NEURO
npm run content-doctor:guidelines -- --system=CV
```

---

## API Key Management

### Critical: Avoid API Key Conflicts

**Problem**: Using `GEMINI_API_KEY` environment variable can cause conflicts during script execution.

**Solution**: Always unset the API key before running regeneration scripts:

```bash
# For single script run
unset GEMINI_API_KEY && npm run standardize:formatting:regenerate

# For multiple commands
unset GEMINI_API_KEY
npm run standardize:formatting:regenerate -- --system=HEENT
npm run standardize:formatting:regenerate -- --system=CV
npm run assess:adequacy:regenerate
```

**Why this works**: Scripts load the API key from `.env` file via `dotenv`, not from shell environment. Unsetting prevents conflicts.

---

## System-Specific Targeting

Target specific PANCE systems for focused improvements:

```bash
# Available systems
--system=CV          # Cardiovascular (86 conditions)
--system=PULM        # Pulmonary (87 conditions)
--system=GI          # Gastrointestinal (118 conditions)
--system=NEURO       # Neurology (76 conditions)
--system=MSK         # Musculoskeletal (92 conditions)
--system=DERM        # Dermatology (94 conditions)
--system=HEME        # Hematology (55 conditions)
--system=ENDO        # Endocrinology (57 conditions)
--system=HEENT       # Head, Eyes, Ears, Nose, Throat (109 conditions)
--system=RENAL       # Renal/Urology (71 conditions)
--system=REPRO       # Reproductive (73 conditions)
--system=PSYCH       # Psychiatry (47 conditions)
--system=ID          # Infectious Disease (80 conditions)
--system=GU          # Genitourinary (40 conditions)
```

---

## Expected Results

### HEENT System Test (109 conditions)
**Run**: `npm run standardize:formatting:regenerate -- --system=HEENT`

**Results**:
- Total conditions: 109
- Updated: 108 (99%)
- Unchanged: 1 (1%)
- AI regenerated: 6 fields (2 conditions with 3+ issues)

**Regenerated Conditions**:
1. Giant Cell Arteritis (Temporal Arteritis)
   - Overview: 43w → 101w ✅
   - Etiology: 33w → 181w ✅
   - Pathophysiology: 41w → 249w ✅

2. Thyroid Eye Disease (Graves' Ophthalmopathy)
   - Overview: 41w → enhanced ✅
   - Etiology: 33w → enhanced ✅
   - Pathophysiology: 41w → enhanced ✅

**Quality Improvements**:
- Consistent markdown formatting across all conditions
- Minimum structural standards met for critical fields
- Enhanced clinical detail where previously inadequate
- Improved readability and educational value

---

## Troubleshooting

### Issue: "GEMINI_API_KEY not set"
**Solution**: Ensure `.env` file has `GEMINI_API_KEY=your_key`. If error persists, check `.env` syntax.

### Issue: AI generation fails with rate limit
**Solution**: Script includes 1-second delay between API calls. If still failing, check Gemini API quota.

### Issue: Formatting changes seem too aggressive
**Solution**: Use `--dry-run` flag first to preview changes. Adjust `FORMATTING_RULES` in script if needed.

### Issue: Structural validation too strict
**Solution**: Adjust `STANDARD_STRUCTURE` constants in `standardize-formatting.ts`. Current thresholds are conservative.

### Issue: "Response size exceeded 5MB" error
**Solution**: Script now uses batch processing (50 conditions per batch). This error should no longer occur. If it does, reduce `BATCH_SIZE` constant in script.

---

## Performance Notes

### Batch Processing
- **Batch size**: 50 conditions per batch
- **Memory-safe**: Avoids loading all 1,180 conditions at once
- **Supabase limit**: Each batch stays well under 5MB response limit
- **Progress tracking**: Shows batch X/Y progress during execution

### Timing Estimates
- **Formatting only** (no regeneration): ~1-2 seconds per condition
- **With AI regeneration**: ~1-2 seconds per field that needs regeneration (rate limited)
- **Full database** (1,180 conditions):
  - Formatting only: ~20-40 minutes (24 batches)
  - With regeneration (estimated 50-100 conditions): ~2-3 hours

### Rate Limiting
- Gemini API calls: 1-second delay between requests
- Batch processing: Sequential to avoid overwhelming API
- Graceful error handling: Continues on failure, reports errors

---

## Next Steps

After completing standardization:

1. **Database Population** (Phase 3.2)
   - Drug database: 500+ medications
   - Lab tests: 100+ tests with reference ranges
   - Imaging: 50+ modalities with examples
   - Anatomy: Interactive structures

2. **User-Generated Content Pipeline** (Phase 3.3)
   - Question capture service
   - Quality assurance workflow
   - Admin approval interface
   - Automated publication

3. **UX Enhancements** (Phase 3.4)
   - Enhanced feedback system
   - Personalized learning paths
   - Collaborative features
   - Advanced analytics

See `PHASE_3_IMPLEMENTATION_PLAN.md` for complete roadmap.
