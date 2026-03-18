/**
 * Echo Path Visualization
 *
 * Visualizes the conversation decision tree, showing optimal path vs. actual path.
 * Highlights rabbit holes (unproductive questioning) in red.
 */

import React from 'react';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import type { EchoPath } from '@/types/smart-scribe-system';

interface EchoPathVisualizationProps {
  echoPath: EchoPath;
  className?: string;
}

export function EchoPathVisualization({ echoPath, className = '' }: EchoPathVisualizationProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Efficiency Score */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[var(--color-accent)]" />
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Questioning Efficiency
            </h2>
          </div>
          <div className="text-4xl font-bold text-[var(--color-accent)]">
            {echoPath.efficiencyScore}%
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[var(--color-text-muted)]">Optimal Path</div>
            <div className="text-xl font-semibold text-[var(--color-text-primary)]">
              {echoPath.optimalPath.length} steps
            </div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)]">Your Path</div>
            <div className="text-xl font-semibold text-[var(--color-text-primary)]">
              {echoPath.actualPath.length} steps
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Tree */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Conversation Tree
        </h3>

        <div className="space-y-2">
          {echoPath.nodes.map((node, i) => {
            const isOptimal = node.isOptimalPath;
            const isRabbitHole = echoPath.rabbitHoles.some(
              (rh) => rh.startNodeId === node.id || rh.endNodeId === node.id
            );
            const level = calculateLevel(node, echoPath.nodes);

            return (
              <div
                key={node.id}
                className={`p-3 rounded-lg border ${
                  isOptimal
                    ? 'border-data-pass/30 bg-data-pass/5'
                    : isRabbitHole
                      ? 'border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/5'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]'
                }`}
                style={{ marginLeft: `${level * 24}px` }}
              >
                <div className="flex items-start gap-3">
                  {isOptimal ? (
                    <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0 mt-0.5" />
                  ) : isRabbitHole ? (
                    <AlertTriangle className="w-4 h-4 text-data-fail flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-[var(--color-accent)]/30 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)] break-words">
                      {node.content}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                      <span>{node.type}</span>
                      <span>Relevance: {Math.round(node.relevanceScore * 100)}%</span>
                      {isRabbitHole && (
                        <span className="text-data-fail font-medium">Rabbit hole</span>
                      )}
                      {isOptimal && (
                        <span className="text-data-pass font-medium">Optimal path</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rabbit Holes */}
      {echoPath.rabbitHoles.length > 0 && (
        <div className="rounded-xl border border-data-fail/30 bg-data-fail/5 p-6">
          <h3 className="text-lg font-semibold text-data-fail mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Rabbit Holes Detected
          </h3>
          <div className="space-y-3">
            {echoPath.rabbitHoles.map((rh, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
              >
                <div className="text-sm text-[var(--color-text-primary)] font-medium mb-1">
                  Time wasted: {rh.timeWasted}s
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Reason: {rh.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Paths */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Covered */}
        {echoPath.criticalPathsCovered.length > 0 && (
          <div className="rounded-xl border border-data-pass/30 bg-data-pass/5 p-4">
            <h4 className="text-sm font-semibold text-data-pass mb-2">
              ✓ Critical Paths Covered
            </h4>
            <ul className="space-y-1">
              {echoPath.criticalPathsCovered.map((path, i) => (
                <li key={i} className="text-xs text-[var(--color-text-secondary)]">
                  {path}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missed */}
        {echoPath.criticalPathsMissed.length > 0 && (
          <div className="rounded-xl border border-data-fail/30 bg-data-fail/5 p-4">
            <h4 className="text-sm font-semibold text-data-fail mb-2">✗ Critical Paths Missed</h4>
            <ul className="space-y-1">
              {echoPath.criticalPathsMissed.map((path, i) => (
                <li key={i} className="text-xs text-[var(--color-text-secondary)]">
                  {path}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to calculate node level in tree
function calculateLevel(node: Record<string, any>, allNodes: Record<string, any>[]): number {
  let level = 0;
  let current = node;

  while (current.parentId) {
    level++;
    const parent = allNodes.find((n) => n.id === current.parentId);
    if (!parent) break;
    current = parent;
  }

  return level;
}
