# Database Maintenance Scripts

This directory contains orchestration and maintenance scripts for the PANaCEa database.

## Scripts

### orchestrator.ts

**The Master Orchestrator** - Runs the complete bi-directional sync and health check workflow.

**Phases**:

1. 🔄 **Handshake** (Local → Cloud): Sync TypeScript registries to database
2. 🔬 **Diagnostic**: Validate database integrity
3. 🚑 **Auto-Mechanic**: Repair data issues (if script exists)
4. 💾 **Write-Back** (Cloud → Local): Capture new DB records to local files

**Usage**:

```bash
npm run db:orchestrate
```

### autoRepair.ts (Optional)

Auto-repair script for fixing data validation issues.

**To create**:

```typescript
#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Example: Fix null system values
  const noSystem = await prisma.condition.findMany({
    where: { system: null },
  });

  for (const cond of noSystem) {
    await prisma.condition.update({
      where: { id: cond.id },
      data: { system: 'OTHER' }, // Default system
    });
  }

  console.log(`✅ Fixed ${noSystem.length} conditions with missing system`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Documentation

See [ORCHESTRATION_GUIDE.md](../../ORCHESTRATION_GUIDE.md) for complete documentation on:

- How orchestration works
- When to run each phase
- Recovery procedures
- CI/CD integration
- Troubleshooting

## Quick Reference

```bash
# Full orchestration
npm run db:orchestrate

# Individual phases
npm run sync:all-registries    # Phase 1: Local → DB
npm run db:validate             # Phase 2: Validate
npm run db:sync-to-registry     # Phase 4: DB → Local
```
