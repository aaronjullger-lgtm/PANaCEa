/**
 * Unlock Notification Component
 * 
 * Displays a notification when new characters or accessories are unlocked
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { getVariantById, getAccessoryById, type OrganVariantId, type OrganAccessoryId } from '@/config/organ-characters';

interface UnlockNotificationProps {
  variants: OrganVariantId[];
  accessories: OrganAccessoryId[];
  onDismiss: () => void;
}

const UnlockNotification: React.FC<UnlockNotificationProps> = ({
  variants,
  accessories,
  onDismiss,
}) => {
  const totalUnlocks = variants.length + accessories.length;
  if (totalUnlocks === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-4 right-4 z-[60] max-w-sm"
    >
      <div className="bg-[var(--color-accent)] rounded-xl shadow-2xl p-6 text-white dark:text-[var(--color-bg-primary)]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            <h3 className="font-bold text-lg">New Unlock{totalUnlocks > 1 ? 's' : ''}!</h3>
          </div>
          <button
            onClick={onDismiss}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {variants.map(variantId => {
            const variant = getVariantById(variantId);
            if (!variant) return null;

            return (
              <motion.div
                key={variantId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-3 flex items-center gap-3"
              >
                <div className="text-3xl">{variant.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold">{variant.name}</div>
                  <div className="text-sm text-white/80">{variant.description}</div>
                </div>
              </motion.div>
            );
          })}

          {accessories.map(accessoryId => {
            const accessory = getAccessoryById(accessoryId);
            if (!accessory) return null;

            return (
              <motion.div
                key={accessoryId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-3 flex items-center gap-3"
              >
                <div className="text-3xl">{accessory.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold">{accessory.name}</div>
                  <div className="text-sm text-white/80">{accessory.description}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-sm text-white/80">
          Check your Character Collection!
        </div>
      </div>
    </motion.div>
  );
};

export default UnlockNotification;
