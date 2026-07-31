import 'dotenv/config';
import { generateBatchForSystem } from '../services/ai/batchGeneratorService';

const TARGET_SYSTEMS = [
  { system: 'NEURO', current: 18, target: 38, deficit: 20 },
  { system: 'REPRO', current: 27, target: 43, deficit: 16 },
  { system: 'GI', current: 33, target: 49, deficit: 16 },
  { system: 'ENDO', current: 22, target: 32, deficit: 10 },
  { system: 'GU', current: 20, target: 27, deficit: 7 },
];

async function main() {
  console.log('=== Blueprint Gap Generator ===');
  console.log(`Target systems: ${TARGET_SYSTEMS.map(s => s.system).join(', ')}`);
  console.log(`Total deficit: ${TARGET_SYSTEMS.reduce((sum, s) => sum + s.deficit, 0)} questions\n`);

  const results: Record<string, { promoted: number; pending: number; failed: number }> = {};

  for (const { system, deficit } of TARGET_SYSTEMS) {
    console.log(`--- Generating for ${system} (need ${deficit} more) ---`);
    try {
      const batch = await generateBatchForSystem(system, deficit);
      results[system] = batch;
      console.log(`  Promoted: ${batch.promoted}, Pending: ${batch.pending}, Failed: ${batch.failed}`);
    } catch (error) {
      console.error(`  ERROR for ${system}:`, error instanceof Error ? error.message : error);
      results[system] = { promoted: 0, pending: 0, failed: 0 };
    }
  }

  console.log('\n=== Summary ===');
  let totalPromoted = 0;
  let totalPending = 0;
  let totalFailed = 0;
  for (const [system, r] of Object.entries(results)) {
    console.log(`${system}: ${r.promoted} promoted, ${r.pending} pending, ${r.failed} failed`);
    totalPromoted += r.promoted;
    totalPending += r.pending;
    totalFailed += r.failed;
  }
  console.log(`\nTotal: ${totalPromoted} promoted, ${totalPending} pending, ${totalFailed} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
