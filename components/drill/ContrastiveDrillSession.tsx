import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { DrillLandingPage } from './DrillLandingPage';
import { ContrastiveDrill } from './ContrastiveDrill';
import { Target, Loader2, ChevronRight } from 'lucide-react';
import DrillShell from './DrillShell';

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

  // Fetch available contrastive sets on mount
  useEffect(() => {
    async function fetchSets() {
      try {
        const token = await getToken();
        const response = await fetch('/api/drills/contrastive/sets', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableSets(data.data?.sets || []);
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

      if (response.ok) {
        const data = await response.json();
        setDrillId(data.data?.set?.id || selectedSet.id);
        setIsPlaying(true);
      } else {
        console.error('Failed to start drill');
      }
    } catch (error) {
      console.error('Failed to start drill:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleComplete = (stats: any) => {
    console.log('Drill complete', stats);
    setIsPlaying(false);
    setSelectedSet(null);
    setDrillId(null);
  };

  // Set picker view
  if (showSetPicker) {
    return (
      <DrillShell
        title="Select a Symptom Set"
        breadcrumb={['Drills', 'Contrastive', 'Select Set']}
        onBackToHub={onExit}
        onBack={() => setShowSetPicker(false)}
      >
        <div className="max-w-2xl mx-auto space-y-4 p-4">
          <p className="text-slate-600 dark:text-slate-300">
            Choose a symptom to practice distinguishing between similar conditions.
          </p>

          {isLoadingSets ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : availableSets.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              No contrastive sets available. Run the seed script to populate sets.
            </div>
          ) : (
            <div className="grid gap-3">
              {availableSets.map((set) => (
                <button
                  key={set.id}
                  onClick={() => handleSelectSet(set)}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-400 dark:hover:border-violet-500 transition-all group text-left"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400">
                      {set.symptom}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {Object.keys(set.distinguishers).length} conditions ·{' '}
                      {set.system || 'Multi-system'}
                      {set.highYield && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                          High Yield
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-violet-500 transition-colors" />
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
