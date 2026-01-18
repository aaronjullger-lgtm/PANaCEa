import * as fs from 'fs';
import * as path from 'path';

const BASE_PATH = '/Users/aaronullger/PANaCEa/DATA/DATA/ALL IMAGES';
const files = fs.readdirSync(BASE_PATH);

// Extract unique condition names from filenames
const conditionNames = new Set<string>();
for (const file of files) {
  if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) continue;

  // Extract condition name (everything before the last underscore + number)
  const parts = file.replace(/\.[^.]+$/, '').split('_');
  // Remove numeric suffix
  while (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  const conditionName = parts.join('_');
  conditionNames.add(conditionName);
}

console.log('Unique condition names from ALL IMAGES folder:');
console.log('='.repeat(50));
const sorted = Array.from(conditionNames).sort();
sorted.forEach((name) => console.log(name));
console.log('\nTotal unique names:', sorted.length);
