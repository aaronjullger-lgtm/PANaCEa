/**
 * SpatialAnswerCanvas
 *
 * Displays an image with a canvas overlay for drawing a bounding box.
 * Outputs (x, y, width, height) relative to image natural size, normalized 0-1000.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SpatialAnswerCanvasProps {
  readonly imageUrl: string;
  readonly imageAlt?: string;
  readonly onBoxComplete: (box: BoundingBox) => void;
  readonly correctBox?: [number, number, number, number] | null;
  readonly disabled?: boolean;
}

/** Convert pixel coords to normalized 0-1000 based on image dimensions */
function toNormalized(
  px: number,
  py: number,
  pw: number,
  ph: number,
  imgW: number,
  imgH: number
): BoundingBox {
  return {
    x: Math.round((px / imgW) * 1000),
    y: Math.round((py / imgH) * 1000),
    width: Math.round((pw / imgW) * 1000),
    height: Math.round((ph / imgH) * 1000),
  };
}

export function SpatialAnswerCanvas({
  imageUrl,
  imageAlt = 'Clinical image for spatial answer',
  onBoxComplete,
  correctBox,
  disabled = false,
}: SpatialAnswerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });

  const getImageCoords = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const img = imgRef.current;
      const cont = containerRef.current;
      if (!img || !cont) return null;
      const rect = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      if (x < 0 || y < 0 || x > img.naturalWidth || y > img.naturalHeight) return null;
      return { x, y };
    },
    []
  );

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    if (img.complete) onLoad();
    else img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, [imageUrl]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      const coords = getImageCoords(e);
      if (coords) {
        setIsDrawing(true);
        setStart(coords);
        setCurrent(coords);
      }
    },
    [disabled, getImageCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      const coords = getImageCoords(e);
      if (coords) setCurrent(coords);
    },
    [isDrawing, getImageCoords]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !start || !current) {
      setIsDrawing(false);
      setStart(null);
      setCurrent(null);
      return;
    }
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    if (w >= 5 && h >= 5) {
      const norm = toNormalized(x, y, w, h, imgSize.w, imgSize.h);
      onBoxComplete(norm);
    }
    setIsDrawing(false);
    setStart(null);
    setCurrent(null);
  }, [isDrawing, start, current, imgSize, onBoxComplete]);

  useEffect(() => {
    const handler = () => handleMouseUp();
    globalThis.addEventListener('mouseup', handler);
    return () => globalThis.removeEventListener('mouseup', handler);
  }, [handleMouseUp]);

  const displayBox = start && current ? (
    {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      w: Math.abs(current.x - start.x),
      h: Math.abs(current.y - start.y),
    }
  ) : null;

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Draw a box around the finding"
      className="relative inline-block max-w-full"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="relative">
        <img
          ref={imgRef}
          src={imageUrl}
          alt={imageAlt}
          className="max-w-full h-auto block rounded-lg border border-[var(--color-border)] select-none"
          draggable={false}
          style={{ userSelect: 'none', pointerEvents: disabled ? 'none' : 'auto' }}
        />
        {displayBox && (
          <div
            className="absolute border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/20 pointer-events-none"
            style={{
              left: (displayBox.x / imgSize.w) * 100 + '%',
              top: (displayBox.y / imgSize.h) * 100 + '%',
              width: (displayBox.w / imgSize.w) * 100 + '%',
              height: (displayBox.h / imgSize.h) * 100 + '%',
            }}
          />
        )}
        {correctBox && (
          <div
            className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
            style={{
              left: (correctBox[1] / 1000) * 100 + '%',
              top: (correctBox[0] / 1000) * 100 + '%',
              width: ((correctBox[3] - correctBox[1]) / 1000) * 100 + '%',
              height: ((correctBox[2] - correctBox[0]) / 1000) * 100 + '%',
            }}
          />
        )}
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mt-2">
        {disabled ? 'Draw complete' : 'Click and drag to draw a box around the finding'}
      </p>
    </div>
  );
}
