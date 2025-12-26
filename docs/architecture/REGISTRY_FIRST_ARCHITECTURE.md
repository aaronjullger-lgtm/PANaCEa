# Registry-First Architecture Guide

## Overview

PANaCEa now uses a **registry-first architecture** where all medical knowledge entities (conditions, drugs, special tests, anatomy) are defined in TypeScript registry files. These registries serve as the single source of truth, and automation handles everything else.

## Core Principle

**Add to Registry → Sync to Database → Automation Fills Content**

1. **You add** an entry to the registry file (e.g., `drugRegistry.ts`)
2. **Sync script** adds it to the database (never overwrites existing records)
3. **Automation** detects new entries and generates comprehensive content
4. **Database** becomes the enriched source for the application

## Registry Files

### 1. Condition Registry (`conditionRegistry.ts`)

**Purpose**: Defines all medical conditions that should exist in the system.

**Location**: `/conditionRegistry.ts`

**Example Entry**:
```typescript
{
  system: "CV",
  subcategory: "Ischemic Heart Disease",
  condition: "Acute Coronary Syndrome (ACS)",
  aliases: ["ACS", "Heart Attack"],
  overview: "Life-threatening condition...",
  keyPoints: ["STEMI vs NSTEMI", "Time is muscle"],
  redFlags: ["Crushing chest pain", "Diaphoresis"],
}
```

**Sync Command**: `npm run sync:conditions`

**What It Does**: Creates entries in the `Condition` table. Automation then generates full `MedicalContent` entries.

---

### 2. Drug Registry (`drugRegistry.ts`)

**Purpose**: Defines all drugs/medications for pharmacology education.

**Location**: `/drugRegistry.ts`

**Example Entry**:
```typescript
{
  genericName: "Metformin",
  brandName: "Glucophage",
  drugClass: ["Endocrine", "Antidiabetic", "Biguanide"],
  isHighYield: true,
  fdaApproved: true,
  mechanismOfAction: "Decreases hepatic glucose production...",
  indications: ["Type 2 Diabetes"],
  contraindications: ["Renal impairment", "Lactic acidosis risk"],
}
```

**Sync Command**: `npm run sync:drugs`

**What It Does**: Creates entries in the `Drug` table with basic info. Automation enriches with interactions, dosing, etc.

---

### 3. Special Test Registry (`specialTestRegistry.ts`)

**Purpose**: Defines all physical exam special tests (orthopedic, neurologic, etc.).

**Location**: `/specialTestRegistry.ts`

**Example Entry**:
```typescript
{
  name: "Lachman Test",
  system: "MSK",
  region: "Knee",
  description: "Tests for anterior cruciate ligament (ACL) tear",
  sensitivity: 85,
  specificity: 94,
  relatedConditions: ["MSK__knee__anterior_cruciate_ligament_tear"],
}
```

**Sync Command**: `npm run sync:special-tests`

**Special Feature**: Uses Gemini API during sync to generate in-depth content including:
- Detailed step-by-step technique
- Positive test criteria
- Clinical interpretation
- High-yield pearls
- Limitations and related tests

---

### 4. Anatomy Registry (`anatomyRegistry.ts`)

**Purpose**: Defines anatomical structures relevant to PA education.

**Location**: `/anatomyRegistry.ts`

**Example Entry**:
```typescript
{
  name: "Anterior Cruciate Ligament",
  system: "MSK",
  region: "Knee",
  type: "Ligament",
  description: "Primary stabilizer preventing anterior tibial translation",
  relatedConditions: ["MSK__knee__anterior_cruciate_ligament_tear"],
  innervation: "N/A",
  bloodSupply: "Middle genicular artery",
}
```

**Sync Command**: `npm run sync:anatomy`

**What It Does**: Creates entries in the `AnatomyStructure` table. Automation enriches with diagrams, clinical significance.

---

## Workflow: Adding New Content

### Example: Adding a New Drug

1. **Edit the Registry**:
   ```typescript
   // drugRegistry.ts
   export const DRUG_REGISTRY_CARDIOVASCULAR: DrugMeta[] = [
     // ... existing drugs
     {
       genericName: "Sacubitril-Valsartan",
       brandName: "Entresto",
       drugClass: ["Cardiovascular", "ARB", "Neprilysin Inhibitor"],
       isHighYield: true,
       fdaApproved: true,
     },
   ];
   ```

2. **Sync to Database**:
   ```bash
   npm run sync:drugs
   ```
   
   Output:
   ```
   ✨ Created: Sacubitril-Valsartan (Cardiovascular, ARB, Neprilysin Inhibitor)
   ```

3. **Automation Fills Content** (runs automatically or trigger manually):
   ```bash
   npm run automation:daily
   ```
   
   This will:
   - Detect the new drug
   - Generate mechanism of action
   - Add drug interactions
   - Add dosing information
   - Link to related conditions

4. **Done!** The drug is now fully integrated.

---

## Important: Add-Only Policy

### ⚠️ Registry Files NEVER Overwrite Database Records

**Why?**
- Database may contain manual edits
- Database may contain AI-generated enhancements
- Database may contain user feedback
- Database is the enriched version

**How Sync Works**:
- ✅ If entry doesn't exist → **CREATE** in database
- ⏭️ If entry exists → **SKIP** (preserve database version)
- ❌ Never → **UPDATE** or **OVERWRITE**

**Example**:
```typescript
// You add to drugRegistry.ts:
{
  genericName: "Aspirin",
  brandName: "Bayer",
  drugClass: ["Cardiovascular", "Antiplatelet"],
  isHighYield: true,
}

// First sync:
npm run sync:drugs
// ✨ Created: Aspirin

// Later, database is enriched with:
// - AI-generated mechanism: "Irreversibly inhibits COX-1/COX-2..."
// - Detailed interactions: "Avoid with warfarin..."
// - Dosing: "81mg for cardioprotection, 325mg for MI..."

// You run sync again:
npm run sync:drugs
// ⏭️ Skipped (already exists): Aspirin

// Database version is PRESERVED with all enrichments!
```

---

## Sync Commands Reference

| Command | What It Syncs | Special Features |
|---------|---------------|------------------|
| `npm run sync:conditions` | Condition table | Basic metadata only |
| `npm run sync:drugs` | Drug table | Basic metadata only |
| `npm run sync:special-tests` | SpecialTest table | **Uses Gemini AI** for in-depth content |
| `npm run sync:anatomy` | AnatomyStructure table | Basic metadata only |
| `npm run sync:all` | All of the above | Runs all sync scripts in sequence |

---

## Automation Commands Reference

| Command | Frequency | What It Does |
|---------|-----------|--------------|
| `npm run automation:hourly` | Every hour | Health checks, API monitoring, error detection |
| `npm run automation:daily` | Daily at 3 AM | Content validation, gap detection, media checks, cleanup |
| `npm run automation:weekly` | Sundays at 2 AM | Full audit, improvement suggestions, generates report |

---

## Best Practices

### 1. Always Sync After Registry Changes
```bash
# After editing conditionRegistry.ts
npm run sync:conditions

# After editing drugRegistry.ts
npm run sync:drugs
```

### 2. Check Sync Reports
```
📊 Total in Registry: 150
✨ Created (New): 5
⏭️ Skipped (Existing): 145
❌ Failed: 0
```

### 3. Let Automation Run
Don't manually fill content in the database. Let automation do it:
- More consistent
- Uses current medical guidelines
- Automatically updates with new information

### 4. Review Weekly Reports
```bash
npm run automation:weekly
```

Check `weekly-report-latest.txt` for:
- Improvement suggestions
- Content that needs updating
- System health status

---

## Troubleshooting

### "Registry has 100 items, but database has 0"

**Solution**: Run the sync command:
```bash
npm run sync:conditions
```

### "Sync created 0 items, but I added new entries"

**Possible Causes**:
1. Entries already exist in database (check by name)
2. TypeScript syntax error in registry
3. Database connection issue

**Check**:
```bash
npm run db:studio
# Open Prisma Studio and check the table
```

### "Special test sync is slow"

**Expected**: Special tests use Gemini API to generate content, which takes ~1-2 seconds per test.

**Tip**: Run during off-hours or in batches.

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│   Registry Files (Source of Truth)     │
│                                         │
│   • conditionRegistry.ts                │
│   • drugRegistry.ts                     │
│   • specialTestRegistry.ts              │
│   • anatomyRegistry.ts                  │
└──────────────┬──────────────────────────┘
               │
               │ npm run sync:*
               │ (ADD ONLY - Never Overwrite)
               ▼
┌─────────────────────────────────────────┐
│   Database Tables                       │
│                                         │
│   • Condition (basic metadata)          │
│   • Drug (basic + AI-generated)         │
│   • SpecialTest (comprehensive content) │
│   • AnatomyStructure (basic metadata)   │
└──────────────┬──────────────────────────┘
               │
               │ Automation detects new entries
               │ npm run automation:daily
               ▼
┌─────────────────────────────────────────┐
│   Enriched Content                      │
│                                         │
│   • MedicalContent (full condition info)│
│   • Drug interactions, dosing           │
│   • Anatomy diagrams, clinical relevance│
│   • MediaAssets linked                  │
└─────────────────────────────────────────┘
               │
               │ Application uses database
               ▼
┌─────────────────────────────────────────┐
│   User-Facing Application               │
│                                         │
│   • Condition pages                     │
│   • Drug lookup                         │
│   • Special test reference              │
│   • Anatomy viewer                      │
└─────────────────────────────────────────┘
```

---

## Next Steps

1. **Initial Setup**: Sync all registries
   ```bash
   npm run sync:all
   ```

2. **Enable Automation**: Set up cron jobs or scheduled tasks
   ```bash
   # Hourly
   0 * * * * cd /path/to/PANaCEa && npm run automation:hourly
   
   # Daily at 3 AM
   0 3 * * * cd /path/to/PANaCEa && npm run automation:daily
   
   # Weekly on Sunday at 2 AM
   0 2 * * 0 cd /path/to/PANaCEa && npm run automation:weekly
   ```

3. **Review Weekly**: Check `weekly-report-latest.txt` every week

4. **Add Content**: Just add to registry files and sync!

---

## Questions?

See:
- `DEVELOPER_GUIDE.md` - Full development guide
- `AUTOMATED_SYSTEM_GUIDE.md` - Automation details
- `.github/copilot-instructions.md` - AI assistance guide
