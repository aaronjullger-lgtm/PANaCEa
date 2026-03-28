/**
 * DDxCompareModal - Side-by-side comparison of two conditions
 *
 * Useful for differential diagnosis review - helps students see
 * distinguishing features between similar conditions
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeftRight,
  Search,
  Check,
  AlertTriangle,
  Stethoscope,
  Pill,
  Microscope,
} from 'lucide-react';
import type { MedicalContentDisplay } from '@/types/medical-content';
import { parseListField, parseTextField } from '@/lib/utils/normalization';
import { YieldBadge, SystemBadge } from '@/components/ui/badges';

interface DDxCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** All available conditions for selection */
  conditions: Partial<MedicalContentDisplay>[];
  /** Pre-selected first condition */
  initialCondition?: Partial<MedicalContentDisplay>;
  /** Called when user wants to quiz on DDx */
  onStartDDxQuiz?: (conditionIds: string[]) => void;
}

type ComparisonField = {
  key: keyof MedicalContentDisplay | string;
  label: string;
  icon: React.ElementType;
  category: 'presentation' | 'diagnosis' | 'treatment';
};

const COMPARISON_FIELDS: ComparisonField[] = [
  { key: 'classic_patient', label: 'Classic Patient', icon: Stethoscope, category: 'presentation' },
  { key: 'symptoms', label: 'Symptoms', icon: AlertTriangle, category: 'presentation' },
  { key: 'buzzwords', label: 'Buzzwords', icon: AlertTriangle, category: 'presentation' },
  { key: 'gold_standard_dx', label: 'Gold Standard Dx', icon: Microscope, category: 'diagnosis' },
  { key: 'best_initial_test', label: 'Best Initial Test', icon: Microscope, category: 'diagnosis' },
  { key: 'first_line_rx', label: 'First-Line Rx', icon: Pill, category: 'treatment' },
  { key: 'treatment', label: 'Treatment', icon: Pill, category: 'treatment' },
];

const ConditionSelector: React.FC<{
  conditions: Partial<MedicalContentDisplay>[];
  selected: Partial<MedicalContentDisplay> | null;
  onSelect: (condition: Partial<MedicalContentDisplay>) => void;
  otherSelected?: string; // ID of the other selected condition
  placeholder: string;
}> = ({ conditions, selected, onSelect, otherSelected, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = conditions.filter((c) => c.id !== otherSelected);
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (c) => c.condition?.toLowerCase().includes(query) || c.system?.toLowerCase().includes(query)
      );
    }
    return result.slice(0, 20);
  }, [conditions, search, otherSelected]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-left hover:border-[var(--color-accent)]/50 transition-colors"
      >
        {selected ? (
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{selected.condition}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{selected.system}</p>
          </div>
        ) : (
          <span className="text-[var(--color-text-muted)]">{placeholder}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-xl"
          >
            {/* Search */}
            <div className="p-2 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conditions..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((condition) => (
                <button
                  key={condition.id}
                  onClick={() => {
                    onSelect(condition);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {condition.condition}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{condition.system}</p>
                  </div>
                  {selected?.id === condition.id && (
                    <Check className="w-4 h-4 text-data-pass flex-shrink-0" />
                  )}
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
    </div>
  );
};

const ComparisonRow: React.FC<{
  field: ComparisonField;
  left: Partial<MedicalContentDisplay> | null;
  right: Partial<MedicalContentDisplay> | null;
}> = ({ field, left, right }) => {
  const Icon = field.icon;

  const getValue = (condition: Partial<MedicalContentDisplay> | null): string => {
    if (!condition) return '-';
    const value = condition[field.key as keyof MedicalContentDisplay];
    if (Array.isArray(value)) {
      return parseListField(value).join(', ') || '-';
    }
    return parseTextField(value) || '-';
  };

  const leftValue = getValue(left);
  const rightValue = getValue(right);
  const isDifferent = leftValue !== rightValue && leftValue !== '-' && rightValue !== '-';

  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] gap-4 p-3 rounded-lg ${isDifferent ? 'bg-[var(--color-data-provisional)]/100/5 border border-[var(--color-data-provisional)]/20' : 'bg-[var(--color-bg-secondary)]/30'}`}
    >
      {/* Left value */}
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-text-secondary)] break-words">{leftValue}</p>
      </div>

      {/* Label */}
      <div className="flex flex-col items-center justify-center w-28">
        <Icon className="w-4 h-4 text-[var(--color-text-muted)] mb-1" />
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide text-center">
          {field.label}
        </span>
        {isDifferent && (
          <span className="mt-1 px-1.5 py-0.5 rounded text-[8px] bg-data-provisional/20 text-data-provisional font-semibold">
            DIFFERS
          </span>
        )}
      </div>

      {/* Right value */}
      <div className="min-w-0 text-right">
        <p className="text-sm text-[var(--color-text-secondary)] break-words">{rightValue}</p>
      </div>
    </div>
  );
};

export const DDxCompareModal: React.FC<DDxCompareModalProps> = ({
  isOpen,
  onClose,
  conditions,
  initialCondition,
  onStartDDxQuiz,
}) => {
  const [left, setLeft] = useState<Partial<MedicalContentDisplay> | null>(initialCondition || null);
  const [right, setRight] = useState<Partial<MedicalContentDisplay> | null>(null);
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'presentation' | 'diagnosis' | 'treatment'
  >('all');

  const filteredFields = useMemo(() => {
    if (activeCategory === 'all') return COMPARISON_FIELDS;
    return COMPARISON_FIELDS.filter((f) => f.category === activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const swapConditions = () => {
    const temp = left;
    setLeft(right);
    setRight(temp);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
        role="dialog"
        aria-modal="true"
        aria-label="DDx Compare"
        className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-[0_18px_42px_var(--color-shadow-soft)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[var(--color-accent)]" />
            DDx Compare
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
          <ConditionSelector
            conditions={conditions}
            selected={left}
            onSelect={setLeft}
            otherSelected={right?.id}
            placeholder="Select first condition..."
          />

          <button
            onClick={swapConditions}
            className="p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors self-center"
            title="Swap conditions"
          >
            <ArrowLeftRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>

          <ConditionSelector
            conditions={conditions}
            selected={right}
            onSelect={setRight}
            otherSelected={left?.id}
            placeholder="Select second condition..."
          />
        </div>

        {/* Condition Headers */}
        {(left || right) && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              {left && (
                <>
                  <SystemBadge system={left.system || ''} />
                  <YieldBadge yield={left.pance_yield} />
                </>
              )}
            </div>
            <div className="w-28" />
            <div className="flex items-center gap-2 justify-end">
              {right && (
                <>
                  <YieldBadge yield={right.pance_yield} />
                  <SystemBadge system={right.system || ''} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
          {(['all', 'presentation', 'diagnosis', 'treatment'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Comparison Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {left && right ? (
            filteredFields.map((field) => (
              <ComparisonRow key={field.key} field={field} left={left} right={right} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <ArrowLeftRight className="w-12 h-12 text-[var(--color-text-muted)] opacity-50 mb-4" />
              <p className="text-[var(--color-text-muted)]">
                Select two conditions above to compare
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {left && right && onStartDDxQuiz && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
            <button
              onClick={() => onStartDDxQuiz([left.id!, right.id!])}
              className="w-full py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Start DDx Quiz: {left.condition} vs {right.condition}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default DDxCompareModal;
