// components/photo-mode/PhotoViewer.tsx
// Full-screen image pan/zoom capability for medical image viewing

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { MediaAsset } from "../../types/photoMode";

interface PhotoViewerProps {
  media: MediaAsset;
  onImageLoaded?: () => void;
  onStartAnswering?: () => void;
  isInteractive?: boolean;
}

/**
 * PhotoViewer - Full-screen image viewer with pan/zoom for medical images
 * Follows radiology standard with dark mode
 */
const PhotoViewer: React.FC<PhotoViewerProps> = ({
  media,
  onImageLoaded,
  onStartAnswering,
  isInteractive = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset view when media changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsLoading(true);
  }, [media.id]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    onImageLoaded?.();
  }, [onImageLoaded]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!isInteractive) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.min(Math.max(0.5, prev + delta), 4));
    },
    [isInteractive]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isInteractive || scale <= 1) return;
      
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [isInteractive, scale, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (!isInteractive) return;
    
    if (scale !== 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  }, [isInteractive, scale]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.5, 0.5));
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isInteractive) return;
      
      switch (e.key) {
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "0":
          handleResetView();
          break;
        case " ":
        case "Enter":
          if (onStartAnswering) {
            e.preventDefault();
            onStartAnswering();
          }
          break;
      }
    },
    [isInteractive, handleZoomIn, handleZoomOut, handleResetView, onStartAnswering]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] bg-[#0d0d1a] rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role="img"
      aria-label={media.altText}
    >
      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d1a]">
          <div className="flex flex-col items-center gap-4">
            {/* Skeleton loader */}
            <div className="w-64 h-48 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 rounded-lg animate-pulse" />
            <div className="flex items-center gap-2 text-gray-400">
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">Loading medical image...</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Image */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
      >
        <img
          ref={imageRef}
          src={media.url}
          alt={media.altText}
          className={`max-w-full max-h-full object-contain select-none ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          style={{ transition: "opacity 0.3s ease-in-out" }}
          onLoad={handleImageLoad}
          draggable={false}
        />
      </div>

      {/* Image Info Badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="px-3 py-1 text-xs font-medium text-gray-300 bg-black/50 rounded-full backdrop-blur-sm uppercase tracking-wide">
          {media.type}
        </span>
        <span className="px-3 py-1 text-xs font-medium text-gray-300 bg-black/50 rounded-full backdrop-blur-sm">
          {media.system}
        </span>
      </div>

      {/* Zoom Controls */}
      {isInteractive && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-300 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
            aria-label="Zoom out"
            title="Zoom out (-)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
          </button>
          
          <span className="px-2 text-sm text-gray-300 bg-black/50 rounded-lg backdrop-blur-sm min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-300 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          
          <button
            onClick={handleResetView}
            className="p-2 text-gray-300 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
            aria-label="Reset view"
            title="Reset view (0)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Source Attribution */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500">
        Source: {media.source}
      </div>

      {/* Start Answering CTA */}
      {isInteractive && onStartAnswering && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <button
            onClick={onStartAnswering}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Ready to Diagnose
            <span className="ml-2 text-sm opacity-75">(Space/Enter)</span>
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      {isInteractive && (
        <div className="absolute top-4 right-4 text-xs text-gray-500 bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
          Double-click or scroll to zoom • Drag to pan
        </div>
      )}
    </div>
  );
};

export default PhotoViewer;
