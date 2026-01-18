# Weekly Maintenance System

## Overview

The **Weekly Maintenance Suite** is a comprehensive automated system that ensures database content quality and quantity remain at the highest standards. It combines all critical quality checks, content generation, and standardization operations into a single unified workflow.

## Architecture

### Main Script: `weekly-maintenance.ts`

Central orchestration script that runs 7 comprehensive maintenance operations:

1. **Gap Analysis** - Identify missing/incomplete content
2. **Content Generation** - Fill critical gaps with AI-generated content
3. **Format Standardization** - Apply consistent markdown formatting
4. **Quality Assessment** - Evaluate content adequacy against benchmarks
5. **Field Enhancement** - Regenerate inadequate specific fields
6. **Structure Validation** - Ensure proper content structure
7. **Health Check** - Validate data integrity and relationships

### Integration: `automation/weeklyTasks.ts`

Existing weekly automation now calls the maintenance suite, then performs additional audit tasks:

- Content accuracy checks against medical standards
- Outdated content identification
- Performance metrics aggregation
- Improvement suggestions generation
- Weekly summary report

---

## Usage

### Run Full Maintenance (All Systems)

```bash
# Production run (makes database changes)
npm run maintenance:weekly

# Dry-run mode (preview without changes)
npm run maintenance:weekly:dry-run
```

**Expected duration**: 2-3 hours for full database (1,180 conditions)

### Run on Specific System

```bash
# Target specific PANCE system
npm run maintenance:weekly -- --system=CV
npm run maintenance:weekly -- --system=NEURO
npm run maintenance:weekly -- --system=GI
```

**Expected duration**: 10-20 minutes per system (~80-110 conditions each)

### Skip Content Generation

```bash
# Skip AI generation (faster, formatting/validation only)
npm run maintenance:weekly -- --skip-generation
```

**Expected duration**: 30-45 minutes for full database

### Verbose Output

```bash
# See detailed progress for each operation
npm run maintenance:weekly -- --verbose
```

---

## Operations Breakdown

### 1. Gap Analysis

**Purpose**: Identify missing or incomplete content across all conditions.

**Checks**:

- Total conditions in registry vs. medical content
- Missing medical content records
- Incomplete content (missing overview, pathophysiology, diagnostics, buzzwords)

**Output**:

```
📊 Gap Analysis Results:
   Total conditions: 1180
   Missing content: 42
   Incomplete content: 87
```

---

### 2. Content Generation

**Purpose**: Fill critical content gaps using AI (Gemini 2.5 Pro).

**Operations**:

- Runs `content-doctor:phase2` to generate missing content
- Creates comprehensive medical content for incomplete conditions
- Generates all required fields (overview, etiology, pathophysiology, etc.)

**Skipped if**: `--skip-generation` flag or no GEMINI_API_KEY

**Output**:

```
🤖 Running content-doctor Phase 2...
✅ Content generation complete
```

---

### 3. Format Standardization

**Purpose**: Apply consistent markdown formatting across all content.

**Formatting Rules**:

- **Bold** (`**text**`): Medical abbreviations (PANCE, MI, CHF), key terms (pathognomonic, first-line)
- _Italic_ (`*text*`): Medications (generic names), Latin terms (in situ, in vivo), organisms
- **Lists**: Consistent bullets (`- item`), proper nesting
- **Line breaks**: Remove excessive breaks, consistent spacing

**Batch Processing**: 50 conditions per batch to avoid Supabase 5MB limit

**Output**:

```
📊 Processing 1180 conditions in 24 batches...
✅ Formatting complete
   Standardized: 847
   Unchanged: 333
```

---

### 4. Quality Assessment

**Purpose**: Evaluate content adequacy against derived quality standards.

**Standards** (75th percentile benchmarks):

- Overview: ≥50 words
- Etiology: ≥40 words
- Pathophysiology: ≥50 words
- Diagnostics: ≥50 words
- Symptoms: ≥4 items
- Complications: ≥3 items
- Buzzwords: ≥4 items

**AI Regeneration**: Automatically enhances inadequate content using Gemini 2.5 Pro

**Output**:

```
📊 Quality Assessment Results:
   Total assessed: 1180
   Below standard: 156 (13.2%)
   Meeting standard: 1024 (86.8%)

🤖 Running AI regeneration for inadequate content...
✅ Regeneration complete
```

---

### 5. Field Enhancement

**Purpose**: Regenerate specific fields with significant gaps.

**Fields Monitored**:

- **Buzzwords**: Pathognomonic findings (regenerate if >10 missing)
- **Mnemonics**: Memory aids (regenerate if >50 missing)
- **Guidelines**: Clinical guidelines (regenerate if >50 missing)
- **Classic Triads**: Cardinal features (regenerate if >50 missing)
- **Clinical Pearls**: High-yield insights (regenerate if >50 missing)

**Threshold Logic**: Only regenerates fields with significant gaps to avoid unnecessary API usage

**Output**:

```
📊 Field Gap Analysis:
   Missing buzzwords: 8
   Missing mnemonics: 127
   Missing guidelines: 203

🔧 Regenerating mnemonics...
✅ Mnemonics enhanced (127 conditions)
```

---

### 6. Structure Validation

**Purpose**: Ensure all content has required fields and proper structure.

**Required Fields**:

- Overview (concise summary)
- Pathophysiology (disease mechanism)
- Diagnostics (workup and testing)

**Output**:

```
📊 Structure Validation Results:
   Total conditions: 1180
   Structural issues: 23
```

_Note_: Structural issues are typically fixed by earlier content generation and regeneration steps.

---

### 7. Health Check

**Purpose**: Validate database integrity and identify data quality issues.

**Checks**:

- Registry-to-content sync (condition count vs. medical content count)
- Orphaned records (content without matching condition in registry)
- Duplicate conditionId values
- Data consistency

**Output**:

```
✅ Registry: 1180 conditions
✅ Content: 1138 medical records
✅ No orphaned records
✅ No duplicate condition IDs

Health: ✅ PASSED
```

---

## Maintenance Report

After completion, generates comprehensive report:

```
╔════════════════════════════════════════════════════════╗
║   MAINTENANCE COMPLETE                                 ║
╚════════════════════════════════════════════════════════╝

⏱️  Duration: 127.3 minutes
📊 System: All

📈 SUMMARY:
   Gap Analysis: 42 missing, 87 incomplete
   Content Generation: 42 generated, 0 failed
   Formatting: 847 standardized, 333 unchanged
   Quality: 156 below standard, 156 regenerated
   Field Enhancement: 0 buzzwords, 127 mnemonics
   Structure: 23 issues found
   Health: ✅ PASSED
```

---

## Scheduling

### Automated Weekly Execution

The maintenance suite is automatically run weekly via `automation/weeklyTasks.ts`:

**Schedule**: Every Sunday at 2:00 AM
**Cron**: `0 2 * * 0`

### Manual Execution

For manual runs outside the scheduled time:

```bash
# Test on single system first
npm run maintenance:weekly:dry-run -- --system=HEENT

# Run on single system
npm run maintenance:weekly -- --system=CV

# Run full database (production)
npm run maintenance:weekly
```

---

## Performance Considerations

### Timing Estimates

| Operation              | Single System | Full Database |
| ---------------------- | ------------- | ------------- |
| Gap Analysis           | 1-2 min       | 3-5 min       |
| Content Generation     | 5-10 min      | 30-60 min     |
| Format Standardization | 2-3 min       | 20-30 min     |
| Quality Assessment     | 3-5 min       | 30-45 min     |
| Field Enhancement      | 2-5 min       | 15-30 min     |
| Structure Validation   | 1 min         | 3-5 min       |
| Health Check           | 30 sec        | 1-2 min       |
| **Total**              | **15-25 min** | **2-3 hours** |

### API Usage

**Gemini API Calls**:

- Rate limited: 1 second delay between requests
- Content generation: ~1-2 calls per condition
- Quality regeneration: ~1-3 calls per inadequate condition
- Field enhancement: ~1 call per field

**Estimated total calls for full database**: 200-400 API requests

### Database Load

**Batch Processing**:

- Fetch operations: 50 conditions per batch (24 batches for 1,180 conditions)
- Update operations: Individual records
- Memory-safe: Never loads entire database into memory

---

## Error Handling

### Graceful Failures

- Content generation failure: Continues to next operation
- API rate limit: Automatic 1-second delay between calls
- Database errors: Logged and reported, script continues
- Field enhancement failure: Logged, other fields still processed

### Health Check Failures

If health check reports errors:

```
⚠️  ERRORS:
   - Large gap between registry (1180) and content (1050)
   - 12 orphaned content records (no matching condition in registry)
```

**Resolution**:

1. Review error details
2. Run targeted scripts: `npm run sync:all`, `npm run db:validate`
3. Manually investigate orphaned/duplicate records
4. Re-run maintenance after fixes

---

## Best Practices

### 1. Test on Single System First

Before running on full database:

```bash
npm run maintenance:weekly:dry-run -- --system=HEENT
npm run maintenance:weekly -- --system=HEENT
```

Validate results, then scale to full database.

### 2. Run During Low-Traffic Hours

Schedule for 2-4 AM when user activity is minimal to avoid:

- Database connection saturation
- Slow query performance
- User-facing service interruptions

### 3. Monitor Reports Weekly

Review weekly maintenance reports for:

- Increasing gap trends (missing/incomplete content)
- Declining quality metrics
- Recurring health check failures
- Field enhancement needs

### 4. API Key Management

Ensure `GEMINI_API_KEY` is set in `.env`:

```bash
# Check if API key is configured
echo $GEMINI_API_KEY

# If not set, add to .env
echo "GEMINI_API_KEY=your_key_here" >> .env
```

**Note**: `unset GEMINI_API_KEY` is NOT needed for this script (loads from `.env` file directly).

---

## Integration with Existing Systems

### Content Doctor

Maintenance suite calls `content-doctor.ts` for:

- Phase 2 content generation
- Field-specific regeneration (buzzwords, mnemonics, guidelines)

### Standardization Scripts

Integrates with:

- `standardize-formatting.ts` - Markdown formatting
- `assess-content-adequacy.ts` - Quality assessment (logic replicated inline)

### Weekly Automation

`automation/weeklyTasks.ts` now includes maintenance suite, then adds:

- Content accuracy audit
- Outdated content identification
- Performance metrics
- Improvement suggestions
- Weekly summary report (saved to `weekly-report-latest.txt`)

---

## Troubleshooting

### Issue: "GEMINI_API_KEY not set"

**Solution**: Add API key to `.env` file

```bash
echo "GEMINI_API_KEY=your_key_here" >> .env
```

### Issue: "Response size exceeded 5MB"

**Solution**: Script uses batch processing (50 per batch). If still occurring, reduce `BATCH_SIZE` in script.

### Issue: Content generation skipped

**Possible causes**:

- `--skip-generation` flag used
- `GEMINI_API_KEY` not set
- `--dry-run` mode

**Verify**: Check console output for skip message

### Issue: Health check failures

**Actions**:

1. Review specific error messages
2. Run diagnostic scripts:
   ```bash
   npm run db:validate
   npm run sync:all
   npm run health-check
   ```
3. Check Prisma schema vs. database schema alignment
4. Manually inspect orphaned/duplicate records in Prisma Studio

---

## Future Enhancements

Potential improvements for future versions:

1. **Parallel Processing**: Process multiple systems simultaneously
2. **Incremental Updates**: Track last maintenance timestamp, only process changed content
3. **Quality Metrics Dashboard**: Web UI for maintenance reports
4. **Automated Rollback**: Snapshot before maintenance, rollback on failures
5. **Smart Scheduling**: Adjust timing based on content change frequency
6. **Cost Tracking**: Monitor Gemini API usage and costs
7. **A/B Testing**: Compare AI-generated vs. original content quality
8. **Peer Review Queue**: Flag AI-regenerated content for human review

---

## Summary

The Weekly Maintenance Suite provides **comprehensive, automated content quality management** for the PANaCEa database. It ensures:

✅ **Completeness**: All conditions have full medical content
✅ **Quality**: Content meets or exceeds established benchmarks
✅ **Consistency**: Uniform formatting and structure across all content
✅ **Accuracy**: Regular validation and enhancement of critical fields
✅ **Integrity**: Data relationships and structure remain sound

**Recommended schedule**: Run weekly (automated via cron) with manual spot checks as needed.
