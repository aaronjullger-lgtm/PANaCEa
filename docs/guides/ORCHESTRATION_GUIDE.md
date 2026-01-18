# Master Database Orchestrator

## Overview

The Master Orchestrator provides **bi-directional synchronization** between your local TypeScript registry files and the PostgreSQL database, ensuring that:

- Changes made to local code get synced to the database
- AI-generated or admin panel-created records get saved back to your codebase
- Data integrity is maintained through automated validation and repair

## Quick Start

```bash
# Run the complete health & sync cycle
npm run db:orchestrate
```

## Architecture

### The Four Phases

The orchestrator runs four sequential phases:

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: 🔄 The Handshake (Local → Cloud)                   │
│ Syncs conditionRegistry.ts + drugRegistry.ts → Database    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: 🔬 The Diagnostic                                  │
│ Validates database for nulls, format issues, bad enums     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: 🚑 The Auto-Mechanic (optional)                    │
│ Repairs data issues found by validation                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: 💾 The Write-Back (Cloud → Local)                  │
│ Captures new DB records back to registry files             │
└─────────────────────────────────────────────────────────────┘
```

## The Scripts

### 1. Registry Sync (Local → DB)

**Script**: `scripts/syncAllRegistries.ts`  
**Command**: `npm run sync:all-registries`

**What it does**:

- Reads `conditionRegistry.ts` and `drugRegistry.ts`
- Upserts all entries into Prisma database
- Uses name+system match for conditions, genericName for drugs
- Preserves existing content fields in database

**When to run**:

- After adding new conditions or drugs to TypeScript files
- After deployment (ensures DB has latest local data)
- As part of orchestrator (automatic)

### 2. Database Validation

**Script**: `scripts/validate_database.ts`  
**Command**: `npm run db:validate`

**What it does**:

- Checks for missing required fields (nulls)
- Validates data formats (IDs, arrays, strings)
- Verifies enum values (status, PANCE systems)
- Generates JSON report in `reports/`

**Tables checked**:

- MedicalContent, Condition, Drug, LabTest, User

### 3. Auto-Repair (Optional)

**Script**: `scripts/maintenance/autoRepair.ts`  
**Command**: Create this file as needed

**What it does**:

- Fixes data issues found by validation
- Updates database records with corrections
- Logs all changes made

**Example fixes**:

- Set default values for nulls
- Normalize ID formats
- Fix enum casing
- Merge duplicate entries

### 4. Back-Sync (DB → Local)

**Script**: `scripts/sync_db_to_registry.ts`  
**Command**: `npm run db:sync-to-registry`

**What it does**:

- Loads all conditions and drugs from database
- Compares with local TypeScript files
- Finds "ghost" records (in DB but not in code)
- Injects missing entries into registry files
- Creates .bak backup before writing

**How it works**:

```typescript
// New entries are added to a separate array:
export const CONDITION_REGISTRY_DB_SYNCED: ConditionMeta[] = [
  { system: 'CV', subcategory: 'AI Generated', condition: 'New AI Condition' },
  // ...
];

// Then included in main export:
export const CONDITION_REGISTRY = [
  ...CONDITION_REGISTRY_CV,
  ...CONDITION_REGISTRY_PULM,
  // ...existing arrays
  ...CONDITION_REGISTRY_DB_SYNCED, // ← Auto-added
];
```

## Usage Examples

### Run Full Orchestration

```bash
npm run db:orchestrate
```

**Output**:

```
🤖 MASTER DATABASE ORCHESTRATOR
================================================================================
Started: 12/19/2024, 10:30:00 AM
================================================================================

================================================================================
🔄 Phase: The Handshake: Local → Cloud
================================================================================

✅ The Handshake: Local → Cloud completed in 5.23s

================================================================================
🔬 Phase: The Diagnostic: Database Validation
================================================================================

✅ The Diagnostic: Database Validation completed in 3.45s

================================================================================
💾 Phase: The Write-Back: Cloud → Local
================================================================================

✅ The Write-Back: Cloud → Local completed in 1.87s

================================================================================
ORCHESTRATION SUMMARY
================================================================================

⏱️  Total Duration: 10.55s
✅ Successful Phases: 3/3
❌ Failed Phases: 0/3

✅ System Synchronized!
```

### Run Individual Phases

```bash
# Just sync local to DB
npm run sync:all-registries

# Just validate
npm run db:validate

# Just back-sync DB to local
npm run db:sync-to-registry
```

### Recovery After AI Generation

If AI has created 50 new condition records in the database:

```bash
# 1. Capture them back to your code
npm run db:sync-to-registry

# Output:
# 📝 Found 50 conditions to add to local registry
# 💾 Created backup: conditionRegistry.ts.bak
# ✅ Added 50 conditions to conditionRegistry.ts
#    CV: Acute Myocardial Rupture, Cardiac Tamponade
#    PULM: Allergic Bronchopulmonary Aspergillosis
#    ...

# 2. Review the changes
git diff conditionRegistry.ts

# 3. Organize them properly (move from AI Generated to correct subcategory)
# Edit conditionRegistry.ts manually

# 4. Sync back to DB
npm run sync:all-registries

# 5. Commit
git add conditionRegistry.ts
git commit -m "Add AI-generated conditions from orchestration"
```

## Configuration

### Customizing Phases

Edit `scripts/maintenance/orchestrator.ts` to:

- Skip phases
- Add new phases
- Change execution order
- Add conditional logic

Example - skip Auto-Mechanic if no errors:

```typescript
// After validation phase
if (validate.success && !hasErrors(validate.output)) {
  console.log('⏭️  Skipping Auto-Mechanic (no errors found)');
} else {
  const repair = await runPhase(/*...*/);
  results.push(repair);
}
```

### Safety Features

1. **Backups**: Back-sync creates `.bak` files before modifying registries
2. **Read-only validation**: Validation never modifies data
3. **Dry-run support**: Add `--dry-run` flag to any phase
4. **Error tolerance**: One phase failure doesn't stop the orchestration

## Integration with Existing Scripts

The orchestrator complements the existing automation suite:

| Script                   | Purpose                         | Orchestrator Phase       |
| ------------------------ | ------------------------------- | ------------------------ |
| `orchestrate.ts`         | Content validation & generation | Separate (runs AI tasks) |
| `syncAllRegistries.ts`   | Local → DB                      | Phase 1 (Handshake)      |
| `validate_database.ts`   | Data validation                 | Phase 2 (Diagnostic)     |
| `sync_db_to_registry.ts` | DB → Local                      | Phase 4 (Write-Back)     |

**When to use which**:

- **`npm run db:automate`**: Content quality, AI generation, deduplication
- **`npm run db:orchestrate`**: Bi-directional sync, database health

**Combined workflow**:

```bash
# 1. Full automation (content quality + AI generation)
npm run db:automate

# 2. Bi-directional sync (capture AI changes back to code)
npm run db:orchestrate

# 3. Review and commit
git diff
git add .
git commit -m "Automated content generation and sync"
```

## Monitoring

### Check Phase Results

All phases generate reports:

- Validation: `reports/validation-report-*.json`
- Quality: `reports/quality-report-*.json`
- Deduplication: `reports/duplicates-*.json`

Orchestration logs: `logs/automation-*.json`

### Verify Sync Status

```bash
# Check how many conditions/drugs in DB vs local
npm run db:sync-to-registry -- --dry-run  # Future enhancement

# Manual check
npx tsx scripts/sync_db_to_registry.ts
# ✅ All database conditions already exist in local registry
# ✅ All database drugs already exist in local registry
```

## Troubleshooting

### "Cannot find closing bracket"

- Registry file structure changed
- Manual intervention needed
- Check `.bak` file and restore if needed

### "Condition already exists"

- Duplicate detection based on normalized names
- Case-insensitive, special char removal
- May need manual review for similar names

### "Phase failed"

- Check error output in console
- Review individual phase script
- Run phase independently for debugging
- Check `reports/` directory for details

### Restore from Backup

```bash
# If back-sync went wrong
cp conditionRegistry.ts.bak conditionRegistry.ts
cp drugRegistry.ts.bak drugRegistry.ts

# Re-run orchestrator
npm run db:orchestrate
```

## Best Practices

1. **Run orchestrator after major changes**:
   - After AI content generation
   - After admin panel bulk edits
   - Before deployment

2. **Review back-synced entries**:
   - Don't blindly commit generated arrays
   - Move entries to proper subcategories
   - Update metadata (aliases, overview, etc.)

3. **Keep registries clean**:
   - Periodically merge `REGISTRY_DB_SYNCED` arrays
   - Reorganize entries by system/subcategory
   - Remove duplicates manually

4. **Use version control**:
   - Always review diffs before committing
   - Back up before running orchestrator
   - Tag releases after successful orchestration

5. **Schedule regular runs**:
   - Daily: Light validation
   - Weekly: Full orchestration
   - After deployment: Always

## Advanced Usage

### Custom Orchestration Flows

Create custom orchestrators for specific workflows:

```typescript
// scripts/maintenance/ai-sync-orchestrator.ts
async function main() {
  // 1. Generate content
  await runPhase('AI Content Generation', '🤖', 'generate_content.ts');

  // 2. Back-sync to local
  await runPhase('Capture to Local', '💾', 'sync_db_to_registry.ts');

  // 3. Sync back to DB (after manual review)
  // User manually reviews and edits registry files
  console.log('⏸️  Review generated entries in registry files');
  console.log('   Press Enter when ready to sync back to DB...');
  await waitForInput();

  await runPhase('Re-sync to DB', '🔄', 'syncAllRegistries.ts');
}
```

### Automated CI/CD Integration

```yaml
# .github/workflows/database-orchestration.yml
name: Database Orchestration

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sundays
  workflow_dispatch:

jobs:
  orchestrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm run db:orchestrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Create PR if changes
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'Database Orchestration - Weekly Sync'
          body: 'Automated database synchronization and validation'
          branch: 'auto/db-sync'
```

## Migration Guide

### From Manual Sync to Orchestrator

**Before**:

```bash
# Manual process
npm run sync:conditions
npm run sync:drugs
npm run db:validate
# manually review reports
# manually sync back changes
```

**After**:

```bash
# One command
npm run db:orchestrate
```

### From Individual Scripts

All individual scripts still work:

- `npm run sync:all-registries`
- `npm run db:validate`
- `npm run db:sync-to-registry`

The orchestrator just runs them in the right order with proper error handling.

## Support

For issues or questions:

1. Check logs in `logs/automation-*.json`
2. Review reports in `reports/`
3. Check script source code in `scripts/`
4. See main `DATABASE_AUTOMATION_GUIDE.md` for related tools
