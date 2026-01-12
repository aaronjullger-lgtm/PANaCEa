# Content Enrichment System

## Overview

The Content Enrichment System provides tools for auditing and filling gaps in the MedicalContent database. It uses AI (Google Gemini) to generate missing fields and determines optimal display priority for each condition based on its most recognizable features.

## Components

### 1. Content Audit API (`/api/admin/content-audit`)

**GET** - Admin-only endpoint that analyzes content completeness.

```bash
# Basic audit
GET /api/admin/content-audit

# Filter by system
GET /api/admin/content-audit?system=Cardiovascular

# Limit results
GET /api/admin/content-audit?limit=50
```

**Response includes:**
- `totalConditions`: Total count
- `fullyComplete`: Count of 100% complete conditions
- `partiallyComplete`: Count with only high-yield fields missing
- `criticalMissing`: Count missing required fields
- `byField`: Per-field completion statistics
- `incompleteConditions`: Array of incomplete conditions with details
- `topPriorityToFix`: Top 50 priority conditions to enrich

### 2. AI Enrichment API (`/api/admin/enrich-condition`)

**POST** - Admin-only endpoint that uses Gemini AI to fill missing fields.

```json
POST /api/admin/enrich-condition
{
  "conditionId": "acute-mi",
  "fieldsToEnrich": ["buzzwords", "clinical_pearls"], // Optional
  "forceRegenerate": false // Optional
}
```

**Response includes:**
- `conditionId`: The enriched condition
- `fieldsUpdated`: Array of fields that were updated
- `displayPriority`: AI-determined display priority configuration
- `success`: Boolean success status

### 3. CLI Script (`scripts/content-enrichment.ts`)

Batch processing tool for content enrichment.

```bash
# Run audit only
npx ts-node scripts/content-enrichment.ts --audit

# Enrich top 10 priority conditions
npx ts-node scripts/content-enrichment.ts --enrich

# Enrich top 50 conditions
npx ts-node scripts/content-enrichment.ts --enrich --limit 50

# Filter by system
npx ts-node scripts/content-enrichment.ts --enrich --system Cardiovascular

# Filter by condition name
npx ts-node scripts/content-enrichment.ts --condition "Acute MI"
```

## Field Categories

### Required Fields (60% weight)
These MUST have content for a condition to be considered complete:
- `overview`
- `symptoms`
- `treatment`
- `diagnostics`

### High-Yield Fields (40% weight)
These should ideally have content or explicit N/A:
- `gold_standard_dx`
- `first_line_rx`
- `buzzwords`
- `classic_patient`
- `clinical_pearls`
- `best_initial_test`
- `classic_triad`
- `pathophysiology`
- `etiology`
- `epidemiology`
- `physicalExam`
- `riskFactors`
- `complications`
- `prognosis`
- `differentialDiagnosis`
- `mnemonic`

## Display Priority System

Each condition can have a `display_priority` object stored in the `content` JSONB field:

```json
{
  "display_priority": {
    "primary": "buzzwords",
    "secondary": "classic_patient",
    "tertiary": "gold_standard_dx",
    "reasoning": "Endometriosis is best recognized by pathognomonic buzzwords like 'chocolate cyst'"
  }
}
```

### Priority Options
- `classic_triad` - Condition has a pathognomonic triad (e.g., Beck's triad)
- `buzzwords` - Best recognized by specific buzzwords
- `classic_patient` - Patient demographics are key identifiers
- `gold_standard_dx` - Diagnostic test is the defining feature
- `physical_exam` - Specific exam findings are pathognomonic
- `mnemonic` - A mnemonic is the best memory aid

### Auto-Inference Logic
If no stored priority exists, the renderer infers priority based on available data:
1. If `classic_triad` has 3+ items → primary = `classic_triad`
2. If `buzzwords` has 3+ items → primary = `buzzwords`
3. If `classic_patient` is detailed (>50 chars) → primary = `classic_patient`
4. If `mnemonic` exists → primary = `mnemonic`
5. Default → primary = `gold_standard_dx`

## Usage Workflow

### Initial Audit
```bash
# See current content completeness
npx ts-node scripts/content-enrichment.ts --audit
```

### Prioritized Enrichment
```bash
# Enrich high-yield conditions first
npx ts-node scripts/content-enrichment.ts --enrich --limit 20

# Check progress
npx ts-node scripts/content-enrichment.ts --audit
```

### Targeted Enrichment
```bash
# Focus on specific system
npx ts-node scripts/content-enrichment.ts --enrich --system Cardiovascular --limit 30

# Enrich specific condition
npx ts-node scripts/content-enrichment.ts --condition "Cardiac Tamponade"
```

## Renderer Integration

The `ConditionMasterEmbedded` component in `ClinicalReferenceLibrary.tsx` automatically:
1. Checks for stored `display_priority` in content JSONB
2. Falls back to inference logic if not present
3. Orders the "quick facts" section based on priority
4. Highlights the primary recognition feature prominently

## Environment Variables

Required for AI enrichment:
```bash
GEMINI_API_KEY=your-api-key
```

## Rate Limiting

The CLI script has built-in rate limiting:
- 1.5 second delay between API calls
- Prevents hitting Gemini rate limits

## Security

Both API endpoints require:
1. Valid Clerk authentication
2. User role of `ADMIN` or `SUPERADMIN` (checked from database)

## Best Practices

1. **Run audit first** - Always audit before bulk enrichment
2. **Start small** - Test with `--limit 5` before larger batches
3. **Review output** - Check AI-generated content for accuracy
4. **Prioritize high-yield** - The system auto-prioritizes by `pance_yield`
5. **System-by-system** - Process one organ system at a time for consistency
