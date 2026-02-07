import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Shield, Coins, AlertCircle, CheckCircle } from 'lucide-react';
import { STREAK_FREEZE_CONFIG, canPurchaseStreakFreeze } from '@/data/modes/dailyRitualsData';

interface StreakFreezeShopProps {
  userCoins: number;
  streakFreezes: number;
  onPurchase: () => void;
}

const StreakFreezeShop: React.FC<StreakFreezeShopProps> = ({
  userCoins,
  streakFreezes,
  onPurchase,
}) => {
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const canPurchase = canPurchaseStreakFreeze(userCoins, streakFreezes);

  const handlePurchase = () => {
    if (canPurchase) {
      onPurchase();
      setShowPurchaseConfirm(true);
      setTimeout(() => setShowPurchaseConfirm(false), 3000);
    }
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-700 rounded-lg">
            <Shield className="w-5 h-5 text-slate-200" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              Streak Freeze Insurance
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">Protect your study streak</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
          <Coins className="w-5 h-5" />
          <span className="font-bold">{userCoins}</span>
        </div>
      </div>

      {/* Current Freezes */}
      <div className="mb-4 p-3 bg-[var(--color-bg-primary)]/50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Streak Freezes Available
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: STREAK_FREEZE_CONFIG.maxFreezes }).map((_, i) => (
              <Shield
                key={i}
                className={`w-5 h-5 ${
                  i < streakFreezes
                    ? 'text-slate-600 fill-slate-600 dark:text-slate-400 dark:fill-slate-400'
                    : 'text-[var(--color-text-muted)]'
                }`}
              />
            ))}
            <span className="ml-2 font-bold text-[var(--color-text-primary)]">
              {streakFreezes}/{STREAK_FREEZE_CONFIG.maxFreezes}
            </span>
          </div>
        </div>
      </div>

      {/* Purchase Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] rounded-lg border-2 border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-slate-600 dark:text-slate-400" />
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">1 Streak Freeze</p>
              <p className="text-xs text-[var(--color-text-muted)]">Protects one missed day</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-600" />
            <span className="font-bold text-[var(--color-text-primary)]">
              {STREAK_FREEZE_CONFIG.costPerFreeze}
            </span>
          </div>
        </div>

        <button
          onClick={handlePurchase}
          disabled={!canPurchase}
          className={`
            w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
            ${
              canPurchase
                ? 'bg-slate-700 hover:bg-slate-800 text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
            }
          `}
        >
          {!canPurchase && streakFreezes >= STREAK_FREEZE_CONFIG.maxFreezes && (
            <>
              <AlertCircle className="w-5 h-5" />
              Max Freezes Reached
            </>
          )}
          {!canPurchase && userCoins < STREAK_FREEZE_CONFIG.costPerFreeze && (
            <>
              <AlertCircle className="w-5 h-5" />
              Not Enough Coins
            </>
          )}
          {canPurchase && (
            <>
              <Coins className="w-5 h-5" />
              Purchase Streak Freeze
            </>
          )}
        </button>

        {/* Purchase Confirmation */}
        {showPurchaseConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-600 rounded-lg"
          >
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Streak Freeze Purchased!</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          How it works:
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <li>• If you miss a day, a freeze is automatically used</li>
          <li>• Your streak stays intact!</li>
          <li>• Earn coins by answering questions correctly</li>
          <li>• Max {STREAK_FREEZE_CONFIG.maxFreezes} freezes at a time</li>
        </ul>
      </div>

      {/* Earn More Coins */}
      <div className="mt-3 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          Earn{' '}
          <span className="font-bold text-yellow-600">{STREAK_FREEZE_CONFIG.coinsPerQuestion}</span>{' '}
          coins per question,
          <span className="font-bold text-yellow-600">
            {' '}
            {STREAK_FREEZE_CONFIG.coinsPerCorrectAnswer}
          </span>{' '}
          coins for correct answers
        </p>
      </div>
    </div>
  );
};

export default StreakFreezeShop;
