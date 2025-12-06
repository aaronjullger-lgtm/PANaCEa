import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, BookOpen, ExternalLink } from 'lucide-react';
import { getTodayInMedicine } from '@/data/modes/dailyRitualsData';

interface ThisDayInMedicineProps {
  onQuestionClick?: (questionIds: string[]) => void;
}

const ThisDayInMedicine: React.FC<ThisDayInMedicineProps> = ({ onQuestionClick }) => {
  const event = getTodayInMedicine();

  if (!event) {
    return null; // Don't show widget if no event today
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-600 rounded-lg">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            This Day in Medicine
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Event Content */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {event.year}
          </span>
          <div className="flex-1">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {event.title}
            </h4>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {event.description}
            </p>
          </div>
        </div>

        {/* Related Questions Link */}
        {event.relatedQuestions && event.relatedQuestions.length > 0 && (
          <button
            onClick={() => onQuestionClick?.(event.relatedQuestions!)}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Practice {event.relatedQuestions.length} Related Questions
          </button>
        )}

        {/* Learn More */}
        <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(event.title.replace(/\s+/g, '_'))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            Learn more on Wikipedia
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </motion.div>
  );
};

export default ThisDayInMedicine;
