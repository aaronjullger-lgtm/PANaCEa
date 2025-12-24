/**
 * SystemDrillSession - Organ system-based drill
 * 
 * Allows users to select a PANCE system and practice questions from that system.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X, Heart, Brain, Activity, Droplets, Bone, Eye, Ear, Scissors, Baby, Users, Stethoscope, Shield, ArrowRight, BarChart3 } from 'lucide-react';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import ConditionDrillSession from './ConditionDrillSession';
import { getDrillLandingStats, getCategoryBreakdown } from '@/services/drillStatsService';

interface SystemDrillSessionProps {
  onExit?: () => void;
}

const SYSTEM_OPTIONS = [
  { id: 'CV', name: 'Cardiovascular', icon: Heart, color: 'red', description: 'Heart, vessels, hypertension' },
  { id: 'NEURO', name: 'Neurology', icon: Brain, color: 'purple', description: 'CNS, PNS, stroke, seizures' },
  { id: 'PULM', name: 'Pulmonary', icon: Activity, color: 'blue', description: 'Lungs, asthma, COPD, pneumonia' },
  { id: 'GI', name: 'Gastroenterology', icon: Droplets, color: 'amber', description: 'GI tract, liver, pancreas' },
  { id: 'MSK', name: 'Musculoskeletal', icon: Bone, color: 'slate', description: 'Bones, joints, ligaments' },
  { id: 'DERM', name: 'Dermatology', icon: Scissors, color: 'pink', description: 'Skin lesions, rashes' },
  { id: 'HEENT', name: 'HEENT', icon: Eye, color: 'teal', description: 'Head, eyes, ears, nose, throat' },
  { id: 'ENDO', name: 'Endocrine', icon: Stethoscope, color: 'indigo', description: 'Diabetes, thyroid, hormones' },
  { id: 'RENAL', name: 'Renal/Urology', icon: Droplets, color: 'cyan', description: 'Kidneys, UTI, stones' },
  { id: 'REPRO', name: 'Reproductive', icon: Baby, color: 'rose', description: 'OB/GYN, pregnancy, STIs' },
  { id: 'HEME', name: 'Hematology', icon: Droplets, color: 'red', description: 'Anemia, coagulation, blood' },
  { id: 'ID', name: 'Infectious Disease', icon: Shield, color: 'green', description: 'Bacteria, viruses, parasites' },
  { id: 'PSYCH', name: 'Psychiatry', icon: Brain, color: 'violet', description: 'Mental health, mood, psychosis' },
];

const SystemDrillSession: React.FC<SystemDrillSessionProps> = ({ onExit }) => {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(true);

  const stats = getDrillLandingStats('system_drill');
  const categoryBreakdown = getCategoryBreakdown('system_drill');

  const handleStart = () => {
    setShowLanding(false);
  };

  const handleSystemSelect = (systemId: string) => {
    setSelectedSystem(systemId);
  };

  const handleBackToMenu = () => {
    setSelectedSystem(null);
  };

  // Landing page
  if (showLanding) {
    return (
      <DrillLandingPage
        title="System Drill"
        description="Master an entire organ system"
        icon={Layers}
        accentColor="indigo"
        stats={stats}
        onStart={handleStart}
        instructions={[
          'Choose a PANCE organ system',
          'Practice conditions from that system',
          'Build comprehensive system knowledge',
          'Master high-yield system content',
        ]}
        objectives={[
          'Deep dive into one organ system',
          'Connect related conditions',
          'Build system-specific expertise',
          'Prepare for system-heavy PANCE sections',
        ]}
        estimatedMinutes={15}
      >
        {onExit && (
          <div className="absolute top-4 right-4 z-10">
            <button onClick={onExit} className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors" aria-label="Exit">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Category Progress */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">System Progress</h3>
            </div>
            <div className="space-y-2">
              {categoryBreakdown.slice(0, 5).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{cat.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)]">{cat.attempts} attempts</span>
                    <span className={`font-semibold ${
                      cat.accuracy >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                      cat.accuracy >= 70 ? 'text-amber-600 dark:text-amber-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {cat.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DrillLandingPage>
    );
  }

  // If system selected, show ConditionDrillSession with system filter
  if (selectedSystem) {
    return (
      <ConditionDrillSession
        onExit={handleBackToMenu}
        initialSystem={selectedSystem}
      />
    );
  }

  // System selection menu
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <button onClick={onExit} className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
          <X className="w-5 h-5" />
          <span className="text-sm font-medium">Exit</span>
        </button>
        <h1 className="text-lg font-semibold">System Drill</h1>
        <div className="w-16" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Select Organ System</h2>
          <p className="text-[var(--color-text-secondary)]">Master conditions from a single system</p>
        </motion.div>

        {/* System grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {SYSTEM_OPTIONS.map((system, index) => {
            const Icon = system.icon;
            return (
              <motion.button
                key={system.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSystemSelect(system.id)}
                className="relative p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-indigo-300 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-${system.color}-100 dark:bg-${system.color}-900/20`}>
                    <Icon className={`w-6 h-6 text-${system.color}-600 dark:text-${system.color}-400`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                      {system.name}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {system.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default SystemDrillSession;
