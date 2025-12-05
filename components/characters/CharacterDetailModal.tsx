/**
 * Character Detail Modal
 * 
 * Shows detailed view of a character with unlockable variants and accessories
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Check } from 'lucide-react';
import type { SystemCode } from '@/types';
import {
  getVariantsForSystem,
  getCharacterBySystem,
  getVariantById,
  getAccessoryById,
  isAccessoryCompatible,
  ORGAN_ACCESSORIES,
  type OrganVariantId,
  type OrganAccessoryId,
} from '@/config/organ-characters';
import type {
  UserOrganProgress,
  CharacterCustomization,
} from '@/lib/services/organCharacterService';

interface CharacterDetailModalProps {
  system: SystemCode | 'SPECIAL';
  progress: UserOrganProgress;
  customization: CharacterCustomization;
  onVariantChange: (system: SystemCode | 'SPECIAL', variantId: OrganVariantId) => void;
  onAccessoryToggle: (system: SystemCode | 'SPECIAL', accessoryId: OrganAccessoryId) => void;
  onClose: () => void;
}

const CharacterDetailModal: React.FC<CharacterDetailModalProps> = ({
  system,
  progress,
  customization,
  onVariantChange,
  onAccessoryToggle,
  onClose,
}) => {
  const character = getCharacterBySystem(system);
  const variants = getVariantsForSystem(system);
  const compatibleAccessories = ORGAN_ACCESSORIES.filter(acc => 
    isAccessoryCompatible(acc.id, system)
  );

  if (!character) return null;

  const unlockedVariants = variants.filter(v => progress.unlockedVariants.has(v.id));
  const unlockedAccessories = compatibleAccessories.filter(a => 
    progress.unlockedAccessories.has(a.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
      >
        {/* Header */}
        <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="text-6xl">{character.emoji}</div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {character.name}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  {character.description}
                </p>
                <div className="mt-2 text-xs font-mono text-[var(--color-text-muted)]">
                  {system}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2 rounded-lg hover:bg-[var(--color-bg-primary)]"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Variants Section */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Character Variants ({unlockedVariants.length}/{variants.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {variants.map(variant => {
                const isUnlocked = progress.unlockedVariants.has(variant.id);
                const isActive = customization.activeVariant === variant.id;

                return (
                  <button
                    key={variant.id}
                    onClick={() => isUnlocked && onVariantChange(system, variant.id)}
                    disabled={!isUnlocked}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      isActive
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : isUnlocked
                        ? 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {/* Active Badge */}
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-[var(--color-accent)]" />
                      </div>
                    )}

                    {/* Lock Icon */}
                    {!isUnlocked && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-[var(--color-text-muted)]" />
                      </div>
                    )}

                    {/* Icon */}
                    <div className="text-3xl mb-2 text-center">
                      {variant.icon}
                    </div>

                    {/* Name */}
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] text-center">
                      {isUnlocked ? variant.name : '???'}
                    </div>

                    {/* Rarity */}
                    <div className={`text-xs text-center mt-1 ${
                      variant.rarity === 'legendary' ? 'text-amber-500' :
                      variant.rarity === 'epic' ? 'text-purple-500' :
                      variant.rarity === 'rare' ? 'text-blue-500' :
                      'text-[var(--color-text-muted)]'
                    }`}>
                      {variant.rarity}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accessories Section */}
          {compatibleAccessories.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                Accessories ({unlockedAccessories.length}/{compatibleAccessories.length})
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {compatibleAccessories.map(accessory => {
                  const isUnlocked = progress.unlockedAccessories.has(accessory.id);
                  const isEquipped = customization.equippedAccessories.includes(accessory.id);

                  return (
                    <button
                      key={accessory.id}
                      onClick={() => isUnlocked && onAccessoryToggle(system, accessory.id)}
                      disabled={!isUnlocked}
                      className={`relative p-3 rounded-lg border-2 transition-all ${
                        isEquipped
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                          : isUnlocked
                          ? 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] opacity-50 cursor-not-allowed'
                      }`}
                      title={isUnlocked ? accessory.name : 'Locked'}
                    >
                      {/* Equipped Badge */}
                      {isEquipped && (
                        <div className="absolute top-1 right-1">
                          <Check className="w-3 h-3 text-[var(--color-accent)]" />
                        </div>
                      )}

                      {/* Lock Icon */}
                      {!isUnlocked && (
                        <div className="absolute top-1 right-1">
                          <Lock className="w-3 h-3 text-[var(--color-text-muted)]" />
                        </div>
                      )}

                      {/* Icon */}
                      <div className="text-2xl text-center">
                        {accessory.icon}
                      </div>

                      {/* Name */}
                      <div className="text-xs font-medium text-[var(--color-text-primary)] text-center mt-1 truncate">
                        {isUnlocked ? accessory.name.split(' ')[0] : '???'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CharacterDetailModal;
