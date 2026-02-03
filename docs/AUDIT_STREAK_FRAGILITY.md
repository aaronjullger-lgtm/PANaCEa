# Audit: Streak Fragility (Retention Risk)

## Context

The app uses **streaks** (Fire icon) to drive daily usage. A single missed day resets the streak to 0 (“Broken Glass” effect), which can cause users to quit entirely.

## Mitigations Implemented

### 1. Streak Freezes

- **Earn freezes**: Users earn **Streak Freezes** by studying (e.g. 1 freeze per 7 consecutive days meeting daily goal, plus purchase with coins).
- **Use freezes**: If a user misses a goal day, they can **use a freeze** for that date so the streak does not break. One freeze = one protected day.
- **Persistence**: `UserPreferences.streakFreezes`, `UserPreferences.userCoins`; `StreakFreezeUse` records which dates were frozen.
- **Cap**: Max 5 freezes (config in `data/modes/dailyRitualsData.ts`).

### 2. Weekend Mode (Weekdays-Only Goal)

- **Setting**: “Streak goal” can be **Every day** or **Weekdays only** (`UserPreferences.streakGoalDays`: `'all'` | `'weekdays'`).
- **Behavior**: When **Weekdays only** is set, only Monday–Friday count as “required” for the streak. Missing Saturday or Sunday does **not** break the streak. Reduces burnout from gamifying rest days.

## Audit Checks

- [ ] Streak calculation uses `streakGoalDays` so weekends are skipped when `'weekdays'`.
- [ ] Streak calculation treats `StreakFreezeUse` dates as “active” so frozen days don’t break the streak.
- [ ] Users can earn freezes by meeting the daily goal for 7 consecutive (goal) days.
- [ ] Users can spend coins to buy freezes (existing shop).
- [ ] Settings expose “Weekdays only” and display current freezes/coins where relevant.
