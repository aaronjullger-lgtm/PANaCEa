/**
 * Rotation Selector Component
 * Allows users to select their current clinical rotation
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  Users,
  Baby,
  Brain,
  Stethoscope,
  Activity,
  Scissors,
  UserCheck,
  Eye,
  Bone,
  Pill,
  Sparkles,
  Check,
} from 'lucide-react';
import type { ClinicalRotation } from '@/types';

interface RotationSelectorProps {
  value: ClinicalRotation | undefined;
  onChange: (rotation: ClinicalRotation) => void;
  label?: string;
  className?: string;
}

interface RotationOption {
  value: ClinicalRotation;
  label: string;
  icon: React.ElementType;
}

const ROTATION_OPTIONS: RotationOption[] = [
  { value: 'Emergency Medicine', label: 'Emergency Medicine', icon: Activity },
  { value: 'Family Medicine', label: 'Family Medicine', icon: Users },
  { value: 'Internal Medicine', label: 'Internal Medicine', icon: Stethoscope },
  { value: 'Surgery', label: 'Surgery', icon: Scissors },
  { value: 'Pediatrics', label: 'Pediatrics', icon: Baby },
  { value: 'Psychiatry', label: 'Psychiatry', icon: Brain },
  { value: 'Obstetrics & Gynecology', label: 'OB/GYN', icon: UserCheck },
  { value: 'Cardiology', label: 'Cardiology', icon: Heart },
  { value: 'Orthopedics', label: 'Orthopedics', icon: Bone },
  { value: 'Dermatology', label: 'Dermatology', icon: Pill },
  { value: 'Neurology', label: 'Neurology', icon: Brain },
  { value: 'Other', label: 'Other', icon: Sparkles },
];

export function RotationSelector({
  value,
  onChange,
  label = 'Current Rotation',
  className = '',
}: RotationSelectorProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-3">
        {label}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ROTATION_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <motion.button
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
              className={`
                p-3 rounded-lg border-2 transition-all text-left relative
                ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 shadow-md shadow-[var(--color-accent)]/20'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] bg-[var(--color-bg-secondary)]'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                  }`}
                />
                <span
                  className={`text-sm font-medium flex-1 ${
                    isSelected
                      ? 'text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {option.label}
                </span>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    className="ml-auto"
                  >
                    <Check className="w-4 h-4 text-[var(--color-accent)]" />
                  </motion.div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default RotationSelector;
