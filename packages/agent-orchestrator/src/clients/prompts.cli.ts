import { pushPrompts } from '../clients/prompts.js';

async function main(): Promise<void> {
  console.log('[prompts] uploading agent system prompts to Langfuse managed prompts…');
  const results = await pushPrompts();
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}: ${r.status}${r.error ? ` — ${r.error}` : ''}`);
  }
}

main().catch((err) => {
  console.error('[prompts] failed:', err);
  process.exit(1);
});