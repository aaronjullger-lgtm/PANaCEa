# 3D Anatomy Asset Inventory

Last updated: 2026-05-16

## Current Integrated Assets

### Human Heart - NIH 3D Atlas Model

- Local model: `/public/models/nih/human-heart-3dpx-022787.glb`
- Local thumbnail: `/public/thumbnails/nih/human-heart-3dpx-022787.png`
- Metadata: `/public/models/nih/human-heart-3dpx-022787.meta.json`
- App model id: `heart-basic`
- Source: NIH 3D, `3DPX-022787`
- Source URL: https://3d.nih.gov/entries/3DPX-022787?version=1.01
- License: Public Domain
- Author listed by NIH: Sourav Pan
- Model size: 3,986,136 bytes
- Thumbnail size: 27,259 bytes
- Model SHA-256: `67d65729bbe67b2d7d49f137e6d06f41dd79c504c9c5d7a975d641e60ed0caf5`
- Thumbnail SHA-256: `75274bdfd6287c6e65628e4cb73b64a49ccf8c1aefb488f24615661a1cc17cdf`

Download commands used:

```bash
curl -L --fail --show-error \
  --output /tmp/nih-heart-download \
  'https://3d.nih.gov/api/download?submissionId=28985&fileIds=738513'

curl -L --fail --show-error \
  --output /tmp/nih-heart-thumb-proxy.png \
  'https://3d.nih.gov/api/submissions/28985/runs/12647ffa-ff7b-4ce7-aeaf-7f069e6d0ea3/output-files/738518'
```

Safety notes:

- Use for educational spatial anatomy review only.
- Do not present as patient-specific anatomy, diagnostic evidence, treatment guidance, or a clinical decision aid.
- Keep WebGL loading on demand; the `/visualizer` page should not render Three.js until the user selects `Load 3D atlas scene`.

### Visible Human Heart Vessels and Lungs - NIH 3D Atlas Model

- Local model: `/public/models/nih/visible-human-heart-lungs-3dpx-023212.glb`
- Local thumbnail: `/public/thumbnails/nih/visible-human-heart-lungs-3dpx-023212.png`
- Metadata: `/public/models/nih/visible-human-heart-lungs-3dpx-023212.meta.json`
- App model id: `visible-human-heart-lungs`
- Source: NIH 3D, `3DPX-023212`
- Source URL: https://3d.nih.gov/entries/3DPX-023212
- License: CC-BY 4.0
- Author listed by NIH: kbrowne
- NIH description: anatomical model of the lungs, heart vessels, and trachea from the Visible Human male dataset.
- Model size: 2,590,240 bytes
- Thumbnail size: 73,548 bytes
- Model SHA-256: `c7a50781d5736ab1a3821a2824438e1a1232343908a03d3aba312fa8570ee90f`
- Thumbnail SHA-256: `cc109270dfeb06de9779a1860f37cfd8f9b14fa1c076121de8dcec36ce16a411`

Download commands used:

```bash
curl -L --fail --show-error \
  --output public/models/nih/visible-human-heart-lungs-3dpx-023212.glb \
  'https://3d.nih.gov/api/download?submissionId=29629&fileIds=765857'

curl -L --fail --show-error \
  --output public/thumbnails/nih/visible-human-heart-lungs-3dpx-023212.png \
  'https://3d.nih.gov/api/submissions/29629/runs/963581f3-9ea7-4451-a37e-7b76207bbd7d/output-files/765856'
```

Safety and attribution notes:

- Use for educational cardiopulmonary spatial anatomy review only.
- Do not present as patient-specific anatomy, diagnostic evidence, treatment guidance, or a clinical decision aid.
- Preserve CC-BY attribution in the citation panel and any redistribution notes.
- Keep WebGL loading on demand. This model is small enough for the protected visualizer flow, but it still should not be pulled into public first paint.

### Human Reference Atlas Left Kidney - NIH 3D Atlas Model

- Local model: `/public/models/nih/hra-left-kidney-male-3dpx-021001.glb`
- Local thumbnail: `/public/thumbnails/nih/hra-left-kidney-male-3dpx-021001.png`
- Metadata: `/public/models/nih/hra-left-kidney-male-3dpx-021001.meta.json`
- App model id: `hra-left-kidney-male`
- Source: NIH 3D, `3DPX-021001`
- Source URL: https://3d.nih.gov/entries/3DPX-021001
- License: CC-BY 4.0
- Author listed by NIH/HRA: Kristen Browne; Heidi Schlehlein
- NIH/HRA description: left kidney reference organ created from Visible Human Male source data.
- Model size: 1,536,532 bytes
- Thumbnail size: 21,622 bytes
- Model SHA-256: `733eef9ec169796196470e538dc248c4397bce0ff7ed679f7b7eb0bb9f185612`
- Thumbnail SHA-256: `7ba8a99ab16323b944ff86e64c1aaedccf614e6c33ad183f8df0b88275ad51d1`

Download commands used:

```bash
curl -fL \
  'https://3d.nih.gov/api/download?submissionId=29113&fileIds=741799' \
  -o public/models/nih/hra-left-kidney-male-3dpx-021001.glb

curl -fL \
  'https://3d.nih.gov/api/submissions/29113/runs/747b5529-024a-452e-91e0-7ef4c92b2252/output-files/741806' \
  -o public/thumbnails/nih/hra-left-kidney-male-3dpx-021001.png
```

Safety and attribution notes:

- Use for educational urinary-system spatial anatomy review only.
- Do not present as patient-specific anatomy, diagnostic evidence, treatment guidance, or a clinical decision aid.
- Preserve CC-BY attribution in the citation panel and any redistribution notes.

### Human Reference Atlas Liver - NIH 3D Atlas Model

- Local model: `/public/models/nih/hra-liver-female-3dpx-020973.glb`
- Local thumbnail: `/public/thumbnails/nih/hra-liver-female-3dpx-020973.png`
- Metadata: `/public/models/nih/hra-liver-female-3dpx-020973.meta.json`
- App model id: `hra-liver-female`
- Source: NIH 3D, `3DPX-020973`
- Source URL: https://3d.nih.gov/entries/3DPX-020973
- License: CC-BY 4.0
- Author listed by NIH/HRA: Kristen Browne
- NIH/HRA description: liver reference organ created from Visible Human Dataset source data.
- Model size: 1,738,032 bytes
- Thumbnail size: 28,126 bytes
- Model SHA-256: `ad9b0be0ff253e7bfe31bfffc00017dafce226d4f3e7804a81cbb4c2e269d598`
- Thumbnail SHA-256: `b0559458d409add1b325e8b60e89f19c3a11c36b39683de7bfad6a75a680bfdf`

Download commands used:

```bash
curl -fL \
  'https://3d.nih.gov/api/download?submissionId=29137&fileIds=742070' \
  -o public/models/nih/hra-liver-female-3dpx-020973.glb

curl -fL \
  'https://3d.nih.gov/api/submissions/29137/runs/46775e53-324a-4787-bffa-8ad212c16057/output-files/742072' \
  -o public/thumbnails/nih/hra-liver-female-3dpx-020973.png
```

Safety and attribution notes:

- Use for educational digestive-system spatial anatomy review only.
- Do not present as patient-specific anatomy, diagnostic evidence, treatment guidance, or a clinical decision aid.
- Preserve CC-BY attribution in the citation panel and any redistribution notes.

### Human Reference Atlas Main Bronchus - NIH 3D Atlas Model

- Local model: `/public/models/nih/hra-main-bronchus-female-3dpx-020976.glb`
- Local thumbnail: `/public/thumbnails/nih/hra-main-bronchus-female-3dpx-020976.png`
- Metadata: `/public/models/nih/hra-main-bronchus-female-3dpx-020976.meta.json`
- App model id: `hra-main-bronchus-female`
- Source: NIH 3D, `3DPX-020976`
- Source URL: https://3d.nih.gov/entries/3DPX-020976
- License: CC-BY 4.0
- Author listed by NIH/HRA: Kristen Browne; Heidi Schlehlein
- NIH/HRA description: main bronchus reference organ created from Visible Human Dataset source data.
- Model size: 2,858,776 bytes
- Thumbnail size: 41,397 bytes
- Model SHA-256: `c58e5b8fb61d982eb72f7385b6ce858e07e05766b0101ff0e15c7bc469cf60ff`
- Thumbnail SHA-256: `23e18ff384c97d3ba63b5e6572d664fe241af4002e793b47cc793bc8b55742d3`

Download commands used:

```bash
curl -fL \
  'https://3d.nih.gov/api/download?submissionId=29135&fileIds=742058' \
  -o public/models/nih/hra-main-bronchus-female-3dpx-020976.glb

curl -fL \
  'https://3d.nih.gov/api/submissions/29135/runs/e8af389a-ab4b-4318-8214-208e52fa93ab/output-files/742063' \
  -o public/thumbnails/nih/hra-main-bronchus-female-3dpx-020976.png
```

Safety and attribution notes:

- Use for educational airway and respiratory spatial anatomy review only.
- Do not present as patient-specific anatomy, diagnostic evidence, treatment guidance, or a clinical decision aid.
- Preserve CC-BY attribution in the citation panel and any redistribution notes.

### Human Reference Atlas Pancreas - NIH 3D Atlas Model

- Local model: `/public/models/nih/hra-pancreas-female-3dpx-020983.glb`
- Local thumbnail: `/public/thumbnails/nih/hra-pancreas-female-3dpx-020983.png`
- Metadata: `/public/models/nih/hra-pancreas-female-3dpx-020983.meta.json`
- App model id: `hra-pancreas-female`
- Source: NIH 3D, `3DPX-020983`
- Source URL: https://3d.nih.gov/entries/3DPX-020983
- License: CC-BY 4.0
- Author listed by NIH: HRA
- Model size: 714,668 bytes
- Thumbnail size: 27,001 bytes
- Model SHA-256: `edb41456634b8fc887e609520e0a59eb0626e0fd0faa88a5b40985bf358b626d`
- Thumbnail SHA-256: `0ce49ef1034e227d6a2924e9431ff1947e30286d4ed44462b4d24a24c79af722`

### Human Reference Atlas Spleen - NIH 3D Atlas Model

- Local model: `/public/models/nih/hra-spleen-female-3dpx-020989.glb`
- Local thumbnail: `/public/thumbnails/nih/hra-spleen-female-3dpx-020989.png`
- Metadata: `/public/models/nih/hra-spleen-female-3dpx-020989.meta.json`
- App model id: `hra-spleen-female`
- Source: NIH 3D, `3DPX-020989`
- Source URL: https://3d.nih.gov/entries/3DPX-020989
- License: CC-BY 4.0
- Author listed by NIH: HRA
- Model size: 276,712 bytes
- Thumbnail size: 23,394 bytes
- Model SHA-256: `e9ce0e379f86747c2d12ff56ea71a8389d97b7e1135c4e9ad1f6b4c32cf369d4`
- Thumbnail SHA-256: `b843356051e2286cfbd61ff1344f512815799cfe0462e4f154f2f88f0838d5fc`

### Human Reference Atlas Prostate - NIH 3D Atlas Model

- Local model: `/public/models/nih/hra-prostate-male-3dpx-021015.glb`
- Local thumbnail: `/public/thumbnails/nih/hra-prostate-male-3dpx-021015.png`
- Metadata: `/public/models/nih/hra-prostate-male-3dpx-021015.meta.json`
- App model id: `hra-prostate-male`
- Source: NIH 3D, `3DPX-021015`
- Source URL: https://3d.nih.gov/entries/3DPX-021015
- License: CC-BY 4.0
- Author listed by NIH: HRA
- Model size: 4,086,328 bytes
- Thumbnail size: 34,011 bytes
- Model SHA-256: `ec1023e0a1b81f71865872bb720404abc7bb6378a54ac71fa9f24579b097f48a`
- Thumbnail SHA-256: `9ed926442b110da42e6a812ac4d9b883278dd2c7488ed6bc3a4b8c86ab4459c9`

### Human Reference Atlas Spinal Cord - NIH 3D Atlas Model

- Local model: `/public/models/nih/hra-spinal-cord-female-3dpx-020988.glb`
- Local thumbnail: `/public/thumbnails/nih/hra-spinal-cord-female-3dpx-020988.png`
- Metadata: `/public/models/nih/hra-spinal-cord-female-3dpx-020988.meta.json`
- App model id: `hra-spinal-cord-female`
- Source: NIH 3D, `3DPX-020988`
- Source URL: https://3d.nih.gov/entries/3DPX-020988
- License: CC-BY 4.0
- Author listed by NIH: HRA
- Model size: 7,656,588 bytes
- Thumbnail size: 6,925 bytes
- Model SHA-256: `d9bfc840783a415068e34b8a1a9343fff40ad03d0025fafabf74f9d8664887f8`
- Thumbnail SHA-256: `94c003872cd6fdc6e4e07e53c1a3c7298251054283f141149238d3f9ded2ca70`

### Right Femur - NIH 3D Atlas Model

- Local model: `/public/models/nih/right-femur-3dpx-016822.glb`
- Local thumbnail: `/public/thumbnails/nih/right-femur-3dpx-016822.png`
- Metadata: `/public/models/nih/right-femur-3dpx-016822.meta.json`
- App model id: `right-femur`
- Source: NIH 3D, `3DPX-016822`
- Source URL: https://3d.nih.gov/entries/3DPX-016822
- License: CC-BY 4.0
- Author listed by NIH: My Segmenter
- Model size: 5,136,244 bytes
- Thumbnail size: 30,478 bytes
- Model SHA-256: `dbba662e58aea5f53a87161f71684ec8ab1398e169898eec9c3e1cbe2d5b5b56`
- Thumbnail SHA-256: `750e5bbc2385969cc75fd31fcee2a8fedfe0a238babbd11a48ba82499c882782`

Second-pass download commands used:

```bash
curl -fL 'https://3d.nih.gov/api/download?submissionId=29130&fileIds=742028' -o public/models/nih/hra-pancreas-female-3dpx-020983.glb
curl -fL 'https://3d.nih.gov/api/download?submissionId=29125&fileIds=741998' -o public/models/nih/hra-spleen-female-3dpx-020989.glb
curl -fL 'https://3d.nih.gov/api/download?submissionId=29100&fileIds=741686' -o public/models/nih/hra-prostate-male-3dpx-021015.glb
curl -fL 'https://3d.nih.gov/api/download?submissionId=29126&fileIds=742004' -o public/models/nih/hra-spinal-cord-female-3dpx-020988.glb
curl -fL 'https://3d.nih.gov/api/download?submissionId=22650&fileIds=497792' -o public/models/nih/right-femur-3dpx-016822.glb
```

Safety and attribution notes:

- Use these models for educational spatial anatomy review only.
- Do not present them as patient-specific anatomy, diagnostic evidence, treatment guidance, or clinical decision aids.
- Preserve CC-BY attribution in the citation panel and any redistribution notes.
- Keep all GLBs out of service-worker precache. Thumbnails and metadata may be cached; GLB scene payloads should remain explicitly requested.
- Keep checked-in GLBs inside the verifier budget: 8 MB per model and 32 MB total for the NIH atlas payload.

## Candidate Sources For Future Scenes

### NIH 3D

- URL: https://3d.nih.gov/
- Fit: preferred source for StudyPanacea anatomy assets because the repo already has NIH citation conventions.
- Useful candidates:
  - Heart Library and cardiovascular models.
  - Human Reference Atlas 3D Reference Object Library for expert-reviewed organs.
  - Brain models such as `3DPX-021159`, pending loader support or an approved conversion pipeline because the inspected entry exposed X3D/WRL/STL files rather than a GLB.
  - Skull models such as `3DPX-012260`, pending size-budget review because the inspected GLB is roughly 11.6 MB.
  - HRA brain model `3DPX-020960`, deferred because the inspected GLB is roughly 12.0 MB.
  - HRA skin model `3DPX-021016`, deferred because the inspected GLB is roughly 19.9 MB.

### Human Reference Atlas Collection

- URL: https://3d.nih.gov/collections/hra?tab=search
- Fit: strong candidate for organ-system atlas scenes because NIH describes the collection as expert-reviewed reference organs.
- Constraint: verify per-entry license, file size, and source/provenance before download.

### Sketchfab / Other CC Sources

- Fit: reserve for non-primary placeholders only.
- Constraint: verify license, attribution, commercial use terms, redistribution rights, and source credibility per asset. Avoid assets with promotional copy or unclear medical accuracy unless there is a specific approved use.

## Implementation Rules

- Store downloaded GLB files under `public/models/nih/`.
- Store thumbnails under `public/thumbnails/nih/`.
- Add a sibling `.meta.json` file for every model with source URL, license, access date, file size, SHA-256, and safe-use notes.
- Register app-visible metadata in `lib/anatomy/nihAnatomyAssets.ts`.
- Keep 3D renderer imports isolated to lazy components such as `components/anatomy/AnatomyModelCanvas.tsx`.
- Current implementation uses imperative Three.js rather than React Three Fiber because R3F's JSX type augmentation conflicts with existing Lucide icon components in the production TypeScript graph.
- Do not add 3D assets to landing first paint unless a specific phase approves the performance cost.
- Keep `vite.config.ts` Workbox ignores explicit for `**/models/**/*.glb` so checked-in anatomy files remain on-demand instead of service-worker install payload.
