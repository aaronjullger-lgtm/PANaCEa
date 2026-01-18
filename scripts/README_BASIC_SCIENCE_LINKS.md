# Basic Science Links Generation

This document describes the scripts for generating basic science links that connect clinical scenarios to foundational basic science concepts.

## Overview

The basic science link generation system enhances clinical and lab cases by automatically adding references to foundational medical concepts that students should review to understand the underlying pathophysiology.

## What Gets Generated

For each case (clinical or lab), the system generates up to 3 basic science concept links:

```typescript
interface BasicScienceLink {
  title: string; // e.g., "Review: Insulin Signaling"
  conceptId: string; // e.g., "insulin-signaling"
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

### 2. Incremental Generation Script (Recommended)

Generate links for all 500 cases with automatic resume:

```bash
export GEMINI_API_KEY="your-api-key-here"
npm run generate:basic-science-links:incremental
```

**What it does:**

- Reads all clinical cases from `src/data/clinicalCases.json`
- Reads all lab cases from `src/data/labCases.json`
- Generates basic science links only for cases that don't have them yet
- Saves progress incrementally every 10 cases
- Can be safely stopped and restarted - will resume from where it left off

**Processing details:**

- Respects API rate limit: 8 requests/minute (to stay under 10/min limit)
- ~7.5 seconds delay between requests
- Saves progress every 10 cases
- Skips cases that already have links

**Time estimate:**

- ~60 minutes for 500 cases (due to API rate limits)
- Can be run in multiple sessions if needed

**Why use this?**

- Gemini API has a rate limit of 10 requests/minute for free tier
- This script ensures you don't hit the limit
- Can be interrupted and resumed without losing progress
- More reliable for large datasets

### 3. Fast Generation Script (Use with caution)

Generate links quickly (may hit rate limits):

```bash
export GEMINI_API_KEY="your-api-key-here"
npm run generate:basic-science-links
```

**What it does:**

- Processes cases in batches of 10
- 2-second delay between batches
- Processes all cases even if they already have links (overwrites)

**Time estimate:**

- ~5-10 minutes if no rate limits hit
- Will fail if you exceed API quota

**When to use:**

- Only for small datasets
- When you have a paid API tier with higher limits
- When regenerating all links is desired

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
const MODEL_NAME = 'gemini-2.0-flash-exp'; // or "gemini-2.5-pro"
```

## Troubleshooting

### "GEMINI_API_KEY is not set"

Make sure to export the environment variable:

```bash
export GEMINI_API_KEY="your-key-here"
echo $GEMINI_API_KEY  # Verify it's set
```

### Rate Limit Errors (429 Too Many Requests)

**Best solution:** Use the incremental script instead:

```bash
npm run generate:basic-science-links:incremental
```

The incremental script:

- Respects the 10 requests/minute API limit
- Automatically saves progress every 10 cases
- Can be stopped and resumed at any time
- Only processes cases that don't have links yet

**Alternative:** For the fast script, if you still hit rate limits:

1. Wait for the rate limit window to reset (usually 1 minute)
2. The script will have saved some progress already
3. Manually increase delays in the script configuration

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
const casesWithRAAS = clinicalCases.filter((c) =>
  c.basicScienceLinks?.some((link) => link.conceptId.includes('raas'))
);
```

## Workflow

Recommended workflow for generating basic science links:

1. **Test first**

   ```bash
   npm run test:basic-science-links
   ```

   Review output in `/tmp/basic-science-test/`

2. **Generate full dataset (incremental)**

   ```bash
   npm run generate:basic-science-links:incremental
   ```

   This will take ~60 minutes for 500 cases. The script:
   - Shows progress for each case
   - Saves every 10 cases
   - Can be stopped with Ctrl+C and resumed later
   - Skips cases that already have links

3. **Resume if interrupted**
   If you need to stop, just run the same command again:

   ```bash
   npm run generate:basic-science-links:incremental
   ```

   It will automatically continue from where it left off.

4. **Verify results**

   ```bash
   # Check progress
   jq '[.[] | select(.basicScienceLinks != null and (.basicScienceLinks | length) > 0)] | length' src/data/clinicalCases.json
   jq '[.[] | select(.basicScienceLinks != null and (.basicScienceLinks | length) > 0)] | length' src/data/labCases.json

   # Spot-check random cases
   jq '.[42].basicScienceLinks' src/data/clinicalCases.json
   ```

5. **Commit changes**
   ```bash
   git add src/data/clinicalCases.json src/data/labCases.json
   git commit -m "Add basic science links to all cases"
   ```

## Notes

- **Backward compatibility**: The `basicScienceLinks` field is optional
- **Rate limits**: Gemini API free tier has 10 requests/minute limit
- **Processing time**: ~60 minutes for 500 cases with incremental script
- **Resume capability**: Incremental script can be stopped and restarted
- **Version control**: Always commit before running to allow rollback
- **API costs**: ~500 API calls total (250 clinical + 250 lab)
- **Idempotency**: Running multiple times generates different links (non-deterministic)
- **Best practice**: Use `generate:basic-science-links:incremental` for production use

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
npm run test:basic-science-links                    # Test with 3 cases
npm run generate:basic-science-links:incremental    # Generate all (recommended)
```
