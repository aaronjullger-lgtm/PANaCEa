/**
 * Rotation Selector Component
 * Allows users to filter training modes by clinical rotation
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Stethoscope } from 'lucide-react';

export type Rotation =
  | 'all'
  | 'surgery'
  | 'internal_medicine'
  | 'emergency_medicine'
  | 'pediatrics'
  | 'family_medicine'
  | 'psychiatry'
  | 'obgyn'
  | 'primary_care';

interface RotationOption {
  id: Rotation;
  label: string;
  description: string;
  modes: string[]; // IDs of training modes relevant to this rotation
}

const ROTATION_OPTIONS: RotationOption[] = [
  {
    id: 'all',
    label: 'All Rotations',
    description: 'Show all training modes',
    modes: [], // Empty means show all
  },
  {
    id: 'surgery',
    label: 'Surgery',
    description: 'Surgical procedures and management',
    modes: ['fluid_electrolyte', 'osce', 'patient_encounter', 'condition_drill'],
  },
  {
    id: 'internal_medicine',
    label: 'Internal Medicine',
    description: 'Comprehensive medical management',
    modes: ['antibiotic_mode', 'pharmacology', 'ddx_compare', 'mini_lab'],
  },
  {
    id: 'emergency_medicine',
    label: 'Emergency Medicine',
    description: 'Acute care and rapid assessment',
    modes: ['ecg_drill', 'imaging_drill', 'rapid_recall', 'patient_encounter'],
  },
  {
    id: 'pediatrics',
    label: 'Pediatrics',
    description: 'Child and adolescent care',
    modes: ['pharmacology', 'first_line_treatment', 'guideline_drill'],
  },
  {
    id: 'family_medicine',
    label: 'Family Medicine',
    description: 'Comprehensive primary care',
    modes: ['guideline_drill', 'first_line_treatment', 'pharmacology'],
  },
  {
    id: 'psychiatry',
    label: 'Psychiatry',
    description: 'Mental health and behavioral medicine',
    modes: ['pharmacology', 'patient_encounter'],
  },
  {
    id: 'obgyn',
    label: 'OB/GYN',
    description: "Women's health and obstetrics",
    modes: ['guideline_drill', 'patient_encounter', 'pharmacology'],
  },
  {
    id: 'primary_care',
    label: 'Primary Care',
    description: 'General practice and preventive care',
    modes: ['guideline_drill', 'first_line_treatment', 'mini_lab'],
  },
];

interface RotationSelectorProps {
  currentRotation: Rotation;
  onRotationChange: (rotation: Rotation) => void;
}

export const RotationSelector: React.FC<RotationSelectorProps> = ({
  currentRotation,
  onRotationChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ROTATION_OPTIONS is a const array with guaranteed elements, so fallback is always defined
  const currentOption =
    ROTATION_OPTIONS.find((opt) => opt.id === currentRotation) ?? ROTATION_OPTIONS[0]!;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (rotation: Rotation) => {
    onRotationChange(rotation);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Stethoscope className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {currentOption.label}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 right-0 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
          >
            <div className="max-h-96 overflow-y-auto">
              {ROTATION_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                    option.id === currentRotation ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {option.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {option.description}
                  </div>
                  {option.id !== 'all' && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {option.modes.length} training mode{option.modes.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Get filtered training modes based on selected rotation
 */
export function getModesForRotation(rotation: Rotation): string[] {
  const option = ROTATION_OPTIONS.find((opt) => opt.id === rotation);
  if (!option || option.id === 'all') {
    return []; // Empty array means show all modes
  }
  return option.modes;
}
