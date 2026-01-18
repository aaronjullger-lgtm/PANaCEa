# PANaCEa Database Expansion & Content Automation Plan

## Executive Summary

This document outlines a comprehensive plan to expand the PANaCEa database with complete medical education content tables, content generation scripts, automated maintenance, and a robust question pooling system with fail-safe batch generation.

**Estimated Total Work**: 6 Phases over 4-6 weeks

---

## Phase 1: Schema Analysis & Table Creation (Current)

**Duration**: 2-3 days
**Priority**: CRITICAL

### 1.1 Current Database Tables Analysis

#### ✅ EXISTING & Adequate

| Table                   | Status             | Depth                    |
| ----------------------- | ------------------ | ------------------------ |
| `MedicalContent`        | ✅ Comprehensive   | 30+ fields               |
| `Drug`                  | ✅ Basic structure | Needs content generation |
| `AnatomyStructure`      | ✅ Basic structure | Needs expansion          |
| `SpecialTest`           | ✅ Good structure  | Needs content            |
| `LabTest` / `LabCase`   | ✅ Good            | Needs more cases         |
| `ACLSQuestion`          | ✅ Exists          | Needs content            |
| `AntibioticGuideline`   | ✅ Exists          | Needs expansion          |
| `ImagingStudy`          | ✅ Basic           | Needs content            |
| `PhysicalExamFinding`   | ✅ Basic           | Needs content            |
| `PhysiologyConcept`     | ✅ Good            | Needs content            |
| `Treatment`             | ✅ Basic           | Needs expansion          |
| `DifferentialDiagnosis` | ✅ Basic           | Needs content            |
| `PatientEncounterCase`  | ✅ Good            | Needs cases              |
| `ClinicalGuideline`     | ✅ Good            | Needs content            |

#### ❌ MISSING - Need to Create

| Table                  | Purpose                                | Priority |
| ---------------------- | -------------------------------------- | -------- |
| `HistoryComponent`     | HPI, PMH, SH, FH structured components | HIGH     |
| `ProcedureContent`     | Medical procedures step-by-step        | HIGH     |
| `DrugContent`          | Extended drug monographs               | HIGH     |
| `LabInterpretation`    | Lab value meanings by context          | MEDIUM   |
| `ECGPattern`           | ECG findings and associations          | HIGH     |
| `RadiologyPattern`     | Imaging findings per modality          | HIGH     |
| `ConfusedPair`         | Commonly confused conditions           | HIGH     |
| `BuzzwordHighYield`    | PANCE-specific buzzwords               | HIGH     |
| `TopDifferential`      | Top 5 DDx per chief complaint          | HIGH     |
| `ACLSAlgorithm`        | Full ACLS/BLS/PALS algorithms          | HIGH     |
| `AntibioticContent`    | Extended antibiotic details            | MEDIUM   |
| `QuestionPool`         | Pre-generated question bank            | HIGH     |
| `BatchGenerationQueue` | Queue for auto-generation              | HIGH     |
| `ContentLinkage`       | Cross-table relationships              | MEDIUM   |

### 1.2 Tables to Create (Detailed Schema)

```prisma
/// Extended drug monograph content for pharmacology drill
model DrugContent {
  id                    String   @id @default(uuid())
  drugId                String   @unique

  // Extended pharmacology
  pharmacokinetics      String?  @db.Text  // ADME
  pharmacodynamics      String?  @db.Text  // Drug-receptor interactions

  // Clinical details
  clinicalIndications   Json     // Detailed indications with evidence
  doseRanges            Json     // By indication, route, population
  administrationRoutes  String[]
  monitoring            String?  @db.Text  // Parameters to monitor
  adjustments           Json?    // Renal/hepatic dose adjustments

  // High-yield content
  boxedWarnings         String[]
  majorInteractions     Json     // Drug-drug interactions with severity
  testableFactoids      String[] // PANCE high-yield facts
  mnemonics             String?

  // Board-style associations
  buzzwords             String[]
  classicPatient        String?  // "Elderly patient with afib on..."
  adverseEffects        Json     // Categorized: Common, Serious, Rare

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  drug Drug @relation(fields: [drugId], references: [id])

  @@index([drugId])
}

/// Structured history taking components
model HistoryComponent {
  id                    String   @id @default(uuid())
  name                  String   @unique  // "Chest Pain HPI"
  category              String   // HPI, PMH, FH, SH, ROS
  system                String?  // CV, PULM, GI, etc.

  // HPI-specific (OPQRST, OLDCARTS)
  keyQuestions          String[] // Essential questions to ask
  redFlags              String[] // Must-not-miss symptoms
  riskFactors           String[]

  // Associated conditions
  relatedConditions     String[] // Condition IDs
  differentials         String[] // DDx to consider

  // Teaching
  clinicalPearls        String[]
  commonMistakes        String[] // What students miss

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([category])
  @@index([system])
}

/// Medical procedures with step-by-step details
model ProcedureContent {
  id                    String   @id @default(uuid())
  name                  String   @unique
  displayName           String?
  aliases               String[]

  category              String   // Diagnostic, Therapeutic, Surgical
  specialty             String   // EM, Surgery, IM, etc.
  urgency               String?  // Emergent, Urgent, Elective

  // Core content
  indications           String[]
  contraindications     Json     // Absolute vs Relative
  complications         Json     // By frequency

  // Step-by-step
  equipment             String[]
  preparation           String?  @db.Text
  steps                 Json     // Numbered steps with details
  postProcedure         String?  @db.Text

  // Educational
  tips                  String[] // Pro tips
  commonErrors          String[]
  alternativeProcedures String[]

  // Media
  imageUrl              String?
  videoUrl              String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([category])
  @@index([specialty])
}

/// ECG patterns and associations
model ECGPattern {
  id                    String   @id @default(uuid())
  name                  String   @unique  // "Tombstone ST elevation"

  // Pattern description
  morphology            String   @db.Text
  leads                 String[] // Which leads show the pattern
  rate                  String?  // Rate characteristics
  rhythm                String?  // Rhythm characteristics

  // Clinical associations
  diagnoses             String[] // Associated diagnoses
  conditions            String[] // Related condition IDs
  urgency               String   // Normal, Urgent, Emergent

  // Board content
  buzzwords             String[]
  mimics                String[] // Look-alike patterns
  clinicalPearls        String[]

  // Media
  exampleImageUrl       String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([name])
}

/// Radiology patterns by modality
model RadiologyPattern {
  id                    String   @id @default(uuid())
  name                  String   @unique  // "Hampton's Hump"

  modality              String   // XR, CT, MRI, US
  bodyRegion            String
  view                  String?  // PA, Lateral, Axial, etc.

  // Pattern
  appearance            String   @db.Text
  location              String?

  // Associations
  diagnoses             String[]
  differentials         String[]

  // High-yield
  buzzwords             String[]
  sensitivity           Float?
  specificity           Float?
  clinicalPearls        String[]

  // Media
  exampleImageUrl       String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([modality])
  @@index([bodyRegion])
}

/// Commonly confused condition pairs
model ConfusedPair {
  id                    String   @id @default(uuid())
  conditionA            String   // Condition ID
  conditionB            String   // Condition ID

  // Comparison
  similarities          String[] // What makes them confusing
  keyDifferences        Json     // { feature: [A_value, B_value] }

  // Distinguishing features
  discriminatingFindings Json    // What definitively separates them
  testToDistinguish     String?  // Best test to differentiate

  // Teaching
  mnemonic              String?
  clinicalPearl         String?

  // Stats
  confusionFrequency    Int      @default(0) // How often mistaken

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([conditionA, conditionB])
  @@index([conditionA])
  @@index([conditionB])
}

/// PANCE High-Yield Buzzwords (curated)
model BuzzwordHighYield {
  id                    String   @id @default(uuid())
  buzzword              String   @unique

  condition             String   // Primary condition
  conditionId           String?  // Link to condition
  system                String   // CV, PULM, etc.

  // Context
  context               String?  // When/why this buzzword appears
  pathophysiology       String?  @db.Text

  // Testing
  isPANCEClassic        Boolean  @default(true)
  frequency             String?  // How often on exams

  // Associations
  otherConditions       String[] // Other conditions with this buzzword
  relatedBuzzwords      String[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([condition])
  @@index([system])
}

/// Top 5 Differentials per chief complaint
model TopDifferential {
  id                    String   @id @default(uuid())
  chiefComplaint        String   @unique  // "Chest Pain"

  system                String?  // Primary system
  demographic           String?  // "Adult", "Pediatric", "Elderly"

  // The differentials (ordered by importance)
  top5                  String[] // Top 5 diagnoses
  mustNotMiss           String[] // Cannot miss diagnoses
  common                String[] // Most common causes

  // Decision support
  redFlags              String[]
  keyHistory            String[] // History that helps differentiate
  keyPhysicalExam       String[]
  initialWorkup         String[]

  // Teaching
  clinicalPearls        String[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([chiefComplaint])
  @@index([system])
}

/// ACLS/BLS/PALS Algorithms
model ACLSAlgorithm {
  id                    String   @id @default(uuid())
  name                  String   @unique  // "Pulseless VT/VF"

  protocol              String   // ACLS, BLS, PALS
  scenario              String   @db.Text

  // Algorithm
  steps                 Json     // Ordered steps with branch points
  medications           Json     // Drug, dose, route, timing
  shockEnergy           Json?    // Joules for each shock

  // Decision points
  branchLogic           Json     // If rhythm check shows X, go to Y

  // High-yield
  keyPoints             String[]
  commonErrors          String[]
  mnemonics             String[]

  // Media
  flowchartUrl          String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([protocol])
}

/// Question Pool for pre-generated questions
model QuestionPool {
  id                    String   @id @default(uuid())

  // Question content
  questionType          String   // vignette, mcq, rapid_recall, etc.
  mode                  String   // Training mode this is for
  system                String?
  conditionId           String?
  difficulty            String

  // The question
  questionData          Json     // Full question structure

  // Metadata
  aiModel               String?
  generatedAt           DateTime @default(now())
  qualityScore          Float?

  // Usage tracking
  usageCount            Int      @default(0)
  lastUsedAt            DateTime?
  isActive              Boolean  @default(true)

  // Validation
  status                String   @default("active") // active, retired, flagged

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([questionType])
  @@index([mode])
  @@index([system])
  @@index([isActive])
  @@index([usageCount])
}

/// Batch generation queue for fail-safe
model BatchGenerationQueue {
  id                    String   @id @default(uuid())

  // What to generate
  contentType           String   // question, drug_content, etc.
  targetTable           String   // Table to populate
  parameters            Json     // Generation parameters

  // Queue management
  priority              Int      @default(5) // 1-10
  status                String   @default("pending") // pending, processing, completed, failed
  scheduledFor          DateTime @default(now())

  // Tracking
  requestedBy           String?  // User ID or "system"
  reason                String?  // Why generation was triggered
  quantity              Int      @default(10) // How many to generate

  // Results
  generatedCount        Int      @default(0)
  failedCount           Int      @default(0)
  completedAt           DateTime?
  error                 String?  @db.Text

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([status])
  @@index([priority, scheduledFor])
  @@index([contentType])
}

/// Cross-table content linkages
model ContentLinkage {
  id                    String   @id @default(uuid())

  // Source
  sourceTable           String   // MedicalContent, Drug, etc.
  sourceId              String

  // Target
  targetTable           String
  targetId              String

  // Relationship
  relationshipType      String   // treats, diagnoses, causes, etc.
  strength              Float?   // 0-1 strength of association
  bidirectional         Boolean  @default(false)

  // Validation
  validated             Boolean  @default(false)
  validatedBy           String?

  createdAt             DateTime @default(now())

  @@unique([sourceTable, sourceId, targetTable, targetId, relationshipType])
  @@index([sourceTable, sourceId])
  @@index([targetTable, targetId])
}
```

---

## Phase 2: Enhanced Existing Table Columns

**Duration**: 1 day

### 2.1 Drug Table Enhancements

Add to existing `Drug` model:

```prisma
// Add to Drug model
  pharmacokinetics      Json?    // ADME data
  doseRanges            Json?    // By indication
  monitoring            String[] // Labs to monitor
  boxedWarnings         String[]
  majorInteractions     String[]
  testableFactoids      String[] // PANCE high-yield
  classicPatient        String?  // Board vignette archetype
```

### 2.2 AnatomyStructure Enhancements

```prisma
// Add to AnatomyStructure
  relatedProcedures     String[]
  associatedTests       String[] // Physical exam tests
  landmarks             String[] // Surface anatomy landmarks
  variations            String?  @db.Text // Anatomical variants
```

### 2.3 PhysicalExamFinding Enhancements

```prisma
// Add to PhysicalExamFinding
  technique             String?  @db.Text
  normalFinding         String?
  abnormalVariants      Json     // Different abnormalities
  associatedConditions  String[]
  sensitivity           Float?
  specificity           Float?
  videoUrl              String?
```

---

## Phase 3: Seed Data (10 Examples Each)

**Duration**: 2-3 days

Create medically accurate seed data for each new table:

- DrugContent: 10 high-yield drugs (Metformin, Lisinopril, etc.)
- HistoryComponent: 10 common HPI patterns
- ProcedureContent: 10 common procedures (LP, Central Line, etc.)
- ECGPattern: 10 classic patterns (STEMI, AFib, etc.)
- RadiologyPattern: 10 classic findings
- ConfusedPair: 10 commonly confused pairs
- BuzzwordHighYield: 100 classic buzzwords
- TopDifferential: 20 chief complaints
- ACLSAlgorithm: All core ACLS/BLS/PALS algorithms

---

## Phase 4: Content Generation Scripts

**Duration**: 3-4 days

### 4.1 Script Architecture

Create parallel maintenance scripts for each content type:

```
scripts/
├── maintenance/
│   ├── drug-content-doctor.ts
│   ├── procedure-content-doctor.ts
│   ├── history-component-doctor.ts
│   ├── ecg-pattern-doctor.ts
│   ├── radiology-pattern-doctor.ts
│   ├── buzzword-doctor.ts
│   ├── ddx-doctor.ts
│   ├── acls-doctor.ts
│   └── linkage-doctor.ts
├── weekly-maintenance-expanded.ts (orchestrates all)
└── batch-generator.ts (fail-safe system)
```

---

## Phase 5: Automation & Maintenance

**Duration**: 2-3 days

### 5.1 Weekly Maintenance Expansion

Extend `weekly-maintenance.ts` to include:

- All new content tables
- Cross-table linkage validation
- Question pool replenishment
- Batch generation queue processing

### 5.2 Question Pool Management

- Monitor pool levels by mode/system
- Trigger batch generation when < threshold
- Quality assessment for generated questions

---

## Phase 6: Question Pooling & Fail-Safe System

**Duration**: 2-3 days

### 6.1 Question Pool Architecture

```
User Request → Check Pool → Serve Question → Record Usage → Monitor Levels
                                                                ↓
                                              Level < Threshold? → Queue Batch Generation
```

### 6.2 Fail-Safe Triggers

1. **Per-User Threshold**: User has < 20 unseen questions in any mode
2. **Global Pool Threshold**: Mode has < 100 available questions
3. **Scheduled Replenishment**: Weekly pool top-up
4. **Emergency Generation**: Real-time generation as fallback (last resort)

### 6.3 Batch Generation Queue

- Priority queue by urgency
- Background processing
- Quality gates before adding to pool
- Automatic retry on failure

---

## Implementation Order

### Week 1: Phase 1 (Schema & Tables)

- [x] Analyze existing schema
- [ ] Create migration with new tables
- [ ] Update Prisma client
- [ ] Verify table creation

### Week 2: Phases 2-3 (Enhancements & Seed Data)

- [ ] Add columns to existing tables
- [ ] Create seed data files
- [ ] Run seed scripts
- [ ] Verify data integrity

### Week 3: Phase 4 (Content Generation)

- [ ] Build content-doctor variants
- [ ] Test on single table
- [ ] Expand to all tables
- [ ] Quality assessment

### Week 4: Phases 5-6 (Automation & Pooling)

- [ ] Integrate into weekly maintenance
- [ ] Build question pool service
- [ ] Implement fail-safe triggers
- [ ] End-to-end testing

---

## Success Metrics

### Content Coverage

- [ ] 100% of drugs have extended content
- [ ] 100% of anatomy has clinical significance
- [ ] 100+ ACLS questions in pool
- [ ] 500+ questions per major mode

### Quality

- [ ] All content AI-generated passes quality threshold
- [ ] < 1% error rate on cross-table linkages
- [ ] User never sees "no questions available"

### Performance

- [ ] Question fetch < 100ms
- [ ] Batch generation < 5 min for 50 questions
- [ ] Weekly maintenance < 4 hours

---

## Risk Mitigation

1. **API Rate Limits**: Implement exponential backoff, use Flash for bulk
2. **Data Quality**: AI grading before adding to live tables
3. **User Experience**: Always have fallback content
4. **Cost Management**: Prioritize high-yield content first

---

## Next Action (Phase 1, Step 1)

Create Prisma migration with all new tables. Start with:

1. DrugContent
2. HistoryComponent
3. ProcedureContent
4. ECGPattern
5. RadiologyPattern
6. ConfusedPair
7. BuzzwordHighYield
8. TopDifferential
9. ACLSAlgorithm
10. QuestionPool
11. BatchGenerationQueue
12. ContentLinkage

Then enhance existing tables (Drug, AnatomyStructure, PhysicalExamFinding).
