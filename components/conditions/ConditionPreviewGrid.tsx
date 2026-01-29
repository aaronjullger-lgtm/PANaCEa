/**
 * ConditionPreviewGrid
 *
 * Example implementation showing how to use ConditionPreviewCard in a grid layout.
 * Demonstrates fetching content from database and handling navigation.
 */

import React, { useState, useEffect } from 'react';
import { ConditionPreviewCard } from './ConditionPreviewCard';
import type { ConditionMeta } from '../../src/types/conditions';

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

  // Fetch content for all conditions
  useEffect(() => {
    async function loadContent() {
      try {
        // Import API config
        const { getApiEndpoint, API_ENDPOINTS } = await import('../../lib/utils/apiConfig');
        const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);

        const response = await fetch(apiUrl);

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const allContent = await response.json();
          setContentMap(allContent);
        }
      } catch (error) {
        console.error('Failed to load condition content:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadContent();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-[var(--color-bg-secondary)] animate-pulse rounded-xl"
          />
        ))}
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
