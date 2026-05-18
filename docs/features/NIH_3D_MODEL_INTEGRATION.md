# NIH 3D Model Integration Guide

## Overview

This guide explains how to integrate 3D anatomical models from the NIH 3D Print Exchange into StudyPANaCEa for educational anatomy visualization.

> **Architecture Update (2026-01-09):** This system now uses a database-first architecture. 3D model metadata is stored in PostgreSQL via the `Anatomy3DModel` table, while GLB files are hosted on Supabase Storage.

## Source: NIH 3D Print Exchange

The NIH 3D Print Exchange (https://3d.nih.gov) provides free anatomical 3D models with per-entry licensing. Some assets are public domain, while many Human Reference Atlas assets require CC-BY attribution. These models are useful for medical education when provenance, license, file size, and safe-use context are verified per asset.

### Key Resources

- **NIH 3D Print Exchange**: https://3d.nih.gov
- **NLM Visible Human Project**: https://www.nlm.nih.gov/research/visible/visible_human.html
- **NCBI Model Archive**: Search for anatomy models at https://www.ncbi.nlm.nih.gov

## File Formats Supported

| Format      | Extension | Recommended | Notes                           |
| ----------- | --------- | ----------- | ------------------------------- |
| glTF Binary | `.glb`    | ✅ Yes      | Best for web, includes textures |
| glTF        | `.gltf`   | ✅ Yes      | JSON format, textures separate  |
| OBJ         | `.obj`    | ⚠️ Limited  | Simple geometry only            |
| STL         | `.stl`    | ⚠️ Limited  | No color/texture support        |
| FBX         | `.fbx`    | ❌ No       | Requires conversion             |

**Recommendation**: Use GLB format for best compatibility and performance.

## Adding a New Model

### Current Checked-In Models

The current local integration includes licensed NIH 3D GLB models used inside the protected visualizer flow.

#### Human Heart

- `/public/models/nih/human-heart-3dpx-022787.glb`
- `/public/thumbnails/nih/human-heart-3dpx-022787.png`
- `/public/models/nih/human-heart-3dpx-022787.meta.json`
- Source entry: `3DPX-022787`
- License: Public Domain
- Fallback model id: `heart-basic`

#### Visible Human Heart Vessels and Lungs

- `/public/models/nih/visible-human-heart-lungs-3dpx-023212.glb`
- `/public/thumbnails/nih/visible-human-heart-lungs-3dpx-023212.png`
- `/public/models/nih/visible-human-heart-lungs-3dpx-023212.meta.json`
- Source entry: `3DPX-023212`
- License: CC-BY 4.0
- Fallback model id: `visible-human-heart-lungs`

#### Human Reference Atlas Left Kidney

- `/public/models/nih/hra-left-kidney-male-3dpx-021001.glb`
- `/public/thumbnails/nih/hra-left-kidney-male-3dpx-021001.png`
- `/public/models/nih/hra-left-kidney-male-3dpx-021001.meta.json`
- Source entry: `3DPX-021001`
- License: CC-BY 4.0
- Fallback model id: `hra-left-kidney-male`

#### Human Reference Atlas Liver

- `/public/models/nih/hra-liver-female-3dpx-020973.glb`
- `/public/thumbnails/nih/hra-liver-female-3dpx-020973.png`
- `/public/models/nih/hra-liver-female-3dpx-020973.meta.json`
- Source entry: `3DPX-020973`
- License: CC-BY 4.0
- Fallback model id: `hra-liver-female`

#### Human Reference Atlas Main Bronchus

- `/public/models/nih/hra-main-bronchus-female-3dpx-020976.glb`
- `/public/thumbnails/nih/hra-main-bronchus-female-3dpx-020976.png`
- `/public/models/nih/hra-main-bronchus-female-3dpx-020976.meta.json`
- Source entry: `3DPX-020976`
- License: CC-BY 4.0
- Fallback model id: `hra-main-bronchus-female`

#### Human Reference Atlas Pancreas

- `/public/models/nih/hra-pancreas-female-3dpx-020983.glb`
- `/public/thumbnails/nih/hra-pancreas-female-3dpx-020983.png`
- `/public/models/nih/hra-pancreas-female-3dpx-020983.meta.json`
- Source entry: `3DPX-020983`
- License: CC-BY 4.0
- Fallback model id: `hra-pancreas-female`

#### Human Reference Atlas Spleen

- `/public/models/nih/hra-spleen-female-3dpx-020989.glb`
- `/public/thumbnails/nih/hra-spleen-female-3dpx-020989.png`
- `/public/models/nih/hra-spleen-female-3dpx-020989.meta.json`
- Source entry: `3DPX-020989`
- License: CC-BY 4.0
- Fallback model id: `hra-spleen-female`

#### Human Reference Atlas Prostate

- `/public/models/nih/hra-prostate-male-3dpx-021015.glb`
- `/public/thumbnails/nih/hra-prostate-male-3dpx-021015.png`
- `/public/models/nih/hra-prostate-male-3dpx-021015.meta.json`
- Source entry: `3DPX-021015`
- License: CC-BY 4.0
- Fallback model id: `hra-prostate-male`

#### Human Reference Atlas Spinal Cord

- `/public/models/nih/hra-spinal-cord-female-3dpx-020988.glb`
- `/public/thumbnails/nih/hra-spinal-cord-female-3dpx-020988.png`
- `/public/models/nih/hra-spinal-cord-female-3dpx-020988.meta.json`
- Source entry: `3DPX-020988`
- License: CC-BY 4.0
- Fallback model id: `hra-spinal-cord-female`

#### Right Femur

- `/public/models/nih/right-femur-3dpx-016822.glb`
- `/public/thumbnails/nih/right-femur-3dpx-016822.png`
- `/public/models/nih/right-femur-3dpx-016822.meta.json`
- Source entry: `3DPX-016822`
- License: CC-BY 4.0
- Fallback model id: `right-femur`

Shared app metadata:

- `lib/anatomy/nihAnatomyAssets.ts`

Runtime:

- `components/anatomy/AnatomyModelViewer.tsx` shows a lightweight preview first.
- `components/anatomy/AnatomyModelCanvas.tsx` imports Three.js only after the user selects the 3D atlas scene. React Three Fiber was not used for this first runtime scene because its JSX type augmentation currently collides with existing icon components in the production TypeScript graph.
- `pages/VisualizerPage.tsx` lets the student choose between checked-in atlas scenes before loading WebGL.
- `npm run verify:anatomy-assets` checks local model files, thumbnails, metadata, hashes, registry wiring, service-worker precache exclusion, and model-size budgets.

### Step 1: Download from NIH

1. Go to https://3d.nih.gov
2. Search for the anatomical structure (e.g., "heart", "lung", "skeleton")
3. Download the model in GLB or GLTF format
4. Note the model ID (e.g., `3DPX-012345`)
5. Record citation information

### Step 2: Place Model Files

```
public/
├── models/
│   ├── heart-basic.glb
│   ├── lungs-basic.glb
│   └── skeleton-full.glb
└── thumbnails/
    ├── heart-basic.png
    ├── lungs-basic.png
    └── skeleton-full.png
```

### Step 3: Register Model in Service

Update `services/anatomyModelService.ts`:

```typescript
const SAMPLE_MODELS: Partial<Record<AnatomySystem, AnatomyModel[]>> = {
  cardiovascular: [
    {
      id: 'heart-detailed',
      name: 'Human Heart - Detailed Anatomy',
      description: 'High-resolution 3D model showing cardiac structures',
      system: 'cardiovascular',
      structures: [
        'left atrium',
        'right atrium',
        'left ventricle',
        'right ventricle',
        'mitral valve',
        'tricuspid valve',
        'aortic valve',
        'pulmonary valve',
        'coronary arteries',
        'pulmonary veins',
      ],
      modelUrl: '/models/heart-detailed.glb',
      format: 'glb',
      thumbnailUrl: '/thumbnails/heart-detailed.png',
      citation: {
        source: 'NIH 3D Print Exchange',
        modelId: '3DPX-012345',
        title: 'Human Heart Detailed Model',
        author: 'NIH 3D Print Exchange',
        institution: 'National Institutes of Health',
        license: 'Public Domain',
        url: 'https://3d.nih.gov/entries/3DPX-012345',
        dateAccessed: '2026-01-08',
        citationText:
          'NIH 3D Print Exchange. Human Heart Detailed Model. https://3d.nih.gov/entries/3DPX-012345. Accessed [DATE].',
      },
      clinicalRelevance: [
        'Valve pathology visualization',
        'Coronary artery anatomy',
        'Cardiac chamber relationships',
      ],
      relatedConditions: ['myocardial-infarction', 'mitral-regurgitation', 'aortic-stenosis'],
      scale: 1,
      defaultRotation: [0, 0, 0],
      highlightableStructures: ['left ventricle', 'coronary arteries', 'mitral valve'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};
```

## Citation Requirements

**Always cite NIH models properly.** The AnatomyModelViewer component includes built-in citation generation in AMA, APA, and MLA formats.

### Citation Format Examples

**AMA Format:**

> NIH 3D Print Exchange. Human Heart Model. NIH 3D Print Exchange. https://3d.nih.gov/entries/3DPX-012345. Accessed January 8, 2026.

**APA Format:**

> NIH 3D Print Exchange. (2026). Human Heart Model. NIH 3D Print Exchange. Retrieved January 8, 2026, from https://3d.nih.gov/entries/3DPX-012345

**MLA Format:**

> "Human Heart Model." NIH 3D Print Exchange, National Institutes of Health, https://3d.nih.gov/entries/3DPX-012345. Accessed 8 Jan. 2026.

## Usage in Components

### Basic Usage

```tsx
import { AnatomyModelViewer } from '../components/anatomy';

<AnatomyModelViewer modelId="heart-basic" />;
```

### With Custom Options

```tsx
<AnatomyModelViewer
  modelId="heart-basic"
  showControls={true}
  showStructureList={true}
  showCitation={true}
  onStructureSelect={setSelectedStructure}
  config={{
    enableRotation: true,
    enableZoom: true,
    autoRotate: false,
  }}
/>
```

### Embedded in Condition Detail

```tsx
import { anatomyModelService } from '../services/anatomyModelService';

// Get models related to a condition
const relatedModels = await anatomyModelService.getModelsForCondition('myocardial-infarction');

{
  relatedModels.map((model) => <AnatomyModelViewer key={model.id} model={model} />);
}
```

## Future Enhancements

### 3D Runtime

The protected anatomy viewer now lazy-loads raw Three.js through `AnatomyModelCanvas`.
React Three Fiber and drei are intentionally not part of the shipped runtime. Add them
only if a future approved design requires a broader React-based 3D scene graph.

### Database Integration

For production, models should be stored in the database:

```prisma
model AnatomyModel {
  id                    String   @id @default(cuid())
  name                  String
  description           String?
  system                String
  structures            Json     // String[]
  modelUrl              String
  format                String
  thumbnailUrl          String?
  citation              Json     // NIHCitation
  clinicalRelevance     Json?    // String[]
  relatedConditions     Json?    // String[]
  annotations           Json?    // ModelAnnotation[]
  scale                 Float    @default(1)
  defaultRotation       Json     @default("[0, 0, 0]")
  highlightableStructures Json?  // String[]
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

## Performance Considerations

1. **Model Size**: Keep each checked-in GLB under 8 MB and the total NIH GLB payload under 32 MB unless the verifier budget is deliberately changed
2. **Level of Detail**: Use simplified models for quick preview, detailed for zoom
3. **Lazy Loading**: Load models on-demand, not at page load
4. **Caching**: Models are cached in the service for repeat views

## Troubleshooting

### Asset Integrity Check

Run this after adding, replacing, or renaming any checked-in anatomy asset:

```bash
npm run verify:anatomy-assets
```

The verifier fails if a GLB, thumbnail, metadata file, SHA-256 hash, registry entry, service-worker precache rule, or model-size budget is inconsistent. If `dist/sw.js` is missing, run a production build first so the precache exclusion can be checked.

### Model Not Loading

- Check file path is correct relative to `/public`
- Verify GLB file is not corrupted
- Check browser console for loading errors

### Poor Performance

- Reduce polygon count in the source model
- Use compressed GLB format (Draco compression)
- Enable progressive loading

### Citation Not Displaying

- Ensure `showCitation` prop is true
- Verify citation data is complete in model metadata
