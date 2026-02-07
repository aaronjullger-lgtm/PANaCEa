/**
 * Rotation Badge Component
 * 2026 PA Student Optimization - Shows current rotation with quick update
 * 
 * Displays the user's current clinical rotation and allows quick rotation changes
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Edit3,
  X,
} from 'lucide-react';
import type { ClinicalRotation } from '@/types';
import { RotationSelector } from '@/components/onboarding/RotationSelector';

interface RotationBadgeProps {
  currentRotation: ClinicalRotation | null | undefined;
  onRotationChange: (rotation: ClinicalRotation) => void;
  compact?: boolean;
  showEditButton?: boolean;
}

const ROTATION_ICONS: Record<ClinicalRotation, React.ElementType> = {
  'Emergency Medicine': Activity,
  'Family Medicine': Users,
  'Internal Medicine': Stethoscope,
  'Surgery': Scissors,
  'Pediatrics': Baby,
  'Psychiatry': Brain,
  'Obstetrics & Gynecology': UserCheck,
  'Cardiology': Heart,
  'Orthopedics': Bone,
  'Dermatology': Pill,
  'Neurology': Brain,
  'Other': Sparkles,
};

const ROTATION_COLORS: Record<ClinicalRotation, string> = {
  'Emergency Medicine': 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  'Family Medicine': 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  'Internal Medicine': 'text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  'Surgery': 'text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  'Pediatrics': 'text-pink-500 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
  'Psychiatry': 'text-teal-500 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
  'Obstetrics & Gynecology': 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  'Cardiology': 'text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  'Orthopedics': 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  'Dermatology': 'text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  'Neurology': 'text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
  'Other': 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
};

export const RotationBadge: React.FC<RotationBadgeProps> = ({
  currentRotation,
  onRotationChange,
  compact = false,
  showEditButton = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (!currentRotation && !isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all text-sm font-medium"
      >
        <Stethoscope className="w-4 h-4" />
        {compact ? 'Set Rotation' : 'Set Current Rotation'}
      </button>
    );
  }

  const Icon = currentRotation ? ROTATION_ICONS[currentRotation] : Stethoscope;
  const colorClass = currentRotation ? ROTATION_COLORS[currentRotation] : ROTATION_COLORS['Other'];

  const handleRotationUpdate = (rotation: ClinicalRotation) => {
    onRotationChange(rotation);
    setIsEditing(false);
  };

  return (
    <>
      {!isEditing ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass} ${compact ? 'text-xs' : 'text-sm'} font-semibold`}
        >
          <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          <span>{compact ? currentRotation?.split(' ')[0] : currentRotation}</span>
          {showEditButton && (
            <button
              onClick={() => setIsEditing(true)}
              className="ml-1 p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
              aria-label="Change rotation"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsEditing(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                  Update Current Rotation
                </h3>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <RotationSelector
                  value={currentRotation || undefined}
                  onChange={handleRotationUpdate}
                  label="Select your current clinical rotation"
                />
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
};

export default RotationBadge;
