/**
 * LibraryBreadcrumb - Navigation trail for Clinical Reference Library
 *
 * Shows: Library › System › Subcategory
 * Clickable segments for quick navigation back up the hierarchy
 */

import React from 'react';
import { ChevronRight, BookOpen, Home } from 'lucide-react';

interface LibraryBreadcrumbProps {
  system: string | null;
  subcategory: string | null;
  onHomeClick: () => void;
  onSystemClick: () => void;
  onSubcategoryClick: () => void;
}

export const LibraryBreadcrumb: React.FC<LibraryBreadcrumbProps> = ({
  system,
  subcategory,
  onHomeClick,
  onSystemClick,
  onSubcategoryClick,
}) => {
  const isAllSystems = !system || system === 'all';

  return (
    <nav className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
      {/* Home / Library */}
      <button
        onClick={onHomeClick}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <BookOpen className="w-4 h-4" />
        <span className="font-medium">Library</span>
      </button>

      {/* System (if selected) */}
      {!isAllSystems && (
        <>
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          <button
            onClick={onSystemClick}
            className={`
              px-2 py-1 rounded-md transition-colors
              ${
                subcategory
                  ? 'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
                  : 'text-[var(--color-accent)] font-semibold'
              }
            `}
          >
            {system}
          </button>
        </>
      )}

      {/* Subcategory (if selected) */}
      {subcategory && (
        <>
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          <button
            onClick={onSubcategoryClick}
            className="px-2 py-1 rounded-md text-[var(--color-accent)] font-semibold"
          >
            {subcategory}
          </button>
        </>
      )}

      {/* Count indicator */}
      {isAllSystems && (
        <>
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="px-2 py-1 text-[var(--color-accent)] font-semibold">All Systems</span>
        </>
      )}
    </nav>
  );
};

export default LibraryBreadcrumb;
