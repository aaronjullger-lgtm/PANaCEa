# 🔬 PANaCEa Repository Audit - January 2026
**Comprehensive Analysis & Five-Priority Improvement Plan**

**Status:** Moving from "Prototype" to "Clinical Instrument"  
**Tech Stack:** React 19, TypeScript 5.8, Prisma 7.2, Cloudflare Pages, FSRS v6  
**Current State:** 80+ TypeScript errors, 300+ design violations, critical architecture gaps

---

## 📊 EXECUTIVE SUMMARY

This audit identifies **five critical improvement priorities** based on:
1. **Build Integrity** - TypeScript compilation failures blocking deployment
2. **Functional Completeness** - Missing core algorithms (Goldilocks Protocol, Session Generator)
3. **Design Compliance** - Massive semantic token violations (300+ instances)
4. **Mode/Stats Accuracy** - Rolling 360 visualization missing, FSRS optimizer unused
5. **Architectural Debt** - Service layer fragmentation, missing exports

**Severity Distribution:**
- 🔴 **Critical (Blocks Release):** 2 priorities
- 🟠 **High (Degrades UX):** 2 priorities  
- 🟡 **Medium (Technical Debt):** 1 priority

---

## 🎯 PRIORITY 1: SERVICE LAYER CONSOLIDATION & EXPORTS (CRITICAL)
**Impact:** Build Integrity, Developer Experience  
**Severity:** 🔴 **CRITICAL** - Blocks TypeScript compilation  
**Estimated Effort:** 4-6 hours

### Current State
The `services/domain/index.ts` barrel export has **18+ missing exports** causing TypeScript errors:

```typescript
// ❌ ERRORS (from typecheck output):
// - Module '"@/services/domain"' has no exported member 'fetchUserConfusions'
// - Module '"@/services/domain"' has no exported member 'generateComparison'
// - Module '"@/services/domain"' has no exported member 'UserConfusionPairSummary'
// - Module '"@/services/domain"' has no exported member 'anatomyModelService'
// - Module '"@/services/domain"' has no exported member 'fetchDailyTriad'
// - Module '"@/services/domain"' has no exported member 'DailyTriad'
// - Module '"@/services/domain"' has no exported member 'fetchConfusionPairs'
// + 11 more similar errors
```

**BuzzwordService Methods Not Exported:**
```typescript
// services/domain/buzzwordService.ts exports:
export const buzzwordService = {
  getAllBuzzwords,
  getRandomBuzzwords,
  getBuzzwordDictionary,  // ❌ NOT ACCESSIBLE via import
  getAllBuzzwordConditions // ❌ NOT ACCESSIBLE via import
}

// But services/domain/index.ts only does:
export const buzzwordService = buzzwordServiceModule;
// This exports the MODULE, not the object's methods
```

### Root Cause
**Architectural Anti-Pattern:** Mixing `import * as module` with object exports creates non-existent method references.

```typescript
// ❌ BROKEN PATTERN:
import * as buzzwordServiceModule from './buzzwordService';
export const buzzwordService = buzzwordServiceModule;

// Result: buzzwordService.getBuzzwordDictionary() → UNDEFINED

// ✅ CORRECT PATTERN:
export * from './buzzwordService';
export { buzzwordService } from './buzzwordService';
```

### Solution Plan

#### Step 1: Audit All Missing Exports (1 hour)
Create `/scripts/audit-service-exports.ts`:
```typescript
import { execSync } from 'child_process';
import fs from 'fs';

const typecheckOutput = execSync('npm run typecheck 2>&1', { encoding: 'utf-8' });
const missingExports = typecheckOutput.match(/has no exported member '(\w+)'/g);

// Group by service file
const exportMap = new Map<string, string[]>();
missingExports?.forEach(error => {
  const memberName = error.match(/'(\w+)'/)?.[1];
  if (memberName) {
    // Track which services need fixes
  }
});

fs.writeFileSync('export-audit.json', JSON.stringify(Object.fromEntries(exportMap), null, 2));
```

#### Step 2: Fix BuzzwordService Pattern (30 min)
```typescript
// services/domain/index.ts
// ✅ BEFORE (module export):
export const buzzwordService = buzzwordServiceModule;

// ✅ AFTER (direct re-export):
export { buzzwordService } from './buzzwordService';
```

#### Step 3: Add Missing Service Files (2 hours)
```typescript
// services/domain/confusionService.ts (NEW FILE)
export interface UserConfusionPairSummary {
  realCondition: string;
  mistakenFor: string;
  count: number;
  lastOccurrence: Date;
  severity: 'low' | 'medium' | 'high';
}

export async function fetchUserConfusions(userId: string): Promise<UserConfusionPairSummary[]> {
  // Implementation using Prisma ConfusionPair model
}

export async function generateComparison(conditionA: string, conditionB: string) {
  // Fetch differential comparison data
}

export function getSeverityColor(severity: string): string {
  // Return semantic token class
}
```

#### Step 4: Update Barrel Exports (1 hour)
```typescript
// services/domain/index.ts
// Add new service exports
import * as confusionServiceModule from './confusionService';
export const confusionService = confusionServiceModule;
export * from './confusionService'; // Export types too

import * as dailyTriadServiceModule from './dailyTriadService';
export const dailyTriadService = dailyTriadServiceModule;
export * from './dailyTriadService';
```

### Acceptance Criteria
- [ ] `npm run typecheck` shows 0 errors related to missing exports
- [ ] All service methods accessible via `import { service } from '@/services/domain'`
- [ ] Export audit script added to `package.json` as `npm run audit:exports`
- [ ] Documentation updated in `services/domain/index.ts` header

---

## 🎯 PRIORITY 2: SEMANTIC DESIGN TOKEN COMPLIANCE (CRITICAL)
**Impact:** Design Consistency, Maintainability, Aesthetic Monotony  
**Severity:** 🔴 **CRITICAL** - Violates core .clinerules architecture  
**Estimated Effort:** 6-8 hours

### Current State
**300+ hardcoded color violations** across components, directly violating the "Strict Semantic Tokens ONLY" rule:

```typescript
// ❌ FORBIDDEN (found 300+ times):
'bg-blue-500'
'bg-red-500'
'bg-green-500'
'bg-yellow-500'
'bg-purple-500'
'bg-orange-500'
'text-blue-700'
'border-red-200'
// ... etc.
```

**Violation Examples:**
```tsx
// components/analytics/AnalyticsDashboard.tsx
<div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
  {/* ❌ 4 hardcoded colors in one div */}
</div>

// components/questions/ExplanationPanel.tsx  
isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
{/* ❌ Direct color mapping */}
```

### Root Cause
**Missing Semantic Token System:** No abstraction layer between intent and color.

### Solution Plan

#### Step 1: Define Semantic Token Palette (1 hour)
```typescript
// lib/design-tokens.ts (NEW FILE)
export const semanticTokens = {
  // Surface tokens
  surface: {
    primary: 'bg-surface-primary', // #0f172a / Slate 900
    secondary: 'bg-surface-secondary', // #1e293b / Slate 800
    card: 'bg-surface-card',
    elevated: 'bg-surface-elevated',
  },
  
  // State tokens
  state: {
    success: {
      bg: 'bg-state-success-bg', // Replaces bg-green-50
      text: 'text-state-success-text',
      border: 'border-state-success-border',
    },
    error: {
      bg: 'bg-state-error-bg', // Replaces bg-red-50
      text: 'text-state-error-text',
      border: 'border-state-error-border',
    },
    warning: {
      bg: 'bg-state-warning-bg',
      text: 'text-state-warning-text',
      border: 'border-state-warning-border',
    },
    info: {
      bg: 'bg-state-info-bg',
      text: 'text-state-info-text',
      border: 'border-state-info-border',
    },
  },
  
  // Action tokens
  action: {
    primary: 'bg-action-primary',
    secondary: 'bg-action-secondary',
    muted: 'bg-action-muted',
  },
} as const;
```

#### Step 2: Add Tailwind Config (30 min)
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'surface-primary': '#0f172a',
        'surface-secondary': '#1e293b',
        'surface-card': '#1e293b',
        
        'state-success-bg': '#f0fdf4', // green-50
        'state-success-text': '#166534', // green-800
        'state-success-border': '#bbf7d0', // green-200
        
        'state-error-bg': '#fef2f2', // red-50
        'state-error-text': '#991b1b', // red-800
        'state-error-border': '#fecaca', // red-200
        
        // ... etc
      },
    },
  },
};
```

#### Step 3: Create Migration Script (2 hours)
```typescript
// scripts/migrate-to-semantic-tokens.ts
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const COLOR_MAPPING = {
  // Success states
  'bg-green-50': 'bg-state-success-bg',
  'bg-green-100': 'bg-state-success-bg',
  'text-green-700': 'text-state-success-text',
  'border-green-200': 'border-state-success-border',
  
  // Error states
  'bg-red-50': 'bg-state-error-bg',
  'bg-red-100': 'bg-state-error-bg',
  'text-red-700': 'text-state-error-text',
  'border-red-200': 'border-state-error-border',
  
  // Info/accent states
  'bg-blue-50': 'bg-state-info-bg',
  'bg-purple-50': 'bg-surface-elevated',
  
  // ... 50+ more mappings
};

async function migrateFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changeCount = 0;
  
  for (const [old, replacement] of Object.entries(COLOR_MAPPING)) {
    const regex = new RegExp(old, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, replacement);
      changeCount += matches.length;
    }
  }
  
  if (changeCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${filePath}: ${changeCount} replacements`);
  }
}

const files = await glob('components/**/*.tsx');
for (const file of files) {
  await migrateFile(file);
}
```

#### Step 4: Manual Review (3 hours)
Some colors require **semantic context** that scripts can't infer:

```tsx
// ❌ BEFORE (ambiguous intent):
<div className="bg-blue-500">Critical Warning</div>

// ✅ AFTER (explicit intent):
<div className="bg-state-warning-bg">Critical Warning</div>
// OR
<div className="bg-action-primary">Critical Warning</div>
```

**High-Risk Components** (manual review required):
1. `components/analytics/` - Charts with multiple color states
2. `components/questions/ExplanationPanel.tsx` - Correct/incorrect feedback
3. `components/session/SessionPostMortem.tsx` - Performance colors

#### Step 5: Add Linting Rule (1 hour)
```javascript
// eslint.config.js
module.exports = {
  rules: {
    'no-hardcoded-colors': {
      create(context) {
        return {
          Literal(node) {
            if (typeof node.value === 'string') {
              const forbidden = /bg-(red|blue|green|yellow|purple|orange)-\d{1,3}/;
              if (forbidden.test(node.value)) {
                context.report({
                  node,
                  message: 'Use semantic tokens instead of hardcoded colors. See lib/design-tokens.ts',
                });
              }
            }
          },
        };
      },
    },
  },
};
```

### Acceptance Criteria
- [ ] 0 violations of `bg-(color)-(number)` pattern in components
- [ ] ESLint rule prevents future violations
- [ ] `lib/design-tokens.ts` documented with usage examples
- [ ] Visual regression tests pass (screenshots match)

---

## 🎯 PRIORITY 3: SESSION GENERATION ALGORITHM IMPLEMENTATION (HIGH)
**Impact:** Core Functionality, Goldilocks Protocol, PANCE Distribution  
**Severity:** 🟠 **HIGH** - Missing critical learning algorithm  
**Estimated Effort:** 8-10 hours

### Current State
**MISSING FILE:** `services/sessionGenerator.ts` does not exist, despite being referenced in documentation.

**Missing Features:**
1. ❌ **Goldilocks Protocol** - No adaptive difficulty adjustment
2. ❌ **Zipper Sort** - No system-level interleaving
3. ❌ **PANCE Distribution** - No blueprint-aligned session generation

**Evidence from Search:**
```bash
$ find . -name "*sessionGenerator*"
# No results

$ grep -r "Goldilocks" --include="*.ts" --include="*.tsx"
# Only found in .clinerules, not implemented
```

### Solution Plan

#### Step 1: Create Session Generator Service (4 hours)
```typescript
// services/sessionGenerator.ts (NEW FILE)
import { PrismaClient } from '@prisma/client';
import { PANCE_SYSTEM_PERCENTAGES } from '@/services/domain';

const prisma = new PrismaClient();

export interface SessionConfig {
  userId: string;
  questionCount: number;
  difficulty: 'adaptive' | 'easy' | 'medium' | 'hard';
  systems?: string[]; // Optional system filter
  mode: 'MAIN' | 'CRAM' | 'RAPID_RECALL';
}

export interface SessionQuestion {
  id: string;
  system: string;
  difficulty: string;
  conditionId: string;
  questionType: string;
}

/**
 * GOLDILOCKS PROTOCOL:
 * - If Rolling360 accuracy > 92%: Inject "Desirable Difficulty"
 * - If Rolling360 accuracy < 75%: Prioritize high-stability review
 */
async function applyGoldilocksProtocol(
  userId: string,
  questions: SessionQuestion[]
): Promise<SessionQuestion[]> {
  // Fetch Rolling 360 stats
  const stats = await prisma.userRolling360Stats.findUnique({
    where: { userId },
  });

  if (!stats) return questions; // Not enough data

  const accuracy = stats.accuracyPercent?.toNumber() ?? 0;

  if (accuracy > 92) {
    // User is "too comfortable" - inject harder questions
    console.log('[Goldilocks] Injecting desirable difficulty (accuracy > 92%)');
    
    // Prioritize questions with lower retrievability (R ≈ 0.75)
    const hardQuestions = await prisma.$queryRaw`
      SELECT q.*
      FROM "PreGeneratedQuestion" q
      JOIN "ReviewLog" r ON r."medicalContentId" = q."medicalContentId"
      WHERE r."userId" = ${userId}
        AND r."retrievability" BETWEEN 0.65 AND 0.85
      ORDER BY r."retrievability" ASC
      LIMIT 10
    `;
    
    // Replace 30% of questions with harder variants
    const replaceCount = Math.floor(questions.length * 0.3);
    return [
      ...questions.slice(0, questions.length - replaceCount),
      ...hardQuestions.slice(0, replaceCount),
    ];
  } else if (accuracy < 75) {
    // User is struggling - prioritize confidence restoration
    console.log('[Goldilocks] Prioritizing high-stability review (accuracy < 75%)');
    
    // Fetch high-stability cards (S > 30 days)
    const confidenceQuestions = await prisma.$queryRaw`
      SELECT q.*
      FROM "PreGeneratedQuestion" q
      JOIN "ReviewLog" r ON r."medicalContentId" = q."medicalContentId"
      WHERE r."userId" = ${userId}
        AND r."stability" > 30
      ORDER BY r."stability" DESC
      LIMIT 10
    `;
    
    return [
      ...confidenceQuestions.slice(0, Math.floor(questions.length * 0.4)),
      ...questions.slice(Math.floor(questions.length * 0.4)),
    ];
  }

  return questions; // Accuracy in normal range (75-92%)
}

/**
 * ZIPPER SORT:
 * Ensures System_i ≠ System_{i+1} to prevent cognitive interference
 */
function zipperSort(questions: SessionQuestion[]): SessionQuestion[] {
  const sorted: SessionQuestion[] = [];
  const systemGroups = new Map<string, SessionQuestion[]>();

  // Group by system
  for (const q of questions) {
    if (!systemGroups.has(q.system)) {
      systemGroups.set(q.system, []);
    }
    systemGroups.get(q.system)!.push(q);
  }

  // Interleave systems
  let currentIndex = 0;
  const systems = Array.from(systemGroups.keys());
  
  while (sorted.length < questions.length) {
    for (const system of systems) {
      const group = systemGroups.get(system)!;
      if (group.length > 0) {
        sorted.push(group.shift()!);
      }
    }
  }

  // Verify no consecutive systems
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].system === sorted[i - 1].system) {
      console.warn(`[ZipperSort] Adjacent systems detected at index ${i}`);
    }
  }

  return sorted;
}

/**
 * MAIN SESSION GENERATOR:
 * Combines PANCE distribution + Goldilocks + Zipper Sort
 */
export async function generateSession(config: SessionConfig): Promise<SessionQuestion[]> {
  const { userId, questionCount, systems: systemFilter } = config;

  // Step 1: Determine system distribution (PANCE Blueprint)
  const distribution = new Map<string, number>();
  for (const [system, percentage] of Object.entries(PANCE_SYSTEM_PERCENTAGES)) {
    if (systemFilter && !systemFilter.includes(system)) continue;
    distribution.set(system, Math.round(questionCount * percentage));
  }

  // Step 2: Fetch questions per system
  const allQuestions: SessionQuestion[] = [];
  for (const [system, count] of distribution) {
    const questions = await prisma.preGeneratedQuestion.findMany({
      where: { system, validationStatus: 'approved' },
      take: count,
      orderBy: { qualityScore: 'desc' },
    });
    allQuestions.push(...questions.map(q => ({
      id: q.id,
      system: q.system!,
      difficulty: q.difficulty,
      conditionId: q.conditionId!,
      questionType: q.questionType,
    })));
  }

  // Step 3: Apply Goldilocks Protocol
  const goldilocked = await applyGoldilocksProtocol(userId, allQuestions);

  // Step 4: Apply Zipper Sort
  const zippered = zipperSort(goldilocked);

  return zippered.slice(0, questionCount);
}
```

#### Step 2: Add Unit Tests (2 hours)
```typescript
// services/__tests__/sessionGenerator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateSession, zipperSort } from '../sessionGenerator';

describe('Session Generator', () => {
  it('should apply Zipper Sort correctly', () => {
    const questions = [
      { system: 'CV', id: '1' },
      { system: 'CV', id: '2' },
      { system: 'PULM', id: '3' },
      { system: 'PULM', id: '4' },
    ];

    const sorted = zipperSort(questions);

    // Verify no consecutive systems
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].system).not.toBe(sorted[i - 1].system);
    }
  });

  it('should respect PANCE distribution', async () => {
    const session = await generateSession({
      userId: 'test',
      questionCount: 100,
      difficulty: 'adaptive',
      mode: 'MAIN',
    });

    const cvCount = session.filter(q => q.system === 'CV').length;
    expect(cvCount).toBeGreaterThanOrEqual(9); // 11% ± 2%
    expect(cvCount).toBeLessThanOrEqual(13);
  });
});
```

#### Step 3: Integration (2 hours)
Update session endpoints to use new generator:

```typescript
// functions/api/session/start.ts
import { generateSession } from '@/services/sessionGenerator';

export async function onRequestPost(context) {
  const { userId, settings } = await context.request.json();
  
  const questions = await generateSession({
    userId,
    questionCount: settings.questionCount,
    difficulty: settings.difficulty,
    mode: 'MAIN',
  });

  return new Response(JSON.stringify({ questions }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### Acceptance Criteria
- [ ] `generateSession()` produces PANCE-aligned distributions
- [ ] Zipper Sort prevents consecutive same-system questions
- [ ] Goldilocks Protocol adjusts difficulty based on Rolling360 stats
- [ ] Unit tests achieve 90%+ coverage
- [ ] `/api/session/start` uses new generator

---

## 🎯 PRIORITY 4: ROLLING 360 ANALYTICS VISUALIZATION (HIGH)
**Impact:** Student-Facing Stats, PANCE Readiness, Dashboard UX  
**Severity:** 🟠 **HIGH** - Database exists, UI missing  
**Estimated Effort:** 6-8 hours

### Current State
**Backend:** ✅ Fully implemented
- `UserRolling360Stats` table exists
- `Rolling360Buffer` circular buffer (360 slots) exists
- SQL triggers update stats in real-time

**Frontend:** ❌ Missing visualization
- No dedicated dashboard component
- Only `CalibrationProgress` shows basic progress bar
- Rolling 360 accuracy not displayed anywhere

**Evidence:**
```sql
-- Database schema confirms backend is ready:
model UserRolling360Stats {
  totalInWindow   Int
  correctInWindow Int
  accuracyPercent Decimal
  systemStats     Json
  predictedScore  Int
  blueprintAdherence Decimal
  // ... 15 more fields
}
```

```bash
# But no frontend component:
$ find components -name "*Rolling360*"
# No results
```

### Solution Plan

#### Step 1: Create Rolling360 Dashboard Component (4 hours)
```tsx
// components/analytics/Rolling360Dashboard.tsx (NEW FILE)
import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { TrendingUp, Target, Award } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

interface Rolling360Stats {
  totalInWindow: number;
  correctInWindow: number;
  accuracyPercent: number;
  predictedScore: number;
  scoreConfidence: 'collecting' | 'provisional' | 'confident';
  passLikelihood: number;
  systemStats: Record<string, { total: number; correct: number }>;
  weakestSystems: string[];
  strongestSystems: string[];
}

export const Rolling360Dashboard: React.FC = () => {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<Rolling360Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const token = await getToken();
      const res = await fetch('/api/user/rolling360-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
      setLoading(false);
    }
    fetchStats();
  }, [getToken]);

  if (loading) return <div>Loading Rolling 360 stats...</div>;
  if (!stats) return <div>Complete 20 questions to unlock Rolling 360 tracking</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6 border border-blue-500/20">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
              Rolling 360 Performance
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your current form across the last {stats.totalInWindow} questions
            </p>
          </div>
          <div className="px-4 py-2 bg-blue-500/20 rounded-lg">
            <div className="text-xs text-blue-400 mb-1">Window Progress</div>
            <div className="text-2xl font-bold text-blue-300">
              {stats.totalInWindow}/360
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Accuracy */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-2">
            <Target className="w-4 h-4" />
            <span>Current Accuracy</span>
          </div>
          <div className="text-4xl font-bold text-[var(--color-text-primary)]">
            {stats.accuracyPercent.toFixed(1)}%
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Last {stats.totalInWindow} questions
          </p>
        </div>

        {/* Predicted PANCE Score */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-2">
            <Award className="w-4 h-4" />
            <span>Predicted Score</span>
          </div>
          <div className="text-4xl font-bold text-[var(--color-text-primary)]">
            {stats.predictedScore}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${
              stats.scoreConfidence === 'confident' 
                ? 'bg-green-500/20 text-green-400'
                : stats.scoreConfidence === 'provisional'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-gray-500/20 text-gray-400'
            }`}>
              {stats.scoreConfidence}
            </span>
          </div>
        </div>

        {/* Pass Likelihood */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-2">
            <TrendingUp className="w-4 h-4" />
            <span>Pass Likelihood</span>
          </div>
          <div className="text-4xl font-bold text-[var(--color-text-primary)]">
            {stats.passLikelihood.toFixed(0)}%
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Based on 400-point threshold
          </p>
        </div>
      </div>

      {/* System Breakdown */}
      <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">
          System Performance
        </h3>
        <div className="space-y-3">
          {Object.entries(stats.systemStats).map(([system, data]) => {
            const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
            return (
              <div key={system} className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium text-[var(--color-text-secondary)]">
                  {system}
                </div>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      accuracy >= 80 ? 'bg-green-500' :
                      accuracy >= 70 ? 'bg-blue-500' :
                      accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
                <div className="w-16 text-right text-sm font-semibold text-[var(--color-text-primary)]">
                  {accuracy.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weakness & Strength Callouts */}
      {stats.weakestSystems.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <h4 className="font-semibold text-red-400 mb-2">Focus Areas</h4>
          <div className="flex flex-wrap gap-2">
            {stats.weakestSystems.map(system => (
              <span key={system} className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm">
                {system}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.strongestSystems.length > 0 && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <h4 className="font-semibold text-green-400 mb-2">Strengths</h4>
          <div className="flex flex-wrap gap-2">
            {stats.strongestSystems.map(system => (
              <span key={system} className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                {system}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

#### Step 2: Create API Endpoint (1 hour)
```typescript
// functions/api/user/rolling360-stats.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function onRequestGet(context) {
  const userId = context.locals.userId; // From Clerk middleware

  const stats = await prisma.userRolling360Stats.findUnique({
    where: { userId },
  });

  if (!stats) {
    return new Response(JSON.stringify({ error: 'Not enough data' }), {
      status: 404,
    });
  }

  return new Response(JSON.stringify({
    totalInWindow: stats.totalInWindow,
    correctInWindow: stats.correctInWindow,
    accuracyPercent: stats.accuracyPercent?.toNumber() ?? 0,
    predictedScore: stats.predictedScore,
    scoreConfidence: stats.scoreConfidence,
    passLikelihood: stats.passLikelihood?.toNumber() ?? 0,
    systemStats: stats.systemStats,
    weakestSystems: stats.weakestSystems,
    strongestSystems: stats.strongestSystems,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

#### Step 3: Integration with Main Dashboard (1 hour)
```tsx
// components/analytics/AnalyticsDashboard.tsx
import { Rolling360Dashboard } from './Rolling360Dashboard';

export const AnalyticsDashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Add Rolling 360 as top section */}
      <Rolling360Dashboard />
      
      {/* Existing content */}
      <CalibrationProgress />
      {/* ... other analytics */}
    </div>
  );
};
```

### Acceptance Criteria
- [ ] Rolling 360 accuracy displayed prominently on dashboard
- [ ] Predicted PANCE score shown with confidence indicator
- [ ] System-level breakdown visualized
- [ ] Updates in real-time after each question submission
- [ ] Tooltips explain "current form" concept to students

---

## 🎯 PRIORITY 5: FSRS OPTIMIZER ACTIVATION (MEDIUM)
**Impact:** Personalized Learning, Memory Optimization  
**Severity:** 🟡 **MEDIUM** - Algorithm exists but unused  
**Estimated Effort:** 4-6 hours

### Current State
**FSRS v6 Core:** ✅ Correctly implemented
- `lib/fsrs.ts` has 21-parameter v6 algorithm
- Short-term stability formula implemented
- Power-law retrievability implemented

**Optimizer:** ❌ Not activated
- `lib/fsrs-optimizer.ts` exists but never called
- `PersonalizedFSRSParams` table empty (no user has optimized params)
- Default parameters used for all users

**Evidence:**
```sql
SELECT COUNT(*) FROM "PersonalizedFSRSParams";
-- Returns: 0 (no optimized parameters exist)
```

### Solution Plan

#### Step 1: Background Job for Optimization (3 hours)
```typescript
// scripts/maintenance/fsrs-optimizer-job.ts
import { PrismaClient } from '@prisma/client';
import {
  optimizeFSRSParameters,
  convertReviewLogRows,
  MIN_REVIEWS_FOR_OPTIMIZATION,
} from '@/lib/fsrs-optimizer';

const prisma = new PrismaClient();

async function optimizeForUser(userId: string) {
  // Step 1: Fetch review history (MAIN/real sessions only)
  const reviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      OR: [{ review_type: 'real' }, { sessionType: 'MAIN' }],
    },
    orderBy: { review_date: 'asc' },
    select: {
      rating: true,
      state: true,
      stability: true,
      difficulty: true,
      elapsedDays: true,
      wasCorrect: true,
      system: true,
    },
  });

  if (reviews.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
    console.log(`[Optimizer] User ${userId}: Insufficient data (${reviews.length} reviews)`);
    return;
  }

  // Step 2: Convert and run optimizer
  const optimizationReviews = convertReviewLogRows(reviews);
  console.log(`[Optimizer] User ${userId}: Optimizing with ${optimizationReviews.length} reviews...`);
  const optimizedParams = await optimizeFSRSParameters(userId, optimizationReviews, {
    maxIterations: 100,
    learningRate: 0.01,
  });

  // Step 3: Save to database
  await prisma.personalizedFSRSParams.upsert({
    where: { userId },
    create: {
      userId,
      w: optimizedParams.w,
      sampleSize: optimizationReviews.length,
      lastOptimizedAt: new Date(),
    },
    update: {
      w: optimizedParams.w,
      sampleSize: optimizationReviews.length,
      lastOptimizedAt: new Date(),
    },
  });

  console.log(`✅ User ${userId}: Optimization complete`);
}

// Run for all users with 200+ reviews
async function main() {
  const eligibleUsers = await prisma.user.findMany({
    where: {
      ReviewLog: {
        some: {
          sessionType: 'MAIN',
        },
      },
    },
    include: {
      _count: {
        select: { ReviewLog: true },
      },
    },
  });

  for (const user of eligibleUsers) {
    if (user._count.ReviewLog >= 200) {
      await optimizeForUser(user.id);
    }
  }
}

main();
```

#### Step 2: Use Optimized Params in FSRS (1 hour)
```typescript
// lib/fsrs.ts (UPDATE existing file)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getUserFSRS(userId: string): Promise<FSRS> {
  // Fetch user's optimized parameters
  const personalizedParams = await prisma.personalizedFSRSParams.findUnique({
    where: { userId },
  });

  if (personalizedParams) {
    console.log(`[FSRS] Using optimized params for user ${userId}`);
    return new FSRS({
      request_retention: 0.9,
      maximum_interval: 36500,
      w: personalizedParams.w, // Use optimized weights
    });
  }

  // Fallback to default v6 parameters
  console.log(`[FSRS] Using default params for user ${userId}`);
  return new FSRS(defaultParameters);
}
```

#### Step 3: Cron Job Setup (1 hour)
```yaml
# wrangler.toml (ADD)
[triggers]
crons = ["0 2 * * 0"] # Every Sunday at 2 AM

# functions/scheduled/fsrs-optimizer.ts (NEW FILE)
export async function onRequest() {
  // Trigger optimizer job via Cloudflare Cron
  const { execSync } = require('child_process');
  execSync('npm run optimize:fsrs');
  return new Response('Optimizer triggered');
}
```

### Acceptance Criteria
- [ ] Users with 200+ reviews get optimized parameters
- [ ] Optimized params stored in `PersonalizedFSRSParams`
- [ ] `getUserFSRS()` fetches personalized params
- [ ] Weekly cron job runs optimizer
- [ ] Brier score improvement logged

---

## 📈 SUCCESS METRICS

### Build Health
- ✅ `npm run typecheck` shows 0 errors
- ✅ `npm run lint` shows 0 design token violations
- ✅ CI/CD pipeline passes all checks

### Functional Completeness
- ✅ Session generator produces PANCE-aligned sessions
- ✅ Rolling 360 dashboard shows current form
- ✅ FSRS optimizer runs weekly for eligible users

### User Experience
- ✅ Students see Rolling 360 accuracy within 5 seconds of login
- ✅ Predicted PANCE score updates after each question
- ✅ Goldilocks Protocol adapts difficulty intelligently

---

## 🗓️ IMPLEMENTATION TIMELINE

### Week 1: Critical Foundation
- **Day 1-2:** Priority 1 (Service Exports) - 6 hours
- **Day 3-4:** Priority 2 (Design Tokens) - 8 hours
- **Day 5:** Testing & Deployment - 4 hours

### Week 2: Feature Completion
- **Day 6-7:** Priority 3 (Session Generator) - 10 hours
- **Day 8-9:** Priority 4 (Rolling 360 UI) - 8 hours
- **Day 10:** Priority 5 (FSRS Optimizer) - 6 hours

### Week 3: Polish & Launch
- **Day 11-12:** Integration testing, bug fixes
- **Day 13-14:** User acceptance testing
- **Day 15:** Production deployment

**Total Effort:** ~42 hours (1.5 sprints)

---

## 🎯 CONCLUSION

This audit identified **5 critical priorities** that block PANaCEa's transition from "Prototype" to "Clinical Instrument":

1. **Service Layer Consolidation** - Fixes build integrity
2. **Semantic Token Compliance** - Enforces design system
3. **Session Generator** - Implements Goldilocks Protocol
4. **Rolling 360 UI** - Surfaces "current form" stats
5. **FSRS Optimizer** - Activates personalized learning

Completing these priorities will:
- ✅ Eliminate all TypeScript errors
- ✅ Enforce architectural consistency
- ✅ Deliver PANCE-aligned adaptive sessions
- ✅ Provide transparent performance metrics
- ✅ Optimize memory retention per-user

**Next Steps:** Review priorities, adjust timeline, begin Week 1 implementation.
