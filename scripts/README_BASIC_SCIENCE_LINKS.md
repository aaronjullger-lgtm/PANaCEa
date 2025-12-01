# Basic Science Links Generation

This document describes the scripts for generating basic science links that connect clinical scenarios to foundational basic science concepts.

## Overview

The basic science link generation system enhances clinical and lab cases by automatically adding references to foundational medical concepts that students should review to understand the underlying pathophysiology.

## What Gets Generated

For each case (clinical or lab), the system generates up to 3 basic science concept links:

```typescript
interface BasicScienceLink {
  title: string;      // e.g., "Review: Insulin Signaling"
  conceptId: string;  // e.g., "insulin-signaling"
}
```

### Example Output

For a case with diagnosis "Diabetic Ketoacidosis (DKA)", the system might generate:

```json
{
  "id": "lab_case_1",
  "correctDiagnosis": "Diabetic Ketoacidosis (DKA)",
  "clinicalVignette": "...",
  "labs": { ... },
  "basicScienceLinks": [
    {
      "title": "Review: Insulin Signaling",
      "conceptId": "insulin-signaling"
    },
    {
      "title": "Review: Ketone Body Metabolism",
      "conceptId": "ketone-body-metabolism"
    },
    {
      "title": "Review: Acid-Base Balance",
      "conceptId": "acid-base-balance"
    }
  ]
}
```

## Scripts

### 1. Test Script (Recommended First Step)

Test the generation with a small sample (3 cases of each type):

```bash
export GEMINI_API_KEY="your-api-key-here"
npm run test:basic-science-links
```

**What it does:**
- Processes 3 clinical cases and 3 lab cases
- Generates basic science links for each
- Saves output to `/tmp/basic-science-test/`
- Shows detailed progress and results

**Output files:**
- `/tmp/basic-science-test/clinicalCases-test.json`
- `/tmp/basic-science-test/labCases-test.json`

**Use this to:**
- Validate the API key works
- Check the quality of generated links
- Verify the script logic before processing all cases

### 2. Full Generation Script

Generate links for all 500 cases:

```bash
export GEMINI_API_KEY="your-api-key-here"
npm run generate:basic-science-links
```

**What it does:**
- Reads all clinical cases from `src/data/clinicalCases.json`
- Reads all lab cases from `src/data/labCases.json`
- Generates basic science links for each case
- Overwrites the original JSON files with updated data

**Processing details:**
- Processes cases in batches of 10
- 2-second delay between batches for rate limiting
- Handles errors gracefully (returns empty array on failure)
- Maintains existing case structure

**Time estimate:**
- ~5-10 minutes for 500 cases
- Depends on API response time

## API Requirements

You need a Google Gemini API key:

1. Get your key at: https://aistudio.google.com/app/apikey
2. Set the environment variable:
   ```bash
   export GEMINI_API_KEY="your-key-here"
   # OR
   export GOOGLE_API_KEY="your-key-here"
   ```

The script uses the `gemini-2.0-flash-exp` model by default.

## Data Structure

### Before

```json
{
  "id": "clinical_case_1",
  "correctDiagnosis": "Subarachnoid Hemorrhage",
  "vignette": "...",
  "presentationClues": [...]
}
```

### After

```json
{
  "id": "clinical_case_1",
  "correctDiagnosis": "Subarachnoid Hemorrhage",
  "vignette": "...",
  "presentationClues": [...],
  "basicScienceLinks": [
    {
      "title": "Review: Circle of Willis",
      "conceptId": "circle-of-willis"
    },
    {
      "title": "Review: Cerebral Autoregulation",
      "conceptId": "cerebral-autoregulation"
    }
  ]
}
```

## Concept Selection Logic

The AI model focuses on:
- **Fundamental physiological processes** (e.g., RAAS, insulin signaling)
- **Key biochemical pathways** (e.g., glycolysis, ketone metabolism)
- **Important anatomical structures** (e.g., coronary circulation)
- **Core pathophysiological mechanisms** (e.g., inflammatory cascade)

The system prioritizes the most relevant and foundational concepts for each diagnosis.

## Quality Assurance

### Validation
- Each generated link must have both `title` and `conceptId`
- Links are limited to maximum 3 per case
- Invalid responses return empty array (non-blocking)

### Error Handling
- API errors are logged but don't stop processing
- Cases that fail to generate links get empty array
- Batch processing continues even if individual cases fail

### Output Verification
After generation, check:
- Files are valid JSON
- All cases have the new field (even if empty)
- Link structure is consistent
- Concept IDs use kebab-case format

## Customization

### Change Batch Size
Edit `scripts/generateBasicScienceLinks.ts`:
```typescript
const BATCH_SIZE = 10; // Adjust as needed
```

### Change Rate Limit Delay
```typescript
const DELAY_BETWEEN_BATCHES = 2000; // milliseconds
```

### Change Model
```typescript
const MODEL_NAME = "gemini-2.0-flash-exp"; // or "gemini-2.5-pro"
```

## Troubleshooting

### "GEMINI_API_KEY is not set"
Make sure to export the environment variable:
```bash
export GEMINI_API_KEY="your-key-here"
echo $GEMINI_API_KEY  # Verify it's set
```

### Rate Limit Errors
If you hit rate limits:
1. Increase `DELAY_BETWEEN_BATCHES` (e.g., to 5000ms)
2. Decrease `BATCH_SIZE` (e.g., to 5)
3. Run the script again - it will overwrite with new data

### JSON Parse Errors
The script automatically cleans markdown code blocks. If errors persist:
1. Check console output for problematic responses
2. Try running again - occasional API hiccups happen
3. Switch to `gemini-2.5-pro` for more consistent formatting

### Empty Links Array
If a case has an empty `basicScienceLinks` array:
- Check if the diagnosis is clear and specific
- Verify API key is valid and has quota remaining
- Check console for error messages

## Integration

### TypeScript Types
The types are defined in `src/types/content.ts`:
```typescript
interface BasicScienceLink {
  title: string;
  conceptId: string;
}

interface ClinicalCase {
  // ... existing fields
  basicScienceLinks?: BasicScienceLink[];
}

interface LabCase {
  // ... existing fields
  basicScienceLinks?: BasicScienceLink[];
}
```

### Using in Code
```typescript
import clinicalCases from '@/src/data/clinicalCases.json';

// Access basic science links
const caseLinks = clinicalCases[0].basicScienceLinks || [];

// Filter cases with specific concepts
const casesWithRAAS = clinicalCases.filter(c => 
  c.basicScienceLinks?.some(link => 
    link.conceptId.includes('raas')
  )
);
```

## Workflow

Recommended workflow for generating basic science links:

1. **Test first**
   ```bash
   npm run test:basic-science-links
   ```
   Review output in `/tmp/basic-science-test/`

2. **Generate full dataset**
   ```bash
   npm run generate:basic-science-links
   ```

3. **Verify results**
   - Check file sizes are reasonable
   - Spot-check random cases for quality
   - Validate JSON structure

4. **Commit changes**
   ```bash
   git add src/data/clinicalCases.json src/data/labCases.json
   git commit -m "Add basic science links to all cases"
   ```

## Notes

- **Backward compatibility**: The `basicScienceLinks` field is optional
- **Re-running**: The script overwrites existing files completely
- **Version control**: Always commit before running to allow rollback
- **API costs**: ~500 API calls total (250 clinical + 250 lab)
- **Idempotency**: Running multiple times generates different links (non-deterministic)

## Support

For issues or questions:
- Check this README first
- Review script console output for errors
- Test with small sample using `test:basic-science-links`
- Verify API key and model availability

---

**Ready to generate basic science links?**

```bash
export GEMINI_API_KEY="your-key"
npm run test:basic-science-links  # Start here!
```
