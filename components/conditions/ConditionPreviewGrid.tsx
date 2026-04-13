/**
 * ConditionPreviewGrid
 *
 * Example implementation showing how to use ConditionPreviewCard in a grid layout.
 * Demonstrates fetching content from database and handling navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ConditionPreviewCard } from './ConditionPreviewCard';
import type { ConditionMeta } from '../../src/types/conditions';
import { getApiEndpoint, API_ENDPOINTS } from '../../lib/utils/apiConfig';

interface ConditionPreviewGridProps {
  conditions: ConditionMeta[];
  onConditionClick: (condition: ConditionMeta) => void;
}

export const ConditionPreviewGrid: React.FC<ConditionPreviewGridProps> = ({
  conditions,
  onConditionClick,
}) => {
  const [contentMap, setContentMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setIsLoading(true);
    try {
      setError(null);
      const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);

      const response = await fetch(apiUrl);

      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const allContent = (await response.json()) as Record<string, unknown>;
        setContentMap(allContent);
      }
    } catch (err) {
      console.error('Failed to load condition content:', err);
      setError('Failed to load condition content');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-[var(--color-bg-secondary)] animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <AlertCircle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0" />
        <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
        <button
          onClick={() => loadContent()}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {conditions.map((condition, index) => {
        // Build condition ID for lookup
        const conditionId = `${condition.system}__${condition.subcategory
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')}__${condition.condition
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')}`;

        const content = contentMap[conditionId] || null;

        return (
          <ConditionPreviewCard
            key={conditionId}
            condition={condition}
            content={content}
            onClick={onConditionClick}
            index={index}
          />
        );
      })}
    </div>
  );
};

export default ConditionPreviewGrid;
