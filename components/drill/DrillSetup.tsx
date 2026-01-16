/**
 * DrillSetup - Universal drill configuration component
 * 
 * Replaces static conditionRegistry imports with live database-driven registry.
 * Used by drill modes to configure system filters and question generation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Filter, Zap, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { SystemCode, SessionSettings } from '../../types';

interface ConditionMetadata {
  id: string;
  name: string;
  system: SystemCode;
  subcategory: string;
}

export interface DrillSetupProps {
  /** Title of the drill */
  title: string;
  /** Description */
  description: string;
  /** Default difficulty */
  defaultDifficulty?: 'easier' | 'same' | 'harder';
  /** Whether to show system filter */
  showSystemFilter?: boolean;
  /** Whether to show question count selector */
  showQuestionCount?: boolean;
  /** Default question count */
  defaultQuestionCount?: number;
  /** Callback when drill starts */
  onStart: (config: DrillConfiguration) => void;
  /** Callback to go back */
  onBack?: () => void;
  /** Custom filters (e.g., only certain categories) */
  systemFilter?: SystemCode[];
}

export interface DrillConfiguration {
  system?: SystemCode;
  difficulty: 'easier' | 'same' | 'harder';
  questionCount: number;
  /** All available conditions for the selected system */
  availableConditions: ConditionMetadata[];
}

const SYSTEM_NAMES: Record<SystemCode, string> = {
  CV: 'Cardiovascular',
  DERM: 'Dermatology',
  ENDO: 'Endocrinology',
  GI: 'Gastrointestinal',
  GU: 'Genitourinary',
  HEME: 'Hematology',
  HEENT: 'Head, Eyes, Ears, Nose, Throat',
  ID: 'Infectious Disease',
  MSK: 'Musculoskeletal',
  NEURO: 'Neurology',
  PRO: 'Professional Practice',
  PSYCH: 'Psychiatry',
  PULM: 'Pulmonary',
  RENAL: 'Renal',
  REPRO: 'Reproductive',
  OTHER: 'Other',
};

export function DrillSetup({
  title,
  description,
  defaultDifficulty = 'same',
  showSystemFilter = true,
  showQuestionCount = true,
  defaultQuestionCount = 10,
  onStart,
  onBack,
  systemFilter,
}: DrillSetupProps) {
  const [conditions, setConditions] = useState<ConditionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | undefined>(undefined);
  // Difficulty is fixed at PANCE-level for standardized practice
  const difficulty: 'easier' | 'same' | 'harder' = 'same';
  const [questionCount, setQuestionCount] = useState(defaultQuestionCount);
  const [isStarting, setIsStarting] = useState(false);

  // Fetch conditions from database on mount
  useEffect(() => {
    async function fetchConditions() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/conditions');
        
        if (!response.ok) {
          throw new Error(`Failed to load conditions: ${response.status}`);
        }
        
        const data = await response.json();
        setConditions(data);
      } catch (err) {
        console.error('Error fetching conditions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load conditions');
      } finally {
        setLoading(false);
      }
    }
    
    fetchConditions();
  }, []);

  // Extract unique systems from conditions, applying filter if provided
  const availableSystems = useMemo(() => {
    if (conditions.length === 0) return [];
    
    const systemSet = new Set<SystemCode>();
    conditions.forEach(c => {
      // Apply filter if provided
      if (!systemFilter || systemFilter.includes(c.system)) {
        systemSet.add(c.system);
      }
    });
    
    return Array.from(systemSet).sort();
  }, [conditions, systemFilter]);

  // Filter conditions by selected system
  const filteredConditions = useMemo(() => {
    if (!selectedSystem) return conditions;
    return conditions.filter(c => c.system === selectedSystem);
  }, [conditions, selectedSystem]);

  // Handle start drill
  const handleStart = () => {
    setIsStarting(true);
    
    const config: DrillConfiguration = {
      system: selectedSystem,
      difficulty,
      questionCount,
      availableConditions: filteredConditions,
    };
    
    // Small delay for visual feedback
    setTimeout(() => {
      onStart(config);
      setIsStarting(false);
    }, 300);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <SkeletonLoader height="3rem" className="mb-6" />
          <SkeletonLoader height="6rem" />
          <SkeletonLoader height="6rem" />
          <SkeletonLoader height="6rem" />
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Error Loading Drill</h2>
          </div>
          <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
          {onBack && (
            <button
              onClick={onBack}
              className="w-full px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        {/* Header */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-8 mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            {title}
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>

        {/* Configuration Options */}
        <div className="space-y-4">
          {/* System Filter */}
          {showSystemFilter && availableSystems.length > 0 && (
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-[var(--color-accent)]" />
                <label className="text-lg font-bold text-[var(--color-text-primary)]">
                  Filter by System
                </label>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setSelectedSystem(undefined)}
                  className={`px-4 py-3 rounded-lg text-left transition-all ${
                    selectedSystem === undefined
                      ? 'bg-[var(--color-accent)] text-white font-medium'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>All Systems</span>
                    <span className="text-sm opacity-75">
                      {conditions.length} conditions
                    </span>
                  </div>
                </button>
                
                {availableSystems.map(system => {
                  const systemConditions = conditions.filter(c => c.system === system);
                  return (
                    <button
                      key={system}
                      onClick={() => setSelectedSystem(system)}
                      className={`px-4 py-3 rounded-lg text-left transition-all ${
                        selectedSystem === system
                          ? 'bg-[var(--color-accent)] text-white font-medium'
                          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{SYSTEM_NAMES[system]}</span>
                        <span className="text-sm opacity-75">
                          {systemConditions.length} conditions
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Difficulty fixed at PANCE-level for standardized practice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span className="font-bold text-blue-700 dark:text-blue-300">PANCE-Level Questions</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              All questions are calibrated to match real PANCE exam difficulty for optimal preparation.
            </p>
          </div>

          {/* Question Count */}
          {showQuestionCount && (
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-[var(--color-accent)]" />
                <label className="text-lg font-bold text-[var(--color-text-primary)]">
                  Number of Questions
                </label>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                {[5, 10, 15, 20].map(count => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      questionCount === count
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary Card */}
          <div className="bg-gradient-to-r from-[var(--color-accent)]/10 to-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-xl p-6">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">
              Drill Summary
            </h3>
            <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <div className="flex justify-between">
                <span>System:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {selectedSystem ? SYSTEM_NAMES[selectedSystem] : 'All Systems'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Difficulty:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  PANCE-Level
                </span>
              </div>
              <div className="flex justify-between">
                <span>Questions:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {questionCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Condition Pool:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {filteredConditions.length} available
                </span>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            disabled={isStarting || filteredConditions.length === 0}
            className="w-full bg-[var(--color-accent)] text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-6 h-6" />
                Start Drill
              </>
            )}
          </motion.button>

          {/* Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
