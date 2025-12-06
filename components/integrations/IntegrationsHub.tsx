/**
 * Integrations Hub Component
 * 
 * Main component that combines all integration features:
 * - Anki Export
 * - Calendar Sync
 * - Embeddable Widgets
 */

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AnkiExportPanel } from './AnkiExportPanel';
import { CalendarSyncPanel } from './CalendarSyncPanel';
import { WidgetPanel } from './WidgetPanel';
import { TodoistExportPanel } from './TodoistExportPanel';
import { TrelloExportPanel } from './TrelloExportPanel';
import type { Question, PerformanceRecord } from '../../types';

interface IntegrationsHubProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  userExamDate?: Date;
  onExamDateSaved?: (date: Date) => void;
  onBack?: () => void;
}

type IntegrationTab = 'anki' | 'calendar' | 'widgets' | 'todoist' | 'trello';

export const IntegrationsHub: React.FC<IntegrationsHubProps> = ({
  performanceData,
  missedQuestions,
  userExamDate,
  onExamDateSaved,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<IntegrationTab>('anki');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Menu</span>
            </button>
          )}
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Study Ecosystem Integrations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect PANaCEa with your favorite study tools: Anki, Google Calendar, Todoist, Trello, Notion, and more.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('anki')}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'anki'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            [◆] Anki Export
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'calendar'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            📅 Calendar Sync
          </button>
          <button
            onClick={() => setActiveTab('todoist')}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'todoist'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            ✓ Todoist
          </button>
          <button
            onClick={() => setActiveTab('trello')}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'trello'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            📋 Trello
          </button>
          <button
            onClick={() => setActiveTab('widgets')}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'widgets'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            🔗 Widgets
          </button>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300">
          {activeTab === 'anki' && (
            <div className="animate-fadeIn">
              <AnkiExportPanel
                performanceData={performanceData}
                missedQuestions={missedQuestions}
              />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="animate-fadeIn">
              <CalendarSyncPanel
                userExamDate={userExamDate}
                onExamDateSaved={onExamDateSaved}
              />
            </div>
          )}

          {activeTab === 'todoist' && (
            <div className="animate-fadeIn">
              <TodoistExportPanel
                missedQuestions={missedQuestions}
                userExamDate={userExamDate}
              />
            </div>
          )}

          {activeTab === 'trello' && (
            <div className="animate-fadeIn">
              <TrelloExportPanel
                userExamDate={userExamDate}
              />
            </div>
          )}

          {activeTab === 'widgets' && (
            <div className="animate-fadeIn">
              <WidgetPanel
                performanceData={performanceData}
                missedQuestions={missedQuestions}
              />
            </div>
          )}
        </div>

        {/* Feature Comparison */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Why Anki?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Spaced repetition is proven to boost long-term retention. Export only what you missed
              to focus your review time efficiently.
            </p>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Why Calendar Sync?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Turn your exam date into a structured plan. Never wonder "what should I study today?"
              with automated daily study blocks.
            </p>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Why Todoist?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Manage your study tasks alongside life's other priorities. Smart scheduling and
              cross-platform sync keep you organized everywhere.
            </p>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Why Trello?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Visual progress tracking with Kanban boards. Drag cards as you complete topics and
              see your progress at a glance.
            </p>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Why Widgets?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Keep PANaCEa visible in your Notion dashboard or Obsidian vault. Daily reminders and
              progress tracking right where you work.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsHub;
