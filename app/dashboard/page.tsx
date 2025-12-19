import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  BookA,
  CreditCard,
} from 'lucide-react';
import { DecayCurve } from '../../components/dashboard/charts/DecayCurve';
import { StabilityPyramid } from '../../components/dashboard/charts/StabilityPyramid';

// ============================================================================
// Types
// ============================================================================

interface RetentionData {
  dueCount: number;
  totalCards: number;
  decayCurveData: { day: number; retentionProb: number }[];
  stabilityBuckets: { bucket: string; count: number; color: string }[];
  lastTuned?: string;
  tuningReason?: string;
  adjustment?: 'tighten' | 'loosen';
}

// ============================================================================
// Data Fetcher
// ============================================================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch retention data');
  const json = await res.json();
  return json.data || json;
};

// ============================================================================
// Skeleton Loaders
// ============================================================================

const ChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
    <div className="h-5 bg-gray-100 rounded w-1/3 mb-2" />
    <div className="h-4 bg-gray-100 rounded w-2/3 mb-6" />
    <div className="h-64 bg-gray-100 rounded" />
  </div>
);

// ============================================================================
// Priority Action Card (Hero)
// ============================================================================

interface PriorityActionCardProps {
  dueCount: number;
  onNavigate: (path: string) => void;
}

const PriorityActionCard: React.FC<PriorityActionCardProps> = ({ dueCount, onNavigate }) => {
  const hasDue = dueCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`
        relative overflow-hidden rounded-2xl border p-8
        ${hasDue
          ? 'bg-blue-50 border-blue-200'
          : 'bg-emerald-50 border-emerald-200'
        }
      `}
    >
      {/* Background Gradient */}
      <div className={`
        absolute inset-0 opacity-10
        ${hasDue
          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
          : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
        }
      `} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {hasDue ? (
              <AlertCircle className="w-8 h-8 text-blue-600" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            )}
            <div>
              <h2 className={`text-2xl font-bold ${hasDue ? 'text-blue-900' : 'text-emerald-900'}`}>
                {hasDue ? 'Retention Protocol Active' : 'All Protocols Current'}
              </h2>
              <p className={`text-sm mt-1 ${hasDue ? 'text-blue-700' : 'text-emerald-700'}`}>
                {hasDue
                  ? `${dueCount} ${dueCount === 1 ? 'card requires' : 'cards require'} review to maintain stability.`
                  : 'Your knowledge base is stable. Continue building mastery.'
                }
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate(hasDue ? '/education/adaptive' : '/education/qbank')}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-semibold
            transition-all duration-200
            ${hasDue
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25'
            }
          `}
        >
          {hasDue ? 'Start Adaptive Session' : 'Launch Question Bank'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Quick Access Grid
// ============================================================================

interface QuickAccessProps {
  onNavigate: (path: string) => void;
}

const QuickAccessGrid: React.FC<QuickAccessProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate(`/reference?q=${encodeURIComponent(searchQuery)}`);
    } else {
      onNavigate('/reference');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Clinical Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 p-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Clinical Search</h3>
        </div>
        <form onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conditions, drugs..."
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400"
          />
        </form>
      </motion.div>

      {/* Daily Terminology */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        onClick={() => onNavigate('/skills/terminology')}
        className="bg-white rounded-2xl border border-gray-200 p-6 cursor-pointer
                 hover:border-purple-300 hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-center gap-2 mb-3">
          <BookA className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Daily Terminology</h3>
        </div>
        <p className="text-sm text-gray-600">Quick drill to strengthen medical vocabulary</p>
      </motion.div>

      {/* Subscription Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        onClick={() => onNavigate('/settings')}
        className="bg-white rounded-2xl border border-gray-200 p-6 cursor-pointer
                 hover:border-emerald-300 hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Subscription Status</h3>
        </div>
        <p className="text-sm text-gray-600">Manage your plan and billing</p>
      </motion.div>
    </div>
  );
};

// ============================================================================
// Main Dashboard Page
// ============================================================================

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { data, error, isLoading } = useSWR<RetentionData>('/api/stats/retention', fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true,
  });

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  // Format current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-zinc-200 rounded w-1/3 animate-pulse mb-2" />
          <div className="h-6 bg-zinc-200 rounded w-1/4 animate-pulse mb-8" />
          <div className="h-48 bg-white rounded-2xl border border-zinc-200 animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Unable to load dashboard data</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ===== HEADER SECTION ===== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-zinc-900 mb-1">
            Welcome back, {user?.firstName || 'Student'}.
          </h1>
          <p className="text-zinc-600 text-sm">{currentDate}</p>
        </motion.div>

        {/* ===== PRIORITY ACTION CARD ===== */}
        <PriorityActionCard dueCount={data.dueCount} onNavigate={handleNavigate} />

        {/* ===== ANALYTICS ROW (THE "VITALS") ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Decay Curve Chart */}
          <Suspense fallback={<ChartSkeleton />}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white rounded-2xl border border-gray-200 p-6"
            >
              <div className="mb-6">
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Projected Retention</h3>
                <p className="text-sm text-zinc-600">
                  Estimated recall probability over 30 days.
                </p>
              </div>
              <DecayCurve data={data.decayCurveData} />
            </motion.div>
          </Suspense>

          {/* Stability Pyramid Chart */}
          <Suspense fallback={<ChartSkeleton />}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-white rounded-2xl border border-gray-200 p-6"
            >
              <div className="mb-6">
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Knowledge Stability</h3>
                <p className="text-sm text-zinc-600">
                  Distribution of mastered vs. developing concepts.
                </p>
              </div>
              <StabilityPyramid data={data.stabilityBuckets} />
            </motion.div>
          </Suspense>
        </div>

        {/* ===== QUICK ACCESS GRID ===== */}
        <QuickAccessGrid onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
