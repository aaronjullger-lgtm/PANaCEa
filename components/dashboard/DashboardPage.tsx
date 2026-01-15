import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import useSWR from 'swr';
import {
  Brain,
  TrendingUp,
  Flame,
  BookOpen,
  Award,
  ArrowRight,
  Sparkles,
  Clock,
} from 'lucide-react';
import DecayCurve from './charts/DecayCurve';
import StabilityPyramid from './charts/StabilityPyramid';
import AlgorithmStatusWidget from './AlgorithmStatusWidget';
import ClinicalSkeleton from '../ui/ClinicalSkeleton';
import DailyTriad from './DailyTriad';
import { ExamReadinessCard, SystemPerformanceWidget } from './Rolling360';

// ============================================================================
// Types
// ============================================================================

interface RetentionData {
  dueCount: number;
  totalCards: number;
  decayCurveData: { day: number; retentionProb: number }[];
  stabilityBuckets: { bucket: string; count: number; color: string }[];
  lastTuned: string;
  tuningReason: string;
  adjustment: 'tighten' | 'loosen';
}

// ============================================================================
// Data Fetcher
// ============================================================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.data as RetentionData;
};

// ============================================================================
// Quick Stat Card Component
// ============================================================================

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  delay?: number;
}

const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay }}
    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm"
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 ${color} rounded-lg`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  </motion.div>
);

// ============================================================================
// Main Dashboard Component
// ============================================================================

interface DashboardPageProps {
  onNavigate?: (view: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useUser();
  const { data, error, isLoading } = useSWR<RetentionData>('/api/stats/retention', fetcher);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <ClinicalSkeleton
            variant="compact"
            lines={2}
            className="w-1/3 mb-4 min-h-[64px]"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[140px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[140px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[140px]" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClinicalSkeleton lines={6} className="min-h-[260px]" />
            <ClinicalSkeleton lines={6} className="min-h-[260px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Failed to load dashboard data</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const mockStreak = 7; // Replace with actual streak data
  const mockCardsLearned = data.totalCards;
  const mockPANCEPredictor = 78; // Placeholder

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ===== HEADER SECTION ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {getGreeting()}, {user?.firstName || 'Student'}.
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Here's your cognitive command center.
          </p>
        </motion.div>

        {/* ===== QUICK STATS ROW ===== */}
        {/* Stormy Slate Design System: Icons use muted slate, data colors only for pass/fail */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickStat
            icon={<Flame className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
            label="Day Streak"
            value={mockStreak}
            color="bg-slate-100 dark:bg-slate-800/50"
            delay={0}
          />
          <QuickStat
            icon={<BookOpen className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
            label="Cards Learned"
            value={mockCardsLearned}
            color="bg-slate-100 dark:bg-slate-800/50"
            delay={0.1}
          />
          <QuickStat
            icon={<Award className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
            label="PANCE Predictor"
            value={`${mockPANCEPredictor}%`}
            color="bg-slate-100 dark:bg-slate-800/50"
            delay={0.2}
          />
        </div>

        {/* ===== ROLLING 360 EXAM READINESS (HERO) ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Exam Readiness Card with Start Session Button */}
          <ExamReadinessCard />

          {/* Right: System Performance Widget */}
          <SystemPerformanceWidget maxSystems={5} />
        </div>

        {/* ===== ALGORITHM STATUS & REVIEW ROW ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Smart Review Card (Legacy) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {data.dueCount > 0 ? 'FSRS Review Queue' : 'All Caught Up'}
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              {data.dueCount > 0
                ? `${data.dueCount} cards due for spaced review`
                : 'No FSRS cards due right now.'}
            </p>
            {data.dueCount > 0 && (
              <button
                onClick={() => handleNavigation('/study/smart-review')}
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
              >
                Start Review
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>

          {/* Right: Algorithm Status */}
          <AlgorithmStatusWidget
            lastTuned={new Date(data.lastTuned)}
            reason={data.tuningReason}
            adjustment={data.adjustment}
          />
        </div>

        {/* ===== COGNITIVE HEALTH ROW (CHARTS) ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Decay Curve */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <DecayCurve data={data.decayCurveData} />
          </div>

          {/* Right: Stability Pyramid */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <StabilityPyramid data={data.stabilityBuckets} />
          </div>
        </div>

        {/* ===== DAILY PRACTICE ROW ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Daily Practice
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => handleNavigation('/drills/wordle')}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md w-full text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Medical Wordle
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Guess the medical term in 6 tries
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
                Play Now
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => handleNavigation('/drills/rapid')}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md w-full text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Rapid Recall
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Quick-fire questions to test your speed
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
                Start Drill
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <DailyTriad />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
