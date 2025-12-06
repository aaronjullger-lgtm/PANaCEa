/**
 * Character Gallery Component (Inline version for tabs)
 * 
 * Displays the organ-themed character collection inline within a tab
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
  getVariantsForSystem,
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

interface CharacterGalleryProps {
  performanceData: PerformanceRecord[];
  currentStreak: number;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'unlocked' | 'locked' | 'base' | 'special';

const CharacterGallery: React.FC<CharacterGalleryProps> = ({
  performanceData,
  currentStreak,
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
      
      // Clear notification after 5 seconds with cleanup
      const timeoutId = setTimeout(() => setNewUnlocks({ variants: [], accessories: [] }), 5000);
      return () => clearTimeout(timeoutId);
    } else {
      setProgress(updatedProgress);
      saveOrganProgress(updatedProgress);
    }
  }, [performanceData, currentStreak]);

  // Calculate stats
  const stats = useMemo(() => {
    const completion = getOverallCompletion(progress);
    return completion;
  }, [progress]);

  // Filter characters
  const filteredCharacters = useMemo(() => {
    let characters = [...ORGAN_CHARACTERS];

    switch (filterMode) {
      case 'unlocked':
        characters = characters.filter(char => {
          const variants = getVariantsForSystem(char.system);
          return variants.some(v => progress.unlockedVariants.has(v.id) && !v.isBase);
        });
        break;
      case 'locked':
        characters = characters.filter(char => {
          const variants = getVariantsForSystem(char.system);
          return variants.some(v => !progress.unlockedVariants.has(v.id));
        });
        break;
      case 'base':
        characters = characters.filter(char => char.system !== 'SPECIAL');
        break;
      case 'special':
        characters = characters.filter(char => char.system === 'SPECIAL');
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

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-3 h-3 text-[var(--color-accent)]" />
            <div className="text-xs text-[var(--color-text-muted)]">Collection</div>
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {stats.percentage}%
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {stats.variantsUnlocked + stats.accessoriesUnlocked}/{stats.totalVariants + stats.totalAccessories}
          </div>
        </div>

        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3 h-3 text-purple-500" />
            <div className="text-xs text-[var(--color-text-muted)]">Characters</div>
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {stats.variantsUnlocked}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {stats.totalVariants} variants
          </div>
        </div>

        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-3 h-3 text-amber-500" />
            <div className="text-xs text-[var(--color-text-muted)]">Accessories</div>
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {stats.accessoriesUnlocked}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {stats.totalAccessories} total
          </div>
        </div>

        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3 h-3 text-slate-500" />
            <div className="text-xs text-[var(--color-text-muted)]">Locked</div>
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {stats.totalVariants + stats.totalAccessories - stats.variantsUnlocked - stats.accessoriesUnlocked}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Keep studying!
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">
              Collect Organ Characters!
            </h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              Study different body systems to unlock unique character variants. 
              Each system has special versions like "Pneumothorax Lungs" or "Boot-Shaped Heart". 
              Earn accessories through streaks and achievements!
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
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
            <Grid3x3 className="w-4 h-4" />
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
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors text-sm"
        >
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Filter Options */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
              {(['all', 'unlocked', 'locked', 'base', 'special'] as FilterMode[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setFilterMode(filter)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterMode === filter
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character Grid/List */}
      <div>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredCharacters.map(character => {
              const variants = getVariantsForSystem(character.system);
              const unlockedVariants = variants.filter(v => progress.unlockedVariants.has(v.id));
              const completion = variants.length > 0 
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
            {filteredCharacters.map(character => {
              const variants = getVariantsForSystem(character.system);
              const unlockedVariants = variants.filter(v => progress.unlockedVariants.has(v.id));
              const completion = variants.length > 0 
                ? Math.round((unlockedVariants.length / variants.length) * 100)
                : 0;

              return (
                <button
                  key={character.system}
                  onClick={() => handleCharacterClick(character.system)}
                  className="w-full bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg p-3 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{character.emoji}</div>
                      <div>
                        <h3 className="font-semibold text-[var(--color-text-primary)] text-sm">
                          {character.name}
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {character.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[var(--color-text-primary)]">
                        {completion}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {unlockedVariants.length}/{variants.length}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {filteredCharacters.length === 0 && (
          <div className="text-center py-8 bg-[var(--color-bg-secondary)] rounded-lg">
            <Lock className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-50" />
            <p className="text-[var(--color-text-muted)] text-sm">
              No characters match your filters
            </p>
          </div>
        )}
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
    </div>
  );
};

export default CharacterGallery;
