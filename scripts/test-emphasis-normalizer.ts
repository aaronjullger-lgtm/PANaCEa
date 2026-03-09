import { normalizeEmphasis } from './emphasis-normalizer';

const tests: Array<[string, string]> = [
  ['**text**', '**text**'],
  ['***text***', '***text***'],
  ['****text****', '***text***'], // extra asterisks trimmed to 3
  ['***text**', '**text**'], // mismatched -> bold
  ['**text***', '**text**'],
  ['*text**', '*text*'],
  ['**text*', '*text*'],
  ['***text*', '*text*'],
  ['*text***', '*text*'],
  ['__text__', '__text__'],
  ['_text_', '_text_'],
  ['___text___', '___text___'],
  ['____text____', '___text___'],
  ['__text_', '_text_'],
  ['_text__', '_text_'],
  // Real examples from database
  ['***Oligomenorrhea****', '***Oligomenorrhea***'],
  ['**pus****', '**pus**'],
  ['**gram-negative, comma-shaped (curved) rods****', '**gram-negative, comma-shaped (curved) rods**'],
];

console.log('Testing normalizeEmphasis');
let passed = 0;
for (const [input, expected] of tests) {
  const output = normalizeEmphasis(input);
  const ok = output === expected;
  if (ok) passed++;
  console.log(`${ok ? '✓' : '✗'} "${input}" => "${output}" (expected "${expected}")`);
}
console.log(`Passed ${passed}/${tests.length}`);