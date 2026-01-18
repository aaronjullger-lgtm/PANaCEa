import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Activity,
  Image as ImageIcon,
  Zap,
  Beaker,
  User,
  Heart,
  Eye,
  FileImage,
  Pill,
  ListChecks,
  FlaskConical,
  Stethoscope,
  Brain,
  Target,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface DiagnosticDrillHubProps {
  /** Handler to navigate to specific drill mode */
  onNavigateToDrill?: (drillId: string) => void;
  /** Handler to close hub and return to dashboard */
  onClose: () => void;
}

type DrillCategory = 'clinical-diagnosis' | 'quick-fire';
type DrillMode = string;

interface DrillCard {
  id: DrillMode;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: DrillCategory;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: string;
  available: boolean;
}

// Master registry of all diagnostic drill modes
const DRILL_MODES: DrillCard[] = [
  // CLINICAL DIAGNOSIS MODES (Interpretation-based: OSCE, Hydro, Labs, ECG, etc.)
  {
    id: 'virtual_osce',
    name: 'Virtual OSCE',
    description: 'Full patient workups with history, exam, and management',
    icon: User,
    category: 'clinical-diagnosis',
    difficulty: 'advanced',
    estimatedTime: '10-15 min',
    available: false, // Coming soon
  },
  {
    id: 'hydro_mode',
    name: 'Hydro Mode',
    description: 'Diagnose based on clinical vignettes and patient information',
    icon: Stethoscope,
    category: 'clinical-diagnosis',
    difficulty: 'intermediate',
    estimatedTime: '5-10 min',
    available: true,
  },
  {
    id: 'mini_labs',
    name: 'Mini-Labs',
    description: 'Interpret lab panels and diagnose conditions',
    icon: Beaker,
    category: 'clinical-diagnosis',
    difficulty: 'intermediate',
    estimatedTime: '2-4 min',
    available: true,
  },
  {
    id: 'ecg_challenge',
    name: 'ECG Interpretation',
    description: 'Analyze and interpret electrocardiograms',
    icon: Activity,
    category: 'clinical-diagnosis',
    difficulty: 'intermediate',
    estimatedTime: '3-5 min',
    available: true,
  },
  {
    id: 'radiology_photo',
    name: 'Radiology Interpretation',
    description: 'Interpret CT/MRI/X-ray findings and diagnose',
    icon: FileImage,
    category: 'clinical-diagnosis',
    difficulty: 'intermediate',
    estimatedTime: '3-5 min',
    available: true,
  },
  {
    id: 'code_blue',
    name: 'Code Blue',
    description: 'Emergency scenarios requiring rapid clinical decisions',
    icon: Heart,
    category: 'clinical-diagnosis',
    difficulty: 'advanced',
    estimatedTime: '5-8 min',
    available: true,
  },
  {
    id: 'ddx_compare',
    name: 'DDx Compare',
    description: 'Compare differential diagnoses and select most likely',
    icon: Brain,
    category: 'clinical-diagnosis',
    difficulty: 'intermediate',
    estimatedTime: '3-5 min',
    available: true,
  },
  {
    id: 'ventilator',
    name: 'Ventilator Mode',
    description: 'Mechanical ventilation management and troubleshooting',
    icon: Sparkles,
    category: 'clinical-diagnosis',
    difficulty: 'advanced',
    estimatedTime: '5-8 min',
    available: false, // Coming soon
  },

  // QUICK-FIRE MODES (Rapid recall: Buzzwords, Pharm, Derm photos, Daily Term)
  {
    id: 'buzzword_mode',
    name: 'Buzzword Mode',
    description: 'Classic presentation clues → diagnosis',
    icon: Zap,
    category: 'quick-fire',
    difficulty: 'beginner',
    estimatedTime: '2-5 min',
    available: true,
  },
  {
    id: 'derm_photo',
    name: 'Derm Photos',
    description: 'Quick identification of dermatology lesions',
    icon: Eye,
    category: 'quick-fire',
    difficulty: 'intermediate',
    estimatedTime: '2-3 min',
    available: true,
  },
  {
    id: 'pharmacology',
    name: 'Bug-Drug Mastery',
    description: 'Organism-antibiotic matching and antimicrobial selection',
    icon: Pill,
    category: 'quick-fire',
    difficulty: 'intermediate',
    estimatedTime: '3-5 min',
    available: true,
  },
  {
    id: 'first_line',
    name: 'First-Line Treatments',
    description: 'Rapid-fire treatment selection for common conditions',
    icon: Target,
    category: 'quick-fire',
    difficulty: 'beginner',
    estimatedTime: '2-5 min',
    available: true,
  },
  {
    id: 'daily_term',
    name: 'Daily Term',
    description: 'Medical terminology and definitions rapid recall',
    icon: ListChecks,
    category: 'quick-fire',
    difficulty: 'beginner',
    estimatedTime: '2-3 min',
    available: true,
  },
  {
    id: 'polypharmacy',
    name: 'Polypharmacy',
    description: 'Drug interactions and multi-medication management',
    icon: FlaskConical,
    category: 'quick-fire',
    difficulty: 'advanced',
    estimatedTime: '4-6 min',
    available: false, // Coming soon
  },
];

const CATEGORY_INFO: Record<
  DrillCategory,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
  }
> = {
  'clinical-diagnosis': {
    title: 'Clinical Diagnosis Modes',
    description: 'Interpretation-based: OSCE, Hydro, Labs, ECG, Radiology, Code Blue, DDx Compare',
    icon: Stethoscope,
    gradient: 'from-blue-500 to-indigo-600',
  },
  'quick-fire': {
    title: 'Quick-Fire Drills',
    description: 'Rapid recall: Buzzwords, Bug-Drug, Derm, First-Line, Daily Term',
    icon: Zap,
    gradient: 'from-orange-500 to-pink-600',
  },
};

const DiagnosticDrillHub: React.FC<DiagnosticDrillHubProps> = ({ onNavigateToDrill, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<DrillCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter drills by category and search
  const filteredDrills = DRILL_MODES.filter((drill) => {
    const matchesCategory = !selectedCategory || drill.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'advanced':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-3">
            <Heart className="w-10 h-10 text-[var(--color-accent)]" />
            Diagnostic Drill Hub
          </h1>
          <p className="text-lg text-[var(--color-text-muted)] max-w-3xl">
            Clinical Diagnosis (interpretation-based) and Quick-Fire (rapid recall) drill modes
          </p>
        </motion.div>

        {/* Search Bar */}
        <div className="mt-6 relative">
          <input
            type="text"
            placeholder="Search drills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full font-medium transition-all ${
              selectedCategory === null
                ? 'bg-[var(--color-accent)] text-white shadow-md'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]'
            }`}
          >
            All Drills
          </button>
          {(Object.keys(CATEGORY_INFO) as DrillCategory[]).map((category) => {
            const info = CATEGORY_INFO[category];
            const Icon = info.icon;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-[var(--color-accent)] text-white shadow-md'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{info.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {selectedCategory === null ? (
            // Show all categories with their drills
            <motion.div
              key="all-categories"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {(Object.keys(CATEGORY_INFO) as DrillCategory[]).map((category) => {
                const info = CATEGORY_INFO[category];
                const Icon = info.icon;
                const categoryDrills = filteredDrills.filter(
                  (drill) => drill.category === category
                );

                if (categoryDrills.length === 0 && searchQuery) return null;

                return (
                  <div key={category} className="space-y-4">
                    {/* Category Header */}
                    <div
                      className={`flex items-center gap-4 p-6 rounded-xl bg-gradient-to-r ${info.gradient} text-white shadow-lg`}
                    >
                      <div className="p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Icon className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold">{info.title}</h2>
                        <p className="text-white/90">{info.description}</p>
                      </div>
                      <button
                        onClick={() => setSelectedCategory(category)}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-all flex items-center gap-2"
                      >
                        <span>View All</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Drill Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryDrills.map((drill) => (
                        <DrillCard
                          key={drill.id}
                          drill={drill}
                          onSelect={() => onNavigateToDrill?.(drill.id)}
                          getDifficultyColor={getDifficultyColor}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          ) : (
            // Show only selected category
            <motion.div
              key={selectedCategory}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {CATEGORY_INFO[selectedCategory].title}
                </h2>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {filteredDrills.length} drill{filteredDrills.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDrills.map((drill) => (
                  <DrillCard
                    key={drill.id}
                    drill={drill}
                    onSelect={() => onNavigateToDrill?.(drill.id)}
                    getDifficultyColor={getDifficultyColor}
                  />
                ))}
              </div>

              {filteredDrills.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[var(--color-text-muted)]">
                    No drills found matching "{searchQuery}"
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Drill Card Component
interface DrillCardProps {
  drill: DrillCard;
  onSelect: () => void;
  getDifficultyColor: (difficulty?: string) => string;
}

const DrillCard: React.FC<DrillCardProps> = ({ drill, onSelect, getDifficultyColor }) => {
  const Icon = drill.icon;

  return (
    <motion.button
      onClick={drill.available ? onSelect : undefined}
      disabled={!drill.available}
      className={`group text-left p-6 rounded-xl border-2 transition-all ${
        drill.available
          ? 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-xl cursor-pointer'
          : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] opacity-60 cursor-not-allowed'
      }`}
      whileHover={drill.available ? { scale: 1.02 } : undefined}
      whileTap={drill.available ? { scale: 0.98 } : undefined}
    >
      {/* Icon & Title */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`p-3 rounded-lg ${
            drill.available
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
          }`}
        >
          <Icon className="w-6 h-6" />
        </div>
        {!drill.available && (
          <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            Coming Soon
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-accent)] transition-colors">
        {drill.name}
      </h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{drill.description}</p>

      {/* Metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        {drill.difficulty && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${getDifficultyColor(drill.difficulty)}`}
          >
            {drill.difficulty.charAt(0).toUpperCase() + drill.difficulty.slice(1)}
          </span>
        )}
        {drill.estimatedTime && (
          <span className="text-xs text-[var(--color-text-muted)] px-2 py-1 rounded bg-[var(--color-bg-tertiary)]">
            {drill.estimatedTime}
          </span>
        )}
      </div>

      {/* Hover Arrow */}
      {drill.available && (
        <div className="mt-4 flex items-center gap-2 text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-sm font-medium">Start Drill</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      )}
    </motion.button>
  );
};

export default DiagnosticDrillHub;
