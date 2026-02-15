/**
 * SmartImage - Medical image display with strict attribution
 *
 * Philosophy: Trust but verify. Always show source and license.
 * Only displays Hunter-Gatherer assets (Open-i, NLM, MedPix).
 */

import React, { useState } from 'react';
import { ExternalLink, Image as ImageIcon, ZoomIn, AlertCircle } from 'lucide-react';

interface SmartImageProps {
  src: string;
  alt: string;
  title?: string;
  source?: string;
  license?: string;
  attribution?: string;
  modality?: string;
  isClassic?: boolean;
  caption?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * SmartImage - Displays medical images with required attribution
 *
 * Features:
 * - Lazy loading
 * - Error states
 * - Source attribution (mandatory)
 * - License display
 * - Zoom preview on hover
 * - Classic portrayal badge
 */
export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  title,
  source,
  license,
  attribution,
  modality,
  isClassic,
  caption,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Parse source to determine if it's Hunter-Gatherer approved
  const isHunterGatherer =
    source?.toLowerCase().includes('open-i') ||
    source?.toLowerCase().includes('nlm') ||
    source?.toLowerCase().includes('medpix') ||
    attribution?.toLowerCase().includes('open-i') ||
    license?.toLowerCase().includes('open_access');

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  if (imageError) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border)] ${className}`}
      >
        <div className="aspect-video flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="w-8 h-8 text-[var(--color-text-muted)] mb-2" />
          <p className="text-sm text-[var(--color-text-muted)]">Image unavailable</p>
          {title && <p className="text-xs text-[var(--color-text-muted)] mt-1">{title}</p>}
        </div>
      </div>
    );
  }

  return (
    <figure
      className={`relative rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border)] group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={alt}
    >
      {/* Classic Portrayal Badge */}
      {isClassic && (
        <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-lg bg-amber-500/90 text-amber-50 text-xs font-bold backdrop-blur-sm">
          CLASSIC
        </div>
      )}

      {/* Modality Badge */}
      {modality && (
        <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg bg-[var(--color-bg-primary)]/80 text-[var(--color-text-primary)] text-xs font-medium backdrop-blur-sm border border-[var(--color-border)]">
          {modality.toUpperCase()}
        </div>
      )}

      {/* Image */}
      {onClick ? (
        <button
          type="button"
          className="relative aspect-video w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] rounded-t-xl"
          onClick={onClick}
          aria-label={`View full size: ${title || alt}`}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-[var(--color-text-muted)] animate-pulse" />
            </div>
          )}
          <img
            src={src}
            alt={alt}
            title={title}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="w-full h-full object-contain bg-slate-900/50 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Zoom indicator on hover */}
          {isHovered && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-overlay)]/70 backdrop-blur-sm transition-opacity">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-primary)]/90 text-[var(--color-text-primary)]">
                <ZoomIn className="w-4 h-4" />
                <span className="text-sm font-medium">View Full Size</span>
              </div>
            </div>
          )}
        </button>
      ) : (
        <div className="relative aspect-video">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-[var(--color-text-muted)] animate-pulse" />
            </div>
          )}
          <img
            src={src}
            alt={alt}
            title={title}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="w-full h-full object-contain bg-slate-900/50"
            loading="lazy"
          />
        </div>
      )}

      {/* Caption & Attribution (Mandatory) */}
      <div className="p-3 space-y-2 bg-[var(--color-bg-secondary)]/50 border-t border-[var(--color-border)]">
        {(title || caption) && (
          <p className="text-sm text-[var(--color-text-primary)] line-clamp-2">
            {title || caption}
          </p>
        )}

        {/* Source Attribution */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(source || attribution) && (
            <div className="flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3 text-[var(--color-text-muted)]" />
              <span className="text-[var(--color-text-muted)]">
                Source:{' '}
                <span className="text-[var(--color-text-primary)] font-medium">
                  {source || attribution}
                </span>
              </span>
            </div>
          )}

          {license && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
              {license}
            </span>
          )}

          {!isHunterGatherer && (source || attribution) && (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-medium">
              ⚠ Non-standard source
            </span>
          )}
        </div>
      </div>
    </figure>
  );
};

/**
 * ImageGallery - Grid layout for multiple SmartImage components
 */
interface ImageGalleryProps {
  images: Array<{
    id: string;
    src: string;
    alt: string;
    title?: string;
    source?: string;
    license?: string;
    attribution?: string;
    modality?: string;
    isClassic?: boolean;
    caption?: string;
  }>;
  columns?: 1 | 2 | 3 | 4;
  onImageClick?: (imageId: string) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  columns = 2,
  onImageClick,
}) => {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
        <ImageIcon className="w-12 h-12 text-[var(--color-text-muted)] mb-3" />
        <p className="text-sm text-[var(--color-text-muted)]">No images available</p>
      </div>
    );
  }

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {images.map((image) => (
        <SmartImage
          key={image.id}
          src={image.src}
          alt={image.alt}
          title={image.title}
          source={image.source}
          license={image.license}
          attribution={image.attribution}
          modality={image.modality}
          isClassic={image.isClassic}
          caption={image.caption}
          onClick={onImageClick ? () => onImageClick(image.id) : undefined}
        />
      ))}
    </div>
  );
};

export default SmartImage;
