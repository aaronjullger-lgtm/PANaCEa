import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton } from './StandardButton';
import {
  Ruler,
  Grid3x3,
  AlignCenter,
  LayoutGrid,
  Zap,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export interface SpacingIssue {
  id: string;
  element: HTMLElement;
  type:
    | 'inconsistent-padding'
    | 'inconsistent-margin'
    | 'hardcoded-spacing'
    | 'missing-touch-target'
    | 'poor-alignment';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
  computedStyle: {
    padding?: string;
    margin?: string;
    gap?: string;
    width?: string;
    height?: string;
    minHeight?: string;
    display?: string;
    alignItems?: string;
    justifyContent?: string;
  };
}

export interface SpacingAuditProps {
  className?: string;
  autoRun?: boolean;
  showVisualGuides?: boolean;
}

export const SpacingAudit: React.FC<SpacingAuditProps> = ({
  className = '',
  autoRun = false,
  showVisualGuides = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [issues, setIssues] = useState<SpacingIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showGuides, setShowGuides] = useState(showVisualGuides);
  const [activeTab, setActiveTab] = useState<'issues' | 'guides' | 'patterns'>('issues');

  const runAudit = () => {
    setIsAuditing(true);
    const newIssues: SpacingIssue[] = [];

    // Scan for common spacing issues
    const elements = document.querySelectorAll('*');

    elements.forEach((element, index) => {
      if (!(element instanceof HTMLElement)) return;

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      // Check for hardcoded spacing
      if (element.style.padding || element.style.margin || element.style.gap) {
        newIssues.push({
          id: `hardcoded-${index}`,
          element,
          type: 'hardcoded-spacing',
          severity: 'medium',
          description: 'Element uses inline style for spacing',
          recommendation: 'Replace with Tailwind classes (e.g., p-4, m-2, gap-3)',
          computedStyle: {
            padding: element.style.padding || style.padding,
            margin: element.style.margin || style.margin,
            gap: element.style.gap || style.gap,
          },
        });
      }

      // Check for missing touch targets on interactive elements
      if (
        (element.tagName === 'BUTTON' ||
          element.tagName === 'A' ||
          element.getAttribute('role') === 'button' ||
          element.onclick) &&
        rect.height < 44 &&
        rect.width < 44
      ) {
        newIssues.push({
          id: `touch-target-${index}`,
          element,
          type: 'missing-touch-target',
          severity: 'high',
          description: 'Interactive element has insufficient touch target size',
          recommendation: 'Add min-h-[44px] and min-w-[44px] or increase padding',
          computedStyle: {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            minHeight: style.minHeight,
          },
        });
      }

      // Check for inconsistent padding patterns
      const padding = style.padding;
      const paddingValues = padding.split(' ').map((v) => parseInt(v) || 0);
      if (paddingValues.length > 0) {
        const uniqueValues = [...new Set(paddingValues)];
        if (uniqueValues.length > 2) {
          newIssues.push({
            id: `inconsistent-padding-${index}`,
            element,
            type: 'inconsistent-padding',
            severity: 'low',
            description: 'Element has inconsistent padding values',
            recommendation: 'Use consistent padding (e.g., p-4 for all sides)',
            computedStyle: { padding },
          });
        }
      }

      // Check for poor alignment in flex/grid containers
      if (style.display === 'flex' || style.display === 'grid') {
        const children = Array.from(element.children).filter(
          (child) => child instanceof HTMLElement
        );
        if (children.length > 1) {
          const firstChildRect = (children[0] as HTMLElement).getBoundingClientRect();
          const misaligned = children.some((child, i) => {
            if (i === 0) return false;
            const childRect = (child as HTMLElement).getBoundingClientRect();
            return Math.abs(childRect.top - firstChildRect.top) > 2;
          });

          if (misaligned) {
            newIssues.push({
              id: `poor-alignment-${index}`,
              element,
              type: 'poor-alignment',
              severity: 'medium',
              description: 'Container children are not properly aligned',
              recommendation: 'Add items-center for flex or place-items-center for grid',
              computedStyle: {
                display: style.display,
                alignItems: style.alignItems,
                justifyContent: style.justifyContent,
              },
            });
          }
        }
      }
    });

    // Sort by severity
    newIssues.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    setIssues(newIssues);
    setIsAuditing(false);
  };

  useEffect(() => {
    if (autoRun) {
      runAudit();
    }
  }, [autoRun]);

  const severityColor = (severity: SpacingIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'text-data-fail bg-data-fail/10';
      case 'medium':
        return 'text-data-provisional bg-data-provisional/10';
      case 'low':
        return 'text-[var(--color-category-practice)] bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)]';
    }
  };

  const severityIcon = (severity: SpacingIssue['severity']) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4" />;
      case 'low':
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const toggleVisualGuides = () => {
    setShowGuides(!showGuides);
    if (!showGuides) {
      document.body.classList.add('spacing-guides-active');
    } else {
      document.body.classList.remove('spacing-guides-active');
    }
  };

  const applySpacingFix = (issue: SpacingIssue) => {
    switch (issue.type) {
      case 'missing-touch-target':
        issue.element.classList.add('min-h-[44px]', 'min-w-[44px]');
        break;
      case 'inconsistent-padding':
        issue.element.classList.add('p-4');
        break;
      case 'poor-alignment':
        if (issue.computedStyle.display === 'flex') {
          issue.element.classList.add('items-center');
        } else if (issue.computedStyle.display === 'grid') {
          issue.element.classList.add('place-items-center');
        }
        break;
    }

    // Remove the fixed issue
    setIssues((prev) => prev.filter((i) => i.id !== issue.id));
  };

  const applyAllFixes = () => {
    issues.forEach(applySpacingFix);
  };

  return (
    <>
      {/* Toggle Button */}
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <StandardButton
          variant="accent"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="shadow-lg"
        >
          <Ruler className="w-4 h-4" />
          <span>Spacing Audit</span>
        </StandardButton>
      </div>

      {/* Visual Guides */}
      {showGuides && (
        <style>
          {`
            .spacing-guides-active * {
              outline: 1px solid rgba(59, 130, 246, 0.1) !important;
            }
            
            .spacing-guides-active [class*="p-"] {
              outline: 1px solid rgba(34, 197, 94, 0.3) !important;
              background-color: rgba(34, 197, 94, 0.05) !important;
            }
            
            .spacing-guides-active [class*="m-"] {
              outline: 1px solid rgba(249, 115, 22, 0.3) !important;
              background-color: rgba(249, 115, 22, 0.05) !important;
            }
            
            .spacing-guides-active [class*="gap-"] {
              outline: 1px solid rgba(168, 85, 247, 0.3) !important;
              background-color: rgba(168, 85, 247, 0.05) !important;
            }
            
            .spacing-guides-active [class*="space-"] {
              outline: 1px dashed rgba(236, 72, 153, 0.3) !important;
              background-color: rgba(236, 72, 153, 0.05) !important;
            }
          `}
        </style>
      )}

      {/* Audit Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-4 w-96 max-h-[80vh] bg-white bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl border border-[var(--color-border)] border-[var(--color-border)] overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-[var(--color-border)] border-[var(--color-border)] bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] rounded-lg">
                    <Ruler className="w-5 h-5 text-[var(--color-category-practice)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-muted)] dark:text-white">Spacing Audit</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {issues.length} issue{issues.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                </div>
                <StandardButton variant="ghost" size="xs" onClick={() => setIsOpen(false)}>
                  Close
                </StandardButton>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--color-border)] border-[var(--color-border)]">
              <button
                onClick={() => setActiveTab('issues')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'issues'
                    ? 'text-[var(--color-category-practice)] border-b-2 border-[var(--color-category-practice)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Issues ({issues.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('guides')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'guides'
                    ? 'text-[var(--color-category-practice)] border-b-2 border-[var(--color-category-practice)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Grid3x3 className="w-4 h-4" />
                  Visual Guides
                </div>
              </button>
              <button
                onClick={() => setActiveTab('patterns')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'patterns'
                    ? 'text-[var(--color-category-practice)] border-b-2 border-[var(--color-category-practice)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Patterns
                </div>
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              {activeTab === 'issues' && (
                <div className="p-4 space-y-4">
                  {/* Actions */}
                  <div className="flex gap-2">
                    <StandardButton
                      variant="primary"
                      size="sm"
                      onClick={runAudit}
                      loading={isAuditing}
                      className="flex-1"
                    >
                      {isAuditing ? 'Scanning...' : 'Run Audit'}
                    </StandardButton>
                    <StandardButton
                      variant="success"
                      size="sm"
                      onClick={applyAllFixes}
                      disabled={issues.length === 0}
                    >
                      <Zap className="w-4 h-4" />
                      Fix All
                    </StandardButton>
                  </div>

                  {/* Issues List */}
                  {issues.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-data-pass mx-auto mb-3" />
                      <h4 className="font-semibold text-[var(--color-text-muted)] dark:text-white mb-1">
                        No spacing issues found!
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Your spacing is consistent and follows guidelines.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.map((issue) => (
                        <motion.div
                          key={issue.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-3 rounded-lg border border-[var(--color-border)] border-[var(--color-border)] bg-[var(--color-bg-secondary)] bg-[color-mix(in_srgb,var(--color-text-muted)_50%,transparent)]"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${severityColor(issue.severity)}`}>
                                {severityIcon(issue.severity)}
                              </div>
                              <span className="text-sm font-medium text-[var(--color-text-muted)] dark:text-white">
                                {issue.description}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${severityColor(issue.severity)}`}
                            >
                              {issue.severity}
                            </span>
                          </div>

                          <p className="text-sm text-[var(--color-text-muted)] mb-3">
                            {issue.recommendation}
                          </p>

                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => {
                                issue.element.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center',
                                });
                                issue.element.classList.add('animate-pulse');
                                setTimeout(
                                  () => issue.element.classList.remove('animate-pulse'),
                                  2000
                                );
                              }}
                              className="text-sm text-[var(--color-category-practice)] hover:underline"
                            >
                              View Element
                            </button>
                            <StandardButton
                              variant="outline"
                              size="xs"
                              onClick={() => applySpacingFix(issue)}
                            >
                              Apply Fix
                            </StandardButton>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'guides' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-[var(--color-text-muted)] dark:text-white">Visual Guides</h4>
                    <StandardButton
                      variant={showGuides ? 'primary' : 'outline'}
                      size="sm"
                      onClick={toggleVisualGuides}
                    >
                      {showGuides ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Hide Guides
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Show Guides
                        </>
                      )}
                    </StandardButton>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-data-pass dark:border-data-pass bg-data-pass dark:bg-data-pass/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded bg-data-pass"></div>
                        <span className="text-sm font-medium text-[var(--color-text-muted)] dark:text-white">
                          Padding
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Elements with padding classes (p-, px-, py-, pt-, etc.)
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-[var(--color-data-provisional)]/20 dark:border-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10 dark:bg-[var(--color-data-provisional)]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded bg-[var(--color-data-provisional)]/100"></div>
                        <span className="text-sm font-medium text-[var(--color-text-muted)] dark:text-white">
                          Margin
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Elements with margin classes (m-, mx-, my-, mt-, etc.)
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-[var(--color-accent)]/20 dark:border-[var(--color-accent)] bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded bg-[var(--color-accent)]"></div>
                        <span className="text-sm font-medium text-[var(--color-text-muted)] dark:text-white">
                          Gap
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Elements with gap classes (gap-)
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-[var(--color-data-fail)]/20 dark:border-[var(--color-data-fail)] bg-[var(--color-data-fail)]/10 dark:bg-[var(--color-data-fail)]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded bg-[var(--color-data-fail)]/100"></div>
                        <span className="text-sm font-medium text-[var(--color-text-muted)] dark:text-white">
                          Space
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Elements with space classes (space-x-, space-y-)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'patterns' && (
                <div className="p-4 space-y-4">
                  <h4 className="font-semibold text-[var(--color-text-muted)] dark:text-white">Spacing Patterns</h4>

                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-[var(--color-border)] border-[var(--color-border)]">
                      <h5 className="font-medium text-[var(--color-text-muted)] dark:text-white mb-2">
                        Card Layout
                      </h5>
                      <div className="text-sm text-[var(--color-text-muted)] space-y-1">
                        <code className="block bg-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)] p-1 rounded">
                          p-6 space-y-4
                        </code>
                        <p>Standard card with consistent internal spacing</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-[var(--color-border)] border-[var(--color-border)]">
                      <h5 className="font-medium text-[var(--color-text-muted)] dark:text-white mb-2">
                        Form Layout
                      </h5>
                      <div className="text-sm text-[var(--color-text-muted)] space-y-1">
                        <code className="block bg-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)] p-1 rounded">
                          space-y-4
                        </code>
                        <code className="block bg-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)] p-1 rounded">
                          space-y-2 (for label + input)
                        </code>
                        <p>Consistent vertical rhythm for forms</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-[var(--color-border)] border-[var(--color-border)]">
                      <h5 className="font-medium text-[var(--color-text-muted)] dark:text-white mb-2">
                        Button Groups
                      </h5>
                      <div className="text-sm text-[var(--color-text-muted)] space-y-1">
                        <code className="block bg-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)] p-1 rounded">
                          flex gap-2
                        </code>
                        <code className="block bg-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)] p-1 rounded">
                          flex gap-3 (for larger buttons)
                        </code>
                        <p>Use gap instead of margin for button spacing</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-[var(--color-border)] border-[var(--color-border)]">
                      <h5 className="font-medium text-[var(--color-text-muted)] dark:text-white mb-2">
                        Grid Layouts
                      </h5>
                      <div className="text-sm text-[var(--color-text-muted)] space-y-1">
                        <code className="block bg-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)] p-1 rounded">
                          grid gap-4
                        </code>
                        <code className="block bg-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)] p-1 rounded">
                          grid gap-6 (for larger cards)
                        </code>
                        <p>Consistent grid spacing</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[var(--color-border)] border-[var(--color-border)] bg-[var(--color-bg-secondary)] bg-[color-mix(in_srgb,var(--color-text-muted)_50%,transparent)]">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <div className="flex items-center gap-2">
                  <AlignCenter className="w-3 h-3" />
                  <span>Follow spacing guidelines for consistency</span>
                </div>
                <a
                  href="/docs/SPACING_GUIDELINES.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-category-practice)] hover:underline"
                >
                  View Guidelines
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
