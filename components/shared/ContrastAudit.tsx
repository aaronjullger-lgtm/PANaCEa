/**
 * ContrastAudit - Component for auditing and improving color contrast ratios
 * 
 * This component helps identify and fix contrast ratio issues across the application.
 * It checks WCAG compliance (AA/AAA) for all key color combinations.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  CheckCircle, 
  AlertCircle, 
  Contrast,
  Palette,
  RefreshCw,
  X
} from 'lucide-react';
import { StandardButton } from './StandardButton';
import { getContrastRatio, meetsContrastStandard } from '@/lib/utils/accessibility';

export interface ContrastIssue {
  id: string;
  foreground: string;
  background: string;
  foregroundName: string;
  backgroundName: string;
  ratio: number;
  requiredRatio: number;
  meetsStandard: boolean;
  standard: 'AA' | 'AAA';
  size: 'normal' | 'large';
  usage: string;
}

interface ColorPair {
  foreground: string;
  background: string;
  foregroundName: string;
  backgroundName: string;
  usage: string;
  size?: 'normal' | 'large';
  standard?: 'AA' | 'AAA';
}

interface ContrastAuditProps {
  /** Whether to show the audit panel by default */
  defaultOpen?: boolean;
  /** Callback when issues are found */
  onIssuesFound?: (issues: ContrastIssue[]) => void;
}

export const ContrastAudit: React.FC<ContrastAuditProps> = ({
  defaultOpen = false,
  onIssuesFound
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [issues, setIssues] = useState<ContrastIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);

  // Define key color combinations to check
  const colorPairs: ColorPair[] = [
    // Light mode primary combinations
    {
      foreground: '#0f172a', // --color-text-primary
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'text-primary',
      backgroundName: 'bg-primary',
      usage: 'Primary text on canvas',
      standard: 'AAA',
      size: 'normal'
    },
    {
      foreground: '#475569', // --color-text-secondary
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'text-secondary',
      backgroundName: 'bg-primary',
      usage: 'Secondary text on canvas',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#64748b', // --color-text-muted
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'text-muted',
      backgroundName: 'bg-primary',
      usage: 'Muted text on canvas',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#9a8f72', // --color-accent
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'accent',
      backgroundName: 'bg-primary',
      usage: 'Accent text on canvas',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#7B6C4F', // --color-accent-button
      background: '#ffffff', // white background for buttons
      foregroundName: 'accent-button',
      backgroundName: 'white',
      usage: 'Button text on white',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#f8fafc', // --color-text-inverse
      background: '#7B6C4F', // --color-accent-button
      foregroundName: 'text-inverse',
      backgroundName: 'accent-button',
      usage: 'Inverse text on accent button',
      standard: 'AA',
      size: 'normal'
    },
    // Dark mode primary combinations
    {
      foreground: '#f1f5f9', // --color-text-primary (dark)
      background: '#0f172a', // --color-bg-primary (dark)
      foregroundName: 'text-primary (dark)',
      backgroundName: 'bg-primary (dark)',
      usage: 'Primary text on dark canvas',
      standard: 'AAA',
      size: 'normal'
    },
    {
      foreground: '#cbd5e1', // --color-text-secondary (dark)
      background: '#0f172a', // --color-bg-primary (dark)
      foregroundName: 'text-secondary (dark)',
      backgroundName: 'bg-primary (dark)',
      usage: 'Secondary text on dark canvas',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#94a3b8', // --color-text-muted (dark)
      background: '#0f172a', // --color-bg-primary (dark)
      foregroundName: 'text-muted (dark)',
      backgroundName: 'bg-primary (dark)',
      usage: 'Muted text on dark canvas',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#a89b7a', // --color-accent (dark)
      background: '#0f172a', // --color-bg-primary (dark)
      foregroundName: 'accent (dark)',
      backgroundName: 'bg-primary (dark)',
      usage: 'Accent text on dark canvas',
      standard: 'AA',
      size: 'normal'
    },
    // Semantic colors
    {
      foreground: '#0d9488', // --color-data-pass
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'data-pass',
      backgroundName: 'bg-primary',
      usage: 'Success text on canvas',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#b91c1c', // --color-data-fail
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'data-fail',
      backgroundName: 'bg-primary',
      usage: 'Error text on canvas',
      standard: 'AA',
      size: 'normal'
    },
    {
      foreground: '#b45309', // --color-data-provisional
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'data-provisional',
      backgroundName: 'bg-primary',
      usage: 'Warning text on canvas',
      standard: 'AA',
      size: 'normal'
    },
    // Large text variants (for headings, large buttons)
    {
      foreground: '#475569', // --color-text-secondary
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'text-secondary',
      backgroundName: 'bg-primary',
      usage: 'Large secondary text',
      standard: 'AA',
      size: 'large'
    },
    {
      foreground: '#64748b', // --color-text-muted
      background: '#F8FAFC', // --color-bg-primary
      foregroundName: 'text-muted',
      backgroundName: 'bg-primary',
      usage: 'Large muted text',
      standard: 'AA',
      size: 'large'
    },
  ];

  // Run contrast audit
  const runAudit = () => {
    setIsAuditing(true);
    const newIssues: ContrastIssue[] = [];

    colorPairs.forEach((pair, index) => {
      try {
        const ratio = getContrastRatio(pair.foreground, pair.background);
        const requiredRatio = pair.standard === 'AAA' 
          ? (pair.size === 'large' ? 4.5 : 7)
          : (pair.size === 'large' ? 3 : 4.5);
        
        const meetsStandard = meetsContrastStandard(
          ratio, 
          pair.standard || 'AA', 
          pair.size || 'normal'
        );

        if (!meetsStandard) {
          newIssues.push({
            id: `issue-${index}`,
            foreground: pair.foreground,
            background: pair.background,
            foregroundName: pair.foregroundName,
            backgroundName: pair.backgroundName,
            ratio: parseFloat(ratio.toFixed(2)),
            requiredRatio,
            meetsStandard: false,
            standard: pair.standard || 'AA',
            size: pair.size || 'normal',
            usage: pair.usage
          });
        }
      } catch (error) {
        console.error('Error calculating contrast ratio:', error);
      }
    });

    setTimeout(() => {
      setIssues(newIssues);
      setIsAuditing(false);
      if (onIssuesFound) {
        onIssuesFound(newIssues);
      }
    }, 500);
  };

  // Run audit on mount if open
  useEffect(() => {
    if (isOpen && issues.length === 0) {
      runAudit();
    }
  }, [isOpen]);

  const getRatioColor = (ratio: number, required: number) => {
    if (ratio >= required) return 'text-[var(--color-data-pass)]';
    if (ratio >= required * 0.8) return 'text-[var(--color-data-provisional)]';
    return 'text-[var(--color-data-fail)]';
  };

  const getRatioBg = (ratio: number, required: number) => {
    if (ratio >= required) return 'bg-[var(--color-data-pass)]/10';
    if (ratio >= required * 0.8) return 'bg-[var(--color-data-provisional)]/10';
    return 'bg-[var(--color-data-fail)]/10';
  };

  const getStatusIcon = (ratio: number, required: number) => {
    if (ratio >= required) {
      return <CheckCircle className="w-4 h-4 text-[var(--color-data-pass)]" />;
    }
    return <AlertCircle className="w-4 h-4 text-[var(--color-data-fail)]" />;
  };

  const getFixSuggestion = (issue: ContrastIssue): string => {
    if (issue.ratio < issue.requiredRatio) {
      if (issue.foregroundName.includes('muted')) {
        return 'Consider using a darker shade for muted text or increasing font size.';
      }
      if (issue.foregroundName.includes('accent')) {
        return 'Use the darker --color-accent-button variant for better contrast.';
      }
      if (issue.foregroundName.includes('secondary')) {
        return 'Consider using --color-text-primary for critical content.';
      }
      return `Increase contrast by darkening foreground or lightening background. Target ratio: ${issue.requiredRatio}:1`;
    }
    return 'Meets WCAG standards.';
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-40 right-4 z-50 p-3 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
        aria-label={isOpen ? 'Close contrast audit' : 'Open contrast audit'}
        title="Contrast Ratio Audit (Ctrl+Shift+C)"
      >
        <Contrast className="w-5 h-5 text-[var(--color-text-primary)]" />
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
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-48 right-4 z-50 w-96 max-h-[80vh] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Contrast ratio audit panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-3">
                <Contrast className="w-5 h-5 text-[var(--color-accent)]" />
                <h2 className="font-semibold text-[var(--color-text-primary)]">
                  Contrast Ratio Audit
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[var(--color-text-primary)]">
                    WCAG Compliance Check
                  </h3>
                  <StandardButton
                    variant="primary"
                    size="sm"
                    onClick={runAudit}
                    loading={isAuditing}
                  >
                    {isAuditing ? 'Checking...' : 'Run Audit'}
                  </StandardButton>
                </div>

                <div className="text-sm text-[var(--color-text-muted)]">
                  <p>Checks AA/AAA compliance for normal (4.5:1) and large text (3:1).</p>
                  <p className="mt-1">AAA requires 7:1 for normal text, 4.5:1 for large.</p>
                </div>

                {issues.length === 0 && !isAuditing ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-[var(--color-data-pass)] mx-auto mb-3" />
                    <p className="text-[var(--color-text-primary)] font-medium">
                      No contrast issues found
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      Run an audit to check WCAG compliance
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(showAllResults ? colorPairs : issues).map((pairOrIssue, index) => {
                      const isIssue = 'id' in pairOrIssue;
                      const issue = isIssue ? pairOrIssue : null;
                      const pair = isIssue ? null : pairOrIssue;
                      
                      let ratio = 0;
                      let requiredRatio = 4.5;
                      let meetsStandard = true;
                      let foreground = '';
                      let background = '';
                      let foregroundName = '';
                      let backgroundName = '';
                      let usage = '';
                      let size: 'normal' | 'large' = 'normal';
                      let standard: 'AA' | 'AAA' = 'AA';

                      if (issue) {
                        ratio = issue.ratio;
                        requiredRatio = issue.requiredRatio;
                        meetsStandard = issue.meetsStandard;
                        foreground = issue.foreground;
                        background = issue.background;
                        foregroundName = issue.foregroundName;
                        backgroundName = issue.backgroundName;
                        usage = issue.usage;
                        size = issue.size;
                        standard = issue.standard;
                      } else if (pair) {
                        try {
                          ratio = getContrastRatio(pair.foreground, pair.background);
                          requiredRatio = pair.standard === 'AAA' 
                            ? (pair.size === 'large' ? 4.5 : 7)
                            : (pair.size === 'large' ? 3 : 4.5);
                          meetsStandard = meetsContrastStandard(
                            ratio, 
                            pair.standard || 'AA', 
                            pair.size || 'normal'
                          );
                          foreground = pair.foreground;
                          background = pair.background;
                          foregroundName = pair.foregroundName;
                          backgroundName = pair.backgroundName;
                          usage = pair.usage;
                          size = pair.size || 'normal';
                          standard = pair.standard || 'AA';
                        } catch (error) {
                          return null;
                        }
                      }

                      return (
                        <div
                          key={isIssue ? issue!.id : `pair-${index}`}
                          className={`p-3 rounded-lg border ${getRatioBg(ratio, requiredRatio)} ${meetsStandard ? 'border-[var(--color-border)]' : 'border-[var(--color-data-fail)]/30'}`}
                        >
                          <div className="flex items-start gap-2">
                            {getStatusIcon(ratio, requiredRatio)}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm text-[var(--color-text-primary)]">
                                  {usage}
                                </p>
                                <span className={`text-xs font-bold ${getRatioColor(ratio, requiredRatio)}`}>
                                  {ratio.toFixed(2)}:1
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1">
                                  <div 
                                    className="w-4 h-4 rounded border border-[var(--color-border)]"
                                    style={{ backgroundColor: foreground }}
                                    title={foreground}
                                  />
                                  <span className="text-xs text-[var(--color-text-muted)]">{foregroundName}</span>
                                </div>
                                <span className="text-xs text-[var(--color-text-muted)]">on</span>
                                <div className="flex items-center gap-1">
                                  <div 
                                    className="w-4 h-4 rounded border border-[var(--color-border)]"
                                    style={{ backgroundColor: background }}
                                    title={background}
                                  />
                                  <span className="text-xs text-[var(--color-text-muted)]">{backgroundName}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded">
                                  {standard} {size}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  Requires {requiredRatio}:1
                                </span>
                              </div>

                              {!meetsStandard && (
                                <p className="text-xs mt-2 text-[var(--color-data-fail)]">
                                  {getFixSuggestion(issue || { ratio, requiredRatio } as any)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {colorPairs.length > 0 && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => setShowAllResults(!showAllResults)}
                      className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
                    >
                      {showAllResults ? 'Show only issues' : 'Show all color pairs'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Press Escape to close</span>
                <span>Ctrl+Shift+C to toggle</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};