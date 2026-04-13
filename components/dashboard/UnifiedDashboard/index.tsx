import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useAuth } from '@clerk/clerk-react';
import useSWR from 'swr';
import {
  Brain,
  TrendingUp,
  Flame,
  ArrowRight,
  Sparkles,
  Clock,
  Zap,
  Target,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';
import Card from './Card';
import CardGrid from './CardGrid';
import DailyTriad from '../DailyTriad';
import DailyLoadWidget from '../DailyLoadWidget';
import ErrorPatternWidget from '../ErrorPatternWidget';
import LearnerInsightsCard from '../LearnerInsightsCard';
import DataView from './DataView';
import {
  ExamReadinessCard,
  SystemPerformanceWidget,
} from '../Rolling360';

const DASHBOARD_VIEW_KEY = 'pancea_dashboard_view';

export type DashboardViewId = 'pilot' | 'data';

const DASHBOARD_VIEWS: Array<{
  id: DashboardViewId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  subtitle: string;
}> = [
  {
    id: 'pilot',
    label: 'Daily Pilot',
    shortLabel: 'Pilot',
    icon: Zap,
    subtitle: 'Action — Streak, due reviews, daily goal',
  },
  {
    id: 'data',
    label: 'Data Scientist',
    shortLabel: 'Data',
    icon: BarChart3,
    subtitle: 'Analysis — Radars, heatmaps, trends',
  },
];

interface RetentionData {
  dueCount: number;
  totalCards: number;
  decayCurveData: { day: number; retentionProb: number }[];
  stabilityBuckets: { bucket: string; count: number; color: string }[];
  lastTuned: string;
  tuningReason: string;
  adjustment: 'tighten' | 'loosen';
}

function createRetentionFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<RetentionData> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = (await res.json()) as { data?: RetentionData };
    return data.data as RetentionData;
  };
}

const PilotView = () => {
  return (
    <CardGrid>
      <div className="lg:col-span-1">
        <Card>
          <DailyLoadWidget />
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <ExamReadinessCard />
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card>
          <DailyTriad />
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card>
          <ErrorPatternWidget />
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card>
          <LearnerInsightsCard />
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card>
          <SystemPerformanceWidget />
        </Card>
      </div>
    </CardGrid>
  );
};

const UnifiedDashboard = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const retentionFetcher = useCallback(createRetentionFetcher(getToken), [getToken]);
  const { data, error, isLoading } = useSWR<RetentionData>(
    user ? '/api/stats/retention' : null,
    retentionFetcher
  );
  const [view, setView] = useState<DashboardViewId>(() => {
    if (typeof window === 'undefined') return 'pilot';
    const stored = localStorage.getItem(DASHBOARD_VIEW_KEY);
    return stored === 'data' ? 'data' : 'pilot';
  });

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading data</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-primary)] via-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ===== HEADER SECTION - Enhanced with gradient text ===== */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pt-2"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg bg-[var(--color-accent)]/15">
              <Target className="w-6 h-6 text-[var(--color-text-inverse)]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] truncate max-w-full">
                {getGreeting()},{' '}
                <span className="bg-[var(--color-accent)] bg-clip-text text-transparent">
                  {user?.firstName || 'Student'}
                </span>
              </h1>
              <p className="text-sm md:text-base text-[var(--color-text-secondary)]">
                Here’s your personalized learning dashboard.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ===== VIEW TOGGLE ===== */}
        <div className="flex justify-center">
          <div className="bg-[var(--color-bg-secondary)] p-1 rounded-lg" style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            {DASHBOARD_VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === v.id
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <v.icon className="w-4 h-4" />
                  <span>{v.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ===== DASHBOARD GRID ===== */}
        {view === 'pilot' ? <PilotView /> : <DataView />}
      </div>
    </div>
  );
};

export default UnifiedDashboard;
