# Content Generation Guide for PANaCEa

This guide explains how to use the new content generation system for creating high-volume, medically accurate cases for Mini Modes.

## Quick Start

### 1. Get a Gemini API Key

Visit https://aistudio.google.com/app/apikey and create an API key.

### 2. Set Environment Variable

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or alternatively:
```bash
export GOOGLE_API_KEY="your-api-key-here"
```

### 3. Generate Content

```bash
# Test with small sample (2 cases each) - recommended first run
npm run generate:test

# Generate 250 lab interpretation cases (~5-10 minutes)
npm run generate:lab

# Generate 250 clinical presentation cases (~5-10 minutes)
npm run generate:clinical
```

## What Gets Generated

### Lab Cases (`src/data/labCases.json`)

250 unique cases focused on laboratory interpretation:
- **High-yield conditions**: DKA, SIADH, AKI, Liver Failure, Electrolyte disorders
- **Complete lab panels**: BMP, CBC, and LFT for each case
- **Clinical context**: Brief vignettes with patient demographics and presentation
- **Abnormal values**: Each case has 2-3+ medically plausible abnormalities
- **Flagged results**: Every lab value marked as High (H), Low (L), or Normal (N)

### Clinical Cases (`src/data/clinicalCases.json`)

250 unique cases focused on clinical presentation and pattern recognition:
- **High-yield systems**: Neurology, Musculoskeletal, Complex Cardiac
- **Detailed vignettes**: 3-4 sentence patient presentations
- **Presentation clues**: 4-6 clues per case including:
  - **Buzzwords**: Classic terminology (e.g., "thunderclap headache")
  - **Physical exam**: Specific findings (e.g., "nuchal rigidity")
  - **History**: Risk factors and context (e.g., "recent URI")

## File Structure

```
PANaCEa/
├── src/
│   ├── types/
│   │   └── content.ts              # TypeScript interfaces
│   └── data/
│       ├── README.md               # Usage examples
│       ├── labCases.json           # Generated lab cases
│       └── clinicalCases.json      # Generated clinical cases
├── scripts/
│   ├── README_CONTENT_GENERATION.md  # Detailed script documentation
│   ├── generateLabContent.ts       # Lab case generator
│   ├── generateClinicalContent.ts  # Clinical case generator
│   └── testContentGeneration.ts    # Test script
└── CONTENT_GENERATION_GUIDE.md     # This file
```

## TypeScript Interfaces

All generated content conforms to these interfaces:

```typescript
// Lab Case
interface LabCase {
  id: string;
  correctDiagnosis: string;
  clinicalVignette: string;
  labs: {
    BMP: LabValue[];
    CBC: LabValue[];
    LFT: LabValue[];
  };
}

// Clinical Case
interface ClinicalCase {
  id: string;
  correctDiagnosis: string;
  vignette: string;
  presentationClues: PresentationClue[];
}
```

See `src/types/content.ts` for complete definitions.

## Using Generated Content in Code

### Example: Lab Cases

```typescript
import type { LabCase } from '@/src/types/content';
import labCases from '@/src/data/labCases.json';

// Get all DKA cases
const dkaCases = labCases.filter(c => 
  c.correctDiagnosis.includes('Diabetic Ketoacidosis')
);

// Find cases with hyperkalemia
const hyperkalemicCases = labCases.filter(c =>
  c.labs.BMP.some(lab => 
    lab.name === 'Potassium' && lab.flag === 'H'
  )
);

// Quiz mode example
function presentLabCase(labCase: LabCase) {
  console.log(labCase.clinicalVignette);
  console.log('\nBMP:', labCase.labs.BMP);
  console.log('CBC:', labCase.labs.CBC);
  console.log('LFT:', labCase.labs.LFT);
  // Ask user for diagnosis...
}
```

### Example: Clinical Cases

```typescript
import type { ClinicalCase } from '@/src/types/content';
import clinicalCases from '@/src/data/clinicalCases.json';

// Get all stroke cases
const strokeCases = clinicalCases.filter(c =>
  c.correctDiagnosis.includes('Stroke')
);

// Get all buzzwords across cases
const allBuzzwords = clinicalCases.flatMap(c =>
  c.presentationClues
    .filter(clue => clue.type === 'buzzword')
    .map(clue => clue.description)
);

// Quiz mode example
function presentClinicalCase(clinicalCase: ClinicalCase) {
  console.log(clinicalCase.vignette);
  console.log('\nPresentation Clues:');
  clinicalCase.presentationClues.forEach(clue => {
    console.log(`[${clue.type}] ${clue.description}`);
  });
  // Ask user for diagnosis...
}
```

## Customization

### Modify Generation Parameters

Edit the constants at the top of each script:

```typescript
// scripts/generateLabContent.ts or generateClinicalContent.ts

const MODEL_NAME = "gemini-2.0-flash-exp";  // Change model
const TARGET_CASES = 250;                    // Change quantity
const BATCH_SIZE = 25;                       // Cases per batch
const DELAY_BETWEEN_BATCHES = 2000;          // Rate limit delay (ms)
```

### Add More High-Yield Conditions

Edit the condition arrays in the scripts:

```typescript
// scripts/generateLabContent.ts
const HIGH_YIELD_CONDITIONS = [
  "Diabetic Ketoacidosis (DKA)",
  "SIADH",
  // Add your conditions here...
];
```

## Troubleshooting

### "GEMINI_API_KEY is not set"

```bash
# Make sure to export the variable
export GEMINI_API_KEY="your-key-here"

# Verify it's set
echo $GEMINI_API_KEY
```

### Rate Limit Errors

If you hit rate limits:
1. Increase `DELAY_BETWEEN_BATCHES` (e.g., to 5000ms)
2. Decrease `BATCH_SIZE` (e.g., to 10)
3. Run the script again - it will append to existing data

### JSON Parse Errors

The scripts automatically clean up markdown code blocks from Gemini's response. If you still get errors:
1. Check the console output for the problematic response
2. Try running again - occasional API hiccups happen
3. Consider switching to `gemini-2.5-pro` for more consistent formatting

## Quality Assurance

Both scripts implement:
- ✅ JSON structure validation
- ✅ Required field checking
- ✅ Medical accuracy (conditions match lab/presentation patterns)
- ✅ Batch processing with progress tracking
- ✅ Error handling with detailed logs

## Notes

- **Generation time**: ~5-10 minutes per script (depends on API response time)
- **Parallel execution**: Both scripts can run simultaneously if needed
- **File output**: Files are formatted with 2-space indentation for readability
- **Git tracking**: Generated JSON files should be committed to the repository
- **Testing**: Always run `npm run generate:test` first to verify API key and connectivity

## Support

For detailed documentation:
- **Script details**: `scripts/README_CONTENT_GENERATION.md`
- **Usage examples**: `src/data/README.md`
- **Type definitions**: `src/types/content.ts`

## Security

✅ **CodeQL Analysis**: No vulnerabilities detected  
✅ **API Key Safety**: Keys are only read from environment variables, never hardcoded  
✅ **Input Validation**: All generated content is validated before saving

---

**Ready to generate content?**

```bash
export GEMINI_API_KEY="your-key"
npm run generate:test  # Start here!
```
