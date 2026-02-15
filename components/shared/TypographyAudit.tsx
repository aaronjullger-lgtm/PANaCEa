import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton } from './StandardButton';

export interface TypographyIssue {
  id: string;
  element: HTMLElement;
  type: 'font-size' | 'line-height' | 'letter-spacing' | 'contrast' | 'hierarchy';
  currentValue: string | number;
  recommendedValue: string | number;
  severity: 'low' | 'medium' | 'high';
  description: string;
  selector: string;
  computedStyle: {
    fontSize: string;
    lineHeight: string;
    fontWeight: string;
    fontFamily: string;
    color: string;
    backgroundColor: string;
  };
  mobileReadabilityScore: number; // 0-100
}

interface TypographyAuditProps {
  isOpen?: boolean;
  onClose?: () => void;
  mobileBreakpoint?: number; // Default: 768px
}

export const TypographyAudit: React.FC<TypographyAuditProps> = ({
  isOpen = false,
  onClose,
  mobileBreakpoint = 768,
}) => {
  const [issues, setIssues] = useState<TypographyIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'guidelines' | 'test'>('issues');
  const [highlightIssues, setHighlightIssues] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Mobile typography standards
  const mobileStandards = {
    minFontSize: 16, // pixels
    optimalLineHeight: 1.5, // unitless
    minLineHeight: 1.4,
    maxLineHeight: 1.8,
    optimalLetterSpacing: '0.01em',
    minContrastRatio: 4.5, // WCAG AA for normal text
    headingHierarchy: [2.5, 2, 1.75, 1.5, 1.25, 1.125], // rem sizes for h1-h6
  };

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileViewport = viewportWidth < mobileBreakpoint;

  const scanForTypographyIssues = () => {
    setIsScanning(true);
    const newIssues: TypographyIssue[] = [];

    // Select text elements
    const textSelectors = [
      'p',
      'span',
      'div',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'a',
      'button',
      'label',
      'li',
      'td',
      'th',
    ];

    const elements = document.querySelectorAll(textSelectors.join(', '));

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

      // Skip elements with no visible text
      if (!element.textContent?.trim()) return;

      const computedStyle = {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
        color: style.color,
        backgroundColor: style.backgroundColor,
      };

      // Parse values
      const fontSize = parseFloat(computedStyle.fontSize);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      const fontSizePx = parseFloat(computedStyle.fontSize);

      // Check font size (mobile)
      if (isMobileViewport && fontSizePx < mobileStandards.minFontSize) {
        const issue: TypographyIssue = {
          id: `font-size-${index}`,
          element,
          type: 'font-size',
          currentValue: `${fontSizePx}px`,
          recommendedValue: `${Math.max(mobileStandards.minFontSize, fontSizePx)}px`,
          severity: fontSizePx < 12 ? 'high' : fontSizePx < 14 ? 'medium' : 'low',
          description: `Font size too small for mobile readability (${fontSizePx}px < ${mobileStandards.minFontSize}px minimum)`,
          selector: getElementSelector(element),
          computedStyle,
          mobileReadabilityScore: Math.max(
            0,
            Math.min(100, (fontSizePx / mobileStandards.minFontSize) * 100)
          ),
        };
        newIssues.push(issue);
      }

      // Check line height
      if (lineHeight > 0) {
        const lineHeightRatio = lineHeight / fontSize;
        if (
          lineHeightRatio < mobileStandards.minLineHeight ||
          lineHeightRatio > mobileStandards.maxLineHeight
        ) {
          const issue: TypographyIssue = {
            id: `line-height-${index}`,
            element,
            type: 'line-height',
            currentValue: lineHeightRatio.toFixed(2),
            recommendedValue: mobileStandards.optimalLineHeight.toFixed(2),
            severity: lineHeightRatio < 1.2 || lineHeightRatio > 2 ? 'high' : 'medium',
            description: `Line height ${lineHeightRatio.toFixed(2)} is outside optimal range (${mobileStandards.minLineHeight}-${mobileStandards.maxLineHeight}) for mobile`,
            selector: getElementSelector(element),
            computedStyle,
            mobileReadabilityScore:
              lineHeightRatio >= mobileStandards.minLineHeight &&
              lineHeightRatio <= mobileStandards.maxLineHeight
                ? 100
                : 50,
          };
          newIssues.push(issue);
        }
      }

      // Check heading hierarchy
      if (element.tagName.match(/^H[1-6]$/i)) {
        const headingLevel = parseInt(element.tagName[1]);
        const expectedSize = mobileStandards.headingHierarchy[headingLevel - 1];
        const currentSizeRem = fontSizePx / 16; // Convert px to rem (assuming 16px base)

        if (Math.abs(currentSizeRem - expectedSize) > 0.5) {
          const issue: TypographyIssue = {
            id: `hierarchy-${index}`,
            element,
            type: 'hierarchy',
            currentValue: `${currentSizeRem.toFixed(2)}rem`,
            recommendedValue: `${expectedSize}rem`,
            severity: Math.abs(currentSizeRem - expectedSize) > 1 ? 'high' : 'medium',
            description: `Heading h${headingLevel} size doesn't follow mobile-optimized hierarchy`,
            selector: getElementSelector(element),
            computedStyle,
            mobileReadabilityScore: 70,
          };
          newIssues.push(issue);
        }
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

  const highlightElement = (issue: TypographyIssue) => {
    // Remove previous highlights
    document.querySelectorAll('.typography-highlight').forEach((el) => {
      el.classList.remove('typography-highlight');
    });

    // Add highlight to current element
    issue.element.classList.add('typography-highlight');

    // Scroll to element
    issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const applyFix = (issue: TypographyIssue) => {
    const element = issue.element;

    switch (issue.type) {
      case 'font-size':
        element.style.fontSize = issue.recommendedValue as string;
        break;
      case 'line-height':
        element.style.lineHeight = issue.recommendedValue as string;
        break;
      case 'hierarchy':
        element.style.fontSize = issue.recommendedValue as string;
        break;
    }

    // Update issue list
    setIssues((prev) => prev.filter((i) => i.id !== issue.id));
  };

  const applyAllFixes = () => {
    issues.forEach(applyFix);
  };

  const resetHighlights = () => {
    document.querySelectorAll('.typography-highlight').forEach((el) => {
      el.classList.remove('typography-highlight');
    });
  };

  const getReadabilityScore = () => {
    if (issues.length === 0) return 100;

    const totalScore = issues.reduce((sum, issue) => sum + issue.mobileReadabilityScore, 0);
    return Math.round(totalScore / issues.length);
  };

  useEffect(() => {
    if (isOpen) {
      scanForTypographyIssues();
    }
  }, [isOpen, viewportWidth]);

  useEffect(() => {
    return () => {
      resetHighlights();
    };
  }, []);

  const severityColor = (severity: TypographyIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'text-[var(--color-data-fail)]';
      case 'medium':
        return 'text-[var(--color-data-provisional)]';
      case 'low':
        return 'text-[var(--color-data-pass)]';
    }
  };

  const severityBg = (severity: TypographyIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-[var(--color-data-fail)]/10';
      case 'medium':
        return 'bg-[var(--color-data-provisional)]/10';
      case 'low':
        return 'bg-[var(--color-data-pass)]/10';
    }
  };

  const typeIcon = (type: TypographyIssue['type']) => {
    switch (type) {
      case 'font-size':
        return 'A';
      case 'line-height':
        return '↕';
      case 'letter-spacing':
        return '↔';
      case 'contrast':
        return '◐';
      case 'hierarchy':
        return 'H';
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
                    Mobile Typography Audit
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Viewport: {viewportWidth}px • {isMobileViewport ? 'Mobile' : 'Desktop'} •
                    Readability Score: {getReadabilityScore()}%
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StandardButton variant="ghost" size="sm" onClick={onClose}>
                    Close
                  </StandardButton>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex border border-[var(--color-border)] rounded-lg overflow-hidden">
                  {(['issues', 'guidelines', 'test'] as const).map((tab) => (
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
                  onClick={scanForTypographyIssues}
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
                        Typography Issues
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Found {issues.length} elements with suboptimal typography for{' '}
                        {isMobileViewport ? 'mobile' : 'desktop'}
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
                      <div className="text-4xl mb-4">📱</div>
                      <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                        No Typography Issues Found
                      </h4>
                      <p className="text-[var(--color-text-muted)]">
                        All text elements meet mobile readability standards.
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
                                  className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium ${severityBg(issue.severity)} ${severityColor(issue.severity)}`}
                                >
                                  {typeIcon(issue.type)}
                                </span>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${severityBg(issue.severity)} ${severityColor(issue.severity)}`}
                                >
                                  {issue.severity.toUpperCase()}
                                </span>
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {issue.type.replace('-', ' ').toUpperCase()}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  Score: {issue.mobileReadabilityScore}%
                                </span>
                              </div>

                              <p className="text-sm text-[var(--color-text-primary)] mb-3">
                                {issue.description}
                              </p>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Current</p>
                                  <p className="font-medium">{issue.currentValue}</p>
                                </div>
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Recommended</p>
                                  <p className="font-medium text-[var(--color-data-pass)]">
                                    {issue.recommendedValue}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Selector</p>
                                  <code className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
                                    {issue.selector}
                                  </code>
                                </div>
                                <div>
                                  <p className="text-[var(--color-text-muted)]">Font</p>
                                  <p
                                    className="font-medium truncate"
                                    title={issue.computedStyle.fontFamily}
                                  >
                                    {issue.computedStyle.fontFamily.split(',')[0]}
                                  </p>
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

              {activeTab === 'guidelines' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Mobile Typography Guidelines
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                          Font Sizes
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                Body Text
                              </span>
                              <span className="text-sm font-medium">16px minimum</span>
                            </div>
                            <div className="space-y-2">
                              <div className="text-4xl font-bold text-[var(--color-text-primary)]">
                                Aa
                              </div>
                              <div className="text-sm text-[var(--color-text-muted)]">
                                Ensures comfortable reading on mobile screens
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[var(--color-border)]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                Heading Hierarchy
                              </span>
                            </div>
                            <div className="space-y-2">
                              {mobileStandards.headingHierarchy.map((size, index) => (
                                <div key={index} className="flex items-center justify-between">
                                  <span
                                    className={`font-bold text-[var(--color-text-primary)]`}
                                    style={{ fontSize: `${size}rem` }}
                                  >
                                    H{index + 1}
                                  </span>
                                  <span className="text-xs text-[var(--color-text-muted)]">
                                    {size}rem
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                          Line Height & Spacing
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                Optimal Line Height
                              </span>
                              <span className="text-sm font-medium">1.5× font size</span>
                            </div>
                            <div className="space-y-2">
                              <div className="relative">
                                <div className="h-12 bg-gradient-to-r from-[var(--color-bg-tertiary)] to-transparent rounded"></div>
                                <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-between">
                                  {[0, 1, 2, 3].map((i) => (
                                    <div
                                      key={i}
                                      className="h-3 border-b border-[var(--color-border)]"
                                    ></div>
                                  ))}
                                </div>
                              </div>
                              <div className="text-sm text-[var(--color-text-muted)]">
                                Provides comfortable reading rhythm
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[var(--color-border)]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                Paragraph Spacing
                              </span>
                              <span className="text-sm font-medium">1.5× line height</span>
                            </div>
                            <div className="space-y-4">
                              <div className="space-y-3">
                                <div className="h-4 bg-[var(--color-bg-tertiary)] rounded"></div>
                                <div className="h-8 bg-[var(--color-border)] rounded"></div>
                                <div className="h-4 bg-[var(--color-bg-tertiary)] rounded"></div>
                              </div>
                              <div className="text-sm text-[var(--color-text-muted)]">
                                Clear separation between paragraphs
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                          Contrast & Weight
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                Minimum Contrast
                              </span>
                              <span className="text-sm font-medium">4.5:1 (WCAG AA)</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-4">
                                <div className="flex-1 h-10 bg-[var(--color-text-primary)] rounded flex items-center justify-center">
                                  <span className="text-white text-sm">Text</span>
                                </div>
                                <div className="flex-1 h-10 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded flex items-center justify-center">
                                  <span className="text-[var(--color-text-primary)] text-sm">
                                    Background
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-[var(--color-text-muted)]">
                                Ensures readability in various lighting conditions
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[var(--color-border)]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                Font Weights
                              </span>
                            </div>
                            <div className="space-y-2">
                              {[400, 500, 600, 700].map((weight) => (
                                <div key={weight} className="flex items-center justify-between">
                                  <span
                                    className="text-[var(--color-text-primary)]"
                                    style={{ fontWeight: weight }}
                                  >
                                    Weight {weight}
                                  </span>
                                  <span className="text-xs text-[var(--color-text-muted)]">
                                    {weight === 400
                                      ? 'Body'
                                      : weight === 500
                                        ? 'Medium'
                                        : weight === 600
                                          ? 'Semibold'
                                          : 'Bold'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                        <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                          Implementation Tips
                        </h4>
                        <ul className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Use relative units (rem, em) for font sizes
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Set base font size to 16px for mobile
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Use{' '}
                            <code className="bg-[var(--color-bg-tertiary)] px-1 rounded">
                              line-height: 1.5
                            </code>{' '}
                            for body text
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Maintain consistent vertical rhythm
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Test on actual mobile devices
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Use system fonts for better performance
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[var(--color-data-pass)]">✓</span>
                            Implement responsive typography with CSS clamp()
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[color-data-pass)]">✓</span>
                            Consider users with visual impairments
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
                      Typography Readability Test
                    </h3>

                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                            Test Samples
                          </h4>
                          <div className="space-y-4">
                            <div
                              className={`p-4 rounded-lg border ${isMobileViewport ? 'border-[var(--color-data-pass)]' : 'border-[var(--color-border)]'}`}
                            >
                              <p className="text-sm font-medium mb-2">Mobile Optimized (16px)</p>
                              <p className="text-base leading-relaxed">
                                This text uses 16px font size with 1.5 line height, which is optimal
                                for mobile reading comfort and accessibility.
                              </p>
                            </div>

                            <div className="p-4 rounded-lg border border-[var(--color-border)]">
                              <p className="text-sm font-medium mb-2">Too Small (12px)</p>
                              <p className="text-xs leading-relaxed">
                                This text uses 12px font size which may be difficult to read on
                                mobile devices, especially for users with visual impairments.
                              </p>
                            </div>

                            <div className="p-4 rounded-lg border border-[var(--color-border)]">
                              <p className="text-sm font-medium mb-2">Poor Line Height (1.2)</p>
                              <p className="text-base leading-tight">
                                This text has tight line spacing which can make reading difficult on
                                mobile screens as lines blend together reducing readability.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                            Readability Checklist
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-[var(--color-data-pass)] flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-sm">Font size ≥ 16px for body text</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-[var(--color-data-pass)] flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-sm">Line height between 1.4-1.8</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-[var(--color-data-pass)] flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-sm">Sufficient contrast (4.5:1 minimum)</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-[var(--color-data-pass)] flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-sm">Clear heading hierarchy</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-[var(--color-data-pass)] flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-sm">Adequate paragraph spacing</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-[var(--color-data-pass)] flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-sm">Responsive typography scaling</span>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                            <h5 className="font-medium text-[var(--color-text-primary)] mb-2">
                              Testing Instructions
                            </h5>
                            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                              <li>• View on actual mobile device</li>
                              <li>• Test in different lighting conditions</li>
                              <li>• Check readability with increased font size (accessibility)</li>
                              <li>• Verify no horizontal scrolling needed</li>
                              <li>• Test with screen reader compatibility</li>
                            </ul>
                          </div>
                        </div>
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
                      typography issues • Readability: {getReadabilityScore()}%
                    </span>
                  ) : (
                    <span>All typography meets mobile readability standards • Score: 100%</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StandardButton variant="outline" size="sm" onClick={resetHighlights}>
                    Clear Highlights
                  </StandardButton>
                  <StandardButton variant="primary" size="sm" onClick={scanForTypographyIssues}>
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
