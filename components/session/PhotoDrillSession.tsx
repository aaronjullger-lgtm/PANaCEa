import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  usePhotoDrill,
  type CategoryType,
  type ClinicalContext,
} from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { QuestionSkeleton } from '@/components/loading';
import {
  Flame,
  X,
  ArrowRight,
  RotateCcw,
  FileImage,
  Scan,
  Activity as ActivityIcon,
  Shuffle,
  User,
  Heart,
  ClipboardList,
  Eye,
  EyeOff,
  Stethoscope,
  Pencil,
  CheckCircle,
} from 'lucide-react';
import { SpatialAnswerCanvas } from '@/components/drill/SpatialAnswerCanvas';
import { useSpatialGrading, imageUrlToBase64 } from '@/hooks/useSpatialGrading';

export type PhotoDrillFilterType = 'ecg' | 'derm' | 'imaging' | 'all';

interface PhotoDrillSessionProps {
  /** Callback to navigate back to the menu */
  onExit?: () => void;
  /** Optional filter to directly start a specific category (skips lobby) */
  filterType?: PhotoDrillFilterType;
}

/** Category card data for the lobby */
const CATEGORY_CARDS: Array<{
  id: CategoryType;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'ecg',
    title: 'ECG',
    description: 'Electrocardiogram interpretation',
    icon: <ActivityIcon className="w-8 h-8" />,
  },
  {
    id: 'derm',
    title: 'Clinical Presentation Mode',
    description: 'Dermatology & clinical findings identification',
    icon: <Scan className="w-8 h-8" />,
  },
  {
    id: 'radiology',
    title: 'Radiology',
    description: 'X-ray and imaging analysis',
    icon: <FileImage className="w-8 h-8" />,
  },
  {
    id: 'random',
    title: 'Random Mix',
    description: 'All categories combined',
    icon: <Shuffle className="w-8 h-8" />,
  },
];

/**
 * PhotoDrillSession - Global Photo Mode UI
 *
 * A full-screen immersive interface with two stages:
 * - Lobby: Category selection (skipped if filterType is provided)
 * - Drill: Infinite photo drill with smart type-ahead search
 */
/** Resolve image URL: absolute vs public/images path (image optimization audit). */
function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const normalized = url.replace(/^\/+/, '');
  if (normalized.startsWith('images/')) return `/${normalized}`;
  return `/images/${normalized}`;
}

const PhotoDrillSession: React.FC<PhotoDrillSessionProps> = ({ onExit, filterType }) => {
  const {
    currentCase,
    queue,
    currentCaseIndex,
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
    fetchError,
    retryLoadCases,
  } = usePhotoDrill();

  // State for Clinical Presentation Mode: controls when image is revealed
  const [imageRevealed, setImageRevealed] = useState<boolean>(false);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);
  const [imageErrored, setImageErrored] = useState<boolean>(false);
  /** Zoom-on-demand: when true, show high-res image (image optimization audit). */
  const [requestHighRes, setRequestHighRes] = useState<boolean>(false);
  /** Draw to locate: spatial verification for ECG/radiology */
  const [drawModeActive, setDrawModeActive] = useState<boolean>(false);
  const {
    grade: gradeSpatial,
    loading: spatialLoading,
    result: spatialResult,
    reset: resetSpatial,
  } = useSpatialGrading();

  // Thumbnail first (lightweight), high-res only on zoom (image optimization audit)
  const resolvedThumbnailSrc = useMemo(
    () => resolveImageUrl(currentCase?.thumbnailUrl || currentCase?.imageUrl),
    [currentCase?.thumbnailUrl, currentCase?.imageUrl]
  );
  const resolvedHighResSrc = useMemo(
    () => resolveImageUrl(currentCase?.highResUrl || currentCase?.imageUrl),
    [currentCase?.highResUrl, currentCase?.imageUrl]
  );
  const displaySrc =
    requestHighRes && currentCase?.highResUrl ? resolvedHighResSrc : resolvedThumbnailSrc;

  // Reset imageRevealed and zoom when case changes
  useEffect(() => {
    if (currentCase) {
      setImageRevealed(!currentCase.clinicalContext);
      setIsImageLoaded(false);
      setImageErrored(false);
      setRequestHighRes(false);
      setDrawModeActive(false);
      resetSpatial();
    }
  }, [currentCase?.id, resetSpatial]);

  // Preload next case image in background while user is on current question (image optimization audit)
  useEffect(() => {
    const nextCaseData = queue[currentCaseIndex + 1];
    if (!nextCaseData) return;
    const nextThumbnail = resolveImageUrl(nextCaseData.thumbnailUrl || nextCaseData.imageUrl);
    if (!nextThumbnail) return;
    const img = new Image();
    img.src = nextThumbnail;
  }, [queue, currentCaseIndex]);

  // Auto-start session if filterType is provided (direct access from split drill tiles)
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
    if (onExit) {
      onExit();
    }
  };

  const handleCategorySelect = (category: CategoryType) => {
    startSession(category);
  };

  const handleDiagnosisSubmit = (diagnosis: string) => {
    submitAnswer(diagnosis);
  };

  const handleNextCase = () => {
    setImageRevealed(false);
    setIsImageLoaded(false);
    setImageErrored(false);
    setDrawModeActive(false);
    resetSpatial();
    nextCase();
  };

  const handleDrawBoxComplete = async (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    if (!currentCase || !displaySrc) return;
    try {
      const base64 = await imageUrlToBase64(displaySrc);
      await gradeSpatial({
        imageBase64: base64,
        userBox: box,
        mediaAssetId: currentCase.id,
        pathology: currentCase.correctDiagnosis,
      });
    } catch {
      resetSpatial();
    }
  };

  const handleReset = () => {
    setImageRevealed(false);
    setIsImageLoaded(false);
    setImageErrored(false);
    reset();
  };

  const handleRevealImage = () => {
    setImageRevealed(true);
  };

  // Animation variants
  const imageVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  const feedbackVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: { scale: 1.02, y: -4 },
    tap: { scale: 0.98 },
  };

  // =========================================================================
  // VIEW A: The Lobby (Status: 'menu')
  // =========================================================================
  if (status === 'menu') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Exit"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium">Exit</span>
          </button>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Photo Drill</h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              Select Your Training Module
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Choose a category to start your infinite drill session
            </p>
          </motion.div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
            {CATEGORY_CARDS.map((card, index) => (
              <motion.button
                key={card.id}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                transition={{ duration: 0.3, delay: index * 0.1 }}
                onClick={() => handleCategorySelect(card.id)}
                className="relative p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] text-left shadow-lg hover:shadow-xl overflow-hidden group transition-all"
              >
                <div className="relative z-10">
                  <div className="mb-4 p-3 bg-[var(--color-accent)]/10 rounded-xl w-fit">
                    <div className="text-[var(--color-accent)]">{card.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
                    {card.title}
                  </h3>
                  <p className="text-[var(--color-text-secondary)] text-sm">{card.description}</p>
                </div>

                {/* Arrow indicator */}
                <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all" />
              </motion.button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: The Drill (Status: 'playing' | 'feedback')
  // =========================================================================
  if (status === 'playing' || status === 'feedback') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        {/* Floating Header */}
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm border-b border-[var(--color-border)]">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Exit session"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Exit</span>
          </button>

          <div className="flex items-center gap-4">
            {/* Score */}
            <div className="text-sm text-[var(--color-text-secondary)]">
              Score: <span className="text-[var(--color-text-primary)] font-semibold">{score}</span>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center gap-1.5">
              <Flame
                className={`w-5 h-5 ${
                  streak > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                }`}
              />
              <span
                className={`text-sm font-bold ${
                  streak > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {streak}
              </span>
            </div>
          </div>
        </header>

        {/* Main Stage - Clinical Presentation Mode shows Patient Chart first, then Image */}
        <main className="flex-1 flex items-center justify-center p-4 pt-16 pb-32 overflow-y-auto">
          {status === 'playing' && queue.length === 0 && (
            <motion.div
             
              animate={{ opacity: 1 }}
              className="w-full max-w-md rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-6 text-center shadow-lg"
            >
              <FileImage className="mx-auto w-12 h-12 text-[var(--color-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {fetchError ? 'Something went wrong' : 'No questions available'}
              </h3>
              <p className="text-[var(--color-text-muted)] text-sm mb-4">
                {fetchError
                  ? fetchError
                  : 'There are no questions for this filter yet. Try another category or retry.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={retryLoadCases}
                  className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleExit}
                  className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  Try another category
                </button>
              </div>
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            {currentCase && (
              <motion.div
                key={`${currentCase.id}-${imageRevealed ? 'image' : 'chart'}`}
                variants={imageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="w-full max-w-3xl flex flex-col items-center justify-center gap-4"
              >
                {/* Clinical Presentation Mode: Show Patient Chart before image */}
                {currentCase.clinicalContext && !imageRevealed && (
                  <div className="w-full space-y-4">
                    {/* Patient Chart Header */}
                    <div className="bg-[var(--color-bg-tertiary)] backdrop-blur-sm rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <div className="px-4 py-3 bg-gradient-to-r from-[var(--color-bg-elevated)] to-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] flex items-center gap-3">
                        <ClipboardList className="w-5 h-5 text-[var(--color-text-muted)]" />
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          Patient Chart
                        </h2>
                        <span className="ml-auto px-2.5 py-1 bg-[var(--color-bg-secondary)]/70 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                          Clinical Presentation Mode
                        </span>
                      </div>

                      {/* Patient Demographics */}
                      <div className="p-4 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 bg-[var(--color-bg-secondary)] rounded-lg">
                            <User className="w-5 h-5 text-[var(--color-text-muted)]" />
                          </div>
                          <div>
                            <div className="text-sm text-[var(--color-text-secondary)]">
                              Patient
                            </div>
                            <div className="text-[var(--color-text-primary)] font-medium">
                              {currentCase.clinicalContext.age}yo{' '}
                              {currentCase.clinicalContext.sex === 'M' ? 'Male' : 'Female'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vitals */}
                      <div className="p-4 border-b border-[var(--color-border)]">
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 bg-[var(--color-bg-secondary)] rounded-lg">
                            <Heart className="w-5 h-5 text-[var(--color-data-fail)]" />
                          </div>
                          <div>
                            <div className="text-sm text-[var(--color-text-secondary)] mb-1">
                              Vital Signs
                            </div>
                            <div className="text-[var(--color-text-primary)] text-sm font-mono">
                              {currentCase.clinicalContext.vitals}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Chief Complaint */}
                      <div className="p-4 border-b border-[var(--color-border)]">
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 bg-[var(--color-bg-secondary)] rounded-lg">
                            <Stethoscope className="w-5 h-5 text-[var(--color-data-pass)]" />
                          </div>
                          <div>
                            <div className="text-sm text-[var(--color-text-secondary)] mb-1">
                              Chief Complaint
                            </div>
                            <div className="text-[var(--color-text-primary)]">
                              {currentCase.clinicalContext.chiefComplaint}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* History */}
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 bg-[var(--color-bg-secondary)] rounded-lg">
                            <ClipboardList className="w-5 h-5 text-[var(--color-data-provisional)]" />
                          </div>
                          <div>
                            <div className="text-sm text-[var(--color-text-secondary)] mb-1">
                              History
                            </div>
                            <div className="text-[var(--color-text-primary)] text-sm leading-relaxed">
                              {currentCase.clinicalContext.history}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Findings (if present) */}
                      {currentCase.clinicalContext.additionalFindings &&
                        currentCase.clinicalContext.additionalFindings.length > 0 && (
                          <div className="p-4 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)]">
                            <div className="text-sm text-[var(--color-text-secondary)] mb-2">
                              Physical Exam Findings:
                            </div>
                            <ul className="space-y-1">
                              {currentCase.clinicalContext.additionalFindings.map(
                                (finding, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]"
                                  >
                                    <span className="text-[var(--color-accent)] mt-1">•</span>
                                    <span>{finding}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                    </div>

                    {/* Reveal Image Button */}
                    <button
                      onClick={handleRevealImage}
                      className="w-full py-4 bg-[var(--color-bg-elevated)]/70 hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] rounded-xl text-[var(--color-text-primary)] font-semibold flex items-center justify-center gap-3 transition-all shadow-lg"
                    >
                      <Eye className="w-5 h-5" />
                      View Clinical Findings
                    </button>
                  </div>
                )}

                {/* Image View (shown for non-derm cases or when revealed) — thumbnail first, high-res on zoom (image optimization audit) */}
                {(imageRevealed || !currentCase.clinicalContext) &&
                  !(
                    drawModeActive &&
                    (currentCase.modality === 'ecg' || currentCase.modality === 'xray')
                  ) && (
                    <div className="relative bg-[var(--color-bg-tertiary)] rounded-xl overflow-hidden shadow-[0_18px_42px_var(--color-shadow-soft)] w-full max-w-3xl mx-auto">
                      {/* Draw to locate: for ECG and radiology */}
                      {(currentCase.modality === 'ecg' || currentCase.modality === 'xray') &&
                        !spatialResult && (
                          <button
                            type="button"
                            onClick={() => setDrawModeActive(true)}
                            className="absolute bottom-3 left-3 px-3 py-2 bg-[var(--color-accent)]/90 hover:bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <Pencil className="w-4 h-4" aria-hidden />
                            Draw to locate
                          </button>
                        )}
                      <div
                        className={`absolute inset-0 bg-[var(--color-bg-elevated)] animate-pulse transition-opacity duration-300 ${isImageLoaded ? 'opacity-0' : 'opacity-100'}`}
                        aria-hidden
                      />
                      <img
                        src={displaySrc}
                        alt={`Medical ${currentCase.modality.toUpperCase()} case`}
                        className={`w-full max-h-[50vh] object-contain transition-all duration-500 ${isImageLoaded ? 'blur-0 scale-100 opacity-100' : 'blur-md scale-[1.01] opacity-80'}`}
                        onLoad={() => setIsImageLoaded(true)}
                        onError={() => setImageErrored(true)}
                      />
                      {imageErrored && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-secondary)] text-sm">
                          Unable to load image. Check public/images path.
                        </div>
                      )}
                      {/* Zoom on demand: load high-res only when user requests (saves data for X-rays/derm) */}
                      {currentCase.highResUrl && !requestHighRes && (
                        <button
                          type="button"
                          onClick={() => {
                            setRequestHighRes(true);
                            setIsImageLoaded(false);
                          }}
                          className="absolute top-3 right-3 px-2.5 py-1.5 bg-[var(--color-bg-secondary)]/90 backdrop-blur-sm rounded-lg text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center gap-1.5"
                          aria-label="View full resolution (loads high-res image)"
                          title="Load full-resolution image for zoom/detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Full resolution
                        </button>
                      )}
                      {/* Modality Badge */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-[var(--color-bg-secondary)]/90 backdrop-blur-sm rounded-lg text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        {currentCase.modality === 'derm'
                          ? 'Clinical Presentation'
                          : currentCase.modality}
                      </div>
                    </div>
                  )}

                {/* Draw mode: SpatialAnswerCanvas for ECG/radiology (replaces image when active) */}
                {(imageRevealed || !currentCase.clinicalContext) &&
                  drawModeActive &&
                  (currentCase.modality === 'ecg' || currentCase.modality === 'xray') && (
                    <div className="w-full space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          Draw a box around the finding
                        </span>
                        {!spatialResult && (
                          <button
                            type="button"
                            onClick={() => setDrawModeActive(false)}
                            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                          >
                            Skip
                          </button>
                        )}
                      </div>
                      <SpatialAnswerCanvas
                        imageUrl={displaySrc}
                        imageAlt={`Locate the finding - ${currentCase.modality}`}
                        onBoxComplete={handleDrawBoxComplete}
                        correctBox={
                          spatialResult && !spatialResult.isCorrect
                            ? spatialResult.correctBox
                            : undefined
                        }
                        disabled={!!spatialResult || spatialLoading}
                      />
                      {spatialLoading && (
                        <p className="text-sm text-[var(--color-text-muted)] text-center">
                          Grading…
                        </p>
                      )}
                      {spatialResult && (
                        <div
                          className={`rounded-xl p-4 text-center ${
                            spatialResult.isCorrect
                              ? 'bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30'
                              : 'bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2 mb-2">
                            {spatialResult.isCorrect ? (
                              <CheckCircle
                                className="w-5 h-5 text-[var(--color-data-pass)]"
                                aria-hidden
                              />
                            ) : null}
                            <span
                              className={`font-semibold ${
                                spatialResult.isCorrect
                                  ? 'text-[var(--color-data-pass)]'
                                  : 'text-[var(--color-data-fail)]'
                              }`}
                            >
                              {spatialResult.isCorrect
                                ? 'Correct location'
                                : 'Incorrect — see red outline for correct area'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDrawModeActive(false);
                              resetSpatial();
                            }}
                            className="text-sm text-[var(--color-accent)] hover:underline"
                          >
                            Continue to diagnosis
                          </button>
                        </div>
                      )}
                    </div>
                  )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Fixed Bottom Bar - Glassmorphism */}
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-[var(--color-bg-primary)]/80 backdrop-blur-md border-t border-[var(--color-border)] shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.12)] dark:shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.35)]">
          <AnimatePresence mode="wait">
            {status === 'playing' && (
              <motion.div
                key={drawModeActive ? 'draw-controls' : 'playing-controls'}
                variants={feedbackVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="p-4"
              >
                <div className="max-w-2xl mx-auto">
                  {drawModeActive ? (
                    <p className="text-center text-sm text-[var(--color-text-muted)]">
                      Click and drag on the image to draw a box around the finding
                    </p>
                  ) : (
                    <DiagnosisInput
                      onSubmit={handleDiagnosisSubmit}
                      autoFocus
                      options={validDiagnoses}
                    />
                  )}
                </div>
              </motion.div>
            )}

            {status === 'feedback' && currentCase && (
              <motion.div
                key="feedback-controls"
                variants={feedbackVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className={`p-4 ${
                  isCorrect
                    ? 'bg-[var(--color-data-pass)]/10 border-t-2 border-[var(--color-data-pass)]'
                    : 'bg-[var(--color-data-fail)]/10 border-t-2 border-[var(--color-data-fail)]'
                }`}
              >
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div
                        className={`text-lg font-bold ${
                          isCorrect
                            ? 'text-[var(--color-data-pass)]'
                            : 'text-[var(--color-data-fail)]'
                        }`}
                      >
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </div>
                      {!isCorrect && (
                        <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                          Correct answer:{' '}
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {currentCase.correctDiagnosis}
                          </span>
                        </div>
                      )}
                      {userAnswer && !isCorrect && (
                        <div className="text-sm text-[var(--color-text-muted)] mt-0.5">
                          Your answer: {userAnswer}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleNextCase}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                        isCorrect
                          ? 'bg-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/90 text-[var(--color-text-inverse)]'
                          : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      Next Case
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Explanation */}
                  <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg p-3 mt-2">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      Explanation:{' '}
                    </span>
                    {currentCase.explanation}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Summary View (Status: 'summary')
  // =========================================================================
  if (status === 'summary') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] text-center border border-[var(--color-border)]"
        >
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Session Complete
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Great work on your training session!
          </p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[var(--color-data-pass)]">{score}</div>
              <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-inverse)] rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Session
            </button>
            <button
              onClick={handleExit}
              className="px-6 py-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium transition-colors"
            >
              Exit to Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Fallback - Use skeleton loader for zero CLS
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <QuestionSkeleton />
      </div>
    </div>
  );
};

export default PhotoDrillSession;
