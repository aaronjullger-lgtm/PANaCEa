# Database Maintenance Scripts

This directory contains specialized database maintenance and normalization scripts for the PANaCEa medical content database.

## Scripts

### `fix-optional-nulls.ts`
**Purpose:** Normalize inconsistent "empty" states in JSONB columns.

**Problem Solved:**
- Distinguishes between SQL NULL (never processed) and JSON null (processed but empty)
- Converts both types to sentinel value `"NONE"` for processed records
- Signals to AI generation scripts to stop asking about these fields

**Affected Fields:**
- `classic_triad`
- `mnemonic`
- `guidelines`

**Usage:**
```bash
npx ts-node scripts/db/fix-optional-nulls.ts
```

**Logic:**
1. Finds records where `clinical_pearls` exists (meaning processed)
2. Identifies fields with either `Prisma.DbNull` (SQL NULL) or `Prisma.JsonNull` (JSON null)
3. Updates those fields to `"NONE"`
4. Provides detailed statistics and verification

**Output Example:**
```
╔═══════════════════════════════════════════════════════════╗
║   SUMMARY REPORT                                          ║
╚═══════════════════════════════════════════════════════════╝

┌─────────────────┬─────────────┬──────────────┬───────────┐
│ Field           │ SQL NULLs   │ JSON nulls   │ Total     │
├─────────────────┼─────────────┼──────────────┼───────────┤
│ classic_triad   │          45 │           12 │        57 │
│ mnemonic        │          32 │            8 │        40 │
│ guidelines      │          18 │            3 │        21 │
├─────────────────┼─────────────┼──────────────┼───────────┤
│ TOTAL           │          95 │           23 │       118 │
└─────────────────┴─────────────┴──────────────┴───────────┘
```

---

### `revert-none-to-null.ts`
**Purpose:** Unlock fields for AI regeneration by reverting `"NONE"` back to `null`.

**Problem Solved:**
- Some records were normalized to `"NONE"` but actually have discoverable content
- Resetting to `null` allows generation scripts to process them again
- Configurable field selection for selective unlocking

**Affected Fields:**
- `mnemonic` (String) → null
- `guidelines` (String) → null
- `classic_triad` (Json) → Prisma.DbNull

**Usage:**
```bash
npx ts-node scripts/db/revert-none-to-null.ts
```

**Configuration:**
Edit the `FIELDS_TO_UNLOCK` array in the script to control which fields get reset:
```typescript
const FIELDS_TO_UNLOCK: FieldConfig[] = [
  { name: 'mnemonic', type: 'string' },      // ← Uncomment to unlock
  // { name: 'guidelines', type: 'string' }, // ← Commented = skip
  { name: 'classic_triad', type: 'json' },
];
```

**Output Example:**
```
╔═══════════════════════════════════════════════════════════╗
║   UNLOCK SUMMARY                                          ║
╚═══════════════════════════════════════════════════════════╝

┌───────────────────────────┬───────────────────────────┐
│ Field                     │ Records Unlocked          │
├───────────────────────────┼───────────────────────────┤
│ mnemonic                  │                      1045 │
│ guidelines                │                      1011 │
│ classic_triad             │                         0 │
├───────────────────────────┼───────────────────────────┤
│ TOTAL                     │                      2056 │
└───────────────────────────┴───────────────────────────┘

💡 Next step: Run your generation script:
   npm run generate:clinical
```

---

### `normalize-formatting.ts`

⚠️ **WARNING**: This script requires schema review before use. Current MedicalContent schema uses `String?` (JSON strings) for most fields, not Postgres arrays. Script needs alignment with actual schema structure.

**Original Purpose:** Comprehensive data formatting cleanup for the entire MedicalContent table.

**Problems It Was Designed to Fix:**
1. **Postgres Array Syntax** → Converts `{""Item 1"", ""Item 2""}` to `["Item 1", "Item 2"]`
2. **Escaped Newlines** → Converts literal `\\n` to actual newlines `\n`
3. **Inconsistent Sentinels** → Normalizes `"none"`, `"N/A"`, `""` to `"NONE"` or `null`

**Status:** ⚠️ Not production-ready - Schema mismatch detected

**Next Steps:**
1. Review MedicalContent schema field types
2. Align array handling with actual `String[]` fields only (buzzwords, relatedSystems)
3. Remove array conversion logic for JSON string fields
4. Test on development data before production use

**Affected Fields:**
- **Arrays:** `symptoms`, `complications`, `riskFactors`, `buzzwords`, `relatedSystems`
- **Text:** `overview`, `etiology`, `pathophysiology`, `diagnostics`, `treatment`, `clinical_pearls`
- **Sentinels:** `classic_triad`, `mnemonic`, `guidelines`

**Usage:**
```bash
npx ts-node scripts/db/normalize-formatting.ts
```

**Features:**
- Batch processing (100 records at a time) to avoid memory issues
- Only updates records that actually changed
- Detailed logging of each fix applied
- Progress indicators for large datasets
- Safe error handling (continues on individual record errors)

**Output Example:**
```
╔═══════════════════════════════════════════════════════════╗
║   NORMALIZATION SUMMARY                                   ║
╚═══════════════════════════════════════════════════════════╝

┌────────────────────────────────┬──────────────────────┐
│ Metric                         │ Count                │
├────────────────────────────────┼──────────────────────┤
│ Total records processed        │                 1200 │
│ Records updated                │                  345 │
│ Postgres arrays fixed          │                   89 │
│ Text/newlines normalized       │                  234 │
│ Sentinels normalized           │                   67 │
│ Errors encountered             │                    0 │
└────────────────────────────────┴──────────────────────┘
```

**Technical Details:**
- Uses regex parsing for Postgres array conversion
- Preserves internal quotes and commas correctly
- Try/catch blocks prevent script crashes on malformed data
- Updates `updatedAt` timestamp for audit trail

## Best Practices

1. **Always backup** before running database modification scripts
2. **Test in development** environment first
3. **Review logs** to understand what was changed
4. Run verification queries after completion

## Adding New Scripts

When creating new database maintenance scripts:

1. Add clear documentation at the top explaining:
   - Purpose
   - Problem being solved
   - Fields affected
   - Usage instructions

2. Use transaction-safe operations when possible

3. Provide detailed logging with:
   - Progress indicators
   - Counts of affected records
   - Verification steps

4. Handle errors gracefully and disconnect Prisma client properly

5. Update this README with the new script's details
