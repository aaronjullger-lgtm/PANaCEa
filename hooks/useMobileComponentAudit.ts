import { useState, useCallback, useEffect } from 'react';

export interface MobileComponentIssue {
  component: string;
  type: 'layout' | 'navigation' | 'interaction' | 'performance' | 'accessibility';
  issue: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
  affectedSelectors: string[];
}

export interface MobileComponentAuditConfig {
  checkViewportOverflow?: boolean;
  checkTouchTargets?: boolean;
  checkFormElements?: boolean;
  checkNavigation?: boolean;
  checkModals?: boolean;
}

export function useMobileComponentAudit(config: MobileComponentAuditConfig = {}) {
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  const {
    checkViewportOverflow = true,
    checkTouchTargets = true,
    checkFormElements = true,
    checkNavigation = true,
    checkModals = true,
  } = config;

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openAudit = useCallback(() => {
    setIsAuditOpen(true);
  }, []);

  const closeAudit = useCallback(() => {
    setIsAuditOpen(false);
  }, []);

  const toggleAudit = useCallback(() => {
    setIsAuditOpen((prev) => !prev);
  }, []);

  const scanPageForMobileIssues = useCallback((): MobileComponentIssue[] => {
    if (typeof window === 'undefined') return [];

    const issues: MobileComponentIssue[] = [];

    // Check viewport overflow
    if (checkViewportOverflow) {
      const overflowingElements = findOverflowingElements();
      if (overflowingElements.length > 0) {
        issues.push({
          component: 'Layout',
          type: 'layout',
          issue: 'Horizontal overflow detected',
          severity: 'high',
          description: `${overflowingElements.length} element(s) overflow the viewport horizontally`,
          recommendation: 'Add overflow-x: hidden or make elements responsive',
          affectedSelectors: overflowingElements,
        });
      }
    }

    // Check touch targets
    if (checkTouchTargets) {
      const smallTouchTargets = findSmallTouchTargets();
      if (smallTouchTargets.length > 0) {
        issues.push({
          component: 'Interactive Elements',
          type: 'interaction',
          issue: 'Small touch targets',
          severity: 'medium',
          description: `${smallTouchTargets.length} interactive element(s) have touch targets smaller than 44px`,
          recommendation: 'Increase min-height/min-width to 44px and add sufficient padding',
          affectedSelectors: smallTouchTargets,
        });
      }
    }

    // Check form elements
    if (checkFormElements) {
      const problematicForms = findProblematicFormElements();
      if (problematicForms.length > 0) {
        issues.push({
          component: 'Forms',
          type: 'interaction',
          issue: 'Form usability issues',
          severity: 'medium',
          description: `${problematicForms.length} form element(s) may be difficult to use on mobile`,
          recommendation: 'Ensure inputs are at least 44px tall and properly spaced',
          affectedSelectors: problematicForms,
        });
      }
    }

    // Check navigation
    if (checkNavigation) {
      const navigationIssues = findNavigationIssues();
      if (navigationIssues.length > 0) {
        issues.push({
          component: 'Navigation',
          type: 'navigation',
          issue: 'Navigation accessibility issues',
          severity: 'high',
          description: 'Navigation may be difficult to reach or use on mobile',
          recommendation: 'Consider bottom navigation or improving menu placement',
          affectedSelectors: navigationIssues,
        });
      }
    }

    // Check modals
    if (checkModals) {
      const modalIssues = findModalIssues();
      if (modalIssues.length > 0) {
        issues.push({
          component: 'Modals/Dialogs',
          type: 'layout',
          issue: 'Modal display issues',
          severity: 'medium',
          description: 'Modals may not display properly on mobile screens',
          recommendation: 'Use full-screen modals on mobile with proper dismissal',
          affectedSelectors: modalIssues,
        });
      }
    }

    return issues;
  }, [
    checkViewportOverflow,
    checkTouchTargets,
    checkFormElements,
    checkNavigation,
    checkModals,
    viewportWidth,
    viewportHeight,
  ]);

  const findOverflowingElements = (): string[] => {
    const selectors: string[] = [];
    const elements = document.querySelectorAll('*');

    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        const rect = el.getBoundingClientRect();
        if (rect.right > viewportWidth || rect.left < 0) {
          const style = window.getComputedStyle(el);
          if (style.overflowX === 'visible' && el.scrollWidth > el.clientWidth) {
            selectors.push(getElementSelector(el));
          }
        }
      }
    });

    return selectors;
  };

  const findSmallTouchTargets = (): string[] => {
    const selectors: string[] = [];
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const elements = document.querySelectorAll(interactiveSelectors.join(', '));

    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          selectors.push(getElementSelector(el));
        }
      }
    });

    return selectors;
  };

  const findProblematicFormElements = (): string[] => {
    const selectors: string[] = [];
    const formElements = document.querySelectorAll('input, select, textarea');

    formElements.forEach((el) => {
      if (el instanceof HTMLElement) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Check for small form elements
        if (rect.height < 44) {
          selectors.push(getElementSelector(el));
        }

        // Check for poor spacing
        const marginBottom = parseFloat(style.marginBottom);
        if (marginBottom < 8 && el.nextElementSibling) {
          selectors.push(getElementSelector(el));
        }
      }
    });

    return selectors;
  };

  const findNavigationIssues = (): string[] => {
    const selectors: string[] = [];

    // Look for top-positioned navigation on mobile
    if (viewportWidth < 768) {
      const navElements = document.querySelectorAll('nav, [role="navigation"], .navbar, .header');

      navElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          const rect = el.getBoundingClientRect();
          // Check if navigation is at top (hard to reach)
          if (rect.top < 100 && rect.height > 50) {
            selectors.push(getElementSelector(el));
          }
        }
      });
    }

    return selectors;
  };

  const findModalIssues = (): string[] => {
    const selectors: string[] = [];
    const modalElements = document.querySelectorAll('[role="dialog"], .modal, .dialog');

    modalElements.forEach((el) => {
      if (el instanceof HTMLElement) {
        const rect = el.getBoundingClientRect();
        // Check if modal is too wide for mobile
        if (viewportWidth < 768 && rect.width > viewportWidth * 0.9) {
          selectors.push(getElementSelector(el));
        }
      }
    });

    return selectors;
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

  const highlightElements = useCallback((selectors: string[]) => {
    if (typeof window === 'undefined') return;

    // Remove existing highlights
    document.querySelectorAll('.mobile-component-highlight').forEach((el) => {
      el.classList.remove('mobile-component-highlight');
    });

    // Add highlight style if not already present
    if (!document.getElementById('mobile-component-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'mobile-component-highlight-style';
      style.textContent = `
        .mobile-component-highlight {
          outline: 3px solid #f59e0b !important;
          outline-offset: 2px !important;
          background-color: rgba(245, 158, 11, 0.1) !important;
          position: relative !important;
          z-index: 9999 !important;
        }
        .mobile-component-highlight::after {
          content: "Mobile Issue";
          position: absolute;
          top: -24px;
          left: 0;
          background: #f59e0b;
          color: white;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 2px;
          white-space: nowrap;
          z-index: 10000;
        }
      `;
      document.head.appendChild(style);
    }

    // Highlight elements
    selectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        element.classList.add('mobile-component-highlight');
      }
    });
  }, []);

  const clearHighlights = useCallback(() => {
    document.querySelectorAll('.mobile-component-highlight').forEach((el) => {
      el.classList.remove('mobile-component-highlight');
    });
  }, []);

  const getMobileScore = useCallback(() => {
    const issues = scanPageForMobileIssues();
    if (issues.length === 0) return 100;

    // Calculate score based on severity and number of issues
    const severityWeights = { high: 0.5, medium: 0.7, low: 0.9 };
    const totalWeight = issues.reduce((sum, issue) => {
      const weight = severityWeights[issue.severity];
      const issueCount = issue.affectedSelectors.length || 1;
      return sum + weight * issueCount;
    }, 0);

    const averageWeight = totalWeight / issues.length;
    return Math.round(averageWeight * 100);
  }, [scanPageForMobileIssues]);

  const getMobileStats = useCallback(() => {
    const issues = scanPageForMobileIssues();
    const totalIssues = issues.length;
    const totalAffected = issues.reduce((sum, issue) => sum + issue.affectedSelectors.length, 0);

    const byType = issues.reduce(
      (acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const bySeverity = issues.reduce(
      (acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalIssues,
      totalAffected,
      byType,
      bySeverity,
      issues,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
        isMobile: viewportWidth < 768,
      },
      score: getMobileScore(),
    };
  }, [scanPageForMobileIssues, viewportWidth, viewportHeight, getMobileScore]);

  return {
    isAuditOpen,
    openAudit,
    closeAudit,
    toggleAudit,
    scanPageForMobileIssues,
    highlightElements,
    clearHighlights,
    getMobileScore,
    getMobileStats,
    config: {
      checkViewportOverflow,
      checkTouchTargets,
      checkFormElements,
      checkNavigation,
      checkModals,
    },
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
      isMobile: viewportWidth < 768,
    },
  };
}
