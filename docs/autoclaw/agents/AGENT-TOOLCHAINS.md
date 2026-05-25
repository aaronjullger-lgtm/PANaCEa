# Agent Toolchains

Tool-to-agent mapping, tool dependencies, and configuration for all 10 PANaCEa agent tools.

---

## Tool Map

### Student-Facing Tools

#### `clinical_library_search`
- **Input:** `{ query: string, system?: string, limit?: number }`
- **Returns:** Matching conditions, drugs, guidelines from the clinical library
- **Used by:** question-generation, clinical-content-auditor, study-plan
- **Category:** read

#### `user_progress_summary`
- **Input:** `{ userId: string }`
- **Returns:** Study stats: total reviews, accuracy, streak, weak areas
- **Used by:** study-plan, session-pipeline, dashboard-analytics
- **Category:** read

#### `fsrs_due_count`
- **Input:** `{ userId: string }`
- **Returns:** Due today, overdue, new available counts
- **Used by:** study-plan, fsrs-guardrails, dashboard-analytics
- **Category:** read

### Content Quality Tools

#### `content_health_audit`
- **Input:** `{ minHealthScore?: number, system?: string }`
- **Returns:** Content items below health threshold, quality flags
- **Used by:** clinical-content-auditor, content-refinery
- **Category:** read

#### `question_quality_check`
- **Input:** `{ minAttempts?: number, maxFlagCount?: number }`
- **Returns:** Flagged questions, poor discriminability, stale content
- **Used by:** question-generation, regression-guard
- **Category:** read

#### `condition_verify`
- **Input:** `{ conditionId?: string, conditionName?: string }`
- **Returns:** Medical accuracy check: correct name, system, epidemiology
- **Used by:** medical-verifier, clinical-content-auditor
- **Category:** read

### System Health Tools

#### `blueprint_coverage_check`
- **Input:** `{ system?: string, taskCategory?: string }`
- **Returns:** Coverage gaps by NCCPA blueprint category
- **Used by:** blueprint-coverage, question-generation
- **Category:** read

#### `drill_coverage_check`
- **Input:** `{ drillType?: string }`
- **Returns:** Drill type availability, active drills, content counts
- **Used by:** session-pipeline, study-plan
- **Category:** read

### Infrastructure Tools

#### `database_integrity_check`
- **Input:** `{ checkType: 'orphans' | 'fks' | 'indexes' | 'all' }`
- **Returns:** Integrity report: orphaned records, missing FKs, missing indexes
- **Used by:** prisma-data-integrity, identity-migration, repo-hygiene
- **Category:** read

#### `fsrs_calibration_status`
- **Input:** `{ userId?: string }`
- **Returns:** FSRS parameter health, calibration drift, anomaly detection
- **Used by:** fsrs-guardrails, regression-guard
- **Category:** read

---

## Agent-Specific Toolchains

### Content Pipeline Chain
```
content-refinery ← content_health_audit
       ↓
question-generation ← clinical_library_search + blueprint_coverage_check
       ↓
medical-verifier ← condition_verify
       ↓
clinical-content-auditor ← content_health_audit + condition_verify + clinical_library_search
```

### Learning Pipeline Chain
```
session-pipeline ← user_progress_summary + drill_coverage_check
       ↓
fsrs-guardrails ← fsrs_due_count + fsrs_calibration_status
       ↓
study-plan ← user_progress_summary + fsrs_due_count + drill_coverage_check + clinical_library_search
       ↓
dashboard-analytics ← user_progress_summary + fsrs_due_count
```

### Infrastructure Chain
```
prisma-data-integrity ← database_integrity_check + fsrs_calibration_status
       ↓
identity-migration ← database_integrity_check
       ↓
repo-hygiene ← database_integrity_check
```

---

## Tool Registry Configuration

### Default Registry (10 tools)
```typescript
import { createDefaultToolRegistry } from '@/lib/services/agents/tools';
const registry = createDefaultToolRegistry();
// All 10 tools available
```

### Clinical Agent Registry (3 tools)
```typescript
import { createClinicalToolRegistry } from '@/lib/services/agents/tools';
const registry = createClinicalToolRegistry();
// clinical_library_search, user_progress_summary, fsrs_due_count
```

### Quality Agent Registry (3 tools)
```typescript
import { createQualityToolRegistry } from '@/lib/services/agents/tools';
const registry = createQualityToolRegistry();
// content_health_audit, question_quality_check, condition_verify
```

### Infrastructure Agent Registry (2 tools)
```typescript
import { createInfraToolRegistry } from '@/lib/services/agents/tools';
const registry = createInfraToolRegistry();
// database_integrity_check, fsrs_calibration_status
```

---

## Adding a New Tool

1. Create tool definition in `lib/services/agents/tools/<name>.ts`:
```typescript
export const myNewTool: AgentTool = {
  name: 'my_new_tool',
  description: 'What it does and when to use it',
  category: 'read',
  inputSchema: z.object({
    param1: z.string(),
  }),
  handler: async (input, ctx) => {
    // Implementation
  },
};
```

2. Register in `lib/services/agents/tools/index.ts`:
```typescript
import { myNewTool } from './myNewTool';
export { myNewTool } from './myNewTool';
// Add to appropriate category array
```

3. Add test in `lib/services/agents/tools/__tests__/myNewTool.test.ts`

4. Update agent catalog if new agent domain created
