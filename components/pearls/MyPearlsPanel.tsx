/**
 * My Pearls Panel - Sprint 8: Pearl UI
 *
 * Displays user's clinical pearls as reviewable flashcards with:
 * - Flip-card animation for reveal
 * - "Mark as Mastered" and "Review Later" buttons
 * - Simple SRS scheduling (3-day intervals)
 * - Filtering by system and mastery status
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Gem,
  X,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Brain,
  Star,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { syncManager } from '../../lib/services/sync/syncManager';
import './pearls.css';

// Types
interface UserInteraction {
  isSaved: boolean;
  markedUseful: boolean;
  viewedAt?: string;
  notes?: string;
  // SRS fields (added by frontend)
  nextReviewDate?: string;
  mastered?: boolean;
}

interface ClinicalPearl {
  id: string;
  pearlText: string;
  system: string;
  category?: string;
  tags: string[];
  fullExplanation?: string;
  viewCount: number;
  usefulVotes: number;
  userInteraction?: UserInteraction;
}

interface MyPearlsPanelProps {
  onClose: () => void;
  initialFilter?: 'all' | 'saved' | 'due';
}

// SRS storage key prefix
const PEARL_SRS_KEY = 'panceai_pearl_srs';

// Get SRS data from localStorage
function getPearlSRSData(pearlId: string): { nextReviewDate?: string; mastered?: boolean } {
  try {
    const data = localStorage.getItem(`${PEARL_SRS_KEY}_${pearlId}`);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save SRS data to localStorage
function savePearlSRSData(pearlId: string, data: { nextReviewDate?: string; mastered?: boolean }) {
  try {
    localStorage.setItem(`${PEARL_SRS_KEY}_${pearlId}`, JSON.stringify(data));
    // Also queue for sync when online
    syncManager.queuePearlAction({
      pearlId,
      action: data.mastered ? 'mark_mastered' : 'review_later',
      scheduledReviewDate: data.nextReviewDate,
    });
  } catch (e) {
    console.warn('[MyPearlsPanel] Failed to save SRS data:', e);
  }
}

// Calculate next review date (simple 3-day interval)
function getNextReviewDate(daysFromNow: number = 3): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

// Check if pearl is due for review
function isDueForReview(nextReviewDate?: string): boolean {
  if (!nextReviewDate) return true; // Never scheduled = due now
  return new Date(nextReviewDate) <= new Date();
}

export const MyPearlsPanel: React.FC<MyPearlsPanelProps> = ({ onClose, initialFilter = 'all' }) => {
  const { getToken } = useAuth();
  const [pearls, setPearls] = useState<ClinicalPearl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filter, setFilter] = useState<'all' | 'saved' | 'due'>(initialFilter);
  const [systemFilter, setSystemFilter] = useState<string | null>(null);

  // Fetch user's pearls
  const fetchPearls = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch('/api/user/pearls', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pearls');
      }

      const data = await response.json();

      // Merge with local SRS data
      const pearlsWithSRS = (data.pearls || []).map((pearl: ClinicalPearl) => ({
        ...pearl,
        userInteraction: {
          ...pearl.userInteraction,
          ...getPearlSRSData(pearl.id),
        },
      }));

      setPearls(pearlsWithSRS);
    } catch (err) {
      console.error('[MyPearlsPanel] Fetch error:', err);
      setError('Unable to load pearls. Please try again.');
      // Fallback to mock data for development
      if (import.meta.env.VITE_USE_MOCK === 'true') {
        setPearls(MOCK_PEARLS);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchPearls();
  }, [fetchPearls]);

  // Get unique systems for filter
  const systems = useMemo(() => {
    const systemSet = new Set(pearls.map((p) => p.system));
    return Array.from(systemSet).sort((a, b) => a.localeCompare(b));
  }, [pearls]);

  // Filter pearls
  const filteredPearls = useMemo(() => {
    return pearls.filter((pearl) => {
      // System filter
      if (systemFilter && pearl.system !== systemFilter) return false;

      // Status filter
      if (filter === 'saved' && !pearl.userInteraction?.isSaved) return false;
      if (filter === 'due') {
        if (pearl.userInteraction?.mastered) return false;
        if (!isDueForReview(pearl.userInteraction?.nextReviewDate)) return false;
      }

      return true;
    });
  }, [pearls, filter, systemFilter]);

  // Current pearl
  const currentPearl = filteredPearls[currentIndex];

  // Navigation
  const goNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredPearls.length);
  };

  const goPrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredPearls.length) % filteredPearls.length);
  };

  // Mark as mastered
  const markAsMastered = async () => {
    if (!currentPearl) return;

    // Update local state with proper defaults
    setPearls((prev) =>
      prev.map((p): ClinicalPearl =>
        p.id === currentPearl.id
          ? {
              ...p,
              userInteraction: {
                isSaved: p.userInteraction?.isSaved ?? false,
                markedUseful: true,
                viewedAt: p.userInteraction?.viewedAt,
                notes: p.userInteraction?.notes,
                nextReviewDate: p.userInteraction?.nextReviewDate,
                mastered: true,
              },
            }
          : p
      )
    );

    // Save to localStorage
    savePearlSRSData(currentPearl.id, { mastered: true });

    // Optionally sync to server
    try {
      const token = await getToken();
      await fetch(`/api/user/pearls/${currentPearl.id}/useful`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.warn('[MyPearlsPanel] Failed to sync mastered status:', err);
    }

    // Move to next card
    goNext();
  };

  // Schedule for later review (3 days)
  const reviewLater = () => {
    if (!currentPearl) return;

    const nextReview = getNextReviewDate(3);

    // Update local state with proper defaults
    setPearls((prev) =>
      prev.map((p): ClinicalPearl =>
        p.id === currentPearl.id
          ? {
              ...p,
              userInteraction: {
                isSaved: p.userInteraction?.isSaved ?? false,
                markedUseful: p.userInteraction?.markedUseful ?? false,
                viewedAt: p.userInteraction?.viewedAt,
                notes: p.userInteraction?.notes,
                nextReviewDate: nextReview,
                mastered: false,
              },
            }
          : p
      )
    );

    // Save to localStorage
    savePearlSRSData(currentPearl.id, { nextReviewDate: nextReview, mastered: false });

    // Move to next card
    goNext();
  };

  // Toggle saved status
  const toggleSaved = async () => {
    if (!currentPearl) return;

    const newSavedStatus = !currentPearl.userInteraction?.isSaved;

    setPearls((prev) =>
      prev.map((p): ClinicalPearl =>
        p.id === currentPearl.id
          ? {
              ...p,
              userInteraction: {
                isSaved: newSavedStatus,
                markedUseful: p.userInteraction?.markedUseful ?? false,
                viewedAt: p.userInteraction?.viewedAt,
                notes: p.userInteraction?.notes,
                nextReviewDate: p.userInteraction?.nextReviewDate,
                mastered: p.userInteraction?.mastered,
              },
            }
          : p
      )
    );

    // Sync to server
    try {
      const token = await getToken();
      await fetch(`/api/user/pearls/${currentPearl.id}/save`, {
        method: newSavedStatus ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.warn('[MyPearlsPanel] Failed to sync save status:', err);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const mastered = pearls.filter((p) => p.userInteraction?.mastered).length;
    const due = pearls.filter(
      (p) => !p.userInteraction?.mastered && isDueForReview(p.userInteraction?.nextReviewDate)
    ).length;
    const saved = pearls.filter((p) => p.userInteraction?.isSaved).length;
    return { total: pearls.length, mastered, due, saved };
  }, [pearls]);

  // Get empty state message
  const getEmptyMessage = (): string => {
    if (filter === 'due') return 'No pearls due for review!';
    if (filter === 'saved') return 'No saved pearls yet';
    return 'Start studying to collect pearls';
  };

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="mt-3 text-slate-600 dark:text-slate-300">Loading pearls...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{error}</p>
          <button
            onClick={fetchPearls}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (filteredPearls.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
            <Sparkles className="w-8 h-8 text-purple-500" />
          </div>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{getEmptyMessage()}</p>
        </div>
      );
    }

    return renderFlashcard();
  };

  // Render flashcard content
  const renderFlashcard = () => (
    <>
      {/* Flashcard */}
      <div className="relative perspective-1000">
        <motion.div
          className="relative w-full h-64 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Front of card */}
          <div
            className="flashcard-face absolute inset-0 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 p-6 shadow-lg border border-slate-200 dark:border-slate-600 flex flex-col"
          >
            {/* Tags */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                {currentPearl?.system}
              </span>
              {currentPearl?.category && (
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full text-xs">
                  {currentPearl.category}
                </span>
              )}
              {currentPearl?.userInteraction?.mastered && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-xs flex items-center gap-1">
                  <Star className="w-3 h-3" /> Mastered
                </span>
              )}
            </div>

            {/* Pearl text */}
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg text-center text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                {currentPearl?.pearlText}
              </p>
            </div>

            {/* Hint to flip */}
            <p className="text-xs text-slate-400 text-center mt-4">
              Tap to see explanation
            </p>
          </div>

          {/* Back of card */}
          <div
            className="flashcard-face flashcard-back absolute inset-0 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 p-6 shadow-lg border border-purple-200 dark:border-purple-700 flex flex-col overflow-auto"
          >
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-purple-700 dark:text-purple-300">
                Explanation
              </span>
            </div>

            <div className="flex-1 overflow-auto">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {currentPearl?.fullExplanation || 'No additional explanation available.'}
              </p>
            </div>

            {/* Tags */}
            {currentPearl?.tags && currentPearl.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-4">
                {currentPearl.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-200 rounded text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Navigation & Actions */}
      <div className="mt-6 flex items-center justify-between">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={filteredPearls.length <= 1}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous pearl"
            title="Previous pearl"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400 min-w-[60px] text-center">
            {currentIndex + 1} / {filteredPearls.length}
          </span>
          <button
            onClick={goNext}
            disabled={filteredPearls.length <= 1}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next pearl"
            title="Next pearl"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Save/Bookmark */}
          <button
            onClick={toggleSaved}
            className={`p-2 rounded-lg transition-colors ${
              currentPearl?.userInteraction?.isSaved
                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
            title={currentPearl?.userInteraction?.isSaved ? 'Unsave pearl' : 'Save pearl'}
            aria-label={currentPearl?.userInteraction?.isSaved ? 'Unsave pearl' : 'Save pearl'}
          >
            {currentPearl?.userInteraction?.isSaved ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>

          {/* Review Later */}
          <button
            onClick={reviewLater}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Review Later</span>
          </button>

          {/* Mark Mastered */}
          <button
            onClick={markAsMastered}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Mastered</span>
          </button>
        </div>
      </div>
    </>
  );

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
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Gem className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">My Clinical Pearls</h2>
                <p className="text-purple-100 text-sm">
                  {stats.total} pearls • {stats.mastered} mastered • {stats.due} due
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-4">
            {(['all', 'due', 'saved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setCurrentIndex(0);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-white text-purple-600 shadow-lg'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {f === 'all' && `All (${stats.total})`}
                {f === 'due' && `Due (${stats.due})`}
                {f === 'saved' && `Saved (${stats.saved})`}
              </button>
            ))}
          </div>

          {/* System filter dropdown */}
          {systems.length > 1 && (
            <div className="mt-3">
              <select
                value={systemFilter || ''}
                onChange={(e) => {
                  setSystemFilter(e.target.value || null);
                  setCurrentIndex(0);
                }}
                className="bg-white/20 border-none rounded-lg px-3 py-2 text-sm text-white placeholder-white/60 focus:ring-2 focus:ring-white/50"
                aria-label="Filter by system"
                title="Filter by system"
              >
                <option value="" className="text-slate-800">
                  All Systems
                </option>
                {systems.map((sys) => (
                  <option key={sys} value={sys} className="text-slate-800">
                    {sys}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Mock data for development
const MOCK_PEARLS: ClinicalPearl[] = [
  {
    id: '1',
    pearlText:
      'In acute MI, door-to-balloon time should be <90 minutes. Every 30-minute delay increases mortality by 7.5%.',
    system: 'Cardiovascular',
    category: 'management',
    tags: ['STEMI', 'PCI', 'emergency'],
    fullExplanation:
      'Primary percutaneous coronary intervention (PCI) is the preferred reperfusion strategy for STEMI when available within 90-120 minutes of first medical contact. The relationship between time-to-treatment and mortality is well-established.',
    viewCount: 45,
    usefulVotes: 23,
  },
  {
    id: '2',
    pearlText:
      'Pneumonia: CURB-65 ≥2 = hospital admission. Components: Confusion, Urea >7, RR ≥30, BP <90/60, Age ≥65.',
    system: 'Pulmonary',
    category: 'clinical_presentation',
    tags: ['pneumonia', 'scoring', 'admission'],
    fullExplanation:
      'CURB-65 is a validated clinical prediction rule for assessing severity of community-acquired pneumonia. Each component scores 1 point. Score 0-1: outpatient, 2: short hospitalization, 3+: ICU consideration.',
    viewCount: 67,
    usefulVotes: 41,
  },
  {
    id: '3',
    pearlText:
      'Classic triad of appendicitis: periumbilical pain → RLQ migration → anorexia. McBurney point tenderness is 7-10cm from ASIS.',
    system: 'Gastrointestinal',
    category: 'diagnosis',
    tags: ['appendicitis', 'acute abdomen', 'physical exam'],
    fullExplanation:
      "The visceral afferent pain fibers from the appendix enter the spinal cord at T10, causing initial periumbilical pain. As inflammation progresses to involve the parietal peritoneum, pain localizes to the RLQ. McBurney's point is located one-third of the way from the ASIS to the umbilicus.",
    viewCount: 89,
    usefulVotes: 56,
  },
];

export default MyPearlsPanel;
