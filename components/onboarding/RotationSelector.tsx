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
  Sparkles
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
  color: string;
}

const ROTATION_OPTIONS: RotationOption[] = [
  { value: 'Emergency Medicine', label: 'Emergency Medicine', icon: Activity, color: 'red' },
  { value: 'Family Medicine', label: 'Family Medicine', icon: Users, color: 'blue' },
  { value: 'Internal Medicine', label: 'Internal Medicine', icon: Stethoscope, color: 'indigo' },
  { value: 'Surgery', label: 'Surgery', icon: Scissors, color: 'purple' },
  { value: 'Pediatrics', label: 'Pediatrics', icon: Baby, color: 'pink' },
  { value: 'Psychiatry', label: 'Psychiatry', icon: Brain, color: 'violet' },
  { value: 'Obstetrics & Gynecology', label: 'OB/GYN', icon: Heart, color: 'rose' },
  { value: 'Cardiology', label: 'Cardiology', icon: Heart, color: 'red' },
  { value: 'Orthopedics', label: 'Orthopedics', icon: Bone, color: 'amber' },
  { value: 'Dermatology', label: 'Dermatology', icon: Eye, color: 'orange' },
  { value: 'Neurology', label: 'Neurology', icon: Brain, color: 'purple' },
  { value: 'Other', label: 'Other', icon: Sparkles, color: 'gray' },
];

export function RotationSelector({ value, onChange, label = 'Current Rotation', className = '' }: RotationSelectorProps) {
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
                p-3 rounded-lg border-2 transition-all text-left
                ${isSelected 
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' 
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
                <span className={`text-sm font-medium ${
                  isSelected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
                }`}>
                  {option.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default RotationSelector;
