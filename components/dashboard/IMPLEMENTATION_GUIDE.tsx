/**
 * IMPLEMENTATION GUIDE: Unified DashboardActionCard
 *
 * This guide shows how to replace the existing three different card styles
 * (Orange/Flat Core PANCE, Stormy Slate Grand Rounds, and any Blue/Glow OSCE cards)
 * with the new unified DashboardActionCard component.
 */

import React from 'react';
import { Brain, Trophy, MessageSquare, Target, Clock, TrendingUp } from 'lucide-react';
import { DashboardActionCard } from '@/components/dashboard/DashboardActionCard';

// ============================================================================
// STEP 1: Import the DashboardActionCard component
// ============================================================================
// Add this to your TrainingMenu.tsx imports:
// import { DashboardActionCard } from '@/components/dashboard/DashboardActionCard';

// ============================================================================
// STEP 2: Replace Core PANCE Simulation Card
// ============================================================================
// BEFORE (lines 670-700 in TrainingMenu.tsx):
// <div className="bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-6 shadow-xl">
//   ... Complex nested divs with inconsistent styling ...
// </div>

// AFTER:
export const CorePANCECard = ({
  onStartSession,
  recommendedSystem,
}: {
  onStartSession: () => void;
  recommendedSystem?: string;
}) => (
  <DashboardActionCard
    title="Core PANCE Simulation"
    subtitle="Comprehensive Board Prep"
    description={
      recommendedSystem
        ? `AI-recommended focus: ${recommendedSystem}. Adaptive FSRS-powered session.`
        : 'Full-spectrum adaptive questions powered by FSRS algorithm.'
    }
    icon={Brain}
    stats={[
      { label: 'Questions', value: '120+', icon: Target },
      { label: 'Avg Time', value: '45min', icon: Clock },
      { label: 'Mastery', value: '73%', icon: TrendingUp },
    ]}
    buttonText="Start Session"
    onAction={onStartSession}
    variant="default"
  />
);

// ============================================================================
// STEP 3: Replace Grand Rounds Challenge Card
// ============================================================================
// BEFORE (lines 703-745 in TrainingMenu.tsx):
// <div className="bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] p-6 shadow-lg">
//   ... Different button style (slate-800 bg) ...
// </div>

// AFTER:
export const GrandRoundsCard = ({
  onStartChallenge,
  todaysQuestionCount,
}: {
  onStartChallenge: () => void;
  todaysQuestionCount?: number;
}) => (
  <DashboardActionCard
    title="Grand Rounds"
    subtitle="Daily Competitive Challenge"
    description="Same questions for everyone today - compete with your peers on the leaderboard."
    icon={Trophy}
    stats={[
      { label: "Today's Set", value: todaysQuestionCount || 20 },
      { label: 'Your Rank', value: '-', icon: Trophy },
      { label: 'Avg Score', value: '82%', icon: Target },
    ]}
    buttonText="Start Daily Challenge"
    onAction={onStartChallenge}
    variant="daily"
    badge={
      <span className="px-3 py-1 text-xs font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/30">
        Daily
      </span>
    }
  />
);

// ============================================================================
// STEP 4: Add Virtual OSCE / Patient Encounter Card (Premium)
// ============================================================================
// This card should use the most premium styling with the vibrant gradient button

export const VirtualOSCECard = ({
  onStartEncounter,
  isUnlocked,
}: {
  onStartEncounter: () => void;
  isUnlocked?: boolean;
}) => (
  <DashboardActionCard
    title="Virtual OSCE"
    subtitle="Interactive Patient Encounters"
    description="Full patient simulation with history-taking, physical exam, diagnostics, and treatment planning."
    icon={MessageSquare}
    stats={[
      { label: 'Duration', value: '15-25min', icon: Clock },
      { label: 'Skills', value: '4 Domains' },
      { label: 'Feedback', value: 'AI Preceptor' },
    ]}
    buttonText={isUnlocked ? 'Start Virtual OSCE' : 'Unlock Premium'}
    onAction={onStartEncounter}
    disabled={!isUnlocked}
    variant="premium"
    badge={
      <span className="px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-full shadow-lg shadow-[var(--color-accent)]/30">
        PREMIUM
      </span>
    }
  />
);

// ============================================================================
// STEP 5: Complete TrainingMenu.tsx Replacement
// ============================================================================
// Replace lines 670-745 in TrainingMenu.tsx with:

export const UnifiedTrainingMenuCards = ({
  onStartCore,
  onStartGrandRounds,
  onStartOSCE,
  searchQuery,
  recommendedSystem,
  isOSCEUnlocked = true,
}: {
  onStartCore: () => void;
  onStartGrandRounds: () => void;
  onStartOSCE: () => void;
  searchQuery?: string;
  recommendedSystem?: string;
  isOSCEUnlocked?: boolean;
}) => {
  // Only show featured cards when not searching
  if (searchQuery) return null;

  return (
    <div className="space-y-6 mb-8">
      {/* Core PANCE - Primary comprehensive session */}
      <CorePANCECard onStartSession={onStartCore} recommendedSystem={recommendedSystem} />

      {/* Grand Rounds - Daily competitive challenge */}
      <GrandRoundsCard onStartChallenge={onStartGrandRounds} todaysQuestionCount={20} />

      {/* Virtual OSCE - Premium interactive encounters */}
      <VirtualOSCECard onStartEncounter={onStartOSCE} isUnlocked={isOSCEUnlocked} />
    </div>
  );
};

// ============================================================================
// STEP 6: Integration Example in TrainingMenu.tsx
// ============================================================================
/*
// In TrainingMenu.tsx, replace lines 660-750 with:

const TrainingMenu: React.FC<TrainingMenuProps> = ({
  onStartSession,
  onNavigateToDrill,
  // ... other props
}) => {
  // ... existing state and functions ...

  const handleCoreStart = () => {
    onStartSession?.('core', coreFocus);
  };

  const handleGrandRoundsStart = () => {
    const grandRoundsMode = MODE_REGISTRY.find((m) => m.id === 'grand_rounds');
    if (grandRoundsMode) {
      onNavigateToDrill?.(grandRoundsMode);
    }
  };

  const handleOSCEStart = () => {
    const osceMode = MODE_REGISTRY.find((m) => m.id === 'patient_encounter');
    if (osceMode) {
      onNavigateToDrill?.(osceMode);
    }
  };

  return (
    <div className="flex gap-6 h-full">
      // ... sidebar code ...
      
      <div className="flex-1 space-y-8 overflow-y-auto">
        // ... search bar ...

        {/* REPLACE OLD CARDS WITH NEW UNIFIED COMPONENT *\/}
        <UnifiedTrainingMenuCards
          onStartCore={handleCoreStart}
          onStartGrandRounds={handleGrandRoundsStart}
          onStartOSCE={handleOSCEStart}
          searchQuery={searchQuery}
          recommendedSystem={dailyRecommendedSystem}
          isOSCEUnlocked={true} // Check user subscription/tier
        />

        {/* Rest of the drill modes grid *\/}
        <div className="space-y-8">
          {CATEGORY_SECTIONS.map((section) =>
            renderSection(section.key, section.title, section.description)
          )}
        </div>
      </div>
    </div>
  );
};
*/

// ============================================================================
// BENEFITS OF THIS REFACTOR:
// ============================================================================
// ✅ Single source of truth for card styling
// ✅ Consistent deep slate gradient backgrounds (no more flat orange or white)
// ✅ Uniform hover effects (indigo glow on all cards)
// ✅ All primary buttons use the same vibrant blue/indigo/purple gradient
// ✅ Glass-morphism icons in every card
// ✅ Reduced code duplication (300+ lines → ~50 lines per card)
// ✅ Easy to add new premium features (just pass different props)
// ✅ Accessibility: Proper disabled states and ARIA labels
// ✅ Animations: Consistent Framer Motion transitions

export default UnifiedTrainingMenuCards;
