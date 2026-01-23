/**
 * Test script to verify unified search functionality
 */

import { CONDITION_REGISTRY } from '../config/conditionRegistry';
import { DRUG_REGISTRY } from '../src/registries/drugRegistry';
import { SPECIAL_TEST_REGISTRY } from '../src/registries/specialTestRegistry';
import { PHYSIOLOGY_CONCEPT_REGISTRY } from '../src/registries/physiologyRegistry';
import { TREATMENT_REGISTRY } from '../src/registries/treatmentRegistry';

console.log('🧪 Testing Registry Exports...\n');

console.log(`✅ Condition Registry: ${CONDITION_REGISTRY.length} conditions`);
console.log(`✅ Drug Registry: ${DRUG_REGISTRY.length} drugs`);
console.log(`✅ Special Test Registry: ${SPECIAL_TEST_REGISTRY.length} tests`);
console.log(`✅ Physiology Concept Registry: ${PHYSIOLOGY_CONCEPT_REGISTRY.length} concepts`);
console.log(`✅ Treatment Registry: ${TREATMENT_REGISTRY.length} treatments`);

console.log('\n🔍 Testing Specific Fixes...\n');

// Test 1: Port-Wine Stain should not have parentheses in the name
const portWineStain = CONDITION_REGISTRY.find((c) => c.condition.includes('Port-Wine Stain'));
if (portWineStain) {
  console.log(`✅ Port-Wine Stain test:`);
  console.log(`   Name: ${portWineStain.condition}`);
  const pwsAliases = Array.isArray(portWineStain.aliases)
    ? portWineStain.aliases
    : portWineStain.aliases
      ? [portWineStain.aliases]
      : [];
  console.log(`   Aliases: ${pwsAliases.join(', ') || 'none'}`);
  console.log(`   Clean? ${!portWineStain.condition.includes('(')}`);
} else {
  console.log('❌ Port-Wine Stain not found');
}

// Test 2: AKI should be consolidated
const akiConditions = CONDITION_REGISTRY.filter(
  (c) =>
    c.condition.toLowerCase().includes('acute kidney injury') ||
    c.condition.toLowerCase().includes('aki')
);
console.log(`\n✅ AKI test: Found ${akiConditions.length} AKI-related conditions`);
akiConditions.forEach((c) => {
  const aliases = Array.isArray(c.aliases) ? c.aliases : c.aliases ? [c.aliases] : [];
  console.log(`   - ${c.condition} (aliases: ${aliases.join(', ') || 'none'})`);
});

// Test 3: mRNA should have proper capitalization
const mrna = PHYSIOLOGY_CONCEPT_REGISTRY.find((c) => c.name === 'mRNA');
if (mrna) {
  console.log(`\n✅ mRNA test:`);
  console.log(`   Name: ${mrna.name}`);
  console.log(`   Display: ${mrna.displayName || mrna.name}`);
  const mrnaAliases = Array.isArray(mrna.aliases)
    ? mrna.aliases
    : mrna.aliases
      ? [mrna.aliases]
      : [];
  console.log(`   Aliases: ${mrnaAliases.join(', ') || 'none'}`);
} else {
  console.log('\n❌ mRNA not found in physiology concepts');
}

// Test 4: PKD should be consolidated
const pkdConditions = CONDITION_REGISTRY.filter((c) =>
  c.condition.toLowerCase().includes('polycystic kidney')
);
console.log(`\n✅ PKD test: Found ${pkdConditions.length} PKD-related conditions`);
pkdConditions.forEach((c) => {
  const aliases = Array.isArray(c.aliases) ? c.aliases : c.aliases ? [c.aliases] : [];
  console.log(`   - ${c.condition}`);
  console.log(`     Aliases: ${aliases.join(', ') || 'none'}`);
  console.log(`     Overview: ${c.overview || 'none'}`);
});

console.log('\n✅ All registry tests complete!');
