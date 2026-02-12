import { useState, useCallback, useEffect } from 'react';

export interface TypographyAuditConfig {
  mobileBreakpoint?: number;
  minFontSize?: number;
  optimalLineHeight?: number;
  minLineHeight?: number;
  maxLineHeight?: number;
}

export interface TypographyIssue {
  selector: string;
  type: 'font-size' | 'line-height' | 'hierarchy';
  currentValue: string;
  recommendedValue: string;
  severity: 'low' | 'medium' | 'high';
}

export function useTypographyAudit(config: TypographyAuditConfig = {}) {
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  const {
    mobileBreakpoint = 768,
    minFontSize = 16,
    optimalLineHeight = 1.5,
    minLineHeight = 1.4,
    maxLineHeight = 1.8
  } = config;

  const isMobileViewport = viewportWidth < mobileBreakpoint;

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
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
    setIsAuditOpen(prev => !prev);
  }, []);

  const scanPageForTypographyIssues = useCallback((): TypographyIssue[] => {
    if (typeof window === 'undefined') return [];

    const issues: TypographyIssue[] = [];
    const textSelectors = [
      'p',
      'span',
      'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a',
      'button',
      'label',
      'li'
    ];

    const elements = document.querySelectorAll(textSelectors.join(', '));

    elements.forEach((element) => {
      if (!(element instanceof HTMLElement)) return;

      // Skip hidden elements
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.offsetParent === null) {
        return;
      }

      // Skip elements with no visible text
      if (!element.textContent?.trim()) return;

      const fontSize = parseFloat(style.fontSize);
      const lineHeight = parseFloat(style.lineHeight);
      const fontSizePx = parseFloat(style.fontSize);

      // Check font size for mobile
      if (isMobileViewport && fontSizePx < minFontSize) {
        const severity: TypographyIssue['severity'] = 
          fontSizePx < 12 ? 'high' : 
          fontSizePx < 14 ? 'medium' : 'low';

        issues.push({
          selector: getElementSelector(element),
          type: 'font-size',
          currentValue: `${fontSizePx}px`,
          recommendedValue: `${Math.max(minFontSize, fontSizePx)}px`,
          severity
        });
      }

      // Check line height
      if (lineHeight > 0) {
        const lineHeightRatio = lineHeight / fontSize;
        if (lineHeightRatio < minLineHeight || lineHeightRatio > maxLineHeight) {
          const severity: TypographyIssue['severity'] = 
            lineHeightRatio < 1.2 || lineHeightRatio > 2 ? 'high' : 'medium';

          issues.push({
            selector: getElementSelector(element),
            type: 'line-height',
            currentValue: lineHeightRatio.toFixed(2),
            recommendedValue: optimalLineHeight.toFixed(2),
            severity
          });
        }
      }

      // Check heading hierarchy
      if (element.tagName.match(/^H[1-6]$/i)) {
        const headingLevel = parseInt(element.tagName[1]);
        const expectedSize = [2.5, 2, 1.75, 1.5, 1.25, 1.125][headingLevel - 1];
        const currentSizeRem = fontSizePx / 16;
        
        if (Math.abs(currentSizeRem - expectedSize) > 0.5) {
          issues.push({
            selector: getElementSelector(element),
            type: 'hierarchy',
            currentValue: `${currentSizeRem.toFixed(2)}rem`,
            recommendedValue: `${expectedSize}rem`,
            severity: Math.abs(currentSizeRem - expectedSize) > 1 ? 'high' : 'medium'
          });
        }
      }
    });

    return issues;
  }, [isMobileViewport, minFontSize, minLineHeight, maxLineHeight, optimalLineHeight]);

  const getElementSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;
    
    let selector = element.tagName.toLowerCase();
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  };

  const applyTypographyFix = useCallback((selector: string, type: TypographyIssue['type'], recommendedValue: string) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) return false;

    switch (type) {
      case 'font-size':
        element.style.fontSize = recommendedValue;
        break;
      case 'line-height':
        element.style.lineHeight = recommendedValue;
        break;
      case 'hierarchy':
        element.style.fontSize = recommendedValue;
        break;
    }

    return true;
  }, []);

  const getTypographyStats = useCallback(() => {
    const issues = scanPageForTypographyIssues();
    const total = issues.length;
    const byType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byType,
      bySeverity,
      issues,
      viewport: {
        width: viewportWidth,
        isMobile: isMobileViewport
      }
    };
  }, [scanPageForTypographyIssues, viewportWidth, isMobileViewport]);

  const highlightTypographyIssues = useCallback((highlight: boolean) => {
    if (typeof window === 'undefined') return;

    // Remove existing highlights
    document.querySelectorAll('.typography-highlight').forEach(el => {
      el.classList.remove('typography-highlight');
    });

    if (highlight) {
      // Add highlight style if not already present
      if (!document.getElementById('typography-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'typography-highlight-style';
        style.textContent = `
          .typography-highlight {
            outline: 3px solid #8b5cf6 !important;
            outline-offset: 2px !important;
            background-color: rgba(139, 92, 246, 0.1) !important;
            position: relative !important;
            z-index: 9999 !important;
          }
          .typography-highlight::after {
            content: attr(data-typography-issue);
            position: absolute;
            top: -24px;
            left: 0;
            background: #8b5cf6;
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

      // Highlight elements with issues
      const issues = scanPageForTypographyIssues();
      issues.forEach(issue => {
        const element = document.querySelector(issue.selector);
        if (element instanceof HTMLElement) {
          element.classList.add('typography-highlight');
          element.setAttribute('data-typography-issue', `${issue.type}: ${issue.currentValue} → ${issue.recommendedValue}`);
        }
      });
    }
  }, [scanPageForTypographyIssues]);

  const getReadabilityScore = useCallback(() => {
    const issues = scanPageForTypographyIssues();
    if (issues.length === 0) return 100;

    // Calculate score based on severity
    const severityWeights = { high: 0.5, medium: 0.7, low: 0.9 };
    const totalWeight = issues.reduce((sum, issue) => sum + severityWeights[issue.severity], 0);
    const averageWeight = totalWeight / issues.length;

    return Math.round(averageWeight * 100);
  }, [scanPageForTypographyIssues]);

  return {
    isAuditOpen,
    openAudit,
    closeAudit,
    toggleAudit,
    scanPageForTypographyIssues,
    applyTypographyFix,
    getTypographyStats,
    highlightTypographyIssues,
    getReadabilityScore,
    config: {
      mobileBreakpoint,
      minFontSize,
      optimalLineHeight,
      minLineHeight,
      maxLineHeight
    },
    viewport: {
      width: viewportWidth,
      isMobile: isMobileViewport
    }
  };
}