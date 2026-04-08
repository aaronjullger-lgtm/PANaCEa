/**
 * BookmarksPanel - Displays bookmarked questions (To Review / MenuView)
 *
 * Shows user's bookmarked questions with search and tag filters.
 * For condition bookmarks (library), use components/library/BookmarksPanel.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, BookmarkCheck, X, Search, Tag, Calendar, Trash2 } from 'lucide-react';
import type { Question } from '@/types';

interface BookmarksPanelProps {
  bookmarkedQuestions: Question[];
  onRemoveBookmark: (question: Question) => void;
  onViewQuestion: (question: Question) => void;
  onClose: () => void;
  /** Optional: Start a session when user has no bookmarks */
  onStartSession?: () => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarkedQuestions,
  onRemoveBookmark,
  onViewQuestion,
  onClose,
  onStartSession,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    bookmarkedQuestions.forEach((q) => {
      q.tags?.forEach((tag: string) => tags.add(tag));
    });
    return Array.from(tags);
  }, [bookmarkedQuestions]);

  // Filter bookmarks
  const filteredBookmarks = useMemo(() => {
    return bookmarkedQuestions.filter((q) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          q.question.toLowerCase().includes(query) ||
          q.condition.toLowerCase().includes(query) ||
          q.topic.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Tag filter
      if (selectedTag && !q.tags?.includes(selectedTag)) {
        return false;
      }

      return true;
    });
  }, [bookmarkedQuestions, searchQuery, selectedTag]);

  // Sort by most recently bookmarked
  const sortedBookmarks = useMemo(() => {
    return [...filteredBookmarks].sort((a, b) => {
      const aTime = a.bookmarkedAt || 0;
      const bTime = b.bookmarkedAt || 0;
      return bTime - aTime;
    });
  }, [filteredBookmarks]);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={false}
      animate={{}}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-[var(--color-text-inverse)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-bg-primary)]/20 rounded-lg backdrop-blur-sm">
                <Bookmark className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Your Bookmarks</h2>
                <p className="text-data-provisional text-sm">
                  {bookmarkedQuestions.length} question{bookmarkedQuestions.length !== 1 ? 's' : ''}{' '}
                  saved
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-bg-primary)]/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-data-neutral dark:border-data-neutral space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-data-neutral" />
            <input
              type="text"
              placeholder="Search bookmarks..."
              aria-label="Search bookmarks"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent outline-none"
            />
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-data-neutral" />
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedTag === null
                    ? 'bg-data-provisional text-[var(--color-text-inverse)]'
                    : 'bg-data-neutral dark:bg-data-neutral text-data-neutral dark:text-data-neutral hover:bg-data-neutral dark:hover:bg-data-neutral'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTag === tag
                      ? 'bg-data-provisional text-[var(--color-text-inverse)]'
                      : 'bg-data-neutral dark:bg-data-neutral text-data-neutral dark:text-data-neutral hover:bg-data-neutral dark:hover:bg-data-neutral'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedBookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-[var(--color-bg-tertiary)] mb-4">
                <Bookmark className="w-12 h-12 text-[var(--color-text-muted)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {bookmarkedQuestions.length === 0
                  ? 'No bookmarks yet'
                  : 'No bookmarks match your search'}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md">
                {bookmarkedQuestions.length === 0
                  ? 'Bookmark important questions while studying to find them quickly later.'
                  : 'Try adjusting your search or filters.'}
              </p>
              {bookmarkedQuestions.length === 0 && onStartSession && (
                <button
                  onClick={() => {
                    onClose();
                    onStartSession();
                  }}
                  className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  Start your first session
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {sortedBookmarks.map((question, index) => (
                  <motion.div
                    key={`${question.conditionId}-${index}`}
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <BookmarkCheck className="w-5 h-5 text-data-provisional flex-shrink-0 mt-1" />

                      <div className="flex-1 min-w-0">
                        {/* Condition and Topic */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-block px-2 py-1 bg-[var(--color-category-practice)] bg-[var(--color-category-practice)] text-[var(--color-category-practice)] text-xs font-medium rounded">
                            {question.system || question.topic}
                          </span>
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {question.condition}
                          </span>
                        </div>

                        {/* Question Preview */}
                        <p
                          className="text-sm text-data-neutral dark:text-data-neutral mb-2 overflow-hidden"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {question.question}
                        </p>

                        {/* Tags */}
                        {question.tags && question.tags.length > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            {question.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="inline-block px-2 py-0.5 bg-data-neutral dark:bg-data-neutral text-data-neutral dark:text-data-neutral text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-4 text-xs text-data-neutral dark:text-data-neutral">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(question.bookmarkedAt)}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => onViewQuestion(question)}
                          className="px-3 py-1.5 bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] text-sm rounded-lg transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => onRemoveBookmark(question)}
                          className="p-1.5 text-data-fail hover:bg-data-fail dark:hover:bg-data-fail/20 rounded-lg transition-colors"
                          aria-label="Remove bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BookmarksPanel;
