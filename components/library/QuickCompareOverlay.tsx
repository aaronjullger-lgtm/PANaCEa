import React from 'react';
import { motion } from 'framer-motion';
import { MedicalContentDisplay } from '@/types/medical-content';
import { Pill, Target, FlaskConical } from 'lucide-react';

interface QuickCompareOverlayProps {
  hoveredCondition: Partial<MedicalContentDisplay>;
  selectedCondition: Partial<MedicalContentDisplay>;
}

export const QuickCompareOverlay: React.FC<QuickCompareOverlayProps> = ({
  hoveredCondition,
  selectedCondition,
}) => {
  const fields = [
    {
      label: 'Gold-Standard Dx',
      hovered: hoveredCondition.gold_standard_dx,
      selected: selectedCondition.gold_standard_dx,
      icon: <Target className="w-4 h-4 text-data-provisional" />,
    },
    {
      label: 'First-Line Rx',
      hovered: hoveredCondition.first_line_rx,
      selected: selectedCondition.first_line_rx,
      icon: <Pill className="w-4 h-4 text-data-pass" />,
    },
    {
      label: 'Best Initial Test',
      hovered: hoveredCondition.best_initial_test,
      selected: selectedCondition.best_initial_test,
      icon: <FlaskConical className="w-4 h-4 text-[var(--color-category-practice)]" />,
    },
  ];

  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 w-full max-w-sm p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg z-10"
    >
      <h3 className="text-lg font-bold text-[var(--color-text-inverse)] mb-4">Quick Compare</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-[var(--color-text-muted)]">{hoveredCondition.condition}</h4>
          {fields.map((field, index) => (
            <div key={index} className="mt-2">
              <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-2">
                {field.icon} {field.label}
              </p>
              <p className="text-sm font-medium text-[var(--color-text-inverse)]">{field.hovered || 'N/A'}</p>
            </div>
          ))}
        </div>
        <div>
          <h4 className="font-semibold text-[var(--color-text-muted)]">{selectedCondition.condition}</h4>
          {fields.map((field, index) => (
            <div key={index} className="mt-2">
              <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-2">
                {field.icon} {field.label}
              </p>
              <p className="text-sm font-medium text-[var(--color-text-inverse)]">{field.selected || 'N/A'}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
