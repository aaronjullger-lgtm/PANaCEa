
import { CONDITION_REGISTRY } from '../conditionRegistry';

const badEntries = [];

CONDITION_REGISTRY.forEach(item => {
  if (item.condition.includes('_') || (item.condition === item.condition.toLowerCase() && item.condition.length > 3)) {
    badEntries.push({ type: 'condition', value: item.condition });
  }
  if (item.subcategory.includes('_') || (item.subcategory === item.subcategory.toLowerCase() && item.subcategory.length > 3)) {
    badEntries.push({ type: 'subcategory', value: item.subcategory });
  }
});

console.log(`Checked ${CONDITION_REGISTRY.length} registry entries.`);
console.log(`Found ${badEntries.length} bad entries.`);
if (badEntries.length > 0) {
  console.log(badEntries);
}
