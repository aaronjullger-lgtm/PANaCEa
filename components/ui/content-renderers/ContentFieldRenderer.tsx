import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { BulletListRenderer } from './BulletListRenderer';
import { KeyValueRenderer } from './KeyValueRenderer';
import {
  getFieldRenderType,
  type ContentFieldValue,
  type FieldRenderType,
} from '@/types/medical-content';
import { normalizeToStringArray } from '@/lib/utils/jsonParser';

interface ContentFieldRendererProps {
  value: ContentFieldValue;
  className?: string;
  variant?: 'default' | 'clinical' | 'checklist';
}

/**
 * ContentFieldRenderer - Master component that routes to appropriate renderer
 *
 * Intelligently determines how to render medical content based on its structure:
 * - null/undefined → Returns null (hides section)
 * - string → MarkdownRenderer
 * - string[] → BulletListRenderer
 * - object with treatment steps → Numbered list with clinical styling
 * - object (generic) → KeyValueRenderer
 *
 * This solves the [object Object] rendering bug by properly handling all data types.
 *
 * @param value - The content to render
 * @param className - Additional CSS classes
 * @param variant - Visual style variant for lists
 */
export const ContentFieldRenderer: React.FC<ContentFieldRendererProps> = ({
  value,
  className = '',
  variant = 'default',
}) => {
  const renderType = getFieldRenderType(value);

  switch (renderType) {
    case 'empty':
      return null;

    case 'markdown':
      return <MarkdownRenderer content={value as string} className={className} />;

    case 'bullet-list':
      return (
        <BulletListRenderer items={value as string[]} variant={variant} className={className} />
      );

    case 'steps':
      // Treatment steps or ordered procedures
      const steps = extractSteps(value);
      return (
        <BulletListRenderer items={steps} variant="clinical" showNumbers className={className} />
      );

    case 'key-value':
      return <KeyValueRenderer data={value as Record<string, unknown>} className={className} />;

    default:
      // Fallback: try to render as string
      console.warn('[ContentFieldRenderer] Unknown render type, falling back to string:', {
        value,
        renderType,
      });
      return <div className={`text-[var(--color-text-primary)] ${className}`}>{String(value)}</div>;
  }
};

/**
 * Extracts steps from various object formats
 */
function extractSteps(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const obj = value as Record<string, unknown>;

  // Handle explicit steps array
  if ('steps' in obj && Array.isArray(obj.steps)) {
    return normalizeToStringArray(obj.steps);
  }

  // Handle treatment protocol format
  if ('first_line' in obj) {
    const steps: string[] = [];
    if (obj.first_line) steps.push(`First line: ${obj.first_line}`);
    if (obj.alternatives && Array.isArray(obj.alternatives)) {
      obj.alternatives.forEach((alt, idx) => {
        steps.push(`Alternative ${idx + 1}: ${alt}`);
      });
    }
    if (obj.mechanism) steps.push(`Mechanism: ${obj.mechanism}`);
    return steps;
  }

  // Fallback: extract all string values
  return normalizeToStringArray(Object.values(obj));
}

/**
 * Convenience component for clinical pearls
 */
export const ClinicalPearlsRenderer: React.FC<{
  pearls: ContentFieldValue;
  className?: string;
}> = ({ pearls, className }) => (
  <ContentFieldRenderer value={pearls} variant="checklist" className={className} />
);

/**
 * Convenience component for differential diagnoses
 */
export const DifferentialDiagnosesRenderer: React.FC<{
  differentials: ContentFieldValue;
  className?: string;
}> = ({ differentials, className }) => (
  <ContentFieldRenderer value={differentials} variant="clinical" className={className} />
);

/**
 * Convenience component for classic triad
 */
export const ClassicTriadRenderer: React.FC<{
  triad: ContentFieldValue;
  className?: string;
}> = ({ triad, className }) => {
  const items = normalizeToStringArray(triad);

  if (items.length === 0) return null;

  return (
    <div className={`bg-amber-950/20 border border-amber-800/30 rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-400 font-semibold">Classic Triad</span>
        <span className="text-xs text-amber-500/70">({items.length} features)</span>
      </div>
      <BulletListRenderer items={items} variant="checklist" />
    </div>
  );
};

export default ContentFieldRenderer;
