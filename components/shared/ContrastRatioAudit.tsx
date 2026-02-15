/**
 * Contrast Ratio Audit Component
 * Provides visual feedback on color contrast ratios and WCAG compliance
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton } from './StandardButton';
import {
  Eye,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Palette,
} from 'lucide-react';

export interface ContrastIssue {
  id: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  foreground: string;
  background: string;
  ratio: number;
  recommendation: string;
}

export interface ColorPair {
  foreground: string;
  background: string;
  foregroundName: string;
  backgroundName: string;
  description: string;
}

interface ContrastRatioAuditProps {
  className?: string;
  onIssuesFound?: (issues: ContrastIssue[]) => void;
  initialColorPairs?: ColorPair[];
  /** When false, audit panel starts collapsed (e.g. in dev tools bar) */
  defaultOpen?: boolean;
}

/**
 * Convert CSS variable to computed color
 */
const getComputedColor = (cssVariable: string): string => {
  if (typeof window === 'undefined') return '#ffffff';

  // Remove var() wrapper if present
  const varName = cssVariable.replace(/var\(|\)/g, '').trim();

  // Get computed value
  const computed = getComputedStyle(document.documentElement).getPropertyValue(varName);

  if (computed) {
    return computed.trim();
  }

  // Fallback to direct value if not a CSS variable
  return cssVariable;
};

/**
 * Convert any color format to hex
 */
const toHex = (color: string): string => {
  if (!color) return '#000000';

  // If already hex
  if (color.startsWith('#')) {
    return color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  }

  // If rgb/rgba
  if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
  }

  return '#000000';
};

/**
 * Calculate relative luminance (WCAG formula)
 */
const getLuminance = (hex: string): number => {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;

  const sRGB = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
};

/**
 * Calculate contrast ratio (WCAG formula)
 */
const getContrastRatio = (foreground: string, background: string): number => {
  const L1 = getLuminance(foreground);
  const L2 = getLuminance(background);

  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Check if contrast meets WCAG standards
 */
const meetsContrastStandard = (
  ratio: number,
  size: 'normal' | 'large' = 'normal'
): {
  passesAA: boolean;
  passesAAA: boolean;
  level: 'fail' | 'AA' | 'AAA';
} => {
  const aaThreshold = size === 'large' ? 3 : 4.5;
  const aaaThreshold = size === 'large' ? 4.5 : 7;

  const passesAA = ratio >= aaThreshold;
  const passesAAA = ratio >= aaaThreshold;

  let level: 'fail' | 'AA' | 'AAA' = 'fail';
  if (passesAAA) level = 'AAA';
  else if (passesAA) level = 'AA';

  return { passesAA, passesAAA, level };
};

export const ContrastRatioAudit: React.FC<ContrastRatioAuditProps> = ({
  className = '',
  onIssuesFound,
  initialColorPairs = [],
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [issues, setIssues] = useState<ContrastIssue[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'visual' | 'recommendations'>('audit');
  const [isAuditing, setIsAuditing] = useState(false);
  const [colorPairs, setColorPairs] = useState<ColorPair[]>(initialColorPairs);

  const defaultColorPairs: ColorPair[] = [
    {
      foreground: 'var(--color-text-primary)',
      background: 'var(--color-bg-primary)',
      foregroundName: 'Text Primary',
      backgroundName: 'Background Primary',
      description: 'Primary text on main background',
    },
    {
      foreground: 'var(--color-text-secondary)',
      background: 'var(--color-bg-primary)',
      foregroundName: 'Text Secondary',
      backgroundName: 'Background Primary',
      description: 'Secondary text on main background',
    },
    {
      foreground: 'var(--color-accent)',
      background: 'var(--color-bg-primary)',
      foregroundName: 'Accent',
      backgroundName: 'Background Primary',
      description: 'Accent color on main background',
    },
    {
      foreground: 'var(--color-text-primary)',
      background: 'var(--color-bg-secondary)',
      foregroundName: 'Text Primary',
      backgroundName: 'Background Secondary',
      description: 'Primary text on secondary background',
    },
    {
      foreground: 'var(--color-text-inverse)',
      background: 'var(--color-accent)',
      foregroundName: 'Text Inverse',
      backgroundName: 'Accent',
      description: 'Inverse text on accent background',
    },
  ];

  // Initialize color pairs if none provided
  useEffect(() => {
    if (initialColorPairs.length === 0) {
      setColorPairs(defaultColorPairs);
    }
  }, [initialColorPairs]);

  const runAudit = () => {
    setIsAuditing(true);
    const newIssues: ContrastIssue[] = [];

    colorPairs.forEach((pair, index) => {
      try {
        const foreground = getComputedColor(pair.foreground);
        const background = getComputedColor(pair.background);
        const foregroundHex = toHex(foreground);
        const backgroundHex = toHex(background);
        const ratio = getContrastRatio(foregroundHex, backgroundHex);

        const { passesAA, level } = meetsContrastStandard(ratio);

        if (!passesAA) {
          let severity: 'low' | 'medium' | 'high' = 'medium';
          if (ratio < 3) severity = 'high';
          else if (ratio < 4) severity = 'medium';
          else severity = 'low';

          const recommendation =
            ratio < 3
              ? 'Consider using a significantly darker or lighter color'
              : ratio < 4
                ? 'Adjust color brightness to improve contrast'
                : 'Slight adjustment needed for AA compliance';

          newIssues.push({
            id: `issue-${index}`,
            severity,
            description: `${pair.foregroundName} on ${pair.backgroundName}`,
            foreground: foregroundHex,
            background: backgroundHex,
            ratio,
            recommendation,
          });
        }
      } catch (error) {
        console.error('Error auditing color pair:', pair, error);
      }
    });

    // Sort by severity (high to low)
    newIssues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    setIssues(newIssues);
    setIsAuditing(false);

    if (onIssuesFound) {
      onIssuesFound(newIssues);
    }
  };

  useEffect(() => {
    if (isOpen && issues.length === 0) {
      runAudit();
    }
  }, [isOpen]);

  const severityColor = (severity: ContrastIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'text-[var(--color-data-fail)]';
      case 'medium':
        return 'text-[var(--color-data-provisional)]';
      case 'low':
        return 'text-[var(--color-data-pass)]';
      default:
        return 'text-[var(--color-text-muted)]';
    }
  };

  const severityIcon = (severity: ContrastIssue['severity']) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <Info className="w-4 h-4" />;
      case 'low':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const ratioColor = (ratio: number) => {
    const { level } = meetsContrastStandard(ratio);
    switch (level) {
      case 'fail':
        return 'text-[var(--color-data-fail)]';
      case 'AA':
        return 'text-[var(--color-data-provisional)]';
      case 'AAA':
        return 'text-[var(--color-data-pass)]';
      default:
        return 'text-[var(--color-text-muted)]';
    }
  };

  const ratioLabel = (ratio: number) => {
    const { level } = meetsContrastStandard(ratio);
    return level;
  };

  return (
    <>
      {/* Trigger Button */}
      <StandardButton
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        icon={<Palette className="w-4 h-4" />}
        className={className}
      >
        Contrast Audit
      </StandardButton>

      {/* Audit Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                    <Palette className="w-6 h-6 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                      Contrast Ratio Audit
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Check color contrast for accessibility compliance
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-[var(--color-border)] px-6">
                <div className="flex gap-1" role="tablist">
                  {[
                    {
                      id: 'audit',
                      label: 'Audit Results',
                      icon: <AlertTriangle className="w-4 h-4" />,
                    },
                    { id: 'visual', label: 'Visual Preview', icon: <Eye className="w-4 h-4" /> },
                    {
                      id: 'recommendations',
                      label: 'Recommendations',
                      icon: <Info className="w-4 h-4" />,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                        activeTab === tab.id
                          ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                      }`}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      aria-controls={`tabpanel-${tab.id}`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* Audit Results Tab Panel */}
                <div
                  role="tabpanel"
                  id="tabpanel-audit"
                  aria-labelledby="tab-audit"
                  tabIndex={0}
                  hidden={activeTab !== 'audit'}
                  className={activeTab === 'audit' ? 'block' : 'hidden'}
                >
                  {activeTab === 'audit' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-[var(--color-text-primary)]">
                          Accessibility Issues
                        </h3>

                        <StandardButton
                          variant="outline"
                          size="sm"
                          onClick={runAudit}
                          loading={isAuditing}
                          icon={<RefreshCw className="w-4 h-4" />}
                        >
                          Re-run Audit
                        </StandardButton>
                      </div>

                      {issues.length === 0 ? (
                        <div className="text-center py-12">
                          <CheckCircle className="w-12 h-12 text-[var(--color-data-pass)] mx-auto mb-4" />
                          <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                            All colors pass WCAG AA contrast requirements!
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            Great job maintaining accessible color contrast ratios.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {issues.map((issue) => (
                            <motion.div
                              key={issue.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`p-4 rounded-lg border ${
                                issue.severity === 'high'
                                  ? 'border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/5'
                                  : issue.severity === 'medium'
                                    ? 'border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/5'
                                    : 'border-[var(--color-data-pass)]/30 bg-[var(--color-data-pass)]/5'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`p-2 rounded-lg ${severityColor(issue.severity)}/10`}
                                  >
                                    {severityIcon(issue.severity)}
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-[var(--color-text-primary)] mb-1">
                                      {issue.description}
                                    </h4>
                                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                                      {issue.recommendation}
                                    </p>
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-4 h-4 rounded border border-[var(--color-border)]"
                                          style={{ backgroundColor: issue.foreground }}
                                        />
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                          Foreground
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-4 h-4 rounded border border-[var(--color-border)]"
                                          style={{ backgroundColor: issue.background }}
                                        />
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                          Background
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className={`text-right ${ratioColor(issue.ratio)}`}>
                                  <div className="text-2xl font-bold">
                                    {issue.ratio.toFixed(1)}:1
                                  </div>
                                  <div className="text-xs font-medium uppercase">
                                    {ratioLabel(issue.ratio)}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Visual Preview Tab Panel */}
                <div
                  role="tabpanel"
                  id="tabpanel-visual"
                  aria-labelledby="tab-visual"
                  tabIndex={0}
                  hidden={activeTab !== 'visual'}
                  className={activeTab === 'visual' ? 'block' : 'hidden'}
                >
                  {activeTab === 'visual' && (
                    <div className="space-y-6">
                      <h3 className="font-medium text-[var(--color-text-primary)]">
                        Color Pair Visualizations
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {colorPairs.slice(0, 5).map((pair, index) => {
                          const foreground = getComputedColor(pair.foreground);
                          const background = getComputedColor(pair.background);
                          const foregroundHex = toHex(foreground);
                          const backgroundHex = toHex(background);
                          const ratio = getContrastRatio(foregroundHex, backgroundHex);

                          return (
                            <div
                              key={`visual-${index}`}
                              className="rounded-lg overflow-hidden border border-[var(--color-border)]"
                            >
                              <div className="p-4" style={{ backgroundColor: backgroundHex }}>
                                <p className="text-sm font-medium" style={{ color: foregroundHex }}>
                                  {pair.description}
                                </p>
                                <p className="text-xs mt-1" style={{ color: foregroundHex }}>
                                  Contrast: {ratio.toFixed(1)}:1
                                </p>
                              </div>
                              <div className="px-3 py-2 bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-muted)]">
                                {pair.foregroundName} on {pair.backgroundName}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-xs text-[var(--color-text-muted)] mt-4">
                        <p className="font-medium mb-1">WCAG Standards:</p>
                        <ul className="space-y-1">
                          <li className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[var(--color-data-fail)]" />
                            <span>Fail: {'<'} 4.5:1</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[var(--color-data-provisional)]" />
                            <span>AA: ≥ 4.5:1 (normal text)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[var(--color-data-pass)]" />
                            <span>AAA: ≥ 7:1 (normal text)</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommendations Tab Panel */}
                <div
                  role="tabpanel"
                  id="tabpanel-recommendations"
                  aria-labelledby="tab-recommendations"
                  tabIndex={0}
                  hidden={activeTab !== 'recommendations'}
                  className={activeTab === 'recommendations' ? 'block' : 'hidden'}
                >
                  {activeTab === 'recommendations' && (
                    <div className="space-y-4">
                      <h3 className="font-medium text-[var(--color-text-primary)]">
                        Accessibility Recommendations
                      </h3>

                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                          <h4 className="font-medium text-sm text-[var(--color-text-primary)] mb-1">
                            General Guidelines
                          </h4>
                          <ul className="text-xs text-[var(--color-text-secondary)] space-y-1 list-disc list-inside">
                            <li>Maintain at least 4.5:1 contrast for normal text</li>
                            <li>Aim for 7:1 contrast for AAA compliance</li>
                            <li>Use semantic color tokens consistently</li>
                            <li>Test with actual users when possible</li>
                          </ul>
                        </div>

                        <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                          <h4 className="font-medium text-sm text-[var(--color-text-primary)] mb-1">
                            Quick Fixes
                          </h4>
                          <ul className="text-xs text-[var(--color-text-secondary)] space-y-1 list-disc list-inside">
                            <li>Increase font weight for low-contrast text</li>
                            <li>Add subtle background shading behind text</li>
                            <li>Use borders or outlines to improve separation</li>
                            <li>Consider alternative color combinations</li>
                          </ul>
                        </div>

                        <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                          <h4 className="font-medium text-sm text-[var(--color-text-primary)] mb-1">
                            Testing Tools
                          </h4>
                          <ul className="text-xs text-[var(--color-text-secondary)] space-y-1 list-disc list-inside">
                            <li>Browser DevTools Color Picker</li>
                            <li>WebAIM Contrast Checker</li>
                            <li>Color Contrast Analyzer extensions</li>
                            <li>Automated accessibility testing tools</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {issues.length > 0 ? (
                      <span>
                        Found {issues.length} contrast issue{issues.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span>All colors meet WCAG AA standards</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <StandardButton variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                      Close
                    </StandardButton>

                    {issues.length > 0 && (
                      <StandardButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          // Export issues as JSON
                          const dataStr = JSON.stringify(issues, null, 2);
                          const dataUri =
                            'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                          const exportFileDefaultName = 'contrast-issues.json';
                          const linkElement = document.createElement('a');
                          linkElement.setAttribute('href', dataUri);
                          linkElement.setAttribute('download', exportFileDefaultName);
                          linkElement.click();
                        }}
                      >
                        Export Issues
                      </StandardButton>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
