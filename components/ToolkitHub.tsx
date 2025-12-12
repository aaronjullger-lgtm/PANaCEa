import React from 'react';
import { motion } from 'framer-motion';
import { 
  Scan, 
  Image, 
  FileCheck, 
  Beaker, 
  Pill,
  BookOpen,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';

interface ToolkitHubProps {
  onNavigate: (mode: string) => void;
  onClose: () => void;
}

interface ToolkitItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
  route: string;
}

const TOOLKIT_ITEMS: ToolkitItem[] = [
  {
    id: 'ar_anatomy',
    title: '3D Anatomy AR',
    description: 'Interactive 3D anatomical structures with AR visualization',
    icon: Scan,
    color: 'text-violet-600 dark:text-violet-400',
    bgGradient: 'from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20',
    route: 'ar_anatomy'
  },
  {
    id: 'radiology_scroll',
    title: 'Radiology Scroll',
    description: 'Browse and learn imaging patterns without time pressure',
    icon: Image,
    color: 'text-slate-600 dark:text-slate-400',
    bgGradient: 'from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20',
    route: 'radiology_scroll'
  },
  {
    id: 'guideline_mode',
    title: 'Clinical Guidelines',
    description: 'Scoring systems, criteria, and clinical decision tools',
    icon: FileCheck,
    color: 'text-teal-600 dark:text-teal-400',
    bgGradient: 'from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20',
    route: 'guideline_drill'
  },
  {
    id: 'lab_normals',
    title: 'Lab Normals Reference',
    description: 'Quick reference for laboratory values and interpretations',
    icon: Beaker,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgGradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20',
    route: 'lab_reference'
  },
  {
    id: 'drug_reference',
    title: 'Drug Reference',
    description: 'Medication lookup, mechanisms, and interactions',
    icon: Pill,
    color: 'text-purple-600 dark:text-purple-400',
    bgGradient: 'from-purple-50 to-fuchsia-50 dark:from-purple-950/20 dark:to-fuchsia-950/20',
    route: 'drug_reference'
  },
  {
    id: 'study_resources',
    title: 'Study Resources',
    description: 'Curated external resources and recommended readings',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400',
    bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
    route: 'study_resources'
  }
];

export const ToolkitHub: React.FC<ToolkitHubProps> = ({ onNavigate, onClose }) => {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-3">
            🧰 Toolkit Hub
          </h1>
          <p className="text-lg text-[var(--color-text-muted)] max-w-3xl">
            Reference materials and learning aids to support your PANCE preparation. 
            These are resources for studying and looking up information—not timed drills.
          </p>
        </motion.div>
      </div>

      {/* Toolkit Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOLKIT_ITEMS.map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            onClick={() => onNavigate(item.route)}
            className={`
              group relative overflow-hidden rounded-2xl p-6
              bg-gradient-to-br ${item.bgGradient}
              border-2 border-transparent
              hover:border-[var(--color-border-focus)]
              hover:shadow-xl hover:scale-[1.02]
              transition-all duration-300
              text-left
            `}
          >
            {/* Icon */}
            <div className={`
              w-14 h-14 rounded-xl mb-4
              bg-white/80 dark:bg-slate-900/80
              flex items-center justify-center
              group-hover:scale-110 transition-transform duration-300
              shadow-sm
            `}>
              <item.icon className={`w-7 h-7 ${item.color}`} />
            </div>

            {/* Content */}
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2 group-hover:translate-x-1 transition-transform duration-300">
              {item.title}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {item.description}
            </p>

            {/* Hover indicator */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <ExternalLink className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>

            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </motion.button>
        ))}
      </div>

      {/* Help Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="max-w-6xl mx-auto mt-12 p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
      >
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          💡 How to Use the Toolkit
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          The Toolkit Hub contains reference materials and passive learning resources. 
          Use these when you want to <strong>look something up</strong>, <strong>review concepts</strong>, 
          or <strong>explore anatomy/imaging</strong> without the pressure of timed questions. 
          For active practice and drills, use the Training Modes from the main dashboard.
        </p>
      </motion.div>
    </div>
  );
};

export default ToolkitHub;
