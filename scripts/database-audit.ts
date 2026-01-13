#!/usr/bin/env npx tsx
/**
 * Comprehensive Database Audit & Gap Analysis
 * 
 * Analyzes:
 * 1. Subcategory consolidation opportunities
 * 2. Misclassified conditions (screenings, normals, therapies)
 * 3. Missing high-yield PANCE conditions
 * 4. Duplicate detection
 */

import { prisma } from './helpers/prisma-client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// PANCE Blueprint high-yield conditions by system
const PANCE_BLUEPRINT = {
  Cardiovascular: [
    'Myocardial Infarction', 'Unstable Angina', 'Stable Angina', 'Heart Failure',
    'Atrial Fibrillation', 'Atrial Flutter', 'Ventricular Tachycardia', 'Ventricular Fibrillation',
    'Hypertension', 'Hypertensive Emergency', 'Aortic Stenosis', 'Aortic Regurgitation',
    'Mitral Stenosis', 'Mitral Regurgitation', 'Mitral Valve Prolapse', 'Pericarditis',
    'Cardiac Tamponade', 'Endocarditis', 'Rheumatic Fever', 'Cardiogenic Shock',
    'Peripheral Arterial Disease', 'Deep Vein Thrombosis', 'Pulmonary Embolism',
    'Aortic Dissection', 'Aortic Aneurysm', 'Syncope', 'Cardiomyopathy'
  ],
  Pulmonary: [
    'Asthma', 'COPD', 'Pneumonia', 'Tuberculosis', 'Lung Cancer', 'Bronchiectasis',
    'Pulmonary Fibrosis', 'Sarcoidosis', 'Pleural Effusion', 'Pneumothorax',
    'Pulmonary Hypertension', 'Acute Respiratory Distress Syndrome', 'Sleep Apnea',
    'Cystic Fibrosis', 'Bronchiolitis', 'Pulmonary Embolism'
  ],
  Gastrointestinal: [
    'GERD', 'Peptic Ulcer Disease', 'Gastritis', 'Inflammatory Bowel Disease', 'Crohns Disease',
    'Ulcerative Colitis', 'Irritable Bowel Syndrome', 'Celiac Disease', 'Diverticulitis',
    'Appendicitis', 'Cholecystitis', 'Cholelithiasis', 'Pancreatitis', 'Hepatitis',
    'Cirrhosis', 'Colorectal Cancer', 'Gastric Cancer', 'Esophageal Cancer',
    'Bowel Obstruction', 'Mesenteric Ischemia', 'Mallory-Weiss Tear', 'Esophageal Varices'
  ],
  Renal: [
    'Acute Kidney Injury', 'Chronic Kidney Disease', 'Glomerulonephritis', 'Nephrotic Syndrome',
    'Nephritic Syndrome', 'Urinary Tract Infection', 'Pyelonephritis', 'Kidney Stones',
    'Polycystic Kidney Disease', 'Renal Cell Carcinoma', 'Bladder Cancer',
    'Acute Tubular Necrosis', 'Hyperkalemia', 'Hypokalemia', 'Hyponatremia', 'Hypernatremia'
  ],
  Endocrine: [
    'Diabetes Mellitus Type 1', 'Diabetes Mellitus Type 2', 'Diabetic Ketoacidosis',
    'Hyperosmolar Hyperglycemic State', 'Hypoglycemia', 'Hypothyroidism', 'Hyperthyroidism',
    'Graves Disease', 'Hashimotos Thyroiditis', 'Thyroid Cancer', 'Cushings Syndrome',
    'Addisons Disease', 'Hyperparathyroidism', 'Hypoparathyroidism', 'Pheochromocytoma',
    'Acromegaly', 'Diabetes Insipidus', 'SIADH'
  ],
  Musculoskeletal: [
    'Osteoarthritis', 'Rheumatoid Arthritis', 'Gout', 'Pseudogout', 'Septic Arthritis',
    'Osteoporosis', 'Osteomalacia', 'Pagets Disease', 'Osteomyelitis', 'Fractures',
    'Ankle Sprain', 'Rotator Cuff Tear', 'ACL Tear', 'Meniscal Tear', 'Carpal Tunnel Syndrome',
    'Compartment Syndrome', 'Fibromyalgia', 'Polymyalgia Rheumatica', 'Ankylosing Spondylitis',
    'Osteosarcoma', 'Rhabdomyolysis'
  ],
  Neurological: [
    'Stroke', 'TIA', 'Seizure', 'Epilepsy', 'Migraine', 'Tension Headache', 'Cluster Headache',
    'Meningitis', 'Encephalitis', 'Brain Abscess', 'Subdural Hematoma', 'Epidural Hematoma',
    'Subarachnoid Hemorrhage', 'Parkinsons Disease', 'Multiple Sclerosis', 'ALS',
    'Myasthenia Gravis', 'Guillain-Barre Syndrome', 'Bells Palsy', 'Trigeminal Neuralgia',
    'Peripheral Neuropathy', 'Dementia', 'Alzheimers Disease', 'Brain Tumor', 'Concussion'
  ],
  Psychiatry: [
    'Major Depressive Disorder', 'Bipolar Disorder', 'Schizophrenia', 'Anxiety Disorders',
    'Generalized Anxiety Disorder', 'Panic Disorder', 'OCD', 'PTSD', 'Substance Use Disorder',
    'Alcohol Use Disorder', 'Eating Disorders', 'Anorexia Nervosa', 'Bulimia Nervosa',
    'ADHD', 'Autism Spectrum Disorder', 'Personality Disorders'
  ],
  Hematology: [
    'Iron Deficiency Anemia', 'Vitamin B12 Deficiency', 'Folate Deficiency', 'Sickle Cell Disease',
    'Thalassemia', 'Hemolytic Anemia', 'Aplastic Anemia', 'Polycythemia Vera',
    'Thrombocytopenia', 'ITP', 'TTP', 'HUS', 'DIC', 'Hemophilia', 'Von Willebrand Disease',
    'Leukemia', 'Lymphoma', 'Multiple Myeloma'
  ],
  'Infectious Disease': [
    'HIV', 'Sepsis', 'Cellulitis', 'Abscess', 'Influenza', 'COVID-19', 'Mononucleosis',
    'Lyme Disease', 'Rocky Mountain Spotted Fever', 'Malaria', 'Toxoplasmosis',
    'Candidiasis', 'Herpes Simplex', 'Herpes Zoster', 'HPV', 'Syphilis', 'Gonorrhea',
    'Chlamydia', 'PID', 'Osteomyelitis', 'Endocarditis'
  ],
  Dermatology: [
    'Acne', 'Rosacea', 'Psoriasis', 'Eczema', 'Contact Dermatitis', 'Seborrheic Dermatitis',
    'Urticaria', 'Cellulitis', 'Impetigo', 'Folliculitis', 'Abscess', 'Fungal Infections',
    'Melanoma', 'Basal Cell Carcinoma', 'Squamous Cell Carcinoma', 'Actinic Keratosis',
    'Herpes Simplex', 'Herpes Zoster', 'Scabies', 'Pediculosis'
  ],
  HEENT: [
    'Otitis Media', 'Otitis Externa', 'Sinusitis', 'Pharyngitis', 'Tonsillitis', 'Epistaxis',
    'Conjunctivitis', 'Glaucoma', 'Cataracts', 'Macular Degeneration', 'Retinal Detachment',
    'Dental Caries', 'Temporomandibular Joint Disorder', 'Meniere Disease', 'Vertigo',
    'Hearing Loss', 'Allergic Rhinitis'
  ],
  Reproductive: [
    'Pregnancy', 'Ectopic Pregnancy', 'Preeclampsia', 'Gestational Diabetes', 'Placenta Previa',
    'Placental Abruption', 'Menopause', 'Polycystic Ovary Syndrome', 'Endometriosis',
    'Uterine Fibroids', 'Ovarian Cyst', 'Ovarian Cancer', 'Cervical Cancer', 'Breast Cancer',
    'Benign Prostatic Hyperplasia', 'Prostate Cancer', 'Testicular Cancer', 'Erectile Dysfunction',
    'STIs', 'Contraception'
  ]
};

async function main() {
  console.log('🔍 PANaCEa Database Audit & Gap Analysis\n');
  console.log('=' .repeat(80) + '\n');

  // 1. Analyze Subcategories
  await analyzeSubcategories();
  
  // 2. Identify Misclassified Conditions
  await identifyMisclassified();
  
  // 3. Gap Analysis
  await performGapAnalysis();
  
  // 4. Detect Duplicates
  await detectDuplicates();
  
  // 5. AI-Powered Recommendations (if API key available)
  if (GEMINI_API_KEY) {
    await aiRecommendations();
  }
}

async function analyzeSubcategories() {
  console.log('📊 SUBCATEGORY ANALYSIS\n');
  
  const subcategories = await prisma.condition.groupBy({
    by: ['system', 'subcategory'],
    _count: true,
    orderBy: [{ system: 'asc' }, { _count: { id: 'desc' } }]
  });
  
  // Identify outliers (subcategories with ≤2 conditions)
  const outliers = subcategories.filter(s => s._count <= 2 && s.subcategory !== null);
  
  console.log(`⚠️  Found ${outliers.length} outlier subcategories (≤2 conditions):\n`);
  outliers.forEach(sub => {
    console.log(`  • ${sub.system} / "${sub.subcategory}" (${sub._count} condition${sub._count > 1 ? 's' : ''})`);
  });
  
  // Identify null subcategories
  const nullSubs = subcategories.filter(s => s.subcategory === null);
  console.log(`\n⚠️  Systems with null subcategories (${nullSubs.reduce((sum, s) => sum + s._count, 0)} total conditions):\n`);
  nullSubs.forEach(sub => {
    console.log(`  • ${sub.system}: ${sub._count} conditions`);
  });
  
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function identifyMisclassified() {
  console.log('🔍 MISCLASSIFIED CONDITIONS\n');
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true, subcategory: true }
  });
  
  const screeningPattern = /screening|screen/i;
  const therapyPattern = /therapy|treatment\s*$/i;
  const normalPattern = /^normal\s/i;
  const prophylaxisPattern = /prophylaxis/i;
  
  const screenings = conditions.filter(c => screeningPattern.test(c.name));
  const therapies = conditions.filter(c => therapyPattern.test(c.name));
  const normals = conditions.filter(c => normalPattern.test(c.name));
  const prophylaxis = conditions.filter(c => prophylaxisPattern.test(c.name));
  
  console.log(`📋 SCREENINGS (${screenings.length}) - Should be in Guideline table:`);
  screenings.forEach(c => console.log(`  • ${c.name} [${c.system}]`));
  
  console.log(`\n💊 THERAPIES (${therapies.length}) - Should be Treatment/Protocol:`);
  therapies.forEach(c => console.log(`  • ${c.name} [${c.system}]`));
  
  console.log(`\n✅ NORMALS (${normals.length}) - Not true conditions:`);
  normals.forEach(c => console.log(`  • ${c.name} [${c.system}]`));
  
  console.log(`\n🛡️  PROPHYLAXIS (${prophylaxis.length}) - Should be Guideline/Prevention:`);
  prophylaxis.forEach(c => console.log(`  • ${c.name} [${c.system}]`));
  
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function performGapAnalysis() {
  console.log('📋 GAP ANALYSIS - Missing PANCE Blueprint Conditions\n');
  
  const allConditions = await prisma.condition.findMany({
    select: { name: true, system: true }
  });
  
  const conditionNames = new Set(
    allConditions.map(c => c.name.toLowerCase().replace(/[^\w\s]/g, ''))
  );
  
  let totalMissing = 0;
  
  for (const [system, expectedConditions] of Object.entries(PANCE_BLUEPRINT)) {
    const missing: string[] = [];
    
    for (const condition of expectedConditions) {
      const normalized = condition.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Check for exact match or partial match
      const found = Array.from(conditionNames).some(existing => 
        existing.includes(normalized) || normalized.includes(existing)
      );
      
      if (!found) {
        missing.push(condition);
      }
    }
    
    if (missing.length > 0) {
      totalMissing += missing.length;
      console.log(`\n🏥 ${system} (${missing.length} missing):`);
      missing.slice(0, 10).forEach(c => console.log(`  • ${c}`));
      if (missing.length > 10) {
        console.log(`  ... and ${missing.length - 10} more`);
      }
    }
  }
  
  console.log(`\n📊 Total Missing: ${totalMissing} high-yield PANCE conditions`);
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function detectDuplicates() {
  console.log('🔄 DUPLICATE DETECTION\n');
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  // Group by normalized name
  const nameMap = new Map<string, typeof conditions>();
  
  conditions.forEach(c => {
    const normalized = c.name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!nameMap.has(normalized)) {
      nameMap.set(normalized, []);
    }
    nameMap.get(normalized)!.push(c);
  });
  
  // Find duplicates
  const duplicates = Array.from(nameMap.entries())
    .filter(([_, conditions]) => conditions.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} potential duplicate groups:\n`);
    duplicates.slice(0, 20).forEach(([normalized, conditions]) => {
      console.log(`  • "${conditions[0].name}"`);
      conditions.forEach(c => console.log(`    - ${c.id} (${c.system})`));
    });
  } else {
    console.log('✅ No obvious duplicates detected');
  }
  
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function aiRecommendations() {
  console.log('🤖 AI-POWERED RECOMMENDATIONS\n');
  
  const subcategories = await prisma.condition.groupBy({
    by: ['system', 'subcategory'],
    _count: true,
    where: { subcategory: { not: null } }
  });
  
  const outliers = subcategories
    .filter(s => s._count <= 2)
    .map(s => `${s.system}/${s.subcategory} (${s._count})`);
  
  if (outliers.length === 0) return;
  
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const prompt = `You are a medical informatics expert helping organize a PANCE study platform database.

TASK: Recommend subcategory consolidations for outlier subcategories (those with only 1-2 conditions).

OUTLIER SUBCATEGORIES:
${outliers.join('\n')}

GUIDELINES:
1. Group related conditions under clinically meaningful subcategories
2. Align with PANCE blueprint organization
3. Balance specificity with usability
4. Avoid over-generalization that loses clinical value

Provide recommendations in this format:
SYSTEM: [System Name]
- Consolidate "[Current Subcategory]" → "[Recommended Subcategory]" (Rationale: brief explanation)

Be concise and focus on the most impactful consolidations.`;
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log(text);
  } catch (err) {
    console.error('⚠️  AI recommendations unavailable:', (err as Error).message);
  }
  
  console.log('\n' + '-'.repeat(80) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
