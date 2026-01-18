# 🖼️ Medical Image Acquisition - Cline Task File

## Overview

This project needs medical images for **1,105+ conditions** in the database. Each condition may require **multiple images** (4-8 typically) covering:

- Primary diagnostic image
- Gold standard imaging
- Initial/first-line tests
- Key diagnostic findings

## 🚀 Quick Start Workflow

### Step 1: Generate Acquisition Plan

```bash
npm run images:plan <conditionId>
```

This queries the database and generates a comprehensive plan showing ALL images needed for a condition.

**Example output for Pulmonary Embolism:**

```
📸 IMAGE REQUIREMENTS (8):
1. [RADIOLOGY] primary    - "Pulmonary embolism CTPA"
2. [RADIOLOGY] supplementary - "chest X-ray Westermark sign"
3. [DIAGRAMS] supplementary  - "Hampton hump"
4. [ECG] supplementary       - "ECG S1Q3T3"
5. [RADIOLOGY] gold_standard - "CT Pulmonary Angiography (CTPA)"
6. [LABS] initial_test       - "D-dimer, ECG, CXR, ABG"
7. [RADIOLOGY] diagnostic_finding - "Hampton hump on chest X-ray"
8. [RADIOLOGY] diagnostic_finding - "Westermark sign"
```

### Step 2: Search for Each Image

⚠️ **CRITICAL: DO NOT use Google Image thumbnails** (`encrypted-tbn0.gstatic.com`) - these are low-quality thumbnails that will fail or look terrible.

**Required image sources (in order of preference):**

1. **Radiopaedia.org** - Best for radiology (CT, MRI, X-ray)
   - Navigate to the case page, find the full-resolution image
   - URL pattern: `https://radiopaedia.org/cases/...`
2. **Wikimedia Commons** - CC0/public domain medical images
   - Go to the file page, click "Full resolution"
   - URL pattern: `https://upload.wikimedia.org/wikipedia/commons/...`
3. **LITFL ECG Library** - High-quality ECGs
   - URL: `https://litfl.com/ecg-library/`
   - Download the image directly, upload from file
4. **DermNet NZ** - Dermatology images
   - URL: `https://dermnetnz.org`
5. **OpenI NIH** - Open access medical images
   - URL: `https://openi.nlm.nih.gov`

**Minimum quality requirements:**

- Resolution: At least **800x600 pixels** (ideally 1200+)
- Format: PNG or high-quality JPG
- Must show the actual diagnostic finding clearly

**Workflow:**

1. Go to the source website directly (not Google Images)
2. Search for the condition/finding
3. Find a case with clear, labeled images
4. Right-click → "Copy image address" on the FULL image (not thumbnail)
5. Verify the URL doesn't contain "thumb" or "thumbnail"

### Step 3: Upload Each Image

```bash
npm run images:upload -- --condition="Pulmonary Embolism" --url="<image_url>" --title="CTPA showing PE"
```

Or for local files:

```bash
npm run images:upload -- --condition="Pulmonary Embolism" --file="./downloads/pe-ctpa.jpg" --title="CTPA showing PE"
```

### Step 4: Check Progress

```bash
npm run images:status              # Overall progress
npm run images:list                # Conditions needing images
npm run images:list cardiology 10  # Filter by system
```

---

## 📊 Database-Driven Content

The upload script automatically pulls rich content from the database:

| Database Field      | Used For                                    |
| ------------------- | ------------------------------------------- |
| `image_query`       | Pre-written search queries (often multiple) |
| `gold_standard_dx`  | Gold standard diagnostic test               |
| `best_initial_test` | First-line diagnostic approach              |
| `diagnostics`       | Full workup including imaging findings      |
| `buzzwords`         | Key findings for tags                       |
| `clinical_pearls`   | Clinical context                            |
| `differentials`     | Related conditions for distractors          |

### What Gets Auto-Populated

When you upload an image, these fields are auto-filled from the database:

- ✅ `explanation` - From clinical_pearls + diagnostics
- ✅ `tags` - From buzzwords + condition name
- ✅ `clinicalContext` - From classic_patient + presenting symptoms
- ✅ `educationalNotes` - From clinical_pearls
- ✅ `difficulty` - Based on buzzword count
- ✅ `modality` - Auto-detected from image type

---

## 🎯 Image Priority System

Each condition's images have priority levels:

| Priority             | Meaning                               | Icon |
| -------------------- | ------------------------------------- | ---- |
| `primary`            | Must have - main diagnostic image     | 🔴   |
| `gold_standard`      | Critical - definitive diagnostic test | 🔴   |
| `initial_test`       | Critical - first-line workup          | 🔴   |
| `diagnostic_finding` | Important - specific findings         | 🟡   |
| `supplementary`      | Nice to have - additional context     | 🟡   |

**Acquisition Order:** Always get `primary` and `gold_standard` first!

---

## 🔍 Image Modalities

The system auto-detects modality from search terms:

| Modality      | Triggers                                     |
| ------------- | -------------------------------------------- |
| ECG           | ecg, ekg, electrocardiogram, rhythm strip    |
| RADIOLOGY     | x-ray, ct, mri, ultrasound, chest, abdominal |
| LABS          | lab, blood, smear, microscopy                |
| DERM          | skin, rash, lesion, dermoscopy               |
| PATHOLOGY     | histology, biopsy, cytology                  |
| OPHTHALMOLOGY | fundoscopy, retina, eye exam                 |
| DIAGRAMS      | diagram, illustration, pathway               |

---

## 📝 Example Full Workflow

### Condition: Aortic Dissection

**1. Generate plan:**

```bash
npm run images:plan aortic-dissection
```

**Output:**

```
📸 IMAGE REQUIREMENTS (4):
1. [RADIOLOGY] primary - "aortic dissection CT angiogram false lumen"
2. [RADIOLOGY] gold_standard - "CT Angiography (CTA)"
3. [RADIOLOGY] initial_test - "CT Angiography (CTA); Bedside TEE"
4. [RADIOLOGY] diagnostic_finding - "Widened mediastinum on chest X-ray"
```

**2. Search and upload each:**

```bash
# Primary CTA image
npm run images:upload -- --condition="Aortic Dissection" \
  --url="https://radiopaedia.org/cases/aortic-dissection-cta.jpg" \
  --title="CTA showing Stanford Type A dissection with false lumen"

# Widened mediastinum CXR
npm run images:upload -- --condition="Aortic Dissection" \
  --url="https://radiopaedia.org/cases/widened-mediastinum.jpg" \
  --title="Chest X-ray showing widened mediastinum"

# TEE image
npm run images:upload -- --condition="Aortic Dissection" \
  --url="https://echocardia.com/tee-dissection.jpg" \
  --title="TEE showing intimal flap"
```

---

## ⚠️ Common Condition Name Mappings

The upload script handles common medical abbreviations:

| Input                | Maps To                               |
| -------------------- | ------------------------------------- |
| AFib, AF             | Atrial Fibrillation                   |
| MI, Heart Attack     | Acute Myocardial Infarction           |
| PE                   | Pulmonary Embolism                    |
| DVT                  | Deep Vein Thrombosis                  |
| CHF                  | Congestive Heart Failure              |
| COPD                 | Chronic Obstructive Pulmonary Disease |
| Complete Heart Block | Third-Degree AV Block                 |
| DKA                  | Diabetic Ketoacidosis                 |
| TIA                  | Transient Ischemic Attack             |
| CVA, Stroke          | Ischemic Stroke                       |
| UTI                  | Urinary Tract Infection               |
| PNA, Pneumonia       | Community-Acquired Pneumonia          |

---

## 🛠️ Troubleshooting

### "Condition not found"

- Check exact spelling in database
- Try the condition ID instead (e.g., `atrial-fibrillation`)
- Use a common synonym from the mapping table

### "Upload failed"

- Verify URL is accessible (some sites block scraping)
- Try downloading locally first, then upload from file
- Check image format (supports: jpg, png, gif, webp)

### "Missing dimensions"

- For URLs: Some servers don't allow dimension detection
- For files: Ensure file path is correct and file exists

---

## 📈 Current Progress

Run `npm run images:status` to see:

- Total conditions in database
- Conditions with images
- Conditions needing images
- Breakdown by body system

**Goal:** At least 1 primary image per condition, ideally 3-4 images covering the diagnostic workup.

---

## 🔗 Recommended Image Sources

### Radiology

- [Radiopaedia](https://radiopaedia.org) - Best for CT, MRI, X-ray
- [OpenI NIH](https://openi.nlm.nih.gov) - Open access medical images
- [MedPix](https://medpix.nlm.nih.gov) - NIH image database

### ECG

- [ECG Library](https://litfl.com/ecg-library/) - Life in the Fast Lane
- [ECGpedia](https://ecgpedia.org)

### Dermatology

- [DermNet NZ](https://dermnetnz.org)
- [Dermoscopedia](https://dermoscopedia.org)

### General

- [Wikimedia Commons Medical](https://commons.wikimedia.org/wiki/Category:Medical_images)

---

## 💡 Tips for Cline

1. **Batch by system**: Work through one body system at a time (all cardiology, then pulmonology, etc.)

2. **Use the plan command**: Always run `npm run images:plan` first to see exactly what's needed

3. **Check existing images**: Before searching, verify the condition doesn't already have images

4. **Prefer CC0/open licenses**: For images from web sources, prioritize Creative Commons or public domain

5. **Include annotations**: When uploading, provide descriptive titles that explain what the image shows

6. **Multiple angles matter**: For conditions like fractures, both the X-ray AND the clinical photo may be needed

---

## 📋 Batch Processing Script

For processing multiple conditions at once:

```bash
# Get list of cardiology conditions needing images
npm run images:list cardiology 20

# Then for each condition, generate plan and acquire
for condition in "atrial-fibrillation" "aortic-dissection" "mitral-stenosis"; do
  echo "=== $condition ==="
  npm run images:plan $condition
done
```

---

**Last Updated:** 2025-01-06
**Author:** Copilot + Aaron
**Database:** Supabase MedicalContent table (1,105 conditions with image_query)
