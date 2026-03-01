/**
 * BookmarksPanel - Displays bookmarked conditions
 *
 * Shows user's bookmarked conditions with optional notes
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, ChevronRight, X, Trash2, Edit3, Check, MessageSquare } from 'lucide-react';

interface BookmarkedCondition {
  id: string;
  condition: string;
  system?: string;
  bookmarkedAt: string;
  notes?: string;
}

interface BookmarksPanelProps {
  bookmarks: BookmarkedCondition[];
  onConditionClick: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAddNote?: (id: string, note: string) => void;
}

/**
 * Simple relative time formatter
 */
function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

const BookmarkItem: React.FC<{
  bookmark: BookmarkedCondition;
  onClick: () => void;
  onRemove: () => void;
  onAddNote?: (note: string) => void;
}> = ({ bookmark, onClick, onRemove, onAddNote }) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(bookmark.notes || '');

  const handleSaveNote = () => {
    if (onAddNote) {
      onAddNote(noteText);
    }
    setIsEditingNote(false);
  };

  return (
    <div className="group">
      <button
        onClick={onClick}
        className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-bg-secondary)]/80 transition-colors flex items-center gap-2"
      >
        <Bookmark className="w-3 h-3 text-data-provisional fill-data-provisional flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-secondary)] truncate group-hover:text-[var(--color-text-primary)] transition-colors">
            {bookmark.condition}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
            {bookmark.system && <span className="truncate">{bookmark.system}</span>}
            {bookmark.system && <span>•</span>}
            <span>{formatRelativeTime(bookmark.bookmarkedAt)}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
          {onAddNote && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingNote(true);
              }}
              className="p-1 hover:bg-[var(--color-bg-secondary)] rounded transition-colors"
              title="Add note"
            >
              <MessageSquare className="w-3 h-3 text-[var(--color-text-muted)]" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 hover:bg-data-fail/20 rounded transition-colors"
            title="Remove bookmark"
          >
            <X className="w-3 h-3 text-[var(--color-text-muted)] hover:text-data-fail" />
          </button>
        </div>
      </button>

      {/* Notes section */}
      {(bookmark.notes || isEditingNote) && (
        <div className="ml-6 px-3 py-1">
          {isEditingNote ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNote();
                  if (e.key === 'Escape') setIsEditingNote(false);
                }}
              />
              <button
                onClick={handleSaveNote}
                className="p-1 hover:bg-data-pass/20 rounded transition-colors"
              >
                <Check className="w-3 h-3 text-data-pass" />
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-[var(--color-text-muted)] italic flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" />
              {bookmark.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarks,
  onConditionClick,
  onRemove,
  onClearAll,
  onAddNote,
}) => {
  if (bookmarks.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <Bookmark className="w-8 h-8 mx-auto text-[var(--color-text-muted)] opacity-50 mb-2" />
        <p className="text-xs text-[var(--color-text-muted)]">No bookmarked conditions</p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Click the bookmark icon on any card to save it
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
          <Bookmark className="w-3 h-3 fill-data-provisional text-data-provisional" />
          Bookmarks ({bookmarks.length})
        </span>
        <button
          onClick={onClearAll}
          className="text-xs text-[var(--color-text-muted)] hover:text-data-fail transition-colors flex items-center gap-1"
          title="Clear all bookmarks"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Bookmarks list */}
      <AnimatePresence>
        {bookmarks.map((bookmark, index) => (
          <motion.div
            key={bookmark.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ delay: index * 0.05 }}
          >
            <BookmarkItem
              bookmark={bookmark}
              onClick={() => onConditionClick(bookmark.id)}
              onRemove={() => onRemove(bookmark.id)}
              onAddNote={onAddNote ? (note) => onAddNote(bookmark.id, note) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default BookmarksPanel;
