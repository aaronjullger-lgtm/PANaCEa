# Medical Image Acquisition Strategy

## Photo Drill Requirements

**Quiz Mode** needs:
- Clean, un-annotated images
- High resolution (readable diagnostic quality)
- No arrows, labels, circles, or annotations
- Student must identify findings themselves

**Reference Mode** can use:
- Annotated images with labels/arrows
- Teaching diagrams
- Comparative images

## Image Sources by Quality Type

### ECG Images

**CLEAN (Quiz-suitable) Sources:**
1. **PhysioNet Databases** - Raw ECG recordings
   - MIT-BIH Arrhythmia Database
   - PTB Diagnostic ECG Database
   - European ST-T Database
   - URL pattern: https://physionet.org/content/{database}/
   
2. **ECG Wave-Maven (Harvard)** - Clean teaching ECGs
   - https://ecg.bidmc.harvard.edu/maven/mavenmain.asp
   - Requires case-by-case selection
   
3. **Dr. Smith's ECG Blog** - Many clean strips (check each)
   - https://hqmeded-ecg.blogspot.com/

4. **Queen's University ECG Learning** - Mixed (some clean)
   - https://ecg.queensu.ca/

**ANNOTATED (Reference-only) Sources:**
- LITFL ECG Library (most have annotations)
- ECGpedia
- Most Google Image results

### Radiology Images

**CLEAN (Quiz-suitable) Sources:**
1. **Radiopaedia** - Many have clean versions
   - Look for "Image" vs "Annotated" versions
   - Case images before annotations added
   
2. **MedPix** (NIH) - Military medical image database
   - https://medpix.nlm.nih.gov/
   - Original DICOM-quality images
   
3. **RSNA Case Collection**
   - https://cases.rsna.org/
   
4. **Eurorad** - European radiology cases
   - https://www.eurorad.org/

**ANNOTATED (Reference-only) Sources:**
- Most Radiopaedia case annotations
- RadiologyAssistant
- LearningRadiology.com

### Dermatology Images

**CLEAN (Quiz-suitable) Sources:**
1. **DermNet NZ** - Clinical photos (mostly clean)
   - https://dermnetnz.org/
   - High quality, well-licensed
   
2. **DermIS** - Dermatology Information System
   - https://www.dermis.net/
   
3. **Fitzpatrick's Atlas** - Clinical photos
   - (Licensed, may need permission)
   
4. **VisualDx** - Clinical decision support images
   - (Subscription required)

**ANNOTATED (Reference-only):**
- Most textbook figures
- Google Image results with labels

### Pathology / Histology

**CLEAN Sources:**
1. **PathPresenter** - Clean slides
2. **WebPath** - University of Utah
3. **PathologyOutlines** - Some clean images
4. **Libre Pathology** - Wiki with clean images

### Clinical Photos (Physical Exam Findings)

**CLEAN Sources:**
1. **Stanford Medicine 25**
2. **MedlinePlus Medical Encyclopedia**
3. **NEJM Images in Clinical Medicine** (subscription)

## Practical Workflow

### For Each Condition:

1. **Search for CLEAN version first**
   - Use source-specific searches
   - Verify NO annotations before adding
   
2. **If only annotated exists:**
   - Mark as `usageType: 'reference'`
   - Continue searching for clean version
   
3. **Create paired entries when possible:**
   - Clean version for quiz
   - Annotated version for learning

### Image Verification Checklist

Before adding any image, verify:
- [ ] No arrows or pointers
- [ ] No text labels on image
- [ ] No circles/boxes highlighting findings
- [ ] No "Answer" or diagnosis visible
- [ ] Resolution sufficient for diagnosis
- [ ] Appropriate license for use
- [ ] Source cited properly

### Technical Metadata to Track

```typescript
{
  isAnnotated: boolean,        // Has labels/arrows
  usageType: 'quiz' | 'reference' | 'both',
  resolution: { width, height },
  sourceQuality: 'verified' | 'curated' | 'auto',
  license: string,
  verifiedBy?: string,         // Who verified it's clean
  verifiedAt?: Date
}
```

## Priority Order for Acquisition

1. **ECG conditions** - Most testable, PhysioNet has raw data
2. **X-ray/CT findings** - Radiopaedia has good clean images
3. **Dermatology** - DermNet NZ is excellent
4. **Physical exam findings** - Harder to find clean
5. **Labs/pathology** - Usually diagrams (less useful for quiz)

## API Access Notes

- **PhysioNet**: Free, requires registration for some
- **Radiopaedia**: API available, attribution required
- **DermNet NZ**: CC BY-NC-ND, attribution required
- **MedPix**: Public domain (US Government)
- **OpenI NIH**: API unreliable (timeouts common)
