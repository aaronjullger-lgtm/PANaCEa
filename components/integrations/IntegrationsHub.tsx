/**
 * Integrations Hub Component
 *
 * Main component that combines all integration features:
 * - Anki Export
 * - Calendar Sync
 * - Embeddable Widgets
 */

import React, { useState } from 'react';
import { ArrowLeft, Diamond, Calendar, CheckCircle, ClipboardList, Link } from 'lucide-react';
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
    <div className="min-h-screen bg-[var(--color-bg-secondary)] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Menu</span>
            </button>
          )}

          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Study Ecosystem Integrations
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Connect PANaCEa with your favorite study tools: Anki, Google Calendar, Todoist, Trello,
            Notion, and more.
          </p>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label="Integration options" className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { id: 'anki' as const, label: 'Anki Export', icon: Diamond },
            { id: 'calendar' as const, label: 'Calendar Sync', icon: Calendar },
            { id: 'todoist' as const, label: 'Todoist', icon: CheckCircle },
            { id: 'trello' as const, label: 'Trello', icon: ClipboardList },
            { id: 'widgets' as const, label: 'Widgets', icon: Link },
          ]).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] shadow-lg'
                    : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div role="tabpanel" aria-label={activeTab} className="transition-all duration-300">
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
              <CalendarSyncPanel userExamDate={userExamDate} onExamDateSaved={onExamDateSaved} />
            </div>
          )}

          {activeTab === 'todoist' && (
            <div className="animate-fadeIn">
              <TodoistExportPanel missedQuestions={missedQuestions} userExamDate={userExamDate} />
            </div>
          )}

          {activeTab === 'trello' && (
            <div className="animate-fadeIn">
              <TrelloExportPanel userExamDate={userExamDate} />
            </div>
          )}

          {activeTab === 'widgets' && (
            <div className="animate-fadeIn">
              <WidgetPanel performanceData={performanceData} missedQuestions={missedQuestions} />
            </div>
          )}
        </div>

        {/* Feature Comparison */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Why Anki?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Spaced repetition is proven to boost long-term retention. Export only what you missed
              to focus your review time efficiently.
            </p>
          </div>

          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Why Calendar Sync?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Turn your exam date into a structured plan. Never wonder "what should I study today?"
              with automated daily study blocks.
            </p>
          </div>

          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Why Todoist?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Manage your study tasks alongside life's other priorities. Smart scheduling and
              cross-platform sync keep you organized everywhere.
            </p>
          </div>

          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Why Trello?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Visual progress tracking with Kanban boards. Drag cards as you complete topics and see
              your progress at a glance.
            </p>
          </div>

          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Why Widgets?
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
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
