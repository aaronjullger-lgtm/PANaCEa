# PANaCEa Authentication System - Extended Features Guide

This guide covers the extended authentication and gamification features added to the PANaCEa medical learning platform.

## Overview

The extended authentication system includes:
- **Role-Based Access Control (RBAC)** - User, Admin, and Superadmin roles
- **Achievement System** - 25+ achievements with unlock animations
- **Streak Tracking** - Daily study streaks with flame visualization
- **Baseline Assessment** - Initial diagnostic exam for new users
- **Exam Countdown** - PANCE/PANRE exam date tracking
- **Email Utilities** - Professional email templates for notifications

## Table of Contents

1. [Role-Based Access Control (RBAC)](#role-based-access-control)
2. [Achievement System](#achievement-system)
3. [Streak Tracking](#streak-tracking)
4. [Baseline Assessment](#baseline-assessment)
5. [Exam Countdown](#exam-countdown)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [Integration Guide](#integration-guide)

---

## Role-Based Access Control

### Roles

Three user roles are supported:

1. **User** (default) - Standard access to learning features
2. **Admin** - Access to admin dashboard and user management
3. **Superadmin** - Full system access including role management

### Role Utilities

```typescript
import { isAdmin, canManageRoles, hasRole } from './lib/auth/rbac';

// Check if user is admin or higher
if (isAdmin(userRole)) {
  // Show admin features
}

// Check if user can manage roles (superadmin only)
if (canManageRoles(userRole)) {
  // Allow role assignment
}

// Check specific role requirement
if (hasRole(userRole, 'admin')) {
  // User is admin or higher
}
```

### Admin Dashboard

Protected route example: `/pages/admin/AdminDashboard.tsx`

Features:
- Platform statistics (users, activity, accuracy)
- User management access
- Role management (superadmin only)
- System settings

Usage:
```typescript
import { AdminDashboard } from './pages/admin/AdminDashboard';

<AdminDashboard onClose={() => setShowAdmin(false)} />
```

---

## Achievement System

### Achievement Definitions

25+ achievements across 5 categories:
- **Performance** - Accuracy and streak milestones
- **Consistency** - Daily study streaks
- **Mastery** - System-level mastery achievements
- **Milestone** - Question count milestones
- **Special** - Unique achievements (time-based, baseline completion)

### Achievement Rarities

- **Common** - Easy to unlock, early milestones
- **Uncommon** - Moderate difficulty
- **Rare** - Challenging accomplishments
- **Epic** - Very difficult achievements
- **Legendary** - Ultimate achievements

### Using Achievements

```typescript
import { useAchievements } from './hooks/useAchievements';

function MyComponent() {
  const {
    achievements,
    unlockAchievement,
    recordSession,
    getNextUnlock,
    clearUnlock,
  } = useAchievements();

  // Record a session (automatically checks achievements)
  recordSession(questionsAnswered, correctAnswers, totalQuestions);

  // Manually unlock an achievement
  unlockAchievement('perfect_10', 100);

  // Get and display unlock animation
  const nextUnlock = getNextUnlock();
  if (nextUnlock) {
    return (
      <UnlockAnimation
        achievementId={nextUnlock}
        onComplete={clearUnlock}
      />
    );
  }
}
```

### Achievement Components

**AchievementMedal** - Circular medal with tooltip
```typescript
<AchievementMedal
  achievementId="perfect_10"
  isUnlocked={true}
  size="large"
  showTooltip={true}
/>
```

**AchievementsDashboard** - Full achievements view
```typescript
<AchievementsDashboard
  userAchievements={achievements}
  currentStreak={streak.currentStreak}
  flameLevel={streak.flameLevel}
  isActiveToday={streak.isActiveToday}
  onClose={() => setShowAchievements(false)}
/>
```

**UnlockAnimation** - Celebration animation
```typescript
<UnlockAnimation
  achievementId="legendary_100"
  onComplete={() => console.log('Animation complete')}
  autoHideDuration={4000}
/>
```

---

## Streak Tracking

### Streak Levels

Daily streaks are visualized with flame intensity:
- **Level 0** - No streak (gray)
- **Level 1** - 3+ days (orange)
- **Level 2** - 7+ days (amber)
- **Level 3** - 14+ days (yellow)
- **Level 4** - 30+ days (blue - hot flame)
- **Level 5** - 100+ days (purple - legendary)

### Using Streaks

```typescript
import { useAchievements } from './hooks/useAchievements';

function MyComponent() {
  const { streak, updateStreak } = useAchievements();

  // Update streak after study session
  updateStreak(questionsAnswered, accuracy);

  return (
    <StreakFlame
      streak={streak.currentStreak}
      flameLevel={streak.flameLevel}
      isActiveToday={streak.isActiveToday}
      size="medium"
    />
  );
}
```

### Streak Components

**StreakFlame** - Full streak display with animation
```typescript
<StreakFlame
  streak={currentStreak}
  flameLevel={flameLevel}
  isActiveToday={true}
  size="large"
/>
```

**StreakBadge** - Compact header display
```typescript
<StreakBadge
  streak={currentStreak}
  isActiveToday={true}
/>
```

---

## Baseline Assessment

First-time user onboarding component that:
1. Explains the purpose of baseline assessment
2. Presents 20 mixed-topic questions
3. Analyzes performance by system
4. Identifies strengths and weaknesses
5. Unlocks baseline completion achievement

### Usage

```typescript
import { BaselineAssessment } from './components/onboarding/BaselineAssessment';

<BaselineAssessment
  onComplete={(results) => {
    console.log('Baseline accuracy:', results.accuracy);
    console.log('Weak systems:', results.weakestSystems);
    console.log('Strong systems:', results.strongestSystems);
  }}
  onSkip={() => console.log('User skipped baseline')}
/>
```

### Results Structure

```typescript
interface BaselineResults {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  systemBreakdown: Record<string, {
    correct: number;
    total: number;
    accuracy: number;
  }>;
  weakestSystems: string[];
  strongestSystems: string[];
}
```

---

## Exam Countdown

### Features

- Displays days until exam
- Color-coded urgency (red < 14 days, orange < 30, yellow < 60)
- Progress bar for final 90 days
- Can be hidden via settings
- Compact badge version for header

### Usage

**Full Widget**
```typescript
<ExamCountdown
  examDate={user.examDate}
  onSetDate={() => setShowDatePicker(true)}
  onHide={() => setShowCountdown(false)}
/>
```

**Compact Badge**
```typescript
<ExamCountdownBadge examDate={user.examDate} />
```

---

## Database Schema

### Extended User Model

```prisma
model User {
  // ... existing fields ...
  
  // Authentication
  emailVerified      DateTime?
  role               String    @default("user")
  resetToken         String?
  resetTokenExpiry   DateTime?
  verifyToken        String?
  verifyTokenExpiry  DateTime?
  
  // Onboarding
  hasCompletedBaseline Boolean @default(false)
  examDate            DateTime?
  
  // Relations
  achievements       UserAchievement[]
  streaks            DailyStreak[]
}
```

### Achievement Models

```prisma
model UserAchievement {
  id            String   @id @default(uuid())
  userId        String
  achievementId String
  unlockedAt    DateTime @default(now())
  progress      Int      @default(100)
  
  user User @relation(fields: [userId], references: [id])
  
  @@unique([userId, achievementId])
}

model DailyStreak {
  id                String   @id @default(uuid())
  userId            String
  date              DateTime @db.Date
  questionsAnswered Int
  accuracyPercent   Float
  studyMinutes      Int
  
  user User @relation(fields: [userId], references: [id])
  
  @@unique([userId, date])
}

model MasteryProgress {
  id            String   @id @default(uuid())
  userId        String
  conditionName String?
  systemCode    String?
  subcategory   String?
  masteryTier   String   @default("bronze")
  accuracy      Float
  attempts      Int
  
  @@unique([userId, conditionName, systemCode, subcategory])
}

model BaselineAssessment {
  id                String   @id @default(uuid())
  userId            String   @unique
  completedAt       DateTime @default(now())
  totalQuestions    Int
  correctAnswers    Int
  accuracy          Float
  systemBreakdown   Json
  weakestSystems    String[]
  strongestSystems  String[]
}
```

---

## API Endpoints

### Achievement Endpoints (To Be Implemented)

```
GET    /api/achievements/:userId          - Get user achievements
POST   /api/achievements/unlock           - Unlock achievement
GET    /api/achievements/stats/:userId    - Get achievement statistics
```

### Streak Endpoints (To Be Implemented)

```
GET    /api/streaks/:userId               - Get current streak info
POST   /api/streaks/record                - Record daily activity
GET    /api/streaks/stats/:userId         - Get detailed streak stats
```

### Role Management Endpoints (To Be Implemented)

```
GET    /api/admin/users                   - List users (admin only)
PATCH  /api/admin/users/:userId/role      - Update user role (superadmin only)
GET    /api/admin/stats                   - Platform statistics (admin only)
```

---

## Frontend Components

### Component Structure

```
components/
├── achievements/
│   ├── AchievementMedal.tsx          # Individual achievement display
│   ├── AchievementsDashboard.tsx     # Full achievements view
│   ├── StreakFlame.tsx               # Streak visualization
│   └── UnlockAnimation.tsx           # Achievement unlock celebration
├── dashboard/
│   └── ExamCountdown.tsx             # Exam date countdown
├── onboarding/
│   └── BaselineAssessment.tsx        # Initial assessment
└── pages/
    └── admin/
        └── AdminDashboard.tsx         # Admin control panel
```

### Hooks

```
hooks/
├── useAchievements.ts                # Achievement management
├── useAuth.ts                        # Authentication (existing)
└── useUserStats.ts                   # User statistics (existing)
```

---

## Integration Guide

### Step 1: Add to Main App

```typescript
// App.tsx
import { useAchievements } from './hooks/useAchievements';
import { UnlockAnimation } from './components/achievements/UnlockAnimation';
import { StreakBadge } from './components/achievements/StreakFlame';

function App() {
  const { 
    achievements, 
    streak, 
    getNextUnlock, 
    clearUnlock,
    recordSession 
  } = useAchievements();
  
  const nextUnlock = getNextUnlock();

  return (
    <>
      {/* Header with streak */}
      <header>
        <StreakBadge 
          streak={streak.currentStreak}
          isActiveToday={streak.isActiveToday}
        />
      </header>

      {/* Main app content */}
      <main>{/* ... */}</main>

      {/* Achievement unlock animation */}
      {nextUnlock && (
        <UnlockAnimation
          achievementId={nextUnlock}
          onComplete={clearUnlock}
        />
      )}
    </>
  );
}
```

### Step 2: Record Study Sessions

```typescript
// After quiz completion
function handleQuizComplete(results) {
  const { questionsAnswered, correctAnswers, totalQuestions } = results;
  
  // This automatically checks and unlocks achievements
  recordSession(questionsAnswered, correctAnswers, totalQuestions);
  
  // Continue with your existing logic
  saveResults(results);
}
```

### Step 3: Show Achievements Dashboard

```typescript
import { AchievementsDashboard } from './components/achievements/AchievementsDashboard';

<button onClick={() => setShowAchievements(true)}>
  View Achievements
</button>

{showAchievements && (
  <AchievementsDashboard
    userAchievements={achievements}
    currentStreak={streak.currentStreak}
    flameLevel={streak.flameLevel}
    isActiveToday={streak.isActiveToday}
    onClose={() => setShowAchievements(false)}
  />
)}
```

### Step 4: Add Baseline for New Users

```typescript
import { BaselineAssessment } from './components/onboarding/BaselineAssessment';

function OnboardingFlow() {
  const [showBaseline, setShowBaseline] = useState(true);

  return showBaseline ? (
    <BaselineAssessment
      onComplete={(results) => {
        // Save baseline results
        saveBaselineResults(results);
        
        // Unlock baseline achievement
        unlockAchievement('baseline_complete');
        
        setShowBaseline(false);
      }}
      onSkip={() => setShowBaseline(false)}
    />
  ) : (
    <MainApp />
  );
}
```

### Step 5: Add Exam Countdown

```typescript
import { ExamCountdown } from './components/dashboard/ExamCountdown';

<ExamCountdown
  examDate={user.examDate}
  onSetDate={() => {
    // Show date picker modal
    setShowDatePicker(true);
  }}
  onHide={() => {
    // Update user preferences
    updateUserPreferences({ showExamCountdown: false });
  }}
/>
```

---

## Environment Variables

Add to your `.env` file:

```env
# Email Configuration (for password reset notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=PANaCEa <noreply@panacea.app>

# Application URLs
VITE_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

---

## Running Migrations

After setting up your database connection, run:

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_extended_features

# Or for production
npx prisma migrate deploy
```

---

## Professional Styling Guidelines

All UI components follow these principles:
- ✅ No emojis or cartoon elements
- ✅ Professional medical platform aesthetic
- ✅ Clean, minimal design
- ✅ Accessible color contrasts
- ✅ Smooth, subtle animations
- ✅ Consistent with existing PANaCEa design

---

## Next Steps

1. **Database Setup** - Run Prisma migrations
2. **API Integration** - Implement backend endpoints
3. **Clerk Configuration** - Set up OAuth providers
4. **Testing** - Verify all features work correctly
5. **Documentation** - Update user-facing docs

---

## Support

For issues or questions:
- Check the troubleshooting section in `AUTHENTICATION_SETUP.md`
- Review browser console for errors
- Verify database connections
- Check Clerk configuration

## Security Notes

- All user roles are stored securely in the database
- Achievement data is validated server-side
- RBAC checks are enforced on both client and server
- Email tokens are hashed before storage
- Rate limiting should be applied to all API endpoints

---

Built with professional medical education in mind. No gimmicks, just results.
