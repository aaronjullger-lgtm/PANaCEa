#!/usr/bin/env npx tsx
/**
 * Imaging Study Doctor - PANCE Radiology Generator
 * 
 * Generates imaging study entries - the "what test do you order" questions
 * that are high-yield for PANCE/PANRE.
 * 
 * ImagingStudy Schema:
 *   id, name (unique), modality, bodyRegion?, usesContrast, usesRadiation,
 *   description?, indications[], contraindications[], panceYield?, isHighYield,
 *   boardYieldFacts[], firstLineFor[], advantages[], limitations[], classicSigns[]
 * 
 * Usage:
 *   npx tsx scripts/generators/imaging-study-doctor.ts --dry-run    # Preview
 *   npx tsx scripts/generators/imaging-study-doctor.ts              # Generate
 *   npx tsx scripts/generators/imaging-study-doctor.ts --batch=20   # Process 20 at a time
 *   npx tsx scripts/generators/imaging-study-doctor.ts --analyze    # Show current state
 *   npx tsx scripts/generators/imaging-study-doctor.ts --known-only # Only insert known studies
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

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

// Imaging modalities
type Modality = 'XR' | 'CT' | 'MRI' | 'US' | 'Nuclear' | 'Fluoroscopy' | 'PET' | 'Angiography';

interface KnownStudy {
  name: string;
  modality: Modality;
  bodyRegion: string;
  usesContrast: boolean;
  usesRadiation: boolean;
  description: string;
  indications: string[];
  contraindications: string[];
  panceYield: number; // 1-3
  isHighYield: boolean;
  firstLineFor: string[];
  advantages: string[];
  limitations: string[];
  classicSigns: string[];
  clinicalPearls: string[];
}

// Comprehensive known imaging studies (PANCE high-yield)
const KNOWN_STUDIES: KnownStudy[] = [
  // ========== CHEST X-RAY ==========
  {
    name: 'Chest X-Ray (PA/Lateral)',
    modality: 'XR',
    bodyRegion: 'Chest',
    usesContrast: false,
    usesRadiation: true,
    description: 'Two-view chest radiograph - the most common imaging study',
    indications: ['Cough', 'Dyspnea', 'Chest pain', 'Fever', 'Pneumonia workup', 'Heart failure assessment'],
    contraindications: ['Pregnancy (relative - shield abdomen)'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Pneumonia', 'Heart Failure', 'Pleural Effusion', 'Pneumothorax', 'COPD'],
    advantages: ['Fast', 'Inexpensive', 'Widely available', 'Low radiation'],
    limitations: ['Limited soft tissue detail', 'Cannot detect early infiltrates', '2D projection'],
    classicSigns: ['Kerley B lines (CHF)', 'Silhouette sign', 'Air bronchograms', 'Hampton hump (PE)', 'Westermark sign'],
    clinicalPearls: ['Always check for free air under diaphragm on upright', 'Lateral view sees retrocardiac pathology']
  },
  {
    name: 'Portable Chest X-Ray (AP)',
    modality: 'XR',
    bodyRegion: 'Chest',
    usesContrast: false,
    usesRadiation: true,
    description: 'Single view chest x-ray at bedside - for critically ill patients',
    indications: ['ICU patients', 'Post-intubation tube placement', 'Cannot transport to radiology'],
    contraindications: [],
    panceYield: 2,
    isHighYield: false,
    firstLineFor: ['ET tube confirmation', 'Central line confirmation'],
    advantages: ['Bedside availability', 'Immediate results'],
    limitations: ['AP view magnifies heart', 'Lower image quality', 'Single view only'],
    classicSigns: [],
    clinicalPearls: ['Heart appears enlarged on AP - cannot assess cardiomegaly', 'Tip of ET tube should be 2-4cm above carina']
  },

  // ========== ABDOMINAL IMAGING ==========
  {
    name: 'Abdominal X-Ray (KUB)',
    modality: 'XR',
    bodyRegion: 'Abdomen',
    usesContrast: false,
    usesRadiation: true,
    description: 'Kidneys-Ureters-Bladder plain film',
    indications: ['Abdominal pain', 'Suspected obstruction', 'Constipation', 'Foreign body'],
    contraindications: ['Pregnancy (shield if possible)'],
    panceYield: 2,
    isHighYield: true,
    firstLineFor: ['Small Bowel Obstruction', 'Large Bowel Obstruction', 'Constipation'],
    advantages: ['Fast', 'Inexpensive', 'Shows calcifications', 'Free air detection'],
    limitations: ['Cannot see soft tissue', 'Limited for most pathology'],
    classicSigns: ['Air-fluid levels (obstruction)', 'Dilated bowel loops', 'Free air under diaphragm', 'Coffee bean sign (volvulus)'],
    clinicalPearls: ['90% of kidney stones are radiopaque', 'Only 10-15% of gallstones visible', 'Get upright to see free air']
  },
  {
    name: 'CT Abdomen/Pelvis with IV Contrast',
    modality: 'CT',
    bodyRegion: 'Abdomen/Pelvis',
    usesContrast: true,
    usesRadiation: true,
    description: 'Gold standard for acute abdominal pathology',
    indications: ['Acute abdomen', 'Appendicitis', 'Diverticulitis', 'Abscess', 'Trauma', 'Tumor staging'],
    contraindications: ['Contrast allergy', 'Renal insufficiency (eGFR <30)', 'Pregnancy'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Appendicitis', 'Diverticulitis', 'Abdominal Abscess', 'Pancreatitis complications', 'Bowel Perforation'],
    advantages: ['Excellent soft tissue detail', 'Fast acquisition', 'Multiplanar reconstruction'],
    limitations: ['Radiation exposure', 'Contrast risks', 'Cost'],
    classicSigns: ['Target sign (appendicitis)', 'Dirty fat stranding', 'Free air (perforation)', 'Wall thickening'],
    clinicalPearls: ['Oral contrast rarely needed acutely', 'Consider non-contrast for renal colic']
  },
  {
    name: 'CT Abdomen/Pelvis without Contrast',
    modality: 'CT',
    bodyRegion: 'Abdomen/Pelvis',
    usesContrast: false,
    usesRadiation: true,
    description: 'Non-contrast CT - ideal for urolithiasis',
    indications: ['Renal colic', 'Kidney stones', 'Contrast contraindication'],
    contraindications: ['Pregnancy'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Nephrolithiasis', 'Urolithiasis', 'Renal Colic'],
    advantages: ['No contrast risk', 'Excellent for stones', 'Fast'],
    limitations: ['Limited soft tissue characterization without contrast'],
    classicSigns: ['Hydronephrosis', 'Perinephric stranding', 'Direct stone visualization'],
    clinicalPearls: ['Gold standard for kidney stones', 'Can measure stone size and location for treatment planning']
  },
  {
    name: 'Right Upper Quadrant Ultrasound',
    modality: 'US',
    bodyRegion: 'Abdomen (RUQ)',
    usesContrast: false,
    usesRadiation: false,
    description: 'First-line for biliary and liver pathology',
    indications: ['RUQ pain', 'Jaundice', 'Elevated LFTs', 'Gallbladder disease'],
    contraindications: ['Recent barium study (interferes)', 'Open wounds over area'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Cholelithiasis', 'Cholecystitis', 'Biliary Obstruction', 'Liver mass workup'],
    advantages: ['No radiation', 'Real-time', 'Bedside available', 'Inexpensive'],
    limitations: ['Operator dependent', 'Limited by body habitus/gas', 'Cannot see through bone/air'],
    classicSigns: ['Sonographic Murphy sign', 'Gallbladder wall thickening >3mm', 'Pericholecystic fluid', 'Shadowing stones'],
    clinicalPearls: ['Sonographic Murphy sign is highly specific for cholecystitis', 'CBD >6mm suggests obstruction (>10mm post-cholecystectomy)']
  },
  {
    name: 'Pelvic Ultrasound (Transabdominal)',
    modality: 'US',
    bodyRegion: 'Pelvis',
    usesContrast: false,
    usesRadiation: false,
    description: 'Non-invasive pelvic imaging through full bladder',
    indications: ['Pelvic pain', 'Pregnancy confirmation', 'Uterine/ovarian pathology', 'First trimester evaluation'],
    contraindications: [],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Early pregnancy', 'Ovarian cyst', 'Uterine fibroids'],
    advantages: ['No radiation', 'Safe in pregnancy', 'Real-time'],
    limitations: ['Requires full bladder', 'Limited resolution vs transvaginal'],
    classicSigns: ['Gestational sac', 'Yolk sac', 'Fetal pole'],
    clinicalPearls: ['Combine with transvaginal for complete evaluation', 'First trimester dating most accurate <14 weeks']
  },
  {
    name: 'Transvaginal Ultrasound',
    modality: 'US',
    bodyRegion: 'Pelvis',
    usesContrast: false,
    usesRadiation: false,
    description: 'Higher resolution pelvic imaging - gold standard for early pregnancy',
    indications: ['First trimester pregnancy', 'Ectopic pregnancy workup', 'Adnexal mass', 'Abnormal uterine bleeding'],
    contraindications: ['Patient refusal'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Ectopic Pregnancy', 'Threatened Abortion', 'Ovarian Torsion', 'Polycystic Ovary Syndrome'],
    advantages: ['Higher resolution than transabdominal', 'Empty bladder OK', 'Better ovarian visualization'],
    limitations: ['More invasive', 'Requires patient cooperation'],
    classicSigns: ['Ring of fire (corpus luteum)', 'Tubal ring sign (ectopic)', 'String of pearls (PCOS)', 'Whirlpool sign (torsion)'],
    clinicalPearls: ['Gestational sac visible at β-hCG 1500-2000', 'No IUP with positive β-hCG = ectopic until proven otherwise']
  },
  {
    name: 'FAST Exam (Focused Assessment with Sonography in Trauma)',
    modality: 'US',
    bodyRegion: 'Abdomen/Pelvis/Thorax',
    usesContrast: false,
    usesRadiation: false,
    description: 'Bedside trauma ultrasound for free fluid',
    indications: ['Blunt abdominal trauma', 'Penetrating trauma', 'Hypotensive trauma patient'],
    contraindications: ['None - can be done on anyone'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Trauma evaluation', 'Hemoperitoneum', 'Hemopericardium'],
    advantages: ['Bedside', 'Fast (2-5 minutes)', 'No radiation', 'Repeatable', 'Guides OR vs observation'],
    limitations: ['Cannot quantify bleeding', 'Misses retroperitoneal injury', 'Operator dependent'],
    classicSigns: ['Anechoic stripe in Morrison pouch', 'Pericardial effusion'],
    clinicalPearls: ['Four windows: RUQ, LUQ, Pelvis, Pericardial', 'Positive FAST in unstable patient = OR']
  },

  // ========== HEAD IMAGING ==========
  {
    name: 'CT Head without Contrast',
    modality: 'CT',
    bodyRegion: 'Head',
    usesContrast: false,
    usesRadiation: true,
    description: 'First-line for acute neurologic emergencies',
    indications: ['Acute stroke', 'Head trauma', 'Altered mental status', 'Worst headache of life', 'Focal neurologic deficit'],
    contraindications: ['None in emergency'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Acute Ischemic Stroke', 'Intracranial Hemorrhage', 'Subarachnoid Hemorrhage', 'Traumatic Brain Injury'],
    advantages: ['Fast', 'Excellent for acute blood', 'Widely available', 'No contrast needed'],
    limitations: ['Less sensitive for early ischemia (<6 hours)', 'Poor posterior fossa visualization', 'Radiation'],
    classicSigns: ['Hyperdense MCA sign (clot)', 'Loss of gray-white differentiation', 'Sulcal effacement', 'Midline shift'],
    clinicalPearls: ['ALWAYS non-contrast first for stroke (rule out bleed before tPA)', 'Subarachnoid blood is hyperdense in sulci']
  },
  {
    name: 'MRI Brain with and without Contrast',
    modality: 'MRI',
    bodyRegion: 'Head',
    usesContrast: true,
    usesRadiation: false,
    description: 'Gold standard for brain parenchymal detail',
    indications: ['Brain tumor', 'MS evaluation', 'Seizures', 'Dementia workup', 'Infection'],
    contraindications: ['Pacemaker/defibrillator', 'Cochlear implant', 'Metallic foreign body in eye', 'Claustrophobia'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Brain Tumor', 'Multiple Sclerosis', 'Pituitary adenoma', 'Posterior fossa pathology'],
    advantages: ['Excellent soft tissue contrast', 'No radiation', 'Multiplanar imaging'],
    limitations: ['Time consuming (30-60 min)', 'MRI contraindications', 'Cost', 'Not for acute emergencies'],
    classicSigns: ['Dawson fingers (MS)', 'Ring-enhancing lesion (abscess/tumor)', 'Empty sella', 'Leptomeningeal enhancement'],
    clinicalPearls: ['DWI (diffusion) shows acute stroke within minutes', 'MS lesions perpendicular to ventricles']
  },
  {
    name: 'CT Angiography Head/Neck (CTA)',
    modality: 'CT',
    bodyRegion: 'Head/Neck',
    usesContrast: true,
    usesRadiation: true,
    description: 'Non-invasive vascular imaging of cerebral vessels',
    indications: ['Stroke evaluation', 'Aneurysm', 'Arterial dissection', 'Vasculitis', 'Pre-operative mapping'],
    contraindications: ['Contrast allergy', 'Renal insufficiency'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Large Vessel Occlusion (stroke)', 'Carotid Stenosis', 'Intracranial Aneurysm', 'Vertebral Dissection'],
    advantages: ['Fast', 'Non-invasive', 'Excellent vessel detail'],
    limitations: ['Radiation', 'Contrast risks', 'Cannot assess flow dynamics'],
    classicSigns: ['String sign (dissection)', 'Cut-off sign (occlusion)', 'Aneurysm sac'],
    clinicalPearls: ['Order with stroke workup to identify large vessel occlusion for thrombectomy candidacy']
  },

  // ========== SPINE IMAGING ==========
  {
    name: 'Cervical Spine X-Ray',
    modality: 'XR',
    bodyRegion: 'Cervical Spine',
    usesContrast: false,
    usesRadiation: true,
    description: 'Initial trauma screening - largely replaced by CT',
    indications: ['Neck pain', 'Trauma (low risk)', 'Degenerative disease evaluation'],
    contraindications: [],
    panceYield: 2,
    isHighYield: false,
    firstLineFor: ['Low-risk neck trauma (per NEXUS/CCR)'],
    advantages: ['Low radiation', 'Inexpensive', 'Available'],
    limitations: ['Poor sensitivity for fractures', 'Cannot see soft tissue/disc/cord', 'Often inadequate views'],
    classicSigns: ['Prevertebral swelling', 'Loss of lordosis', 'Widened interspinous distance'],
    clinicalPearls: ['CT has replaced X-ray for trauma in most settings', 'Must visualize C7-T1 junction']
  },
  {
    name: 'CT Cervical Spine',
    modality: 'CT',
    bodyRegion: 'Cervical Spine',
    usesContrast: false,
    usesRadiation: true,
    description: 'Gold standard for cervical spine trauma',
    indications: ['Trauma', 'Fracture evaluation', 'Failed XR visualization'],
    contraindications: ['Pregnancy (relative)'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Cervical Spine Fracture', 'High-risk trauma', 'Unstable patient'],
    advantages: ['Excellent bony detail', 'Fast', 'Multiplanar reconstruction'],
    limitations: ['Cannot assess cord/ligaments', 'Radiation'],
    classicSigns: ['Burst fracture', 'Facet dislocation', 'Hangman fracture', 'Jefferson fracture'],
    clinicalPearls: ['Order CT for any high-risk trauma per NEXUS/CCR criteria', 'Add MRI if neurologic symptoms']
  },
  {
    name: 'MRI Lumbar Spine without Contrast',
    modality: 'MRI',
    bodyRegion: 'Lumbar Spine',
    usesContrast: false,
    usesRadiation: false,
    description: 'Gold standard for disc, nerve, and cord evaluation',
    indications: ['Radiculopathy', 'Back pain with red flags', 'Cauda equina syndrome', 'Suspected disc herniation'],
    contraindications: ['Pacemaker', 'Metallic implants', 'Claustrophobia'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Herniated Disc', 'Spinal Stenosis', 'Cauda Equina Syndrome', 'Epidural Abscess'],
    advantages: ['Excellent soft tissue', 'No radiation', 'Sees disc, nerve, cord'],
    limitations: ['Time consuming', 'MRI contraindications', 'Cost'],
    classicSigns: ['Disc bulge/herniation', 'Nerve root compression', 'Cord compression', 'Modic changes'],
    clinicalPearls: ['Red flags requiring urgent MRI: bowel/bladder symptoms, saddle anesthesia, progressive weakness, infection signs']
  },

  // ========== MUSCULOSKELETAL ==========
  {
    name: 'X-Ray Extremity',
    modality: 'XR',
    bodyRegion: 'Extremity',
    usesContrast: false,
    usesRadiation: true,
    description: 'First-line for fracture and joint evaluation',
    indications: ['Trauma', 'Suspected fracture', 'Joint pain', 'Arthritis evaluation'],
    contraindications: [],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Fracture', 'Dislocation', 'Arthritis', 'Bone tumor'],
    advantages: ['Fast', 'Inexpensive', 'Widely available'],
    limitations: ['Cannot see soft tissue', 'May miss stress fractures', 'Limited for cartilage'],
    classicSigns: ['Cortical break', 'Joint space narrowing', 'Osteophytes', 'Periosteal reaction'],
    clinicalPearls: ['Always get 2 views at 90 degrees', 'Include joint above and below', 'Ottawa rules guide when to image']
  },
  {
    name: 'MRI Knee without Contrast',
    modality: 'MRI',
    bodyRegion: 'Knee',
    usesContrast: false,
    usesRadiation: false,
    description: 'Gold standard for internal knee derangement',
    indications: ['Suspected ACL/meniscus tear', 'Ligament injury', 'Persistent knee pain'],
    contraindications: ['MRI contraindications'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['ACL Tear', 'Meniscus Tear', 'MCL/LCL Tear', 'Osteochondral lesion'],
    advantages: ['Excellent soft tissue', 'No radiation', 'Sees ligaments/menisci/cartilage'],
    limitations: ['Cost', 'Availability', 'MRI contraindications'],
    classicSigns: ['ACL discontinuity', 'Meniscal cleft sign', 'Bone bruise pattern', 'Double PCL sign'],
    clinicalPearls: ['Bone bruise pattern can indicate mechanism - kissing contusions in ACL tear']
  },
  {
    name: 'MRI Shoulder without Contrast',
    modality: 'MRI',
    bodyRegion: 'Shoulder',
    usesContrast: false,
    usesRadiation: false,
    description: 'Evaluation of rotator cuff and labrum',
    indications: ['Rotator cuff tear', 'Labral tear', 'Impingement', 'Instability'],
    contraindications: ['MRI contraindications'],
    panceYield: 2,
    isHighYield: true,
    firstLineFor: ['Rotator Cuff Tear', 'Labral Tear', 'Subacromial Bursitis'],
    advantages: ['Excellent soft tissue', 'No radiation', 'Comprehensive shoulder evaluation'],
    limitations: ['Cost', 'MRI arthrogram better for labrum'],
    classicSigns: ['Full-thickness cuff tear', 'Bankart lesion', 'Hill-Sachs lesion'],
    clinicalPearls: ['MR arthrogram superior for labral pathology', 'Supraspinatus most commonly torn']
  },

  // ========== CARDIOVASCULAR ==========
  {
    name: 'Echocardiogram (Transthoracic/TTE)',
    modality: 'US',
    bodyRegion: 'Heart',
    usesContrast: false,
    usesRadiation: false,
    description: 'First-line cardiac imaging - structure and function',
    indications: ['Heart failure', 'Murmur evaluation', 'Chest pain', 'Dyspnea', 'Valvular disease'],
    contraindications: ['None'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Heart Failure', 'Valvular Heart Disease', 'Pericardial Effusion', 'Cardiomyopathy'],
    advantages: ['No radiation', 'Bedside available', 'Real-time', 'Functional assessment'],
    limitations: ['Operator dependent', 'Limited by body habitus', 'Some structures poorly visualized'],
    classicSigns: ['Reduced EF (<40%)', 'Regurgitant jets', 'Pericardial effusion', 'Wall motion abnormality'],
    clinicalPearls: ['EF <40% = HFrEF, EF ≥50% = HFpEF', 'TEE better for endocarditis vegetations and LA appendage']
  },
  {
    name: 'CT Pulmonary Angiography (CTPA)',
    modality: 'CT',
    bodyRegion: 'Chest',
    usesContrast: true,
    usesRadiation: true,
    description: 'Gold standard for pulmonary embolism',
    indications: ['Suspected PE', 'Dyspnea with elevated D-dimer', 'Hemodynamic instability with RV strain'],
    contraindications: ['Contrast allergy', 'Renal insufficiency', 'Pregnancy (relative)'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Pulmonary Embolism'],
    advantages: ['Fast', 'Definitive diagnosis', 'Can assess clot burden'],
    limitations: ['Radiation', 'Contrast risks', 'May miss subsegmental PE'],
    classicSigns: ['Filling defect in pulmonary artery', 'Saddle embolus', 'RV dilation (>1:1 RV:LV ratio)'],
    clinicalPearls: ['Use Wells criteria first - if low probability, D-dimer can rule out', 'RV strain indicates massive/submassive PE']
  },
  {
    name: 'V/Q Scan (Ventilation/Perfusion)',
    modality: 'Nuclear',
    bodyRegion: 'Chest',
    usesContrast: false,
    usesRadiation: true,
    description: 'Alternative PE evaluation when CT contraindicated',
    indications: ['Suspected PE with contrast allergy', 'Renal insufficiency', 'Pregnancy (lower radiation than CT)'],
    contraindications: ['Severe pulmonary hypertension'],
    panceYield: 2,
    isHighYield: true,
    firstLineFor: ['PE in pregnancy', 'PE with renal failure'],
    advantages: ['No iodinated contrast', 'Lower radiation to fetus than CTPA'],
    limitations: ['Less specific', 'Many indeterminate results', 'Requires normal baseline CXR'],
    classicSigns: ['Mismatched defect (perfusion defect without ventilation defect)'],
    clinicalPearls: ['High probability V/Q = PE, normal V/Q = rules out PE, intermediate requires further testing']
  },
  {
    name: 'Lower Extremity Venous Doppler Ultrasound',
    modality: 'US',
    bodyRegion: 'Lower Extremity',
    usesContrast: false,
    usesRadiation: false,
    description: 'First-line for deep vein thrombosis',
    indications: ['Leg swelling', 'Suspected DVT', 'Calf pain', 'Post-operative DVT screening'],
    contraindications: ['None'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Deep Vein Thrombosis'],
    advantages: ['No radiation', 'Bedside available', 'Real-time compression'],
    limitations: ['Operator dependent', 'Cannot see calf veins well', 'Limited for pelvic DVT'],
    classicSigns: ['Non-compressibility of vein', 'Echogenic clot', 'Absent flow'],
    clinicalPearls: ['Compression is key - normal vein collapses completely', 'If negative but high suspicion, repeat in 5-7 days']
  },

  // ========== GI/HEPATOBILIARY ==========
  {
    name: 'HIDA Scan (Hepatobiliary Iminodiacetic Acid)',
    modality: 'Nuclear',
    bodyRegion: 'Hepatobiliary',
    usesContrast: false,
    usesRadiation: true,
    description: 'Functional gallbladder imaging - gold standard for acute cholecystitis',
    indications: ['Suspected acute cholecystitis with equivocal US', 'Biliary dyskinesia', 'Bile leak'],
    contraindications: ['Severe liver disease', 'Total bilirubin >5'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Acute Cholecystitis (if US equivocal)', 'Biliary Dyskinesia'],
    advantages: ['Functional assessment', 'High sensitivity for cholecystitis'],
    limitations: ['Takes 4+ hours', 'Requires fasting', 'Radiation'],
    classicSigns: ['Non-visualization of gallbladder = positive for cholecystitis', 'Rim sign (severe cholecystitis)'],
    clinicalPearls: ['95% sensitivity for acute cholecystitis', 'CCK-HIDA for biliary dyskinesia - EF <35% abnormal']
  },
  {
    name: 'MRCP (MR Cholangiopancreatography)',
    modality: 'MRI',
    bodyRegion: 'Hepatobiliary',
    usesContrast: false,
    usesRadiation: false,
    description: 'Non-invasive biliary/pancreatic duct imaging',
    indications: ['Choledocholithiasis', 'Biliary obstruction', 'Pancreatitis workup', 'PSC/PBC evaluation'],
    contraindications: ['MRI contraindications'],
    panceYield: 2,
    isHighYield: true,
    firstLineFor: ['Choledocholithiasis', 'Primary Sclerosing Cholangitis', 'Pancreatic duct evaluation'],
    advantages: ['Non-invasive', 'No radiation', 'No contrast', 'Comprehensive biliary imaging'],
    limitations: ['Cannot be therapeutic', 'Cost', 'Time'],
    classicSigns: ['CBD dilation with stone', 'Beading (PSC)', 'Double duct sign (pancreatic cancer)'],
    clinicalPearls: ['ERCP if therapeutic intervention needed', 'MRCP for diagnosis/staging']
  },
  {
    name: 'CT Enterography',
    modality: 'CT',
    bodyRegion: 'Abdomen',
    usesContrast: true,
    usesRadiation: true,
    description: 'Small bowel evaluation with oral contrast distension',
    indications: ['Crohn disease', 'Small bowel tumor', 'GI bleeding source', 'Small bowel obstruction'],
    contraindications: ['Contrast allergy', 'Renal insufficiency'],
    panceYield: 2,
    isHighYield: false,
    firstLineFor: ['Crohn Disease', 'Small bowel tumor'],
    advantages: ['Excellent small bowel visualization', 'Can see transmural disease'],
    limitations: ['Radiation', 'Requires oral contrast preparation'],
    classicSigns: ['Mural enhancement', 'Skip lesions', 'Creeping fat', 'Strictures'],
    clinicalPearls: ['Better than standard CT for inflammatory bowel disease', 'MR enterography preferred in young patients (no radiation)']
  },

  // ========== GENITOURINARY ==========
  {
    name: 'Renal Ultrasound',
    modality: 'US',
    bodyRegion: 'Kidney',
    usesContrast: false,
    usesRadiation: false,
    description: 'First-line renal imaging',
    indications: ['Acute kidney injury', 'Hydronephrosis', 'Renal mass', 'Flank pain'],
    contraindications: ['None'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Hydronephrosis', 'Renal Cyst', 'AKI evaluation'],
    advantages: ['No radiation', 'Bedside available', 'Real-time'],
    limitations: ['Operator dependent', 'May miss small stones', 'Limited for parenchymal disease'],
    classicSigns: ['Hydronephrosis', 'Simple cyst (anechoic, thin wall)', 'Complex cyst (Bosniak)'],
    clinicalPearls: ['Always check for hydronephrosis in AKI', 'US can miss ureteral stones']
  },
  {
    name: 'Scrotal Ultrasound with Doppler',
    modality: 'US',
    bodyRegion: 'Scrotum',
    usesContrast: false,
    usesRadiation: false,
    description: 'First-line for testicular pathology',
    indications: ['Testicular pain', 'Scrotal swelling', 'Suspected torsion', 'Testicular mass'],
    contraindications: ['None'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Testicular Torsion', 'Epididymitis', 'Testicular Cancer', 'Hydrocele'],
    advantages: ['No radiation', 'Real-time', 'Doppler for blood flow'],
    limitations: ['Operator dependent'],
    classicSigns: ['Absent flow (torsion)', 'Increased flow (epididymitis)', 'Hypoechoic mass (cancer)', 'Whirlpool sign (torsion)'],
    clinicalPearls: ['SURGICAL EMERGENCY: No flow + high clinical suspicion = OR without delay', 'Torsion is clinical diagnosis - do not delay surgery for imaging']
  },

  // ========== OBSTETRIC ==========
  {
    name: 'First Trimester Ultrasound',
    modality: 'US',
    bodyRegion: 'Pelvis',
    usesContrast: false,
    usesRadiation: false,
    description: 'Dating and viability ultrasound',
    indications: ['Pregnancy confirmation', 'Dating', 'Viability', 'Ectopic pregnancy workup'],
    contraindications: ['None'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Early pregnancy confirmation', 'Ectopic pregnancy', 'Dating'],
    advantages: ['Safe', 'Accurate dating', 'Real-time'],
    limitations: ['Limited anatomy evaluation early'],
    classicSigns: ['Gestational sac (5 weeks)', 'Yolk sac (5.5 weeks)', 'Fetal pole + cardiac activity (6 weeks)'],
    clinicalPearls: ['CRL most accurate dating <14 weeks', 'No embryo with mean sac diameter >25mm = pregnancy failure']
  },
  {
    name: 'Anatomy Ultrasound (18-22 weeks)',
    modality: 'US',
    bodyRegion: 'Abdomen/Pelvis',
    usesContrast: false,
    usesRadiation: false,
    description: 'Detailed fetal anatomy survey',
    indications: ['Routine prenatal care', 'Anomaly screening', 'Placental location'],
    contraindications: ['None'],
    panceYield: 2,
    isHighYield: true,
    firstLineFor: ['Fetal anomaly screening', 'Placenta previa evaluation'],
    advantages: ['Comprehensive fetal evaluation', 'Safe', 'No radiation'],
    limitations: ['Maternal habitus', 'Fetal position'],
    classicSigns: ['Lemon sign (neural tube defect)', 'Double bubble (duodenal atresia)', 'Echogenic bowel'],
    clinicalPearls: ['Best window 18-22 weeks for anatomy', 'Low-lying placenta often resolves by third trimester']
  },

  // ========== THYROID/NECK ==========
  {
    name: 'Thyroid Ultrasound',
    modality: 'US',
    bodyRegion: 'Neck',
    usesContrast: false,
    usesRadiation: false,
    description: 'First-line for thyroid nodule evaluation',
    indications: ['Thyroid nodule', 'Goiter', 'Abnormal thyroid function', 'Neck mass'],
    contraindications: ['None'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Thyroid Nodule', 'Goiter', 'Thyroid Cancer screening'],
    advantages: ['No radiation', 'Real-time', 'Can guide FNA'],
    limitations: ['Cannot assess function', 'Substernal extension limited'],
    classicSigns: ['TI-RADS criteria', 'Microcalcifications (cancer)', 'Hypoechoic nodule', 'Irregular margins'],
    clinicalPearls: ['ACR TI-RADS guides FNA decision', 'Microcalcifications highly suspicious for papillary cancer']
  },

  // ========== BREAST ==========
  {
    name: 'Mammogram (Screening)',
    modality: 'XR',
    bodyRegion: 'Breast',
    usesContrast: false,
    usesRadiation: true,
    description: 'Breast cancer screening',
    indications: ['Screening (age 40-50+ depending on guidelines)', 'Family history'],
    contraindications: ['Pregnancy', 'Breast implants (relative)'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Breast Cancer Screening'],
    advantages: ['Proven mortality reduction', 'Can detect early cancer', 'Microcalcifications'],
    limitations: ['Less sensitive in dense breasts', 'Radiation', 'False positives'],
    classicSigns: ['Spiculated mass', 'Microcalcifications', 'Architectural distortion'],
    clinicalPearls: ['BI-RADS categories guide management', 'Dense breasts may need supplemental screening (US or MRI)']
  },
  {
    name: 'Breast Ultrasound',
    modality: 'US',
    bodyRegion: 'Breast',
    usesContrast: false,
    usesRadiation: false,
    description: 'Adjunct to mammography or first-line for palpable mass',
    indications: ['Palpable mass', 'Mammographic abnormality workup', 'Dense breasts', 'Young patients'],
    contraindications: ['None'],
    panceYield: 2,
    isHighYield: true,
    firstLineFor: ['Palpable breast mass in young women', 'Cyst vs solid differentiation'],
    advantages: ['No radiation', 'Real-time', 'Can differentiate cyst vs solid'],
    limitations: ['Cannot see microcalcifications', 'Operator dependent'],
    classicSigns: ['Simple cyst (anechoic)', 'Solid mass features', 'Posterior acoustic shadowing'],
    clinicalPearls: ['US first in women <30 with palpable mass', 'Can guide biopsy']
  },

  // ========== BONE/NUCLEAR ==========
  {
    name: 'Bone Scan (Technetium-99m)',
    modality: 'Nuclear',
    bodyRegion: 'Whole Body',
    usesContrast: false,
    usesRadiation: true,
    description: 'Whole body skeletal survey for metastases',
    indications: ['Cancer staging', 'Occult fracture', 'Osteomyelitis', 'Paget disease'],
    contraindications: ['Pregnancy'],
    panceYield: 2,
    isHighYield: false,
    firstLineFor: ['Bone metastases staging', 'Occult stress fracture'],
    advantages: ['Whole body in one study', 'Very sensitive for bone turnover'],
    limitations: ['Not specific', 'Cannot distinguish benign from malignant', '24-72 hour delay'],
    classicSigns: ['Hot spots (increased uptake)', 'Superscan (diffuse metastases)', 'Cold spots (avascular)'],
    clinicalPearls: ['Positive 2-3 days after fracture', 'Prostate cancer shows hot spots, myeloma may be cold']
  },
  {
    name: 'DEXA Scan (Bone Density)',
    modality: 'XR',
    bodyRegion: 'Spine/Hip',
    usesContrast: false,
    usesRadiation: true,
    description: 'Bone mineral density measurement for osteoporosis',
    indications: ['Osteoporosis screening', 'Fracture risk assessment', 'Treatment monitoring'],
    contraindications: ['Recent barium/contrast'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['Osteoporosis diagnosis'],
    advantages: ['Low radiation', 'Quantitative measurement', 'Reproducible'],
    limitations: ['Does not assess bone quality', 'Artifacts from spinal hardware'],
    classicSigns: ['T-score interpretation'],
    clinicalPearls: ['T-score ≤-2.5 = osteoporosis, -1 to -2.5 = osteopenia', 'Screen women ≥65, men ≥70']
  },

  // ========== INTERVENTIONAL/ANGIOGRAPHY ==========
  {
    name: 'Coronary Angiography (Cardiac Catheterization)',
    modality: 'Angiography',
    bodyRegion: 'Heart',
    usesContrast: true,
    usesRadiation: true,
    description: 'Gold standard for coronary artery disease - diagnostic and therapeutic',
    indications: ['STEMI', 'NSTEMI', 'Unstable angina', 'Positive stress test', 'Pre-operative evaluation'],
    contraindications: ['Contrast allergy (premedicate)', 'Coagulopathy', 'Active bleeding'],
    panceYield: 3,
    isHighYield: true,
    firstLineFor: ['STEMI (primary PCI)', 'Coronary Artery Disease diagnosis'],
    advantages: ['Definitive diagnosis', 'Can treat (PCI/stent) at same time', 'Hemodynamic assessment'],
    limitations: ['Invasive', 'Contrast/radiation', 'Vascular complications', 'Cost'],
    classicSigns: ['Stenosis percentage', 'TIMI flow grade', 'Collateral vessels'],
    clinicalPearls: ['Door-to-balloon <90 minutes for STEMI', 'Left main or 3-vessel disease may need CABG']
  },

  // ========== PET ==========
  {
    name: 'PET-CT (FDG)',
    modality: 'PET',
    bodyRegion: 'Whole Body',
    usesContrast: false,
    usesRadiation: true,
    description: 'Metabolic imaging for cancer staging and monitoring',
    indications: ['Cancer staging', 'Treatment response', 'Unknown primary tumor', 'Lymphoma'],
    contraindications: ['Pregnancy', 'Uncontrolled diabetes (affects uptake)'],
    panceYield: 2,
    isHighYield: false,
    firstLineFor: ['Lymphoma staging', 'Lung cancer staging', 'Unknown primary tumor'],
    advantages: ['Functional/metabolic information', 'Whole body staging', 'Treatment response'],
    limitations: ['Cost', 'Availability', 'False positives with inflammation', 'Radiation'],
    classicSigns: ['Increased FDG uptake (SUV)', 'Treatment response (decreased uptake)'],
    clinicalPearls: ['Not for initial diagnosis - for staging/monitoring', 'Patient must fast, glucose <200']
  }
];

// AI Generation
async function generateAIStudies(conditions: string[]): Promise<KnownStudy[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('  ⚠️ No GEMINI_API_KEY - skipping AI generation');
    return [];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  await rateLimiter.acquire();

  const prompt = `You are a PA educator specializing in PANCE preparation. Given these conditions: ${conditions.join(', ')}

Generate imaging studies that are FIRST-LINE or GOLD STANDARD for these conditions. Focus on:
- Studies commonly tested on PANCE
- Clear indications and contraindications
- Classic radiologic signs
- Clinical pearls for test-taking

For each study, provide:
- name: Specific study name (e.g., "CT Head without Contrast")
- modality: XR, CT, MRI, US, Nuclear, Fluoroscopy, PET, or Angiography
- bodyRegion: Anatomic region
- usesContrast: boolean
- usesRadiation: boolean
- description: Brief description
- indications: Array of when to order
- contraindications: Array of when NOT to order
- panceYield: 1-3 (3 = high yield)
- isHighYield: boolean
- firstLineFor: Conditions where this is first-line
- advantages: Why choose this study
- limitations: Drawbacks
- classicSigns: Named radiologic signs
- clinicalPearls: Test-taking tips

Return JSON: { "studies": [...] }

Generate only studies not already in common use. Focus on less common but still PANCE-relevant studies.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text);
    return data.studies || [];
  } catch (error) {
    console.log('  ⚠️ AI generation failed:', error);
    return [];
  }
}

// Helper to ensure array fields are arrays
function ensureArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string') return [value];
  return [];
}

async function insertStudy(study: KnownStudy): Promise<boolean> {
  try {
    // Normalize all array fields
    const indications = ensureArray(study.indications);
    const contraindications = ensureArray(study.contraindications);
    const firstLineFor = ensureArray(study.firstLineFor);
    const advantages = ensureArray(study.advantages);
    const limitations = ensureArray(study.limitations);
    const classicSigns = ensureArray(study.classicSigns);
    const clinicalPearls = ensureArray(study.clinicalPearls);

    await prisma.imagingStudy.upsert({
      where: { name: study.name },
      create: {
        name: study.name,
        modality: study.modality,
        bodyRegion: study.bodyRegion || null,
        usesContrast: study.usesContrast ?? false,
        usesRadiation: study.usesRadiation ?? false,
        description: study.description || null,
        indications,
        contraindications,
        panceYield: study.panceYield,
        isHighYield: study.isHighYield ?? false,
        firstLineFor,
        advantages,
        limitations,
        classicSigns,
        clinicalPearls
      },
      update: {
        modality: study.modality,
        bodyRegion: study.bodyRegion || null,
        usesContrast: study.usesContrast ?? false,
        usesRadiation: study.usesRadiation ?? false,
        description: study.description || null,
        indications,
        contraindications,
        panceYield: study.panceYield,
        isHighYield: study.isHighYield ?? false,
        firstLineFor,
        advantages,
        limitations,
        classicSigns,
        clinicalPearls
      }
    });
    return true;
  } catch (error: any) {
    if (error.code === 'P2002') {
      return false; // Duplicate
    }
    console.error(`    Error inserting ${study.name}:`, error.message);
    return false;
  }
}

async function analyzeState() {
  console.log('\n📊 Analyzing Current State\n');

  const totalStudies = await prisma.imagingStudy.count();
  console.log(`  Total Imaging Studies: ${totalStudies}`);

  const byModality = await prisma.imagingStudy.groupBy({
    by: ['modality'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  console.log(`\n  Studies by Modality:`);
  for (const group of byModality) {
    console.log(`    ${group.modality}: ${group._count.id}`);
  }

  const byRegion = await prisma.imagingStudy.groupBy({
    by: ['bodyRegion'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  console.log(`\n  Studies by Body Region:`);
  for (const group of byRegion.slice(0, 10)) {
    console.log(`    ${group.bodyRegion || 'Unspecified'}: ${group._count.id}`);
  }

  const highYield = await prisma.imagingStudy.count({ where: { isHighYield: true } });
  console.log(`\n  High-Yield Studies: ${highYield}`);

  const recentStudies = await prisma.imagingStudy.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { name: true, modality: true, isHighYield: true }
  });

  console.log(`\n  Recent Studies:`);
  for (const study of recentStudies) {
    const marker = study.isHighYield ? '⭐' : '  ';
    console.log(`    ${marker} ${study.name} (${study.modality})`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const analyzeOnly = args.includes('--analyze');
  const knownOnly = args.includes('--known-only');
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 15;

  console.log('\n🏥 Imaging Study Doctor - PANCE Radiology Generator\n');

  if (analyzeOnly) {
    await analyzeState();
    await prisma.$disconnect();
    return;
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No database changes\n');
  }

  // Phase 1: Insert known studies
  console.log('📚 Phase 1: Inserting Known Imaging Studies\n');
  console.log(`  Found ${KNOWN_STUDIES.length} known imaging studies`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const study of KNOWN_STUDIES) {
    if (isDryRun) {
      console.log(`  Would insert: ${study.name} (${study.modality})`);
      inserted++;
    } else {
      const existed = await prisma.imagingStudy.findUnique({ where: { name: study.name } });
      const success = await insertStudy(study);
      if (success) {
        if (existed) {
          updated++;
        } else {
          inserted++;
        }
        console.log(`  ✅ ${study.name} (${study.modality})`);
      } else {
        skipped++;
      }
    }
  }

  console.log(`\n  Summary: ${inserted} inserted, ${updated} updated, ${skipped} skipped\n`);

  if (knownOnly) {
    console.log('📈 FINAL STATE:\n');
    await analyzeState();
    await prisma.$disconnect();
    console.log('\n✨ Imaging Study Doctor complete (known only)!\n');
    return;
  }

  // Phase 2: AI Generation for conditions without imaging coverage
  console.log('🤖 Phase 2: AI-Assisted Study Generation\n');

  // Get conditions that might benefit from imaging studies
  const conditions = await prisma.condition.findMany({
    where: {
      system: {
        in: ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'GU', 'REPRO', 'HEENT', 'ENDO', 'HEME']
      }
    },
    select: { name: true, system: true }
  });

  console.log(`  Processing ${conditions.length} conditions for additional imaging studies\n`);

  const conditionNames = conditions.map(c => c.name);
  const totalBatches = Math.ceil(conditionNames.length / batchSize);
  let aiInserted = 0;
  let aiSkipped = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batch = conditionNames.slice(i * batchSize, (i + 1) * batchSize);
    console.log(`  Processing batch ${i + 1}/${totalBatches} (${batch.length} conditions)...`);

    if (isDryRun) {
      console.log(`    Would generate AI studies for: ${batch.slice(0, 3).join(', ')}...`);
      continue;
    }

    const aiStudies = await generateAIStudies(batch);
    
    if (aiStudies.length > 0) {
      console.log(`    AI generated ${aiStudies.length} study candidates`);
      
      for (const study of aiStudies) {
        // Validate required fields
        if (!study.name || !study.modality) continue;
        
        const success = await insertStudy(study);
        if (success) {
          aiInserted++;
          console.log(`    ✅ ${study.name}`);
        } else {
          aiSkipped++;
        }
      }
    }
  }

  console.log(`\n  Summary: ${aiInserted} inserted, ${aiSkipped} skipped (duplicates)\n`);

  console.log('📈 FINAL STATE:\n');
  await analyzeState();

  await prisma.$disconnect();
  console.log('\n✨ Imaging Study Doctor complete!\n');
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
