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
  Zap,
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
  const [rapidReviewMode, setRapidReviewMode] = useState(false);

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

  // Rapid Review: keyboard shortcuts
  useEffect(() => {
    if (!rapidReviewMode || filteredPearls.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (e.key === ' ') setIsFlipped((prev) => !prev);
        else {
          setIsFlipped(false);
          setCurrentIndex((prev) => (prev + 1) % filteredPearls.length);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + filteredPearls.length) % filteredPearls.length);
      } else if (e.key === 'Escape') {
        setRapidReviewMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rapidReviewMode, filteredPearls.length]);

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
      prev.map(
        (p): ClinicalPearl =>
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
      prev.map(
        (p): ClinicalPearl =>
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
      prev.map(
        (p): ClinicalPearl =>
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
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
          <p className="mt-3 text-[var(--color-text-muted)]">Loading pearls...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="p-4 bg-data-fail/10 rounded-full">
            <X className="w-8 h-8 text-data-fail" />
          </div>
          <p className="mt-3 text-[var(--color-text-muted)]">{error}</p>
          <button
            onClick={fetchPearls}
            className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent)]/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (filteredPearls.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="p-4 bg-[var(--color-bg-secondary)] rounded-full">
            <Sparkles className="w-8 h-8 text-[var(--color-accent)]" />
          </div>
          <p className="mt-3 text-[var(--color-text-muted)]">{getEmptyMessage()}</p>
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
          <div className="flashcard-face absolute inset-0 rounded-xl bg-[var(--color-bg-secondary)] p-6 shadow-lg border border-[var(--color-border)] flex flex-col">
            {/* Tags */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full text-xs font-medium">
                {currentPearl?.system}
              </span>
              {currentPearl?.category && (
                <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-full text-xs">
                  {currentPearl.category}
                </span>
              )}
              {currentPearl?.userInteraction?.mastered && (
                <span className="px-2 py-1 bg-data-pass/10 text-data-pass rounded-full text-xs flex items-center gap-1">
                  <Star className="w-3 h-3" /> Mastered
                </span>
              )}
            </div>

            {/* Pearl text */}
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg text-center text-[var(--color-text-primary)] font-medium leading-relaxed">
                {currentPearl?.pearlText}
              </p>
            </div>

            {/* Hint to flip */}
            <p className="text-xs text-[var(--color-text-muted)] text-center mt-4">
              Tap to see explanation
            </p>
          </div>

          {/* Back of card */}
          <div className="flashcard-face flashcard-back absolute inset-0 rounded-xl bg-[var(--color-bg-secondary)] p-6 shadow-lg border border-[var(--color-accent)]/30 flex flex-col overflow-auto">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-[var(--color-accent)]" />
              <span className="font-semibold text-[var(--color-accent)]">Explanation</span>
            </div>

            <div className="flex-1 overflow-auto">
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                {currentPearl?.fullExplanation || 'No additional explanation available.'}
              </p>
            </div>

            {/* Tags */}
            {currentPearl?.tags && currentPearl.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-4">
                {currentPearl.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded text-xs"
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
            className="p-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous pearl"
            title="Previous pearl"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-[var(--color-text-muted)] min-w-[60px] text-center">
            {currentIndex + 1} / {filteredPearls.length}
          </span>
          <button
            onClick={goNext}
            disabled={filteredPearls.length <= 1}
            className="p-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                ? 'bg-data-provisional/10 text-data-provisional'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
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
            className="flex items-center gap-2 px-4 py-2 bg-data-provisional/10 text-data-provisional rounded-lg hover:bg-data-provisional/20 transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Review Later</span>
          </button>

          {/* Mark Mastered */}
          <button
            onClick={markAsMastered}
            className="flex items-center gap-2 px-4 py-2 bg-data-pass text-[var(--color-text-inverse)] rounded-lg hover:bg-data-pass/90 transition-colors shadow-md"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-bg-tertiary)]/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]/80 p-6 text-[var(--color-text-inverse)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-bg-primary)]/20 rounded-lg backdrop-blur-sm">
                <Gem className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">My Clinical Pearls</h2>
                <p className="text-[var(--color-text-inverse)]/80 text-sm">
                  {stats.total} pearls • {stats.mastered} mastered • {stats.due} due
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-bg-primary)]/20 rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Rapid Review toggle & Filter tabs */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              onClick={() => {
                setRapidReviewMode((prev) => !prev);
                setCurrentIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                rapidReviewMode
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-[var(--color-bg-primary)]/20 hover:bg-[var(--color-bg-primary)]/30'
              }`}
              title="Rapid Review: Space=flip, Arrows=navigate"
            >
              <Zap className="w-4 h-4" />
              Rapid Review
            </button>
            {!rapidReviewMode &&
              (['all', 'due', 'saved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setCurrentIndex(0);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === f
                      ? 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-lg'
                      : 'bg-[var(--color-bg-primary)]/20 hover:bg-[var(--color-bg-primary)]/30'
                  }`}
                >
                  {f === 'all' && `All (${stats.total})`}
                  {f === 'due' && `Due (${stats.due})`}
                  {f === 'saved' && `Saved (${stats.saved})`}
                </button>
              ))}
          </div>

          {/* System filter dropdown - hide in rapid review */}
          {!rapidReviewMode && systems.length > 1 && (
            <div className="mt-3">
              <select
                value={systemFilter || ''}
                onChange={(e) => {
                  setSystemFilter(e.target.value || null);
                  setCurrentIndex(0);
                }}
                className="bg-[var(--color-bg-primary)]/20 border-none rounded-lg px-3 py-2 text-sm text-[var(--color-text-inverse)] placeholder-[var(--color-text-inverse)]/60 focus:ring-2 focus:ring-[var(--color-bg-primary)]/50"
                aria-label="Filter by system"
                title="Filter by system"
              >
                <option value="" className="text-[var(--color-text-primary)]">
                  All Systems
                </option>
                {systems.map((sys) => (
                  <option key={sys} value={sys} className="text-[var(--color-text-primary)]">
                    {sys}
                  </option>
                ))}
              </select>
            </div>
          )}

          {rapidReviewMode && filteredPearls.length > 0 && (
            <p className="text-xs text-[var(--color-text-inverse)]/70 mt-2">
              Space = flip • ← → = navigate • Esc = exit Rapid Review
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">{renderContent()}</div>
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
