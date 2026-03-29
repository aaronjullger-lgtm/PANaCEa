/**
 * Interactive Anatomy Diagram Component
 * Sprint 9: Multimodal Content Expansion - Labeled anatomy diagrams
 *
 * Interactive SVG-based anatomy viewer with clickable labels,
 * zoom controls, and quiz mode for anatomy identification.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Info,
  ChevronRight,
  Maximize2,
  Minimize2,
  HelpCircle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface AnatomyLabel {
  id: string;
  name: string;
  description: string;
  clinicalRelevance?: string;
  position: { x: number; y: number };
  layer?: string;
  system?: string;
  connections?: string[];
  relatedConditions?: string[];
}

export interface AnatomyDiagram {
  id: string;
  name: string;
  imageUrl: string;
  svgOverlay?: string;
  category: string;
  region: string;
  labels: AnatomyLabel[];
  layers?: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

export interface InteractiveDiagramProps {
  diagram: AnatomyDiagram;
  mode?: 'explore' | 'quiz';
  onQuizComplete?: (results: QuizResults) => void;
  showLabels?: boolean;
  initialZoom?: number;
  isLoading?: boolean;
}

interface QuizResults {
  totalLabels: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  timeSpent: number;
  results: Array<{
    labelId: string;
    selectedPosition: { x: number; y: number };
    isCorrect: boolean;
    distance: number;
  }>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InteractiveDiagram({
  diagram,
  mode = 'explore',
  onQuizComplete,
  showLabels: initialShowLabels = true,
  initialZoom = 1,
  isLoading = false,
}: InteractiveDiagramProps) {
  // State
  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // In quiz mode, hide labels by default to prevent giving away answers
  const [showLabels, setShowLabels] = useState(mode === 'quiz' ? false : initialShowLabels);
  const [selectedLabel, setSelectedLabel] = useState<AnatomyLabel | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Quiz state
  const [quizState, setQuizState] = useState<{
    currentLabelIndex: number;
    shuffledLabels: AnatomyLabel[];
    results: QuizResults['results'];
    startTime: number;
    showFeedback: boolean;
    lastClickPosition?: { x: number; y: number };
  } | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Filtered labels by layer
  const visibleLabels = useMemo(() => {
    if (activeLayer === 'all') return diagram.labels;
    return diagram.labels.filter((l) => l.layer === activeLayer);
  }, [diagram.labels, activeLayer]);

  // Zoom controls
  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'quiz' && quizState && !quizState.showFeedback) {
      // Quiz mode: handle click as answer
      handleQuizClick(e);
      return;
    }

    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;

    setPan((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Quiz mode functions
  const startQuiz = () => {
    const shuffled = [...diagram.labels].sort(() => Math.random() - 0.5);
    setQuizState({
      currentLabelIndex: 0,
      shuffledLabels: shuffled,
      results: [],
      startTime: Date.now(),
      showFeedback: false,
    });
    setShowLabels(false);
  };

  const handleQuizClick = (e: React.MouseEvent) => {
    if (!quizState || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const currentLabel = quizState.shuffledLabels[quizState.currentLabelIndex];
    if (!currentLabel) return; // Guard against undefined label

    const distance = Math.sqrt(
      Math.pow(clickX - currentLabel.position.x, 2) + Math.pow(clickY - currentLabel.position.y, 2)
    );

    // Within 8% of the target is considered correct
    const isCorrect = distance <= 8;

    const result = {
      labelId: currentLabel.id,
      selectedPosition: { x: clickX, y: clickY },
      isCorrect,
      distance,
    };

    setQuizState({
      ...quizState,
      results: [...quizState.results, result],
      showFeedback: true,
      lastClickPosition: { x: clickX, y: clickY },
    });
  };

  const nextQuizQuestion = () => {
    if (!quizState) return;

    const nextIndex = quizState.currentLabelIndex + 1;

    if (nextIndex >= quizState.shuffledLabels.length) {
      // Quiz complete
      const correct = quizState.results.filter((r) => r.isCorrect).length;
      const timeSpent = Date.now() - quizState.startTime;

      onQuizComplete?.({
        totalLabels: quizState.shuffledLabels.length,
        correct,
        incorrect: quizState.shuffledLabels.length - correct,
        accuracy: (correct / quizState.shuffledLabels.length) * 100,
        timeSpent,
        results: quizState.results,
      });

      setQuizState(null);
      setShowLabels(true);
    } else {
      setQuizState({
        ...quizState,
        currentLabelIndex: nextIndex,
        showFeedback: false,
        lastClickPosition: undefined,
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="aspect-video bg-[var(--color-bg-secondary)] rounded-2xl animate-pulse" />
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-[var(--color-bg-primary)] p-4' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{diagram.name}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            {diagram.region} • {visibleLabels.length} structures
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'explore' && (
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`p-2 rounded-lg ${
                showLabels
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
              }`}
              title={showLabels ? 'Hide Labels' : 'Show Labels'}
              aria-label={showLabels ? 'Hide labels' : 'Show labels'}
            >
              {showLabels ? <Eye className="h-5 w-5" aria-hidden="true" /> : <EyeOff className="h-5 w-5" aria-hidden="true" />}
            </button>
          )}

          {mode === 'quiz' && !quizState && (
            <button
              onClick={startQuiz}
              className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent)]/80"
            >
              Start Quiz
            </button>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Quiz prompt */}
      {quizState && quizState.shuffledLabels[quizState.currentLabelIndex] && (
        <div className="mb-4 p-4 bg-[var(--color-accent)]/10 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-accent)]">
                Question {quizState.currentLabelIndex + 1} of {quizState.shuffledLabels.length}
              </p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                Click on the:{' '}
                <span className="text-[var(--color-accent)]">
                  {quizState.shuffledLabels[quizState.currentLabelIndex]?.name}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[var(--color-text-muted)]">Score</p>
              <p className="text-2xl font-bold text-[var(--color-accent)]">
                {quizState.results.filter((r) => r.isCorrect).length}/{quizState.currentLabelIndex}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* Main Diagram Area */}
        <div
          ref={containerRef}
          className={`
            relative flex-1 aspect-video bg-[var(--color-bg-secondary)] rounded-2xl overflow-hidden
            ${mode === 'quiz' && quizState && !quizState.showFeedback ? 'cursor-crosshair' : 'cursor-move'}
          `}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Image with zoom/pan */}
          <div
            className="absolute inset-0 transition-transform"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={diagram.imageUrl}
              alt={diagram.name}
              className="w-full h-full object-contain select-none"
              draggable={false}
            />

            {/* Labels */}
            {showLabels &&
              visibleLabels.map((label) => (
                <motion.div
                  key={label.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`
                  absolute transform -translate-x-1/2 -translate-y-1/2
                  ${hoveredLabel === label.id || selectedLabel?.id === label.id ? 'z-20' : 'z-10'}
                `}
                  style={{
                    left: `${label.position.x}%`,
                    top: `${label.position.y}%`,
                  }}
                  onMouseEnter={() => setHoveredLabel(label.id)}
                  onMouseLeave={() => setHoveredLabel(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLabel(selectedLabel?.id === label.id ? null : label);
                  }}
                >
                  {/* Pin */}
                  <div
                    className={`
                    w-4 h-4 rounded-full cursor-pointer transition-all
                    ${
                      hoveredLabel === label.id || selectedLabel?.id === label.id
                        ? 'bg-[var(--color-accent)] scale-150 shadow-lg'
                        : 'bg-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/80'
                    }
                  `}
                  />

                  {/* Label tooltip */}
                  <AnimatePresence>
                    {(hoveredLabel === label.id || selectedLabel?.id === label.id) && (
                      <motion.div
                        initial={{ y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-inverse)] text-sm rounded-lg whitespace-nowrap shadow-lg"
                      >
                        {label.name}
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-[var(--color-bg-primary)]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

            {/* Quiz feedback markers */}
            {quizState?.showFeedback &&
              quizState.lastClickPosition &&
              quizState.results.length > 0 &&
              (() => {
                const lastResult = quizState.results[quizState.results.length - 1];
                const currentLabel = quizState.shuffledLabels[quizState.currentLabelIndex];
                if (!lastResult) return null;

                return (
                  <>
                    {/* User's click */}
                    <div
                      className={`
                      absolute w-6 h-6 rounded-full transform -translate-x-1/2 -translate-y-1/2
                      flex items-center justify-center
                      ${lastResult.isCorrect ? 'bg-[var(--color-data-pass)]' : 'bg-[var(--color-data-fail)]'}
                    `}
                      style={{
                        left: `${quizState.lastClickPosition.x}%`,
                        top: `${quizState.lastClickPosition.y}%`,
                      }}
                    >
                      {lastResult.isCorrect ? (
                        <CheckCircle className="h-4 w-4 text-[var(--color-text-inverse)]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[var(--color-text-inverse)]" />
                      )}
                    </div>

                    {/* Correct position if wrong */}
                    {!lastResult.isCorrect && currentLabel && (
                      <div
                        className="absolute w-6 h-6 rounded-full bg-[var(--color-data-pass)] transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center animate-pulse"
                        style={{
                          left: `${currentLabel.position.x}%`,
                          top: `${currentLabel.position.y}%`,
                        }}
                      >
                        <CheckCircle className="h-4 w-4 text-[var(--color-text-inverse)]" />
                      </div>
                    )}
                  </>
                );
              })()}
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[var(--color-bg-primary)]/90 rounded-lg p-2 shadow-lg">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded"
              disabled={zoom <= 0.5}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="text-sm font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded"
              disabled={zoom >= 3}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="w-px h-6 bg-[var(--color-border)]" />
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded"
              aria-label="Reset view"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Quiz feedback */}
          {quizState?.showFeedback &&
            quizState.results.length > 0 &&
            (() => {
              const lastResult = quizState.results[quizState.results.length - 1];
              const currentLabel = quizState.shuffledLabels[quizState.currentLabelIndex];
              if (!lastResult || !currentLabel) return null;

              return (
                <div className="absolute inset-x-4 bottom-16 p-4 bg-[var(--color-bg-primary)] rounded-xl shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {lastResult.isCorrect ? (
                        <CheckCircle className="h-8 w-8 text-[var(--color-data-pass)]" />
                      ) : (
                        <XCircle className="h-8 w-8 text-[var(--color-data-fail)]" />
                      )}
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">
                          {lastResult.isCorrect ? 'Correct!' : 'Not quite...'}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {currentLabel.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={nextQuizQuestion}
                      className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent)]/80 flex items-center gap-2"
                    >
                      {quizState.currentLabelIndex + 1 < quizState.shuffledLabels.length ? (
                        <>
                          Next <ChevronRight className="h-4 w-4" />
                        </>
                      ) : (
                        'View Results'
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
        </div>

        {/* Sidebar - Label Details */}
        {mode === 'explore' && (
          <div className="w-80 bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] p-4 max-h-[600px] overflow-y-auto">
            {/* Layer filter */}
            {diagram.layers && diagram.layers.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Layers
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveLayer('all')}
                    className={`px-3 py-1 text-xs rounded-full ${
                      activeLayer === 'all'
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    All
                  </button>
                  {diagram.layers.map((layer) => (
                    <button
                      key={layer}
                      onClick={() => setActiveLayer(layer)}
                      className={`px-3 py-1 text-xs rounded-full ${
                        activeLayer === layer
                          ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {layer}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected label details */}
            {selectedLabel ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedLabel.name}
                  </h4>
                  {selectedLabel.layer && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {selectedLabel.layer}
                    </span>
                  )}
                </div>

                <p className="text-sm text-[var(--color-text-secondary)]">
                  {selectedLabel.description}
                </p>

                {selectedLabel.clinicalRelevance && (
                  <div className="p-3 bg-[var(--color-data-provisional)]/10 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="h-4 w-4 text-[var(--color-data-provisional)]" />
                      <span className="text-sm font-medium text-[var(--color-data-provisional)]">
                        Clinical Relevance
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-data-provisional)]">
                      {selectedLabel.clinicalRelevance}
                    </p>
                  </div>
                )}

                {selectedLabel.relatedConditions && selectedLabel.relatedConditions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                      Related Conditions
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedLabel.relatedConditions.map((condition, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded text-xs text-[var(--color-text-secondary)]"
                        >
                          {condition}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <HelpCircle className="h-8 w-8 mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">
                  Click on a label pin to view details
                </p>
              </div>
            )}

            {/* Label list */}
            <div className="mt-6 border-t border-[var(--color-border)] pt-4">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                All Structures ({visibleLabels.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {visibleLabels.map((label) => (
                  <button
                    key={label.id}
                    onClick={() => setSelectedLabel(label)}
                    className={`
                      w-full px-3 py-2 text-left text-sm rounded-lg transition-colors
                      ${
                        selectedLabel?.id === label.id
                          ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                          : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                      }
                    `}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InteractiveDiagram;
