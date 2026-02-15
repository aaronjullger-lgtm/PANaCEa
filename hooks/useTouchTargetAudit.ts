import { useState, useCallback } from 'react';

export interface TouchTargetAuditConfig {
  minTouchSize?: number;
  autoScanOnOpen?: boolean;
  showTestMode?: boolean;
}

export function useTouchTargetAudit(config: TouchTargetAuditConfig = {}) {
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const { minTouchSize = 44, autoScanOnOpen = true, showTestMode = true } = config;

  const openAudit = useCallback(() => {
    setIsAuditOpen(true);
  }, []);

  const closeAudit = useCallback(() => {
    setIsAuditOpen(false);
  }, []);

  const toggleAudit = useCallback(() => {
    setIsAuditOpen((prev) => !prev);
  }, []);

  const scanPageForTouchTargets = useCallback(() => {
    if (typeof window === 'undefined') return [];

    const issues: Array<{
      selector: string;
      width: number;
      height: number;
      type: string;
      meetsStandard: boolean;
    }> = [];

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
    ];

    const elements = document.querySelectorAll(interactiveSelectors.join(', '));

    elements.forEach((element) => {
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

      const rect = element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const meetsWidth = width >= minTouchSize;
      const meetsHeight = height >= minTouchSize;
      const meetsStandard = meetsWidth && meetsHeight;

      // Determine element type
      let type = 'custom';
      if (element.tagName === 'BUTTON') type = 'button';
      else if (element.tagName === 'A') type = 'link';
      else if (
        element.tagName === 'INPUT' ||
        element.tagName === 'SELECT' ||
        element.tagName === 'TEXTAREA'
      )
        type = 'input';
      else if (element.querySelector('svg') || element.classList.contains('icon')) type = 'icon';

      issues.push({
        selector: getElementSelector(element),
        width: Math.round(width),
        height: Math.round(height),
        type,
        meetsStandard,
      });
    });

    return issues;
  }, [minTouchSize]);

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

  const applyTouchTargetFix = useCallback(
    (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;

      const style = window.getComputedStyle(element);
      const currentWidth = element.offsetWidth;
      const currentHeight = element.offsetHeight;

      // Apply minimum dimensions
      if (currentWidth < minTouchSize) {
        element.style.minWidth = `${minTouchSize}px`;
      }

      if (currentHeight < minTouchSize) {
        element.style.minHeight = `${minTouchSize}px`;
      }

      // Ensure sufficient padding
      const paddingTop = parseFloat(style.paddingTop);
      const paddingBottom = parseFloat(style.paddingBottom);
      const paddingLeft = parseFloat(style.paddingLeft);
      const paddingRight = parseFloat(style.paddingRight);

      if (paddingTop + paddingBottom < 8) {
        const verticalPadding = Math.max(4, (8 - (paddingTop + paddingBottom)) / 2);
        element.style.paddingTop = `${paddingTop + verticalPadding}px`;
        element.style.paddingBottom = `${paddingBottom + verticalPadding}px`;
      }

      if (paddingLeft + paddingRight < 8) {
        const horizontalPadding = Math.max(4, (8 - (paddingLeft + paddingRight)) / 2);
        element.style.paddingLeft = `${paddingLeft + horizontalPadding}px`;
        element.style.paddingRight = `${paddingRight + horizontalPadding}px`;
      }

      return true;
    },
    [minTouchSize]
  );

  const getTouchTargetStats = useCallback(() => {
    const issues = scanPageForTouchTargets();
    const total = issues.length;
    const passing = issues.filter((issue) => issue.meetsStandard).length;
    const failing = total - passing;

    return {
      total,
      passing,
      failing,
      passRate: total > 0 ? (passing / total) * 100 : 100,
      issues: issues.filter((issue) => !issue.meetsStandard),
    };
  }, [scanPageForTouchTargets]);

  const highlightTouchTargets = useCallback(
    (highlight: boolean) => {
      if (typeof window === 'undefined') return;

      // Remove existing highlights
      document.querySelectorAll('.touch-target-highlight').forEach((el) => {
        el.classList.remove('touch-target-highlight');
      });

      if (highlight) {
        // Add highlight style if not already present
        if (!document.getElementById('touch-target-highlight-style')) {
          const style = document.createElement('style');
          style.id = 'touch-target-highlight-style';
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
        `;
          document.head.appendChild(style);
        }

        // Highlight elements that don't meet touch target standards
        const issues = scanPageForTouchTargets();
        issues.forEach((issue) => {
          if (!issue.meetsStandard) {
            const element = document.querySelector(issue.selector);
            if (element instanceof HTMLElement) {
              element.classList.add('touch-target-highlight');
              element.setAttribute('data-touch-size', `${issue.width}×${issue.height}px`);
            }
          }
        });
      }
    },
    [scanPageForTouchTargets]
  );

  return {
    isAuditOpen,
    openAudit,
    closeAudit,
    toggleAudit,
    scanPageForTouchTargets,
    applyTouchTargetFix,
    getTouchTargetStats,
    highlightTouchTargets,
    config: {
      minTouchSize,
      autoScanOnOpen,
      showTestMode,
    },
  };
}
