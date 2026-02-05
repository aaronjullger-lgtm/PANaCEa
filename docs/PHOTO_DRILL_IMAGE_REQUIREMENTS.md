# Photo Drill Image Requirements

## Purpose

Photo Drill mode is designed to test a student's ability to **visually diagnose** conditions from medical images. This requires:

1. **Quiz images** - Clean, un-annotated images where the student must identify findings
2. **Reference images** - Annotated versions shown AFTER the student answers to teach them what to look for

## Critical Requirements

### For Quiz Mode (isAnnotated: false, usageType: 'quiz')

| Requirement              | Description                                         |
| ------------------------ | --------------------------------------------------- |
| **No annotations**       | No arrows, labels, circles, or text overlays        |
| **Diagnostic quality**   | High enough resolution to actually make a diagnosis |
| **Single finding focus** | Ideally showcases ONE key finding                   |
| **No watermarks**        | No identifying marks that distract                  |
| **Appropriate license**  | Must be usable for educational purposes             |

### Images That Should NOT Be Used for Quiz

❌ Images with arrows pointing to findings  
❌ Images with text labels (e.g., "ST elevation")  
❌ Images with circles/boxes highlighting areas  
❌ Google thumbnail images (low resolution)  
❌ Annotated textbook figures  
❌ Images with visible watermarks/credits

### For Reference Mode (isAnnotated: true, usageType: 'reference')

These images CAN have annotations and are shown AFTER the student answers:

- ✅ Teaching diagrams with labels
- ✅ Annotated versions of clinical images
- ✅ Side-by-side comparisons
- ✅ Images with arrows showing key findings

## Database Schema

```sql
-- Added to MediaAsset table
isAnnotated   BOOLEAN DEFAULT false  -- Does image have annotations?
usageType     TEXT DEFAULT 'quiz'    -- 'quiz', 'reference', or 'both'
```

## Image Selection Logic (API)

The `/api/drills/media` endpoint now filters:

```typescript
WHERE
  approvalStatus = 'approved'   // Canonical approval field (not status)
  AND isClinical = true
  AND correctDiagnosis IS NOT NULL
  AND (isAnnotated = false OR isAnnotated IS NULL)  -- Clean images only
  AND (usageType = 'quiz' OR usageType = 'both' OR usageType IS NULL)
```

## Quality Sources by Modality

### ECG (Clean)

| Source                   | Quality   | Notes                          |
| ------------------------ | --------- | ------------------------------ |
| PhysioNet                | Excellent | Raw recordings, no annotations |
| ECG Wave-Maven (Harvard) | Good      | Most strips are clean          |
| Dr. Smith's ECG Blog     | Mixed     | Check each individually        |

### ECG (Reference/Annotated)

| Source            | Quality   | Notes                                          |
| ----------------- | --------- | ---------------------------------------------- |
| LITFL ECG Library | Excellent | Most have annotations - USE FOR REFERENCE ONLY |
| ECGpedia          | Good      | Teaching annotations                           |

### Radiology (Clean)

| Source                 | Quality   | Notes                              |
| ---------------------- | --------- | ---------------------------------- |
| Radiopaedia (original) | Excellent | Look for non-annotated case images |
| MedPix (NIH)           | Excellent | Government images, public domain   |
| Wikimedia Commons      | Variable  | Verify no annotations              |

### Dermatology (Clean)

| Source     | Quality   | Notes                               |
| ---------- | --------- | ----------------------------------- |
| DermNet NZ | Excellent | Clinical photos without annotations |
| DermIS     | Good      | Clean clinical photos               |

## Workflow for Image Acquisition

### Step 1: Find Clean Image

1. Search source database for condition
2. Verify image has NO annotations
3. Verify resolution is diagnostic quality
4. Verify appropriate license

### Step 2: Add to Database

```typescript
{
  conditionId: "CV__ecg__atrial_fibrillation",
  type: "ECG",
  originalUrl: "https://...",
  correctDiagnosis: "Atrial Fibrillation",
  distractors: ["Sinus Tachycardia", "Atrial Flutter", "SVT"],
  isAnnotated: false,      // CRITICAL: Must be false for quiz
  usageType: "quiz",       // CRITICAL: Must be 'quiz' or 'both'
  explanation: "Look for: irregularly irregular R-R intervals, absence of P waves...",
  status: "approved",
  isClinical: true
}
```

### Step 3: (Optional) Add Reference Image

If an annotated teaching version exists:

```typescript
{
  conditionId: "CV__ecg__atrial_fibrillation",
  type: "ECG",
  originalUrl: "https://..._annotated.jpg",
  isAnnotated: true,       // Has annotations
  usageType: "reference",  // Only for learning mode
  // ... other fields
}
```

## Verification Checklist

Before approving any image for quiz mode:

- [ ] Resolution sufficient for diagnosis (>800px width recommended)
- [ ] No arrows or pointers on image
- [ ] No text labels overlaid on image
- [ ] No circles/boxes highlighting findings
- [ ] No diagnosis text visible
- [ ] Source and license documented
- [ ] `isAnnotated` set to `false`
- [ ] `usageType` set to `'quiz'` or `'both'`
- [ ] `correctDiagnosis` populated
- [ ] `distractors` array has 3+ plausible alternatives
- [ ] `explanation` describes what to look for

## API Reference

### GET /api/drills/media

Returns quiz-suitable images only (clean, un-annotated).

**Parameters:**

- `modality`: 'ecg' | 'derm' | 'radiology' (optional)
- `count`: number of images (default 20, max 100)

**Response:** `PhotoCase[]`

### Future Enhancement: Reference Images API

Not yet implemented - would return annotated images for post-answer learning:

```
GET /api/drills/media/reference?conditionId=CV__ecg__atrial_fibrillation
```
