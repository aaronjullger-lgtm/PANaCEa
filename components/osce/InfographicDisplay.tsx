/**
 * Infographic Display
 * 
 * Displays dynamically generated remediation infographics from info_genius.
 * Shows comparison infographics when student confuses concepts.
 */

import React, { useState } from 'react';
import { Image, Download, Maximize2, X } from 'lucide-react';
import type { GeneratedInfographic } from '@/types/smart-scribe-system';

interface InfographicDisplayProps {
  infographics: GeneratedInfographic[];
  className?: string;
}

export function InfographicDisplay({ infographics, className = '' }: InfographicDisplayProps) {
  const [selectedInfographic, setSelectedInfographic] = useState<GeneratedInfographic | null>(null);

  if (infographics.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Image className="w-6 h-6 text-[var(--color-accent)]" />
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
          Visual Learning Aids
        </h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {infographics.map((infographic) => (
          <div
            key={infographic.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
            onClick={() => setSelectedInfographic(infographic)}
          >
            <div className="aspect-video bg-[var(--color-bg-tertiary)] rounded-lg mb-3 flex items-center justify-center overflow-hidden">
              {infographic.imageUrl ? (
                <img
                  src={infographic.imageUrl}
                  alt={infographic.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-[var(--color-text-muted)] text-sm">
                  {infographic.status === 'generating' ? 'Generating...' : 'Image unavailable'}
                </div>
              )}
            </div>

            <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">
              {infographic.title}
            </h4>
            {infographic.description && (
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                {infographic.description}
              </p>
            )}

            {infographic.keyTakeaways.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  Key Takeaways:
                </div>
                <ul className="space-y-1">
                  {infographic.keyTakeaways.slice(0, 2).map((takeaway, i) => (
                    <li key={i} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1">
                      <span className="text-[var(--color-accent)]">•</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedInfographic(infographic);
                }}
              >
                <Maximize2 className="w-3 h-3" />
                View Full Size
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Full-Screen Modal */}
      {selectedInfographic && (
        <div
          className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedInfographic(null)}
        >
          <div
            className="bg-[var(--color-bg-primary)] rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
                  {selectedInfographic.title}
                </h3>
                {selectedInfographic.description && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {selectedInfographic.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedInfographic(null)}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            {selectedInfographic.imageUrl && (
              <div className="mb-6 bg-[var(--color-bg-secondary)] rounded-lg p-4">
                <img
                  src={selectedInfographic.imageUrl}
                  alt={selectedInfographic.title}
                  className="w-full h-auto"
                />
              </div>
            )}

            {selectedInfographic.keyTakeaways.length > 0 && (
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                  Key Takeaways
                </h4>
                <ul className="space-y-2">
                  {selectedInfographic.keyTakeaways.map((takeaway, i) => (
                    <li
                      key={i}
                      className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
                    >
                      <span className="text-[var(--color-accent)] font-bold">•</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              {selectedInfographic.imageUrl && (
                <a
                  href={selectedInfographic.imageUrl}
                  download={`${selectedInfographic.title}.png`}
                  className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
