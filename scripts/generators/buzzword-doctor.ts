#!/usr/bin/env npx tsx
/**
 * Buzzword Doctor - Pathognomonic Buzzword Generator
 * 
 * Generates PANCE-style pathognomonic buzzwords for conditions.
 * Key principle: "When you see X, immediately think Y" (1:1 mapping)
 * 
 * The Buzzword schema:
 *   id, buzzword, condition (string), system (string), subcategory?, explanation?
 * 
 * Usage:
 *   npx tsx scripts/generators/buzzword-doctor.ts --dry-run    # Preview what would be created
 *   npx tsx scripts/generators/buzzword-doctor.ts              # Generate and insert buzzwords
 *   npx tsx scripts/generators/buzzword-doctor.ts --batch=50   # Process 50 conditions at a time
 *   npx tsx scripts/generators/buzzword-doctor.ts --analyze    # Show current state
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();

// Rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

// Known pathognomonic buzzwords (high-confidence, manually verified)
const KNOWN_PATHOGNOMONIC: Record<string, string[]> = {
  'Acute Pancreatitis': ['Cullen sign', 'Grey Turner sign', 'epigastric pain radiating to back'],
  'Addison\'s Disease': ['hyperpigmentation', 'salt craving', 'adrenal insufficiency'],
  'Aortic Dissection': ['tearing chest pain radiating to back', 'unequal blood pressures'],
  'Aortic Stenosis': ['crescendo-decrescendo murmur', 'pulsus parvus et tardus'],
  'Appendicitis': ['McBurney\'s point tenderness', 'Rovsing sign', 'psoas sign'],
  'Atrial Fibrillation': ['irregularly irregular rhythm'],
  'Atrial Flutter': ['sawtooth pattern'],
  'Bell\'s Palsy': ['unilateral facial droop', 'forehead sparing absent'],
  'Benign Paroxysmal Positional Vertigo': ['Dix-Hallpike positive', 'nystagmus with position change'],
  'Botulism': ['descending paralysis', 'diplopia and dysphagia'],
  'Cardiac Tamponade': ['Beck\'s triad', 'pulsus paradoxus', 'electrical alternans'],
  'Celiac Disease': ['anti-tissue transglutaminase antibodies', 'villous atrophy'],
  'Cholecystitis': ['Murphy\'s sign', 'right upper quadrant pain after fatty meal'],
  'Chronic Myelogenous Leukemia': ['Philadelphia chromosome', 'BCR-ABL'],
  'Conn\'s Syndrome': ['hypertension with hypokalemia', 'low renin'],
  'Crohn\'s Disease': ['skip lesions', 'cobblestone mucosa', 'string sign'],
  'Cushing\'s Syndrome': ['moon facies', 'buffalo hump', 'purple striae'],
  'Deep Vein Thrombosis': ['Homan\'s sign', 'unilateral leg swelling'],
  'Diabetes Insipidus': ['polyuria with dilute urine', 'water deprivation test'],
  'Diphtheria': ['pseudomembrane', 'bull neck'],
  'Ectopic Pregnancy': ['positive pregnancy test with empty uterus'],
  'Ehlers-Danlos Syndrome': ['hyperextensible skin', 'joint hypermobility'],
  'Epiglottitis': ['tripod position', 'thumbprint sign', 'drooling'],
  'Erythema Migrans': ['target lesion', 'bulls-eye rash'],
  'Essential Thrombocythemia': ['elevated platelets with JAK2 mutation'],
  'Giant Cell Arteritis': ['jaw claudication', 'elevated ESR', 'temporal artery tenderness'],
  'Gout': ['negatively birefringent crystals', 'podagra'],
  'Graves\' Disease': ['exophthalmos', 'thyroid bruit', 'pretibial myxedema'],
  'Guillain-Barré Syndrome': ['ascending paralysis', 'albuminocytologic dissociation'],
  'Hashimoto\'s Thyroiditis': ['anti-TPO antibodies', 'painless goiter'],
  'Hemochromatosis': ['bronze diabetes', 'elevated ferritin and transferrin saturation'],
  'Henoch-Schönlein Purpura': ['palpable purpura on buttocks and legs', 'IgA nephropathy'],
  'Hepatic Encephalopathy': ['asterixis', 'flapping tremor'],
  'Hereditary Spherocytosis': ['osmotic fragility positive', 'spherocytes on smear'],
  'Hirschsprung\'s Disease': ['failure to pass meconium', 'transition zone on barium enema'],
  'Huntington\'s Disease': ['chorea', 'CAG repeats'],
  'Hypercalcemia': ['stones, bones, groans, psychiatric moans'],
  'Hypertrophic Cardiomyopathy': ['systolic murmur that increases with Valsalva'],
  'Infective Endocarditis': ['Osler nodes', 'Janeway lesions', 'splinter hemorrhages'],
  'Intussusception': ['currant jelly stool', 'sausage-shaped mass'],
  'Kawasaki Disease': ['strawberry tongue', 'conjunctival injection', 'desquamating rash'],
  'Legionella': ['atypical pneumonia with hyponatremia', 'GI symptoms'],
  'Ludwig\'s Angina': ['submandibular swelling', 'elevation of tongue'],
  'Malignant Hyperthermia': ['hyperthermia after anesthesia', 'muscle rigidity'],
  'Marfan Syndrome': ['arachnodactyly', 'pectus excavatum', 'lens dislocation upward'],
  'Meningitis': ['Kernig sign', 'Brudzinski sign', 'nuchal rigidity'],
  'Mitral Stenosis': ['opening snap', 'rumbling diastolic murmur'],
  'Multiple Myeloma': ['M spike', 'Bence Jones protein', 'punched-out lytic lesions'],
  'Multiple Sclerosis': ['lesions disseminated in time and space', 'Uhthoff phenomenon'],
  'Myasthenia Gravis': ['fatigable weakness', 'positive Tensilon test', 'thymoma'],
  'Nephrotic Syndrome': ['massive proteinuria', 'hypoalbuminemia', 'edema'],
  'Neurofibromatosis Type 1': ['café-au-lait spots', 'neurofibromas', 'Lisch nodules'],
  'Osteogenesis Imperfecta': ['blue sclera', 'brittle bones'],
  'Paget\'s Disease of Bone': ['elevated alkaline phosphatase with normal calcium'],
  'Parkinson\'s Disease': ['pill-rolling tremor', 'cogwheel rigidity', 'shuffling gait'],
  'Pheochromocytoma': ['episodic hypertension', 'headache, palpitations, sweating'],
  'Pneumothorax': ['absent breath sounds', 'hyperresonance'],
  'Polycythemia Vera': ['elevated hematocrit with low EPO', 'aquagenic pruritus'],
  'Primary Biliary Cholangitis': ['anti-mitochondrial antibodies', 'pruritus'],
  'Primary Sclerosing Cholangitis': ['onion skinning of bile ducts', 'beading on MRCP'],
  'Pseudogout': ['positively birefringent crystals', 'chondrocalcinosis'],
  'Pseudomembranous Colitis': ['C. difficile toxin positive', 'recent antibiotic use'],
  'Pulmonary Embolism': ['Hampton\'s hump', 'Westermark sign', 'S1Q3T3'],
  'Pyloric Stenosis': ['olive-shaped mass', 'projectile vomiting', 'hypochloremic hypokalemic metabolic alkalosis'],
  'Raynaud\'s Phenomenon': ['triphasic color change', 'white-blue-red sequence'],
  'Reactive Arthritis': ['can\'t see, can\'t pee, can\'t climb a tree'],
  'Rheumatic Fever': ['Jones criteria', 'migratory polyarthritis'],
  'Rhabdomyolysis': ['elevated CK', 'myoglobinuria', 'tea-colored urine'],
  'Rocky Mountain Spotted Fever': ['rash starting on wrists and ankles', 'centripetal spread'],
  'Sarcoidosis': ['noncaseating granulomas', 'bilateral hilar lymphadenopathy'],
  'Scarlet Fever': ['sandpaper rash', 'Pastia lines', 'strawberry tongue'],
  'Sickle Cell Disease': ['sickle cells on smear', 'vaso-occlusive crisis'],
  'Sjögren\'s Syndrome': ['dry eyes and dry mouth', 'anti-SSA/SSB antibodies'],
  'Systemic Lupus Erythematosus': ['malar rash', 'discoid rash', 'anti-dsDNA antibodies'],
  'Tension Pneumothorax': ['tracheal deviation', 'distended neck veins'],
  'Tetralogy of Fallot': ['tet spells', 'boot-shaped heart'],
  'Thrombotic Thrombocytopenic Purpura': ['pentad: fever, anemia, thrombocytopenia, renal, neuro'],
  'Toxic Megacolon': ['colonic dilation >6cm', 'systemic toxicity'],
  'Toxoplasmosis': ['ring-enhancing lesions in AIDS'],
  'Tuberculosis': ['caseating granulomas', 'Ghon complex'],
  'Turner Syndrome': ['webbed neck', 'shield chest', '45,XO'],
  'Ulcerative Colitis': ['continuous inflammation from rectum', 'bloody diarrhea', 'lead pipe colon'],
  'Vitamin B12 Deficiency': ['subacute combined degeneration', 'megaloblastic anemia'],
  'Von Willebrand Disease': ['prolonged bleeding time', 'normal platelet count'],
  'Wernicke Encephalopathy': ['confusion, ataxia, ophthalmoplegia'],
  'Wilson\'s Disease': ['Kayser-Fleischer rings', 'low ceruloplasmin'],
  'Wolff-Parkinson-White Syndrome': ['delta wave', 'short PR interval'],
};

interface BuzzwordCandidate {
  conditionName: string;
  system: string;
  buzzword: string;
  explanation?: string;
  source: 'known' | 'ai';
}

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate pathognomonic buzzwords for conditions using AI
 */
async function generatePathognomonicBuzzwords(
  conditions: { name: string; system: string; content: any }[]
): Promise<BuzzwordCandidate[]> {
  const ai = getAI();
  const model = ai.getGenerativeModel({ 
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    }
  });

  const conditionList = conditions.map(c => ({
    name: c.name,
    system: c.system,
    clinicalPresentation: c.content?.clinicalPresentation,
    diagnosticCriteria: c.content?.diagnosticCriteria,
    physicalExamFindings: c.content?.physicalExamFindings,
  }));

  const prompt = `You are a PANCE/PANRE exam expert. For each condition, identify ONE to THREE truly PATHOGNOMONIC buzzwords.

RULES:
1. Only include buzzwords that IMMEDIATELY point to THIS SPECIFIC condition
2. "When you see X, think Y" - the buzzword should trigger recall of ONE condition
3. Include classic exam findings, signs, symptoms, or diagnostic clues
4. Keep buzzwords short (2-6 words typically)
5. If a condition has no pathognomonic features, return empty array
6. Focus on PANCE high-yield associations
7. Do NOT include generic symptoms like "fever" or "fatigue"

Good examples:
- "Kayser-Fleischer rings" → Wilson's Disease
- "ascending paralysis" → Guillain-Barré
- "café-au-lait spots" → Neurofibromatosis
- "currant jelly stool" → Intussusception

BAD examples (too generic):
- "chest pain" (many conditions)
- "fever and rash" (too broad)
- "elevated white count" (nonspecific)

Return JSON array:
[
  { "conditionName": "Condition A", "buzzwords": [{"text": "specific buzzword", "explanation": "why pathognomonic"}] },
  { "conditionName": "Condition B", "buzzwords": [] }
]

Conditions:
${JSON.stringify(conditionList, null, 2)}`;

  await rateLimiter.acquire();
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const parsed = JSON.parse(text);
    const candidates: BuzzwordCandidate[] = [];
    
    for (const item of parsed) {
      const condition = conditions.find(c => c.name === item.conditionName);
      if (!condition) continue;
      
      for (const bw of item.buzzwords || []) {
        const buzzText = typeof bw === 'string' ? bw : bw.text;
        const explanation = typeof bw === 'object' ? bw.explanation : undefined;
        candidates.push({
          conditionName: condition.name,
          system: condition.system,
          buzzword: buzzText.trim(),
          explanation,
          source: 'ai',
        });
      }
    }
    
    return candidates;
  } catch (e) {
    console.error('Failed to parse AI response:', text);
    return [];
  }
}

/**
 * Get known pathognomonic buzzwords for conditions
 */
function getKnownBuzzwords(
  conditions: { name: string; system: string }[]
): BuzzwordCandidate[] {
  const candidates: BuzzwordCandidate[] = [];
  
  for (const condition of conditions) {
    const known = KNOWN_PATHOGNOMONIC[condition.name];
    if (known) {
      for (const buzzword of known) {
        candidates.push({
          conditionName: condition.name,
          system: condition.system,
          buzzword,
          source: 'known',
        });
      }
    }
  }
  
  return candidates;
}

/**
 * Check if buzzword already exists
 */
async function buzzwordExists(conditionName: string, buzzword: string): Promise<boolean> {
  const existing = await prisma.buzzword.findFirst({
    where: {
      condition: conditionName,
      buzzword: { equals: buzzword, mode: 'insensitive' },
    },
  });
  return !!existing;
}

/**
 * Phase 1: Analyze current state
 */
async function analyzeState() {
  console.log('\n📊 Analyzing Current State\n');
  
  const buzzwordCount = await prisma.buzzword.count();
  const conditionCount = await prisma.condition.count();
  
  const conditionsWithBuzzwords = await prisma.buzzword.groupBy({
    by: ['condition'],
    _count: true,
  });
  
  console.log(`  Total Buzzwords: ${buzzwordCount}`);
  console.log(`  Total Conditions: ${conditionCount}`);
  console.log(`  Conditions with Buzzwords: ${conditionsWithBuzzwords.length}`);
  console.log(`  Coverage: ${((conditionsWithBuzzwords.length / conditionCount) * 100).toFixed(1)}%`);
  
  const distribution: Record<number, number> = {};
  for (const c of conditionsWithBuzzwords) {
    const count = c._count;
    distribution[count] = (distribution[count] || 0) + 1;
  }
  
  if (Object.keys(distribution).length > 0) {
    console.log('\n  Buzzword Distribution:');
    for (const [count, num] of Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      console.log(`    ${count} buzzword(s): ${num} conditions`);
    }
  }
  
  const samples = await prisma.buzzword.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  
  if (samples.length > 0) {
    console.log('\n  Recent Buzzwords:');
    for (const s of samples) {
      console.log(`    "${s.buzzword}" → ${s.condition}`);
    }
  }
}

/**
 * Phase 2: Insert known pathognomonic buzzwords
 */
async function insertKnownBuzzwords(dryRun: boolean) {
  console.log('\n🔍 Inserting Known Pathognomonic Buzzwords\n');
  
  const conditions = await prisma.medicalContent.findMany({
    select: { condition: true, system: true },
  });
  
  const conditionsForKnown = conditions.map(c => ({
    name: c.condition,
    system: c.system,
  }));
  
  const known = getKnownBuzzwords(conditionsForKnown);
  console.log(`  Found ${known.length} known pathognomonic buzzwords for ${Object.keys(KNOWN_PATHOGNOMONIC).length} conditions`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const candidate of known) {
    const exists = await buzzwordExists(candidate.conditionName, candidate.buzzword);
    
    if (exists) {
      skipped++;
      continue;
    }
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would insert: "${candidate.buzzword}" → ${candidate.conditionName}`);
      inserted++;
    } else {
      await prisma.buzzword.create({
        data: {
          id: crypto.randomUUID(),
          updatedAt: new Date(),
          buzzword: candidate.buzzword,
          condition: candidate.conditionName,
          system: candidate.system,
        },
      });
      console.log(`  ✅ Inserted: "${candidate.buzzword}" → ${candidate.conditionName}`);
      inserted++;
    }
  }
  
  console.log(`\n  Summary: ${inserted} inserted, ${skipped} already existed`);
}

/**
 * Phase 3: Generate AI buzzwords for conditions without coverage
 */
async function generateAIBuzzwords(dryRun: boolean, batchSize: number) {
  console.log('\n🤖 Generating AI Buzzwords for Uncovered Conditions\n');
  
  // Get conditions that already have buzzwords
  const conditionsWithBuzzwords = await prisma.buzzword.groupBy({
    by: ['condition'],
  });
  const coveredNames = new Set(conditionsWithBuzzwords.map(c => c.condition));
  
  // Get all conditions from MedicalContent
  const allConditions = await prisma.medicalContent.findMany({
    select: {
      condition: true,
      system: true,
      symptoms: true,
      physicalExam: true,
      diagnostics: true,
      buzzwords: true,
      classic_triad: true,
      gold_standard_dx: true,
    },
  });
  
  const uncoveredConditions = allConditions.filter(c => !coveredNames.has(c.condition));
  
  console.log(`  Conditions without buzzwords: ${uncoveredConditions.length}`);
  
  if (uncoveredConditions.length === 0) {
    console.log('  All conditions have buzzwords!');
    return;
  }
  
  let totalInserted = 0;
  let totalSkipped = 0;
  
  for (let i = 0; i < uncoveredConditions.length; i += batchSize) {
    const batch = uncoveredConditions.slice(i, i + batchSize);
    console.log(`\n  Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} conditions)...`);
    
    const conditionsForAI = batch.map(c => ({
      name: c.condition,
      system: c.system,
      content: {
        symptoms: c.symptoms,
        physicalExamFindings: c.physicalExam,
        diagnosticCriteria: c.diagnostics,
        buzzwords: c.buzzwords,
        classicTriad: c.classic_triad,
        goldStandardDx: c.gold_standard_dx,
      },
    }));
    
    try {
      const candidates = await generatePathognomonicBuzzwords(conditionsForAI);
      console.log(`    AI generated ${candidates.length} buzzword candidates`);
      
      for (const candidate of candidates) {
        const exists = await buzzwordExists(candidate.conditionName, candidate.buzzword);
        
        if (exists) {
          totalSkipped++;
          continue;
        }
        
        if (dryRun) {
          console.log(`    [DRY RUN] Would insert: "${candidate.buzzword}" → ${candidate.conditionName}`);
          totalInserted++;
        } else {
          await prisma.buzzword.create({
            data: {
              id: crypto.randomUUID(),
              updatedAt: new Date(),
              buzzword: candidate.buzzword,
              condition: candidate.conditionName,
              system: candidate.system,
              explanation: candidate.explanation,
            },
          });
          console.log(`    ✅ "${candidate.buzzword}" → ${candidate.conditionName}`);
          totalInserted++;
        }
      }
    } catch (e) {
      console.error(`    ❌ Error processing batch:`, e);
    }
    
    if (i + batchSize < uncoveredConditions.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n  Summary: ${totalInserted} inserted, ${totalSkipped} skipped`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const analyzeOnly = args.includes('--analyze');
  const knownOnly = args.includes('--known-only');
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 25;
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           🩺 BUZZWORD DOCTOR - Pathognomonic Generator         ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  const modeText = dryRun ? 'DRY RUN (no changes)' : analyzeOnly ? 'ANALYZE ONLY' : 'LIVE (will make changes)';
  console.log(`║  Mode: ${modeText.padEnd(55)}║`);
  console.log(`║  Batch Size: ${batchSize.toString().padEnd(50)}║`);
  console.log(`║  AI Generation: ${knownOnly ? 'DISABLED (known only)' : 'ENABLED'}${' '.repeat(knownOnly ? 33 : 42)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  try {
    await analyzeState();
    
    if (analyzeOnly) {
      return;
    }
    
    await insertKnownBuzzwords(dryRun);
    
    if (!knownOnly) {
      await generateAIBuzzwords(dryRun, batchSize);
    }
    
    console.log('\n📈 FINAL STATE:');
    await analyzeState();
    
    console.log('\n✨ Buzzword Doctor complete!');
    
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
