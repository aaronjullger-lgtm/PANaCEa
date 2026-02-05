/**
 * useBoundingBox: Clinical Eye (Phase 2) coordinate mapping.
 * Converts Gemini vision API bounding box [ymin, xmin, ymax, xmax] (normalized 0-1000)
 * into CSS top/left/width/height percentages or pixel values for overlay on the image.
 * Use toCSS(box) for % positioning; use toPixels(box, width, height) when container size is known.
 * Note: Gemini and Adobe PDF Extract use different coordinate systems; this hook is for Gemini 0-1000 only.
 */

export type BoundingBox1000 = [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000

export interface BoundingBoxCSS {
  top: string;
  left: string;
  width: string;
  height: string;
}

const SCALE = 1000;

/**
 * Convert [ymin, xmin, ymax, xmax] (0-1000) to CSS top/left/width/height as percentages.
 * Use when the overlay container has the same aspect ratio as the image (or is the image).
 */
export function boundingBox1000ToCSS(box: BoundingBox1000): BoundingBoxCSS {
  const [ymin, xmin, ymax, xmax] = box;
  const top = (ymin / SCALE) * 100;
  const left = (xmin / SCALE) * 100;
  const width = ((xmax - xmin) / SCALE) * 100;
  const height = ((ymax - ymin) / SCALE) * 100;
  return {
    top: `${top}%`,
    left: `${left}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

/**
 * Convert [ymin, xmin, ymax, xmax] (0-1000) to pixel values given container width and height.
 * Use when you need exact pixels (e.g. canvas or fixed-size container).
 */
export function boundingBox1000ToPixels(
  box: BoundingBox1000,
  containerWidth: number,
  containerHeight: number
): { top: number; left: number; width: number; height: number } {
  const [ymin, xmin, ymax, xmax] = box;
  return {
    top: (ymin / SCALE) * containerHeight,
    left: (xmin / SCALE) * containerWidth,
    width: ((xmax - xmin) / SCALE) * containerWidth,
    height: ((ymax - ymin) / SCALE) * containerHeight,
  };
}

/**
 * Hook: returns a function to convert API bounding_box to CSS and optional pixel values.
 * Pass container ref dimensions for pixel conversion.
 */
export function useBoundingBox(containerSize?: { width: number; height: number }) {
  const toCSS = boundingBox1000ToCSS;
  const toPixels = (box: BoundingBox1000) =>
    containerSize ? boundingBox1000ToPixels(box, containerSize.width, containerSize.height) : null;
  return { toCSS, toPixels };
}
