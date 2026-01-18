/**
 * Visualization Demo Page
 *
 * Interactive demo showcasing all three visualization components:
 * - RadialProgress
 * - TrendSparkline
 * - ActivityHeatmap
 *
 * Visit this page to see all visualizations in action with sample data.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import RadialProgress, { MultiRadialProgress } from '../ui/RadialProgress';
import TrendSparkline from '../ui/TrendSparkline';
import ActivityHeatmap from '../analytics/ActivityHeatmap';
import type { PerformanceRecord } from '@/types';
import { Play, RefreshCw } from 'lucide-react';

// Generate sample performance data for the last 90 days
const generateSampleData = (): PerformanceRecord[] => {
  const records: PerformanceRecord[] = [];
  const now = Date.now();

  for (let i = 0; i < 500; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const timestamp = now - daysAgo * 24 * 60 * 60 * 1000;
    const isCorrect = Math.random() > 0.25; // 75% accuracy

    records.push({
      conditionId: `cond-${Math.floor(Math.random() * 50)}`,
      condition: 'Sample Condition',
      topic: 'Sample Topic',
      system: ['CV', 'DERM', 'ENDO', 'GI', 'RENAL'][Math.floor(Math.random() * 5)] as any,
      subcategory: null,
      isCorrect,
      timeSpentMs: Math.floor(Math.random() * 60000) + 10000,
      timestamp,
      focus: 'all' as const,
      difficulty: 'same' as const,
      questionType: 'diagnosis' as const,
    });
  }

  return records.sort((a, b) => a.timestamp - b.timestamp);
};

const VisualizationDemoPage: React.FC = () => {
  const [sampleData] = useState(() => generateSampleData());
  const [accuracyValue, setAccuracyValue] = useState(75);
  const [isAnimating, setIsAnimating] = useState(false);

  // Sample sparkline data (last 10 sessions)
  const [sparklineData] = useState([65, 70, 68, 75, 78, 80, 77, 82, 85, 88]);

  const handleRandomize = () => {
    setIsAnimating(true);
    const newValue = Math.floor(Math.random() * 40) + 60; // 60-100%
    setAccuracyValue(newValue);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            📊 Data Visualization Components
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Interactive demo of RadialProgress, TrendSparkline, and ActivityHeatmap
          </p>
        </motion.div>

        {/* Section 1: RadialProgress */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                🎯 Radial Progress Indicators
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Circular progress rings perfect for displaying accuracy percentages
              </p>
            </div>
            <button
              onClick={handleRandomize}
              disabled={isAnimating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isAnimating ? 'animate-spin' : ''}`} />
              Randomize
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Large Display */}
            <div className="flex flex-col items-center">
              <RadialProgress
                value={accuracyValue}
                size={140}
                strokeWidth={12}
                showValue={true}
                label="Overall Accuracy"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Large (140px)</p>
            </div>

            {/* Medium Display */}
            <div className="flex flex-col items-center">
              <RadialProgress
                value={accuracyValue}
                size={100}
                strokeWidth={8}
                showValue={true}
                label="Current Session"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Medium (100px)</p>
            </div>

            {/* Compact Display */}
            <div className="flex flex-col items-center">
              <RadialProgress
                value={accuracyValue}
                size={60}
                strokeWidth={6}
                showValue={true}
                label="Quick View"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Compact (60px)</p>
            </div>

            {/* Custom Color */}
            <div className="flex flex-col items-center">
              <RadialProgress
                value={accuracyValue}
                size={100}
                strokeWidth={10}
                color="#8b5cf6"
                showValue={true}
                label="Custom Purple"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Custom color</p>
            </div>
          </div>

          {/* Multi-comparison */}
          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Multi-System Comparison
            </h3>
            <MultiRadialProgress
              items={[
                { value: 85, label: 'Cardiology', color: '#ef4444' },
                { value: 72, label: 'Neurology', color: '#3b82f6' },
                { value: 90, label: 'Nephrology', color: '#10b981' },
                { value: 68, label: 'Pulmonology', color: '#f59e0b' },
              ]}
              size={100}
              className="justify-center"
            />
          </div>
        </motion.section>

        {/* Section 2: TrendSparkline */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              📈 Trend Sparklines
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Small line charts showing performance trends over recent sessions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Sparkline */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                Recent Performance (Improving)
              </h3>
              <TrendSparkline
                data={sparklineData}
                width={300}
                height={70}
                colorScheme="auto"
                showTrend={true}
                showValue={true}
                label="Last 10 Sessions"
              />
            </div>

            {/* Declining Trend */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                Needs Attention (Declining)
              </h3>
              <TrendSparkline
                data={sparklineData.slice().reverse()}
                width={300}
                height={70}
                colorScheme="auto"
                showTrend={true}
                showValue={true}
                label="Last 10 Sessions"
              />
            </div>
          </div>

          {/* Color Scheme Variations */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Color Scheme Variations
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TrendSparkline
                data={[70, 75, 80, 85, 90]}
                width={150}
                height={50}
                colorScheme="success"
                label="Success"
              />
              <TrendSparkline
                data={[70, 75, 80, 85, 90]}
                width={150}
                height={50}
                colorScheme="warning"
                label="Warning"
              />
              <TrendSparkline
                data={[70, 75, 80, 85, 90]}
                width={150}
                height={50}
                colorScheme="danger"
                label="Danger"
              />
              <TrendSparkline
                data={[70, 75, 80, 85, 90]}
                width={150}
                height={50}
                colorScheme="neutral"
                label="Neutral"
              />
            </div>
          </div>
        </motion.section>

        {/* Section 3: ActivityHeatmap */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              🗓️ Activity Heatmap
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              GitHub-style contribution calendar showing daily study intensity
            </p>
          </div>

          <ActivityHeatmap performanceData={sampleData} weeks={13} />

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>💡 Tip:</strong> Click on any day to see detailed statistics including
              questions answered, accuracy, average time, and system breakdown for that day.
            </p>
          </div>
        </motion.section>

        {/* Section 4: Combined Dashboard Example */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 shadow-xl"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              🎨 Combined Dashboard Preview
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              How all components work together in your Statistics tab
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Recent Form Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Recent Form
                </span>
                <span className="text-xl font-bold text-green-500">+8%</span>
              </div>
              <TrendSparkline
                data={sparklineData}
                width={200}
                height={50}
                colorScheme="auto"
                showTrend={false}
                showValue={false}
              />
            </div>

            {/* Streak Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg text-center">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 block mb-2">
                Active Streak
              </span>
              <div className="text-5xl font-bold text-orange-500">15</div>
              <span className="text-xs text-slate-500 dark:text-slate-400">questions in a row</span>
            </div>

            {/* Accuracy Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg flex items-center justify-center">
              <RadialProgress
                value={accuracyValue}
                size={120}
                strokeWidth={10}
                showValue={true}
                label="Overall Accuracy"
              />
            </div>
          </div>
        </motion.section>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center space-y-2 pb-8"
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            All components are <strong>theme-aware</strong>, <strong>mobile-responsive</strong>, and{' '}
            <strong>accessibility-compliant</strong>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Built with React, TypeScript, Framer Motion, and pure SVG • Zero external chart
            libraries
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default VisualizationDemoPage;
