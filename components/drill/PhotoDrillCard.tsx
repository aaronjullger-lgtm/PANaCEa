/**
 * Photo Drill Card Component
 * 
 * High-intensity rapid-fire image recognition UI.
 * Features lazy loading, blur hash preview, and instant feedback.
 * 
 * @component
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, X, Clock, Zap } from 'lucide-react';
import { PhotoDrillQuestion } from '@/services/drill/photoDrill.service';

interface PhotoDrillCardProps {
  question: PhotoDrillQuestion;
  onAnswer: (isCorrect: boolean, timeMs: number) => void;
  showFeedback?: boolean;
}

export const PhotoDrillCard: React.FC<PhotoDrillCardProps> = ({
  question,
  onAnswer,
  showFeedback = true,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);

  // Shuffle options on mount
  useEffect(() => {
    const options = [question.correctAnswer, ...question.distractors];
    setShuffledOptions(options.sort(() => 0.5 - Math.random()));
    setSelectedAnswer(null);
    setIsCorrect(null);
    setImageLoaded(false);
  }, [question]);

  const handleSelectAnswer = (answer: string) => {
    if (selectedAnswer) return; // Already answered

    const responseTime = Date.now() - startTime;
    const correct = answer === question.correctAnswer;

    setSelectedAnswer(answer);
    setIsCorrect(correct);

    // Callback with result
    if (showFeedback) {
      setTimeout(() => {
        onAnswer(correct, responseTime);
      }, 1500); // Show feedback for 1.5s
    } else {
      onAnswer(correct, responseTime);
    }
  };

  const getOptionClassName = (option: string) => {
    const baseClasses = 'p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer hover:scale-105';
    
    if (!selectedAnswer) {
      return `${baseClasses} border-slate-300 hover:border-steel-blue-500 hover:bg-steel-blue-50`;
    }

    if (option === question.correctAnswer) {
      return `${baseClasses} border-sage-500 bg-sage-50`;
    }

    if (option === selectedAnswer && !isCorrect) {
      return `${baseClasses} border-dusty-rose-500 bg-dusty-rose-50`;
    }

    return `${baseClasses} border-slate-200 opacity-50`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-steel-blue-600" />
          <span className="text-sm font-medium text-slate-600">
            {question.modality === 'dermatology' ? 'Dermatology' : 'Radiology'} Drill
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Zap className="w-4 h-4" />
          <span>Rapid Fire</span>
        </div>
      </div>

      {/* Image Display */}
      <div className="relative aspect-video mb-6 rounded-xl overflow-hidden bg-slate-100">
        {/* BlurHash or Thumbnail Preview */}
        {!imageLoaded && question.thumbnailUrl && (
          <img
            src={question.thumbnailUrl}
            alt="Loading..."
            className="absolute inset-0 w-full h-full object-contain blur-sm"
          />
        )}

        {/* Main Image */}
        <img
          src={question.imageUrl}
          alt="Medical image for diagnosis"
          className={`w-full h-full object-contain transition-opacity duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
        />

        {/* Loading Indicator */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-steel-blue-500 border-t-transparent" />
          </div>
        )}

        {/* Feedback Overlay */}
        <AnimatePresence>
          {isCorrect !== null && showFeedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 flex items-center justify-center ${
                isCorrect ? 'bg-sage-500' : 'bg-dusty-rose-500'
              } bg-opacity-90`}
            >
              {isCorrect ? (
                <Check className="w-24 h-24 text-white" strokeWidth={3} />
              ) : (
                <X className="w-24 h-24 text-white" strokeWidth={3} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Question */}
      <h2 className="text-xl font-semibold text-slate-800 mb-4 text-center">
        What is the diagnosis?
      </h2>

      {/* Answer Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {shuffledOptions.map((option, index) => (
          <motion.button
            key={index}
            whileHover={!selectedAnswer ? { scale: 1.02 } : {}}
            whileTap={!selectedAnswer ? { scale: 0.98 } : {}}
            onClick={() => handleSelectAnswer(option)}
            disabled={!!selectedAnswer}
            className={getOptionClassName(option)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{option}</span>
              {selectedAnswer === option && (
                <>
                  {isCorrect ? (
                    <Check className="w-5 h-5 text-sage-600" />
                  ) : (
                    <X className="w-5 h-5 text-dusty-rose-600" />
                  )}
                </>
              )}
              {selectedAnswer && option === question.correctAnswer && selectedAnswer !== option && (
                <Check className="w-5 h-5 text-sage-600" />
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Metadata */}
      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
        <span>Difficulty: {question.difficulty}</span>
        {question.system && <span>System: {question.system}</span>}
      </div>
    </div>
  );
};

export default PhotoDrillCard;