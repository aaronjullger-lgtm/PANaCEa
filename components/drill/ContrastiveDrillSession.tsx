/**
 * ContrastiveDrillSession — LOBBY LAYER for the Contrastive drill.
 *
 * Architectural note: this component is intentionally paired with
 * `ContrastiveDrill.tsx`, which is the PLAY LAYER. They are NOT duplicates.
 *
 * - `ContrastiveDrillSession` (this file): fetches available sets from
 *   `/api/drills/contrastive/sets`, renders the landing page / set picker /
 *   summary card, and manages drill lifecycle state.
 * - `ContrastiveDrill`: receives `{ set, drillId, onComplete }` and runs the
 *   gameplay — uses `useContrastiveDrill` hook, submits to FSRS via the
 *   canonical pipeline.
 *
 * FSRS submission happens via the child (`ContrastiveDrill`), not here.
 * Wired into `components/layout/DrillViewRouter.tsx` and `config/lazyComponents.tsx`.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { DrillLandingPage } from './DrillLandingPage';
import { ContrastiveDrill } from './ContrastiveDrill';
import { Target, ChevronRight } from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import DrillShell from './DrillShell';
import DrillSummaryCard from './DrillSummaryCard';
import { ROUTES } from '@/config/routes';
import { toast } from '@/lib/toast';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

interface ContrastiveSetData {
  id: string;
  symptom: string;
  conditionIds: string[];
  system: string | null;
  difficulty: string;
  highYield: boolean;
  distinguishers: Record<string, string[]>;
}

interface ContrastiveSet {
  id: string;
  symptom: string;
  conditions: string[];
  difficulty: string;
}

export function ContrastiveDrillSession({ onExit }: { readonly onExit: () => void }) {
  const { getToken } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<ContrastiveSet | null>(null);
  const [availableSets, setAvailableSets] = useState<ContrastiveSetData[]>([]);
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [showSetPicker, setShowSetPicker] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [lastStats, setLastStats] = useState<{ correct: number; total: number } | null>(null);

  // Fetch available contrastive sets on mount
  useEffect(() => {
    async function fetchSets() {
      try {
        const token = await getToken();
        const response = await fetch('/api/drills/contrastive/sets', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const responseJson = await response.json().catch(() => null);
        if (response.ok) {
          const data = unwrapApiEnvelope<{ sets?: ContrastiveSetData[] }>(responseJson);
          setAvailableSets(data.sets || []);
        } else {
          console.warn(getApiEnvelopeError(responseJson, 'Failed to fetch contrastive sets'));
        }
      } catch (error) {
        console.error('Failed to fetch contrastive sets:', error);
      } finally {
        setIsLoadingSets(false);
      }
    }
    fetchSets();
  }, [getToken]);

  const handleSelectSet = (set: ContrastiveSetData) => {
    // Convert to ContrastiveSet format expected by ContrastiveDrill
    setSelectedSet({
      id: set.id,
      symptom: set.symptom,
      conditions: Object.keys(set.distinguishers),
      difficulty: set.difficulty,
    });
    setShowSetPicker(false);
  };

  const handleStart = async () => {
    if (!selectedSet) {
      // If no set selected, show picker
      setShowSetPicker(true);
      return;
    }

    setIsStarting(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/drills/contrastive/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ setId: selectedSet.id }),
      });
      const responseJson = await response.json().catch(() => null);

      if (response.ok) {
        const data = unwrapApiEnvelope<{ set?: { id?: string } }>(responseJson);
        setDrillId(data.set?.id || selectedSet.id);
        setIsPlaying(true);
      } else {
        toast.error(getApiEnvelopeError(responseJson, 'Failed to start drill. Please try again.'));
      }
    } catch (error) {
      console.error('Failed to start drill:', error);
      toast.error('Failed to start drill. Check your connection.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleComplete = (stats: any) => {
    setIsPlaying(false);
    if (stats && typeof stats.correct === 'number' && typeof stats.total === 'number') {
      setLastStats({ correct: stats.correct, total: stats.total });
      setShowSummary(true);
    }
    setSelectedSet(null);
    setDrillId(null);
  };

  // Summary view
  if (showSummary && lastStats) {
    return (
      <DrillShell
        title="Contrastive Learning — Complete"
        breadcrumb={['Drills', 'Contrastive', 'Results']}
        onBackToHub={onExit}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="Contrastive Learning"
          icon={Target}
          accentColor="var(--color-accent)"
          stats={{ correct: lastStats.correct, total: lastStats.total, streak: 0 }}
          onNewSession={() => { setShowSummary(false); setLastStats(null); }}
          onExit={onExit}
          newSessionLabel="Practice More"
        />
      </DrillShell>
    );
  }

  // Set picker view
  if (showSetPicker) {
    return (
      <DrillShell
        title="Select a Symptom Set"
        breadcrumb={['Drills', 'Contrastive', 'Select Set']}
        onBackToHub={onExit}
        backTo={ROUTES.PRACTICE}
        onBack={() => setShowSetPicker(false)}
      >
        <div className="max-w-2xl mx-auto space-y-4 p-4">
          <p className="text-data-neutral">
            Choose a symptom to practice distinguishing between similar conditions.
          </p>

          {isLoadingSets ? (
            <div role="status" aria-label="Loading study sets" aria-live="polite" className="flex items-center justify-center h-48">
              <InlineSpinner size="lg" className="text-data-neutral" />
            </div>
          ) : availableSets.length === 0 ? (
            <div className="text-center text-data-neutral py-8">
              No contrastive sets available. Check back later or contact support.
            </div>
          ) : (
            <div className="grid gap-3">
              {availableSets.map((set) => (
                <button
                  key={set.id}
                  onClick={() => handleSelectSet(set)}
                  className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] dark:hover:border-[var(--color-accent)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 group text-left"
                >
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)]">
                      {set.symptom}
                    </h3>
                    <p className="text-sm text-data-neutral">
                      {Object.keys(set.distinguishers).length} conditions ·{' '}
                      {set.system || 'Multi-system'}
                      {set.highYield && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-data-provisional text-data-provisional rounded-full">
                          High Yield
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-data-neutral group-hover:text-[var(--color-accent)] transition-colors" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DrillShell>
    );
  }

  // Active drill view
  if (isPlaying && drillId && selectedSet) {
    return (
      <DrillShell
        title={`Contrastive Drill: ${selectedSet.symptom}`}
        breadcrumb={['Drills', 'Contrastive', selectedSet.symptom]}
        onBackToHub={onExit}
        backTo={ROUTES.PRACTICE}
        onBack={() => setIsPlaying(false)}
      >
        <ContrastiveDrill set={selectedSet} drillId={drillId} onComplete={handleComplete} />
      </DrillShell>
    );
  }

  // Landing page view
  return (
    <DrillShell
      title="Contrastive Learning"
      breadcrumb={['Drills', 'Contrastive']}
      onBackToHub={onExit}
      backTo={ROUTES.PRACTICE}
      hideBreadcrumb
    >
      <DrillLandingPage
        title="Contrastive Pattern Recognition"
        description="Master the subtle differences between similar conditions."
        longDescription="In this high-yield mode, you'll be presented with clinical vignettes that could plausibly be one of several related conditions. Your job is to identify the key distinguishing features that rule in one diagnosis and rule out the others."
        icon={Target}
        accentColor="deep-plum"
        estimatedMinutes={5}
        objectives={[
          'Differentiate between similar clinical presentations',
          'Identify pathognomonic details',
          'Build illness scripts for common symptoms',
        ]}
        instructions={[
          'Review the clinical vignette carefully.',
          'Compare against the 5 possible conditions sharing the symptom.',
          'Select the most likely diagnosis based on key discriminators.',
          'Review the comparison table to reinforce your learning.',
        ]}
        onStart={handleStart}
        onExit={onExit}
        isLoading={isStarting}
      />
    </DrillShell>
  );
}
