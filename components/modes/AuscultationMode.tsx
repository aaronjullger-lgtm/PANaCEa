/**
 * Auscultation Mode Component
 * Sprint 9: Multimodal Content Expansion - Heart and lung sound training
 *
 * Interactive audio-based learning for cardiac and pulmonary auscultation.
 * Features waveform visualization, adjustable playback, and quiz mode.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Heart,
  Wind,
  Stethoscope,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronRight,
  Filter,
  Clock,
  Award,
  Shuffle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface AuscultationSound {
  id: string;
  name: string;
  type: 'heart' | 'lung';
  category: string;
  location: string;
  audioUrl: string;
  waveformData?: number[];
  description: string;
  clinicalSignificance: string;
  associatedConditions: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface AuscultationModeProps {
  sounds: AuscultationSound[];
  mode?: 'learn' | 'quiz';
  onComplete?: (results: QuizResult) => void;
  isLoading?: boolean;
}

interface QuizResult {
  totalQuestions: number;
  correct: number;
  accuracy: number;
  timeSpent: number;
  results: Array<{
    soundId: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timeToAnswer: number;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HEART_LOCATIONS = [
  { id: 'aortic', name: 'Aortic', position: { x: 60, y: 25 } },
  { id: 'pulmonic', name: 'Pulmonic', position: { x: 40, y: 25 } },
  { id: 'erbs', name: "Erb's Point", position: { x: 50, y: 40 } },
  { id: 'tricuspid', name: 'Tricuspid', position: { x: 50, y: 55 } },
  { id: 'mitral', name: 'Mitral (Apex)', position: { x: 35, y: 60 } },
];

const LUNG_LOCATIONS = [
  { id: 'right_upper', name: 'Right Upper', position: { x: 65, y: 20 } },
  { id: 'left_upper', name: 'Left Upper', position: { x: 35, y: 20 } },
  { id: 'right_middle', name: 'Right Middle', position: { x: 70, y: 40 } },
  { id: 'left_middle', name: 'Left Middle', position: { x: 30, y: 40 } },
  { id: 'right_lower', name: 'Right Lower', position: { x: 65, y: 60 } },
  { id: 'left_lower', name: 'Left Lower', position: { x: 35, y: 60 } },
];

const HEART_SOUND_CATEGORIES = [
  'Normal',
  'Murmur - Systolic',
  'Murmur - Diastolic',
  'Murmur - Continuous',
  'Extra Sounds (S3, S4)',
  'Friction Rubs',
  'Clicks',
];

const LUNG_SOUND_CATEGORIES = [
  'Normal',
  'Wheezes',
  'Crackles (Rales)',
  'Rhonchi',
  'Stridor',
  'Pleural Rubs',
  'Diminished/Absent',
];

// =============================================================================
// COMPONENT
// =============================================================================

export function AuscultationMode({
  sounds,
  mode = 'learn',
  onComplete,
  isLoading = false,
}: AuscultationModeProps) {
  // State
  const [activeTab, setActiveTab] = useState<'heart' | 'lung'>('heart');
  const [selectedSound, setSelectedSound] = useState<AuscultationSound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  // Quiz mode state
  const [quizState, setQuizState] = useState<{
    currentIndex: number;
    answers: QuizResult['results'];
    startTime: number;
    questionStartTime: number;
    shuffledOptions: string[];
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);

  // Filter sounds
  const filteredSounds = useMemo(() => {
    return sounds.filter((sound) => {
      if (sound.type !== activeTab) return false;
      if (categoryFilter !== 'all' && sound.category !== categoryFilter) return false;
      if (difficultyFilter !== 'all' && sound.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [sounds, activeTab, categoryFilter, difficultyFilter]);

  // Quiz sounds (shuffled)
  const quizSounds = useMemo(() => {
    if (mode !== 'quiz') return [];
    const shuffled = [...filteredSounds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(10, shuffled.length));
  }, [filteredSounds, mode]);

  // Audio controls
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (!isLooping) setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isLooping]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.loop = isLooping;
    }
  }, [playbackRate, volume, isMuted, isLooping]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipBack = () => seek(Math.max(0, currentTime - 2));
  const skipForward = () => seek(Math.min(duration, currentTime + 2));

  // Start quiz
  const startQuiz = () => {
    if (quizSounds.length === 0) return;

    const firstSound = quizSounds[0];
    if (!firstSound) return;

    const options = generateOptions(firstSound);
    setQuizState({
      currentIndex: 0,
      answers: [],
      startTime: Date.now(),
      questionStartTime: Date.now(),
      shuffledOptions: options,
    });
    setSelectedSound(firstSound);
    setShowAnswer(false);
  };

  // Generate quiz options
  const generateOptions = (correctSound: AuscultationSound): string[] => {
    const correctAnswer = correctSound.name;
    const otherSounds = sounds
      .filter((s) => s.type === correctSound.type && s.id !== correctSound.id)
      .map((s) => s.name);

    const shuffledOthers = otherSounds.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correctAnswer, ...shuffledOthers].sort(() => Math.random() - 0.5);

    return options;
  };

  // Handle quiz answer
  const handleAnswer = (answer: string) => {
    if (!quizState || !selectedSound || showAnswer) return;

    const isCorrect = answer === selectedSound.name;
    const timeToAnswer = Date.now() - quizState.questionStartTime;

    const result = {
      soundId: selectedSound.id,
      selectedAnswer: answer,
      correctAnswer: selectedSound.name,
      isCorrect,
      timeToAnswer,
    };

    setQuizState({
      ...quizState,
      answers: [...quizState.answers, result],
    });
    setShowAnswer(true);
  };

  // Next quiz question
  const nextQuestion = () => {
    if (!quizState) return;

    const nextIndex = quizState.currentIndex + 1;

    if (nextIndex >= quizSounds.length) {
      // Quiz complete
      const totalTime = Date.now() - quizState.startTime;
      const correct = quizState.answers.filter((a) => a.isCorrect).length;

      onComplete?.({
        totalQuestions: quizSounds.length,
        correct,
        accuracy: quizSounds.length > 0 ? (correct / quizSounds.length) * 100 : 0,
        timeSpent: totalTime,
        results: quizState.answers,
      });

      setQuizState(null);
      setSelectedSound(null);
    } else {
      // Next question
      const nextSound = quizSounds[nextIndex];
      if (!nextSound) return;

      const options = generateOptions(nextSound);

      setQuizState({
        ...quizState,
        currentIndex: nextIndex,
        questionStartTime: Date.now(),
        shuffledOptions: options,
      });
      setSelectedSound(nextSound);
      setShowAnswer(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-data-neutral rounded-xl" />
        <div className="h-64 bg-data-neutral rounded-xl" />
        <div className="h-32 bg-data-neutral rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-8 w-8 text-[var(--color-accent)]" />
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Auscultation Training
            </h2>
            <p className="text-sm text-data-neutral">
              {mode === 'learn' ? 'Learn heart and lung sounds' : 'Test your knowledge'}
            </p>
          </div>
        </div>

        {mode === 'quiz' && !quizState && (
          <button
            onClick={startQuiz}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent)]/80 flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start Quiz
          </button>
        )}
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 p-1 bg-data-neutral rounded-xl">
        <button
          onClick={() => setActiveTab('heart')}
          className={`
            flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors
            ${
              activeTab === 'heart'
                ? 'bg-[var(--color-bg-primary)] text-data-fail shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]'
                : 'text-data-neutral hover:text-[var(--color-text-primary)]'
            }
          `}
        >
          <Heart className="h-5 w-5" />
          Heart Sounds
        </button>
        <button
          onClick={() => setActiveTab('lung')}
          className={`
            flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors
            ${
              activeTab === 'lung'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-category-practice)] shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]'
                : 'text-data-neutral hover:text-[var(--color-text-primary)]'
            }
          `}
        >
          <Wind className="h-5 w-5" />
          Lung Sounds
        </button>
      </div>

      {/* Filters (Learn Mode) */}
      {mode === 'learn' && (
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-data-neutral" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-bg-primary)] border border-data-neutral"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {(activeTab === 'heart' ? HEART_SOUND_CATEGORIES : LUNG_SOUND_CATEGORIES).map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                )
              )}
            </select>
          </div>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-bg-primary)] border border-data-neutral"
            aria-label="Filter by difficulty level"
          >
            <option value="all">All Levels</option>
            <option value="basic">Basic</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sound List / Quiz Mode */}
        <div className="lg:col-span-1">
          {quizState ? (
            // Quiz Mode
            <div className="bg-[var(--color-bg-primary)] rounded-2xl border border-data-neutral p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-data-neutral">
                  Question {quizState.currentIndex + 1} of {quizSounds.length}
                </span>
                <span className="text-sm font-medium text-[var(--color-accent)]">
                  {quizState.answers.filter((a) => a.isCorrect).length} correct
                </span>
              </div>

              <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                What sound is this?
              </h3>

              <div className="space-y-2">
                {quizState.shuffledOptions.map((option, index) => {
                  const isSelected =
                    quizState.answers[quizState.currentIndex]?.selectedAnswer === option;
                  const isCorrect = option === selectedSound?.name;

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswer(option)}
                      disabled={showAnswer}
                      className={`
                        w-full p-3 rounded-xl border-2 text-left transition-all
                        ${
                          showAnswer
                            ? isCorrect
                              ? 'border-data-pass bg-data-pass/20'
                              : isSelected
                                ? 'border-data-fail bg-data-fail/20'
                                : 'border-data-neutral'
                            : 'border-data-neutral hover:border-[var(--color-accent)]/50'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {option}
                        </span>
                        {showAnswer &&
                          (isCorrect || isSelected) &&
                          (isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-data-pass" />
                          ) : (
                            <XCircle className="h-5 w-5 text-data-fail" />
                          ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {showAnswer && (
                <button
                  onClick={nextQuestion}
                  className="mt-4 w-full py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl hover:bg-[var(--color-accent)]/80 flex items-center justify-center gap-2"
                >
                  {quizState.currentIndex + 1 < quizSounds.length ? (
                    <>
                      Next Question <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      View Results <Award className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            // Learn Mode - Sound List
            <div className="bg-[var(--color-bg-primary)] rounded-2xl border border-data-neutral p-4 max-h-[500px] overflow-y-auto">
              <h3 className="font-medium text-[var(--color-text-primary)] mb-4">
                {activeTab === 'heart' ? 'Heart' : 'Lung'} Sounds ({filteredSounds.length})
              </h3>

              <div className="space-y-2">
                {filteredSounds.map((sound) => (
                  <button
                    key={sound.id}
                    onClick={() => {
                      setSelectedSound(sound);
                      setIsPlaying(false);
                    }}
                    className={`
                      w-full p-3 rounded-xl text-left transition-all
                      ${
                        selectedSound?.id === sound.id
                          ? 'bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]'
                          : 'bg-data-neutral/50 border-2 border-transparent hover:border-data-neutral'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">{sound.name}</p>
                        <p className="text-xs text-data-neutral">{sound.category}</p>
                      </div>
                      <span
                        className={`
                        px-2 py-0.5 text-xs rounded-full
                        ${
                          sound.difficulty === 'basic'
                            ? 'bg-data-pass text-data-pass'
                            : sound.difficulty === 'intermediate'
                              ? 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
                              : 'bg-data-fail text-data-fail'
                        }
                      `}
                      >
                        {sound.difficulty}
                      </span>
                    </div>
                  </button>
                ))}

                {filteredSounds.length === 0 && (
                  <p className="text-center text-data-neutral py-8">No sounds match your filters</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Player & Info */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSound ? (
            <>
              {/* Audio Player */}
              <div className="bg-[var(--color-bg-primary)] rounded-2xl border border-data-neutral p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                    {selectedSound.name}
                  </h3>
                  <span className="px-3 py-1 bg-data-neutral rounded-full text-sm">
                    {selectedSound.location}
                  </span>
                </div>

                {/* Animated waveform visualization */}
                <div className="h-24 bg-data-neutral rounded-xl mb-4 flex items-center justify-center">
                  <div className="flex items-end gap-1">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className={`w-1.5 rounded-full ${
                          activeTab === 'heart' ? 'bg-data-fail' : 'bg-[var(--color-category-practice)]'
                        }`}
                        animate={{
                          height: isPlaying ? [20, Math.random() * 60 + 20, 20] : 20,
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: isPlaying ? Infinity : 0,
                          delay: i * 0.02,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => seek(Number.parseFloat(e.target.value))}
                    className="w-full h-2 bg-data-neutral rounded-full appearance-none cursor-pointer"
                    aria-label="Playback position"
                  />
                  <div className="flex justify-between text-xs text-data-neutral mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setIsLooping(!isLooping)}
                    className={`p-2 rounded-full ${
                      isLooping ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'text-data-neutral'
                    }`}
                    aria-label={isLooping ? 'Disable loop' : 'Loop track'}
                  >
                    <Repeat className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={skipBack}
                    className="p-2 text-data-neutral hover:text-data-neutral"
                    aria-label="Skip back 2 seconds"
                  >
                    <SkipBack className="h-6 w-6" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-4 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent)]/80"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </button>

                  <button
                    type="button"
                    onClick={skipForward}
                    className="p-2 text-data-neutral hover:text-data-neutral"
                    aria-label="Skip forward 2 seconds"
                  >
                    <SkipForward className="h-6 w-6" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-2 rounded-full ${isMuted ? 'text-[var(--color-data-fail)]' : 'text-[var(--color-text-muted)]'}`}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                </div>

                {/* Speed control */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  <span className="text-xs text-data-neutral">Speed:</span>
                  {[0.5, 0.75, 1, 1.25].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`
                        px-2 py-1 text-xs rounded
                        ${
                          playbackRate === rate
                            ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                            : 'bg-data-neutral text-data-neutral'
                        }
                      `}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {/* Hidden audio element */}
                <audio ref={audioRef} src={selectedSound.audioUrl} preload="auto" />
              </div>

              {/* Sound Info (Learn Mode) */}
              {mode === 'learn' && (
                <div className="bg-[var(--color-bg-primary)] rounded-2xl border border-data-neutral p-6">
                  <h4 className="font-semibold text-[var(--color-text-primary)] mb-3">
                    Description
                  </h4>
                  <p className="text-data-neutral mb-4">
                    {selectedSound.description}
                  </p>

                  <h4 className="font-semibold text-[var(--color-text-primary)] mb-3">
                    Clinical Significance
                  </h4>
                  <p className="text-data-neutral mb-4">
                    {selectedSound.clinicalSignificance}
                  </p>

                  {selectedSound.associatedConditions.length > 0 && (
                    <>
                      <h4 className="font-semibold text-[var(--color-text-primary)] mb-3">
                        Associated Conditions
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSound.associatedConditions.map((condition, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-data-neutral rounded-full text-sm text-data-neutral"
                          >
                            {condition}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            // Empty state
            <div className="bg-data-neutral/50 rounded-2xl border-2 border-dashed border-data-neutral p-12 text-center">
              <Stethoscope className="h-12 w-12 mx-auto text-data-neutral mb-4" />
              <p className="text-data-neutral">
                Select a sound from the list to begin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function
function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default AuscultationMode;
