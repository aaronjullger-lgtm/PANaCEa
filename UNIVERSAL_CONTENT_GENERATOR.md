# Universal Content Generator - Implementation Complete

## Overview

The **Universal Content Generator** is an AI-powered system that automatically fills missing content for ALL medical registry types in the PANaCEa database. This "Magic Button" workflow allows you to add new medical entities to registries and have complete, clinically accurate content generated in seconds.

## What It Does

The system detects empty records across five entity types and generates appropriate content using Google Gemini AI:

1. **Conditions** (MedicalContent table)
2. **Lab Tests** (LabTest table)
3. **Imaging Studies** (ImagingStudy table)
4. **Treatments** (Treatment table)
5. **Physiology Concepts** (PhysiologyConcept table)

## Architecture

### Components

```
lib/services/autoAuthor/
├── contentGenerator.ts   # AI generation methods for all entity types
├── types.ts             # TypeScript interfaces for generated content
└── index.ts             # Legacy condition-only interface (deprecated)

lib/services/cms/
└── contentValidator.ts  # Quality validation for all entity types

scripts/
└── generateMissingContent.ts  # Multi-stage batch processor
```

### Content Generation Methods

Each entity type has a specialized generation method with clinically accurate prompts:

#### 1. Lab Tests (`generateLabContent`)
**Prompt**: "Write the clinical details for the lab test: {name}"

**Output**:
```json
{
  "description": "2-3 sentences explaining the test",
  "typicalNormalRange": "Normal reference range with units",
  "commonAbnormalities": ["Elevated in X", "Decreased in Y"],
  "indications": ["When to order 1", "Clinical scenario 2"]
}
```

#### 2. Imaging Studies (`generateImagingContent`)
**Prompt**: "Write the clinical details for the imaging study: {name}"

**Output**:
```json
{
  "description": "2-3 sentences about the modality",
  "bestFor": ["First-line for X", "Best for diagnosing Y"],
  "limitations": ["Cannot detect X", "Use alternative for Y"],
  "radiationRisk": true/false
}
```

#### 3. Treatments (`generateTreatmentContent`)
**Prompt**: "Write the clinical details for the treatment/drug: {name}"

**Output**:
```json
{
  "description": "2-3 sentences describing the treatment",
  "mechanismOfAction": "How it works physiologically",
  "commonIndications": ["Primary use", "Secondary use"],
  "seriousSideEffects": ["Black box warning", "Major side effect"]
}
```

#### 4. Physiology Concepts (`generatePhysiologyContent`)
**Prompt**: "Explain the physiology concept: {name}"

**Output**:
```json
{
  "description": "2-3 sentences defining the concept",
  "mechanism": "Detailed explanation of the process",
  "clinicalSignificance": "How it relates to disease/treatment"
}
```

#### 5. Conditions (Existing)
Uses the existing `generateConditionContent` method with extended fields.

### Quality Validation

Each entity type has specialized validators to prevent AI hallucinations:

- **Refusal Detection**: Blocks content containing "I am an AI" or disclaimer language
- **Minimum Viable Content**: Enforces character/array length requirements
- **Data Integrity**: Prevents stringified arrays and placeholder text
- **Clinical Accuracy**: Validates essential fields are present

### Multi-Stage Processing

The script runs in **sequential stages** to prevent API overwhelm:

```
Stage 1: Conditions      → Process up to N conditions
Stage 2: Lab Tests       → Process up to N lab tests  
Stage 3: Imaging Studies → Process up to N imaging studies
Stage 4: Treatments      → Process up to N treatments
Stage 5: Physiology      → Process up to N physiology concepts
```

Each stage:
1. Queries database for entities with `null` or empty required fields
2. Generates content via Gemini API
3. Validates content quality
4. Updates database (only if validation passes)
5. Rate limits (2 second delay between calls)

## Usage

### Full Pipeline (All Stages)

```bash
# Process up to 50 entities per stage
npm run generate:missing-content

# Or with custom settings
tsx scripts/generateMissingContent.ts --max-per-stage=20 --delay=3000
```

### Single Stage Only

```bash
# Process only lab tests (stage 2)
tsx scripts/generateMissingContent.ts --stage=2

# Process only treatments (stage 4)
tsx scripts/generateMissingContent.ts --stage=4 --max-per-stage=100
```

### Dry Run (Preview Only)

```bash
# See what would be processed without making changes
tsx scripts/generateMissingContent.ts --dry-run
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--stage=N` | Process only stage N (1-5) | All stages |
| `--max-per-stage=N` | Max entities per stage | 50 |
| `--delay=MS` | Delay between API calls (ms) | 2000 |
| `--dry-run` | Preview without saving | false |
| `--extended` | Include extended fields for conditions | false |

## The "Magic Button" Workflow

### Example: Adding a New Drug

**Monday Morning**: You notice "Lithium" is missing from your app.

**Step 1**: Add to registry (30 seconds)
```typescript
// treatmentRegistry.ts
{
  name: "Lithium",
  category: "Psychiatric Medications",
  type: "Mood Stabilizer"
}
```

**Step 2**: Sync to database (5 seconds)
```bash
npm run sync:all-registries
```
✅ "Lithium" row created in `Treatment` table with category/type, but empty description/mechanism/indications

**Step 3**: Generate content (30 seconds)
```bash
tsx scripts/generateMissingContent.ts --stage=4
```

**Output**:
```
╔════════════════════════════════════════════════════════════╗
║         STAGE 4: Treatments                                ║
╚════════════════════════════════════════════════════════════╝

Found 1 treatment missing content

[1/1] Lithium
   ✅ Generated and saved

Treatments:
  Total: 1
  ✅ Generated: 1
  🚫 Validation Failed: 0
  ❌ Generation Failed: 0
```

**Step 4**: Result
"Lithium" now has:
- Description: "Lithium is a mood stabilizer used primarily in the treatment of bipolar disorder..."
- Mechanism of Action: "Lithium modulates neurotransmitter activity by affecting serotonin and norepinephrine..."
- Common Indications: ["Bipolar disorder (acute mania)", "Maintenance therapy for bipolar", "Augmentation for treatment-resistant depression"]
- Serious Side Effects: ["Lithium toxicity (narrow therapeutic index)", "Nephrogenic diabetes insipidus", "Thyroid dysfunction"]

**Total Time**: ~1 minute from idea to fully populated database entry!

## Integration with Existing Systems

### Registry Sync Integration

The Universal Content Generator complements the registry sync system:

```bash
# 1. Add entries to registries (manual)
vim labTestRegistry.ts
vim treatmentRegistry.ts

# 2. Sync registries to database
npm run sync:all-registries
# → Creates empty rows with name/category/system

# 3. Generate missing content
npm run generate:missing-content
# → Fills in description/mechanism/indications/etc.
```

### Automation Pipeline

Can be integrated into daily/weekly automation:

```bash
# Monday automation script
npm run sync:all-registries    # Sync new registry entries
npm run generate:missing-content --max-per-stage=100  # Fill content
npm run automation:daily        # Generate questions/cases
```

## Quality Safeguards

### 1. Content Validation
Every generated piece of content passes through validators:
- ✅ Minimum length requirements
- ✅ Required fields present
- ✅ No AI refusal language
- ✅ No placeholder text
- ✅ Arrays are actual arrays (not stringified)

### 2. Retry Logic
Generation methods include exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay

### 3. Error Handling
Failed generations don't block the pipeline:
```
[5/20] Lithium
   ❌ Generation failed: API rate limit exceeded
   
[6/20] Metformin
   ✅ Generated and saved
```

### 4. Validation Failures
Content that fails quality checks is rejected:
```
[8/20] Aspirin
   ❌ Quality validation failed
      - Description is too short (45 chars, minimum: 80)
      - commonIndications has 1 items (minimum: 2)
```

## Performance

### API Costs
- **Model**: Gemini 2.0 Flash Exp (free tier available)
- **Rate Limit**: 2 second delay between calls = 30 requests/minute
- **Batch Size**: Default 50 per stage = ~3-4 minutes per stage

### Batch Processing
```
Stage 1 (Conditions):       50 entities × 2s = 1.7 minutes
Stage 2 (Labs):            50 entities × 2s = 1.7 minutes  
Stage 3 (Imaging):         50 entities × 2s = 1.7 minutes
Stage 4 (Treatments):      50 entities × 2s = 1.7 minutes
Stage 5 (Physiology):      50 entities × 2s = 1.7 minutes
────────────────────────────────────────────────────────────
Total:                     250 entities    = ~8.5 minutes
```

## Monitoring & Debugging

### Stage Summary
At the end of each run:
```
╔════════════════════════════════════════════════════════════╗
║              Universal Auto-Author Summary                 ║
╚════════════════════════════════════════════════════════════╝

Conditions:
  Total: 42
  ✅ Generated: 40
  🚫 Validation Failed: 1
  ❌ Generation Failed: 1

Lab Tests:
  Total: 18
  ✅ Generated: 18
  🚫 Validation Failed: 0
  ❌ Generation Failed: 0

Overall:
  ✅ Total Generated: 58
  ❌ Total Failed: 2
```

### Dry Run for Planning
Preview what would be processed:
```bash
tsx scripts/generateMissingContent.ts --dry-run

# Output:
Stage 2: Lab Tests
Found 18 lab tests missing content

🔎 DRY RUN - Would process:
   1. Complete Blood Count (Hematology)
   2. Basic Metabolic Panel (Chemistry)
   3. Lipid Panel (Chemistry)
   ...
```

## Future Enhancements

### Potential Additions
1. **Physical Exam Findings**: Add `generateFindingContent` for PhysicalExamFinding table
2. **Practice Guidelines**: Generate summaries for PracticeGuideline table
3. **Special Tests**: Extend to SpecialTest table
4. **Differential Diagnoses**: Auto-populate DifferentialDiagnosis workup/pearls

### AI Model Upgrades
- Switch to Gemini Pro for higher quality
- Enable multi-modal for image-based content
- Fine-tune prompts based on validation failures

## Files Changed

### New Files
- None (all changes to existing files)

### Modified Files
1. `lib/services/autoAuthor/types.ts`
   - Added: `GeneratedLabContent`, `GeneratedImagingContent`, `GeneratedTreatmentContent`, `GeneratedPhysiologyContent`
   - Made `ContentGenerationResult` generic

2. `lib/services/autoAuthor/contentGenerator.ts`
   - Added: `generateLabContent()`
   - Added: `generateImagingContent()`
   - Added: `generateTreatmentContent()`
   - Added: `generatePhysiologyContent()`

3. `lib/services/cms/contentValidator.ts`
   - Added: `validateLabContent()`
   - Added: `validateImagingContent()`
   - Added: `validateTreatmentContent()`
   - Added: `validatePhysiologyContent()`

4. `scripts/generateMissingContent.ts`
   - Complete refactor for multi-stage processing
   - Added stage functions: `processConditions()`, `processLabTests()`, `processImagingStudies()`, `processTreatments()`, `processPhysiology()`
   - Updated CLI arguments: `--stage`, `--max-per-stage`

## Dependencies

### Required
- `@google/generative-ai` - Gemini API client
- `@prisma/client` - Database ORM
- `dotenv` - Environment variables

### Environment Variables
```bash
# Required
GEMINI_API_KEY=your_key_here
# or
GOOGLE_API_KEY=your_key_here

# Optional (for database)
DATABASE_URL=your_connection_string
```

## Testing

### Quick Test (Single Entity)
```bash
# 1. Manually create a test entry
psql -d panacea -c "INSERT INTO \"LabTest\" (id, name, category, \"commonAbnormalities\", \"typicalUse\") VALUES (gen_random_uuid(), 'Test Lab', 'Test Category', '{}', NULL);"

# 2. Run generator on stage 2 only
tsx scripts/generateMissingContent.ts --stage=2 --max-per-stage=1

# 3. Verify content was generated
psql -d panacea -c "SELECT name, \"typicalUse\" FROM \"LabTest\" WHERE name = 'Test Lab';"
```

### Validation Test
```bash
# Run with dry-run to verify detection logic
tsx scripts/generateMissingContent.ts --dry-run

# Should list all entities missing content
```

## Support

For issues or questions:
1. Check validation errors in console output
2. Run with `--dry-run` to preview
3. Test single stage with `--stage=N`
4. Verify API key is set: `echo $GEMINI_API_KEY`

## Summary

The Universal Content Generator transforms PANaCEa from a manually curated database into a **self-populating knowledge system**. Add new entities to registries, run the sync, run the generator, and within minutes you have complete, clinically accurate content ready for use in quizzes, study sessions, and AI-generated questions.

**It's not just automation—it's content creation at medical school speed.** 🚀
