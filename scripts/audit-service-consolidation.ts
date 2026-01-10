/**
 * Service Consolidation Audit Script
 * Analyzes services directory to identify overlapping services
 * and recommend consolidation strategy
 * 
 * Run: npx tsx scripts/audit-service-consolidation.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const servicesDir = path.join(process.cwd(), 'services');

interface ServiceAnalysis {
  name: string;
  category: string;
  exports: string[];
  imports: string[];
  lineCount: number;
  hasTests: boolean;
}

// Categorize services based on naming patterns
function categorizeService(filename: string): string {
  const name = filename.toLowerCase();
  
  // Question-related
  if (name.includes('question')) return 'question';
  
  // Analytics/Performance
  if (name.includes('analytics') || name.includes('predictor') || 
      name.includes('performance') || name.includes('score')) return 'analytics';
  
  // AI/Generation
  if (name.includes('gemini') || name.includes('generator') || 
      name.includes('ai') || name.includes('generate')) return 'ai';
  
  // Session/Drill
  if (name.includes('session') || name.includes('drill')) return 'session';
  
  // Content/Condition
  if (name.includes('content') || name.includes('condition') || 
      name.includes('guideline') || name.includes('drug')) return 'content';
  
  // User/Profile
  if (name.includes('user') || name.includes('profile') || 
      name.includes('student')) return 'user';
  
  // FSRS/SRS
  if (name.includes('fsrs') || name.includes('srs') || 
      name.includes('adaptive')) return 'srs';
  
  // Media
  if (name.includes('media') || name.includes('image')) return 'media';
  
  // Exam
  if (name.includes('exam') || name.includes('osce') || 
      name.includes('pance')) return 'exam';
  
  return 'other';
}

function analyzeService(filepath: string): ServiceAnalysis | null {
  const filename = path.basename(filepath);
  
  // Skip test files and index files
  if (filename.endsWith('.test.ts') || filename === 'index.ts') return null;
  
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    
    // Extract exports
    const exports: string[] = [];
    const exportMatches = content.matchAll(/export\s+(const|function|class|async function|type|interface)\s+(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[2]);
    }
    
    // Extract imports from local services
    const imports: string[] = [];
    const importMatches = content.matchAll(/from\s+['"](\.\.?\/?[^'"]+)['"]/g);
    for (const match of importMatches) {
      if (match[1].includes('service') || match[1].includes('Service')) {
        imports.push(match[1]);
      }
    }
    
    return {
      name: filename.replace('.ts', ''),
      category: categorizeService(filename),
      exports,
      imports,
      lineCount: lines.length,
      hasTests: fs.existsSync(filepath.replace('.ts', '.test.ts')),
    };
  } catch (error) {
    return null;
  }
}

function main() {
  console.log('🔍 Auditing service consolidation opportunities...\n');
  
  // Get all service files
  const files = fs.readdirSync(servicesDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts');
  
  console.log(`📊 Total service files: ${files.length}\n`);
  
  // Analyze each service
  const services: ServiceAnalysis[] = [];
  for (const file of files) {
    const analysis = analyzeService(path.join(servicesDir, file));
    if (analysis) {
      services.push(analysis);
    }
  }
  
  // Group by category
  const categories = new Map<string, ServiceAnalysis[]>();
  for (const service of services) {
    const existing = categories.get(service.category) || [];
    existing.push(service);
    categories.set(service.category, existing);
  }
  
  // Print analysis
  console.log('📁 Services by Category:\n');
  
  const categoryOrder = ['question', 'analytics', 'ai', 'session', 'content', 'user', 'srs', 'media', 'exam', 'other'];
  
  for (const cat of categoryOrder) {
    const items = categories.get(cat);
    if (!items || items.length === 0) continue;
    
    console.log(`\n### ${cat.toUpperCase()} (${items.length} services)`);
    console.log('─'.repeat(50));
    
    // Sort by line count descending
    items.sort((a, b) => b.lineCount - a.lineCount);
    
    for (const item of items) {
      const testBadge = item.hasTests ? '✅' : '  ';
      const lines = String(item.lineCount).padStart(4, ' ');
      console.log(`${testBadge} ${lines} lines | ${item.name}`);
      if (item.exports.length > 0 && item.exports.length <= 5) {
        console.log(`         ↳ exports: ${item.exports.join(', ')}`);
      } else if (item.exports.length > 5) {
        console.log(`         ↳ exports: ${item.exports.slice(0, 5).join(', ')} ... (+${item.exports.length - 5} more)`);
      }
    }
  }
  
  // Print consolidation recommendations
  console.log('\n\n📋 CONSOLIDATION RECOMMENDATIONS');
  console.log('═'.repeat(50));
  
  const questionServices = categories.get('question') || [];
  if (questionServices.length > 1) {
    console.log(`\n🔸 QUESTION SERVICES (${questionServices.length} → 1)`);
    console.log('   Merge into: services/core/questionService.ts');
    questionServices.forEach(s => console.log(`   - ${s.name}.ts`));
  }
  
  const analyticsServices = categories.get('analytics') || [];
  if (analyticsServices.length > 1) {
    console.log(`\n🔸 ANALYTICS SERVICES (${analyticsServices.length} → 2-3)`);
    console.log('   Merge into:');
    console.log('   - services/analytics/performanceService.ts');
    console.log('   - services/analytics/predictionService.ts');
    console.log('   - services/analytics/insightsService.ts');
    analyticsServices.forEach(s => console.log(`   - ${s.name}.ts`));
  }
  
  const aiServices = categories.get('ai') || [];
  if (aiServices.length > 1) {
    console.log(`\n🔸 AI SERVICES (${aiServices.length} → 2)`);
    console.log('   Merge into:');
    console.log('   - services/ai/geminiService.ts');
    console.log('   - services/ai/contentGenerationService.ts');
    aiServices.forEach(s => console.log(`   - ${s.name}.ts`));
  }
  
  const sessionServices = categories.get('session') || [];
  if (sessionServices.length > 1) {
    console.log(`\n🔸 SESSION SERVICES (${sessionServices.length} → 2)`);
    console.log('   Merge into:');
    console.log('   - services/core/sessionService.ts');
    console.log('   - services/domain/drillService.ts');
    sessionServices.forEach(s => console.log(`   - ${s.name}.ts`));
  }
  
  // Print target structure
  console.log('\n\n🎯 TARGET STRUCTURE');
  console.log('═'.repeat(50));
  console.log(`
services/
├── core/                 # Unified core services
│   ├── questionService.ts    (merge ${questionServices.length} services)
│   ├── sessionService.ts     (merge ${sessionServices.length} services)
│   └── userService.ts
├── ai/                   # AI/Gemini services
│   ├── geminiService.ts
│   └── contentGenerationService.ts
├── analytics/            # Consolidated analytics
│   ├── performanceService.ts
│   ├── predictionService.ts
│   └── insightsService.ts
└── domain/               # Domain-specific
    ├── fsrsService.ts
    ├── examService.ts
    └── drillService.ts
`);
  
  // Summary stats
  console.log('\n📈 SUMMARY');
  console.log('─'.repeat(50));
  console.log(`Current: ${services.length} service files`);
  console.log(`Target:  ~15-20 consolidated services`);
  console.log(`Reduction: ${Math.round((1 - 18/services.length) * 100)}%`);
}

main();
