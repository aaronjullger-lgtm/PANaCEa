/**
 * Example: PhotoDrillSession refactored with DrillShell
 *
 * This demonstrates how to wrap an existing drill mode with the new
 * standardized DrillShell component for consistent UX.
 *
 * BEFORE: Custom header, manual responsive handling, repeated layout code
 * AFTER: Clean, standardized layout with DrillShell
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, RotateCcw, Shuffle } from 'lucide-react';
import DrillShell from '@/components/drill/DrillShell';
import { usePhotoDrill, type CategoryType } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';

export type PhotoDrillFilterType = 'ecg' | 'derm' | 'imaging' | 'all';

interface PhotoDrillSessionProps {
  onExit?: () => void;
  filterType?: PhotoDrillFilterType;
}

const PhotoDrillSessionRefactored: React.FC<PhotoDrillSessionProps> = ({ onExit, filterType }) => {
  const {
    currentCase,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    submitAnswer,
    nextCase,
    reset,
    startSession,
    exitToMenu,
    validDiagnoses,
  } = usePhotoDrill();

  const [imageRevealed, setImageRevealed] = useState<boolean>(false);

  // Reset imageRevealed when case changes
  useEffect(() => {
    if (currentCase) {
      setImageRevealed(!currentCase.clinicalContext);
    }
  }, [currentCase?.id]);

  // Auto-start if filterType provided
  useEffect(() => {
    if (filterType && status === 'menu') {
      const categoryMap: Record<PhotoDrillFilterType, CategoryType> = {
        ecg: 'ecg',
        derm: 'derm',
        imaging: 'radiology',
        all: 'random',
      };
      startSession(categoryMap[filterType]);
    }
  }, [filterType, status, startSession]);

  const handleExit = () => {
    exitToMenu();
    if (onExit) onExit();
  };

  const handleReset = () => {
    reset();
    setImageRevealed(false);
  };

  // Get drill title based on category
  const getDrillTitle = () => {
    if (!currentCase) return 'Photo Drill';
    const categoryLabels = {
      ecg: 'ECG Interpretation',
      derm: 'Clinical Presentation',
      xray: 'Imaging Analysis',
    };
    return categoryLabels[currentCase.modality as keyof typeof categoryLabels] || 'Photo Drill';
  };

  // ============================================================================
  // RENDER: Lobby (Category Selection)
  // ============================================================================
  if (status === 'menu') {
    return (
      <DrillShell
        title="Photo Drill"
        subtitle="Select a category to begin"
        onExit={handleExit}
        fullWidth={false} // Lobby uses standard max-width
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category cards would go here */}
          <button
            onClick={() => startSession('ecg')}
            className="p-6 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-category-practice)] transition-all"
          >
            <h3 className="text-lg font-bold">ECG</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Electrocardiogram interpretation
            </p>
          </button>
          {/* More categories... */}
        </div>
      </DrillShell>
    );
  }

  // ============================================================================
  // RENDER: Active Drill Session
  // ============================================================================
  return (
    <DrillShell
      title={getDrillTitle()}
      subtitle="Visual Diagnosis"
      fullWidth={true} // Immersive full-width experience
      noPadding={true} // Content touches edges
      fullScreen={true} // Fixed positioning
      backgroundColor="bg-data-neutral dark:bg-data-neutral" // Dark mode for imaging
      onExit={handleExit}
      rightAction={
        <div className="flex items-center gap-3">
          {/* Streak Display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-data-provisional)]/20 border border-[var(--color-data-provisional)]/30">
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-text-muted)]'}`} />
            <span className="text-sm font-semibold text-[var(--color-data-provisional)]">{streak}</span>
          </div>

          {/* Score Display */}
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            {score} / {score + (isCorrect === false ? 1 : 0)}
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Reset drill"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      }
    >
      {/* Main Drill Content - No wrapper needed, DrillShell handles layout */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
        {/* Image Display */}
        {currentCase && (
          <motion.div
            key={currentCase.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl mx-auto mb-8"
          >
            {/* Clinical Context (for derm mode) */}
            {currentCase.clinicalContext && !imageRevealed && (
              <div className="mb-6 p-6 bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] rounded-xl">
                <p className="text-lg text-[var(--color-category-practice)]">
                  {JSON.stringify(currentCase.clinicalContext)}
                </p>
                <button
                  onClick={() => setImageRevealed(true)}
                  className="mt-4 px-4 py-2 bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] rounded-lg transition-colors"
                >
                  Reveal Image
                </button>
              </div>
            )}

            {/* Image (auto-reveal for ECG/imaging, gated for derm) */}
            {(!currentCase.clinicalContext || imageRevealed) && (
              <img
                src={currentCase.imageUrl}
                alt="Clinical case"
                className="w-full rounded-xl shadow-[0_18px_42px_var(--color-shadow-soft)]"
              />
            )}
          </motion.div>
        )}

        {/* Answer Input */}
        <div className="w-full max-w-2xl mx-auto px-4">
          <DiagnosisInput
            onSubmit={submitAnswer}
            options={validDiagnoses}
            disabled={isCorrect !== null}
            autoFocus={true}
          />

          {/* Feedback & Next Button */}
          {isCorrect !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex justify-center"
            >
              <button
                onClick={nextCase}
                className="px-8 py-3 bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                Next Case
                <Shuffle className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </DrillShell>
  );
};

export default PhotoDrillSessionRefactored;

/**
 * KEY BENEFITS OF USING DrillShell:
 *
 * ✅ Consistent header across all drill modes
 * ✅ Standardized back button behavior
 * ✅ Responsive design handled automatically
 * ✅ Full-screen/immersive modes supported
 * ✅ Right action slot for score/streak/settings
 * ✅ Clean separation of layout vs. content logic
 * ✅ Easy to maintain and update globally
 *
 * MIGRATION CHECKLIST:
 * 1. Import DrillShell
 * 2. Replace custom header with DrillShell wrapper
 * 3. Move score/streak to rightAction prop
 * 4. Set fullWidth/noPadding/fullScreen as needed
 * 5. Remove manual responsive classes from content
 * 6. Test on mobile/tablet/desktop
 */
