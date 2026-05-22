/**
 * AgentControlPage — Admin page wrapper for the Agent Control Panel.
 *
 * Thin wrapper that provides admin navigation context (back button)
 * around the AgentControlPanel component. Follows the existing
 * admin page pattern (see QuestionGeneratorPage).
 *
 * @module pages/admin/AgentControlPage
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import AgentControlPanel from '@/components/admin/AgentControlPanel';

export default function AgentControlPage() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-steel-blue-50 dark:bg-steel-blue-950"
    >
      {/* Navigation bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-steel-blue-900 border-b border-steel-blue-200 dark:border-steel-blue-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.ADMIN)}
            className="flex items-center gap-1.5 text-sm text-steel-blue-600 hover:text-steel-blue-900 dark:text-steel-blue-400 dark:hover:text-steel-blue-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin
          </button>
          <span className="text-steel-blue-300 dark:text-steel-blue-600">/</span>
          <span className="text-sm font-medium text-deep-plum dark:text-steel-blue-100">
            Agent Control
          </span>
        </div>
      </div>

      {/* Agent Control Panel */}
      <div className="max-w-7xl mx-auto">
        <AgentControlPanel />
      </div>
    </motion.div>
  );
}
