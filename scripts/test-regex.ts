#!/usr/bin/env tsx

const VARIANT_PREFIXES = ['dark', 'light', 'hover', 'focus', 'active', 'disabled', 'checked', 'first', 'last', 'odd', 'even', 'group-hover', 'group-focus', 'sm', 'md', 'lg', 'xl', '2xl', 'max-sm', 'max-md', 'max-lg', 'max-xl', 'max-2xl'];
const PREFIXES = ['bg', 'text', 'border', 'ring', 'outline', 'divide', 'placeholder', 'accent', 'shadow', 'fill', 'stroke', 'decoration', 'caret'];
const COLOR_MAPPINGS = [
  { pattern: /blue-\d+/ },
  { pattern: /green-\d+/ },
  { pattern: /emerald-\d+/ },
  { pattern: /red-\d+/ },
  { pattern: /amber-\d+/ },
  { pattern: /slate-\d+/ },
  { pattern: /gray-\d+/ },
  { pattern: /zinc-\d+/ },
  { pattern: /neutral-\d+/ },
  { pattern: /stone-\d+/ },
];

const variantWithColons = VARIANT_PREFIXES.map(v => v + ':').join('|');
const variantPattern = `((?:${variantWithColons})*)`;
const prefixPattern = `(${PREFIXES.join('|')})`;
const colorFamilies = COLOR_MAPPINGS.map(m => m.pattern.source.replace('\\', '')).join('|');
const colorPattern = `(${colorFamilies})(?:\\/(\\d+))?`;
const regex = new RegExp(`\\b${variantPattern}${prefixPattern}-${colorPattern}\\b`, 'gi');
console.log('Regex:', regex);

const lines = [
  'className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"',
  'bg-blue-950/30',
  'border-blue-800/40',
  'text-blue-300',
  'bg-amber-500/20 text-amber-400',
  'bg-slate-800/50 text-slate-400',
  'hover:bg-blue-500/30',
  'dark:bg-blue-500/20',
];

lines.forEach(line => {
  console.log('\nLine:', line);
  let match;
  while ((match = regex.exec(line)) !== null) {
    console.log('  Match:', match[0]);
    console.log('    variant:', match[1]);
    console.log('    prefix:', match[2]);
    console.log('    color:', match[3]);
    console.log('    opacity:', match[4]);
  }
  // reset lastIndex
  regex.lastIndex = 0;
});