/**
 * Practice Guideline Generator
 * Creates clinical practice guidelines from major medical organizations
 * (USPSTF, AHA, ACC, ACOG, AAP, AAFP, etc.)
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + (elapsed / 1000) * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((r) => setTimeout(r, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(10, 2);

interface GuidelineData {
  name: string;
  organization: string;
  category: string;
  year: number;
  summary: string;
  recommendations: string[];
}

// PANCE-relevant clinical practice guidelines
const GUIDELINES_TO_GENERATE = [
  // Cardiovascular
  { name: 'Hypertension Management', org: 'AHA/ACC', category: 'Cardiovascular', year: 2023 },
  {
    name: 'Atrial Fibrillation Management',
    org: 'AHA/ACC/HRS',
    category: 'Cardiovascular',
    year: 2023,
  },
  { name: 'Heart Failure Management', org: 'AHA/ACC/HFSA', category: 'Cardiovascular', year: 2022 },
  {
    name: 'Acute Coronary Syndrome Management',
    org: 'AHA/ACC',
    category: 'Cardiovascular',
    year: 2023,
  },
  { name: 'Cholesterol Management', org: 'AHA/ACC', category: 'Cardiovascular', year: 2018 },
  { name: 'Valvular Heart Disease', org: 'AHA/ACC', category: 'Cardiovascular', year: 2020 },
  {
    name: 'Venous Thromboembolism Prophylaxis',
    org: 'ASH',
    category: 'Cardiovascular',
    year: 2021,
  },
  { name: 'Peripheral Artery Disease', org: 'AHA/ACC', category: 'Cardiovascular', year: 2016 },

  // Pulmonary
  { name: 'Asthma Management', org: 'GINA', category: 'Pulmonary', year: 2023 },
  { name: 'COPD Management', org: 'GOLD', category: 'Pulmonary', year: 2023 },
  { name: 'Community-Acquired Pneumonia', org: 'IDSA/ATS', category: 'Pulmonary', year: 2019 },
  {
    name: 'Pulmonary Embolism Diagnosis and Treatment',
    org: 'ESC',
    category: 'Pulmonary',
    year: 2019,
  },

  // Endocrine
  { name: 'Type 2 Diabetes Management', org: 'ADA', category: 'Endocrine', year: 2024 },
  { name: 'Type 1 Diabetes Management', org: 'ADA', category: 'Endocrine', year: 2024 },
  { name: 'Thyroid Nodule Evaluation', org: 'ATA', category: 'Endocrine', year: 2015 },
  { name: 'Hypothyroidism Management', org: 'ATA', category: 'Endocrine', year: 2014 },
  { name: 'Hyperthyroidism Management', org: 'ATA', category: 'Endocrine', year: 2016 },
  {
    name: 'Osteoporosis Screening and Treatment',
    org: 'USPSTF/Endocrine Society',
    category: 'Endocrine',
    year: 2021,
  },

  // Infectious Disease
  {
    name: 'Skin and Soft Tissue Infections',
    org: 'IDSA',
    category: 'Infectious Disease',
    year: 2014,
  },
  { name: 'Urinary Tract Infections', org: 'IDSA', category: 'Infectious Disease', year: 2010 },
  { name: 'Bacterial Meningitis', org: 'IDSA', category: 'Infectious Disease', year: 2017 },
  {
    name: 'Clostridioides difficile Infection',
    org: 'IDSA/SHEA',
    category: 'Infectious Disease',
    year: 2021,
  },
  { name: 'HIV Antiretroviral Therapy', org: 'DHHS', category: 'Infectious Disease', year: 2023 },
  {
    name: 'Sexually Transmitted Infections',
    org: 'CDC',
    category: 'Infectious Disease',
    year: 2021,
  },
  {
    name: 'Tuberculosis Treatment',
    org: 'CDC/ATS/IDSA',
    category: 'Infectious Disease',
    year: 2016,
  },

  // Gastrointestinal
  { name: 'GERD Management', org: 'ACG', category: 'Gastrointestinal', year: 2022 },
  { name: 'Peptic Ulcer Disease', org: 'ACG', category: 'Gastrointestinal', year: 2017 },
  { name: 'Inflammatory Bowel Disease', org: 'ACG', category: 'Gastrointestinal', year: 2018 },
  { name: 'Colorectal Cancer Screening', org: 'USPSTF', category: 'Gastrointestinal', year: 2021 },
  { name: 'Acute Pancreatitis', org: 'ACG', category: 'Gastrointestinal', year: 2013 },
  { name: 'Hepatitis C Treatment', org: 'AASLD/IDSA', category: 'Gastrointestinal', year: 2023 },

  // Nephrology
  { name: 'Chronic Kidney Disease Management', org: 'KDIGO', category: 'Nephrology', year: 2021 },
  { name: 'Acute Kidney Injury', org: 'KDIGO', category: 'Nephrology', year: 2012 },
  { name: 'Hypertension in CKD', org: 'KDIGO', category: 'Nephrology', year: 2021 },

  // Neurology
  { name: 'Acute Ischemic Stroke', org: 'AHA/ASA', category: 'Neurology', year: 2019 },
  { name: 'Migraine Prevention', org: 'AAN', category: 'Neurology', year: 2021 },
  { name: 'Epilepsy Treatment', org: 'AAN', category: 'Neurology', year: 2018 },
  { name: 'Parkinson Disease', org: 'AAN', category: 'Neurology', year: 2019 },

  // Rheumatology
  { name: 'Rheumatoid Arthritis', org: 'ACR', category: 'Rheumatology', year: 2021 },
  { name: 'Gout Management', org: 'ACR', category: 'Rheumatology', year: 2020 },
  { name: 'Systemic Lupus Erythematosus', org: 'ACR/EULAR', category: 'Rheumatology', year: 2019 },

  // Psychiatry
  { name: 'Major Depressive Disorder', org: 'APA', category: 'Psychiatry', year: 2023 },
  { name: 'Generalized Anxiety Disorder', org: 'APA', category: 'Psychiatry', year: 2009 },
  { name: 'Bipolar Disorder', org: 'APA', category: 'Psychiatry', year: 2023 },
  { name: 'ADHD in Adults', org: 'APA', category: 'Psychiatry', year: 2019 },
  { name: 'Alcohol Use Disorder', org: 'APA', category: 'Psychiatry', year: 2018 },
  { name: 'Opioid Use Disorder', org: 'ASAM', category: 'Psychiatry', year: 2020 },

  // Preventive Medicine / Screening
  { name: 'Breast Cancer Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2024 },
  { name: 'Cervical Cancer Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2018 },
  { name: 'Lung Cancer Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2021 },
  { name: 'Prostate Cancer Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2018 },
  {
    name: 'Cardiovascular Risk Assessment',
    org: 'USPSTF',
    category: 'Preventive Medicine',
    year: 2022,
  },
  {
    name: 'Prediabetes and Type 2 Diabetes Screening',
    org: 'USPSTF',
    category: 'Preventive Medicine',
    year: 2021,
  },
  {
    name: 'Abdominal Aortic Aneurysm Screening',
    org: 'USPSTF',
    category: 'Preventive Medicine',
    year: 2019,
  },
  { name: 'Hepatitis B Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2020 },
  { name: 'Hepatitis C Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2020 },
  { name: 'HIV Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2019 },
  { name: 'Depression Screening', org: 'USPSTF', category: 'Preventive Medicine', year: 2016 },

  // Women's Health
  { name: 'Prenatal Care', org: 'ACOG', category: "Women's Health", year: 2023 },
  { name: 'Gestational Diabetes', org: 'ACOG', category: "Women's Health", year: 2018 },
  { name: 'Preeclampsia Prevention', org: 'ACOG', category: "Women's Health", year: 2020 },
  { name: 'Contraception Recommendations', org: 'ACOG', category: "Women's Health", year: 2022 },
  { name: 'Menopause Hormone Therapy', org: 'NAMS', category: "Women's Health", year: 2022 },

  // Pediatrics
  { name: 'Pediatric Immunization Schedule', org: 'CDC/ACIP', category: 'Pediatrics', year: 2024 },
  { name: 'Pediatric Obesity', org: 'AAP', category: 'Pediatrics', year: 2023 },
  { name: 'Acute Otitis Media', org: 'AAP', category: 'Pediatrics', year: 2013 },
  { name: 'Bronchiolitis Management', org: 'AAP', category: 'Pediatrics', year: 2014 },
  { name: 'Febrile Infant Evaluation', org: 'AAP', category: 'Pediatrics', year: 2021 },

  // Geriatrics
  { name: 'Falls Prevention in Older Adults', org: 'AGS', category: 'Geriatrics', year: 2022 },
  { name: 'Polypharmacy and Deprescribing', org: 'AGS', category: 'Geriatrics', year: 2019 },
  { name: 'Cognitive Impairment Screening', org: 'USPSTF', category: 'Geriatrics', year: 2020 },
];

async function generateGuidelineContent(
  guideline: { name: string; org: string; category: string; year: number },
  retryCount = 0
): Promise<GuidelineData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a medical education expert. Generate comprehensive clinical practice guideline information for PA/NP students about:

Guideline: ${guideline.name}
Organization: ${guideline.org}
Category: ${guideline.category}
Year: ${guideline.year}

Return a JSON object with these fields:
{
  "name": "Full guideline name",
  "organization": "${guideline.org}",
  "category": "${guideline.category}",
  "year": ${guideline.year},
  "summary": "2-3 sentence overview of the guideline's purpose and scope",
  "recommendations": [
    "Key recommendation 1 with specific criteria/thresholds",
    "Key recommendation 2",
    "Key recommendation 3",
    "... up to 8-10 key recommendations"
  ]
}

Rules:
- Focus on clinically actionable recommendations
- Include specific numbers, thresholds, and criteria where applicable
- Make recommendations practical for primary care/general practice
- Include grade of recommendation if known (Grade A, B, C or Class I, IIa, IIb, III)
- Return ONLY valid JSON, no markdown`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response
      .text()
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return null;
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

    jsonStr = jsonStr
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/,(\s*[\]}])/g, '$1');

    try {
      return JSON.parse(jsonStr) as GuidelineData;
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise((r) => setTimeout(r, 1000));
        return generateGuidelineContent(guideline, 1);
      }
      return null;
    }
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return generateGuidelineContent(guideline, 1);
    }
    return null;
  }
}

async function main() {
  console.log('📋 Practice Guideline Generator');
  console.log('='.repeat(60));

  // Check for duplicates
  console.log('\n🔍 Checking for duplicates...');
  const existing = await prisma.practiceGuideline.findMany({
    select: { name: true },
  });
  const existingNames = new Set(existing.map((g) => g.name.toLowerCase()));
  console.log(`  Found ${existing.length} existing guidelines`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`\nGenerating ${GUIDELINES_TO_GENERATE.length} practice guidelines...\n`);

  for (const guideline of GUIDELINES_TO_GENERATE) {
    // Check if exists
    if (existingNames.has(guideline.name.toLowerCase())) {
      console.log(`  ⏭️  Skipped: ${guideline.name} (exists)`);
      skipped++;
      continue;
    }

    console.log(`  🔄 Creating: ${guideline.name}...`);

    const data = await generateGuidelineContent(guideline);

    if (!data) {
      console.log(`  ❌ Failed: ${guideline.name}`);
      failed++;
      continue;
    }

    try {
      await prisma.practiceGuideline.create({
        data: {
          id: uuidv4(),
          name: data.name,
          organization: data.organization,
          category: data.category,
          year: data.year,
          summary: data.summary,
          recommendations: data.recommendations,
        },
      });

      existingNames.add(data.name.toLowerCase());
      console.log(`  ✅ Created: ${data.name}`);
      created++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`  ⏭️  Skipped: ${guideline.name} (duplicate)`);
        skipped++;
      } else {
        console.log(`  ❌ Failed: ${guideline.name} - ${error.message}`);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total in database: ${await prisma.practiceGuideline.count()}`);

  await prisma.$disconnect();
}

main().catch(console.error);
