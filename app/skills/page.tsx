import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Eye, 
  BookA,
  Target,
  Trophy,
  Clock
} from 'lucide-react';
import { SectorGrid, SectorItem } from '../../components/layout/SectorGrid';

/**
 * Skill Refinement Page
 * Rapid-fire clinical drills and pattern recognition training
 * 
 * Designed to sharpen reflexes for students, exam takers, and clinicians
 */

const skillsItems: SectorItem[] = [
  {
    id: 'medical-terminology',
    title: 'Medical Terminology',
    description: 'Vocabulary, nomenclature, and root word mastery drills.',
    icon: BookA,
    path: '/skills/terminology',
    color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'rapid-recall',
    title: 'Rapid Recall',
    description: 'High-speed flashcard sessions for instant retrieval practice.',
    icon: Zap,
    path: '/skills/rapid',
    color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  },
  {
    id: 'visual-diagnostics',
    title: 'Visual Diagnostics',
    description: 'Pattern recognition for radiology, ECGs, and dermatology.',
    icon: Eye,
    path: '/skills/visuals',
    color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
  },
];

export const SkillsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <Target className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Skill Refinement
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            Rapid-fire tools to sharpen clinical reflexes and build pattern recognition.
          </p>
        </motion.div>

        {/* Grid */}
        <SectorGrid items={skillsItems} />

        {/* Training Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Performance Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Speed Improvement */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Average Response Time
                </h3>
              </div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                2.3s
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                30% faster than typical exam pace
              </p>
              <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-blue-600 dark:bg-blue-500 rounded-full"></div>
              </div>
            </div>

            {/* Accuracy */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pattern Recognition Accuracy
                </h3>
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                87%
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Visual diagnostic drill success rate
              </p>
              <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full w-[87%] bg-green-600 dark:bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Training Tip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-orange-100 dark:bg-orange-900/40 rounded">
              <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-200 mb-1">
                Daily Recommendation
              </p>
              <p className="text-sm text-orange-800 dark:text-orange-300">
                10 minutes of rapid recall drills daily can improve exam speed by up to 40% within 2 weeks.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SkillsPage;
