/**
 * CrossSystemExplorer – Main component for the Cross‑System Integration Explorer.
 * Integrates InteractiveGraphCanvas, NodeDetailPanel, and FilterSidebar.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { InteractiveGraphCanvas } from './InteractiveGraphCanvas';
import { NodeDetailPanel } from './NodeDetailPanel';
import { FilterSidebar } from './FilterSidebar';
import { GraphSearchBar } from './GraphSearchBar';
import { GraphFilter } from '@/lib/types/graph';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { createDebouncedFunction } from '@/lib/utils/debounce';
import { toast } from 'sonner';

const DEFAULT_FILTER: GraphFilter = {
  systemCodes: [],
  edgeTypes: [],
  nodeTypes: [],
  minWeight: 0,
  maxDepth: 3,
};

interface CrossSystemExplorerProps {
  onClose?: () => void;
}

export const CrossSystemExplorer: React.FC<CrossSystemExplorerProps> = ({ onClose }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GraphFilter>(DEFAULT_FILTER);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleSearchSelect = useCallback((nodeId: string) => {
    handleNodeSelect(nodeId);
    // Optionally scroll to node or other effects
  }, [handleNodeSelect]);

  // Debounced filter update
  const filterDebounceRef = useRef<{
    debounced: (filter: GraphFilter) => void;
    cancel: () => void;
  } | null>(null);

  if (!filterDebounceRef.current) {
    filterDebounceRef.current = createDebouncedFunction(setFilter, 300);
  }

  const handleFilterChange = useCallback((newFilter: GraphFilter) => {
    filterDebounceRef.current?.debounced(newFilter);
    // In a real implementation, you would re‑fetch graph data with the filter
    // or apply client‑side filtering to the existing graph.
  }, []);

  useEffect(() => {
    return () => {
      filterDebounceRef.current?.cancel();
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Path finding states
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const [endNodeId, setEndNodeId] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [pathFinding, setPathFinding] = useState(false);

  const handleStartSelect = useCallback((nodeId: string, nodeLabel: string) => {
    setStartNodeId(nodeId);
  }, []);

  const handleEndSelect = useCallback((nodeId: string, nodeLabel: string) => {
    setEndNodeId(nodeId);
  }, []);

  const handleFindPath = useCallback(async () => {
    if (!startNodeId || !endNodeId) {
      toast.warning('Please select both start and end nodes.');
      return;
    }
    setPathFinding(true);
    try {
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.GRAPH_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startNodeId,
          endNodeId,
          algorithm: 'bfs',
          maxDepth: 10,
        }),
      });
      if (!response.ok) {
        throw new Error(`Path finding failed: ${response.statusText}`);
      }
      const result = await response.json();
      const path = result.data?.path || [];
      setHighlightedPath(path.map((node: any) => node.id));
    } catch (error) {
      console.error('Failed to find path', error);
      toast.info('Could not find a path between the selected nodes.');
    } finally {
      setPathFinding(false);
    }
  }, [startNodeId, endNodeId]);

  const handleClearPath = useCallback(() => {
    setHighlightedPath([]);
    setStartNodeId(null);
    setEndNodeId(null);
  }, []);

  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Left Sidebar – Filters */}
      <FilterSidebar
        filter={filter}
        onChange={handleFilterChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main Graph Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with title, search, and close button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Cross‑System Integration Explorer</h2>
          <div className="flex-1 max-w-xl mx-4">
            <GraphSearchBar onNodeSelect={handleSearchSelect} />
          </div>
          <button
            onClick={() => setShowPerformanceOverlay(prev => !prev)}
            className={`px-3 py-1.5 rounded-md border transition-colors ${
              showPerformanceOverlay
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
            }`}
            aria-label={showPerformanceOverlay ? 'Hide performance overlay' : 'Show performance overlay'}
          >
            {showPerformanceOverlay ? 'Performance Overlay ON' : 'Performance Overlay'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label="Close explorer"
            >
              <X className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>
          )}
        </div>
        {/* Path finding toolbar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex-1 max-w-xs">
            <GraphSearchBar
              placeholder="Start node..."
              onNodeSelect={handleStartSelect}
            />
          </div>
          <div className="flex-1 max-w-xs">
            <GraphSearchBar
              placeholder="End node..."
              onNodeSelect={handleEndSelect}
            />
          </div>
          <button
            onClick={handleFindPath}
            disabled={pathFinding || !startNodeId || !endNodeId}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md hover:bg-[var(--color-accent)]-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pathFinding ? 'Finding...' : 'Find Path'}
          </button>
          <button
            onClick={handleClearPath}
            className="px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-secondary)]"
          >
            Clear
          </button>
          {highlightedPath.length > 0 && (
            <span className="text-sm text-[var(--color-text-muted)]">
              Path: {highlightedPath.length} nodes
            </span>
          )}
        </div>
        <div className="flex-1 relative">
          <InteractiveGraphCanvas
            onNodeSelect={handleNodeSelect}
            filter={filter}
            highlightedPath={highlightedPath}
            initialNodeIds={['condition:1']} // Example starting point
          />
        </div>
        {/* Selected Node Details (if any) */}
        {selectedNodeId && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <NodeDetailPanel nodeId={selectedNodeId} />
          </div>
        )}
      </div>
    </div>
  );
};