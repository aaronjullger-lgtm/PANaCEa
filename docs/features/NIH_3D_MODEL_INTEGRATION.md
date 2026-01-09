# NIH 3D Model Integration Guide

## Overview

This guide explains how to integrate 3D anatomical models from the NIH 3D Print Exchange into StudyPANaCEa for educational anatomy visualization.

> **Architecture Update (2026-01-09):** This system now uses a database-first architecture. 3D model metadata is stored in PostgreSQL via the `Anatomy3DModel` table, while GLB files are hosted on Supabase Storage.

## Source: NIH 3D Print Exchange

The NIH 3D Print Exchange (https://3d.nih.gov) provides free, scientifically-accurate 3D models that are in the public domain. These models are ideal for medical education.

### Key Resources
- **NIH 3D Print Exchange**: https://3d.nih.gov
- **NLM Visible Human Project**: https://www.nlm.nih.gov/research/visible/visible_human.html
- **NCBI Model Archive**: Search for anatomy models at https://www.ncbi.nlm.nih.gov

## File Formats Supported

| Format | Extension | Recommended | Notes |
|--------|-----------|-------------|-------|
| glTF Binary | `.glb` | ✅ Yes | Best for web, includes textures |
| glTF | `.gltf` | ✅ Yes | JSON format, textures separate |
| OBJ | `.obj` | ⚠️ Limited | Simple geometry only |
| STL | `.stl` | ⚠️ Limited | No color/texture support |
| FBX | `.fbx` | ❌ No | Requires conversion |

**Recommendation**: Use GLB format for best compatibility and performance.

## Adding a New Model

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
        'pulmonary veins'
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
        citationText: 'NIH 3D Print Exchange. Human Heart Detailed Model. https://3d.nih.gov/entries/3DPX-012345. Accessed [DATE].',
      },
      clinicalRelevance: [
        'Valve pathology visualization',
        'Coronary artery anatomy',
        'Cardiac chamber relationships'
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

<AnatomyModelViewer modelId="heart-basic" />
```

### With Custom Options

```tsx
<AnatomyModelViewer 
  modelId="heart-basic"
  showControls={true}
  showStructureList={true}
  showCitation={true}
  onStructureSelect={(structure) => console.log('Selected:', structure)}
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

{relatedModels.map(model => (
  <AnatomyModelViewer key={model.id} model={model} />
))}
```

## Future Enhancements

### Three.js Integration

When ready to add actual 3D rendering, install:

```bash
npm install three @react-three/fiber @react-three/drei
```

Then update `Model3DPlaceholder` in `AnatomyModelViewer.tsx` to use React Three Fiber.

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

1. **Model Size**: Keep GLB files under 10MB for good web performance
2. **Level of Detail**: Use simplified models for quick preview, detailed for zoom
3. **Lazy Loading**: Load models on-demand, not at page load
4. **Caching**: Models are cached in the service for repeat views

## Troubleshooting

### Model Not Loading
- Check file path is correct relative to `/public`
- Verify GLB file is not corrupted
- Check browser console for loading errors

### Poor Performance
- Reduce polygon count i