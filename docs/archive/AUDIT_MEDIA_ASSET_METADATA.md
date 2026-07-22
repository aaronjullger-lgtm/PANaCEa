# Media & Asset Metadata Audit

**Date:** 2025-02-02  
**Scope:** Asset-First vs Question-First architecture, One-to-Many (One Image → Many Questions)

---

## 1. Audit Requirements

> **Asset-First vs Question-First:** Are images attached to questions, or are questions attached to images?
>
> **Asset Reuse Trap:** One ECG of A-Fib might support 3 questions (Diagnosis? Treatment? Complication?). The schema must support One-to-Many (One Image → Many Questions). Duplicating the image for every question bloats cache and bandwidth (critical for hospital/mobile use).

---

## 2. Current Architecture — MIXED

### Visual Diagnostics (ECG, Derm, Radiology)

| Mode | Architecture | Source | Link Type |
|------|--------------|--------|-----------|
| **Photo/Media Drill** | **Asset-First** | MediaAsset table | Asset IS the question |
| **ECG Drill** | Asset-First (via MediaAsset) | MediaAsset `type='ecg'` | Same as photo |
| **Derm Drill** | Asset-First (via MediaAsset) | MediaAsset `type='derm'` | Same as photo |

**Flow:** `GET /api/drills/media?modality=ecg` → fetches MediaAsset records → each asset becomes one PhotoCase (one question). No Question table involved.

### Text-based Questions with Images

| Model | Architecture | Image Storage |
|-------|--------------|---------------|
| **Question** | Question-First | No imageUrl column; no mediaAssetId |
| **PreGeneratedQuestion** | Question-First | `questionData` JSON may contain `imageUrl` (embedded) |

- Text questions that include images store the URL **inside** the question (JSON/vignette).
- No FK to MediaAsset. If the same image is used in multiple questions, the URL is duplicated per question.

---

## 3. One-to-Many Support — ❌ NOT IMPLEMENTED

### MediaAsset model

```prisma
model MediaAsset {
  correctDiagnosis  String?
  distractors       Json?
  explanation       String?
  // ... one quiz configuration per asset
}
```

- Each MediaAsset has **one** `correctDiagnosis` and **one** set of `distractors`.
- One asset → one question type (diagnosis).
- **No support** for "same image, different question types" (Diagnosis vs Treatment vs Complication).

### Duplication risk

To ask 3 questions about one A-Fib ECG today, you would need to:

1. Create 3 MediaAsset records with the same `originalUrl` → **image stored once**, but 3 DB rows and 3 quiz configs. No shared asset.
2. Or create 3 PreGeneratedQuestion records, each with `questionData.imageUrl` = same URL → **URL duplicated 3 times** in question JSON; image fetched 3× if not cached.

- Option 1: Slight bloat (3 rows) but one image URL.
- Option 2: URL duplication + potential cache/bandwidth waste if client doesn't dedupe.

Neither implements a proper **One Image → Many Questions** pattern with a shared asset and multiple question configs.

---

## 4. ECG/Derm — URL Arrays vs MediaAsset

### ECGConditionLink and ECGPattern

```prisma
model ECGConditionLink {
  exampleImageUrls   String[]  @default([])  // URLs stored per link
  annotatedImageUrls String[]  @default([])
}

model ECGPattern {
  exampleEcgUrl      String?
  annotatedEcgUrl    String?
  exampleImageUrls   String[]
  annotatedImageUrls String[]
}
```

- **URLs are embedded** in link/pattern rows, not FKs to MediaAsset.
- Same ECG image used in multiple ECGConditionLinks (e.g., A-Fib → Condition A, A-Fib → Condition B) → **URL duplicated** in each row.
- No shared asset; no deduplication.

### Media drill path

- Photo/ECG/Derm drill uses **MediaAsset** only.
- ECGConditionLink and ECGPattern are used for reference/library views, not for the media drill.
- So we have **two parallel representations**: MediaAsset (asset-first, used in drill) vs ECGConditionLink/ECGPattern (URL arrays, risk of duplication).

---

## 5. Junction Tables — CONTENT, NOT QUESTIONS

### MedicalContentMedia

```prisma
model MedicalContentMedia {
  medicalContentId String
  mediaAssetId     String
  relationship     String  // illustration, diagram, clinical_image, reference
}
```

- Links **MedicalContent** (condition) ↔ **MediaAsset**.
- Many-to-many: one condition can have many images; one image can illustrate many conditions.
- **No link to Question.** Cannot express "Question Q1 and Q2 both use MediaAsset M1."

### Missing: QuestionMediaAsset or MediaAssetQuestion

- No junction table for Question ↔ MediaAsset.
- Cannot represent "one image, many questions" in the schema.

---

## 6. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Asset-First (Photo/ECG/Derm drill) | ✅ | MediaAsset is source; asset = question |
| Question-First (text questions) | ✅ | Images in questionData JSON; no MediaAsset FK |
| One Image → Many Questions | ❌ | No schema support |
| MediaAsset supports multiple question types | ❌ | One correctDiagnosis per asset |
| Question ↔ MediaAsset junction | ❌ | None |
| MedicalContent ↔ MediaAsset | ✅ | MedicalContentMedia |
| ECG/Derm URL deduplication | ❌ | URLs in ECGConditionLink/ECGPattern arrays |
| Risk of image/URL duplication | ⚠️ | High when same image used in multiple questions/links |

---

## 7. Recommendations

### 1. Add QuestionMediaAsset junction (One Image → Many Questions)

```prisma
model QuestionMediaAsset {
  id            String   @id
  questionId    String   // or PreGeneratedQuestion, polymorphic
  mediaAssetId  String
  questionType  String   // 'diagnosis' | 'treatment' | 'complication' | 'next_step'
  displayOrder  Int      @default(0)
  // ...
  Question      Question @relation(...)
  MediaAsset    MediaAsset @relation(...)
  @@unique([questionId, mediaAssetId, questionType])
}
```

- One MediaAsset can have many QuestionMediaAsset rows (different question types).
- One Question can reference one MediaAsset.
- For "one image, many questions": multiple Question rows share the same `mediaAssetId` via this junction.

### 2. Extend MediaAsset for multiple question configs (alternative)

- Add `questionConfigs: Json?` — e.g. `[{ type: 'diagnosis', correctAnswer, distractors }, { type: 'treatment', ... }]`.
- Media drill would pick config by type; one asset serves multiple question types.
- Less normalized but avoids a new table.

### 3. Migrate ECG/Derm URLs to MediaAsset

- Replace `exampleImageUrls` in ECGConditionLink/ECGPattern with `mediaAssetId` (or junction to MediaAsset).
- Store each image once in MediaAsset; link via FK.
- Reduces URL duplication and aligns with asset-first model.

### 4. Client-side cache key by image URL

- Even before schema changes: ensure client caches images by URL so the same image is not re-fetched when reused across questions.

---

## 8. References

- MediaAsset: `prisma/schema.prisma`
- Media drill: `functions/api/drills/media.ts`
- MedicalContentMedia: `prisma/schema.prisma`
- ECGConditionLink, ECGPattern: `prisma/schema.prisma`
- Media integration: `docs/MEDIA_INTEGRATION.md`
