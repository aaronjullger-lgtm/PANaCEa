/**
 * NodeDetailPanel – Displays detailed information about a selected graph node.
 * Integrates with the GRAPH_NODE endpoint to fetch taxonomy, edges, and metadata.
 */
import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { GraphNodeDetailResponse, GraphEdgeResponse } from '@/lib/types/graph';
import { normalizeSystemName, getSystemWeight as blueprintGetSystemWeight } from '@/lib/constants/blueprint';

// Edge type color mapping (mirrors InteractiveGraphCanvas)
const EDGE_TYPE_DOT_COLORS: Record<string, string> = {
  HIERARCHICAL: '#4b5563',
  CO_OCCURRENCE: '#3b82f6',
  SEMANTIC: '#10b981',
  EXPLICIT: '#f59e0b',
  ASSOCIATED: '#8b5cf6',
  TREATS: '#ef4444',
  CAUSES: '#f97316',
  MANIFESTS: '#ec4899',
  DIFFERENTIAL: '#14b8a6',
  COMPLICATES: '#b91c1c',
};

interface NodeDetailPanelProps {
  /** Selected node ID (null when nothing selected) */
  nodeId: string | null;
  /** Callback when the panel is closed */
  onClose?: () => void;
  /** Optional initial data (if already fetched) */
  initialData?: GraphNodeDetailResponse;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  nodeId,
  onClose,
  initialData,
}) => {
  const [nodeData, setNodeData] = useState<GraphNodeDetailResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId) {
      setNodeData(null);
      setError(null);
      return;
    }

    // If we already have data for this node (and no refresh requested), keep it
    if (nodeData?.id === nodeId && initialData?.id === nodeId) {
      return;
    }

    const fetchNodeDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          getApiEndpoint(API_ENDPOINTS.GRAPH_NODE(nodeId))
        );
        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType?.includes('application/json')) {
            throw new Error(`Server returned ${response.status} ${response.statusText}`);
          }
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch node ${nodeId}`);
        }
        const json = await response.json();
        const data = json.data as GraphNodeDetailResponse;
        setNodeData(data);
      } catch (err) {
        console.error('Failed to fetch node details:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setNodeData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNodeDetails();
  }, [nodeId]);

  // getSystemWeight is imported as blueprintGetSystemWeight

  const renderSystemBadges = (systemCodes: string[]) => {
    if (!systemCodes.length) return <span className="text-muted-foreground">None</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {systemCodes.map((code) => {
          const canonical = normalizeSystemName(code);
          const weight = blueprintGetSystemWeight(canonical);
          return (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              title={`${canonical} ${weight ? `(${weight * 100}%)` : ''}`}
            >
              {code}
              {weight && (
                <span className="ml-1 text-muted-foreground">
                  {Math.round(weight * 100)}%
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const renderEdgeList = (edges: GraphEdgeResponse[], direction: 'outgoing' | 'incoming') => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">
        {direction === 'outgoing' ? 'Outgoing Connections' : 'Incoming Connections'} ({edges.length})
      </h4>
      {edges.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1">
          {edges.slice(0, 10).map((edge) => (
            <li
              key={edge.id}
              className="flex items-center justify-between p-2 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-surface-hover transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: EDGE_TYPE_DOT_COLORS[edge.edgeType] ?? '#9ca3af' }}
                  />
                  <span className="font-medium text-sm">{edge.edgeType.replace(/_/g, ' ')}</span>
                  {edge.weight && (
                    <span className="text-xs text-muted-foreground">weight: {edge.weight.toFixed(2)}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {direction === 'outgoing' ? '→' : '←'} {direction === 'outgoing' ? edge.targetId : edge.sourceId}
                  {edge.description && <span className="ml-2">– {edge.description}</span>}
                </div>
              </div>
              {edge.evidenceCount && (
                <div className="text-xs px-2 py-1 bg-[var(--color-accent)]/15 rounded">
                  {edge.evidenceCount} evidence
                </div>
              )}
            </li>
          ))}
          {edges.length > 10 && (
            <li className="text-xs text-muted-foreground italic">
              +{edges.length - 10} more connections
            </li>
          )}
        </ul>
      )}
    </div>
  );

  if (!nodeId) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Select a Node</h3>
          <p className="text-muted-foreground">
            Click on any node in the graph to see its detailed information here.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-action-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading node details…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-4 flex justify-center"><AlertTriangle className="w-10 h-10 text-[var(--color-text-muted)]" /></div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Could not load node</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md hover:bg-[var(--color-accent)]-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!nodeData) {
    return null; // Should not happen
  }

  const { label, nodeType, description, sourceType, sourceId, taxonomyCode, systemCodes, metadata, outgoingEdges, incomingEdges } = nodeData;

  return (
    <div className="h-full overflow-y-auto p-6 bg-[var(--color-bg-primary)]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{label}</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              {nodeType}
            </span>
            <span className="text-sm text-muted-foreground">
              Source: {sourceType} ({sourceId})
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface-hover transition-colors"
            aria-label="Close panel"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Description */}
        {description && (
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">Description</h3>
            <p className="text-foreground bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border)]">
              {description}
            </p>
          </section>
        )}

        {/* Taxonomy */}
        {taxonomyCode && (
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">Taxonomy</h3>
            <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border)]">
              <code className="font-mono text-sm bg-[var(--color-accent)]/15 px-2 py-1 rounded">
                {taxonomyCode}
              </code>
              {metadata?.taxonomyName && (
                <p className="mt-2 text-foreground">{metadata.taxonomyName as string}</p>
              )}
              {metadata?.taxonomyDescription && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {metadata.taxonomyDescription as string}
                </p>
              )}
            </div>
          </section>
        )}

        {/* System Codes */}
        <section>
          <h3 className="text-lg font-semibold text-foreground mb-2">Organ Systems</h3>
          {renderSystemBadges(systemCodes)}
        </section>

        {/* Metadata */}
        {metadata && Object.keys(metadata).length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">Metadata</h3>
            <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border)]">
              <pre className="text-xs text-foreground overflow-x-auto">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          </section>
        )}

        {/* Edges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderEdgeList(outgoingEdges, 'outgoing')}
          {renderEdgeList(incomingEdges, 'incoming')}
        </div>

        {/* Footer note */}
        <div className="pt-4 border-t border-[var(--color-border)] text-xs text-muted-foreground">
          Node ID: <code className="bg-[var(--color-accent)]/15 px-1 py-0.5 rounded">{nodeData.id}</code>
          <span className="mx-2">•</span>
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};