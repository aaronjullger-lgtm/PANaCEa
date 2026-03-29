/**
 * Character Collection Component
 *
 * Displays the organ-themed character collection with unlockable variants and accessories
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Lock,
  Trophy,
  Star,
  ChevronDown,
  ChevronUp,
  Filter,
  Grid3x3,
  List,
} from 'lucide-react';
import type { SystemCode, PerformanceRecord } from '@/types';
import {
  ORGAN_CHARACTERS,
  ORGAN_VARIANTS,
  ORGAN_ACCESSORIES,
  getVariantsForSystem,
  getCharacterBySystem,
  getVariantById,
  type OrganVariantId,
  type OrganAccessoryId,
} from '@/config/organ-characters';
import {
  loadOrganProgress,
  saveOrganProgress,
  loadCharacterCustomization,
  saveCharacterCustomization,
  updateSystemProgress,
  checkVariantUnlocks,
  checkAccessoryUnlocks,
  unlockItems,
  getSystemCompletion,
  getOverallCompletion,
  changeActiveVariant,
  toggleAccessory,
  type UserOrganProgress,
  type CharacterCustomization,
} from '@/lib/services/organCharacterService';
import CharacterCard from './CharacterCard';
import CharacterDetailModal from './CharacterDetailModal';
import UnlockNotification from './UnlockNotification';

interface CharacterCollectionProps {
  performanceData: PerformanceRecord[];
  currentStreak: number;
  onClose?: () => void;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'unlocked' | 'locked' | 'base' | 'special';

const CharacterCollection: React.FC<CharacterCollectionProps> = ({
  performanceData,
  currentStreak,
  onClose,
}) => {
  const [progress, setProgress] = useState<UserOrganProgress>(() => loadOrganProgress());
  const [customization, setCustomization] = useState(() => loadCharacterCustomization());
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | 'SPECIAL' | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [newUnlocks, setNewUnlocks] = useState<{
    variants: OrganVariantId[];
    accessories: OrganAccessoryId[];
  }>({ variants: [], accessories: [] });

  // Update progress when performance data changes
  useEffect(() => {
    const updatedProgress = updateSystemProgress(progress, performanceData);
    const totalQuestions = performanceData.length;

    // Check for new unlocks
    const newVariants = checkVariantUnlocks(updatedProgress, currentStreak, totalQuestions);
    const newAccessories = checkAccessoryUnlocks(updatedProgress, currentStreak, totalQuestions);

    if (newVariants.length > 0 || newAccessories.length > 0) {
      const unlockedProgress = unlockItems(updatedProgress, newVariants, newAccessories);
      setProgress(unlockedProgress);
      saveOrganProgress(unlockedProgress);
      setNewUnlocks({ variants: newVariants, accessories: newAccessories });

      // Clear notification after 5 seconds
      setTimeout(() => setNewUnlocks({ variants: [], accessories: [] }), 5000);
    } else {
      setProgress(updatedProgress);
      saveOrganProgress(updatedProgress);
    }
  }, [performanceData, currentStreak]);

  // Calculate stats
  const stats = useMemo(() => {
    const completion = getOverallCompletion(progress);
    const systemCompletions = ORGAN_CHARACTERS.map((char) => ({
      system: char.system,
      name: char.name,
      completion: getSystemCompletion(progress, char.system as SystemCode),
    }));

    return {
      ...completion,
      systemCompletions,
    };
  }, [progress]);

  // Filter characters
  const filteredCharacters = useMemo(() => {
    let characters = [...ORGAN_CHARACTERS];

    switch (filterMode) {
      case 'unlocked':
        characters = characters.filter((char) => {
          const variants = getVariantsForSystem(char.system);
          return variants.some((v) => progress.unlockedVariants.has(v.id) && !v.isBase);
        });
        break;
      case 'locked':
        characters = characters.filter((char) => {
          const variants = getVariantsForSystem(char.system);
          return variants.some((v) => !progress.unlockedVariants.has(v.id));
        });
        break;
      case 'base':
        characters = characters.filter((char) => char.system !== 'SPECIAL');
        break;
      case 'special':
        characters = characters.filter((char) => char.system === 'SPECIAL');
        break;
    }

    return characters;
  }, [filterMode, progress]);

  const handleCharacterClick = (system: SystemCode | 'SPECIAL') => {
    setSelectedSystem(system);
  };

  const handleCloseDetail = () => {
    setSelectedSystem(null);
  };

  const handleVariantChange = (system: SystemCode | 'SPECIAL', variantId: OrganVariantId) => {
    const updated = changeActiveVariant(customization, system, variantId);
    setCustomization(updated);
    saveCharacterCustomization(updated);
  };

  const handleAccessoryToggle = (system: SystemCode | 'SPECIAL', accessoryId: OrganAccessoryId) => {
    const updated = toggleAccessory(customization, system, accessoryId);
    setCustomization(updated);
    saveCharacterCustomization(updated);
  };

  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          role="dialog"
          aria-modal="true"
          aria-label="Character collection"
          className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
        >
          {/* Header */}
          <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-[var(--color-accent)]" />
                  Character Collection
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Collect organ characters and accessories by studying different systems
                </p>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2 rounded-lg hover:bg-[var(--color-bg-primary)]"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-[var(--color-accent)]" />
                  <div className="text-xs text-[var(--color-text-muted)]">Collection</div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.percentage}%
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  {stats.variantsUnlocked + stats.accessoriesUnlocked} /{' '}
                  {stats.totalVariants + stats.totalAccessories} items
                </div>
              </div>

              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                  <div className="text-xs text-[var(--color-text-muted)]">Characters</div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.variantsUnlocked}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  {stats.totalVariants} variants
                </div>
              </div>

              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-[var(--color-data-provisional)]" />
                  <div className="text-xs text-[var(--color-text-muted)]">Accessories</div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.accessoriesUnlocked}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  {stats.totalAccessories} available
                </div>
              </div>

              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <div className="text-xs text-[var(--color-text-muted)]">Locked</div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.totalVariants +
                    stats.totalAccessories -
                    stats.variantsUnlocked -
                    stats.accessoriesUnlocked}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">Keep studying!</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between gap-4">
              {/* View Mode Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'list'
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                  title="List view"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
                {showFilters ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Filter Options */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'unlocked', 'locked', 'base', 'special'] as FilterMode[]).map(
                      (filter) => (
                        <button
                          key={filter}
                          onClick={() => setFilterMode(filter)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            filterMode === filter
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                          }`}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Character Grid/List */}
          <div className="flex-1 overflow-y-auto p-6">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredCharacters.map((character) => {
                  const variants = getVariantsForSystem(character.system);
                  const unlockedVariants = variants.filter((v) =>
                    progress.unlockedVariants.has(v.id)
                  );
                  const completion =
                    variants.length > 0
                      ? Math.round((unlockedVariants.length / variants.length) * 100)
                      : 0;

                  return (
                    <CharacterCard
                      key={character.system}
                      character={character}
                      unlockedCount={unlockedVariants.length}
                      totalCount={variants.length}
                      completion={completion}
                      onClick={() => handleCharacterClick(character.system)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCharacters.map((character) => {
                  const variants = getVariantsForSystem(character.system);
                  const unlockedVariants = variants.filter((v) =>
                    progress.unlockedVariants.has(v.id)
                  );
                  const completion =
                    variants.length > 0
                      ? Math.round((unlockedVariants.length / variants.length) * 100)
                      : 0;

                  return (
                    <button
                      key={character.system}
                      onClick={() => handleCharacterClick(character.system)}
                      className="w-full bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg p-4 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">{character.emoji}</div>
                          <div>
                            <h3 className="font-semibold text-[var(--color-text-primary)]">
                              {character.name}
                            </h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                              {character.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-[var(--color-text-primary)]">
                            {completion}%
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {unlockedVariants.length}/{variants.length} unlocked
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredCharacters.length === 0 && (
              <div className="text-center py-12">
                <Lock className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4 opacity-50" />
                <p className="text-[var(--color-text-muted)]">No characters match your filters</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Character Detail Modal */}
      {selectedSystem && (
        <CharacterDetailModal
          system={selectedSystem}
          progress={progress}
          customization={customization.get(selectedSystem)!}
          onVariantChange={handleVariantChange}
          onAccessoryToggle={handleAccessoryToggle}
          onClose={handleCloseDetail}
        />
      )}

      {/* Unlock Notifications */}
      <AnimatePresence>
        {(newUnlocks.variants.length > 0 || newUnlocks.accessories.length > 0) && (
          <UnlockNotification
            variants={newUnlocks.variants}
            accessories={newUnlocks.accessories}
            onDismiss={() => setNewUnlocks({ variants: [], accessories: [] })}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default CharacterCollection;
