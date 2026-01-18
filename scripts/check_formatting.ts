import fs from 'fs';
import path from 'path';

const contentPath = path.resolve('conditionContent.generated.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));

const badConditions = [];
const badSubcategories = []; // Note: subcategory isn't in the content file explicitly usually, but let's check if it is.
// Actually the content file structure is array of objects with conditionId, condition, content.

console.log(`Checking ${content.length} records...`);

content.forEach((item: any) => {
  const name = item.condition;
  if (!name) return;

  // Check for snake_case (contains underscore)
  if (name.includes('_')) {
    badConditions.push({ id: item.conditionId, name, reason: 'snake_case' });
  }
  // Check for all lowercase (and length > 3 to avoid acronyms like 'flu' if any, though usually capitalized)
  else if (name === name.toLowerCase() && name.length > 3) {
    badConditions.push({ id: item.conditionId, name, reason: 'lowercase' });
  }
});

console.log(`Found ${badConditions.length} bad condition names.`);
if (badConditions.length > 0) {
  console.log(badConditions.slice(0, 20));
}
