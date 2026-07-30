# Image Optimization Audit (Visual Diagnostics)

**Context:** Derm Recognition and Radiology Review (Screenshot 11) rely on high-res images. High-res X-rays (4MB+) kill data plans and load times; low-res X-rays are clinically useless for fracture detail.

## Requirement

1. **Zoom on demand**
   - Load a **lightweight thumbnail** (e.g. WEBP, ~50KB) initially.
   - Load the **lossless high-res** version (PNG/original) only when the user actively chooses "Zoom" / "View full resolution."

2. **Pre-loading**
   - While the user is on Question 1, **silently preload** the image for Question 2 in the background so the next card loads quickly.

## Implementation

### 1. API: Thumbnail + High-Res URLs

**`functions/api/drills/media.ts`**

- Each `PhotoCase` now includes:
  - **`imageUrl`** — Display URL; prefers thumbnail when available (for backward compatibility and fast initial load).
  - **`thumbnailUrl`** — Lightweight thumbnail URL (from `MediaAsset.thumbnailUrl`).
  - **`highResUrl`** — Full-resolution URL (from `MediaAsset.originalUrl`), for zoom-on-demand only.
- Mapping: `thumbnailUrl = asset.thumbnailUrl`, `highResUrl = asset.originalUrl`. If only one URL exists, it is used for display; `highResUrl` is set only when it differs from the display URL so the client can load it on demand.

### 2. Client: Thumbnail First, High-Res on Zoom

**`hooks/game/use-photo-drill.ts`**

- `PhotoCase` interface extended with optional `thumbnailUrl` and `highResUrl`.
- Fetch parses `response.data` when the API returns `{ data: PhotoCase[] }`.

**`components/session/PhotoDrillSession.tsx`**

- **Initial display:** Uses `thumbnailUrl || imageUrl` (resolved via `resolveImageUrl`) so the first paint is the lightweight image.
- **Zoom on demand:** When `highResUrl` is present, a "Full resolution" button is shown. On click, `requestHighRes` is set, the displayed `img` `src` switches to `highResUrl`, and the loading state is shown until the high-res image loads.
- **Pre-loading:** A `useEffect` preloads the **next** case’s thumbnail (or `imageUrl`) in the background using `new Image()` and `img.src = nextThumbnail`, so the next question’s image is already in the browser cache when the user advances.

### 3. Asset Pipeline (Content / Ops)

- **MediaAsset** in Prisma has `thumbnailUrl` and `originalUrl`. For zoom-on-demand to work:
  - Ingest/upload scripts should produce a **small thumbnail** (e.g. WEBP, ~50KB) and set `thumbnailUrl`.
  - Keep the **full-resolution** asset URL in `originalUrl`.
- If an asset has only one URL, the app uses it for display and does not show "Full resolution"; behavior remains correct.

### 4. Other Surfaces

- **PhotoDrillCard** (e.g. DermDrillSession / ImagingDrillSession using `photoDrill.service`): Already uses `thumbnailUrl` for a blur preview and `imageUrl` for the main image. Ensure the service populates both from MediaAsset when available; zoom-on-demand can be added later with the same pattern (thumbnail first, high-res on button click).
- **QuizView** (text questions with embedded images): If high-res images are used there, apply the same pattern: thumbnail or low-res first, high-res on zoom/expand.

## References

- `functions/api/drills/media.ts` — PhotoCase shape and thumbnail/highRes mapping.
- `hooks/game/use-photo-drill.ts` — PhotoCase type and fetch.
- `components/session/PhotoDrillSession.tsx` — Thumbnail-first display, "Full resolution" button, next-image preload.
- `prisma/schema.prisma` — `MediaAsset.thumbnailUrl`, `MediaAsset.originalUrl`.
