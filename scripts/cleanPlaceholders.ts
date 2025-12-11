import fs from 'fs';
import path from 'path';

const contentPath = path.resolve('conditionContent.generated.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const PLACEHOLDER_INDICATORS = [
  "To be populated",
  "Content to be generated",
  "PLACEHOLDER",
  "--"
];

let cleanedCount = 0;

content.forEach((item: any) => {
  if (!item.content) return;
  
  Object.keys(item.content).forEach(key => {
    const val = item.content[key];
    
    if (Array.isArray(val)) {
      const originalLength = val.length;
      const cleaned = val.filter(v => {
        if (typeof v !== 'string') return true;
        const trimmed = v.trim();
        if (trimmed.length === 0) return false;
        return !PLACEHOLDER_INDICATORS.some(p => trimmed === p || trimmed.includes(p));
      });
      
      if (cleaned.length !== originalLength) {
        item.content[key] = cleaned;
        cleanedCount++;
      }
    }
  });
});

console.log(`Removed placeholders from ${cleanedCount} array fields.`);
fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
