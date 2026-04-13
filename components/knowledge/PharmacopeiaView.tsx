/**
 * PharmacopeiaView - Drug Reference Library
 *
 * Drug reference by class from registry: Antibiotics, Cardiovascular, Endocrine, etc.
 * Extracted from ToolkitHub, now part of Knowledge Base.
 */

import React, { useState } from 'react';
import {
  DRUG_REGISTRY_ANTIBIOTICS,
  DRUG_REGISTRY_CARDIOVASCULAR,
  DRUG_REGISTRY_ENDOCRINE,
  DRUG_REGISTRY_ANALGESICS,
  DRUG_REGISTRY_PSYCHIATRY,
} from '@/src/registries/drugRegistry';
import { Card, CardContent } from '@/components/ui/card';
import { CardGrid } from '@/components/ui/layouts/CardGrid';

const PHARM_CATEGORIES: Array<{
  id: string;
  label: string;
  drugs: Array<{ genericName: string; brandName?: string; drugClass: string[] }>;
}> = [
  { id: 'antibiotics', label: 'Antibiotics', drugs: DRUG_REGISTRY_ANTIBIOTICS },
  { id: 'cardiovascular', label: 'Cardiovascular', drugs: DRUG_REGISTRY_CARDIOVASCULAR },
  { id: 'endocrine', label: 'Endocrine', drugs: DRUG_REGISTRY_ENDOCRINE },
  { id: 'analgesics', label: 'Analgesics', drugs: DRUG_REGISTRY_ANALGESICS },
  { id: 'psychiatry', label: 'Psychiatry', drugs: DRUG_REGISTRY_PSYCHIATRY },
];

export const PharmacopeiaView: React.FC = () => {
  const firstCategory = PHARM_CATEGORIES[0];
  const [categoryId, setCategoryId] = useState<string>(firstCategory?.id ?? 'antibiotics');
  const category = PHARM_CATEGORIES.find((c) => c.id === categoryId) ?? firstCategory;

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div role="tablist" className="flex flex-wrap gap-2">
        {PHARM_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={categoryId === cat.id}
            onClick={() => setCategoryId(cat.id)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              categoryId === cat.id
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]'
            }`}
          >
            {cat.label} ({cat.drugs.length})
          </button>
        ))}
      </div>

      {/* Drug List */}
      <CardGrid>
        {(category?.drugs ?? []).map((drug) => (
          <Card key={drug.genericName}>
            <CardContent className="flex justify-between items-baseline py-4">
              <span className="font-medium text-[var(--color-text-primary)]">
                {drug.genericName}
                {drug.brandName && (
                  <span className="text-[var(--color-text-muted)] font-normal ml-2">
                    ({drug.brandName})
                  </span>
                )}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {drug.drugClass.slice(0, 2).join(', ')}
              </span>
            </CardContent>
          </Card>
        ))}
      </CardGrid>
    </div>
  );
};
