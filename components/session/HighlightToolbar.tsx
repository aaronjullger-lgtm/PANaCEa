/**
 * HighlightToolbar — Floating annotation toolbar for quiz sessions.
 *
 * Provides highlight (with color choices), strikethrough, and clear buttons.
 * Matches the real PANCE exam interface tools for test-day muscle memory.
 *
 * Keyboard shortcuts: H = highlight mode, S = strikethrough mode, Escape = deactivate
 *
 * @see hooks/useQuestionAnnotations.ts
 * @see components/session/QuizView.tsx
 */

'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Highlighter, Strikethrough, Eraser } from 'lucide-react';
import type { AnnotationMode, HighlightColor } from '@/hooks/useQuestionAnnotations';

interface HighlightToolbarProps {
  activeMode: AnnotationMode;
  activeColor: HighlightColor;
  onToggleMode: (mode: AnnotationMode) => void;
  onSetColor: (color: HighlightColor) => void;
  onClear: () => void;
  className?: string;
}

const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: 'color-mix(in srgb, var(--color-data-provisional) 30%, transparent)',
  green: 'color-mix(in srgb, var(--color-data-pass) 30%, transparent)',
  blue: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
};

export function HighlightToolbar({
  activeMode,
  activeColor,
  onToggleMode,
  onSetColor,
  onClear,
  className = '',
}: HighlightToolbarProps) {
  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        onToggleMode('highlight');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onToggleMode('strikethrough');
      } else if (e.key === 'Escape') {
        onToggleMode('none');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMode]);

  return (
    <div
      className={`flex items-center gap-1.5 p-1.5 rounded-lg border shadow-sm ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
      role="toolbar"
      aria-label="Annotation tools"
    >
      {/* Highlight button */}
      <button
        onClick={() => onToggleMode('highlight')}
        className={`p-2 rounded-md text-xs font-medium transition-all ${
          activeMode === 'highlight'
            ? 'ring-2 ring-[var(--color-accent)]'
            : ''
        }`}
        style={{
          backgroundColor: activeMode === 'highlight'
            ? COLOR_MAP[activeColor]
            : 'transparent',
          color: 'var(--color-text-primary)',
        }}
        aria-label="Toggle highlight mode (H)"
        aria-pressed={activeMode === 'highlight'}
        title="Highlight text (H)"
      >
        <Highlighter className="w-4 h-4" />
      </button>

      {/* Color picker (visible when highlight mode active) */}
      <AnimatePresence>
        {activeMode === 'highlight' && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex items-center gap-1 overflow-hidden"
          >
            {(Object.keys(COLOR_MAP) as HighlightColor[]).map((color) => (
              <button
                key={color}
                onClick={() => onSetColor(color)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  activeColor === color ? 'scale-125 border-[var(--color-accent)]' : 'border-transparent'
                }`}
                style={{ backgroundColor: COLOR_MAP[color] }}
                aria-label={`${color} highlight`}
                title={`${color.charAt(0).toUpperCase() + color.slice(1)} highlight`}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--color-border)' }} />

      {/* Strikethrough button */}
      <button
        onClick={() => onToggleMode('strikethrough')}
        className={`p-2 rounded-md text-xs font-medium transition-all ${
          activeMode === 'strikethrough'
            ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-bg-tertiary)]'
            : ''
        }`}
        style={{ color: 'var(--color-text-primary)' }}
        aria-label="Toggle strikethrough mode (S)"
        aria-pressed={activeMode === 'strikethrough'}
        title="Strikethrough answers (S)"
      >
        <Strikethrough className="w-4 h-4" />
      </button>

      {/* Clear button */}
      <button
        onClick={onClear}
        className="p-2 rounded-md transition-colors hover:bg-[var(--color-bg-tertiary)]"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Clear all annotations"
        title="Clear all annotations"
      >
        <Eraser className="w-4 h-4" />
      </button>
    </div>
  );
}

export default HighlightToolbar;
