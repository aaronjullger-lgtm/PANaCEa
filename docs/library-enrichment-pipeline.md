# Targeted RAG Library Enrichment Pipeline

## Overview

The Targeted RAG (Retrieval‑Augmented Generation) pipeline fills missing fields in the Supabase database by extracting information from a 600‑GB medical library (Google Drive sync). It uses **filename‑based PDF discovery**, **text extraction**, and **DeepSeek API** for precise field extraction, then updates the database with the extracted content.

The pipeline is designed to:

- **Prioritize** missing fields based on PANCE yield and number of gaps.
- **Ground** every extraction in authoritative medical literature (PDFs).
- **Detect conflicts** between extracted and existing values.
- **Log** every enrichment attempt for auditability and manual review.
- **Resume** safely after interruptions.

## Components

| Component | Purpose | File |
|-----------|---------|------|
| **Audit Script** | Identifies missing fields (`gold_standard_dx`, `first_line_rx`, `best_initial_test`, `overview` for MedicalContent; `mechanismOfAction`, `dosing`, `brandName`, `sideEffects`, `indications` for Drug) and outputs a prioritized JSON list. | `scripts/library‑enrichment/audit.ts` |
| **File Discovery** | Searches the local Google Drive folder for PDFs whose filename contains a condition/drug name (case‑insensitive). Uses the `find` command for speed. | `scripts/library‑enrichment/file‑discovery.ts` |
| **PDF Extraction** | Extracts text from a PDF (whole‑document or per‑page) and provides keyword‑context windows. Built on `pdf‑parse`. | `scripts/library‑enrichment/pdf‑extraction.ts` |
| **DeepSeek Integration** | Calls the DeepSeek API (`deepseek‑chat`) with a tailored prompt to extract a missing field from a given textbook excerpt. | `scripts/library‑enrichment/deepseek‑extract.ts` |
| **Enrichment Engine** | Orchestrates the full workflow: file discovery → context extraction → DeepSeek call → conflict detection → database update. | `scripts/library‑enrichment/enrichment‑engine.ts` |
| **Batch CLI** | Processes the priority list in batches, with resume capability, rate limiting, and dry‑run mode. | `scripts/library‑enrichment/library‑enrichment.ts` |
| **Logging** | JSON log of every enrichment attempt stored in `data/library‑enrichment‑log.json`. | Built into enrichment engine |

## Usage

### 1. Set Environment Variables

Create a `.env` file (or set in your shell) with:

```bash
# Required for DeepSeek API
DEEPSEEK_API_KEY=your_api_key_here
# Optional: override the default medical library path
MEDICAL_LIBRARY_PATH=/path/to/your/google/drive
```

### 2. Run the Audit

Generate the priority list of missing fields:

```bash
npx tsx scripts/library‑enrichment/audit.ts
```

Output is written to `data/library‑enrichment‑priority.json`. You can inspect this file to see which conditions/drugs will be enriched.

### 3. Dry‑Run the Pipeline

Test the pipeline without calling the API or updating the database:

```bash
npx tsx scripts/library‑enrichment/library‑enrichment.ts --dry-run --limit=5
```

### 4. Run the Full Enrichment

Process all missing fields (will take time and consume DeepSeek API credits):

```bash
npx tsx scripts/library‑enrichment/library‑enrichment.ts --limit=10
```

To process all records, omit `--limit`.

### 5. Resume After Interruption

The pipeline automatically skips fields that are already logged (success or failure). To force reprocessing, use `--no‑resume`.

### 6. Monitor Logs

Check the enrichment log at `data/library‑enrichment‑log.json`. Each entry includes:

- `timestamp`
- `entityType`, `entityName`, `missingField`
- `status` (`success`, `failure`, `skipped`)
- `pdfPath`, `contextLength`
- `extractedValue`, `existingValue`
- `conflictDetected`, `similarityScore`
- `error` (if any)

## Configuration

### Medical Library Path

By default the pipeline looks for PDFs in the user’s Google Drive folder:

```
/Users/aaronullger/Library/CloudStorage/GoogleDrive‑aaronjullger@gmail.com
```

Override via the `MEDICAL_LIBRARY_PATH` environment variable.

### DeepSeek Model

Default model is `deepseek‑chat`. Change via `DEEPSEEK_MODEL` environment variable.

### Rate Limiting

The batch CLI inserts a 5‑second delay between records and a 1‑second delay between fields within the same record. Adjust by editing the constants in `library‑enrichment.ts` and `enrichment‑engine.ts`.

### Conflict Detection Threshold

Conflict detection uses a simple word‑overlap similarity score. If similarity < 0.7, a conflict is flagged. This threshold can be adjusted in `enrichment‑engine.ts` (`detectConflict` function).

## Prompts

The prompt sent to DeepSeek is constructed in `deepseek‑extract.ts`. It includes:

- Entity name and missing field
- Description of what the field should contain
- Existing known values (for context)
- The textbook excerpt (context window)

The model is instructed to output **only the extracted value** (or `NOT_FOUND` if the information is absent).

## Error Handling

- **No PDFs found**: The enrichment is skipped and logged with status `skipped`.
- **PDF text extraction failure**: The record is skipped (log status `failure`).
- **DeepSeek API failure**: Retry logic is not implemented; the failure is logged and the pipeline moves to the next field.
- **Database update failure**: The error is logged and the pipeline continues.

## Integration with Existing Enrichment System

This pipeline is complementary to the existing Gemini‑based enrichment (`scripts/content‑enrichment.ts`). Key differences:

| Aspect | Gemini Enrichment | Library‑Based RAG |
|--------|-------------------|-------------------|
| **Source** | Generative AI (no grounding) | Medical textbook excerpts |
| **Use case** | Fill missing fields when no literature is available | Fill missing fields **with citations** |
| **Cost** | Gemini API cost | DeepSeek API cost + local PDF processing |
| **Output** | May contain hallucinations | Grounded in actual textbooks |

## Maintenance

### Adding New Fields

To extend the pipeline to other missing fields:

1. Add the field to `MEDICAL_CONTENT_FIELDS` or `DRUG_FIELDS` in `audit.ts`.
2. Define an adequacy standard in `ADEQUACY_STANDARDS` (minChars/minItems).
3. Add a field description in `fieldDescriptions` in `deepseek‑extract.ts`.
4. Add keyword synonyms in `fieldKeywords` in `enrichment‑engine.ts`.

### Updating the PDF Library

The pipeline expects the medical library to be a local mirror of Google Drive. Ensure new PDFs are synced to the same folder structure.

### Monitoring Costs

DeepSeek API charges per token. Each enrichment uses about 500‑1000 tokens (depending on context length). Monitor usage via DeepSeek dashboard.

## Troubleshooting

### “No PDFs found” for a condition

- Verify the PDF exists in the library path.
- Check that the filename contains the condition name (case‑insensitive).
- Try a broader search term (e.g., “Urinary” instead of “Urinary Retention”).

### DeepSeek returns “NOT_FOUND”

- The context window may not contain the required information.
- Consider increasing the context window size (default 15 lines) or using a longer excerpt.
- The textbook may not cover that specific field.

### Conflict detected but extraction seems correct

Adjust the similarity threshold in `detectConflict`.

### Database update fails with Prisma error

Check that the field name matches the Prisma schema exactly. Ensure the extracted value matches the column type (string, array, etc.).

## Future Enhancements

- **Multi‑PDF voting**: When multiple PDFs are found, extract from each and vote on the most consistent answer.
- **Citation tracking**: Store the PDF filename and page number alongside the extracted value.
- **Human‑in‑the‑loop**: Flag conflicts for manual review via a dashboard.
- **Vector search**: Use embeddings to find the most relevant passage instead of keyword search.

## Related Documentation

- [Content Enrichment System](CONTENT_ENRICHMENT_SYSTEM.md) – Gemini‑based enrichment.
- [V2 Architecture Proposal](plans/v2_architecture_proposal.md) – Missing‑field audit percentages.
- [PDF Processing Pipeline](docs/archive/IMPLEMENTATION_COMPLETE_PHASE_3_4.md) – Background on `pdf‑parse` integration.