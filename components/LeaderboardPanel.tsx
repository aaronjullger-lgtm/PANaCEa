/**
 * Leaderboard Panel Component
 * Shows peer comparison with optional anonymous mode
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Award, Medal, Crown, Target, Zap } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  username: string;
  isCurrentUser: boolean;
  questionsAnswered: number;
  accuracy: number;
  streak: number;
  score: number; // Composite score
}

interface LeaderboardPanelProps {
  currentUserStats: {
    questionsAnswered: number;
    accuracy: number;
    streak: number;
  };
  onClose: () => void;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  currentUserStats,
  onClose,
}) => {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'alltime'>('week');
  
  // Mock data - In production, this would come from your backend
  const generateLeaderboardData = (): LeaderboardEntry[] => {
    const currentUserScore = 
      currentUserStats.questionsAnswered * 1 +
      currentUserStats.accuracy * 100 +
      currentUserStats.streak * 10;
    
    // Generate mock data for demonstration
    const mockEntries: LeaderboardEntry[] = [];
    
    // Add current user
    mockEntries.push({
      rank: 0, // Will be calculated
      username: 'You',
      isCurrentUser: true,
      questionsAnswered: currentUserStats.questionsAnswered,
      accuracy: currentUserStats.accuracy,
      streak: currentUserStats.streak,
      score: currentUserScore,
    });
    
    // Add mock competitors
    for (let i = 0; i < 19; i++) {
      const baseScore = 5000 + Math.random() * 3000;
      const variance = Math.random() * 500 - 250;
      const score = Math.floor(baseScore + variance);
      
      mockEntries.push({
        rank: 0,
        username: `User${String(i + 1).padStart(3, '0')}`,
        isCurrentUser: false,
        questionsAnswered: Math.floor(score / 2.5),
        accuracy: 0.65 + Math.random() * 0.3,
        streak: Math.floor(Math.random() * 30),
        score,
      });
    }
    
    // Sort by score and assign ranks
    mockEntries.sort((a, b) => b.score - a.score);
    mockEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    
    return mockEntries;
  };
  
  const leaderboard = generateLeaderboardData();
  const currentUserEntry = leaderboard.find(e => e.isCurrentUser);
  const topTen = leaderboard.slice(0, 10);
  
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-slate-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return null;
  };
  
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-slate-400';
    if (rank === 3) return 'text-amber-600';
    return 'text-slate-500';
  };
  
  const getPercentile = (rank: number, total: number) => {
    return Math.round((1 - (rank - 1) / total) * 100);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Leaderboard</h2>
                <p className="text-purple-100 text-sm">See how you stack up</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-2xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            {[
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'alltime', label: 'All Time' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeframe(option.value as any)}
                className={`
                  flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200
                  ${timeframe === option.value
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Current User Stats */}
        {currentUserEntry && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Your Rank</div>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${getRankColor(currentUserEntry.rank)}`}>
                    #{currentUserEntry.rank}
                  </span>
                  <div className="text-sm">
                    <div className="text-slate-600 dark:text-slate-400">
                      Top {getPercentile(currentUserEntry.rank, leaderboard.length)}%
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {currentUserEntry.questionsAnswered}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Questions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {Math.round(currentUserEntry.accuracy * 100)}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Accuracy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {currentUserEntry.streak}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Streak</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Leaderboard List */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {topTen.map((entry, index) => (
              <motion.div
                key={entry.username}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                  ${entry.isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="w-12 flex items-center justify-center">
                    {getRankIcon(entry.rank) || (
                      <span className={`text-xl font-bold ${getRankColor(entry.rank)}`}>
                        #{entry.rank}
                      </span>
                    )}
                  </div>
                  
                  {/* Username */}
                  <div className="flex-1">
                    <div className={`font-semibold ${entry.isCurrentUser ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>
                      {entry.username}
                      {entry.isCurrentUser && (
                        <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {entry.questionsAnswered}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {Math.round(entry.accuracy * 100)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {entry.streak}d
                      </span>
                    </div>
                  </div>
                  
                  {/* Score */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {entry.score.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">points</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Footer Note */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Users className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Leaderboard is anonymous and updated daily. Score is calculated from questions answered, 
              accuracy, and study streak. Keep studying to climb higher!
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LeaderboardPanel;
