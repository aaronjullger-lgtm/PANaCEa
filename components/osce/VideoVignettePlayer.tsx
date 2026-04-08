/**
 * Video Vignette Player
 * Displays video-based clinical scenarios for visual diagnostic training
 * Phase 18: Requirement 68
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Lightbulb,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface VideoVignettePlayerProps {
  videoUrl: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  onAnswer: (isCorrect: boolean) => void;
}

type VideoType = 'seizure' | 'gait' | 'tremor' | 'rash' | 'cardiac_exam';

export const VideoVignettePlayer: React.FC<VideoVignettePlayerProps> = React.memo(
  ({ videoUrl, question, options, correctAnswerIndex, explanation, onAnswer }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hasWatchedOnce, setHasWatchedOnce] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Throttle timeupdate to rAF cadence (~60fps → 1 setState per frame max)
      // instead of the default ~4 updates/sec that each trigger a full re-render.
      let rafId: number | null = null;
      const handleTimeUpdate = () => {
        if (rafId !== null) return; // Already scheduled
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setCurrentTime(video.currentTime);
        });
      };
      const handleLoadedMetadata = () => setDuration(video.duration);
      const handleEnded = () => {
        setIsPlaying(false);
        setHasWatchedOnce(true);
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('ended', handleEnded);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('ended', handleEnded);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }, []);

    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;

      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
      const video = videoRef.current;
      if (!video) return;

      video.muted = !isMuted;
      setIsMuted(!isMuted);
    };

    const handleRestart = () => {
      const video = videoRef.current;
      if (!video) return;

      video.currentTime = 0;
      video.play();
      setIsPlaying(true);
      setCurrentTime(0);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;

      const time = parseFloat(e.target.value);
      video.currentTime = time;
      setCurrentTime(time);
    };

    const handleAnswerSelect = (index: number) => {
      if (selectedAnswer !== null) return; // Already answered

      setSelectedAnswer(index);
      setShowFeedback(true);
      const isCorrect = index === correctAnswerIndex;
      onAnswer(isCorrect);
    };

    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getAnswerClass = (index: number): string => {
      if (selectedAnswer === null) {
        return 'border-[var(--color-border)] hover:border-[var(--color-category-practice)] hover:bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)]';
      }
      if (index === correctAnswerIndex) {
        return 'border-data-pass bg-data-pass dark:bg-data-pass/20';
      }
      if (index === selectedAnswer) {
        return 'border-data-fail bg-data-fail dark:bg-data-fail/20';
      }
      return 'border-[var(--color-border)] opacity-50';
    };

    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-[var(--color-accent)] rounded-xl p-6 text-[var(--color-text-inverse)]">
          <h2 className="text-2xl font-bold mb-2">Visual Diagnostic Challenge</h2>
          <p className="text-[var(--color-text-inverse)]/90">Watch carefully and identify the clinical finding</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-lg overflow-hidden">
              {/* Video Container */}
              <div className="relative bg-[var(--color-bg-primary)] aspect-video">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  playsInline
                >
                  Your browser does not support video playback.
                </video>

                {/* Overlay Play Button */}
                {!isPlaying && currentTime === 0 && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-[var(--color-overlay)] hover:opacity-90 transition-opacity group"
                  >
                    <div className="w-20 h-20 bg-[var(--color-bg-primary)]/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-10 h-10 text-[var(--color-accent)] ml-1" />
                    </div>
                  </motion.button>
                )}
              </div>

              {/* Video Controls */}
              <div className="p-4 bg-[var(--color-bg-tertiary)]">
                {/* Progress Bar */}
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer mb-4"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`,
                  }}
                />

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-full hover:bg-[var(--color-accent)]/80 transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={handleRestart}
                      className="p-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-border)] transition-colors"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={toggleMute}
                      className="p-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-border)] transition-colors"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)] font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
              </div>
            </div>

            {/* Watch Reminder */}
            {!hasWatchedOnce && (
              <motion.div
                initial={{ y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] border border-[var(--color-category-practice)] rounded-lg p-4"
              >
                <p className="text-sm text-[var(--color-category-practice)] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-data-provisional flex-shrink-0" />
                  <span>Watch the full video at least once before answering</span>
                </p>
              </motion.div>
            )}
          </div>

          {/* Question & Options */}
          <div className="space-y-4">
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
                {question}
              </h3>

              <div className="space-y-3">
                {options.map((option, index) => (
                  <motion.button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={selectedAnswer !== null}
                    whileHover={{ scale: selectedAnswer === null ? 1.02 : 1 }}
                    whileTap={{ scale: selectedAnswer === null ? 0.98 : 1 }}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all ${getAnswerClass(index)}
                    disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-current flex items-center justify-center mt-0.5">
                        {index === correctAnswerIndex && selectedAnswer !== null && (
                          <div className="w-3 h-3 bg-current rounded-full" />
                        )}
                      </div>
                      <span className="text-sm text-[var(--color-text-primary)] font-medium">
                        {option}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Panel */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`rounded-xl p-6 ${
                selectedAnswer === correctAnswerIndex
                  ? 'bg-data-pass dark:bg-data-pass/20 border-2 border-data-pass'
                  : 'bg-data-fail dark:bg-data-fail/20 border-2 border-data-fail'
              }`}
            >
              <h4
                className={`text-xl font-bold mb-3 flex items-center gap-2 ${
                  selectedAnswer === correctAnswerIndex
                    ? 'text-data-pass dark:text-data-pass'
                    : 'text-data-fail dark:text-data-fail'
                }`}
              >
                {selectedAnswer === correctAnswerIndex ? (
                  <>
                    <CheckCircle className="w-6 h-6" /> Correct!
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6" /> Incorrect
                  </>
                )}
              </h4>
              <p className="text-[var(--color-text-secondary)] whitespace-pre-line">
                {explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

VideoVignettePlayer.displayName = 'VideoVignettePlayer';

export default VideoVignettePlayer;
