/**
 * USAGE EXAMPLE: ConditionPreviewCard
 * 
 * Demonstrates how to integrate the new ConditionPreviewCard component
 * into your application for browsing conditions.
 */

import React, { useState } from 'react';
import { ConditionPreviewCard } from './components/conditions/ConditionPreviewCard';
import { ConditionPreviewGrid } from './components/conditions/ConditionPreviewGrid';
import { ConditionDetailModal } from './components/ConditionDetailModal';
import { CONDITION_REGISTRY_CV, CONDITION_REGISTRY_PULM } from './conditionRegistry';
import type { ConditionMeta } from './conditionRegistry';

// ============================================================================
// EXAMPLE 1: Single Card Usage
// ============================================================================

export const SingleCardExample: React.FC = () => {
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(null);

  // Sample condition
  const condition: ConditionMeta = {
    system: 'CV',
    subcategory: 'Vascular Disease',
    condition: 'Peripheral Artery Disease',
    aliases: ['PAD', 'PVD'],
  };

  // Sample content from database (this would normally come from API)
  const content = {
    conditionId: 'CV__vascular_disease__peripheral_artery_disease',
    classic_triad: ['Claudication', 'Diminished pulses', 'Bruits'],
    clinical_pearls: [
      'ABI < 0.9 diagnostic',
      'Cilostazol improves walking distance',
      'Smoking cessation is #1 intervention',
    ],
    buzzwords: ['Intermittent claudication', '6 Ps'],
    gold_standard_dx: 'Angiography',
    first_line_rx: 'Antiplatelet + Statin',
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Single Card Example</h2>
      
      <div className="max-w-md">
        <ConditionPreviewCard
          condition={condition}
          content={content}
          onClick={setSelectedCondition}
        />
      </div>

      {selectedCondition && (
        <ConditionDetailModal
          condition={selectedCondition}
          onClose={() => setSelectedCondition(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// EXAMPLE 2: Grid Layout with Database Content
// ============================================================================

export const GridExample: React.FC = () => {
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(null);

  // Combine multiple system registries
  const allConditions = [
    ...CONDITION_REGISTRY_CV.slice(0, 6),
    ...CONDITION_REGISTRY_PULM.slice(0, 6),
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Cardiovascular & Pulmonary Conditions</h2>
      
      <ConditionPreviewGrid
        conditions={allConditions}
        onConditionClick={setSelectedCondition}
      />

      {selectedCondition && (
        <ConditionDetailModal
          condition={selectedCondition}
          onClose={() => setSelectedCondition(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// EXAMPLE 3: Filtered System View
// ============================================================================

export const FilteredSystemExample: React.FC = () => {
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(null);
  const [system, setSystem] = useState<'CV' | 'PULM' | 'GI' | 'NEURO'>('CV');

  const systemConditions = {
    CV: CONDITION_REGISTRY_CV,
    PULM: CONDITION_REGISTRY_PULM,
    GI: [],  // Add your GI registry
    NEURO: [], // Add your NEURO registry
  };

  return (
    <div className="p-6">
      {/* System Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['CV', 'PULM', 'GI', 'NEURO'] as const).map((sys) => (
          <button
            key={sys}
            onClick={() => setSystem(sys)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              system === sys
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {sys}
          </button>
        ))}
      </div>

      <ConditionPreviewGrid
        conditions={systemConditions[system]}
        onConditionClick={setSelectedCondition}
      />

      {selectedCondition && (
        <ConditionDetailModal
          condition={selectedCondition}
          onClose={() => setSelectedCondition(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// EXAMPLE 4: Search Results
// ============================================================================

export const SearchResultsExample: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(null);

  // Filter conditions based on search
  const filteredConditions = CONDITION_REGISTRY_CV.filter((c) => {
    const query = searchQuery.toLowerCase();
    return (
      c.condition.toLowerCase().includes(query) ||
      c.subcategory.toLowerCase().includes(query) ||
      c.aliases?.some((alias) => alias.toLowerCase().includes(query))
    );
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Search Conditions</h2>
      
      {/* Search Input */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search conditions..."
        className="w-full px-4 py-2 rounded-lg border border-slate-300 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Results */}
      {filteredConditions.length > 0 ? (
        <ConditionPreviewGrid
          conditions={filteredConditions}
          onConditionClick={setSelectedCondition}
        />
      ) : (
        <p className="text-slate-500 text-center py-8">
          No conditions found matching "{searchQuery}"
        </p>
      )}

      {selectedCondition && (
        <ConditionDetailModal
          condition={selectedCondition}
          onClose={() => setSelectedCondition(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * Component Features:
 * 
 * 1. Smart Snippet Extraction:
 *    - Prioritizes: classic_triad > clinical_pearls > buzzwords > tests/rx
 *    - Auto-truncates to 30 chars max with ellipsis
 *    - Shows top 2-3 most relevant snippets only
 *    - Filters out empty or overly long content
 * 
 * 2. Markdown Stripping:
 *    - Removes all **, __, *, _ formatting
 *    - Cleans headers, code blocks, links
 *    - Results in clean, readable text
 * 
 * 3. System-Based Coloring:
 *    - CV: Red accent (vascular theme)
 *    - PULM: Blue accent (respiratory theme)
 *    - NEURO: Purple accent (neural theme)
 *    - GI: Amber accent
 *    - Each system has unique bg/border/text colors
 * 
 * 4. Hover Effects:
 *    - Subtle lift (-2px translate)
 *    - Border color intensifies
 *    - Shadow appears
 *    - Chevron changes color
 * 
 * 5. Accessibility:
 *    - Semantic button element
 *    - Keyboard navigation support
 *    - Focus ring for keyboard users
 *    - ARIA-compliant structure
 * 
 * 6. Performance:
 *    - Staggered animations (50ms delay per card)
 *    - Framer Motion optimizations
 *    - Lazy loading compatible
 *    - Minimal re-renders
 */

/**
 * Customization Options:
 * 
 * 1. Adjust max snippets:
 *    extractSnippets(content, 5, 30) // Show 5 pills instead of 3
 * 
 * 2. Change truncation length:
 *    extractSnippets(content, 3, 40) // 40 char max instead of 30
 * 
 * 3. Custom field priority:
 *    Edit fieldPriority array in textFormatting.ts
 * 
 * 4. Custom colors:
 *    Add/modify system accents in getSystemAccent()
 * 
 * 5. Different layouts:
 *    Change grid-cols-* in ConditionPreviewGrid
 *    Options: 1, 2, 3, 4 columns
 */

/**
 * Data Requirements:
 * 
 * The component expects content from MedicalContent table with these fields:
 * - classic_triad: string[] (3-item array)
 * - clinical_pearls: string[] (actionable bullets)
 * - buzzwords: string[] (high-yield terms)
 * - gold_standard_dx: string (< 8 words)
 * - first_line_rx: string (< 8 words)
 * - best_initial_test: string (< 8 words)
 * - mnemonic: string
 * - classic_patient: string
 * 
 * All fields are optional. Component gracefully handles missing data.
 */
