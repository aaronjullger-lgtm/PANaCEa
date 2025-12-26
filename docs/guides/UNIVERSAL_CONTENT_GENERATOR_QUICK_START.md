# Universal Content Generator - Quick Start

## 🎯 What This Does

Automatically generates complete medical content for **all registry types** using AI. Add an entry to any registry, sync it, then run the generator to fill in all the clinical details.

## ⚡ Quick Commands

### Generate All Missing Content
```bash
npm run generate:missing-content
```

### Process Single Registry Type
```bash
# Labs only (stage 2)
tsx scripts/generateMissingContent.ts --stage=2

# Treatments only (stage 4)
tsx scripts/generateMissingContent.ts --stage=4

# Physiology only (stage 5)
tsx scripts/generateMissingContent.ts --stage=5
```

### Preview What Would Be Generated
```bash
npm run generate:missing-content -- --dry-run
```

### Customize Processing
```bash
# Process 100 items per stage with 3 second delays
tsx scripts/generateMissingContent.ts --max-per-stage=100 --delay=3000
```

## 📋 Stage Numbers

| Stage | Registry Type | Generates |
|-------|--------------|-----------|
| 1 | Conditions | Overview, symptoms, diagnosis, treatment |
| 2 | Lab Tests | Description, normal range, abnormalities |
| 3 | Imaging Studies | Description, indications, limitations |
| 4 | Treatments | Description, mechanism, side effects |
| 5 | Physiology | Description, mechanism, clinical significance |

## 🔄 The Complete Workflow

### Example: Adding "Lithium" to the Database

```bash
# 1. Add to registry (manual edit)
# Edit treatmentRegistry.ts:
# { name: "Lithium", category: "Psychiatric", type: "Mood Stabilizer" }

# 2. Sync registries to database
npm run sync:all-registries

# 3. Generate missing content
npm run generate:missing-content

# Done! "Lithium" now has complete clinical details
```

## ⚙️ Options

| Flag | Description | Default |
|------|-------------|---------|
| `--stage=N` | Process only stage N (1-5) | All stages |
| `--max-per-stage=N` | Max items per stage | 50 |
| `--delay=MS` | Delay between API calls | 2000ms |
| `--dry-run` | Preview without saving | false |
| `--extended` | Include extended fields (conditions only) | false |

## 📊 Output Example

```
╔════════════════════════════════════════════════════════════╗
║    Universal Auto-Author: Multi-Registry Content Pipeline ║
╚════════════════════════════════════════════════════════════╝

Configuration:
  Stage Filter: All stages (1-5)
  Max Per Stage: 50
  Delay (ms): 2000

╔════════════════════════════════════════════════════════════╗
║         STAGE 2: Lab Tests                                 ║
╚════════════════════════════════════════════════════════════╝

Found 18 lab tests missing content

[1/18] Complete Blood Count
   ✅ Generated and saved
[2/18] Basic Metabolic Panel
   ✅ Generated and saved
...

Lab Tests:
  Total: 18
  ✅ Generated: 18
  🚫 Validation Failed: 0
  ❌ Generation Failed: 0
```

## 🔐 Environment Setup

Required environment variable:
```bash
export GEMINI_API_KEY=your_api_key_here
# or
export GOOGLE_API_KEY=your_api_key_here
```

## 🚦 Quality Safeguards

Every piece of generated content:
- ✅ Passes minimum length requirements
- ✅ Has all required fields
- ✅ Contains no AI refusal language
- ✅ Contains no placeholder text
- ✅ Uses proper data types (arrays, not strings)

Failed content is **automatically rejected** and logged.

## 🐛 Troubleshooting

### No content generated
```bash
# Check what would be processed
tsx scripts/generateMissingContent.ts --dry-run
```

### API rate limits
```bash
# Increase delay between requests
tsx scripts/generateMissingContent.ts --delay=5000
```

### Process smaller batches
```bash
# Process only 10 items per stage
tsx scripts/generateMissingContent.ts --max-per-stage=10
```

### Check API key
```bash
echo $GEMINI_API_KEY
# Should output your key
```

## 📝 Integration with Registry Sync

Complete workflow for new entries:

```bash
# Step 1: Add entries to registries (manual editing)
vim labTestRegistry.ts
vim treatmentRegistry.ts
vim physiologyRegistry.ts

# Step 2: Sync registries to database (creates empty rows)
npm run sync:all-registries

# Step 3: Fill in content with AI
npm run generate:missing-content

# Result: Complete entries with all clinical details populated
```

## ⏱️ Performance

- **Speed**: ~2 seconds per entity (rate limiting)
- **Batch**: 50 entities per stage = ~1.7 minutes per stage
- **Full run**: All 5 stages = ~8-10 minutes for 250 entities

## 🎓 What Gets Generated

### Lab Tests
- Description of what the test measures
- Normal reference ranges
- Common abnormalities and their clinical meaning
- When to order the test

### Imaging Studies
- What the modality visualizes
- Best clinical indications
- Limitations and contraindications
- Radiation risk (yes/no)

### Treatments
- Description of the treatment
- Mechanism of action
- Common clinical indications
- Serious side effects to monitor

### Physiology
- Definition of the concept
- Underlying mechanism/pathway
- Clinical significance for diagnosis/treatment

### Conditions (existing)
- Overview and pathophysiology
- Symptoms and risk factors
- Diagnosis and treatment
- Clinical pearls for PANCE

## 🔗 Related Scripts

- `npm run sync:all-registries` - Sync ALL registries to database
- `npm run automation:daily` - Daily content generation pipeline
- `npm run health-check` - Validate content quality

## 📖 Full Documentation

See `UNIVERSAL_CONTENT_GENERATOR.md` for complete implementation details.
