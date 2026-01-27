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
  Zap,
  Target,
} from 'lucide-react';
import DecayCurve from './charts/DecayCurve';
import StabilityPyramid from './charts/StabilityPyramid';
import AlgorithmStatusWidget from './AlgorithmStatusWidget';
import { ClinicalSkeleton } from '../ui/ClinicalSkeleton';
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
// Quick Stat Card Component - Enhanced Design
// ============================================================================

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean };
  accentColor: string;
  delay?: number;
}

const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, trend, accentColor, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    className="group relative bg-[var(--color-bg-primary)] dark:bg-slate-900/80 backdrop-blur-sm border border-[var(--color-border)] dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-[var(--color-accent)]/30 transition-all duration-300"
  >
    {/* Gradient accent line */}
    <div className={`absolute top-0 left-6 right-6 h-0.5 ${accentColor} rounded-full opacity-60 group-hover:opacity-100 transition-opacity`} />
    
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${accentColor.replace('bg-gradient-to-r', 'bg-opacity-15')} bg-slate-100 dark:bg-slate-800/60`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] dark:text-slate-400 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white tracking-tight">{value}</p>
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
          trend.isPositive 
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          <TrendingUp className={`w-3 h-3 ${!trend.isPositive && 'rotate-180'}`} />
          {trend.value}%
        </div>
      )}
    </div>
  </motion.div>
);

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, icon, action }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      {icon && (
        <div className="p-2 bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/20 rounded-xl">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--color-text-secondary)] dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <ClinicalSkeleton variant="compact" lines={2} className="w-1/3 mb-4 min-h-[80px]" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[120px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[120px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[120px]" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClinicalSkeleton lines={8} className="min-h-[320px]" />
            <ClinicalSkeleton lines={8} className="min-h-[320px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-[var(--color-bg-primary)] dark:bg-slate-800/80 rounded-2xl p-8 shadow-lg border border-[var(--color-border)]"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Zap className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-[var(--color-text-primary)] dark:text-white font-semibold mb-2">Failed to load dashboard</p>
          <p className="text-[var(--color-text-secondary)] dark:text-slate-400 text-sm mb-4">Unable to retrieve your study data</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  const mockStreak = 7; // Replace with actual streak data
  const mockCardsLearned = data.totalCards;
  const mockPANCEPredictor = 78; // Placeholder

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ===== HEADER SECTION - Enhanced with gradient text ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pt-2"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-blue-600 shadow-lg shadow-blue-500/20">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] dark:text-white">
                {getGreeting()}, <span className="bg-gradient-to-r from-[var(--color-accent)] to-blue-500 bg-clip-text text-transparent">{user?.firstName || 'Student'}</span>
              </h1>
              <p className="text-[var(--color-text-secondary)] dark:text-slate-400 text-sm md:text-base">Your cognitive command center — let's make progress today.</p>
            </div>
          </div>
        </motion.div>

        {/* ===== QUICK STATS ROW - Enhanced with trends ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickStat
            icon={<Flame className="w-5 h-5 text-orange-500" />}
            label="Day Streak"
            value={mockStreak}
            trend={{ value: 14, isPositive: true }}
            accentColor="bg-gradient-to-r from-orange-400 to-amber-500"
            delay={0}
          />
          <QuickStat
            icon={<BookOpen className="w-5 h-5 text-blue-500" />}
            label="Cards Learned"
            value={mockCardsLearned}
            accentColor="bg-gradient-to-r from-blue-400 to-cyan-500"
            delay={0.1}
          />
          <QuickStat
            icon={<Award className="w-5 h-5 text-emerald-500" />}
            label="PANCE Predictor"
            value={`${mockPANCEPredictor}%`}
            trend={{ value: 3, isPositive: true }}
            accentColor="bg-gradient-to-r from-emerald-400 to-teal-500"
            delay={0.2}
          />
        </div>

        {/* ===== ROLLING 360 EXAM READINESS (HERO) ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Exam Readiness Card with Start Session Button */}
            <ExamReadinessCard />

            {/* Right: System Performance Widget */}
            <SystemPerformanceWidget maxSystems={5} />
          </div>
        </motion.div>

        {/* ===== ALGORITHM STATUS & REVIEW ROW ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Smart Review Card - Enhanced */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="group bg-[var(--color-bg-primary)] dark:bg-slate-900/80 backdrop-blur-sm border border-[var(--color-border)] dark:border-slate-700/50 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-[var(--color-accent)]/30 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] dark:text-white">
                  {data.dueCount > 0 ? 'FSRS Review Queue' : 'All Caught Up'}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] dark:text-slate-400">
                  {data.dueCount > 0
                    ? `${data.dueCount} cards ready for spaced review`
                    : 'No cards due right now — great work!'}
                </p>
              </div>
            </div>
            
            {data.dueCount > 0 && (
              <>
                {/* Progress indicator */}
                <div className="mb-4">
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((data.dueCount / 50) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    />
                  </div>
                </div>
                
                <button
                  onClick={() => handleNavigation('/study/smart-review')}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 group-hover:scale-[1.02]"
                >
                  Start Review
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}
            
            {data.dueCount === 0 && (
              <div className="text-center py-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">You're up to date!</p>
              </div>
            )}
          </motion.div>

          {/* Right: Algorithm Status */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <AlgorithmStatusWidget
              lastTuned={new Date(data.lastTuned)}
              reason={data.tuningReason}
              adjustment={data.adjustment}
            />
          </motion.div>
        </div>

        {/* ===== COGNITIVE HEALTH ROW (CHARTS) ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <SectionHeader 
            title="Memory Health" 
            subtitle="Track your retention and stability over time"
            icon={<TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Decay Curve */}
            <div className="bg-[var(--color-bg-primary)] dark:bg-slate-900/80 backdrop-blur-sm border border-[var(--color-border)] dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
              <DecayCurve data={data.decayCurveData} />
            </div>

            {/* Right: Stability Pyramid */}
            <div className="bg-[var(--color-bg-primary)] dark:bg-slate-900/80 backdrop-blur-sm border border-[var(--color-border)] dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
              <StabilityPyramid data={data.stabilityBuckets} />
            </div>
          </div>
        </motion.div>

        {/* ===== DAILY PRACTICE ROW - Enhanced cards ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          <SectionHeader 
            title="Daily Practice" 
            subtitle="Quick drills to sharpen your skills"
            icon={<Zap className="w-5 h-5 text-[var(--color-accent)]" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Medical Wordle Card */}
            <button
              onClick={() => handleNavigation('/drills/wordle')}
              className="group relative bg-[var(--color-bg-primary)] dark:bg-slate-900/80 backdrop-blur-sm border border-[var(--color-border)] dark:border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 w-full text-left overflow-hidden"
            >
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] dark:text-white">
                  Medical Wordle
                </h3>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] dark:text-slate-400 mb-4">
                Guess the medical term in 6 tries
              </p>
              <div className="flex items-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold group-hover:gap-2 transition-all">
                Play Now
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Rapid Recall Card */}
            <button
              onClick={() => handleNavigation('/drills/rapid')}
              className="group relative bg-[var(--color-bg-primary)] dark:bg-slate-900/80 backdrop-blur-sm border border-[var(--color-border)] dark:border-slate-700/50 rounded-2xl p-6 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 w-full text-left overflow-hidden"
            >
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] dark:text-white">
                  Rapid Recall
                </h3>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] dark:text-slate-400 mb-4">
                Quick-fire questions to test your speed
              </p>
              <div className="flex items-center text-amber-600 dark:text-amber-400 text-sm font-semibold group-hover:gap-2 transition-all">
                Start Drill
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Daily Triad */}
            <DailyTriad />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
