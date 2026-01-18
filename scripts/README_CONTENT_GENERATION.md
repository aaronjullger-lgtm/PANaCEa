# Content Generation Scripts

This directory contains automated scripts for generating high-volume, medically accurate case content for the PANaCEa application's Mini Modes.

## Overview

These scripts use the Gemini API to generate:

- **Lab Cases**: 250 unique cases focused on laboratory interpretation
- **Clinical Cases**: 250 unique cases focused on clinical presentation and differential diagnosis

## Prerequisites

1. **Gemini API Key**: You need a valid Gemini API key
   - Get your key from: https://aistudio.google.com/app/apikey
   - Set as environment variable:
     ```bash
     export GEMINI_API_KEY="your-api-key-here"
     ```
   - Or use:
     ```bash
     export GOOGLE_API_KEY="your-api-key-here"
     ```

2. **Dependencies**: All required packages are already in `package.json`
   ```bash
   npm install
   ```

## Usage

### Generate Lab Cases

Generate 250 unique lab interpretation cases:

```bash
npm run generate:lab
```

**Output**: `/src/data/labCases.json`

**Features**:

- Focuses on high-yield conditions (DKA, SIADH, AKI, Liver Failure, etc.)
- Each case includes BMP, CBC, and LFT panels
- Minimum 2-3 medically plausible abnormal values per case
- Brief clinical vignette with patient demographics and presentation
- Generates in batches of 25 to handle rate limits

### Generate Clinical Cases

Generate 250 unique clinical presentation cases:

```bash
npm run generate:clinical
```

**Output**: `/src/data/clinicalCases.json`

**Features**:

- Focuses on high-yield systems: Neurology, Musculoskeletal, Complex Cardiac
- Each case includes 4-6 presentation clues (buzzwords, physical exam, history)
- Detailed clinical vignette (3-4 sentences)
- Emphasizes pattern recognition and differential diagnosis skills
- Generates in batches of 25 to handle rate limits

## Generated Data Structure

### Lab Case (`LabCase`)

```typescript
{
  id: string;                    // Unique identifier (e.g., "lab_case_1")
  correctDiagnosis: string;      // The diagnosis (e.g., "Diabetic Ketoacidosis")
  clinicalVignette: string;      // Patient presentation (2-3 sentences)
  labs: {
    BMP: LabValue[];            // Basic Metabolic Panel
    CBC: LabValue[];            // Complete Blood Count
    LFT: LabValue[];            // Liver Function Tests
  }
}

// LabValue structure:
{
  name: string;                 // Lab test name (e.g., "Glucose")
  value: string;                // Result value (e.g., "485")
  unit: string;                 // Unit of measure (e.g., "mg/dL")
  flag: 'H' | 'L' | 'N';       // High, Low, or Normal
}
```

### Clinical Case (`ClinicalCase`)

```typescript
{
  id: string;                           // Unique identifier (e.g., "clinical_case_1")
  correctDiagnosis: string;             // The diagnosis
  vignette: string;                     // Detailed patient presentation (3-4 sentences)
  presentationClues: PresentationClue[] // 4-6 clinical clues
}

// PresentationClue structure:
{
  type: 'buzzword' | 'physical_exam' | 'history';
  description: string;                  // The specific clue
}
```

## Configuration

Both scripts can be configured by editing the constants at the top:

- `MODEL_NAME`: Gemini model to use (default: "gemini-2.0-flash-exp")
- `TARGET_CASES`: Number of cases to generate (default: 250)
- `BATCH_SIZE`: Cases per API batch (default: 25)
- `DELAY_BETWEEN_BATCHES`: Delay in ms between batches (default: 2000)

## Rate Limiting

The scripts implement the following strategies to handle API rate limits:

1. **Batch Processing**: Generates cases in batches of 25
2. **Delays**: 2-second pause between batches
3. **Error Handling**: Detailed error messages and validation
4. **Progress Tracking**: Real-time progress updates during generation

## Output Validation

Each script validates:

- JSON structure is correct
- All required fields are present
- Data types match the TypeScript interfaces
- Minimum quality standards (e.g., enough abnormal labs, enough presentation clues)

## Troubleshooting

### "GEMINI_API_KEY is not set"

```bash
export GEMINI_API_KEY="your-key-here"
```

### Rate Limit Errors

- Increase `DELAY_BETWEEN_BATCHES`
- Decrease `BATCH_SIZE`
- Run script multiple times for smaller batches

### JSON Parse Errors

- Check the console output for the problematic response
- Gemini occasionally returns markdown code blocks - the script handles this automatically
- If persistent, try using a different model or regenerating that batch

## Testing

You can test the scripts without generating full content:

1. Reduce `TARGET_CASES` to a smaller number (e.g., 10)
2. Run the script to verify API key and output format

## Integration

The generated JSON files are saved in `/src/data/` and can be imported directly:

```typescript
import labCases from '@/src/data/labCases.json';
import clinicalCases from '@/src/data/clinicalCases.json';
```

## Notes

- Generation time: ~5-10 minutes per script (depends on API speed)
- Both scripts can be run in parallel if needed
- The output files are formatted with 2-space indentation for readability
- All content is medically accurate and suitable for PANCE preparation
