# Custom Study Sessions Feature Design

## Overview

This document outlines the design for two interconnected but distinct features:

1. **Custom Study Session Builder** - Multi-select content filters with Quizlet-style session behavior
2. **Bring Your Own Notes (BYON)** - Upload personal study materials and generate quizzes from them

Both features share a common trait: **NO FSRS TRACKING** - sessions are ephemeral practice, not spaced repetition.

---

## Feature 1: Custom Study Session Builder

### User Story

> "As a PA student, I want to create a focused study session where I can select multiple systems, subcategories, and conditions, then choose what aspects (anatomy, pharmacology, pathophysiology, management) to be tested on."

### Key Behaviors

1. **Multi-Select Content Filtering**
   - Select multiple organ systems (e.g., Cardiology + Pulmonology)
   - Drill down to specific subcategories (e.g., Arrhythmias + Heart Failure)
   - Select specific conditions (e.g., AFib, Heart Failure with Reduced EF)
   - Filter by content focus:
     - Anatomy & Physiology
     - Pathophysiology / Etiology
     - Clinical Presentation / Diagnosis
     - Pharmacology / Treatment
     - Management / Follow-up
     - Procedures / Special Tests

2. **Session Behavior (Quizlet-style)**
   - Sessions run in 10-question increments
   - Missed questions go to a "retry queue" at the end of the increment
   - No FSRS tracking - session state is ephemeral
   - User can exit at any time - progress is NOT saved
   - Show session stats at end (accuracy, time, weak areas)

3. **Differentiation from Existing Modes**
   - **System Mode**: Single system, FSRS-tracked, random conditions
   - **Subcategory Mode**: Single subcategory, FSRS-tracked
   - **Condition Mode**: Single condition deep-dive, FSRS-tracked
   - **Custom Study Session**: Multi-select, NO FSRS, Quizlet-style retry

### UI/UX Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Custom Study Session Builder                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Step 1: Select Content                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Systems (multi-select)                                       │ │
│  │ ☑ Cardiology  ☑ Pulmonology  ☐ GI  ☐ Neuro  ...             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Subcategories (filtered by selected systems)                 │ │
│  │ ☑ Arrhythmias  ☑ Heart Failure  ☐ Valvular  ...              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Conditions (optional - for ultra-focused sessions)          │ │
│  │ ☐ Atrial Fibrillation  ☐ HFrEF  ☐ HFpEF  ...                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Step 2: Choose Focus Areas                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ☑ Pathophysiology  ☑ Pharmacology  ☐ Anatomy                 │ │
│  │ ☑ Diagnosis        ☐ Management    ☐ Procedures              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Step 3: Session Settings                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Questions per increment: [10 ▼]                              │ │
│  │ Difficulty: ○ Easier  ● Standard  ○ Harder                   │ │
│  │ Retry missed questions: ☑                                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│                          [Start Session]                          │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Implementation

#### 1. New Types (`types/custom-session.ts`)

```typescript
export interface CustomSessionConfig {
  systems: SystemCode[];
  subcategories: string[];
  conditions: string[]; // condition IDs
  focusAreas: FocusArea[];
  questionsPerIncrement: number;
  difficulty: 'easier' | 'same' | 'harder';
  retryMissedQuestions: boolean;
}

export type FocusArea =
  | 'anatomy'
  | 'pathophysiology'
  | 'diagnosis'
  | 'pharmacology'
  | 'management'
  | 'procedures';

export interface CustomSessionState {
  config: CustomSessionConfig;
  currentIncrement: number;
  questionsAnswered: number;
  correctCount: number;
  retryQueue: Question[]; // Missed questions to retry
  sessionQuestions: Question[];
  isRetryPhase: boolean;
}
```

#### 2. New Service (`services/customSessionService.ts`)

```typescript
export const customSessionService = {
  /**
   * Generate questions for a custom session based on filters
   */
  async generateSessionQuestions(
    config: CustomSessionConfig
  ): Promise<Question[]>;

  /**
   * Track session state (localStorage only - ephemeral)
   */
  getSessionState(): CustomSessionState | null;
  saveSessionState(state: CustomSessionState): void;
  clearSessionState(): void;

  /**
   * Handle answer submission (no FSRS, just track for retry)
   */
  submitAnswer(questionId: string, isCorrect: boolean): void;

  /**
   * Get retry queue questions
   */
  getRetryQueue(): Question[];
};
```

#### 3. API Endpoint (`functions/api/questions/custom-session.ts`)

`POST /api/questions/custom-session` — authenticated, Zod-validated. See `docs/api/API_OVERVIEW.md` for the full contract.

**Request**

```json
{
  "body": {
    "config": {
      "systems": ["CV"],
      "subcategories": ["string"],
      "conditions": ["string"],
      "focusAreas": ["string"],
      "difficulty": "same | easier | harder"
    },
    "count": 10
  }
}
```

**Response**

```json
{
  "questions": [{ "id": "...", "question": "...", "options": [], "correctAnswerIndex": 0 }],
  "totalAvailable": 42,
  "warning": "optional string when pool is smaller than requested count"
}
```

No FSRS writes — ephemeral session only. Filter arrays are capped at 50 entries.

#### 4. New Components

```
components/custom-study/
├── CustomSessionBuilder.tsx      # Main builder UI
├── ContentFilterStep.tsx         # System/subcategory/condition multi-select
├── FocusAreaStep.tsx            # Focus area selection
├── SessionSettingsStep.tsx       # Questions per increment, difficulty
├── CustomSessionRunner.tsx       # The actual quiz interface
├── RetryPhaseIndicator.tsx       # Shows "Retry Phase" when reviewing missed
└── CustomSessionSummary.tsx      # End-of-session stats
```

---

## Feature 2: Bring Your Own Notes (BYON)

### User Story

> "As a PA student, I want to upload my lecture notes or slides and have the AI generate practice questions from them so I can study for my specific exams."

### Key Behaviors

1. **Upload Workflow**
   - Support PDF, DOCX, PPTX, TXT, images of notes
   - AI extracts key concepts and generates questions
   - Questions are stored for 1 month, then auto-deleted
   - User can manually delete earlier

2. **Generated Content**
   - Questions follow PANCE-style format
   - Tagged with user-defined labels (e.g., "Week 3 Cardio Exam")
   - Can be used in Custom Study Sessions

3. **Storage Limits**
   - Max 10 uploaded document sets per user
   - Each document set expires after 1 month
   - Total storage limit: 50MB per user

### UI/UX Design

```
┌─────────────────────────────────────────────────────────────────┐
│  My Study Materials                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ [+ Upload New Materials]                                    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Your Uploaded Materials (3/10 used)                              │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ 📄 Week 3 Cardio Lecture                                    │   │
│  │    Uploaded: Jan 3, 2026 • Expires: Feb 3, 2026             │   │
│  │    15 questions generated                                    │   │
│  │    [Study] [Edit] [Delete]                                  │   │
│  ├───────────────────────────────────────────────────────────┤   │
│  │ 📄 Pharmacology Exam 1 Notes                                │   │
│  │    Uploaded: Dec 28, 2025 • Expires: Jan 28, 2026           │   │
│  │    23 questions generated                                    │   │
│  │    [Study] [Edit] [Delete]                                  │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Implementation

#### 1. Database Schema

```prisma
model UserUploadedMaterial {
  id           String   @id @default(uuid())
  userId       String
  title        String
  fileType     String   // pdf, docx, pptx, txt
  fileSize     Int      // bytes
  storageKey   String   // Supabase storage key
  extractedText String? @db.Text
  createdAt    DateTime @default(now())
  expiresAt    DateTime // 1 month from creation

  questions    UserGeneratedQuestion[]

  user         User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}

model UserGeneratedQuestion {
  id            String   @id @default(uuid())
  materialId    String
  question      String   @db.Text
  options       Json     // string[]
  correctIndex  Int
  rationale     String?  @db.Text
  focusArea     String?  // anatomy, pharm, etc.
  createdAt     DateTime @default(now())

  material      UserUploadedMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@index([materialId])
}
```

#### 2. New Services

```typescript
// services/userMaterialsService.ts
export const userMaterialsService = {
  /**
   * Upload and process user materials
   */
  async uploadMaterial(
    userId: string,
    file: File,
    title: string
  ): Promise<UserUploadedMaterial>;

  /**
   * Generate questions from uploaded material
   */
  async generateQuestionsFromMaterial(
    materialId: string,
    options: {
      count: number;
      focusAreas: FocusArea[];
    }
  ): Promise<UserGeneratedQuestion[]>;

  /**
   * Get user's materials
   */
  async getUserMaterials(userId: string): Promise<UserUploadedMaterial[]>;

  /**
   * Delete material and associated questions
   */
  async deleteMaterial(materialId: string): Promise<void>;

  /**
   * Cleanup expired materials (cron job)
   */
  async cleanupExpiredMaterials(): Promise<void>;
};
```

#### 3. API Endpoints

```
functions/api/materials/
├── upload.ts           # POST - Upload file
├── [id].ts            # GET/DELETE - Get or delete material
├── [id]/generate.ts   # POST - Generate questions from material
├── [id]/questions.ts  # GET - Get questions for material
└── cleanup.ts         # POST - Cleanup expired (cron)
```

#### 4. New Components

```
components/user-materials/
├── MaterialsLibrary.tsx         # List of uploaded materials
├── UploadMaterialModal.tsx      # Upload flow
├── MaterialDetailView.tsx       # View material + questions
├── GenerateQuestionsForm.tsx    # Configure question generation
└── MaterialExpirationBadge.tsx  # Shows expiration date
```

---

## Implementation Plan

### Phase 1: Custom Study Session Builder (1 week)

- [ ] Create types and interfaces
- [ ] Build ContentFilterStep component with cascading multi-select
- [ ] Build FocusAreaStep component
- [ ] Build SessionSettingsStep component
- [ ] Create customSessionService
- [ ] Create API endpoint for fetching filtered questions
- [ ] Build CustomSessionRunner with retry queue logic
- [ ] Build CustomSessionSummary
- [ ] Add route and navigation

### Phase 2: Bring Your Own Notes (1 week)

- [ ] Add Prisma models for user materials
- [ ] Run database migration
- [ ] Create Supabase storage bucket for user uploads
- [ ] Build file upload service with text extraction
- [ ] Create AI question generation from text
- [ ] Build MaterialsLibrary component
- [ ] Build UploadMaterialModal
- [ ] Build MaterialDetailView
- [ ] Create cleanup cron job
- [ ] Add route and navigation

### Phase 3: Integration (2 days)

- [ ] Allow BYON questions in Custom Study Sessions
- [ ] Add "My Materials" as a content source option
- [ ] Polish UI/UX
- [ ] Write documentation

---

## Navigation Placement

**Proposed location in menu:**

```
📚 Training Modes
├── Daily Triad (recommended)
├── Rapid Recall
├── Question Mode
│   ├── By System
│   ├── By Subcategory
│   └── By Condition
├── ⭐ Custom Study Session  ← NEW
├── ⭐ My Study Materials    ← NEW
├── Grand Rounds
├── Photo Drill
└── ...
```

---

## Notes

1. **Custom Study Session is distinct from existing modes** - It doesn't replace System/Subcategory/Condition modes which are FSRS-tracked deep dives.

2. **BYON questions are ephemeral** - They're not part of the main question pool and don't affect FSRS progress.

3. **Focus areas require question tagging** - We need to ensure questions in the pool have focus area metadata.

4. **Storage costs** - Supabase storage for user uploads has costs; 50MB limit per user keeps this manageable.
