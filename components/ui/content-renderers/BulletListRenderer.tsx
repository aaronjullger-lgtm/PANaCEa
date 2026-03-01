import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface BulletListRendererProps {
  items: string[];
  className?: string;
  variant?: 'default' | 'clinical' | 'checklist';
  showNumbers?: boolean;
}

/**
 * BulletListRenderer - Renders an array of strings as a styled list
 *
 * Supports multiple visual styles appropriate for different content types:
 * - default: Simple bullet points
 * - clinical: Medical context styling with accent color
 * - checklist: Checkmark icons for clinical pearls/criteria
 *
 * @param items - Array of strings to render
 * @param className - Additional CSS classes
 * @param variant - Visual style variant
 * @param showNumbers - Use numbers instead of bullets
 */
export const BulletListRenderer: React.FC<BulletListRendererProps> = ({
  items,
  className = '',
  variant = 'default',
  showNumbers = false,
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  // Filter out empty strings
  const filteredItems = items.filter((item) => item && item.trim() !== '');

  if (filteredItems.length === 0) {
    return null;
  }

  // Variant-specific styling
  const variantClasses = {
    default: 'space-y-2',
    clinical: 'space-y-2.5',
    checklist: 'space-y-2',
  };

  const itemVariantClasses = {
    default: 'text-[var(--color-text-primary)]',
    clinical: 'text-[var(--color-text-primary)] pl-3 border-l-2 border-[var(--color-accent)]/30',
    checklist: 'text-[var(--color-text-primary)] flex items-start gap-2',
  };

  return (
    <ul className={`${variantClasses[variant]} ${className}`}>
      {filteredItems.map((item, index) => (
        <li key={index} className={`${itemVariantClasses[variant]} leading-relaxed`}>
          {variant === 'checklist' && (
            <CheckCircle2 className="w-4 h-4 text-data-pass flex-shrink-0 mt-0.5" />
          )}
          {showNumbers && (
            <span className="font-semibold text-[var(--color-accent)] mr-2">{index + 1}.</span>
          )}
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
};

/**
 * Convenience component for clinical pearls
 */
export const ClinicalPearlsList: React.FC<{ pearls: string[]; className?: string }> = ({
  pearls,
  className,
}) => <BulletListRenderer items={pearls} variant="checklist" className={className} />;

/**
 * Convenience component for treatment steps
 */
export const TreatmentStepsList: React.FC<{ steps: string[]; className?: string }> = ({
  steps,
  className,
}) => <BulletListRenderer items={steps} variant="clinical" showNumbers className={className} />;

export default BulletListRenderer;
