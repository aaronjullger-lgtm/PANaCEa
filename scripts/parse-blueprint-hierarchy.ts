#!/usr/bin/env tsx
/**
 * SPRINT 2: Blueprint Hierarchy Extraction
 *
 * Parses panceblueprint.md to extract ORGANIZATIONAL hierarchy structure.
 * Does NOT extract individual conditions - only subcategory nodes.
 *
 * Output: JSON hierarchy reference table with ~150-200 subcategory nodes
 */

import fs from 'fs';
import path from 'path';

interface SubcategoryNode {
  system: string;
  parent_category: string | null;
  subcategory: string;
  level: number; // 2 = top-level subcategory, 3 = nested under parent, 4 = deeply nested
  example_conditions: string[]; // For gap analysis reference only
}

interface HierarchyTree {
  nodes: SubcategoryNode[];
  systemCounts: Record<string, number>;
  levelDistribution: Record<number, number>;
}

function parseBlueprint(blueprintPath: string): HierarchyTree {
  const content = fs.readFileSync(blueprintPath, 'utf-8');
  const lines = content.split('\n');

  const nodes: SubcategoryNode[] = [];
  const systemCounts: Record<string, number> = {};
  const levelDistribution: Record<number, number> = { 2: 0, 3: 0, 4: 0 };

  let currentSystem = '';
  let currentSubcategory: string | null = null;
  let currentParentCategory: string | null = null;
  let exampleConditions: string[] = [];
  let insideNestedGroup = false;

  const saveCurrentNode = () => {
    if (currentSubcategory) {
      const level = currentParentCategory ? 3 : 2;
      nodes.push({
        system: currentSystem,
        parent_category: currentParentCategory,
        subcategory: currentSubcategory,
        level,
        example_conditions: [...exampleConditions],
      });
      levelDistribution[level]++;
      systemCounts[currentSystem] = (systemCounts[currentSystem] || 0) + 1;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and header text
    if (
      !line ||
      line.startsWith('***') ||
      line.startsWith('Here is') ||
      line === '# PANCE Blueprint Master Condition List'
    ) {
      continue;
    }

    // System level: ## Cardiovascular System (11%)
    if (line.startsWith('## ')) {
      saveCurrentNode();

      currentSystem = line
        .replace(/^##\s+/, '')
        .replace(/\s*\(\d+%\)/, '')
        .trim();
      currentSubcategory = null;
      currentParentCategory = null;
      exampleConditions = [];
      insideNestedGroup = false;
      continue;
    }

    // Subcategory level: ### Cardiomyopathy
    if (line.startsWith('### ')) {
      saveCurrentNode();

      currentSubcategory = line.replace(/^###\s+/, '').trim();
      currentParentCategory = null;
      exampleConditions = [];
      insideNestedGroup = false;
      continue;
    }

    // Check for bold nested subcategory: *   **Acute Coronary Syndrome**
    const nestedBoldMatch = line.match(/^\*\s+\*\*(.+?)\*\*/);
    if (nestedBoldMatch) {
      // Save current subcategory as parent
      if (currentSubcategory) {
        currentParentCategory = currentSubcategory;
      }

      currentSubcategory = nestedBoldMatch[1].trim();
      exampleConditions = [];
      insideNestedGroup = true;
      continue;
    }

    // Condition examples with 4+ spaces (nested under bold): (spaces)*   STEMI
    const nestedConditionMatch = line.match(/^\s{4,}\*\s+(.+)/);
    if (nestedConditionMatch && insideNestedGroup) {
      const condition = nestedConditionMatch[1].trim();
      exampleConditions.push(condition);
      continue;
    }

    // Regular condition: *   Dilated Cardiomyopathy
    const conditionMatch = line.match(/^\*\s+(.+)/);
    if (conditionMatch && !insideNestedGroup) {
      const condition = conditionMatch[1].trim();
      exampleConditions.push(condition);
      continue;
    }
  }

  // Save final node
  saveCurrentNode();

  return { nodes, systemCounts, levelDistribution };
}

function generateReport(tree: HierarchyTree) {
  console.log('🔍 PANCE Blueprint Hierarchy Extraction Report\n');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`Total Subcategory Nodes: ${tree.nodes.length}\n`);

  console.log('Level Distribution:');
  console.log(`  Level 2 (Top-level): ${tree.levelDistribution[2]} nodes`);
  console.log(`  Level 3 (Nested): ${tree.levelDistribution[3]} nodes`);
  console.log(`  Level 4 (Deep): ${tree.levelDistribution[4]} nodes\n`);

  console.log('System Breakdown:');
  Object.entries(tree.systemCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([system, count]) => {
      console.log(`  ${system}: ${count} subcategories`);
    });

  console.log('\n📋 Sample Hierarchy Nodes:\n');

  // Show examples of each level
  const level2Example = tree.nodes.find((n) => n.level === 2);
  const level3Example = tree.nodes.find((n) => n.level === 3);

  if (level2Example) {
    console.log('Level 2 (Simple):');
    console.log(`  System: ${level2Example.system}`);
    console.log(`  Subcategory: ${level2Example.subcategory}`);
    console.log(
      `  Example Conditions: ${level2Example.example_conditions.slice(0, 3).join(', ')}\n`
    );
  }

  if (level3Example) {
    console.log('Level 3 (Nested):');
    console.log(`  System: ${level3Example.system}`);
    console.log(`  Parent Category: ${level3Example.parent_category}`);
    console.log(`  Subcategory: ${level3Example.subcategory}`);
    console.log(
      `  Example Conditions: ${level3Example.example_conditions.slice(0, 3).join(', ')}\n`
    );
  }

  // Show complex hierarchies
  console.log('🏥 Complex Hierarchies (4-level examples):\n');

  const heentNodes = tree.nodes.filter((n) => n.system === 'Eyes, Ears, Nose, and Throat');
  console.log(`HEENT: ${heentNodes.length} subcategories`);
  heentNodes.slice(0, 5).forEach((node) => {
    console.log(`  ${node.parent_category ? node.parent_category + ' → ' : ''}${node.subcategory}`);
  });

  const mskNodes = tree.nodes.filter((n) => n.system === 'Musculoskeletal System');
  console.log(`\nMusculoskeletal: ${mskNodes.length} subcategories`);
  mskNodes.slice(0, 5).forEach((node) => {
    console.log(`  ${node.parent_category ? node.parent_category + ' → ' : ''}${node.subcategory}`);
  });

  const dermNodes = tree.nodes.filter((n) => n.system === 'Dermatologic System');
  console.log(`\nDermatologic: ${dermNodes.length} subcategories`);
  dermNodes.slice(0, 5).forEach((node) => {
    console.log(`  ${node.parent_category ? node.parent_category + ' → ' : ''}${node.subcategory}`);
  });
}

async function main() {
  const blueprintPath = path.join(process.cwd(), 'panceblueprint.md');

  if (!fs.existsSync(blueprintPath)) {
    console.error('❌ Error: panceblueprint.md not found');
    process.exit(1);
  }

  console.log('📖 Parsing PANCE blueprint hierarchy...\n');

  const tree = parseBlueprint(blueprintPath);

  // Generate report
  generateReport(tree);

  // Save to JSON for next sprint
  const outputPath = path.join(process.cwd(), 'data', 'blueprint-hierarchy.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2));

  console.log(`\n✅ Hierarchy saved to: ${outputPath}`);
  console.log(`\n📊 Ready for Sprint 3: Existing Condition Categorization`);
}

main().catch(console.error);
