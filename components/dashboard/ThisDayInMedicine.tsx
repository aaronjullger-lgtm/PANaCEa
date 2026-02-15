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
        <div className="p-2 bg-[var(--color-accent)]/20 rounded-lg">
          <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            This Day in Medicine
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Event Content */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <span className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">
            {event.year}
          </span>
          <div className="flex-1">
            <h4 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
              {event.title}
            </h4>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              {event.description}
            </p>
          </div>
        </div>

        {/* Related Questions Link */}
        {event.relatedQuestions && event.relatedQuestions.length > 0 && (
          <button
            onClick={() => onQuestionClick?.(event.relatedQuestions!)}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-text-inverse)] py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Practice {event.relatedQuestions.length} Related Questions
          </button>
        )}

        {/* Learn More */}
        <div className="pt-3 border-t border-[var(--color-border)]">
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(event.title.replace(/\s+/g, '_'))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:underline"
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
