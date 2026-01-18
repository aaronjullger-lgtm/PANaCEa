/**
 * DifferentialDiagnosis Generator
 * Generates comprehensive DDx entries for presenting complaints
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface DDxData {
  presentingComplaint: string;
  category: string;
  isEmergency: boolean;
  differentialList: string[];
  mustNotMiss: string[];
  workup: string;
  byAcuity: { emergent: string[]; urgent: string[]; nonUrgent: string[] };
  byAge: { pediatric?: string[]; adult: string[]; geriatric?: string[] };
  clinicalPearls: string[];
  commonMistakes: string[];
  diagnosticAlgorithm: string;
  dispositionGuidance: string;
  distinguishingFeatures: Record<string, string>;
  initialWorkup: string[];
  isHighYield: boolean;
  keyExamFindings: string[];
  keyQuestions: string[];
  mnemonics: string[];
  mostCommon: string[];
  mostDangerous: string[];
  oftenMissed: string[];
  panceYield: number;
  reassuringFeatures: string[];
  redFlags: string[];
  typicalPresentation: string;
}

// High-yield presenting complaints for PANCE
const PRESENTING_COMPLAINTS = [
  { complaint: 'Chest Pain', category: 'Cardiovascular', emergency: true },
  { complaint: 'Shortness of Breath', category: 'Pulmonary', emergency: true },
  { complaint: 'Abdominal Pain', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Headache', category: 'Neurologic', emergency: false },
  { complaint: 'Syncope', category: 'Cardiovascular', emergency: true },
  { complaint: 'Dizziness', category: 'Neurologic', emergency: false },
  { complaint: 'Lower Back Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Joint Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Fever', category: 'Infectious Disease', emergency: false },
  { complaint: 'Cough', category: 'Pulmonary', emergency: false },
  { complaint: 'Fatigue', category: 'General', emergency: false },
  { complaint: 'Palpitations', category: 'Cardiovascular', emergency: false },
  { complaint: 'Weakness', category: 'Neurologic', emergency: true },
  { complaint: 'Altered Mental Status', category: 'Neurologic', emergency: true },
  { complaint: 'Seizure', category: 'Neurologic', emergency: true },
  { complaint: 'Rash', category: 'Dermatology', emergency: false },
  { complaint: 'Sore Throat', category: 'EENT', emergency: false },
  { complaint: 'Ear Pain', category: 'EENT', emergency: false },
  { complaint: 'Dysphagia', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Nausea and Vomiting', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Diarrhea', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Constipation', category: 'Gastrointestinal', emergency: false },
  { complaint: 'GI Bleeding', category: 'Gastrointestinal', emergency: true },
  { complaint: 'Hematuria', category: 'Renal', emergency: false },
  { complaint: 'Dysuria', category: 'Renal', emergency: false },
  { complaint: 'Flank Pain', category: 'Renal', emergency: false },
  { complaint: 'Peripheral Edema', category: 'Cardiovascular', emergency: false },
  { complaint: 'Weight Loss', category: 'General', emergency: false },
  { complaint: 'Weight Gain', category: 'Endocrine', emergency: false },
  { complaint: 'Polyuria', category: 'Endocrine', emergency: false },
  { complaint: 'Visual Changes', category: 'EENT', emergency: true },
  { complaint: 'Red Eye', category: 'EENT', emergency: false },
  { complaint: 'Hearing Loss', category: 'EENT', emergency: false },
  { complaint: 'Neck Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Shoulder Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Knee Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Ankle Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Numbness and Tingling', category: 'Neurologic', emergency: false },
  { complaint: 'Tremor', category: 'Neurologic', emergency: false },
  { complaint: 'Memory Loss', category: 'Neurologic', emergency: false },
  { complaint: 'Anxiety', category: 'Psychiatry', emergency: false },
  { complaint: 'Depression', category: 'Psychiatry', emergency: false },
  { complaint: 'Insomnia', category: 'Psychiatry', emergency: false },
  { complaint: 'Vaginal Bleeding', category: 'Reproductive', emergency: true },
  { complaint: 'Vaginal Discharge', category: 'Reproductive', emergency: false },
  { complaint: 'Pelvic Pain', category: 'Reproductive', emergency: false },
  { complaint: 'Breast Mass', category: 'Reproductive', emergency: false },
  { complaint: 'Testicular Pain', category: 'Reproductive', emergency: true },
  { complaint: 'Erectile Dysfunction', category: 'Reproductive', emergency: false },
  { complaint: 'Bruising', category: 'Hematology', emergency: false },
  { complaint: 'Lymphadenopathy', category: 'Hematology', emergency: false },
  { complaint: 'Night Sweats', category: 'Hematology', emergency: false },
  { complaint: 'Jaundice', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Pruritus', category: 'Dermatology', emergency: false },
  { complaint: 'Hair Loss', category: 'Dermatology', emergency: false },
  { complaint: 'Skin Lesion', category: 'Dermatology', emergency: false },
  { complaint: 'Wheezing', category: 'Pulmonary', emergency: true },
  { complaint: 'Hemoptysis', category: 'Pulmonary', emergency: true },
  { complaint: 'Stridor', category: 'Pulmonary', emergency: true },
  { complaint: 'Epistaxis', category: 'EENT', emergency: false },
  { complaint: 'Nasal Congestion', category: 'EENT', emergency: false },
  { complaint: 'Hoarseness', category: 'EENT', emergency: false },
  { complaint: 'Dyspnea on Exertion', category: 'Cardiovascular', emergency: false },
  { complaint: 'Orthopnea', category: 'Cardiovascular', emergency: false },
  { complaint: 'Leg Pain', category: 'Vascular', emergency: false },
  { complaint: 'Claudication', category: 'Vascular', emergency: false },
  { complaint: 'Cold Extremity', category: 'Vascular', emergency: true },
  { complaint: 'Unilateral Leg Swelling', category: 'Vascular', emergency: true },
  { complaint: 'Abdominal Distension', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Rectal Pain', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Hiccups', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Heartburn', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Bloating', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Urinary Incontinence', category: 'Renal', emergency: false },
  { complaint: 'Urinary Retention', category: 'Renal', emergency: true },
  { complaint: 'Polydipsia', category: 'Endocrine', emergency: false },
  { complaint: 'Heat Intolerance', category: 'Endocrine', emergency: false },
  { complaint: 'Cold Intolerance', category: 'Endocrine', emergency: false },
  { complaint: 'Amenorrhea', category: 'Reproductive', emergency: false },
  { complaint: 'Dysmenorrhea', category: 'Reproductive', emergency: false },
  { complaint: 'Hot Flashes', category: 'Reproductive', emergency: false },

  // === ADDITIONAL COMPREHENSIVE PANCE PRESENTING COMPLAINTS ===

  // Pediatric-Specific
  { complaint: 'Pediatric Fever', category: 'Pediatrics', emergency: true },
  { complaint: 'Pediatric Abdominal Pain', category: 'Pediatrics', emergency: false },
  { complaint: 'Failure to Thrive', category: 'Pediatrics', emergency: false },
  { complaint: 'Developmental Delay', category: 'Pediatrics', emergency: false },
  { complaint: 'Pediatric Limp', category: 'Pediatrics', emergency: false },
  { complaint: 'Crying/Fussy Baby', category: 'Pediatrics', emergency: false },
  { complaint: 'Pediatric Rash', category: 'Pediatrics', emergency: false },
  { complaint: 'Pediatric Cough', category: 'Pediatrics', emergency: false },
  { complaint: 'Pediatric Vomiting', category: 'Pediatrics', emergency: false },

  // Emergency/Trauma
  { complaint: 'Poisoning/Overdose', category: 'Emergency', emergency: true },
  { complaint: 'Burns', category: 'Emergency', emergency: true },
  { complaint: 'Drowning/Near Drowning', category: 'Emergency', emergency: true },
  { complaint: 'Hypothermia', category: 'Emergency', emergency: true },
  { complaint: 'Heat Stroke', category: 'Emergency', emergency: true },
  { complaint: 'Electrical Injury', category: 'Emergency', emergency: true },
  { complaint: 'Animal Bite', category: 'Emergency', emergency: false },
  { complaint: 'Human Bite', category: 'Emergency', emergency: false },
  { complaint: 'Anaphylaxis', category: 'Emergency', emergency: true },

  // Cardiovascular - Additional
  { complaint: 'Hypertensive Emergency', category: 'Cardiovascular', emergency: true },
  { complaint: 'Hypotension', category: 'Cardiovascular', emergency: true },
  { complaint: 'Bradycardia', category: 'Cardiovascular', emergency: false },
  { complaint: 'Tachycardia', category: 'Cardiovascular', emergency: false },
  { complaint: 'Cardiac Arrest', category: 'Cardiovascular', emergency: true },

  // Respiratory - Additional
  { complaint: 'Respiratory Distress', category: 'Pulmonary', emergency: true },
  { complaint: 'Apnea', category: 'Pulmonary', emergency: true },
  { complaint: 'Chronic Cough', category: 'Pulmonary', emergency: false },
  { complaint: 'Pleuritic Chest Pain', category: 'Pulmonary', emergency: false },

  // Neurological - Additional
  { complaint: 'Focal Neurologic Deficit', category: 'Neurologic', emergency: true },
  { complaint: 'Aphasia', category: 'Neurologic', emergency: true },
  { complaint: 'Ataxia', category: 'Neurologic', emergency: false },
  { complaint: 'Vertigo', category: 'Neurologic', emergency: false },
  { complaint: 'Facial Weakness', category: 'Neurologic', emergency: true },
  { complaint: 'Diplopia', category: 'Neurologic', emergency: false },
  { complaint: 'Paresthesias', category: 'Neurologic', emergency: false },
  { complaint: 'Radiculopathy', category: 'Neurologic', emergency: false },

  // GI - Additional
  { complaint: 'Dyspepsia', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Melena', category: 'Gastrointestinal', emergency: true },
  { complaint: 'Hematochezia', category: 'Gastrointestinal', emergency: true },
  { complaint: 'Acute Diarrhea', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Chronic Diarrhea', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Fecal Incontinence', category: 'Gastrointestinal', emergency: false },
  { complaint: 'Anorectal Pain', category: 'Gastrointestinal', emergency: false },

  // Renal/GU - Additional
  { complaint: 'Oliguria/Anuria', category: 'Renal', emergency: true },
  { complaint: 'Polyuria/Nocturia', category: 'Renal', emergency: false },
  { complaint: 'Proteinuria', category: 'Renal', emergency: false },
  { complaint: 'Scrotal Pain', category: 'Renal', emergency: true },
  { complaint: 'Scrotal Mass', category: 'Renal', emergency: false },
  { complaint: 'Penile Discharge', category: 'Renal', emergency: false },

  // Musculoskeletal - Additional
  { complaint: 'Monoarticular Joint Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Polyarticular Joint Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Joint Swelling', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Muscle Pain/Myalgia', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Muscle Weakness', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Wrist Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Elbow Pain', category: 'Musculoskeletal', emergency: false },
  { complaint: 'Hip Pain (Pediatric)', category: 'Musculoskeletal', emergency: false },

  // Dermatologic - Additional
  { complaint: 'Vesicular Rash', category: 'Dermatology', emergency: false },
  { complaint: 'Petechial Rash', category: 'Dermatology', emergency: true },
  { complaint: 'Purpuric Rash', category: 'Dermatology', emergency: true },
  { complaint: 'Urticaria', category: 'Dermatology', emergency: false },
  { complaint: 'Cellulitis', category: 'Dermatology', emergency: false },
  { complaint: 'Ulcer/Wound', category: 'Dermatology', emergency: false },
  { complaint: 'Nail Abnormality', category: 'Dermatology', emergency: false },
  { complaint: 'Alopecia', category: 'Dermatology', emergency: false },

  // EENT - Additional
  { complaint: 'Tinnitus', category: 'EENT', emergency: false },
  { complaint: 'Vertigo (ENT)', category: 'EENT', emergency: false },
  { complaint: 'Facial Pain', category: 'EENT', emergency: false },
  { complaint: 'Dental Pain', category: 'EENT', emergency: false },
  { complaint: 'Oral Lesions', category: 'EENT', emergency: false },
  { complaint: 'Neck Mass', category: 'EENT', emergency: false },
  { complaint: 'Thyroid Nodule', category: 'EENT', emergency: false },
  { complaint: 'Eye Discharge', category: 'EENT', emergency: false },
  { complaint: 'Sudden Vision Loss', category: 'EENT', emergency: true },
  { complaint: 'Eye Trauma', category: 'EENT', emergency: true },

  // Endocrine - Additional
  { complaint: 'Hypoglycemia', category: 'Endocrine', emergency: true },
  { complaint: 'Hyperglycemia', category: 'Endocrine', emergency: true },
  { complaint: 'Thyroid Storm', category: 'Endocrine', emergency: true },
  { complaint: 'Myxedema Coma', category: 'Endocrine', emergency: true },
  { complaint: 'Adrenal Crisis', category: 'Endocrine', emergency: true },
  { complaint: 'Hypercalcemia', category: 'Endocrine', emergency: false },
  { complaint: 'Hyponatremia', category: 'Endocrine', emergency: false },
  { complaint: 'Hyperkalemia', category: 'Endocrine', emergency: true },

  // Hematologic - Additional
  { complaint: 'Anemia', category: 'Hematology', emergency: false },
  { complaint: 'Thrombocytopenia', category: 'Hematology', emergency: false },
  { complaint: 'Leukocytosis', category: 'Hematology', emergency: false },
  { complaint: 'Leukopenia', category: 'Hematology', emergency: false },
  { complaint: 'Splenomegaly', category: 'Hematology', emergency: false },
  { complaint: 'Bleeding Disorder', category: 'Hematology', emergency: false },

  // Infectious Disease - Additional
  { complaint: 'Sepsis', category: 'Infectious Disease', emergency: true },
  { complaint: 'Meningitis Presentation', category: 'Infectious Disease', emergency: true },
  { complaint: 'Encephalitis Presentation', category: 'Infectious Disease', emergency: true },
  {
    complaint: 'Cellulitis/Soft Tissue Infection',
    category: 'Infectious Disease',
    emergency: false,
  },
  { complaint: 'Necrotizing Fasciitis', category: 'Infectious Disease', emergency: true },

  // Psychiatry - Additional
  { complaint: 'Psychosis', category: 'Psychiatry', emergency: true },
  { complaint: 'Mania', category: 'Psychiatry', emergency: false },
  { complaint: 'Panic Attack', category: 'Psychiatry', emergency: false },
  { complaint: 'Eating Disorder', category: 'Psychiatry', emergency: false },
  { complaint: 'Substance Withdrawal', category: 'Psychiatry', emergency: true },
  { complaint: 'Delirium', category: 'Psychiatry', emergency: true },
  { complaint: 'Agitation/Aggression', category: 'Psychiatry', emergency: true },
];

const PROMPT_TEMPLATE = `You are a medical educator creating a comprehensive differential diagnosis guide.

Create DDx content for: {{COMPLAINT}}
Category: {{CATEGORY}}
Is Emergency Chief Complaint: {{IS_EMERGENCY}}

Return valid JSON:
{
  "presentingComplaint": "{{COMPLAINT}}",
  "category": "{{CATEGORY}}",
  "isEmergency": {{IS_EMERGENCY}},
  "differentialList": ["diagnosis1", "diagnosis2", "diagnosis3", "...at least 8-12 diagnoses"],
  "mustNotMiss": ["life-threatening diagnosis 1", "life-threatening diagnosis 2"],
  "workup": "Recommended initial diagnostic approach",
  "byAcuity": {
    "emergent": ["requires immediate workup"],
    "urgent": ["needs same-day evaluation"],
    "nonUrgent": ["can be evaluated outpatient"]
  },
  "byAge": {
    "pediatric": ["diagnoses more common in children"],
    "adult": ["diagnoses common in adults"],
    "geriatric": ["diagnoses more common in elderly"]
  },
  "clinicalPearls": ["pearl1", "pearl2", "pearl3"],
  "commonMistakes": ["mistake1", "mistake2"],
  "diagnosticAlgorithm": "Step-by-step approach to narrowing the differential",
  "dispositionGuidance": "When to admit vs discharge",
  "distinguishingFeatures": {
    "Diagnosis1": "Key features that distinguish this from other DDx",
    "Diagnosis2": "Key features..."
  },
  "initialWorkup": ["CBC", "BMP", "specific test"],
  "isHighYield": true,
  "keyExamFindings": ["finding1", "finding2"],
  "keyQuestions": ["question1", "question2"],
  "mnemonics": ["mnemonic if applicable"],
  "mostCommon": ["most common causes"],
  "mostDangerous": ["most dangerous causes"],
  "oftenMissed": ["commonly overlooked diagnoses"],
  "panceYield": 8,
  "reassuringFeatures": ["features suggesting benign cause"],
  "redFlags": ["warning signs requiring urgent evaluation"],
  "typicalPresentation": "Classic presentation description"
}

Return ONLY valid JSON, no markdown. panceYield is 1-10 scale.`;

async function generateDDx(complaint: {
  complaint: string;
  category: string;
  emergency: boolean;
}): Promise<DDxData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const prompt = PROMPT_TEMPLATE.replace(/{{COMPLAINT}}/g, complaint.complaint)
    .replace(/{{CATEGORY}}/g, complaint.category)
    .replace(/{{IS_EMERGENCY}}/g, String(complaint.emergency));

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    jsonStr = jsonStr
      .trim()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error(`    ⚠️  Error: ${error}`);
    return null;
  }
}

async function main() {
  console.log('🔍 DifferentialDiagnosis Generator');
  console.log('═'.repeat(60));

  const existing = await prisma.differentialDiagnosis.count();
  console.log(`Current DDx entries: ${existing}`);

  // Get existing complaints to avoid duplicates
  const existingDDx = await prisma.differentialDiagnosis.findMany({
    select: { presentingComplaint: true },
  });
  const existingComplaints = new Set(existingDDx.map((d) => d.presentingComplaint.toLowerCase()));

  const toProcess = PRESENTING_COMPLAINTS.filter(
    (c) => !existingComplaints.has(c.complaint.toLowerCase())
  );

  console.log(`Complaints to generate: ${toProcess.length}`);

  let created = 0;
  let failed = 0;

  for (const complaint of toProcess) {
    console.log(`  🔄 [${created + 1}/${toProcess.length}] ${complaint.complaint}...`);

    const data = await generateDDx(complaint);

    if (!data) {
      failed++;
      continue;
    }

    try {
      await prisma.differentialDiagnosis.create({
        data: {
          id: crypto.randomUUID(),
          presentingComplaint: data.presentingComplaint,
          category: data.category,
          isEmergency: data.isEmergency,
          differentialList: data.differentialList || [],
          mustNotMiss: data.mustNotMiss || [],
          workup: data.workup,
          byAcuity: data.byAcuity,
          byAge: data.byAge,
          clinicalPearls: data.clinicalPearls || [],
          commonMistakes: data.commonMistakes || [],
          diagnosticAlgorithm: data.diagnosticAlgorithm,
          dispositionGuidance: data.dispositionGuidance,
          distinguishingFeatures: data.distinguishingFeatures,
          initialWorkup: data.initialWorkup || [],
          isHighYield: data.isHighYield ?? true,
          keyExamFindings: data.keyExamFindings || [],
          keyQuestions: data.keyQuestions || [],
          mnemonics: data.mnemonics || [],
          mostCommon: data.mostCommon || [],
          mostDangerous: data.mostDangerous || [],
          oftenMissed: data.oftenMissed || [],
          panceYield: data.panceYield || 5,
          reassuringFeatures: data.reassuringFeatures || [],
          redFlags: data.redFlags || [],
          typicalPresentation: data.typicalPresentation,
          updatedAt: new Date(),
        },
      });

      existingComplaints.add(complaint.complaint.toLowerCase());
      created++;
      console.log(`    ✅ Created`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`    ⏭️  Already exists`);
      } else {
        console.error(`    ❌ Save failed: ${error}`);
        failed++;
      }
    }

    await new Promise((r) => setTimeout(r, 700));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Failed: ${failed}`);

  const total = await prisma.differentialDiagnosis.count();
  console.log(`   Total in database: ${total}`);

  await prisma.$disconnect();
}

main().catch(console.error);
