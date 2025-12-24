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
