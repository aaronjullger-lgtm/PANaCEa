# Database Automation Suite

Complete database management toolkit for validation, quality assurance, content generation, and **bi-directional synchronization**.

## Quick Start

```bash
# Run full automation suite (validation + content generation)
npm run db:automate

# Run full orchestration (bi-directional sync + health checks)
npm run db:orchestrate

# Quick mode (critical checks only)
npm run db:automate:quick

# Skip AI content generation
npm run db:automate:skip-gen
```

## Two Automation Systems

PANaCEa has two complementary automation systems:

### 1. **Content Automation** (`npm run db:automate`)

- Validates data quality
- Checks content completeness
- Generates missing content with AI
- Finds duplicates
- Validates relationships

### 2. **Orchestration** (`npm run db:orchestrate`) ⭐ NEW

- **Bi-directional sync** between code and database
- Syncs local TypeScript registries → Database
- Captures AI-generated records → Back to local files
- Runs health checks and repairs
- See [ORCHESTRATION_GUIDE.md](./ORCHESTRATION_GUIDE.md) for details

## Available Scripts

### Orchestration

### Orchestration

**`npm run db:orchestrate`** ⭐ NEW

- **Bi-directional sync** workflow
- Phase 1: Sync local registries → Database
- Phase 2: Validate database integrity
- Phase 3: Auto-repair issues (if script exists)
- Phase 4: Capture DB records → Local registries
- See [ORCHESTRATION_GUIDE.md](./ORCHESTRATION_GUIDE.md)

**`npm run db:sync-to-registry`**

- Back-sync database records to local TypeScript files
- Captures AI-generated or admin panel-created records
- Creates `.bak` backups before modifying files

**`npm run db:automate`**

- Runs all database automation tasks in sequence
- Validates data integrity, checks content quality, generates missing content
- Saves detailed logs to `logs/automation-*.json`
- Generates reports in `reports/` directory

**`npm run db:automate:quick`**

- Runs only critical validation tasks (faster execution)
- Skips duplicate detection and content generation

**`npm run db:automate:skip-gen`**

- Runs all checks but skips AI content generation
- Useful for CI/CD pipelines or when Gemini API unavailable

### Individual Tools

**`npm run db:validate`**

- Validates required fields, data formats, enum values
- Checks: MedicalContent, Condition, Drug, LabTest, User tables
- Output: `reports/validation-report-*.json`

**`npm run db:quality`**

- Checks content completeness and section requirements
- Verifies minimum content lengths, placeholder text, formatting
- Output: `reports/quality-report-*.json`

**`npm run db:relationships`**

- Validates foreign key references and data integrity
- Checks User references, Condition consistency, LabCase relationships
- Output: `reports/relationship-validation-*.json`

**`npm run db:deduplicate`**

- Finds duplicate conditions using similarity scoring
- Generates merge scripts for duplicate groups
- Output: `reports/duplicates-*.json` + `scripts/merge_duplicates.ts`

**`npm run db:generate-content`**

- AI-powered content generation for missing sections
- Uses Google Gemini API with context-aware prompts
- Flags: `--dry-run`, `--limit=N`, `--force`

### Backup & Restore

**`npm run db:backup`**

- Comprehensive backup of all 58 database tables
- Saves to `backups/{timestamp}/` with JSON files per table
- Includes metadata and timestamp tracking

**`npm run db:restore`**

- Restores from backup directory
- Uses upsert strategy to prevent duplicates
- Prompts for backup timestamp selection

## Automation Workflow

The orchestration script (`scripts/orchestrate.ts`) runs tasks in this order:

1. **Database Validation** (critical)
   - Field validation, format checks, enum validation
   - Ensures data integrity before other operations

2. **Content Quality Check** (critical)
   - Verifies section completeness and content adequacy
   - Identifies records needing improvement

3. **Relationship Validation** (critical)
   - Checks foreign keys and cross-table references
   - Finds orphaned records and consistency issues

4. **Duplicate Detection** (non-critical)
   - Uses Jaccard similarity to find duplicates
   - Reports only; doesn't modify data

5. **Content Generation** (non-critical, dry-run by default)
   - Generates missing content using AI
   - Limited to 5 records by default in orchestration

## Report Structure

All tools generate timestamped JSON reports in `reports/`:

```json
{
  "timestamp": "2024-12-19T05:30:00.000Z",
  "summary": {
    "totalRecords": 1060,
    "issuesFound": 42,
    "severity": {
      "error": 5,
      "warning": 30,
      "info": 7
    }
  },
  "issues": [
    {
      "type": "missing_required_field",
      "severity": "error",
      "table": "MedicalContent",
      "recordId": "chf",
      "field": "pathophysiology",
      "message": "Required field is missing"
    }
  ]
}
```

## Configuration

### Environment Variables

Required for content generation:

- `GEMINI_API_KEY` - Google Gemini API key

Required for database operations:

- `DATABASE_URL` - PostgreSQL connection string

### Gemini API Settings

Content generation uses:

- Model: `gemini-2.0-flash-exp`
- Temperature: `0.3` (consistent, focused output)
- Rate limit: `1 request/second`
- Max retries: `3` with exponential backoff

### Validation Rules

**Required Fields**:

- `MedicalContent`: conditionId, name, status, overview, symptoms, diagnosis, treatment
- `Condition`: conditionId, name, system
- `Drug`: drugId, name, class
- `LabTest`: id, name
- `User`: id, email

**Minimum Content Lengths**:

- Overview: 200 characters
- Pathophysiology: 200 characters
- Symptoms: 3 items
- Diagnosis: 3 items
- Treatment: 3 items
- Complications: 2 items

**Valid Enums**:

- Status: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `PUBLISHED`, `ARCHIVED`
- PANCE Systems: `CV`, `PULM`, `GI`, `NEURO`, `MSK`, `DERM`, `HEME`, `ENDO`, etc.

## Usage Examples

### Daily Quality Check

```bash
# Run quick validation before deployment
npm run db:automate:quick
```

### Weekly Full Audit

```bash
# Complete validation and content generation
npm run db:automate
```

### Find and Fix Issues

```bash
# 1. Validate data
npm run db:validate

# 2. Check content quality
npm run db:quality

# 3. Review reports
cat reports/validation-report-*.json | jq '.summary'

# 4. Generate missing content (dry run first)
npm run db:generate-content -- --dry-run --limit=10

# 5. Apply changes
npm run db:generate-content -- --limit=10
```

### Handle Duplicates

```bash
# 1. Find duplicates
npm run db:deduplicate

# 2. Review duplicates report
cat reports/duplicates-*.json | jq '.duplicateGroups'

# 3. Run generated merge script (review first!)
tsx scripts/merge_duplicates.ts
```

### Emergency Recovery

```bash
# Before major changes
npm run db:backup

# If something goes wrong
npm run db:restore
# Select backup timestamp from prompt
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Database Quality Check
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sundays

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm run db:automate:skip-gen
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Upload Reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: validation-reports
          path: reports/
```

## Troubleshooting

### "No Gemini API key found"

- Set the server-side `GEMINI_API_KEY` environment variable
- Or use `--skip-generation` flag to skip content generation

### "Database connection failed"

- Verify `DATABASE_URL` in `.env`
- Check database is running and accessible
- Run `npx prisma db push` to sync schema

### "Critical task failed"

- Orchestrator continues with remaining tasks
- Check logs in `logs/automation-*.json`
- Review specific report in `reports/` for details

### Large Number of Issues

- Start with `db:validate` to find data integrity issues
- Use `db:quality` to identify incomplete content
- Generate content in batches: `--limit=50`
- Review AI-generated content before publishing

## Best Practices

1. **Run validation before major deployments**

   ```bash
   npm run db:automate:quick
   ```

2. **Regular audits** (weekly/monthly)

   ```bash
   npm run db:automate
   ```

3. **Always backup before bulk operations**

   ```bash
   npm run db:backup
   npm run db:generate-content -- --limit=100
   ```

4. **Review AI-generated content**
   - Use `--dry-run` first
   - Check generated content quality
   - Manually verify medical accuracy

5. **Monitor reports directory**
   - Archive old reports periodically
   - Track trends in issue counts
   - Identify systemic data quality problems

6. **Test duplicate merges carefully**
   - Review merge script before running
   - Backup before merging
   - Verify references are updated correctly

## Advanced Usage

### Custom Validation Rules

Edit `scripts/validate_database.ts` to add custom checks:

```typescript
// Add custom validation
if (record.name.length < 5) {
  issues.push({
    type: 'name_too_short',
    severity: 'warning',
    table: 'MedicalContent',
    recordId: record.id,
    field: 'name',
    message: 'Condition name should be at least 5 characters',
  });
}
```

### Custom Content Prompts

Modify `scripts/generate_content.ts` section prompts:

```typescript
const SECTION_PROMPTS = {
  pathophysiology: `Generate a detailed pathophysiology for ${name}...`,
  // Add your custom prompts
};
```

### Batch Processing

Process records in batches with custom filters:

```typescript
// In generate_content.ts
const records = await prisma.medicalContent.findMany({
  where: {
    system: 'CV', // Filter by system
    status: 'PUBLISHED',
    pathophysiology: null,
  },
  take: 50,
});
```

## Support

For issues or questions:

1. Check this guide and individual script documentation
2. Review recent reports in `reports/` and logs in `logs/`
3. Check Prisma schema for data model details
4. See `DEVELOPER_GUIDE.md` for architecture overview
