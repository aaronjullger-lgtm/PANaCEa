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
      icon: <Target className="w-4 h-4 text-amber-400" />,
    },
    {
      label: 'First-Line Rx',
      hovered: hoveredCondition.first_line_rx,
      selected: selectedCondition.first_line_rx,
      icon: <Pill className="w-4 h-4 text-emerald-400" />,
    },
    {
      label: 'Best Initial Test',
      hovered: (hoveredCondition as any).best_initial_test,
      selected: (selectedCondition as any).best_initial_test,
      icon: <FlaskConical className="w-4 h-4 text-blue-400" />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 w-full max-w-sm p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10"
    >
      <h3 className="text-lg font-bold text-white mb-4">Quick Compare</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-gray-300">{hoveredCondition.condition}</h4>
          {fields.map((field, index) => (
            <div key={index} className="mt-2">
              <p className="text-sm text-gray-400 flex items-center gap-2">
                {field.icon} {field.label}
              </p>
              <p className="text-sm font-medium text-white">{field.hovered || 'N/A'}</p>
            </div>
          ))}
        </div>
        <div>
          <h4 className="font-semibold text-gray-300">{selectedCondition.condition}</h4>
          {fields.map((field, index) => (
            <div key={index} className="mt-2">
              <p className="text-sm text-gray-400 flex items-center gap-2">
                {field.icon} {field.label}
              </p>
              <p className="text-sm font-medium text-white">{field.selected || 'N/A'}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
