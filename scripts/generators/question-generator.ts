/**
 * Question Generator
 * Generates PANCE-style practice questions across all body systems
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface QuestionData {
  vignette: string;
  question: string;
  options: { A: string; B: string; C: string; D: string; E?: string };
  correctAnswer: string;
  explanation: string;
  system: string;
  tags: string[];
  difficulty: string;
}

// PANCE Blueprint Systems with topic weights
const PANCE_SYSTEMS = [
  { system: 'Cardiovascular', topics: ['Heart Failure', 'Arrhythmias', 'Coronary Artery Disease', 'Hypertension', 'Valvular Disease', 'Peripheral Vascular Disease', 'Cardiomyopathy', 'Pericarditis', 'Endocarditis', 'Aortic Aneurysm'], weight: 16 },
  { system: 'Pulmonary', topics: ['COPD', 'Asthma', 'Pneumonia', 'Pulmonary Embolism', 'Lung Cancer', 'Pleural Effusion', 'Tuberculosis', 'Pneumothorax', 'Interstitial Lung Disease', 'Sleep Apnea'], weight: 12 },
  { system: 'Gastrointestinal', topics: ['GERD', 'Peptic Ulcer Disease', 'Inflammatory Bowel Disease', 'Liver Cirrhosis', 'Pancreatitis', 'Cholecystitis', 'Appendicitis', 'Bowel Obstruction', 'Diverticulitis', 'Colorectal Cancer'], weight: 10 },
  { system: 'Musculoskeletal', topics: ['Osteoarthritis', 'Rheumatoid Arthritis', 'Fractures', 'Low Back Pain', 'Gout', 'Osteoporosis', 'Rotator Cuff Injury', 'Carpal Tunnel', 'Fibromyalgia', 'Osteomyelitis'], weight: 10 },
  { system: 'EENT', topics: ['Otitis Media', 'Sinusitis', 'Conjunctivitis', 'Glaucoma', 'Macular Degeneration', 'Pharyngitis', 'Epistaxis', 'Tinnitus', 'Cataracts', 'Hearing Loss'], weight: 9 },
  { system: 'Neurologic', topics: ['Stroke', 'Seizures', 'Headache', 'Meningitis', 'Parkinson Disease', 'Multiple Sclerosis', 'Dementia', 'Peripheral Neuropathy', 'Bell Palsy', 'Vertigo'], weight: 6 },
  { system: 'Psychiatry', topics: ['Depression', 'Anxiety Disorders', 'Bipolar Disorder', 'Schizophrenia', 'PTSD', 'Substance Use Disorder', 'ADHD', 'Eating Disorders', 'Personality Disorders', 'Delirium'], weight: 6 },
  { system: 'Renal', topics: ['Acute Kidney Injury', 'Chronic Kidney Disease', 'Urinary Tract Infection', 'Nephrolithiasis', 'Glomerulonephritis', 'Polycystic Kidney Disease', 'Electrolyte Disorders', 'Nephrotic Syndrome', 'Renal Cell Carcinoma', 'Pyelonephritis'], weight: 6 },
  { system: 'Reproductive', topics: ['Pregnancy', 'Contraception', 'STIs', 'Menstrual Disorders', 'Breast Cancer', 'Prostate Disease', 'Testicular Cancer', 'Ovarian Cysts', 'Ectopic Pregnancy', 'Endometriosis'], weight: 8 },
  { system: 'Endocrine', topics: ['Diabetes Mellitus', 'Thyroid Disorders', 'Adrenal Disorders', 'Pituitary Disorders', 'Metabolic Syndrome', 'PCOS', 'Osteoporosis', 'Hyperlipidemia', 'Calcium Disorders', 'Obesity'], weight: 6 },
  { system: 'Dermatology', topics: ['Psoriasis', 'Eczema', 'Skin Cancer', 'Acne', 'Cellulitis', 'Herpes Zoster', 'Contact Dermatitis', 'Urticaria', 'Fungal Infections', 'Pressure Ulcers'], weight: 5 },
  { system: 'Hematology', topics: ['Anemia', 'Leukemia', 'Lymphoma', 'DVT', 'Coagulation Disorders', 'Thrombocytopenia', 'Sickle Cell Disease', 'Polycythemia', 'Multiple Myeloma', 'Transfusion Medicine'], weight: 3 },
  { system: 'Infectious Disease', topics: ['Sepsis', 'HIV/AIDS', 'Hepatitis', 'Influenza', 'COVID-19', 'Lyme Disease', 'Cellulitis', 'Osteomyelitis', 'Endocarditis', 'Meningitis'], weight: 3 }
];

const PROMPT_TEMPLATE = `You are an expert medical educator creating PANCE-style board exam questions.

Create a multiple choice question about: {{TOPIC}}
Body System: {{SYSTEM}}
Difficulty: {{DIFFICULTY}}

Requirements:
1. Write a realistic clinical vignette (2-4 sentences) with patient demographics, history, and findings
2. Include relevant vital signs, physical exam findings, or lab values when appropriate
3. Ask about diagnosis, next best step, treatment, or mechanism
4. Provide 4-5 answer options (A-E) that are plausible
5. One clearly correct answer
6. Detailed explanation covering why the answer is correct AND why each distractor is wrong

Return valid JSON:
{
  "vignette": "A 45-year-old woman presents with...",
  "question": "What is the most likely diagnosis?",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option",
    "E": "Fifth option"
  },
  "correctAnswer": "B",
  "explanation": "The correct answer is B because... Option A is incorrect because... Option C is incorrect because...",
  "system": "{{SYSTEM}}",
  "tags": ["{{TOPIC}}", "diagnosis", "high-yield"],
  "difficulty": "{{DIFFICULTY}}"
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown
- Use straight quotes only
- Write "greater than" not ">" 
- NO special characters like ≥ ≤ × → 
- All answer options must be distinct and medically plausible`;

async function generateQuestion(system: string, topic: string, difficulty: string, retryCount = 0): Promise<QuestionData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const prompt = PROMPT_TEMPLATE
    .replace(/{{TOPIC}}/g, topic)
    .replace(/{{SYSTEM}}/g, system)
    .replace(/{{DIFFICULTY}}/g, difficulty);
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    
    // Clean
    jsonStr = jsonStr
      .trim()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');
    
    const parsed: QuestionData = JSON.parse(jsonStr);
    
    // Validate required fields
    if (!parsed.vignette || !parsed.question || !parsed.options || !parsed.correctAnswer || !parsed.explanation) {
      throw new Error('Missing required fields');
    }
    
    return {
      ...parsed,
      system,
      difficulty
    };
  } catch (error) {
    console.error(`    ⚠️  Parse error: ${error}`);
    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 1000));
      return generateQuestion(system, topic, difficulty, retryCount + 1);
    }
    return null;
  }
}

async function main() {
  console.log('📝 Question Generator');
  console.log('═'.repeat(60));
  
  const existing = await prisma.question.count();
  console.log(`Current questions: ${existing}`);
  
  const TARGET = 500;
  const toGenerate = Math.max(0, TARGET - existing);
  console.log(`Target: ${TARGET}, Need to generate: ${toGenerate}`);
  
  if (toGenerate === 0) {
    console.log('✅ Already at target!');
    await prisma.$disconnect();
    return;
  }
  
  // Get existing question hashes to avoid duplicates
  const existingQuestions = await prisma.question.findMany({
    select: { question: true, vignette: true }
  });
  const existingHashes = new Set(
    existingQuestions.map(q => `${q.vignette.substring(0, 50)}-${q.question}`.toLowerCase())
  );
  
  let created = 0;
  let failed = 0;
  const difficulties = ['easy', 'medium', 'hard'];
  
  // Weight-based distribution
  const totalWeight = PANCE_SYSTEMS.reduce((sum, s) => sum + s.weight, 0);
  const systemCounts: { [key: string]: number } = {};
  
  for (const sys of PANCE_SYSTEMS) {
    systemCounts[sys.system] = Math.round((sys.weight / totalWeight) * toGenerate);
  }
  
  for (const sys of PANCE_SYSTEMS) {
    const count = systemCounts[sys.system];
    console.log(`\n📋 ${sys.system} (generating ${count} questions)`);
    
    for (let i = 0; i < count && created < toGenerate; i++) {
      const topic = sys.topics[i % sys.topics.length];
      const difficulty = difficulties[i % difficulties.length];
      
      console.log(`  🔄 [${created + 1}/${toGenerate}] ${topic} (${difficulty})...`);
      
      const data = await generateQuestion(sys.system, topic, difficulty);
      
      if (!data) {
        failed++;
        continue;
      }
      
      // Check for duplicate
      const hash = `${data.vignette.substring(0, 50)}-${data.question}`.toLowerCase();
      if (existingHashes.has(hash)) {
        console.log(`    ⏭️  Duplicate, skipping`);
        continue;
      }
      
      try {
        await prisma.question.create({
          data: {
            id: crypto.randomUUID(),
            vignette: data.vignette,
            question: data.question,
            options: data.options,
            correctAnswer: data.correctAnswer,
            explanation: data.explanation,
            system: data.system,
            tags: data.tags,
            difficulty: data.difficulty,
            source: 'ai-generated',
            updatedAt: new Date()
          }
        });
        
        existingHashes.add(hash);
        created++;
        console.log(`    ✅ Created`);
      } catch (error) {
        console.error(`    ❌ Save failed: ${error}`);
        failed++;
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 600));
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Failed: ${failed}`);
  
  const total = await prisma.question.count();
  console.log(`   Total in database: ${total}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
