/**
 * Bookmarks Panel Component
 * Displays and manages bookmarked questions for quick reference
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, BookmarkCheck, X, Search, Tag, Calendar, Trash2 } from 'lucide-react';
import type { Question } from '../types';

interface BookmarksPanelProps {
  bookmarkedQuestions: Question[];
  onRemoveBookmark: (question: Question) => void;
  onViewQuestion: (question: Question) => void;
  onClose: () => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarkedQuestions,
  onRemoveBookmark,
  onViewQuestion,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    bookmarkedQuestions.forEach(q => {
      q.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [bookmarkedQuestions]);
  
  // Filter bookmarks
  const filteredBookmarks = useMemo(() => {
    return bookmarkedQuestions.filter(q => {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Bookmark className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Your Bookmarks</h2>
                <p className="text-amber-100 text-sm">
                  {bookmarkedQuestions.length} question{bookmarkedQuestions.length !== 1 ? 's' : ''} saved
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
            />
          </div>
          
          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-slate-500" />
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedTag === null
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTag === tag
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
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
            <div className="text-center py-12">
              <div className="text-slate-400 dark:text-slate-600 mb-4">
                <Bookmark className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-lg mb-2">
                {bookmarkedQuestions.length === 0
                  ? 'No bookmarks yet'
                  : 'No bookmarks match your search'
                }
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                {bookmarkedQuestions.length === 0
                  ? 'Bookmark important questions while studying to find them quickly later'
                  : 'Try adjusting your search or filters'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {sortedBookmarks.map((question, index) => (
                  <motion.div
                    key={`${question.conditionId}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <BookmarkCheck className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                      
                      <div className="flex-1 min-w-0">
                        {/* Condition and Topic */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                            {question.system || question.topic}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {question.condition}
                          </span>
                        </div>
                        
                        {/* Question Preview */}
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {question.question}
                        </p>
                        
                        {/* Tags */}
                        {question.tags && question.tags.length > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            {question.tags.map(tag => (
                              <span
                                key={tag}
                                className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Metadata */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
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
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => onRemoveBookmark(question)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
