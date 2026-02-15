import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton } from './StandardButton';

export interface TouchTargetIssue {
  id: string;
  element: HTMLElement;
  type: 'button' | 'link' | 'input' | 'icon' | 'custom';
  currentSize: { width: number; height: number };
  recommendedSize: { width: number; height: number };
  severity: 'low' | 'medium' | 'high';
  description: string;
  selector: string;
  computedStyle: {
    padding: string;
    margin: string;
    fontSize: string;
    lineHeight: string;
  };
}

interface TouchTargetAuditProps {
  isOpen?: boolean;
  onClose?: () => void;
  minTouchSize?: number; // Minimum touch target size in pixels (default: 44)
}

export const TouchTargetAudit: React.FC<TouchTargetAuditProps> = ({
  isOpen = false,
  onClose,
  minTouchSize = 44,
}) => {
  const [issues, setIssues] = useState<TouchTargetIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'recommendations' | 'test'>('issues');
  const [highlightIssues, setHighlightIssues] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scanForTouchTargetIssues = () => {
    setIsScanning(true);
    const newIssues: TouchTargetIssue[] = [];

    // Find all interactive elements
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="tab"]',
      '[tabindex]:not([tabindex="-1"])',
      '[onclick]',
      '[onkeydown]',
      '[onkeypress]',
    ];

    const elements = document.querySelectorAll(interactiveSelectors.join(', '));

    elements.forEach((element, index) => {
      if (!(element instanceof HTMLElement)) return;

      // Skip hidden elements
      const style = window.getComputedStyle(element);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        element.offsetParent === null
      ) {
        return;
      }

      // Get element dimensions
      const rect = element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Check if element meets minimum touch target size
      const meetsWidth = width >= minTouchSize;
      const meetsHeight = height >= minTouchSize;
      const meetsSize = meetsWidth && meetsHeight;

      if (!meetsSize) {
        // Determine element type
        let type: TouchTargetIssue['type'] = 'custom';
        if (element.tagName === 'BUTTON') type = 'button';
        else if (element.tagName === 'A') type = 'link';
        else if (
          element.tagName === 'INPUT' ||
          element.tagName === 'SELECT' ||
          element.tagName === 'TEXTAREA'
        )
          type = 'input';
        else if (element.querySelector('svg') || element.classList.contains('icon')) type = 'icon';

        // Determine severity
        let severity: TouchTargetIssue['severity'] = 'low';
        const minDimension = Math.min(width, height);
        if (minDimension < 24) severity = 'high';
        else if (minDimension < 32) severity = 'medium';

        // Get computed styles
        const computedStyle = {
          padding: style.padding,
          margin: style.margin,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
        };

        // Create issue
        const issue: TouchTargetIssue = {
          id: `touch-issue-${index}`,
          element,
          type,
          currentSize: { width: Math.round(width), height: Math.round(height) },
          recommendedSize: {
            width: Math.max(minTouchSize, Math.round(width)),
            height: Math.max(minTouchSize, Math.round(height)),
          },
          severity,
          description: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${element.className.split(' ').join('.')}` : ''} is too small for comfortable touch interaction`,
          selector: getElementSelector(element),
          computedStyle,
        };

        newIssues.push(issue);
      }
    });

    // Sort by severity (high first)
    newIssues.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    setIssues(newIssues);
    setIsScanning(false);
  };

  const getElementSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;

    let selector = element.tagName.toLowerCase();
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter((c) => c.length > 0);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }

    return selector;
  };

  const highlightElement = (issue: TouchTargetIssue) => {
    // Remove previous highlights
    document.querySelectorAll('.touch-target-highlight').forEach((el) => {
      el.classList.remove('touch-target-highlight');
    });

    // Add highlight to current element
    issue.element.classList.add('touch-target-highlight');

    // Scroll to element
    issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const applyFix = (issue: TouchTargetIssue) => {
    const element = issue.element;

    // Apply minimum touch target size
    element.style.minWidth = `${issue.recommendedSize.width}px`;
    element.style.minHeight = `${issue.recommendedSize.height}px`;

    // Add padding if needed
    const style = window.getComputedStyle(element);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);

    if (paddingTop + paddingBottom < 8) {
      element.style.paddingTop = '8px';
      element.style.paddingBottom = '8px';
    }

    if (paddingLeft + paddingRight < 8) {
      element.style.paddingLeft = '8px';
      element.style.paddingRight = '8px';
    }

    // Update issue list
    setIssues((prev) => prev.filter((i) => i.id !== issue.id));
  };

  const applyAllFixes = () => {
    issues.forEach(applyFix);
  };

  const resetHighlights = () => {
    document.querySelectorAll('.touch-target-highlight').forEach((el) => {
      el.classList.remove('touch-target-highlight');
    });
  };

  const toggleTestMode = () => {
    setTestMode(!testMode);
    if (!testMode) {
      // Add test mode styles
      const style = document.createElement('style');
      style.id = 'touch-target-test-styles';
      style.textContent = `
        .touch-target-highlight {
          outline: 3px solid #3b82f6 !important;
          outline-offset: 2px !important;
          background-color: rgba(59, 130, 246, 0.1) !important;
          position: relative !important;
          z-index: 9999 !important;
        }
        .touch-target-highlight::after {
          content: attr(data-touch-size);
          position: absolute;
          top: -24px;
          left: 0;
          background: #3b82f6;
          color: white;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 2px;
          white-space: nowrap;
          z-index: 10000;
        }
        .touch-target-test-grid {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 9998;
          background-image: 
            repeating-linear-gradient(0deg, transparent, transparent 43px, rgba(59, 130, 246, 0.1) 43px, rgba(59, 130, 246, 0.1) 44px),
            repeating-linear-gradient(90deg, transparent, transparent 43px, rgba(59, 130, 246, 0.1) 43px, rgba(59, 130, 246, 0.1) 44px);
        }
      `;
      document.head.appendChild(style);

      // Add grid overlay
      const grid = document.createElement('div');
      grid.className = 'touch-target-test-grid';
      document.body.appendChild(grid);
    } else {
      // Remove test mode styles
      const style = document.getElementById('touch-target-test-styles');
      if (style) style.remove();

      const grid = document.querySelector('.touch-target-test-grid');
      if (grid) grid.remove();

      resetHighlights();
    }
  };

  useEffect(() => {
    if (isOpen) {
      scanForTouchTargetIssues();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      resetHighlights();
      const style = document.getElementById('touch-target-test-styles');
      if (style) style.remove();
      const grid = document.querySelector('.touch-target-test-grid');
      if (grid) grid.remove();
    };
  }, []);

  const severityColor = (severity: TouchTargetIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'text-[var(--color-data-fail)]';
      case 'medium':
        return 'text-[var(--color-data-provisional)]';
      case 'low':
        return 'text-[var(--color-data-pass)]';
    }
  };

  const severityBg = (severity: TouchTargetIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-[var(--color-data-fail)]/10';
      case 'medium':
        return 'bg-[var(--color-data-provisional)]/10';
      case 'low':
        return 'bg-[var(--color-data-pass)]/10';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            ref={containerRef}
          >
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                    Touch Target Accessibility Audit
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Minimum touch target size: {minTouchSize}×{minTouchSize}px (WCAG recommendation)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StandardButton variant="outline" size="sm" onClick={toggleTestMode}>
                    {testMode ? 'Exit Test Mode' : 'Enter Test Mode'}
                  </StandardButton>
                  <StandardButton variant="ghost" size="sm" onClick={onClose}>
                    Close
                  </StandardButton>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex border border-[var(--color-border)] rounded-lg overflow-hidden">
                  {(['issues', 'recommendations', 'test'] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="highlight-issues"
                    checked={highlightIssues}
                    onChange={(e) => setHighlightIssues(e.target.checked)}
                    className="rounded border-[var(--color-border)]"
                  />
                  <label
                    htmlFor="highlight-issues"
                    className="text-sm text-[var(--color-text-secondary)]"
                  >
                    Highlight issues
                  </label>
                </div>

                <StandardButton
                  variant="outline"
                  size="sm"
                  onClick={scanForTouchTargetIssues}
                  loading={isScanning}
                >
                  {isScanning ? 'Scanning...' : 'Rescan'}
                </StandardButton>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {activeTab === 'issues' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                        Touch Target Issues
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Found {issues.length} elements with suboptimal touch target sizes
                      </p>
                    </div>
                    {issues.length > 0 && (
                      <StandardButton variant="primary" size="sm" onClick={applyAllFixes}>
                        Apply All Fixes
                      </StandardButton>
                    )}
                  </div>

                  {issues.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">🎉</div>
                      <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                        No Touch Target Issues Found
                      </h4>
                      <p className="text-[var(--color-text-muted)]">
                        All interactive elements meet the minimum {minTouchSize}×{minTouchSize}px
                        touch target size.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.map((issue) => (
                        <motion.div
                          key={issue.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${severityBg(issue.severity)} ${severityColor(issue.severity)}`}
                                >
                                  {issue.severity.toUpperCase()}
                                </span>
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {issue.type.charAt(0).toUpperCase() + issue.type.slice(1)}
                                </span>
                              </div>

                              <p className="text-sm text-[var(--color-text-primary)] mb-3">
                                {issue.description}
                              </p>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Current Size</p>
                                  <p className="font-medium">
                                    {issue.currentSize.width}×{issue.currentSize.height}px
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Recommended</p>
                                  <p className="font-medium text-[var(--color-data-pass)]">
                                    {issue.recommendedSize.width}×{issue.recommendedSize.height}px
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Selector</p>
                                  <code className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
                                    {issue.selector}
                                  </code>
                                </div>
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Font Size</p>
                                  <p className="font-medium">{issue.computedStyle.fontSize}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 ml-4">
                              <StandardButton
                                variant="outline"
                                size="sm"
                                onClick={() => highlightElement(issue)}
                              >
                                Highlight
                              </StandardButton>
                              <StandardButton
                                variant="primary"
                                size="sm"
                                onClick={() => applyFix(issue)}
                              >
                                Apply Fix
                              </StandardButton>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'recommendations' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Touch Target Best Practices
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                          Minimum Size
                        </h4>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                          All interactive elements should have a minimum touch target of{' '}
                          {minTouchSize}×{minTouchSize} pixels.
                        </p>
                        <div className="flex items-center justify-center h-32">
                          <div className="relative">
                            <div className="w-44 h-44 border-2 border-dashed border-[var(--color-border)] rounded-lg flex items-center justify-center">
                              <span className="text-sm text-[var(--color-text-muted)]">
                                {minTouchSize}×{minTouchSize}px
                              </span>
                            </div>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-[var(--color-accent)]/20 border border-[var(--color-accent)] rounded flex items-center justify-center">
                              <span className="text-xs">Small Button</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                          Spacing
                        </h4>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                          Maintain at least 8px spacing between touch targets to prevent accidental
                          taps.
                        </p>
                        <div className="flex items-center justify-center h-32 gap-2">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="w-16 h-16 bg-[var(--color-accent)]/20 border border-[var(--color-accent)] rounded flex items-center justify-center"
                            >
                              <span className="text-xs">Button</span>
                            </div>
                          ))}
                          <div className="w-8 h-16 flex items-center justify-center">
                            <div className="w-full h-1 bg-[var(--color-border)]"></div>
                          </div>
                          {[4, 5].map((i) => (
                            <div
                              key={i}
                              className="w-16 h-16 bg-[var(--color-accent)]/20 border border-[var(--color-accent)] rounded flex items-center justify-center"
                            >
                              <span className="text-xs">Button</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                          Visual Feedback
                        </h4>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                          Provide clear visual feedback on touch (hover, active states) and ensure
                          sufficient contrast.
                        </p>
                        <div className="flex items-center justify-center h-32">
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-20 h-10 bg-[var(--color-accent)] rounded flex items-center justify-center text-white text-sm">
                                Normal
                              </div>
                              <div className="w-20 h-10 bg-[var(--color-accent)]/80 rounded flex items-center justify-center text-white text-sm border-2 border-[var(--color-accent)]">
                                Hover
                              </div>
                              <div className="w-20 h-10 bg-[var(--color-accent)]/60 rounded flex items-center justify-center text-white text-sm scale-95">
                                Active
                              </div>
                            </div>
                            <div className="text-center text-xs text-[var(--color-text-muted)]">
                              Different states for touch feedback
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                          Implementation Tips
                        </h4>
                        <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Use{' '}
                            <code className="bg-[var(--color-bg-tertiary)] px-1 rounded">
                              min-height: 44px
                            </code>{' '}
                            for buttons
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Add{' '}
                            <code className="bg-[var(--color-bg-tertiary)] px-1 rounded">
                              padding: 8px 16px
                            </code>{' '}
                            for comfortable touch
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Use CSS{' '}
                            <code className="bg-[var(--color-bg-tertiary)] px-1 rounded">
                              min-width
                            </code>{' '}
                            for icon buttons
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Test on actual mobile devices with different screen sizes
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Consider users with motor impairments who need larger targets
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'test' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Touch Target Testing
                    </h3>

                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                            Test Guidelines
                          </h4>
                          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                            <li>
                              • The grid overlay shows {minTouchSize}×{minTouchSize}px squares
                            </li>
                            <li>
                              • All interactive elements should fit within at least one square
                            </li>
                            <li>• Tap each element to ensure it's easily clickable</li>
                            <li>• Check for sufficient spacing between elements</li>
                            <li>
                              • Test with different finger sizes (use the "Finger Test" below)
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                            Finger Size Simulation
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-[var(--color-text-secondary)]">
                                  Finger Size
                                </span>
                                <span className="text-sm font-medium">16mm (Average)</span>
                              </div>
                              <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                                <div className="h-full w-2/3 bg-[var(--color-accent)]"></div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="text-center">
                                  <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/20 border-2 border-[var(--color-accent)] mx-auto mb-2 flex items-center justify-center">
                                    <span className="text-xs">16mm</span>
                                  </div>
                                  <p className="text-xs text-[var(--color-text-muted)]">Average</p>
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="text-center">
                                  <div className="w-20 h-20 rounded-full bg-[var(--color-data-provisional)]/20 border-2 border-[var(--color-data-provisional)] mx-auto mb-2 flex items-center justify-center">
                                    <span className="text-xs">20mm</span>
                                  </div>
                                  <p className="text-xs text-[var(--color-text-muted)]">Large</p>
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="text-center">
                                  <div className="w-24 h-24 rounded-full bg-[var(--color-data-fail)]/20 border-2 border-[var(--color-data-fail)] mx-auto mb-2 flex items-center justify-center">
                                    <span className="text-xs">24mm</span>
                                  </div>
                                  <p className="text-xs text-[var(--color-text-muted)]">
                                    XL (Accessibility)
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                        Test Elements
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { size: '32px', meets: false, label: 'Too Small' },
                          { size: '44px', meets: true, label: 'Minimum' },
                          { size: '48px', meets: true, label: 'Good' },
                          { size: '56px', meets: true, label: 'Excellent' },
                        ].map((item, index) => (
                          <div
                            key={index}
                            className={`border-2 rounded-lg flex flex-col items-center justify-center p-4 ${
                              item.meets
                                ? 'border-[var(--color-data-pass)] bg-[var(--color-data-pass)]/5'
                                : 'border-[var(--color-data-fail)] bg-[var(--color-data-fail)]/5'
                            }`}
                          >
                            <div
                              className={`rounded flex items-center justify-center mb-2 ${
                                item.meets
                                  ? 'bg-[var(--color-data-pass)]/20'
                                  : 'bg-[var(--color-data-fail)]/20'
                              }`}
                              style={{ width: item.size, height: item.size }}
                            >
                              <span className="text-xs">{item.size}</span>
                            </div>
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--color-text-muted)]">
                  {issues.length > 0 ? (
                    <span>
                      Found{' '}
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {issues.length}
                      </span>{' '}
                      touch target issues
                    </span>
                  ) : (
                    <span>All touch targets meet accessibility standards</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StandardButton variant="outline" size="sm" onClick={resetHighlights}>
                    Clear Highlights
                  </StandardButton>
                  <StandardButton variant="primary" size="sm" onClick={scanForTouchTargetIssues}>
                    Run Full Audit
                  </StandardButton>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
