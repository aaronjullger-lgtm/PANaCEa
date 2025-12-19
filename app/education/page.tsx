import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Library, Timer, FileText, Search } from 'lucide-react';
import { SectorGrid, SectorItem } from '../../components/layout/SectorGrid';

/**
 * Education & Retention Page
 * Universal learning tools for PA students, board preppers, and practicing clinicians
 * 
 * Focus: Adaptive learning, knowledge acquisition, and long-term retention
 */

const educationItems: SectorItem[] = [
  {
    id: 'adaptive-review',
    title: 'Adaptive Review',
    description: 'Algorithm-driven spaced repetition for optimal retention.',
    icon: Brain,
    path: '/education/adaptive',
    color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'question-bank',
    title: 'Question Bank',
    description: 'Clinical vignettes and board-style practice questions.',
    icon: Library,
    path: '/education/qbank',
    color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  },
  {
    id: 'simulated-exams',
    title: 'Simulated Exams',
    description: 'Full-length mock assessments in realistic testing conditions.',
    icon: Timer,
    path: '/education/simulator',
    color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  },
  {
    id: 'case-studies',
    title: 'Case Studies',
    description: 'Complex clinical reasoning scenarios with detailed analysis.',
    icon: FileText,
    path: '/education/cases',
    color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  },
];

export const EducationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Education & Retention
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            Adaptive learning tools for knowledge acquisition and maintenance.
          </p>
        </motion.div>

        {/* Grid */}
        <SectorGrid items={educationItems} />

        {/* Stats Footer (Optional) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              2,400+
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Questions Available
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              90%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Average Retention Rate
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              15+
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              PANCE Systems Covered
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EducationPage;
