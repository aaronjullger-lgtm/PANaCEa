import { CONDITION_REGISTRY } from '../config/conditionRegistry';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const seen = new Map<string, string>();
const duplicates: string[] = [];
const invalid = [
  'Vertigo – Central vs Peripheral Causes',
  'Syncope – Neurologic Evaluation',
  'Suicidal Ideation & Suicide Risk Assessment',
  'Violent or Agitated Patient Management',
  'Human Sexuality and Gender Dysphoria',
  'Burn Shock / Fluid Resuscitation Principles',
  'Normal Labor and Delivery',
  'Normal First-Trimester Pregnancy',
];

console.log(`Total entries: ${CONDITION_REGISTRY.length}`);

CONDITION_REGISTRY.forEach((c) => {
  const norm = normalize(c.condition);
  if (seen.has(norm)) {
    duplicates.push(`${c.condition} (Duplicate of ${seen.get(norm)})`);
  } else {
    seen.set(norm, c.condition);
  }
});

console.log(`\nFound ${duplicates.length} duplicates:`);
duplicates.forEach((d) => console.log(`- ${d}`));

console.log(`\nChecking for invalid entries...`);
const foundInvalid = CONDITION_REGISTRY.filter((c) => invalid.includes(c.condition));
foundInvalid.forEach((c) => console.log(`- Found invalid: ${c.condition}`));
