/**
 * Component Organization Audit Script
 * 
 * Analyzes components/ directory to identify:
 * - Root-level components that should be moved to subdirectories
 * - Missing barrel exports (index.ts files)
 * - Component consolidation opportunities
 * 
 * Run: npx tsx scripts/audit-component-organization.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const componentsDir = path.join(process.cwd(), 'components');

interface ComponentAnalysis {
  rootLevel: string[];
  subdirectories: Map<string, { hasIndex: boolean; fileCount: number; files: string[] }>;
  suggestions: Array<{ file: string; targetDir: string; reason: string }>;
}

function analyzeComponents(): ComponentAnalysis {
  const rootLevel: string[] = [];
  const subdirectories = new Map<string, { hasIndex: boolean; fileCount: number; files: string[] }>();
  const suggestions: Array<{ file: string; targetDir: string; reason: string }> = [];

  // Get all entries in components/
  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Analyze subdirectory
      const subPath = path.join(componentsDir, entry.name);
      const subFiles = fs.readdirSync(subPath).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
      const hasIndex = subFiles.includes('index.ts') || subFiles.includes('index.tsx');
      
      subdirectories.set(entry.name, {
        hasIndex,
        fileCount: subFiles.length,
        files: subFiles.filter(f => f !== 'index.ts' && f !== 'index.tsx'),
      });
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      // Root-level component
      rootLevel.push(entry.name);
    }
  }

  // Generate suggestions for root-level components
  const categorizations: Record<string, { pattern: RegExp; target: string }[]> = {
    drill: [
      { pattern: /drill/i, target: 'drill' },
      { pattern: /session/i, target: 'session' },
    ],
    quiz: [
      { pattern: /quiz/i, target: 'quiz' },
    ],
    modal: [
      { pattern: /modal/i, target: 'ui' },
    ],
    analytics: [
      { pattern: /chart|graph|heatmap|trend/i, target: 'analytics' },
      { pattern: /stats|analytics/i, target: 'analytics' },
    ],
    ui: [
      { pattern: /button|input|loader|spinner|skeleton/i, target: 'ui' },
      { pattern: /tooltip|popover|panel/i, target: 'ui' },
    ],
    layout: [
      { pattern: /layout|sidebar|header|footer|nav/i, target: 'layout' },
    ],
    auth: [
      { pattern: /auth|login|signup/i, target: 'auth' },
    ],
  };

  for (const file of rootLevel) {
    let matched = false;
    
    for (const [, patterns] of Object.entries(categorizations)) {
      for (const { pattern, target } of patterns) {
        if (pattern.test(file)) {
          suggestions.push({
            file,
            targetDir: target,
            reason: `Matches pattern: ${pattern.source}`,
          });
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    
    if (!matched) {
      // Check for common naming patterns
      if (file.includes('Photo') || file.includes('Image') || file.includes('Media')) {
        suggestions.push({ file, targetDir: 'media', reason: 'Media-related component' });
      } else if (file.includes('Error') || file.includes('Boundary')) {
        suggestions.push({ file, targetDir: 'error', reason: 'Error handling component' });
      } else if (file.includes('Setting') || file.includes('Config') || file.includes('Preference')) {
        suggestions.push({ file, targetDir: 'settings', reason: 'Settings-related component' });
      } else {
        suggestions.push({ file, targetDir: 'misc', reason: 'No clear category - review manually' });
      }
    }
  }

  return { rootLevel, subdirectories, suggestions };
}

function main() {
  console.log('🔍 Auditing component organization...\n');

  const analysis = analyzeComponents();

  // Root-level components
  console.log(`📊 Root-Level Components: ${analysis.rootLevel.length} files`);
  console.log('─'.repeat(60));
  
  if (analysis.rootLevel.length === 0) {
    console.log('✅ No root-level components (all properly organized!)');
  } else {
    console.log('\n⚠️ These components should be moved to subdirectories:\n');
    
    // Group suggestions by target directory
    const grouped = new Map<string, string[]>();
    for (const suggestion of analysis.suggestions) {
      const existing = grouped.get(suggestion.targetDir) || [];
      existing.push(`${suggestion.file} (${suggestion.reason})`);
      grouped.set(suggestion.targetDir, existing);
    }
    
    for (const [targetDir, files] of grouped) {
      console.log(`\n📁 → components/${targetDir}/`);
      files.forEach(f => console.log(`   - ${f}`));
    }
  }

  // Subdirectories
  console.log('\n\n📁 Subdirectories Analysis:');
  console.log('─'.repeat(60));
  
  const sorted = Array.from(analysis.subdirectories.entries())
    .sort((a, b) => b[1].fileCount - a[1].fileCount);
  
  let missingIndexCount = 0;
  
  for (const [name, info] of sorted) {
    const indexStatus = info.hasIndex ? '✅' : '❌';
    if (!info.hasIndex) missingIndexCount++;
    console.log(`${indexStatus} ${name}/ (${info.fileCount} files)${!info.hasIndex ? ' [NEEDS index.ts]' : ''}`);
  }

  // Summary
  console.log('\n\n📈 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Root-level components: ${analysis.rootLevel.length} (should be 0)`);
  console.log(`Subdirectories: ${analysis.subdirectories.size}`);
  console.log(`Missing index.ts: ${missingIndexCount} directories`);
  
  // Directories that need index.ts
  if (missingIndexCount > 0) {
    console.log('\n\n🔧 DIRECTORIES NEEDING index.ts:');
    console.log('─'.repeat(60));
    for (const [name, info] of sorted) {
      if (!info.hasIndex && info.fileCount > 0) {
        console.log(`\ncomponents/${name}/index.ts:`);
        console.log('```typescript');
        info.files.slice(0, 10).forEach(f => {
          const componentName = f.replace(/\.tsx?$/, '');
          console.log(`export { default as ${componentName} } from './${componentName}';`);
        });
        if (info.files.length > 10) {
          console.log(`// ... and ${info.files.length - 10} more`);
        }
        console.log('```');
      }
    }
  }

  console.log('\n\n✨ RECOMMENDED ACTIONS:');
  console.log('1. Move root-level components to appropriate subdirectories');
  console.log('2. Create index.ts barrel exports for directories missing them');
  console.log('3. Update imports throughout the codebase');
  console.log('4. Run: git status to verify changes before committing');
}

main();
