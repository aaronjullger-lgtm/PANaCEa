# Manual Cleanup Instructions for CommandCenterHub.tsx

## Current Status
- File is at 2,206 lines (should be ~600 lines)
- Tab panel code still present (lines ~1100-2200)
- Needs manual removal of large code blocks

## Required Deletions

### 1. Remove All Tab Panel Content (Lines ~1100-2200)

Delete everything from this line:
```typescript
              <motion.div
                key="training"
```

Through the end of this block:
```typescript
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};
```

Keep only the final closing:
```typescript
      </div>
    </>
  );
};

export default CommandCenterHub;
```

### 2. Remove Unused Component Definitions

Delete these entire component definitions:
- `HeroTriple` (lines ~400-500)
- `OSCESection` (lines ~350-400)  
- `ModeCard` (lines ~650-750)
- `CategorySection` (lines ~750-850)
- `ResidencyCockpitSection` (lines ~850-950)

### 3. Remove Unused Imports

Remove from imports:
```typescript
VISUAL_DIAGNOSTICS_MODES,
CLINICAL_SIMULATION_MODES,
QUESTION_PRACTICE_MODES,
SPECIALTY_DRILL_MODES,
CATEGORY_INFO,
STUDY_OUTCOME_GROUPS,
getModeById,
type TrainingModeConfig,
type TrainingCategory,
```

Remove:
```typescript
import { AnimatePresence } from 'framer-motion';
```

### 4. Remove Unused State Variables

Delete:
```typescript
const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
```

### 5. Final Structure Should Be

```typescript
export const CommandCenterHub = () => {
  // ... state and hooks ...
  
  return (
    <>
      <ProgressRingWidget />
      
      <div ref={pullToRefreshRef} className="max-w-6xl mx-auto">
        {/* Refresh indicator */}
        {isRefreshing && <RefreshIndicator />}
        
        {/* Header */}
        <Header greeting={greeting} userName={user?.firstName} />
        
        {/* Welcome Back Card */}
        {!hasActiveSession && showWelcomeBack && lastSession && (
          <WelcomeBackCard />
        )}
        
        {/* Continue Learning */}
        {hasActiveSession && onResumeSession && (
          <ContinueLearningCard />
        )}
        
        {/* Exam Countdown + Time-Box Buttons */}
        {careerStage === 'student' && (
          <ExamCountdownSection />
        )}
        
        {/* Quick Stats */}
        <QuickStatsBar />
        
        {/* Circadian Insight */}
        {performanceData.length >= 20 && (
          <CircadianInsightCard />
        )}
        
        {/* Core Adaptive Hero */}
        <CoreAdaptiveHero />
        
        {/* Recommended for you */}
        <RecommendationFeed />
        
        {/* Grand Rounds */}
        <GrandRoundsBanner />
        
        {/* Current Curriculum (students only) */}
        {careerStage === 'student' && (
          <CurriculumSection />
        )}
        
        {/* PANRE-LA (practicing PAs only) */}
        {showPANREContent && (
          <PANRELASection />
        )}
      </div>
    </>
  );
};
```

## Expected Result
- File should be ~600 lines
- No tab navigation
- No training/resources/analytics panels
- Only 4 core sections on home page

## Testing After Cleanup
1. Run `npm run typecheck` - should pass
2. Navigate to `/study` - should show simplified home
3. Navigate to `/practice` - should show all training modes
4. Navigate to `/progress` - should show all analytics
