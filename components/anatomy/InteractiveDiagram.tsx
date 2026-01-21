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
  const [showLabels, setShowLabels] = useState(initialShowLabels);
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
      <div className="aspect-video bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{diagram.name}</h3>
          <p className="text-sm text-slate-500">
            {diagram.region} • {visibleLabels.length} structures
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'explore' && (
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`p-2 rounded-lg ${
                showLabels ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
              }`}
              title={showLabels ? 'Hide Labels' : 'Show Labels'}
            >
              {showLabels ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          )}

          {mode === 'quiz' && !quizState && (
            <button
              onClick={startQuiz}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Start Quiz
            </button>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Quiz prompt */}
      {quizState && quizState.shuffledLabels[quizState.currentLabelIndex] && (
        <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                Question {quizState.currentLabelIndex + 1} of {quizState.shuffledLabels.length}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                Click on the:{' '}
                <span className="text-indigo-600">
                  {quizState.shuffledLabels[quizState.currentLabelIndex]?.name}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Score</p>
              <p className="text-2xl font-bold text-indigo-600">
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
            relative flex-1 aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden
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
                        ? 'bg-indigo-600 scale-150 shadow-lg'
                        : 'bg-red-500 hover:bg-red-600'
                    }
                  `}
                  />

                  {/* Label tooltip */}
                  <AnimatePresence>
                    {(hoveredLabel === label.id || selectedLabel?.id === label.id) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg whitespace-nowrap shadow-lg"
                      >
                        {label.name}
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-slate-900" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

            {/* Quiz feedback markers */}
            {quizState?.showFeedback && quizState.lastClickPosition && quizState.results.length > 0 && (() => {
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
                      ${lastResult.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}
                    `}
                    style={{
                      left: `${quizState.lastClickPosition.x}%`,
                      top: `${quizState.lastClickPosition.y}%`,
                    }}
                  >
                    {lastResult.isCorrect ? (
                      <CheckCircle className="h-4 w-4 text-white" />
                    ) : (
                      <XCircle className="h-4 w-4 text-white" />
                    )}
                  </div>

                  {/* Correct position if wrong */}
                  {!lastResult.isCorrect && currentLabel && (
                    <div
                      className="absolute w-6 h-6 rounded-full bg-emerald-500 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center animate-pulse"
                      style={{
                        left: `${currentLabel.position.x}%`,
                        top: `${currentLabel.position.y}%`,
                      }}
                    >
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 rounded-lg p-2 shadow-lg">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Quiz feedback */}
          {quizState?.showFeedback && quizState.results.length > 0 && (() => {
            const lastResult = quizState.results[quizState.results.length - 1];
            const currentLabel = quizState.shuffledLabels[quizState.currentLabelIndex];
            if (!lastResult || !currentLabel) return null;
            
            return (
              <div className="absolute inset-x-4 bottom-16 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {lastResult.isCorrect ? (
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                    ) : (
                      <XCircle className="h-8 w-8 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {lastResult.isCorrect
                          ? 'Correct!'
                          : 'Not quite...'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {currentLabel.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={nextQuizQuestion}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
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
          <div className="w-80 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 max-h-[600px] overflow-y-auto">
            {/* Layer filter */}
            {diagram.layers && diagram.layers.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Layers
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveLayer('all')}
                    className={`px-3 py-1 text-xs rounded-full ${
                      activeLayer === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
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
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
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
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedLabel.name}
                  </h4>
                  {selectedLabel.layer && (
                    <span className="text-xs text-slate-500">{selectedLabel.layer}</span>
                  )}
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedLabel.description}
                </p>

                {selectedLabel.clinicalRelevance && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Clinical Relevance
                      </span>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      {selectedLabel.clinicalRelevance}
                    </p>
                  </div>
                )}

                {selectedLabel.relatedConditions && selectedLabel.relatedConditions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Related Conditions
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedLabel.relatedConditions.map((condition, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300"
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
                <HelpCircle className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">Click on a label pin to view details</p>
              </div>
            )}

            {/* Label list */}
            <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
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
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
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