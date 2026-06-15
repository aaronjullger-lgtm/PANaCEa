# Higgsfield AI — PANaCEa Asset Prompt Sheet

**Environment status:** Higgsfield is connected via MCP but the workspace is on the **free plan
with 10 credits** — insufficient for production video/image batches. The signature visual was
therefore implemented as a **runtime 2D canvas** (`ClinicalLearningEngine.tsx`), which needs no
generated media and degrades gracefully. These prompts are production-ready for when credits are
available; each asset is optional enhancement, never required for comprehension.

## Global style spec
- Palette: deep navy / near-black (#020711–#10223a), clinical ivory highlights, restrained cyan
  (#67e8f9) and muted gold (#d8b25a) as sparse signal. No purple-blue startup gradients.
- Mood: cinematic, controlled, clinically literate, calm. Volumetric depth, fine blueprint grid,
  hairline edges, microscopic grain. Premium, not sci-fi.
- **Avoid (negative prompt, all assets):** faces, doctors, hospital rooms, glowing brains, DNA
  helices, floating pills, robot heads, neon cyberpunk, holograms, lens flares, text/letters,
  watermarks, two-snake caduceus, anatomically wrong structures, generic "AI particle" clouds.

---

### A1 — Hero ambient plate (poster + optional loop)
- **Purpose:** Subtle depth behind the Clinical Learning Engine on large screens.
- **Prompt:** "Cinematic macro view of a translucent clinical intelligence core coming online in
  deep navy void, faint concentric blueprint rings, hairline signal pathways converging inward,
  one soft muted-gold focus point, volumetric depth, fine grid texture, microscopic grain,
  editorial product photography lighting, calm and precise."
- **Aspect:** 16:9 (desktop), 1:1 crop for tablet.
- **Motion (if video):** 6–8s seamless loop, ~3% slow push-in, gentle ring drift. No cuts.
- **Placement:** `public/landing/hero-engine-plate.webp` behind the canvas at low opacity.
- **Fallback:** static `.webp` poster; omit entirely under `prefers-reduced-motion` / save-data.

### A2 — Anatomical contour transition (section divider)
- **Purpose:** Quiet divider between Diagnostic Path and Training Dock.
- **Prompt:** "Abstract translucent anatomical contour lines (thoracic silhouette) dissolving into
  a structured node lattice, deep ink background, single cyan signal trace, restrained, schematic,
  not a real organ, blueprint aesthetic."
- **Aspect:** 21:9 banner.
- **Fallback:** flat SVG contour already approximated by the Atlas medical grid.

### A3 — Blueprint risk macro (Intelligence section accent)
- **Prompt:** "Orbital blueprint bands of varying weight around a dark core, one band thickening
  and shifting into focus to signify risk, muted gold accent on the focused band, fine engineering
  grid, cinematic depth, calm clinical palette."
- **Aspect:** 4:3.
- **Fallback:** the canvas already renders weighted rings; this is optional marketing art.

---

## Optimization & delivery rules
1. Export `.webp`/`.avif`; cap hero plate ≤ 200KB, dividers ≤ 120KB.
2. Always ship a static poster frame; lazy-load below the fold.
3. No core copy or product meaning may depend on a generated asset loading.
4. Store under `public/landing/` with descriptive names; note "AI-generated (Higgsfield)" here.
