import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ImageIcon, 
  GitCompare, 
  Trophy, 
  Timer, 
  Target, 
  TrendingUp,
  Calendar,
  Brain,
  Zap,
  Award,
  BarChart3,
  ArrowRight,
  Lock
} from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

/**
 * DrillHub - Central navigation for all drill modes
 * 
 * Features:
 * - Photo Drill (Dermatology/Radiology rapid fire)
 * - DDx Compare (Contrastive learning)
 * - Daily Wordle (Medical terminology)
 * - Drill statistics dashboard
 * - Achievement tracking
 * 
 * Architectural Constraints:
 * - All stats are isolated (isMainSession = false)
 * - Database-first (no static content)
 * - React 19 patterns
 */

interface DrillMode {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  route: string;
  isAvailable: boolean;
  stats?: {
    totalAttempts: number;
    accuracy: number;
    avgTimeMs: number;
  };
}

interface DrillOverview {
  totalSessions: number;
  totalAttempts: number;
  overallAccuracy: number;
  currentStreak: number;
  bestStreak: number;
  recentActivity: Array<{
    date: string;
    drillType: string;
    accuracy: number;
    attempts: number;
  }>;
}

export default function DrillHub(): JSX.Element {
  const { user } = useUser();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<DrillOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  // Fetch drill overview on mount
  useEffect(() => {
    if (!user?.id) return;

    const fetchOverview = async () => {
      try {
        const response = await fetch('/api/drill/overview');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setOverview(data);
      } catch (error) {
        console.error('Failed to fetch drill overview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [user?.id]);

  const drillModes: DrillMode[] = [
    {
      id: 'photo-drill',
      name: 'Photo Drill',
      description: 'Rapid-fire image recognition for Dermatology and Radiology',
      icon: ImageIcon,
      color: 'from-blue-500 to-cyan-500',
      route: '/drill/photo',
      isAvailable: true,
      stats: overview ? {
        totalAttempts: overview.recentActivity
          .filter(a => a.drillType === 'photo_drill')
          .reduce((sum, a) => sum + a.attempts, 0),
        accuracy: overview.recentActivity
          .filter(a => a.drillType === 'photo_drill')
          .reduce((sum, a) => sum + a.accuracy, 0) / 
          overview.recentActivity.filter(a => a.drillType === 'photo_drill').length || 0,
        avgTimeMs: 3200, // TODO: Calculate from actual data
      } : undefined,
    },
    {
      id: 'ddx-compare',
      name: 'DDx Compare',
      description: 'Differential diagnosis contrastive learning with drag-and-drop',
      icon: GitCompare,
      color: 'from-purple-500 to-pink-500',
      route: '/drill/contrastive',
      isAvailable: true,
      stats: overview ? {
        totalAttempts: overview.recentActivity
          .filter(a => a.drillType === 'contrastive_drill')
          .reduce((sum, a) => sum + a.attempts, 0),
        accuracy: overview.recentActivity
          .filter(a => a.drillType === 'contrastive_drill')
          .reduce((sum, a) => sum + a.accuracy, 0) / 
          overview.recentActivity.filter(a => a.drillType === 'contrastive_drill').length || 0,
        avgTimeMs: 45000, // TODO: Calculate from actual data
      } : undefined,
    },
    {
      id: 'daily-wordle',
      name: 'Daily Wordle',
      description: 'Medical terminology puzzle - one challenge per day',
      icon: Calendar,
      color: 'from-green-500 to-emerald-500',
      route: '/drill/wordle',
      isAvailable: false, // Phase 3.5
      stats: {
        totalAttempts: 0,
        accuracy: 0,
        avgTimeMs: 0,
      },
    },
  ];

  const startDrill = (mode: DrillMode) => {
    if (!mode.isAvailable) return;
    setSelectedMode(mode.id);
    setTimeout(() => {
      navigate(mode.route);
    }, 300);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-blue-400 animate-pulse mx-auto mb-4" />
          <p className="text-slate-300">Loading Drill Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-12 h-12 text-yellow-400" />
            <h1 className="text-5xl font-bold text-white">Drill & Kill</h1>
          </div>
          <p className="text-xl text-slate-300">
            High-intensity active recall training modes
          </p>
          <p className="text-sm text-slate-400 mt-2">
            ⚠️ Drill stats are isolated from FSRS optimization (isMainSession = false)
          </p>
        </motion.div>

        {/* Overview Stats */}
        {overview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12"
          >
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <span className="text-slate-300 text-sm">Total Sessions</span>
              </div>
              <p className="text-3xl font-bold text-white">{overview.totalSessions}</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-6 h-6 text-green-400" />
                <span className="text-slate-300 text-sm">Overall Accuracy</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {(overview.overallAccuracy * 100).toFixed(1)}%
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-blue-400" />
                <span className="text-slate-300 text-sm">Current Streak</span>
              </div>
              <p className="text-3xl font-bold text-white">{overview.currentStreak} days</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-6 h-6 text-purple-400" />
                <span className="text-slate-300 text-sm">Best Streak</span>
              </div>
              <p className="text-3xl font-bold text-white">{overview.bestStreak} days</p>
            </div>
          </motion.div>
        )}

        {/* Drill Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {drillModes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: mode.isAvailable ? 1.02 : 1 }}
              className={`
                relative rounded-2xl p-8 border-2 transition-all duration-300
                ${mode.isAvailable 
                  ? 'bg-gradient-to-br ' + mode.color + ' border-transparent cursor-pointer hover:shadow-2xl' 
                  : 'bg-slate-800/30 border-slate-700 opacity-60'
                }
              `}
              onClick={() => mode.isAvailable && startDrill(mode)}
            >
              {/* Lock overlay for unavailable modes */}
              {!mode.isAvailable && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-2xl">
                  <div className="text-center">
                    <Lock className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-300 font-medium">Coming Soon</p>
                    <p className="text-slate-400 text-sm">Phase 3.5</p>
                  </div>
                </div>
              )}

              {/* Mode Icon */}
              <div className="mb-6">
                <mode.icon className="w-16 h-16 text-white" />
              </div>

              {/* Mode Info */}
              <h3 className="text-2xl font-bold text-white mb-2">{mode.name}</h3>
              <p className="text-white/90 text-sm mb-6">{mode.description}</p>

              {/* Stats */}
              {mode.stats && mode.isAvailable && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-white/80 text-sm">
                    <span>Attempts</span>
                    <span className="font-bold">{mode.stats.totalAttempts}</span>
                  </div>
                  <div className="flex items-center justify-between text-white/80 text-sm">
                    <span>Accuracy</span>
                    <span className="font-bold">{(mode.stats.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-white/80 text-sm">
                    <span>Avg Time</span>
                    <span className="font-bold">
                      {mode.stats.avgTimeMs >= 60000
                        ? `${(mode.stats.avgTimeMs / 60000).toFixed(1)}m`
                        : `${(mode.stats.avgTimeMs / 1000).toFixed(1)}s`
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Start Button */}
              {mode.isAvailable && (
                <motion.button
                  whileHover={{ x: 5 }}
                  className="flex items-center gap-2 text-white font-medium group"
                >
                  Start Drill
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              )}

              {/* Selected animation */}
              <AnimatePresence>
                {selectedMode === mode.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white dark:bg-slate-600 rounded-2xl"
                  />
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Recent Activity */}
        {overview && overview.recentActivity.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700"
          >
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
            </div>

            <div className="space-y-4">
              {overview.recentActivity.slice(0, 5).map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <div>
                      <p className="text-white font-medium">
                        {activity.drillType === 'photo_drill' ? 'Photo Drill' : 'DDx Compare'}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {new Date(activity.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">
                      {(activity.accuracy * 100).toFixed(1)}%
                    </p>
                    <p className="text-slate-400 text-sm">
                      {activity.attempts} attempts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Info Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <Brain className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-white font-bold mb-2">How Drill Modes Work</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Drill modes are designed for rapid active recall training. Unlike your main study sessions,
                drill attempts are <strong>statistically isolated</strong> and do not affect your FSRS v6 
                optimization or Rolling 360 stats. This allows you to practice freely without worrying about 
                "polluting" your spaced repetition algorithm with rapid-fire attempts.
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
