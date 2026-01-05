#!/usr/bin/env npx tsx
/**
 * First-Line Treatment Doctor - PANCE Treatment Generator
 * 
 * Generates first-line treatments for conditions - the "what do you do first" 
 * question type that's extremely high-yield for PANCE/PANRE.
 * 
 * FirstLineTreatment Schema:
 *   id, condition (string), treatment (string), category (string), createdAt, updatedAt
 * 
 * Usage:
 *   npx tsx scripts/generators/first-line-treatment-doctor.ts --dry-run    # Preview
 *   npx tsx scripts/generators/first-line-treatment-doctor.ts              # Generate
 *   npx tsx scripts/generators/first-line-treatment-doctor.ts --batch=20   # Process 20 at a time
 *   npx tsx scripts/generators/first-line-treatment-doctor.ts --analyze    # Show current state
 *   npx tsx scripts/generators/first-line-treatment-doctor.ts --known-only # Only insert known treatments
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

// Treatment categories
type TreatmentCategory = 
  | 'Pharmacological'
  | 'Surgical'
  | 'Procedural'
  | 'Supportive'
  | 'Behavioral'
  | 'Observation'
  | 'Emergency'
  | 'Preventive';

// Known first-line treatments (high-yield, board-tested)
const KNOWN_FIRST_LINE: Record<string, Array<{ treatment: string; category: TreatmentCategory }>> = {
  // CARDIOLOGY
  'Acute Coronary Syndrome': [
    { treatment: 'Aspirin 325mg', category: 'Pharmacological' },
    { treatment: 'Dual antiplatelet therapy (Aspirin + P2Y12 inhibitor)', category: 'Pharmacological' },
  ],
  'STEMI': [
    { treatment: 'Primary PCI (within 90 minutes door-to-balloon)', category: 'Procedural' },
    { treatment: 'Fibrinolytics (if PCI unavailable within 120 min)', category: 'Pharmacological' },
  ],
  'NSTEMI': [
    { treatment: 'Anticoagulation + early invasive strategy (cath within 24-72h)', category: 'Procedural' },
  ],
  'Unstable Angina': [
    { treatment: 'Anticoagulation + risk stratification for intervention', category: 'Pharmacological' },
  ],
  'Stable Angina': [
    { treatment: 'Beta-blocker or calcium channel blocker', category: 'Pharmacological' },
    { treatment: 'Sublingual nitroglycerin PRN', category: 'Pharmacological' },
  ],
  'Atrial Fibrillation': [
    { treatment: 'Rate control with beta-blocker or calcium channel blocker', category: 'Pharmacological' },
    { treatment: 'Anticoagulation based on CHA2DS2-VASc score', category: 'Pharmacological' },
  ],
  'Atrial Flutter': [
    { treatment: 'Rate control with beta-blocker or diltiazem', category: 'Pharmacological' },
    { treatment: 'Anticoagulation (same as AFib)', category: 'Pharmacological' },
  ],
  'SVT (AVNRT)': [
    { treatment: 'Vagal maneuvers (Valsalva, carotid massage)', category: 'Procedural' },
    { treatment: 'Adenosine 6mg IV push (can repeat 12mg)', category: 'Pharmacological' },
  ],
  'Ventricular Tachycardia (Stable)': [
    { treatment: 'Amiodarone IV', category: 'Pharmacological' },
  ],
  'Ventricular Tachycardia (Unstable)': [
    { treatment: 'Synchronized cardioversion', category: 'Emergency' },
  ],
  'Ventricular Fibrillation': [
    { treatment: 'Defibrillation + CPR + Epinephrine', category: 'Emergency' },
  ],
  'Heart Failure (HFrEF)': [
    { treatment: 'GDMT: ACE-I/ARB/ARNI + Beta-blocker + MRA + SGLT2i', category: 'Pharmacological' },
    { treatment: 'Loop diuretic for volume overload', category: 'Pharmacological' },
  ],
  'Heart Failure (HFpEF)': [
    { treatment: 'Diuretics for volume overload', category: 'Pharmacological' },
    { treatment: 'SGLT2 inhibitor', category: 'Pharmacological' },
  ],
  'Hypertensive Emergency': [
    { treatment: 'IV antihypertensive (nicardipine, labetalol, nitroprusside)', category: 'Emergency' },
  ],
  'Hypertensive Urgency': [
    { treatment: 'Oral antihypertensive (restart or intensify)', category: 'Pharmacological' },
  ],
  'Essential Hypertension': [
    { treatment: 'ACE-I or ARB (especially with diabetes or CKD)', category: 'Pharmacological' },
    { treatment: 'Thiazide diuretic or CCB as alternatives', category: 'Pharmacological' },
  ],
  'Aortic Dissection': [
    { treatment: 'IV beta-blocker to lower HR <60 and SBP <120', category: 'Emergency' },
    { treatment: 'Emergent surgical repair (Type A)', category: 'Surgical' },
  ],
  'Cardiac Tamponade': [
    { treatment: 'Pericardiocentesis', category: 'Emergency' },
  ],
  'Pericarditis': [
    { treatment: 'NSAIDs + Colchicine', category: 'Pharmacological' },
  ],
  'Infective Endocarditis': [
    { treatment: 'Empiric IV antibiotics (vanc + ceftriaxone)', category: 'Pharmacological' },
  ],
  
  // PULMONOLOGY
  'Asthma (Acute Exacerbation)': [
    { treatment: 'Short-acting beta-agonist (albuterol)', category: 'Pharmacological' },
    { treatment: 'Systemic corticosteroids', category: 'Pharmacological' },
  ],
  'Asthma (Maintenance)': [
    { treatment: 'Inhaled corticosteroid (ICS)', category: 'Pharmacological' },
    { treatment: 'LABA added to ICS for moderate-severe', category: 'Pharmacological' },
  ],
  'COPD (Acute Exacerbation)': [
    { treatment: 'Short-acting bronchodilators (albuterol + ipratropium)', category: 'Pharmacological' },
    { treatment: 'Systemic corticosteroids x 5 days', category: 'Pharmacological' },
    { treatment: 'Antibiotics if purulent sputum', category: 'Pharmacological' },
  ],
  'COPD (Maintenance)': [
    { treatment: 'Long-acting bronchodilator (LAMA or LABA)', category: 'Pharmacological' },
    { treatment: 'ICS added for frequent exacerbations', category: 'Pharmacological' },
  ],
  'Community-Acquired Pneumonia': [
    { treatment: 'Outpatient: Amoxicillin or doxycycline or macrolide', category: 'Pharmacological' },
    { treatment: 'Inpatient: Beta-lactam + macrolide OR respiratory FQ', category: 'Pharmacological' },
  ],
  'Hospital-Acquired Pneumonia': [
    { treatment: 'Anti-pseudomonal coverage (piperacillin-tazobactam)', category: 'Pharmacological' },
    { treatment: 'MRSA coverage if risk factors (vancomycin)', category: 'Pharmacological' },
  ],
  'Pulmonary Embolism': [
    { treatment: 'Anticoagulation (DOAC preferred if stable)', category: 'Pharmacological' },
    { treatment: 'Thrombolysis if massive/unstable', category: 'Emergency' },
  ],
  'Tension Pneumothorax': [
    { treatment: 'Needle decompression (2nd ICS, midclavicular)', category: 'Emergency' },
    { treatment: 'Chest tube placement', category: 'Procedural' },
  ],
  'Spontaneous Pneumothorax': [
    { treatment: 'Small/stable: Observation + supplemental O2', category: 'Observation' },
    { treatment: 'Large/symptomatic: Chest tube or needle aspiration', category: 'Procedural' },
  ],
  'Pleural Effusion': [
    { treatment: 'Thoracentesis (diagnostic and/or therapeutic)', category: 'Procedural' },
  ],
  
  // GASTROENTEROLOGY
  'GERD': [
    { treatment: 'Proton pump inhibitor (omeprazole, etc.)', category: 'Pharmacological' },
    { treatment: 'Lifestyle modifications', category: 'Behavioral' },
  ],
  'Peptic Ulcer Disease': [
    { treatment: 'PPI + H. pylori eradication if positive', category: 'Pharmacological' },
  ],
  'H. pylori Infection': [
    { treatment: 'Triple therapy: PPI + clarithromycin + amoxicillin x 14 days', category: 'Pharmacological' },
  ],
  'Acute Pancreatitis': [
    { treatment: 'Aggressive IV fluid resuscitation', category: 'Supportive' },
    { treatment: 'NPO, pain control, supportive care', category: 'Supportive' },
  ],
  'Acute Cholecystitis': [
    { treatment: 'Cholecystectomy (within 72 hours preferred)', category: 'Surgical' },
    { treatment: 'IV antibiotics if infection', category: 'Pharmacological' },
  ],
  'Choledocholithiasis': [
    { treatment: 'ERCP for stone removal', category: 'Procedural' },
  ],
  'Acute Appendicitis': [
    { treatment: 'Appendectomy', category: 'Surgical' },
  ],
  'Small Bowel Obstruction': [
    { treatment: 'NPO, NG tube decompression, IV fluids', category: 'Supportive' },
    { treatment: 'Surgery if signs of strangulation or no improvement', category: 'Surgical' },
  ],
  'Upper GI Bleed': [
    { treatment: 'IV PPI bolus then infusion', category: 'Pharmacological' },
    { treatment: 'Urgent EGD within 24 hours', category: 'Procedural' },
  ],
  'Variceal Bleeding': [
    { treatment: 'Octreotide + IV PPI + antibiotics', category: 'Pharmacological' },
    { treatment: 'Urgent endoscopic band ligation', category: 'Procedural' },
  ],
  'Hepatic Encephalopathy': [
    { treatment: 'Lactulose (goal: 2-3 BM/day)', category: 'Pharmacological' },
    { treatment: 'Rifaximin if recurrent', category: 'Pharmacological' },
  ],
  'Spontaneous Bacterial Peritonitis': [
    { treatment: 'Ceftriaxone or fluoroquinolone', category: 'Pharmacological' },
  ],
  'Ulcerative Colitis (Acute Flare)': [
    { treatment: 'Oral or IV corticosteroids', category: 'Pharmacological' },
    { treatment: '5-ASA (mesalamine) for mild-moderate', category: 'Pharmacological' },
  ],
  'Crohn\'s Disease (Acute Flare)': [
    { treatment: 'Corticosteroids for moderate-severe', category: 'Pharmacological' },
    { treatment: 'Biologics (anti-TNF) for steroid-refractory', category: 'Pharmacological' },
  ],
  'Clostridioides difficile Infection': [
    { treatment: 'Fidaxomicin or oral vancomycin', category: 'Pharmacological' },
  ],
  
  // ENDOCRINOLOGY
  'Diabetic Ketoacidosis': [
    { treatment: 'IV fluids (NS initially) + IV insulin + K+ replacement', category: 'Emergency' },
  ],
  'Hyperosmolar Hyperglycemic State': [
    { treatment: 'Aggressive IV fluid resuscitation + insulin', category: 'Emergency' },
  ],
  'Type 2 Diabetes': [
    { treatment: 'Metformin (first-line for most patients)', category: 'Pharmacological' },
    { treatment: 'SGLT2i or GLP-1 RA if CVD or CKD', category: 'Pharmacological' },
  ],
  'Type 1 Diabetes': [
    { treatment: 'Basal-bolus insulin regimen', category: 'Pharmacological' },
  ],
  'Hypothyroidism': [
    { treatment: 'Levothyroxine', category: 'Pharmacological' },
  ],
  'Hyperthyroidism (Graves\' Disease)': [
    { treatment: 'Methimazole (PTU if pregnant in 1st trimester)', category: 'Pharmacological' },
    { treatment: 'Beta-blocker for symptom control', category: 'Pharmacological' },
  ],
  'Thyroid Storm': [
    { treatment: 'Beta-blocker + PTU + iodine (1h after PTU) + corticosteroids', category: 'Emergency' },
  ],
  'Myxedema Coma': [
    { treatment: 'IV levothyroxine + IV hydrocortisone', category: 'Emergency' },
  ],
  'Adrenal Crisis': [
    { treatment: 'IV hydrocortisone 100mg bolus + aggressive IV fluids', category: 'Emergency' },
  ],
  'Addison\'s Disease': [
    { treatment: 'Hydrocortisone + fludrocortisone replacement', category: 'Pharmacological' },
  ],
  'Cushing\'s Syndrome': [
    { treatment: 'Surgical resection of tumor (pituitary, adrenal, ectopic)', category: 'Surgical' },
  ],
  'Hypercalcemia': [
    { treatment: 'IV saline hydration + loop diuretic (after hydration)', category: 'Pharmacological' },
    { treatment: 'Bisphosphonate if malignancy-related', category: 'Pharmacological' },
  ],
  'Primary Hyperparathyroidism': [
    { treatment: 'Parathyroidectomy (surgical)', category: 'Surgical' },
  ],
  'Pheochromocytoma': [
    { treatment: 'Alpha-blockade BEFORE beta-blockade', category: 'Pharmacological' },
    { treatment: 'Surgical resection', category: 'Surgical' },
  ],
  
  // INFECTIOUS DISEASE
  'Bacterial Meningitis': [
    { treatment: 'Empiric: Vancomycin + ceftriaxone + dexamethasone', category: 'Emergency' },
  ],
  'Viral Meningitis': [
    { treatment: 'Supportive care', category: 'Supportive' },
  ],
  'Sepsis': [
    { treatment: 'IV fluids (30 mL/kg crystalloid) + broad-spectrum antibiotics within 1 hour', category: 'Emergency' },
  ],
  'Septic Shock': [
    { treatment: 'Fluids + antibiotics + vasopressors (norepinephrine first-line)', category: 'Emergency' },
  ],
  'Cellulitis': [
    { treatment: 'Cephalexin or dicloxacillin (non-purulent)', category: 'Pharmacological' },
    { treatment: 'TMP-SMX or doxycycline (purulent/MRSA risk)', category: 'Pharmacological' },
  ],
  'Necrotizing Fasciitis': [
    { treatment: 'Emergent surgical debridement + broad-spectrum IV antibiotics', category: 'Emergency' },
  ],
  'Urinary Tract Infection (Uncomplicated)': [
    { treatment: 'Nitrofurantoin x 5 days or TMP-SMX x 3 days', category: 'Pharmacological' },
  ],
  'Pyelonephritis': [
    { treatment: 'Fluoroquinolone or ceftriaxone', category: 'Pharmacological' },
  ],
  'HIV (Initial Treatment)': [
    { treatment: 'Two NRTIs + integrase inhibitor (bictegravir/TAF/FTC preferred)', category: 'Pharmacological' },
  ],
  'Tuberculosis (Active)': [
    { treatment: 'RIPE therapy x 2 months, then INH + rifampin x 4 months', category: 'Pharmacological' },
  ],
  'Latent TB': [
    { treatment: 'INH x 9 months or rifampin x 4 months', category: 'Pharmacological' },
  ],
  'Influenza': [
    { treatment: 'Oseltamivir (Tamiflu) within 48 hours', category: 'Pharmacological' },
  ],
  'COVID-19 (Mild)': [
    { treatment: 'Supportive care ± Paxlovid if high risk', category: 'Pharmacological' },
  ],
  'COVID-19 (Hospitalized)': [
    { treatment: 'Dexamethasone + remdesivir', category: 'Pharmacological' },
  ],
  'Herpes Zoster': [
    { treatment: 'Valacyclovir or acyclovir within 72 hours', category: 'Pharmacological' },
  ],
  
  // NEUROLOGY
  'Acute Ischemic Stroke': [
    { treatment: 'IV tPA (within 4.5 hours) or thrombectomy (within 24h for LVO)', category: 'Emergency' },
  ],
  'TIA': [
    { treatment: 'Antiplatelet therapy (aspirin or dual antiplatelet if high risk)', category: 'Pharmacological' },
    { treatment: 'Statin therapy', category: 'Pharmacological' },
  ],
  'Intracerebral Hemorrhage': [
    { treatment: 'Blood pressure control (target SBP <140)', category: 'Pharmacological' },
    { treatment: 'Reverse anticoagulation if applicable', category: 'Emergency' },
  ],
  'Subarachnoid Hemorrhage': [
    { treatment: 'Nimodipine (prevent vasospasm) + secure aneurysm (coil/clip)', category: 'Emergency' },
  ],
  'Status Epilepticus': [
    { treatment: 'Benzodiazepine (lorazepam IV or midazolam IM)', category: 'Emergency' },
    { treatment: 'Fosphenytoin or levetiracetam if seizures persist', category: 'Emergency' },
  ],
  'Epilepsy (New Onset)': [
    { treatment: 'Levetiracetam or lamotrigine', category: 'Pharmacological' },
  ],
  'Migraine (Acute)': [
    { treatment: 'Triptan (sumatriptan) or NSAID', category: 'Pharmacological' },
  ],
  'Migraine (Prophylaxis)': [
    { treatment: 'Topiramate, propranolol, or amitriptyline', category: 'Pharmacological' },
    { treatment: 'CGRP inhibitor for refractory cases', category: 'Pharmacological' },
  ],
  'Multiple Sclerosis (Acute Flare)': [
    { treatment: 'IV methylprednisolone x 3-5 days', category: 'Pharmacological' },
  ],
  'Multiple Sclerosis (Maintenance)': [
    { treatment: 'Disease-modifying therapy (interferon, glatiramer, or newer agents)', category: 'Pharmacological' },
  ],
  'Parkinson\'s Disease': [
    { treatment: 'Carbidopa-levodopa', category: 'Pharmacological' },
  ],
  'Guillain-Barré Syndrome': [
    { treatment: 'IVIG or plasmapheresis', category: 'Pharmacological' },
  ],
  'Myasthenia Gravis (Crisis)': [
    { treatment: 'IVIG or plasmapheresis + ICU monitoring', category: 'Emergency' },
  ],
  'Myasthenia Gravis (Maintenance)': [
    { treatment: 'Pyridostigmine (acetylcholinesterase inhibitor)', category: 'Pharmacological' },
  ],
  
  // PSYCHIATRY
  'Major Depressive Disorder': [
    { treatment: 'SSRI (sertraline, escitalopram)', category: 'Pharmacological' },
  ],
  'Generalized Anxiety Disorder': [
    { treatment: 'SSRI or SNRI', category: 'Pharmacological' },
    { treatment: 'CBT', category: 'Behavioral' },
  ],
  'Panic Disorder': [
    { treatment: 'SSRI (long-term) ± benzodiazepine (short-term)', category: 'Pharmacological' },
  ],
  'Bipolar Disorder (Acute Mania)': [
    { treatment: 'Mood stabilizer (lithium, valproate) + antipsychotic', category: 'Pharmacological' },
  ],
  'Bipolar Disorder (Maintenance)': [
    { treatment: 'Mood stabilizer (lithium, valproate, lamotrigine)', category: 'Pharmacological' },
  ],
  'Schizophrenia': [
    { treatment: 'Second-generation antipsychotic (risperidone, olanzapine)', category: 'Pharmacological' },
  ],
  'PTSD': [
    { treatment: 'Trauma-focused CBT or EMDR', category: 'Behavioral' },
    { treatment: 'SSRI (sertraline, paroxetine)', category: 'Pharmacological' },
  ],
  'OCD': [
    { treatment: 'SSRI (higher doses) + ERP therapy', category: 'Pharmacological' },
  ],
  'ADHD': [
    { treatment: 'Stimulant (methylphenidate or amphetamine)', category: 'Pharmacological' },
  ],
  'Alcohol Use Disorder': [
    { treatment: 'Naltrexone or acamprosate', category: 'Pharmacological' },
  ],
  'Opioid Use Disorder': [
    { treatment: 'Buprenorphine or methadone maintenance', category: 'Pharmacological' },
  ],
  'Alcohol Withdrawal': [
    { treatment: 'Benzodiazepine (chlordiazepoxide, lorazepam)', category: 'Pharmacological' },
    { treatment: 'Thiamine before glucose', category: 'Pharmacological' },
  ],
  'Opioid Overdose': [
    { treatment: 'Naloxone (Narcan)', category: 'Emergency' },
  ],
  
  // HEMATOLOGY/ONCOLOGY
  'Iron Deficiency Anemia': [
    { treatment: 'Oral ferrous sulfate', category: 'Pharmacological' },
  ],
  'Vitamin B12 Deficiency': [
    { treatment: 'IM cyanocobalamin or high-dose oral', category: 'Pharmacological' },
  ],
  'Folate Deficiency': [
    { treatment: 'Oral folic acid', category: 'Pharmacological' },
  ],
  'Sickle Cell Crisis': [
    { treatment: 'IV fluids + opioid pain management + oxygen if hypoxic', category: 'Supportive' },
  ],
  'Acute Hemolytic Transfusion Reaction': [
    { treatment: 'Stop transfusion immediately + IV fluids + supportive care', category: 'Emergency' },
  ],
  'Heparin-Induced Thrombocytopenia': [
    { treatment: 'Stop all heparin + start non-heparin anticoagulant (argatroban)', category: 'Emergency' },
  ],
  'Immune Thrombocytopenic Purpura': [
    { treatment: 'Corticosteroids (prednisone)', category: 'Pharmacological' },
    { treatment: 'IVIG if severe bleeding', category: 'Emergency' },
  ],
  'TTP': [
    { treatment: 'Plasma exchange + corticosteroids', category: 'Emergency' },
  ],
  'DVT': [
    { treatment: 'Anticoagulation (DOAC preferred for provoked)', category: 'Pharmacological' },
  ],
  'Pulmonary Embolism (Stable)': [
    { treatment: 'Anticoagulation (DOAC preferred)', category: 'Pharmacological' },
  ],
  'Warfarin Overdose (Bleeding)': [
    { treatment: 'Vitamin K + 4-factor PCC or FFP', category: 'Emergency' },
  ],
  
  // MUSCULOSKELETAL
  'Gout (Acute)': [
    { treatment: 'NSAIDs or colchicine or corticosteroids', category: 'Pharmacological' },
  ],
  'Gout (Prophylaxis)': [
    { treatment: 'Allopurinol (start after flare resolves)', category: 'Pharmacological' },
  ],
  'Septic Arthritis': [
    { treatment: 'Joint aspiration/drainage + IV antibiotics', category: 'Emergency' },
  ],
  'Rheumatoid Arthritis': [
    { treatment: 'Methotrexate (first-line DMARD)', category: 'Pharmacological' },
  ],
  'Osteoarthritis': [
    { treatment: 'Acetaminophen or topical NSAIDs', category: 'Pharmacological' },
    { treatment: 'Exercise and weight loss', category: 'Behavioral' },
  ],
  'Osteoporosis': [
    { treatment: 'Bisphosphonate (alendronate) + calcium/vitamin D', category: 'Pharmacological' },
  ],
  'Compartment Syndrome': [
    { treatment: 'Emergent fasciotomy', category: 'Emergency' },
  ],
  'Open Fracture': [
    { treatment: 'IV antibiotics + tetanus + irrigation/debridement + fixation', category: 'Emergency' },
  ],
  
  // DERMATOLOGY
  'Atopic Dermatitis': [
    { treatment: 'Emollients + topical corticosteroids', category: 'Pharmacological' },
  ],
  'Psoriasis (Mild)': [
    { treatment: 'Topical corticosteroids + vitamin D analogs', category: 'Pharmacological' },
  ],
  'Psoriasis (Moderate-Severe)': [
    { treatment: 'Phototherapy or systemic agents (methotrexate, biologics)', category: 'Pharmacological' },
  ],
  'Acne Vulgaris (Mild)': [
    { treatment: 'Topical retinoid + benzoyl peroxide', category: 'Pharmacological' },
  ],
  'Acne Vulgaris (Moderate-Severe)': [
    { treatment: 'Oral antibiotics (doxycycline) + topicals', category: 'Pharmacological' },
  ],
  'Stevens-Johnson Syndrome': [
    { treatment: 'Stop offending drug + supportive care + burn unit if severe', category: 'Emergency' },
  ],
  'Urticaria (Acute)': [
    { treatment: 'Second-generation antihistamine', category: 'Pharmacological' },
  ],
  'Anaphylaxis': [
    { treatment: 'Epinephrine IM (anterolateral thigh)', category: 'Emergency' },
  ],
  
  // OB/GYN
  'Preeclampsia (Mild)': [
    { treatment: 'Expectant management + close monitoring', category: 'Observation' },
  ],
  'Preeclampsia (Severe)': [
    { treatment: 'Magnesium sulfate + delivery (if ≥34 weeks)', category: 'Emergency' },
  ],
  'Eclampsia': [
    { treatment: 'Magnesium sulfate + delivery', category: 'Emergency' },
  ],
  'Ectopic Pregnancy': [
    { treatment: 'Methotrexate (if stable, <3.5cm, no cardiac activity)', category: 'Pharmacological' },
    { treatment: 'Surgery (if unstable or methotrexate contraindicated)', category: 'Surgical' },
  ],
  'Postpartum Hemorrhage': [
    { treatment: 'Uterine massage + oxytocin', category: 'Emergency' },
  ],
  'Bacterial Vaginosis': [
    { treatment: 'Metronidazole (oral or vaginal)', category: 'Pharmacological' },
  ],
  'Vulvovaginal Candidiasis': [
    { treatment: 'Oral fluconazole or topical azole', category: 'Pharmacological' },
  ],
  'Pelvic Inflammatory Disease': [
    { treatment: 'Ceftriaxone + doxycycline ± metronidazole', category: 'Pharmacological' },
  ],
  'Endometriosis': [
    { treatment: 'NSAIDs + hormonal therapy (OCPs, progestins)', category: 'Pharmacological' },
  ],
  
  // UROLOGY
  'BPH': [
    { treatment: 'Alpha-blocker (tamsulosin)', category: 'Pharmacological' },
    { treatment: 'Add 5-alpha reductase inhibitor if large prostate', category: 'Pharmacological' },
  ],
  'Acute Prostatitis': [
    { treatment: 'Fluoroquinolone or TMP-SMX x 4-6 weeks', category: 'Pharmacological' },
  ],
  'Testicular Torsion': [
    { treatment: 'Emergent surgical detorsion (within 6 hours)', category: 'Emergency' },
  ],
  'Epididymitis': [
    { treatment: 'Ceftriaxone + doxycycline (if STI suspected)', category: 'Pharmacological' },
    { treatment: 'Fluoroquinolone (if non-STI)', category: 'Pharmacological' },
  ],
  'Nephrolithiasis': [
    { treatment: 'Hydration + NSAIDs + alpha-blocker (tamsulosin) for MET', category: 'Pharmacological' },
  ],
  
  // PEDIATRICS
  'Neonatal Jaundice': [
    { treatment: 'Phototherapy (based on bilirubin nomogram)', category: 'Procedural' },
  ],
  'Kawasaki Disease': [
    { treatment: 'IVIG + high-dose aspirin (then low-dose)', category: 'Pharmacological' },
  ],
  'Croup': [
    { treatment: 'Dexamethasone (single dose)', category: 'Pharmacological' },
    { treatment: 'Nebulized epinephrine if severe', category: 'Emergency' },
  ],
  'Bronchiolitis': [
    { treatment: 'Supportive care (hydration, suctioning, oxygen)', category: 'Supportive' },
  ],
  'Febrile Seizure (Simple)': [
    { treatment: 'Reassurance and parent education', category: 'Observation' },
  ],
  'Pyloric Stenosis': [
    { treatment: 'Pyloromyotomy', category: 'Surgical' },
  ],
  'Intussusception': [
    { treatment: 'Air or contrast enema reduction', category: 'Procedural' },
    { treatment: 'Surgery if unsuccessful or peritonitis', category: 'Surgical' },
  ],
};

interface TreatmentCandidate {
  condition: string;
  treatment: string;
  category: string;
  source: 'known' | 'ai';
}

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate first-line treatments using AI
 */
async function generateAITreatments(
  conditions: { name: string; system: string; content: any }[]
): Promise<TreatmentCandidate[]> {
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
    treatment: c.content?.treatment,
    prognosis: c.content?.prognosis,
  }));

  const prompt = `You are a PANCE/PANRE exam expert. For each condition, provide the FIRST-LINE treatment(s).

RULES:
1. Only include what would be correct on a board exam as "first-line" or "initial treatment"
2. Be specific with drug names when applicable
3. Include dose/duration if it's high-yield for boards
4. Categorize as: Pharmacological, Surgical, Procedural, Supportive, Behavioral, Observation, Emergency, Preventive
5. If no clear first-line treatment, return empty array

GOOD EXAMPLES:
- Condition: "Community-Acquired Pneumonia" → "Amoxicillin or doxycycline (outpatient)" [Pharmacological]
- Condition: "Appendicitis" → "Appendectomy" [Surgical]
- Condition: "DKA" → "IV fluids + IV insulin + K+ replacement" [Emergency]

BAD EXAMPLES:
- "Treat the underlying cause" (too vague)
- "Antibiotics" (not specific enough)
- "Supportive care" alone when specific treatment exists

Return JSON array:
[
  {
    "conditionName": "Condition A",
    "treatments": [
      { "treatment": "Specific treatment", "category": "Pharmacological|Surgical|Procedural|Supportive|Behavioral|Observation|Emergency|Preventive" }
    ]
  }
]

Conditions:
${JSON.stringify(conditionList, null, 2)}`;

  await rateLimiter.acquire();
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const parsed = JSON.parse(text);
    const candidates: TreatmentCandidate[] = [];
    
    for (const item of parsed) {
      const condition = conditions.find(c => c.name === item.conditionName);
      if (!condition) continue;
      
      for (const t of item.treatments || []) {
        candidates.push({
          condition: condition.name,
          treatment: t.treatment.trim(),
          category: t.category || 'Pharmacological',
          source: 'ai',
        });
      }
    }
    
    return candidates;
  } catch (e) {
    console.error('Failed to parse AI response:', text.substring(0, 500));
    return [];
  }
}

/**
 * Get known first-line treatments
 */
function getKnownTreatments(): TreatmentCandidate[] {
  const candidates: TreatmentCandidate[] = [];
  
  for (const [condition, treatments] of Object.entries(KNOWN_FIRST_LINE)) {
    for (const t of treatments) {
      candidates.push({
        condition,
        treatment: t.treatment,
        category: t.category,
        source: 'known',
      });
    }
  }
  
  return candidates;
}

/**
 * Check if treatment already exists
 */
async function treatmentExists(condition: string, treatment: string): Promise<boolean> {
  const existing = await prisma.firstLineTreatment.findFirst({
    where: {
      condition: { equals: condition, mode: 'insensitive' },
      treatment: { contains: treatment.substring(0, 30), mode: 'insensitive' },
    },
  });
  return !!existing;
}

/**
 * Phase 1: Analyze current state
 */
async function analyzeState() {
  console.log('\n📊 Analyzing Current State\n');
  
  const treatmentCount = await prisma.firstLineTreatment.count();
  const conditionCount = await prisma.condition.count();
  
  const byCategory = await prisma.firstLineTreatment.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });
  
  const uniqueConditions = await prisma.firstLineTreatment.groupBy({
    by: ['condition'],
    _count: true,
  });
  
  console.log(`  Total First-Line Treatments: ${treatmentCount}`);
  console.log(`  Unique Conditions with Treatments: ${uniqueConditions.length}`);
  console.log(`  Total Conditions in DB: ${conditionCount}`);
  console.log(`  Coverage: ${((uniqueConditions.length / conditionCount) * 100).toFixed(1)}%`);
  
  if (byCategory.length > 0) {
    console.log('\n  Treatments by Category:');
    for (const c of byCategory) {
      console.log(`    ${c.category}: ${c._count}`);
    }
  }
  
  const samples = await prisma.firstLineTreatment.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  
  if (samples.length > 0) {
    console.log('\n  Recent Treatments:');
    for (const s of samples) {
      console.log(`    ${s.condition}: ${s.treatment.substring(0, 50)}...`);
    }
  }
}

/**
 * Phase 2: Insert known treatments
 */
async function insertKnownTreatments(dryRun: boolean) {
  console.log('\n🔍 Inserting Known First-Line Treatments\n');
  
  const known = getKnownTreatments();
  console.log(`  Found ${known.length} known first-line treatments for ${Object.keys(KNOWN_FIRST_LINE).length} conditions`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const candidate of known) {
    const exists = await treatmentExists(candidate.condition, candidate.treatment);
    
    if (exists) {
      skipped++;
      continue;
    }
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would insert: ${candidate.condition}: ${candidate.treatment.substring(0, 40)}...`);
      inserted++;
    } else {
      await prisma.firstLineTreatment.create({
        data: {
          id: crypto.randomUUID(),
          updatedAt: new Date(),
          condition: candidate.condition,
          treatment: candidate.treatment,
          category: candidate.category,
        },
      });
      console.log(`  ✅ ${candidate.condition}: ${candidate.treatment.substring(0, 40)}...`);
      inserted++;
    }
  }
  
  console.log(`\n  Summary: ${inserted} inserted, ${skipped} already existed`);
}

/**
 * Phase 3: Generate AI treatments for conditions
 */
async function generateAITreatmentsForConditions(dryRun: boolean, batchSize: number) {
  console.log('\n🤖 Generating AI First-Line Treatments\n');
  
  // Get conditions that already have treatments
  const conditionsWithTreatments = await prisma.firstLineTreatment.groupBy({
    by: ['condition'],
  });
  const coveredNames = new Set(conditionsWithTreatments.map(c => c.condition.toLowerCase()));
  
  // Get all conditions from MedicalContent
  const allConditions = await prisma.medicalContent.findMany({
    select: {
      condition: true,
      system: true,
      treatment: true,
      prognosis: true,
    },
  });
  
  const uncoveredConditions = allConditions.filter(
    c => !coveredNames.has(c.condition.toLowerCase())
  );
  
  console.log(`  Conditions without first-line treatments: ${uncoveredConditions.length}`);
  
  if (uncoveredConditions.length === 0) {
    console.log('  All conditions have first-line treatments!');
    return;
  }
  
  let totalInserted = 0;
  let totalSkipped = 0;
  
  for (let i = 0; i < uncoveredConditions.length; i += batchSize) {
    const batch = uncoveredConditions.slice(i, i + batchSize);
    console.log(`\n  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uncoveredConditions.length / batchSize)} (${batch.length} conditions)...`);
    
    const conditionsForAI = batch.map(c => ({
      name: c.condition,
      system: c.system,
      content: {
        treatment: c.treatment,
        prognosis: c.prognosis,
      },
    }));
    
    try {
      const candidates = await generateAITreatments(conditionsForAI);
      console.log(`    AI generated ${candidates.length} treatment candidates`);
      
      for (const candidate of candidates) {
        const exists = await treatmentExists(candidate.condition, candidate.treatment);
        
        if (exists) {
          totalSkipped++;
          continue;
        }
        
        if (dryRun) {
          console.log(`    [DRY RUN] ${candidate.condition}: ${candidate.treatment.substring(0, 40)}...`);
          totalInserted++;
        } else {
          await prisma.firstLineTreatment.create({
            data: {
              id: crypto.randomUUID(),
              updatedAt: new Date(),
              condition: candidate.condition,
              treatment: candidate.treatment,
              category: candidate.category,
            },
          });
          console.log(`    ✅ ${candidate.condition}: ${candidate.treatment.substring(0, 40)}...`);
          totalInserted++;
        }
      }
    } catch (e: any) {
      console.error(`    ❌ Error processing batch:`, e.message || e);
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
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 20;
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      💊 FIRST-LINE TREATMENT DOCTOR - Board-Style Generator    ║');
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
    
    await insertKnownTreatments(dryRun);
    
    if (!knownOnly) {
      await generateAITreatmentsForConditions(dryRun, batchSize);
    }
    
    console.log('\n📈 FINAL STATE:');
    await analyzeState();
    
    console.log('\n✨ First-Line Treatment Doctor complete!');
    
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
