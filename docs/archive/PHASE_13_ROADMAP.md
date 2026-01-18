# Phase 13: The "Cognitive & Social" Update

## Overview

Phase 13 represents a major leap in the platform's maturity, moving from a solitary study tool to a sophisticated, social, and scientifically-optimized learning environment.

## Core Objectives

1.  **FSRS Implementation**: Replace the legacy SRS algorithm with the state-of-the-art Free Spaced Repetition Scheduler (FSRS) v5.
2.  **Social Learning**: Introduce "Study Rooms" and "Leaderboards" to foster community and competition.
3.  **Offline Resilience**: Transform the app into a true PWA with robust offline capabilities.
4.  **Universal Access**: Ensure WCAG 2.1 AA compliance for accessibility.

## Detailed Implementation Plan

### 1. FSRS Integration (The "Brain" Upgrade)

- [ ] **Database Schema**: Update `SRSItem` to support FSRS parameters (stability, difficulty, retrievability).
- [ ] **Algorithm Port**: Implement the FSRS v5 algorithm in `lib/fsrs.ts`.
- [ ] **Migration**: Create a script to convert existing SRS data (intervals/ease factors) to FSRS weights.
- [ ] **Scheduler**: Update `srsService.ts` to use the new scheduler.
- [ ] **Optimizer**: (Optional) Implement a background job to optimize weights based on user history.

### 2. Social & Collaborative Features

- [ ] **Database Schema**:
  - `StudyGroup`: id, name, code, ownerId.
  - `StudyGroupMember`: userId, groupId, role.
  - `Leaderboard`: Global and group-based rankings.
- [ ] **Real-time Engine**:
  - Integrate Supabase Realtime for live updates.
  - Implement "Live Study Sessions" (who is studying what right now).
- [ ] **UI Components**:
  - `StudyGroupDashboard`: Create/join groups, view members.
  - `LeaderboardWidget`: Weekly/Monthly XP rankings.
  - `ActivityFeed`: "User X just mastered Atrial Fibrillation!"

### 3. Offline PWA (The "Anywhere" Update)

- [ ] **Service Worker**: Configure Vite PWA plugin (`vite-plugin-pwa`).
- [ ] **Caching Strategy**:
  - `StaleWhileRevalidate` for static assets.
  - `NetworkFirst` for API calls.
  - IndexedDB for storing large datasets (conditions, questions).
- [ ] **Sync Engine**: Enhance the existing "Last Write Wins" sync to handle larger payloads and conflict resolution more gracefully.
- [ ] **Installability**: Add `manifest.json` and install prompts.

### 4. Accessibility (The "Everyone" Update)

- [ ] **Audit**: Run automated accessibility tests (axe-core).
- [ ] **Navigation**: Ensure full keyboard navigability (focus traps, skip links).
- [ ] **Screen Readers**: Add ARIA labels to all interactive elements (especially the complex medical diagrams).
- [ ] **Color Contrast**: Verify all UI elements meet AA standards.
- [ ] **Settings**: Add "Reduced Motion" and "High Contrast" modes.

## Technical Dependencies

- `fsrs.js` or custom TypeScript implementation.
- `vite-plugin-pwa`.
- Supabase Realtime.
- `@radix-ui/react-accessible-icon` (or similar).

## Migration Strategy

1.  **Data Safety**: Backup all SRS data before FSRS migration.
2.  **Feature Flags**: Roll out Social features behind a flag initially.
3.  **Beta Testing**: Release PWA to a small group to test offline sync edge cases.

## Success Metrics

- **Retention**: Increase in daily active users (DAU) due to social hooks.
- **Efficiency**: Reduction in total study time for same mastery level (FSRS promise).
- **Performance**: Lighthouse score > 90 for PWA/Accessibility.
