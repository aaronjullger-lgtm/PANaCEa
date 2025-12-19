import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Stethoscope, 
  Pill, 
  Microscope, 
  FileText, 
  Search,
  TrendingUp,
  Clock,
  BookOpen
} from 'lucide-react';
import { SectorGrid, SectorItem } from '../../components/layout/SectorGrid';

/**
 * Clinical Reference Page
 * Comprehensive medical knowledge database
 * 
 * Universal resource for students, residents, and practicing clinicians
 */

const referenceItems: SectorItem[] = [
  {
    id: 'conditions',
    title: 'Conditions',
    description: 'Pathology and disease management across all PANCE systems.',
    icon: Stethoscope,
    path: '/reference/conditions',
    color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  },
  {
    id: 'pharmacology',
    title: 'Pharmacology',
    description: 'Drug index, mechanisms, therapeutics, and adverse effects.',
    icon: Pill,
    path: '/reference/drugs',
    color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics',
    description: 'Laboratory tests, imaging modalities, and diagnostic procedures.',
    icon: Microscope,
    path: '/reference/diagnostics',
    color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  },
  {
    id: 'guidelines',
    title: 'Guidelines',
    description: 'Evidence-based clinical practice guidelines and protocols.',
    icon: FileText,
    path: '/reference/guidelines',
    color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  },
];

export const ReferencePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to search results or implement search logic
      console.log('Searching for:', searchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Clinical Reference
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            Comprehensive index of medical content for quick reference and deep study.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSearch}
          className="mb-12"
        >
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conditions, drugs, guidelines..."
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Search
              </button>
            )}
          </div>
        </motion.form>

        {/* Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <SectorGrid items={referenceItems} />
        </motion.div>

        {/* Database Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  500+
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Conditions Indexed
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Pill className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  800+
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Drugs Catalogued
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  Weekly
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Content Updates
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Access Tip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
        >
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <span className="font-semibold">Pro Tip:</span> Use Cmd/Ctrl + K to open the command palette for instant search from anywhere.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ReferencePage;
