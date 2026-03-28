/**
 * DDxMatrixView - Multi-condition comparison matrix
 *
 * Compare 3-5 conditions side-by-side in a matrix format
 * Highlights discriminating features and unique characteristics
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  ArrowLeftRight,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Star,
  Target,
  Microscope,
  Pill,
  Stethoscope,
  Activity,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  fetchConditionComparison,
  type DeepConditionData,
  type ComparisonField,
  formatFieldValue,
  groupFieldsByCategory,
  getCategoryLabel,
} from '@/services/domain';
import { YieldBadge, SystemBadge } from '@/components/ui/badges';

interface DDxMatrixViewProps {
  /** Initial condition IDs to compare */
  initialConditionIds?: string[];
  /** All available conditions for selection */
  availableConditions: Array<{
    id: string;
    condition: string;
    system: string;
  }>;
  /** Called when user closes the matrix */
  onClose: () => void;
  /** Called when user wants to start a quiz */
  onStartQuiz?: (conditionIds: string[]) => void;
  /** Maximum conditions to compare */
  maxConditions?: number;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  presentation: Stethoscope,
  demographics: Activity,
  pathophysiology: TrendingUp,
  diagnosis: Microscope,
  treatment: Pill,
  prognosis: Clock,
};

const CATEGORY_COLORS: Record<string, string> = {
  presentation: 'border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-category-practice)_5%,transparent)]',
  demographics: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5',
  pathophysiology: 'border-data-provisional/30 bg-data-provisional/5',
  diagnosis: 'border-data-pass/30 bg-data-pass/5',
  treatment: 'border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/100/5',
  prognosis: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5',
};

export const DDxMatrixView: React.FC<DDxMatrixViewProps> = ({
  initialConditionIds = [],
  availableConditions,
  onClose,
  onStartQuiz,
  maxConditions = 5,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialConditionIds.slice(0, maxConditions)
  );
  const [comparisonData, setComparisonData] = useState<{
    conditions: DeepConditionData[];
    discriminatingFeatures: string[];
    uniqueEntities: any[];
    comparisonFields: ComparisonField[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['presentation', 'diagnosis', 'treatment'])
  );
  const [highlightDifferences, setHighlightDifferences] = useState(true);
  const [showLinkedEntities, setShowLinkedEntities] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch comparison data when selection changes
  useEffect(() => {
    if (selectedIds.length >= 2) {
      fetchComparison();
    } else {
      setComparisonData(null);
    }
  }, [selectedIds]);

  const fetchComparison = async () => {
    const id0 = selectedIds[0];
    const id1 = selectedIds[1];
    if (!id0 || !id1) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchConditionComparison(id0, id1);
      setComparisonData({
        conditions: [data.correct, data.selected],
        discriminatingFeatures: [],
        uniqueEntities: [],
        comparisonFields: data.fields,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setIsLoading(false);
    }
  };

  // Group fields by category
  const groupedFields = useMemo(() => {
    if (!comparisonData?.comparisonFields) return {};
    return groupFieldsByCategory(comparisonData.comparisonFields);
  }, [comparisonData?.comparisonFields]);

  // Toggle condition selection
  const toggleCondition = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } else if (selectedIds.length < maxConditions) {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  // Check if a field differs across conditions
  const fieldDiffers = (field: ComparisonField): boolean => {
    if (!comparisonData?.conditions || comparisonData.conditions.length < 2) return false;
    const values = comparisonData.conditions.map((c) => {
      const v = c[field.key as keyof DeepConditionData];
      return formatFieldValue(
        v === undefined || v === null ? '-' : Array.isArray(v) ? v : (v as string)
      );
    });
    const unique = new Set(values.filter((v) => v !== '-'));
    return unique.size > 1;
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={false}
        animate={{}}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-[95vw] max-h-[95vh] bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-[0_18px_42px_var(--color-shadow-soft)] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ddx-matrix-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-bg-secondary)] to-transparent">
          <div>
            <h2
              id="ddx-matrix-title"
              className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <ArrowLeftRight className="w-5 h-5 text-[var(--color-accent)]" />
              DDx Matrix Comparison
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Compare up to {maxConditions} conditions side-by-side
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Highlight Toggle */}
            <button
              onClick={() => setHighlightDifferences(!highlightDifferences)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                highlightDifferences
                  ? 'bg-data-provisional/20 text-data-provisional border border-data-provisional/30'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <Target className="w-3 h-3 inline mr-1" />
              Differences
            </button>

            {/* Linked Entities Toggle */}
            <button
              onClick={() => setShowLinkedEntities(!showLinkedEntities)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showLinkedEntities
                  ? 'bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] text-[var(--color-category-practice)] border border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              Labs/Imaging
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Condition Selector Pills */}
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30 overflow-x-auto">
          <div className="flex items-center gap-2 flex-nowrap">
            {selectedIds.map((id, index) => {
              const cond = availableConditions.find((c) => c.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 flex-shrink-0"
                >
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-xs flex items-center justify-center font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)] max-w-32 truncate">
                    {cond?.condition || id}
                  </span>
                  <button
                    onClick={() => toggleCondition(id)}
                    className="p-0.5 rounded-full hover:bg-data-fail/20 transition-colors"
                  >
                    <X className="w-3 h-3 text-data-fail" />
                  </button>
                </div>
              );
            })}

            {/* Add Condition Button */}
            {selectedIds.length < maxConditions && (
              <ConditionAdder
                availableConditions={availableConditions.filter((c) => !selectedIds.includes(c.id))}
                onSelect={(id) => toggleCondition(id)}
              />
            )}
          </div>
        </div>

        {/* Matrix Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-[var(--color-text-muted)]">
                Loading comparison data...
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-data-fail">
              <AlertTriangle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : selectedIds.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <ArrowLeftRight className="w-12 h-12 text-[var(--color-text-muted)] opacity-50 mb-4" />
              <p className="text-[var(--color-text-muted)]">
                Select at least 2 conditions to compare
              </p>
            </div>
          ) : comparisonData ? (
            <div className="p-4 sm:p-6">
              {/* Discriminating Features Banner */}
              {comparisonData.discriminatingFeatures.length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-data-provisional/10 border border-data-provisional/30">
                  <div className="flex items-center gap-2 text-xs font-semibold text-data-provisional uppercase tracking-wide mb-2">
                    <Lightbulb className="w-4 h-4" />
                    Key Discriminating Features
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {comparisonData.discriminatingFeatures.map((feature) => (
                      <span
                        key={feature}
                        className="px-2 py-1 rounded bg-data-provisional/20 text-xs text-data-provisional"
                      >
                        {feature.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Matrix Table */}
              <div className="space-y-4">
                {Object.entries(groupedFields).map(([category, fields]) => {
                  const CategoryIcon = CATEGORY_ICONS[category] || Stethoscope;
                  const isExpanded = expandedCategories.has(category);
                  const filteredFields = showLinkedEntities
                    ? fields
                    : fields.filter(
                        (f) => !(f as ComparisonField & { isLinkedEntity?: boolean }).isLinkedEntity
                      );

                  if (filteredFields.length === 0) return null;

                  return (
                    <div
                      key={category}
                      className={`rounded-xl border overflow-hidden ${CATEGORY_COLORS[category] || 'border-[var(--color-border)]'}`}
                    >
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--color-bg-secondary)]/30 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                        )}
                        <CategoryIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {getCategoryLabel(category)}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          ({filteredFields.length} fields)
                        </span>
                      </button>

                      {/* Category Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-t border-[var(--color-border)]/50">
                                    <th className="sticky left-0 bg-[var(--color-bg-secondary)] px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide w-40">
                                      Field
                                    </th>
                                    {comparisonData.conditions.map((cond, i) => (
                                      <th
                                        key={cond.id}
                                        className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-primary)] min-w-48"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-xs flex items-center justify-center font-bold">
                                            {i + 1}
                                          </span>
                                          {cond.name}
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredFields.map((field, rowIndex) => {
                                    const differs = fieldDiffers(field);
                                    return (
                                      <tr
                                        key={field.key}
                                        className={`border-t border-[var(--color-border)]/30 ${
                                          rowIndex % 2 === 0
                                            ? 'bg-transparent'
                                            : 'bg-[var(--color-bg-secondary)]/20'
                                        }`}
                                      >
                                        <td className="sticky left-0 bg-[var(--color-bg-secondary)] px-4 py-2 font-medium text-[var(--color-text-secondary)]">
                                          <div className="flex items-center gap-1">
                                            {field.label}
                                            {differs && highlightDifferences && (
                                              <Star className="w-3 h-3 text-data-provisional" />
                                            )}
                                          </div>
                                        </td>
                                        {comparisonData.conditions.map((cond) => {
                                          const value = cond[field.key as keyof DeepConditionData];
                                          const displayValue = (
                                            field as ComparisonField & { isLinkedEntity?: boolean }
                                          ).isLinkedEntity
                                            ? formatLinkedEntity(value)
                                            : formatFieldValue(
                                                value === undefined || value === null
                                                  ? '-'
                                                  : Array.isArray(value)
                                                    ? value
                                                    : (value as string)
                                              );

                                          return (
                                            <td
                                              key={cond.id}
                                              className={`px-4 py-2 text-[var(--color-text-secondary)] ${
                                                differs && highlightDifferences
                                                  ? 'bg-data-provisional/5'
                                                  : ''
                                              }`}
                                            >
                                              <div className="max-w-xs">
                                                {displayValue === '-' ? (
                                                  <span className="text-[var(--color-text-muted)]">
                                                    -
                                                  </span>
                                                ) : (
                                                  <span className="break-words">
                                                    {displayValue}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {comparisonData && selectedIds.length >= 2 && onStartQuiz && (
          <div className="px-4 sm:px-6 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
            <button
              onClick={() => onStartQuiz(selectedIds)}
              className="w-full py-2.5 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Start DDx Quiz: {comparisonData.conditions.map((c) => c.name).join(' vs ')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

/**
 * Format linked entity arrays for display
 */
function formatLinkedEntity(value: unknown): string {
  if (!value || !Array.isArray(value)) return '-';
  if (value.length === 0) return '-';

  // Handle different linked entity types
  const items = value.slice(0, 3).map((item) => {
    if (typeof item === 'string') return item;
    if (item.name) return item.name;
    if (item.genericName) return item.genericName;
    return JSON.stringify(item);
  });

  const suffix = value.length > 3 ? ` (+${value.length - 3} more)` : '';
  return items.join(', ') + suffix;
}

/**
 * Condition Adder Dropdown
 */
const ConditionAdder: React.FC<{
  availableConditions: Array<{ id: string; condition: string; system: string }>;
  onSelect: (id: string) => void;
}> = ({ availableConditions, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return availableConditions.slice(0, 20);
    const query = search.toLowerCase();
    return availableConditions
      .filter(
        (c) => c.condition.toLowerCase().includes(query) || c.system.toLowerCase().includes(query)
      )
      .slice(0, 20);
  }, [availableConditions, search]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">Add</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-1 w-72 max-h-64 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden z-50"
          >
            <div className="p-2 border-b border-[var(--color-border)]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conditions..."
                className="w-full px-3 py-1.5 text-sm rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((cond) => (
                <button
                  key={cond.id}
                  onClick={() => {
                    onSelect(cond.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {cond.condition}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">{cond.system}</p>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="p-3 text-sm text-[var(--color-text-muted)] text-center">
                  No conditions found
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close dropdown */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

export default DDxMatrixView;
