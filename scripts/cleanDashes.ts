import fs from 'fs';
import path from 'path';

const contentPath = path.resolve('conditionContent.generated.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

let cleanedCount = 0;

content.forEach((item: any) => {
  if (!item.content) return;
  
  Object.keys(item.content).forEach(key => {
    const val = item.content[key];
    if (typeof val === 'string') {
      if (val.endsWith("---")) {
        item.content[key] = val.replace(/\s*---\s*$/, "").trim();
        cleanedCount++;
      } else if (val.endsWith("--")) {
        item.content[key] = val.replace(/\s*--\s*$/, "").trim();
        cleanedCount++;
      }
    }
  });
});

console.log(`Cleaned trailing dashes from ${cleanedCount} fields.`);
fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
