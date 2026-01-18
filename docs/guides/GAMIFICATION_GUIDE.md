# PANaCEa Organ Character Gamification System

## Overview

The PANaCEa gamification system transforms medical education into an engaging collection experience. Users unlock and customize organ-themed characters by studying different body systems, creating a fun and motivating learning environment.

## Core Concept

Every body system in PANaCEa has a unique organ character that users can collect, customize, and upgrade as they study. Think of it as a **medical Pokédex** where studying unlocks new variants and accessories.

## Character System

### Base Characters (15 Total)

Each body system has a base organ character that's unlocked by default:

| System | Character        | Emoji | Description              |
| ------ | ---------------- | ----- | ------------------------ |
| CV     | Heart            | ❤️    | Cardiovascular system    |
| PULM   | Lungs            | 🫁    | Pulmonary system         |
| GI     | Stomach          | 🫃    | Gastrointestinal system  |
| NEURO  | Brain            | 🧠    | Neurologic system        |
| MSK    | Bone             | 🦴    | Musculoskeletal system   |
| RENAL  | Kidney           | 🫘    | Renal system             |
| ENDO   | Thyroid          | 🦋    | Endocrine system         |
| HEME   | Blood Cell       | 🩸    | Hematologic system       |
| DERM   | Skin Cell        | 🧴    | Dermatologic system      |
| HEENT  | Eye              | 👁️    | Eyes, Ears, Nose, Throat |
| GU     | Bladder          | 💧    | Genitourinary system     |
| REPRO  | Cell             | 🧬    | Reproductive system      |
| ID     | Antibody         | 🛡️    | Infectious diseases      |
| PSYCH  | Neurotransmitter | 🧘    | Psychiatry               |
| PRO    | Stethoscope      | 🩺    | Professional practice    |

### Character Variants (50+ Total)

Each character has multiple unlockable variants representing different conditions, states, or achievements:

#### Example: Cardiovascular Variants

- **Healthy Heart** (Base) - Default unlocked
- **Boot-Shaped Heart** - Unlock by studying Tetralogy of Fallot
- **Athletic Heart** - Unlock by answering 100 CV questions
- **Takotsubo Heart** - Unlock by studying stress cardiomyopathy
- **Golden Heart** - Unlock by achieving 90%+ accuracy in CV

#### Example: Pulmonary Variants

- **Healthy Lungs** (Base) - Default unlocked
- **Pneumothorax Lungs** - One lung collapsed
- **Emphysematous Lungs** - Barrel chest appearance
- **Reactive Airways** - Asthma representation
- **Crystal Clear Lungs** - 90%+ accuracy achievement

### Unlock Mechanics

Variants unlock through different mechanisms:

1. **Questions Answered**: Study X questions in a system
2. **Accuracy Threshold**: Achieve X% accuracy in a system
3. **Specific Conditions**: Study specific diseases/conditions
4. **Achievements**: Complete special milestones
5. **Easter Eggs**: Discover through special modes

### Accessories (15+ Total)

Accessories are cosmetic items that can be equipped to any character:

#### Common Accessories

- **Basic Stethoscope** - 50 total questions
- **Medical Cap** - 100 total questions
- **Face Mask** - 150 total questions

#### Streak-Based Accessories

- **Flame Badge** - 7-day streak
- **Lightning Bolt** - 14-day streak
- **Crown** - 30-day streak

#### Achievement Accessories

- **Golden Stethoscope** - Clinical excellence
- **Graduation Cap** - 1000 questions
- **Trophy Badge** - Perfect 100 streak

## Easter Egg Characters

Special characters that unlock through specific activities:

### ECG Collection

- **Normal Sinus Rhythm** - 10 ECG drills
- **V-Fib** - 50 ECG drills (shockable!)
- **Asystole** - 75 ECG drills (flatline)

### Special Mascots

- **Skeleton Friend** - Collect all MSK variants (comes alive!)
- **Lab Values Mascot** - 100 Mini Lab drills
- **Pharma Pill** - 100 Pharmacology drills

## Rarity System

Items are categorized by rarity:

- **Common** 🔵 - Easy to unlock, base achievements
- **Uncommon** 🟢 - Moderate effort required
- **Rare** 🔷 - Significant study commitment
- **Epic** 🟣 - Advanced mastery
- **Legendary** 🟡 - Exceptional achievement

## User Interface

### Character Collection Tab

Access through: **Settings → Characters Tab**

Features:

- **Grid View**: See all characters at a glance
- **List View**: Detailed progress for each system
- **Filters**: Show all, unlocked, locked, base, or special characters
- **Progress Tracking**: Completion percentage per character

### Character Detail Modal

Click any character to see:

- All variants (unlocked and locked)
- Compatible accessories
- Unlock conditions
- Customization options

### Unlock Notifications

When you unlock something new:

- Celebratory animation
- Item preview
- Rarity indicator
- "Check your Collection!" prompt

## Progression System

### System-Based Progress

Each body system tracks:

- **Questions Answered**: Total count for that system
- **Correct Answers**: Accuracy calculation
- **Accuracy Percentage**: Overall performance
- **Completion**: % of variants unlocked

### Customization

Users can:

1. **Select Active Variant**: Choose which version of each character to display
2. **Equip Accessories**: Add up to multiple accessories per character
3. **Mix and Match**: Create unique combinations

### LocalStorage Persistence

All progress is saved locally:

- `panceai_organ_characters_v1`: Collection progress
- `panceai_character_customization_v1`: Active variants and accessories

## Achievements Integration

The system includes 7 new achievements:

1. **Bone Collector** (Epic) - Unlock all MSK variants → Skeleton comes alive
2. **Cardiac Collector** (Rare) - Unlock all CV variants
3. **Respiratory Ranger** (Rare) - Unlock all PULM variants
4. **Organ System Master** (Epic) - Unlock all base characters
5. **Variant Virtuoso** (Legendary) - Unlock 50 variants
6. **Accessory Addict** (Epic) - Unlock 20 accessories
7. **Perfect Collection** (Legendary) - Unlock everything

## Technical Implementation

### Files Structure

```
config/
  organ-characters.ts         # Character definitions and config

lib/services/
  organCharacterService.ts    # Business logic and data management

components/characters/
  CharacterGallery.tsx        # Main inline gallery view
  CharacterCollection.tsx     # Full-screen modal view
  CharacterCard.tsx          # Individual character card
  CharacterDetailModal.tsx   # Character detail view
  UnlockNotification.tsx     # Unlock celebration
```

### Key Functions

```typescript
// Load user progress
loadOrganProgress(): UserOrganProgress

// Check for new unlocks
checkVariantUnlocks(progress, streak, totalQuestions): OrganVariantId[]
checkAccessoryUnlocks(progress, streak, totalQuestions): OrganAccessoryId[]

// Customization
changeActiveVariant(system, variantId)
toggleAccessory(system, accessoryId)

// Statistics
getSystemCompletion(progress, system): number
getOverallCompletion(progress): { percentage, ... }
```

## Future Enhancements

### Planned Features

1. **House System** - PA school-based team competition
2. **Weekly Leaderboards** - House Cup for most questions correct
3. **Character Battles** - Compare collections with friends
4. **Trading System** - Duplicate accessories can be shared
5. **Animated Characters** - CSS animations for special variants
6. **Sound Effects** - Audio feedback on unlocks
7. **Character Stories** - Lore for each variant
8. **Seasonal Events** - Limited-time holiday variants

### Database Integration

When moving to backend:

```typescript
// Prisma schema addition
model UserOrganProgress {
  id                String   @id @default(cuid())
  userId            String
  unlockedVariants  String[]
  unlockedAccessories String[]
  systemProgress    Json
  specialModeProgress Json
  customization     Json
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id])
  @@unique([userId])
}
```

## Best Practices

### For Developers

1. **Always test builds** - Run `npm run build` after changes
2. **Maintain rarity balance** - Don't make everything legendary
3. **Clear unlock paths** - Users should know how to unlock items
4. **Performance first** - Keep localStorage operations efficient
5. **Accessibility** - Ensure all interactions work with keyboard

### For Content Creators

1. **Medical accuracy** - Variant names should be clinically appropriate
2. **Professional tone** - Keep it educational but fun
3. **Clear descriptions** - Help users understand each variant
4. **Balanced difficulty** - Mix easy and hard unlocks

## User Guide

### Getting Started

1. Open PANaCEa app
2. Click **Settings** icon (top right)
3. Navigate to **Characters** tab
4. See your current collection

### Unlocking Items

1. **Study more** - Answer questions in different systems
2. **Build streaks** - Study consistently for accessories
3. **Master systems** - High accuracy unlocks special variants
4. **Explore modes** - Try Mini Lab, ECG drills, etc. for easter eggs

### Customization

1. Click any character in your collection
2. Select from unlocked variants
3. Add accessories to personalize
4. Mix and match across characters!

## Support

For issues or suggestions:

- GitHub: [Repository Issues](https://github.com/aaronjullger-lgtm/PANaCEa/issues)
- Feature requests: Use the "gamification" label

## Credits

- **Design**: Organ-themed medical education gamification
- **Development**: PANaCEa development team
- **Medical Accuracy**: Reviewed by PA educators
- **Icons**: Emoji-based for universal compatibility

---

**Remember**: The goal is to make studying fun while maintaining professional medical education standards. Happy collecting! 🎉
