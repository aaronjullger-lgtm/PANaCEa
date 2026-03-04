/**
 * FilterSidebar – Provides filtering controls for the Cross‑System Integration Explorer.
 * Allows filtering by organ system, edge type, node type, weight, and depth.
 */
import React from 'react';
import { GraphFilter } from '@/lib/types/graph';
import { GraphEdgeType } from '@/lib/types/graph';
import { NCCPA_2025_BLUEPRINT } from '@/lib/constants/blueprint';
import { normalizeSystemName } from '@/lib/constants/blueprint';

interface FilterSidebarProps {
  /** Current filter state */
  filter: GraphFilter;
  /** Callback when filter changes */
  onChange: (filter: GraphFilter) => void;
  /** Optional callback to apply filter (if not real‑time) */
  onApply?: () => void;
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Callback to toggle collapse */
  onToggleCollapse?: () => void;
}

// Available node types (from GraphNodeType)
const NODE_TYPES = [
  'CONDITION',
  'FINDING',
  'DRUG',
  'PROCEDURE',
  'SYSTEM',
  'ANATOMY',
  'LAB_TEST',
  'IMAGING',
  'VITAL_SIGN',
  'OTHER',
] as const;

// Edge types from GraphEdgeType
const EDGE_TYPES: GraphEdgeType[] = [
  'HIERARCHICAL',
  'CO_OCCURRENCE',
  'SEMANTIC',
  'EXPLICIT',
  'ASSOCIATED',
  'TREATS',
  'CAUSES',
  'MANIFESTS',
  'DIFFERENTIAL',
  'COMPLICATES',
];

// NCCPA systems (canonical names)
const ALL_SYSTEMS = Object.keys(NCCPA_2025_BLUEPRINT).filter(s => s !== 'General');

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filter,
  onChange,
  onApply,
  collapsed = false,
  onToggleCollapse,
}) => {
  const handleSystemToggle = (system: string) => {
    const newSystemCodes = filter.systemCodes.includes(system)
      ? filter.systemCodes.filter(s => s !== system)
      : [...filter.systemCodes, system];
    onChange({ ...filter, systemCodes: newSystemCodes });
  };

  const handleEdgeTypeToggle = (edgeType: string) => {
    const newEdgeTypes = filter.edgeTypes.includes(edgeType)
      ? filter.edgeTypes.filter(e => e !== edgeType)
      : [...filter.edgeTypes, edgeType];
    onChange({ ...filter, edgeTypes: newEdgeTypes });
  };

  const handleNodeTypeToggle = (nodeType: string) => {
    const newNodeTypes = filter.nodeTypes.includes(nodeType)
      ? filter.nodeTypes.filter(n => n !== nodeType)
      : [...filter.nodeTypes, nodeType];
    onChange({ ...filter, nodeTypes: newNodeTypes });
  };

  const handleWeightChange = (min: number, max: number) => {
    onChange({ ...filter, minWeight: min, maxDepth: filter.maxDepth });
  };

  const handleDepthChange = (depth: number) => {
    onChange({ ...filter, maxDepth: depth });
  };

  const selectAll = (category: 'systems' | 'edgeTypes' | 'nodeTypes') => {
    switch (category) {
      case 'systems':
        onChange({ ...filter, systemCodes: ALL_SYSTEMS });
        break;
      case 'edgeTypes':
        onChange({ ...filter, edgeTypes: EDGE_TYPES });
        break;
      case 'nodeTypes':
        onChange({ ...filter, nodeTypes: [...NODE_TYPES] });
        break;
    }
  };

  const clearAll = (category: 'systems' | 'edgeTypes' | 'nodeTypes') => {
    switch (category) {
      case 'systems':
        onChange({ ...filter, systemCodes: [] });
        break;
      case 'edgeTypes':
        onChange({ ...filter, edgeTypes: [] });
        break;
      case 'nodeTypes':
        onChange({ ...filter, nodeTypes: [] });
        break;
    }
  };

  if (collapsed) {
    return (
      <div className="h-full w-12 bg-surface-primary border-r border-border flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-md hover:bg-surface-hover transition-colors"
          aria-label="Expand filters"
        >
          ⚙️
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-80 bg-surface-primary border-r border-border overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-foreground">Graph Filters</h2>
        <div className="flex items-center gap-2">
          {onApply && (
            <button
              onClick={onApply}
              className="px-3 py-1.5 bg-action-primary text-white text-sm rounded-md hover:bg-action-primary-hover transition-colors"
            >
              Apply
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-md hover:bg-surface-hover transition-colors"
              aria-label="Collapse sidebar"
            >
              ↼
            </button>
          )}
        </div>
      </div>

      {/* Organ Systems */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-foreground">Organ Systems</h3>
          <div className="flex gap-2">
            <button
              onClick={() => selectAll('systems')}
              className="text-xs px-2 py-1 bg-action-muted rounded hover:bg-action-muted-hover transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => clearAll('systems')}
              className="text-xs px-2 py-1 bg-action-muted rounded hover:bg-action-muted-hover transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {ALL_SYSTEMS.map(system => {
            const weight = NCCPA_2025_BLUEPRINT[system];
            return (
              <label
                key={system}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filter.systemCodes.includes(system)}
                  onChange={() => handleSystemToggle(system)}
                  className="rounded border-border text-action-primary focus:ring-action-primary"
                />
                <span className="flex-1 text-foreground">{system}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(weight * 100)}%
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Edge Types */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-foreground">Connection Types</h3>
          <div className="flex gap-2">
            <button
              onClick={() => selectAll('edgeTypes')}
              className="text-xs px-2 py-1 bg-action-muted rounded hover:bg-action-muted-hover transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => clearAll('edgeTypes')}
              className="text-xs px-2 py-1 bg-action-muted rounded hover:bg-action-muted-hover transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {EDGE_TYPES.map(edgeType => (
            <label
              key={edgeType}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filter.edgeTypes.includes(edgeType)}
                onChange={() => handleEdgeTypeToggle(edgeType)}
                className="rounded border-border text-action-primary focus:ring-action-primary"
              />
              <span className="flex-1 text-foreground">{edgeType.replace(/_/g, ' ')}</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: '#9ca3af', // default, could map to colors
                }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Node Types */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-foreground">Node Types</h3>
          <div className="flex gap-2">
            <button
              onClick={() => selectAll('nodeTypes')}
              className="text-xs px-2 py-1 bg-action-muted rounded hover:bg-action-muted-hover transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => clearAll('nodeTypes')}
              className="text-xs px-2 py-1 bg-action-muted rounded hover:bg-action-muted-hover transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {NODE_TYPES.map(nodeType => (
            <label
              key={nodeType}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filter.nodeTypes.includes(nodeType)}
                onChange={() => handleNodeTypeToggle(nodeType)}
                className="rounded border-border text-action-primary focus:ring-action-primary"
              />
              <span className="flex-1 text-foreground">{nodeType.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Weight Slider */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-3">Edge Weight</h3>
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Min: {filter.minWeight.toFixed(2)}</span>
            <span>Max: 1.00</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={filter.minWeight}
            onChange={(e) => handleWeightChange(parseFloat(e.target.value), 1)}
            className="w-full h-2 bg-action-muted rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-muted-foreground">
            Show edges with weight ≥ {filter.minWeight.toFixed(2)}
          </div>
        </div>
      </section>

      {/* Depth Limit */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-3">Expansion Depth</h3>
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Current: {filter.maxDepth}</span>
            <span>Max: 5</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={filter.maxDepth}
            onChange={(e) => handleDepthChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-action-muted rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-muted-foreground">
            Limit graph expansion to {filter.maxDepth} hop{filter.maxDepth !== 1 ? 's' : ''}
          </div>
        </div>
      </section>

      {/* Reset All */}
      <section>
        <button
          onClick={() => onChange({
            systemCodes: [],
            edgeTypes: [],
            nodeTypes: [],
            minWeight: 0,
            maxDepth: 3,
          })}
          className="w-full py-2 px-4 border border-border rounded-md text-foreground hover:bg-surface-hover transition-colors"
        >
          Reset All Filters
        </button>
      </section>
    </div>
  );
};