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
      className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-slate-700 rounded-lg">
          <Calendar className="w-5 h-5 text-slate-200" />
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
          <span className="text-3xl font-bold text-slate-700 dark:text-slate-300">
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
            className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Practice {event.relatedQuestions.length} Related Questions
          </button>
        )}

        {/* Learn More */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(event.title.replace(/\s+/g, '_'))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:underline"
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
