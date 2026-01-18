/**
 * Audit Script: Loading State Consistency
 *
 * Sprint B: UX Consistency
 * Finds components using generic loading patterns instead of SkeletonLoader
 */

import * as fs from 'fs';
import * as path from 'path';

interface LoadingPattern {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

interface AuditResult {
  genericLoaders: LoadingPattern[];
  skeletonLoaders: string[];
  spinners: LoadingPattern[];
  textLoading: LoadingPattern[];
  conditionalLoading: LoadingPattern[];
}

const COMPONENT_DIRS = ['components', 'pages'];

// Patterns that indicate non-skeleton loading
const LOADING_PATTERNS = {
  textLoading: /['"]Loading\.\.\.['"]|Loading\.\.\./g,
  genericSpinner: /className=.*\b(spinner|spin|animate-spin)\b/g,
  conditionalLoading: /\{isLoading\s*\?\s*\(/g,
  loadingDiv: /<div.*loading/gi,
};

// Pattern that indicates proper skeleton usage
const SKELETON_PATTERN = /<Skeleton(Loader|Text|Card)|SkeletonLoader/g;

function scanFile(filePath: string): {
  usesSkeletons: boolean;
  loadingPatterns: LoadingPattern[];
  spinnerPatterns: LoadingPattern[];
  textLoadingPatterns: LoadingPattern[];
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const result = {
    usesSkeletons: SKELETON_PATTERN.test(content),
    loadingPatterns: [] as LoadingPattern[],
    spinnerPatterns: [] as LoadingPattern[],
    textLoadingPatterns: [] as LoadingPattern[],
  };

  lines.forEach((line, index) => {
    // Check for text loading patterns
    if (LOADING_PATTERNS.textLoading.test(line)) {
      result.textLoadingPatterns.push({
        file: filePath,
        line: index + 1,
        pattern: 'text_loading',
        snippet: line.trim().substring(0, 80),
      });
    }

    // Check for spinner patterns
    if (LOADING_PATTERNS.genericSpinner.test(line)) {
      result.spinnerPatterns.push({
        file: filePath,
        line: index + 1,
        pattern: 'spinner',
        snippet: line.trim().substring(0, 80),
      });
    }

    // Check for conditional loading without skeleton
    if (LOADING_PATTERNS.conditionalLoading.test(line) && !line.includes('Skeleton')) {
      result.loadingPatterns.push({
        file: filePath,
        line: index + 1,
        pattern: 'conditional',
        snippet: line.trim().substring(0, 80),
      });
    }
  });

  return result;
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function runAudit(): AuditResult {
  const result: AuditResult = {
    genericLoaders: [],
    skeletonLoaders: [],
    spinners: [],
    textLoading: [],
    conditionalLoading: [],
  };

  for (const dir of COMPONENT_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = walkDir(dir);

    for (const file of files) {
      const scanResult = scanFile(file);

      if (scanResult.usesSkeletons) {
        result.skeletonLoaders.push(file);
      }

      result.spinners.push(...scanResult.spinnerPatterns);
      result.textLoading.push(...scanResult.textLoadingPatterns);
      result.conditionalLoading.push(...scanResult.loadingPatterns);
    }
  }

  return result;
}

// Run the audit
console.log('🔍 Auditing loading state consistency...\n');

const results = runAudit();

console.log('📊 Audit Results:');
console.log(`✅ Components using SkeletonLoader: ${results.skeletonLoaders.length}`);
console.log(`⚠️  Components with spinner patterns: ${results.spinners.length}`);
console.log(`❌ Components with "Loading..." text: ${results.textLoading.length}`);
console.log(`🔶 Conditional loading (review needed): ${results.conditionalLoading.length}`);

if (results.textLoading.length > 0) {
  console.log('\n🚨 Components with "Loading..." text (should use SkeletonLoader):');
  const uniqueFiles = [...new Set(results.textLoading.map((p) => p.file))];
  uniqueFiles.slice(0, 15).forEach((file) => {
    console.log(`  - ${file}`);
  });
  if (uniqueFiles.length > 15) {
    console.log(`  ... and ${uniqueFiles.length - 15} more`);
  }
}

if (results.spinners.length > 0) {
  console.log('\n⚠️  Components with spinners (consider SkeletonLoader for better CLS):');
  const uniqueFiles = [...new Set(results.spinners.map((p) => p.file))];
  uniqueFiles.slice(0, 10).forEach((file) => {
    console.log(`  - ${file}`);
  });
  if (uniqueFiles.length > 10) {
    console.log(`  ... and ${uniqueFiles.length - 10} more`);
  }
}

if (results.skeletonLoaders.length > 0) {
  console.log('\n✅ Components properly using SkeletonLoader:');
  results.skeletonLoaders.slice(0, 10).forEach((file) => {
    console.log(`  - ${file}`);
  });
  if (results.skeletonLoaders.length > 10) {
    console.log(`  ... and ${results.skeletonLoaders.length - 10} more`);
  }
}

console.log('\n💡 Recommendation:');
console.log('Replace "Loading..." text and spinners with SkeletonLoader components');
console.log('for zero Cumulative Layout Shift (CLS) score.\n');

console.log('Fix Pattern:');
console.log('```tsx');
console.log('// Before:');
console.log('{isLoading ? <div>Loading...</div> : <ActualContent />}');
console.log('');
console.log('// After:');
console.log('{isLoading ? <SkeletonCard /> : <ActualContent />}');
console.log('```');
