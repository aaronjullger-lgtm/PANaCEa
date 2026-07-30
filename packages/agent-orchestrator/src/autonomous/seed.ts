import { enqueueTask } from '../autonomous/workQueue.js';

async function main(): Promise<void> {
  const tasks = [
    {
      type: 'test' as const,
      title: 'Add regression test for FSRS binary rating validation',
      description: 'Ensure the FSRS pipeline rejects any Hard/Easy rating values. Write a vitest that submits rating=2 (Hard) and rating=3 (Easy) and verifies they are rejected or remapped to binary Again/Good. Check lib/fsrs.ts and lib/implicit-metrics.ts.',
      priority: 1,
      tags: ['fsrs', 'safety', 'regression'],
    },
    {
      type: 'bugfix' as const,
      title: 'Audit edge-runtime Buffer usage in functions/api',
      description: 'Search functions/** for Buffer usage without nodejs_compat. Replace with Web APIs (TextEncoder/TextDecoder/Crypto) where possible. Check if any handlers import Buffer directly.',
      priority: 2,
      tags: ['edge', 'safety'],
    },
    {
      type: 'refactor' as const,
      title: 'Extract shared loading-state hook from dashboard components',
      description: 'Several dashboard components duplicate useState(null) -> fetch -> setState pattern. Extract a useAsyncResource hook. Search for components with isLoading state and consolidate.',
      priority: 3,
      tags: ['tech-debt', 'react'],
    },
  ];

  for (const t of tasks) {
    const task = await enqueueTask(t);
    console.log('  enqueued:', task.id, '|', task.type, '|', task.title);
  }
  console.log(`\nSeeded ${tasks.length} tasks.`);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});