/**
 * Widget Panel Component
 *
 * Provides UI for generating embeddable widgets for Notion, Obsidian, and other apps.
 * Users can generate widgets and copy the embed code.
 */

import React, { useState, useMemo } from 'react';
import { Code, Copy, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import {
  calculateStreak,
  generateStreakWidgetHTML,
  generateQuestionOfDayHTML,
  generateEmbedCode,
  generateObsidianEmbed,
  getQuestionOfDay,
} from '../../lib/services/widgetService';
import type { Question, PerformanceRecord } from '../../types';

interface WidgetPanelProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
}

type WidgetType = 'streak' | 'question-of-day';
type Theme = 'light' | 'dark';
type EmbedFormat = 'html' | 'obsidian';

export const WidgetPanel: React.FC<WidgetPanelProps> = ({ performanceData, missedQuestions }) => {
  const { user } = useUser();
  const [selectedWidget, setSelectedWidget] = useState<WidgetType>('streak');
  const [theme, setTheme] = useState<Theme>('light');
  const [embedFormat, setEmbedFormat] = useState<EmbedFormat>('html');
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Calculate streak data
  const streakData = useMemo(() => calculateStreak(performanceData), [performanceData]);

  // Get question of the day
  const questionOfDay = useMemo(
    () => getQuestionOfDay(missedQuestions.length > 0 ? missedQuestions : []),
    [missedQuestions]
  );

  // Generate widget HTML based on selection
  const widgetHTML = useMemo(() => {
    if (selectedWidget === 'streak') {
      return generateStreakWidgetHTML(streakData, theme);
    } else if (selectedWidget === 'question-of-day' && questionOfDay) {
      return generateQuestionOfDayHTML(questionOfDay, theme);
    }
    return '';
  }, [selectedWidget, theme, streakData, questionOfDay]);

  // Generate embed code using server-hosted widget URLs
  const embedCode = useMemo(() => {
    // Use server-hosted widget URLs instead of data URIs
    // This makes them compatible with Notion's security policies
    const serverUrl = (import.meta as any).env.VITE_BACKEND_URL || window.location.origin;

    // Get actual userId from authentication context
    const userId = user?.id || 'YOUR_USER_ID';

    let widgetPath = '';
    if (selectedWidget === 'streak') {
      widgetPath = `/widgets/streak/${userId}?theme=${theme}`;
    } else if (selectedWidget === 'question-of-day') {
      widgetPath = `/widgets/question-of-day/${userId}?theme=${theme}`;
    }

    const widgetUrl = `${serverUrl}${widgetPath}`;

    if (embedFormat === 'obsidian') {
      return generateObsidianEmbed(widgetUrl);
    } else {
      return generateEmbedCode(widgetUrl, selectedWidget === 'streak' ? 300 : 450);
    }
  }, [embedFormat, selectedWidget, theme, user]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleRefreshPreview = () => {
    setPreviewKey((prev) => prev + 1);
  };

  return (
    <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-lg p-6 border border-[var(--color-border)]">
      <div className="flex items-center gap-3 mb-4">
        <Code className="w-6 h-6 text-[var(--color-accent)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Embeddable Widgets</h2>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Generate embeddable widgets for your Notion dashboards or Obsidian notes. Display your study
        streak or question of the day.
      </p>

      {/* Widget Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Widget Type:
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedWidget('streak')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedWidget === 'streak'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Current Streak
          </button>
          <button
            onClick={() => setSelectedWidget('question-of-day')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedWidget === 'question-of-day'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Question of Day
          </button>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Theme:
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'light'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Dark
          </button>
        </div>
      </div>

      {/* Embed Format Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Embed Format:
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setEmbedFormat('html')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              embedFormat === 'html'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            HTML (Notion)
          </button>
          <button
            onClick={() => setEmbedFormat('obsidian')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              embedFormat === 'obsidian'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Obsidian
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Preview:
          </label>
          <button
            onClick={handleRefreshPreview}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-bg-secondary)]">
          {widgetHTML ? (
            <iframe
              key={previewKey}
              srcDoc={widgetHTML}
              className="w-full"
              style={{ height: selectedWidget === 'streak' ? '300px' : '450px' }}
              title="Widget Preview"
            />
          ) : (
            <div className="p-8 text-center text-[var(--color-text-muted)]">
              {selectedWidget === 'question-of-day' && !questionOfDay
                ? 'No questions available. Complete some questions first!'
                : 'Widget preview will appear here'}
            </div>
          )}
        </div>
      </div>

      {/* Embed Code */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Embed Code:
        </label>
        <div className="relative">
          <textarea
            value={embedCode}
            readOnly
            rows={4}
            className="w-full px-4 py-2 font-mono text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] resize-none"
          />
          <button
            onClick={handleCopyCode}
            className="absolute top-2 right-2 p-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title="Copy code"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-[var(--color-data-pass)]" />
            ) : (
              <Copy className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-[var(--color-accent)]/10 rounded-lg border border-[var(--color-accent)]/30">
        <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-2">How to Embed:</h3>
        <div className="space-y-2">
          <div className="p-2 bg-[var(--color-data-provisional)]/10 rounded border border-[var(--color-data-provisional)]/30 mb-2">
            <p className="text-xs font-medium text-[var(--color-data-provisional)] flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Important: Replace YOUR_USER_ID in the URL with your actual user ID before
                embedding.
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-accent)] mb-1">Notion:</p>
            <ol className="text-xs text-[var(--color-accent)] space-y-0.5 list-decimal list-inside pl-2">
              <li>Replace YOUR_USER_ID in the URL with your user ID</li>
              <li>Type /embed in your Notion page</li>
              <li>Paste the widget URL (not the full iframe code)</li>
              <li>Click "Embed link"</li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-accent)] mb-1">Obsidian:</p>
            <ol className="text-xs text-[var(--color-accent)] space-y-0.5 list-decimal list-inside pl-2">
              <li>Replace YOUR_USER_ID in the code with your user ID</li>
              <li>Switch to Obsidian embed format above</li>
              <li>Copy and paste the code block into your note</li>
              <li>Switch to preview mode to see the widget</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
