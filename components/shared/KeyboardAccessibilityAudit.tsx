/**
 * KeyboardAccessibilityAudit - Component for auditing and improving keyboard navigation
 *
 * This component helps identify and fix keyboard accessibility issues across the application.
 * It provides:
 * 1. Keyboard navigation testing tools
 * 2. Focus management utilities
 * 3. Accessibility issue detection
 * 4. Keyboard shortcut validation
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Zap,
  ArrowRight,
  Focus,
  Indent,
  Command,
  X,
} from 'lucide-react';
import { StandardButton } from './StandardButton';

export interface AccessibilityIssue {
  id: string;
  element: HTMLElement;
  type: 'focus' | 'keyboard' | 'aria' | 'tabindex' | 'contrast';
  severity: 'low' | 'medium' | 'high';
  message: string;
  fix: string;
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: 'navigation' | 'quiz' | 'general' | 'accessibility';
  implemented: boolean;
}

interface KeyboardAccessibilityAuditProps {
  /** Whether to show the audit panel by default */
  defaultOpen?: boolean;
  /** Callback when issues are found */
  onIssuesFound?: (issues: AccessibilityIssue[]) => void;
}

export const KeyboardAccessibilityAudit: React.FC<KeyboardAccessibilityAuditProps> = ({
  defaultOpen = false,
  onIssuesFound,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showFocusRings, setShowFocusRings] = useState(false);
  const [showTabOrder, setShowTabOrder] = useState(false);
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'shortcuts' | 'testing'>('audit');
  const [isAuditing, setIsAuditing] = useState(false);
  const [tabOrderElements, setTabOrderElements] = useState<HTMLElement[]>([]);
  const [currentFocusIndex, setCurrentFocusIndex] = useState<number>(-1);

  const auditRef = useRef<HTMLDivElement>(null);

  // Common keyboard shortcuts for the application
  const keyboardShortcuts: KeyboardShortcut[] = [
    {
      key: 'Tab',
      description: 'Navigate forward through interactive elements',
      category: 'navigation',
      implemented: true,
    },
    {
      key: 'Shift + Tab',
      description: 'Navigate backward through interactive elements',
      category: 'navigation',
      implemented: true,
    },
    {
      key: 'Enter / Space',
      description: 'Activate buttons and links',
      category: 'navigation',
      implemented: true,
    },
    {
      key: 'Arrow Keys',
      description: 'Navigate within components (lists, menus)',
      category: 'navigation',
      implemented: true,
    },
    {
      key: 'Escape',
      description: 'Close modals, cancel actions',
      category: 'navigation',
      implemented: true,
    },
    {
      key: 'A/B/C/D',
      description: 'Select answer in quiz mode',
      category: 'quiz',
      implemented: true,
    },
    {
      key: 'Shift + A/B/C/D',
      description: 'Flag answer in quiz mode',
      category: 'quiz',
      implemented: true,
    },
    {
      key: '⌘/Ctrl + K',
      description: 'Open command palette',
      category: 'general',
      implemented: true,
    },
    {
      key: '⌘/Ctrl + /',
      description: 'Show keyboard shortcuts',
      category: 'general',
      implemented: true,
    },
    {
      key: '[',
      description: 'Toggle sidebar navigation',
      category: 'navigation',
      implemented: true,
    },
    {
      key: 'F6',
      description: 'Cycle through main regions (planned)',
      category: 'accessibility',
      implemented: false,
    },
    {
      key: 'Shift + F6',
      description: 'Cycle backward through regions (planned)',
      category: 'accessibility',
      implemented: false,
    },
  ];

  // Run accessibility audit
  const runAudit = () => {
    setIsAuditing(true);
    const newIssues: AccessibilityIssue[] = [];

    // Check for interactive elements without keyboard handlers
    const interactiveElements = document.querySelectorAll<HTMLElement>(
      'button, [role="button"], [tabindex], a[href], input, select, textarea'
    );

    interactiveElements.forEach((element, index) => {
      // Check 1: Elements with click handlers but no keyboard handlers
      const hasClickHandler =
        element.onclick !== null ||
        element.getAttribute('onclick') !== null ||
        element.hasAttribute('data-onclick');

      const hasKeyHandler =
        element.onkeydown !== null ||
        element.getAttribute('onkeydown') !== null ||
        element.hasAttribute('data-onkeydown');

      if (hasClickHandler && !hasKeyHandler && !element.hasAttribute('role')) {
        newIssues.push({
          id: `click-no-keyboard-${index}`,
          element,
          type: 'keyboard',
          severity: 'medium',
          message: 'Element has click handler but no keyboard handler',
          fix: 'Add onKeyDown handler or ensure element is focusable with proper role',
        });
      }

      // Check 2: Elements with tabindex but not focusable
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex === '-1' && element.hasAttribute('onclick')) {
        newIssues.push({
          id: `tabindex-negative-${index}`,
          element,
          type: 'tabindex',
          severity: 'low',
          message: 'Interactive element has tabindex="-1" but has click handler',
          fix: 'Consider making element focusable (tabindex="0") or adding keyboard handler',
        });
      }

      // Check 3: Missing aria labels
      const hasAriaLabel =
        element.hasAttribute('aria-label') ||
        element.hasAttribute('aria-labelledby') ||
        (element.tagName === 'BUTTON' && element.textContent?.trim()) ||
        (element.tagName === 'A' && element.textContent?.trim());

      if (
        !hasAriaLabel &&
        (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button')
      ) {
        newIssues.push({
          id: `missing-aria-${index}`,
          element,
          type: 'aria',
          severity: 'medium',
          message: 'Button missing accessible label',
          fix: 'Add aria-label or ensure button has visible text content',
        });
      }
    });

    // Check 4: Focus trap in modals
    const modals = document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]');
    modals.forEach((modal, index) => {
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0 && modal.style.display !== 'none') {
        newIssues.push({
          id: `modal-no-focus-${index}`,
          element: modal,
          type: 'focus',
          severity: 'high',
          message: 'Modal dialog has no focusable elements',
          fix: 'Add at least one focusable element to the modal',
        });
      }
    });

    setIssues(newIssues);
    setIsAuditing(false);

    if (onIssuesFound && newIssues.length > 0) {
      onIssuesFound(newIssues);
    }
  };

  // Toggle focus rings for visual debugging
  useEffect(() => {
    if (showFocusRings) {
      document.body.classList.add('show-focus-rings');
    } else {
      document.body.classList.remove('show-focus-rings');
    }

    return () => {
      document.body.classList.remove('show-focus-rings');
    };
  }, [showFocusRings]);

  // Show tab order visualization
  useEffect(() => {
    if (showTabOrder) {
      const focusableElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          !el.hasAttribute('disabled')
        );
      });

      setTabOrderElements(focusableElements);

      // Add visual indicators
      focusableElements.forEach((el, index) => {
        const indicator = document.createElement('div');
        indicator.className = 'tab-order-indicator';
        indicator.textContent = (index + 1).toString();
        indicator.style.cssText = `
          position: absolute;
          top: -8px;
          left: -8px;
          background: #3B82F6;
          color: white;
          font-size: 12px;
          font-weight: bold;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          pointer-events: none;
        `;

        const rect = el.getBoundingClientRect();
        indicator.style.top = `${rect.top + window.scrollY - 10}px`;
        indicator.style.left = `${rect.left + window.scrollX - 10}px`;
        indicator.setAttribute('data-tab-index', index.toString());

        document.body.appendChild(indicator);
      });
    } else {
      // Clean up indicators
      document.querySelectorAll('.tab-order-indicator').forEach((el) => el.remove());
      setTabOrderElements([]);
    }

    return () => {
      document.querySelectorAll('.tab-order-indicator').forEach((el) => el.remove());
    };
  }, [showTabOrder]);

  // Handle keyboard navigation for the audit panel itself
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close panel on Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }

      // Toggle focus rings with Ctrl+Shift+F
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowFocusRings((prev) => !prev);
      }

      // Toggle tab order with Ctrl+Shift+T
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShowTabOrder((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Navigate through tab order elements
  const navigateTabOrder = (direction: 'next' | 'prev') => {
    if (tabOrderElements.length === 0) return;

    let newIndex = currentFocusIndex;
    if (direction === 'next') {
      newIndex = (currentFocusIndex + 1) % tabOrderElements.length;
    } else {
      newIndex = currentFocusIndex <= 0 ? tabOrderElements.length - 1 : currentFocusIndex - 1;
    }

    setCurrentFocusIndex(newIndex);
    tabOrderElements[newIndex]?.focus();
  };

  const severityColor = (severity: AccessibilityIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] border-[var(--color-data-fail)]/30';
      case 'medium':
        return 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]/30';
      case 'low':
        return 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)] border-[var(--color-data-pass)]/30';
    }
  };

  const severityIcon = (severity: AccessibilityIssue['severity']) => {
    switch (severity) {
      case 'high':
        return <AlertCircle className="w-4 h-4" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4" />;
      case 'low':
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-4 z-50 p-3 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
        aria-label={isOpen ? 'Close accessibility audit' : 'Open accessibility audit'}
        title="Accessibility Audit (Ctrl+Shift+A)"
      >
        <Keyboard className="w-5 h-5 text-[var(--color-text-primary)]" />
        {issues.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-data-fail)] text-white text-xs rounded-full flex items-center justify-center">
            {issues.length}
          </span>
        )}
      </button>

      {/* Audit Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={auditRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-32 right-4 z-50 w-96 max-h-[80vh] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard accessibility audit panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-3">
                <Keyboard className="w-5 h-5 text-[var(--color-accent)]" />
                <h2 className="font-semibold text-[var(--color-text-primary)]">
                  Keyboard Accessibility
                </h2>
                {issues.length > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] rounded-full">
                    {issues.length} issues
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div
              className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]"
              role="tablist"
              aria-label="Accessibility audit sections"
            >
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'audit' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                aria-selected={activeTab === 'audit' ? 'true' : 'false'}
                role="tab"
                id="tab-audit"
                aria-controls="tabpanel-audit"
              >
                Audit
              </button>
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'shortcuts' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                aria-selected={activeTab === 'shortcuts' ? 'true' : 'false'}
                role="tab"
                id="tab-shortcuts"
                aria-controls="tabpanel-shortcuts"
              >
                Shortcuts
              </button>
              <button
                onClick={() => setActiveTab('testing')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'testing' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                aria-selected={activeTab === 'testing' ? 'true' : 'false'}
                role="tab"
                id="tab-testing"
                aria-controls="tabpanel-testing"
              >
                Testing
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Audit Tab Panel */}
              <div
                role="tabpanel"
                id="tabpanel-audit"
                aria-labelledby="tab-audit"
                tabIndex={0}
                hidden={activeTab !== 'audit'}
                className={activeTab === 'audit' ? 'block' : 'hidden'}
              >
                {activeTab === 'audit' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-[var(--color-text-primary)]">
                        Accessibility Issues
                      </h3>
                      <StandardButton
                        variant="primary"
                        size="sm"
                        onClick={runAudit}
                        loading={isAuditing}
                      >
                        {isAuditing ? 'Scanning...' : 'Run Audit'}
                      </StandardButton>
                    </div>

                    {issues.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-[var(--color-data-pass)] mx-auto mb-3" />
                        <p className="text-[var(--color-text-primary)] font-medium">
                          No accessibility issues found
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">
                          Run an audit to check for keyboard navigation issues
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {issues.map((issue) => (
                          <div
                            key={issue.id}
                            className={`p-3 rounded-lg border ${severityColor(issue.severity)}`}
                          >
                            <div className="flex items-start gap-2">
                              {severityIcon(issue.severity)}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{issue.message}</p>
                                <p className="text-xs mt-1 opacity-80">{issue.fix}</p>
                                <button
                                  onClick={() => {
                                    issue.element.scrollIntoView({
                                      behavior: 'smooth',
                                      block: 'center',
                                    });
                                    issue.element.focus();
                                  }}
                                  className="text-xs mt-2 text-[var(--color-accent)] hover:underline"
                                >
                                  Jump to element
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Shortcuts Tab Panel */}
              <div
                role="tabpanel"
                id="tabpanel-shortcuts"
                aria-labelledby="tab-shortcuts"
                tabIndex={0}
                hidden={activeTab !== 'shortcuts'}
                className={activeTab === 'shortcuts' ? 'block' : 'hidden'}
              >
                {activeTab === 'shortcuts' && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-[var(--color-text-primary)]">
                      Keyboard Shortcuts
                    </h3>
                    <div className="space-y-3">
                      {keyboardShortcuts.map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <kbd className="px-2 py-1 text-xs font-mono bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded">
                                {shortcut.key}
                              </kbd>
                              <span
                                className={`text-xs px-2 py-1 rounded ${shortcut.category === 'navigation' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : shortcut.category === 'quiz' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'bg-[var(--color-bg-secondary)]/20 text-[var(--color-text-muted)]'}`}
                              >
                                {shortcut.category}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--color-text-primary)] mt-1">
                              {shortcut.description}
                            </p>
                          </div>
                          <div
                            className={`w-2 h-2 rounded-full ${shortcut.implemented ? 'bg-[var(--color-data-pass)]' : 'bg-[var(--color-data-fail)]'}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Testing Tab Panel */}
              <div
                role="tabpanel"
                id="tabpanel-testing"
                aria-labelledby="tab-testing"
                tabIndex={0}
                hidden={activeTab !== 'testing'}
                className={activeTab === 'testing' ? 'block' : 'hidden'}
              >
                {activeTab === 'testing' && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-[var(--color-text-primary)]">Testing Tools</h3>

                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Focus className="w-4 h-4" />
                            <span className="font-medium">Focus Rings</span>
                          </div>
                          <button
                            onClick={() => setShowFocusRings(!showFocusRings)}
                            className={`px-3 py-1 text-xs rounded-full ${showFocusRings ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-primary)] border border-[var(--color-border)]'}`}
                          >
                            {showFocusRings ? 'On' : 'Off'}
                          </button>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          Visualize focus states for keyboard navigation (Ctrl+Shift+F)
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Indent className="w-4 h-4" />
                            <span className="font-medium">Tab Order</span>
                          </div>
                          <button
                            onClick={() => setShowTabOrder(!showTabOrder)}
                            className={`px-3 py-1 text-xs rounded-full ${showTabOrder ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-primary)] border border-[var(--color-border)]'}`}
                          >
                            {showTabOrder ? 'On' : 'Off'}
                          </button>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] mb-3">
                          Show tab navigation order (Ctrl+Shift+T)
                        </p>

                        {showTabOrder && tabOrderElements.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <StandardButton
                                variant="outline"
                                size="xs"
                                onClick={() => navigateTabOrder('prev')}
                              >
                                ← Previous
                              </StandardButton>
                              <StandardButton
                                variant="outline"
                                size="xs"
                                onClick={() => navigateTabOrder('next')}
                              >
                                Next →
                              </StandardButton>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {tabOrderElements.length} focusable elements found
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4" />
                          <span className="font-medium">Quick Tests</span>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              const firstFocusable = document.querySelector<HTMLElement>(
                                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                              );
                              firstFocusable?.focus();
                            }}
                            className="w-full text-left p-2 text-sm rounded hover:bg-[var(--color-bg-primary)]"
                          >
                            Focus first interactive element
                          </button>
                          <button
                            onClick={() => {
                              if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                              }
                            }}
                            className="w-full text-left p-2 text-sm rounded hover:bg-[var(--color-bg-primary)]"
                          >
                            Remove focus from current element
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Press Escape to close</span>
                <span>Ctrl+Shift+A to toggle</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global styles for focus rings */}
      <style>
        {`
          .show-focus-rings *:focus {
            outline: 3px solid #3B82F6 !important;
            outline-offset: 2px !important;
          }
          
          .show-focus-rings *:focus:not(.focus-visible) {
            outline: none !important;
          }
        `}
      </style>
    </>
  );
};
