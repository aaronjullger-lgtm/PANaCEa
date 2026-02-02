/**
 * PDF coordinate utilities (shared by backend and frontend).
 * PDF uses bottom-left origin (72 DPI); viewers use top-left percentage.
 * Isomorphic: no Node/Prisma deps — safe for Edge and client.
 */

export interface PdfHighlightBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Convert PDF bounds (72 DPI, bottom-left origin) to percentage (top-left).
 * Used by Study Companion API and SmartPDFViewer for citation overlays.
 */
export function pdfBoundsToPercent(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number
): PdfHighlightBox {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return { top: 0, left: 0, width: 100, height: 5 };
  }
  const top = (1 - (y + height) / pageHeight) * 100;
  const left = (x / pageWidth) * 100;
  const w = (width / pageWidth) * 100;
  const h = (height / pageHeight) * 100;
  return {
    top: Math.max(0, Math.min(100, top)),
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(0, Math.min(100, w)),
    height: Math.max(0, Math.min(100, h)),
  };
}
