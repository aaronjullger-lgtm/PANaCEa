import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';

interface FlashFeedbackProps {
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string;
  keyDifferentiator: string;
}

export const FlashFeedback: React.FC<FlashFeedbackProps> = ({
  isCorrect,
  correctAnswer,
  userAnswer,
  keyDifferentiator,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-md p-6 rounded-2xl shadow-2xl z-50
        ${isCorrect ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'}
        border-2 text-white`}
    >
      <div className="flex items-center gap-4 mb-4">
        {isCorrect ? (
          <CheckCircle className="w-8 h-8 text-green-400" />
        ) : (
          <XCircle className="w-8 h-8 text-red-400" />
        )}
        <h2 className="text-2xl font-bold">
          {isCorrect ? 'Correct!' : 'Incorrect'}
        </h2>
      </div>
      <div className="space-y-2">
        {!isCorrect && (
          <p className="text-lg">
            Your answer: <span className="font-semibold">{userAnswer}</span>
          </p>
        )}
        <p className="text-lg">
          Correct answer: <span className="font-semibold">{correctAnswer}</span>
        </p>
        <div className="pt-2 mt-2 border-t border-white/20">
          <p className="text-lg font-bold text-yellow-300">
            Key Differentiator:
          </p>
          <p className="text-lg">{keyDifferentiator}</p>
        </div>
      </div>
    </motion.div>
  );
};
