# 🏥 PANaCEa Supabase Database Audit & 10-Step Improvement Plan

**Date:** January 13, 2026  
**Status:** 📋 Planning Complete - Ready for Implementation  
**Priority:** P0 Foundation Fixes

---

## Executive Summary

After auditing the Prisma schema (80+ models), DATABASE_CLEANUP_REPORT.md, content APIs, and question generation services, this document outlines critical gaps and a comprehensive improvement plan.

---

## Current State Assessment

### ✅ Strengths
- **Solid Schema Foundation**: Well-designed with junction tables for relationships (DrugConditionLink, ECGConditionLink, etc.)
- **JSONB Content Storage**: Flexible MedicalContent.content field for structured data
- **FSRS v5 Integration**: UserProgress tracks spaced repetition state properly
- **Comprehensive Models**: 80+ tables covering conditions, drugs, procedures, labs, imaging, anatomy, etc.

### ⚠️ Critical Issues Found

| Issue | Impact | Current State |
|-------|--------|--------------|
| Junction tables sparse | Poor content linking | ~10% populated |
| Questions not linked to conditions | Can't track per-condition performance | conditionId often null |
| No full-text search | Slow searches, bad UX | Using `LIKE` queries |
| Missing Guidelines table | Screenings removed but nowhere to go | 4 screenings orphaned |
| Duplicate conditions | Data integrity issues | No prevention mechanism |
| Media assets underutilized | Missing visual learning | ~5% conditions have images |

### 📊 Database Statistics (Post-Cleanup)

| System | Count | Notes |
|--------|-------|-------|
| HEENT | 124 | General HEENT (97), Oral (8) |
| Musculoskeletal | 122 | General MSK (102), Trauma-Fractures (6) |
| Cardiovascular | 114 | ECG (39), Vascular Disease (13) |
| Psychiatry | 104 | Mental Health Disorders (97) |
| Dermatology | 98 | Inflammatory & Papulosquamous (80) |
| Reproductive | 92 | Reproductive Health (86) |
| Infectious Disease | 86 | Systemic Infections (77) |
| Gastrointestinal | 82 | General GI (69) |
| Neurological | 77 | CNS Disorders (68) |
| Hematology | 66 | Blood Disorders (62) |
| Renal | 62 | Renal & Electrolyte (56) |
| Endocrine | 55 | Metabolic Disorders (49) |
| Genitourinary | 51 | Urologic Disorders (49) |
| Pulmonary | 46 | Infectious (11), Respiratory (9) |
| **Total** | **1,223** | |

---

## 🔟 10-Step Improvement Plan

### **Step 1: Condition-to-MedicalContent Data Unification** 🔴 P0
**Problem**: You have both `Condition` and `MedicalContent` tables that reference the same entities but are poorly linked.

**Current Schema Issue**:
```prisma
model Condition {
  id        String  @id
  name      String
  system    String
  content   Json?   // DUPLICATES MedicalContent fields
  // ...
}

model MedicalContent {
  id          String  @id
  conditionId String  @unique  // References Condition.id
  condition   String  // DUPLICATES Condition.name
  // ...
}
```

**Actions:**
1. Create a migration to ensure every `MedicalContent.conditionId` has a matching `Condition.id`
2. Add foreign key constraint from MedicalContent → Condition
3. Audit orphaned records in both tables
4. Deprecate `Condition.content` JSONB in favor of dedicated `MedicalContent` fields

**Script**: `scripts/db/unify-condition-medicalcontent.ts`

**Expected Result**: Single source of truth for condition content

---

### **Step 2: Populate Junction Tables for Deep Linking** 🟠 P1
**Problem**: Junction tables exist but are mostly empty, limiting cross-referencing capabilities.

**Junction Tables to Populate**:
| Table | Current Records | Target |
|-------|----------------|--------|
| DrugConditionLink | ~50 | 500+ |
| LabConditionLink | ~30 | 300+ |
| ImagingConditionLink | ~20 | 200+ |
| FindingConditionLink | ~10 | 300+ |
| TreatmentConditionLink | ~40 | 400+ |
| AnatomyConditionLink | ~20 | 200+ |

**Actions:**
1. Create AI-powered seeder scripts for each junction table
2. Use Gemini API to extract relationships from existing content JSONB
3. Track `medicalContentId` in junction tables for full traceability

**Script**: `scripts/db/seed-junction-tables.ts`

**Priority Order**: Drug → Lab → Imaging → Finding → Anatomy → Treatment

---

### **Step 3: Question-to-Condition Linkage System** 🔴 P0
**Problem**: Questions don't reliably link to conditions, breaking per-condition analytics.

**Current State**:
```typescript
// In questionService.ts
const conditionId = poolQ.conditionId || condition.toLowerCase().replace(/\s+/g, '-');
// ^ Often generates fake IDs instead of linking to real conditions
```

**Actions:**
1. Add migration to require `conditionId` or `medicalContentId` on `Question` table
2. Create backfill script that analyzes question text to infer condition
3. Update question generation to ALWAYS include valid conditionId
4. Add validation in `/api/questions/pool` POST to reject questions without condition links

**Script**: `scripts/db/link-questions-to-conditions.ts`

**Expected Result**: Every question linked → per-condition accuracy tracking → better adaptive learning

---

### **Step 4: Create Guidelines & Screening Table** 🟡 P2
**Problem**: Screening conditions were removed but need a proper home.

**Orphaned Screenings**:
- Lung Cancer Screening
- Abdominal Aortic Aneurysm Screening
- Colorectal Cancer Screening
- Osteoporosis Screening

**Schema Addition**:
```prisma
model Guideline {
  id                String    @id
  name              String
  type              String    // 'screening', 'prevention', 'treatment'
  organization      String?   // 'USPSTF', 'AHA', 'IDSA'
  conditionId       String?
  criteria          Json?     // age, risk factors, frequency
  grade             String?   // A, B, C, D, I
  frequency         String?
  targetPopulation  String?
  evidenceLevel     String?
  panceYield        Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  Condition         Condition? @relation(fields: [conditionId], references: [id])

  @@index([type])
  @@index([organization])
  @@index([panceYield])
}
```

**Migration**: `prisma/migrations/XXX_add_guideline_table.sql`

---

### **Step 5: Add PostgreSQL Full-Text Search** 🟠 P1
**Problem**: Current searches use `LIKE` queries which are slow and don't handle medical synonyms.

**Current Implementation**:
```typescript
// functions/api/content/library.ts
where.OR = [
  { condition: { contains: search, mode: 'insensitive' } },
  { overview: { contains: search, mode: 'insensitive' } },
  { classic_patient: { contains: search, mode: 'insensitive' } },
];
```

**Improved Implementation**:
```sql
-- Add search vector column
ALTER TABLE "MedicalContent" ADD COLUMN search_vector tsvector;

-- Create GIN index
CREATE INDEX idx_medical_content_search ON "MedicalContent" USING GIN(search_vector);

-- Create trigger to auto-update
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.condition, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.buzzwords, ' '), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.classic_patient, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.symptoms, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.overview, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_update_search_vector
  BEFORE INSERT OR UPDATE ON "MedicalContent"
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();
```

**Expected Result**: 10-100x faster searches with better relevance

---

### **Step 6: Content Completeness Scoring & Dashboard** 🟡 P2
**Problem**: No visibility into which conditions need enrichment.

**Scoring Formula**:
```typescript
function calculateCompletenessScore(content: MedicalContent): number {
  const REQUIRED_FIELDS = ['overview', 'symptoms', 'treatment', 'diagnostics'];
  const HIGH_YIELD_FIELDS = [
    'gold_standard_dx', 'first_line_rx', 'buzzwords', 'classic_patient',
    'clinical_pearls', 'best_initial_test', 'classic_triad', 'pathophysiology',
    'etiology', 'epidemiology', 'physicalExam', 'riskFactors', 'complications',
    'prognosis', 'differentialDiagnosis', 'mnemonic'
  ];
  
  // Required fields: 60 points max
  const requiredScore = REQUIRED_FIELDS.filter(f => hasContent(content[f])).length / REQUIRED_FIELDS.length * 60;
  
  // High-yield fields: 40 points max
  const highYieldScore = HIGH_YIELD_FIELDS.filter(f => hasContent(content[f])).length / HIGH_YIELD_FIELDS.length * 40;
  
  return Math.round(requiredScore + highYieldScore);
}
```

**Dashboard Features**:
- System-by-system completeness chart
- Top 50 priority conditions to enrich
- Field-level completion rates
- Priority = `pance_yield * (100 - completenessScore)`

**Script**: `scripts/automation/jobs/contentCompleteness.ts`

---

### **Step 7: PreGeneratedQuestion Quality Pipeline** 🟡 P2
**Problem**: PreGeneratedQuestion has quality fields but no validation workflow.

**Existing Schema Fields** (already in place):
```prisma
model PreGeneratedQuestion {
  // Quality scoring
  qualityScore       Float?
  conditionAccuracy  Float?
  contentRelevance   Float?
  distracorQuality   Float?
  
  // Validation tracking
  validatedAt        DateTime?
  validatedBy        String?
  validationStatus   String    @default("pending")
  validationNotes    String?
  
  // Usage statistics
  timesServed        Int       @default(0)
  timesCorrect       Int       @default(0)
  flagCount          Int       @default(0)
  flagRate           Float?
}
```

**Actions:**
1. Create admin `/api/admin/question-review` endpoint
2. Build question review queue UI
3. Implement validation workflow: `pending` → `approved` | `rejected` | `needs_revision`
4. Auto-deprecate questions with `flagRate > 0.1`

**API Endpoint**: `functions/api/admin/question-review.ts`

---

### **Step 8: Media Asset Linking Campaign** 🟢 P3
**Problem**: MediaAsset table exists but <5% of conditions have linked images.

**Priority Systems for Images**:
| System | Image Type | Priority |
|--------|-----------|----------|
| Dermatology | Clinical photos | 🔴 Highest |
| Cardiology | ECG strips | 🔴 Highest |
| Radiology | X-ray/CT/MRI | 🟠 High |
| HEENT | Fundoscopy, otoscopy | 🟠 High |
| Orthopedics | X-ray, special tests | 🟡 Medium |

**Actions:**
1. Audit which high-yield conditions need images
2. Create bulk upload workflow
3. Populate `MedicalContentMedia` junction table
4. Track `usageType`: 'quiz' (clean) vs 'reference' (annotated)

**Script**: `scripts/media/audit-media-needs.ts`

---

### **Step 9: UserProgress & FSRS Consistency Audit** 🟢 P3
**Problem**: UserProgress may have stale/orphaned records.

**Audit Queries**:
```sql
-- UserProgress without valid MedicalContent
SELECT up.* FROM "UserProgress" up
LEFT JOIN "MedicalContent" mc ON up."conditionId" = mc.id
WHERE mc.id IS NULL;

-- Users with QuestionAttempts but no UserProgress
SELECT DISTINCT qa."userId", qa."conditionId"
FROM "QuestionAttempt" qa
LEFT JOIN "UserProgress" up ON qa."userId" = up."userId" AND qa."conditionId" = up."conditionId"
WHERE up.id IS NULL AND qa."conditionId" IS NOT NULL;

-- Stale UserProgress (no review in 90+ days with low stability)
SELECT * FROM "UserProgress"
WHERE "lastReviewAt" < NOW() - INTERVAL '90 days'
AND "fsrsCard"->>'stability' < '5';
```

**Script**: `scripts/db/audit-user-progress.ts`

---

### **Step 10: Automated Data Integrity Monitoring** 🟠 P1
**Problem**: No automated checks for data quality issues.

**Health Check Metrics**:
```typescript
interface DataHealthReport {
  timestamp: Date;
  
  // Junction table health
  junctionPopulation: {
    DrugConditionLink: { count: number; targetCoverage: number };
    LabConditionLink: { count: number; targetCoverage: number };
    // ...
  };
  
  // Question linking
  questionLinkRate: number;  // % of questions with valid conditionId
  orphanedQuestions: number;
  
  // Content completeness
  avgCompletenessScore: number;
  criticalMissing: number;  // Conditions missing required fields
  
  // Media coverage
  conditionsWithMedia: number;
  mediaCoverageRate: number;
  
  // User data
  orphanedUserProgress: number;
  staleFsrsRecords: number;
}
```

**Automation**:
- Weekly cron job via GitHub Actions
- Slack/email alerts for critical issues
- Health endpoint: `GET /api/admin/data-health`

**Script**: `scripts/automation/jobs/dataIntegrity.ts`

---

## Implementation Priority Matrix

| Step | Effort | Impact | Priority | Sprint |
|------|--------|--------|----------|--------|
| 3. Question-Condition Linking | Medium | Very High | 🔴 P0 | A |
| 1. Condition-MedicalContent Unify | Low | High | 🔴 P0 | A |
| 10. Data Integrity Monitor | Medium | High | 🟠 P1 | A |
| 2. Junction Table Population | High | Very High | 🟠 P1 | B |
| 5. Full-Text Search | Medium | High | 🟠 P1 | B |
| 6. Completeness Dashboard | Medium | Medium | 🟡 P2 | C |
| 7. Question Quality Pipeline | Medium | High | 🟡 P2 | C |
| 4. Guidelines Table | Low | Medium | 🟡 P2 | C |
| 8. Media Linking | High | Medium | 🟢 P3 | D |
| 9. UserProgress Audit | Low | Medium | 🟢 P3 | D |

---

## Sprint Plan

### Sprint A (Week 1-2): Foundation Fixes
- [ ] Step 1: Unify Condition ↔ MedicalContent
- [ ] Step 3: Link all questions to conditions  
- [ ] Step 10: Implement data integrity monitoring

### Sprint B (Week 3-4): Deep Linking & Search
- [ ] Step 2: Populate junction tables (Drug, Lab, Imaging)
- [ ] Step 5: Implement full-text search

### Sprint C (Week 5-6): Quality & Guidelines
- [ ] Step 4: Create Guidelines table
- [ ] Step 6: Build completeness dashboard
- [ ] Step 7: Question quality pipeline

### Sprint D (Week 7-8): Media & Cleanup
- [ ] Step 8: Media linking campaign
- [ ] Step 9: UserProgress/FSRS audit

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/db/unify-condition-medicalcontent.ts` | Step 1 |
| `scripts/db/seed-junction-tables.ts` | Step 2 |
| `scripts/db/link-questions-to-conditions.ts` | Step 3 |
| `scripts/db/audit-user-progress.ts` | Step 9 |
| `scripts/automation/jobs/dataIntegrity.ts` | Step 10 |
| `scripts/automation/jobs/contentCompleteness.ts` | Step 6 |
| `scripts/media/audit-media-needs.ts` | Step 8 |

---

## Related Documentation

- [DATABASE_CLEANUP_REPORT.md](./DATABASE_CLEANUP_REPORT.md) - Recent cleanup work
- [CONTENT_ENRICHMENT_SYSTEM.md](./CONTENT_ENRICHMENT_SYSTEM.md) - AI enrichment
- [HIERARCHY_IMPLEMENTATION.md](./HIERARCHY_IMPLEMENTATION.md) - Category hierarchy
- [PANCE_SYSTEM_ALIGNMENT.md](./PANCE_SYSTEM_ALIGNMENT.md) - System codes

---

**Report Generated:** January 13, 2026  
**Next Review:** After Sprint A completion
