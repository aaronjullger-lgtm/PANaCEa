/**
 * Widget Panel Component
 * 
 * Provides UI for generating embeddable widgets for Notion, Obsidian, and other apps.
 * Users can generate widgets and copy the embed code.
 */

import React, { useState, useMemo } from 'react';
import { Code, Copy, CheckCircle, RefreshCw } from 'lucide-react';
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

export const WidgetPanel: React.FC<WidgetPanelProps> = ({
  performanceData,
  missedQuestions,
}) => {
  const [selectedWidget, setSelectedWidget] = useState<WidgetType>('streak');
  const [theme, setTheme] = useState<Theme>('light');
  const [embedFormat, setEmbedFormat] = useState<EmbedFormat>('html');
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Calculate streak data
  const streakData = useMemo(
    () => calculateStreak(performanceData),
    [performanceData]
  );

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

  // Generate embed code
  const embedCode = useMemo(() => {
    // Create a data URI for the widget HTML
    const dataUri = `data:text/html;base64,${btoa(widgetHTML)}`;
    
    if (embedFormat === 'obsidian') {
      return generateObsidianEmbed(dataUri);
    } else {
      return generateEmbedCode(dataUri, selectedWidget === 'streak' ? 300 : 450);
    }
  }, [widgetHTML, embedFormat, selectedWidget]);

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
    setPreviewKey(prev => prev + 1);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Code className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Embeddable Widgets
        </h2>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Generate embeddable widgets for your Notion dashboards or Obsidian notes.
        Display your study streak or question of the day.
      </p>

      {/* Widget Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Widget Type:
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedWidget('streak')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedWidget === 'streak'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Current Streak
          </button>
          <button
            onClick={() => setSelectedWidget('question-of-day')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedWidget === 'question-of-day'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Question of Day
          </button>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Theme:
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'light'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Dark
          </button>
        </div>
      </div>

      {/* Embed Format Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Embed Format:
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setEmbedFormat('html')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              embedFormat === 'html'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            HTML (Notion)
          </button>
          <button
            onClick={() => setEmbedFormat('obsidian')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              embedFormat === 'obsidian'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Obsidian
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Preview:
          </label>
          <button
            onClick={handleRefreshPreview}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          {widgetHTML ? (
            <iframe
              key={previewKey}
              srcDoc={widgetHTML}
              className="w-full"
              style={{ height: selectedWidget === 'streak' ? '300px' : '450px' }}
              title="Widget Preview"
            />
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {selectedWidget === 'question-of-day' && !questionOfDay
                ? 'No questions available. Complete some questions first!'
                : 'Widget preview will appear here'}
            </div>
          )}
        </div>
      </div>

      {/* Embed Code */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Embed Code:
        </label>
        <div className="relative">
          <textarea
            value={embedCode}
            readOnly
            rows={4}
            className="w-full px-4 py-2 font-mono text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
          />
          <button
            onClick={handleCopyCode}
            className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
          How to Embed:
        </h3>
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              Notion:
            </p>
            <ol className="text-xs text-indigo-700 dark:text-indigo-400 space-y-0.5 list-decimal list-inside pl-2">
              <li>Type /embed in your Notion page</li>
              <li>Paste the HTML embed code</li>
              <li>Click "Embed link"</li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              Obsidian:
            </p>
            <ol className="text-xs text-indigo-700 dark:text-indigo-400 space-y-0.5 list-decimal list-inside pl-2">
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
