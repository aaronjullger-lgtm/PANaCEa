#!/usr/bin/env npx tsx
/**
 * Clinical Pearl Doctor - High-Yield PANCE Pearl Generator
 *
 * Generates clinical pearls for PANCE/PANRE exam preparation.
 * Each pearl should be a concise, memorable teaching point that helps
 * students understand and remember key clinical concepts.
 *
 * ClinicalPearl Schema:
 *   id, pearlText (required), fullExplanation?, questionId?, system (required),
 *   category?, tags[], usefulVotes, viewCount, extractedAt
 *
 * Usage:
 *   npx tsx scripts/generators/clinical-pearl-doctor.ts --dry-run    # Preview
 *   npx tsx scripts/generators/clinical-pearl-doctor.ts              # Generate pearls
 *   npx tsx scripts/generators/clinical-pearl-doctor.ts --batch=25   # Process 25 conditions at a time
 *   npx tsx scripts/generators/clinical-pearl-doctor.ts --analyze    # Show current state
 *   npx tsx scripts/generators/clinical-pearl-doctor.ts --known-only # Only insert known pearls
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
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
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

// High-yield clinical pearls by system (manually verified, board-style)
const KNOWN_PEARLS: Record<
  string,
  Array<{ pearl: string; explanation?: string; category?: string; tags?: string[] }>
> = {
  // CARDIOLOGY
  CV: [
    {
      pearl: 'A new S3 in an adult suggests volume overload or heart failure.',
      category: 'Physical Exam',
      tags: ['heart failure', 'auscultation'],
    },
    {
      pearl:
        'An S4 indicates stiff ventricle (diastolic dysfunction) - "atrial kick into stiff ventricle".',
      category: 'Physical Exam',
      tags: ['diastolic dysfunction', 'auscultation'],
    },
    {
      pearl: 'Pulsus paradoxus >10 mmHg suggests cardiac tamponade or severe asthma/COPD.',
      category: 'Physical Exam',
      tags: ['tamponade', 'pericardial disease'],
    },
    {
      pearl:
        'STEMI treatment: "MONA" (Morphine, Oxygen if needed, Nitrates, Aspirin) + immediate cath or fibrinolytics.',
      category: 'Treatment',
      tags: ['STEMI', 'ACS', 'emergency'],
    },
    {
      pearl:
        'Troponins rise 3-6 hours after MI, peak at 12-24 hours, and stay elevated for 7-10 days.',
      category: 'Labs',
      tags: ['MI', 'biomarkers'],
    },
    {
      pearl:
        'Beta-blockers are first-line for rate control in atrial fibrillation (avoid in decompensated HF).',
      category: 'Treatment',
      tags: ['atrial fibrillation', 'rate control'],
    },
    {
      pearl: 'Digoxin toxicity is enhanced by hypokalemia - always check K+ before giving digoxin.',
      category: 'Pharmacology',
      tags: ['digoxin', 'electrolytes'],
    },
    {
      pearl: 'Cannon A waves indicate AV dissociation (complete heart block or VT).',
      category: 'Physical Exam',
      tags: ['arrhythmia', 'JVP'],
    },
    {
      pearl: 'Wide pulse pressure = aortic regurgitation or hyperthyroidism.',
      category: 'Physical Exam',
      tags: ['aortic regurgitation', 'vital signs'],
    },
    {
      pearl: 'Electrical alternans on ECG suggests large pericardial effusion.',
      category: 'Diagnostics',
      tags: ['pericardial effusion', 'ECG'],
    },
  ],

  // PULMONARY
  PULM: [
    {
      pearl: 'A-a gradient >15 mmHg suggests V/Q mismatch, shunt, or diffusion limitation.',
      category: 'Diagnostics',
      tags: ['ABG', 'hypoxemia'],
    },
    {
      pearl: 'Normal A-a gradient = (Age/4) + 4 on room air.',
      category: 'Diagnostics',
      tags: ['ABG', 'hypoxemia'],
    },
    {
      pearl: 'Tension pneumothorax = tracheal deviation AWAY from affected side + hypotension.',
      category: 'Emergency',
      tags: ['pneumothorax', 'trauma'],
    },
    {
      pearl:
        'COPD patients can have normal or low CO2 - if CO2 is high, they are retaining and may be in trouble.',
      category: 'Diagnostics',
      tags: ['COPD', 'ABG'],
    },
    {
      pearl:
        'Asthma NEVER causes clubbing - if you see clubbing, think cancer or other chronic disease.',
      category: 'Differential',
      tags: ['asthma', 'clubbing', 'lung cancer'],
    },
    {
      pearl:
        "Hampton's hump (wedge-shaped opacity) and Westermark sign (oligemia) suggest PE on CXR.",
      category: 'Diagnostics',
      tags: ['PE', 'imaging'],
    },
    {
      pearl: 'Wells criteria >4 = high probability PE, go straight to CT angiography.',
      category: 'Clinical Decision',
      tags: ['PE', 'workup'],
    },
    {
      pearl:
        "Pleural effusion: transudative if protein <3 g/dL and LDH <200; exudative if either is higher (Light's criteria).",
      category: 'Diagnostics',
      tags: ['pleural effusion', 'thoracentesis'],
    },
    {
      pearl: 'In ARDS, keep plateau pressure <30 cm H2O to prevent barotrauma.',
      category: 'Treatment',
      tags: ['ARDS', 'ventilator'],
    },
    {
      pearl:
        'Silhouette sign: loss of cardiac or diaphragm border indicates adjacent lung pathology.',
      category: 'Diagnostics',
      tags: ['CXR', 'imaging'],
    },
  ],

  // GASTROENTEROLOGY
  GI: [
    {
      pearl: "Murphy's sign is specific for cholecystitis - inspiratory arrest with RUQ palpation.",
      category: 'Physical Exam',
      tags: ['cholecystitis', 'biliary'],
    },
    {
      pearl: 'AST:ALT ratio >2:1 suggests alcoholic liver disease (think "S for Scotch").',
      category: 'Labs',
      tags: ['liver disease', 'alcoholic hepatitis'],
    },
    {
      pearl: 'Acute pancreatitis: Ranson criteria at admission and 48 hours predict mortality.',
      category: 'Prognosis',
      tags: ['pancreatitis', 'prognosis'],
    },
    {
      pearl:
        'Cullen sign (periumbilical bruising) and Grey Turner sign (flank bruising) indicate hemorrhagic pancreatitis.',
      category: 'Physical Exam',
      tags: ['pancreatitis', 'hemorrhagic'],
    },
    {
      pearl:
        'First step in GI bleed: stabilize with 2 large-bore IVs and type/cross, then EGD if upper bleed suspected.',
      category: 'Emergency',
      tags: ['GI bleed', 'resuscitation'],
    },
    {
      pearl: 'Hepatic encephalopathy treatment: lactulose (goal 2-3 BM/day) and rifaximin.',
      category: 'Treatment',
      tags: ['hepatic encephalopathy', 'cirrhosis'],
    },
    {
      pearl:
        'SBP prophylaxis in cirrhosis: fluoroquinolone if GI bleed, or if ascitic protein <1.5 g/dL.',
      category: 'Prevention',
      tags: ['SBP', 'cirrhosis', 'prophylaxis'],
    },
    {
      pearl:
        'Pyloric stenosis = olive-shaped mass, non-bilious projectile vomiting, hypochloremic hypokalemic metabolic alkalosis.',
      category: 'Pediatrics',
      tags: ['pyloric stenosis', 'pediatric'],
    },
    {
      pearl:
        'Intussusception = currant jelly stool, sausage-shaped mass, intermittent colicky pain.',
      category: 'Pediatrics',
      tags: ['intussusception', 'pediatric'],
    },
    {
      pearl: "Bird's beak sign on barium swallow = achalasia.",
      category: 'Diagnostics',
      tags: ['achalasia', 'imaging'],
    },
  ],

  // RENAL
  RENAL: [
    {
      pearl: 'FENa <1% suggests prerenal azotemia; FENa >2% suggests intrinsic renal disease.',
      category: 'Diagnostics',
      tags: ['AKI', 'FENa'],
    },
    {
      pearl: 'Muddy brown casts = ATN (acute tubular necrosis).',
      category: 'Diagnostics',
      tags: ['ATN', 'urinalysis'],
    },
    {
      pearl:
        'RBC casts = glomerulonephritis; WBC casts = pyelonephritis or interstitial nephritis.',
      category: 'Diagnostics',
      tags: ['urinalysis', 'casts'],
    },
    {
      pearl: 'In rhabdomyolysis, aggressive IV fluids are key - target urine output >200 mL/hour.',
      category: 'Treatment',
      tags: ['rhabdomyolysis', 'AKI'],
    },
    {
      pearl:
        'Contrast-induced nephropathy: hydrate before and after, use lowest contrast volume, avoid NSAIDs.',
      category: 'Prevention',
      tags: ['contrast nephropathy', 'CKD'],
    },
    {
      pearl:
        'Dialysis indications: AEIOU - Acidosis, Electrolytes (K+), Intoxication, Overload, Uremia symptoms.',
      category: 'Treatment',
      tags: ['dialysis', 'indications'],
    },
    {
      pearl:
        'ACE inhibitors are renoprotective in diabetic nephropathy but may increase creatinine by 30% initially - this is acceptable.',
      category: 'Treatment',
      tags: ['ACE inhibitor', 'diabetic nephropathy'],
    },
    {
      pearl:
        "Urine specific gravity >1.020 with prerenal AKI (kidneys concentrating); <1.010 in ATN (can't concentrate).",
      category: 'Diagnostics',
      tags: ['AKI', 'urinalysis'],
    },
    {
      pearl:
        'Rapidly progressive GN: urgent biopsy, often needs plasmapheresis and immunosuppression.',
      category: 'Emergency',
      tags: ['RPGN', 'glomerulonephritis'],
    },
    {
      pearl:
        'Hyperkalemia treatment order: stabilize membrane (calcium), shift K+ in (insulin/glucose, bicarb, albuterol), remove K+ (Kayexalate, dialysis).',
      category: 'Treatment',
      tags: ['hyperkalemia', 'emergency'],
    },
  ],

  // ENDOCRINE
  ENDO: [
    {
      pearl: 'DKA has high anion gap; HHS has extremely high glucose (>600) but minimal ketosis.',
      category: 'Differential',
      tags: ['DKA', 'HHS', 'diabetes'],
    },
    {
      pearl:
        'In DKA, potassium may look normal or high initially but is always total body depleted - replace early.',
      category: 'Treatment',
      tags: ['DKA', 'potassium'],
    },
    {
      pearl:
        'Thyroid storm: beta-blockers first (symptom control), then PTU/methimazole, then iodine (wait 1 hour after thionamide).',
      category: 'Treatment',
      tags: ['thyroid storm', 'hyperthyroidism'],
    },
    {
      pearl: 'Myxedema coma: IV levothyroxine + hydrocortisone (in case of adrenal insufficiency).',
      category: 'Treatment',
      tags: ['myxedema coma', 'hypothyroidism'],
    },
    {
      pearl: 'Primary hyperaldosteronism: hypertension + hypokalemia + metabolic alkalosis.',
      category: 'Diagnostics',
      tags: ['hyperaldosteronism', 'Conn syndrome'],
    },
    {
      pearl: 'Pheochromocytoma: rule of 10s - 10% bilateral, 10% malignant, 10% extra-adrenal.',
      category: 'Epidemiology',
      tags: ['pheochromocytoma', 'adrenal'],
    },
    {
      pearl: "Adrenal crisis: give hydrocortisone BEFORE test results - don't wait!",
      category: 'Emergency',
      tags: ['adrenal crisis', 'Addison disease'],
    },
    {
      pearl:
        'Hypercalcemia of malignancy: PTHrP elevated, PTH low (vs. primary hyperparathyroidism: PTH high).',
      category: 'Differential',
      tags: ['hypercalcemia', 'PTH'],
    },
    {
      pearl:
        'Metformin should be held before contrast and restarted 48 hours after if kidney function stable.',
      category: 'Safety',
      tags: ['metformin', 'contrast', 'diabetes'],
    },
    {
      pearl: 'HbA1c represents ~3 months of glucose control; target <7% for most diabetics.',
      category: 'Monitoring',
      tags: ['diabetes', 'HbA1c'],
    },
  ],

  // HEMATOLOGY
  HEME: [
    {
      pearl:
        'Iron deficiency: low ferritin, high TIBC, low iron, low saturation. Anemia of chronic disease: low iron, low TIBC, normal/high ferritin.',
      category: 'Differential',
      tags: ['anemia', 'iron studies'],
    },
    {
      pearl:
        'Warm AIHA: IgG antibodies, extravascular hemolysis (spleen). Cold AIHA: IgM antibodies, intravascular hemolysis.',
      category: 'Differential',
      tags: ['hemolytic anemia', 'AIHA'],
    },
    {
      pearl:
        'TTP pentad: fever, anemia, thrombocytopenia, renal dysfunction, neurological symptoms. DO NOT transfuse platelets!',
      category: 'Emergency',
      tags: ['TTP', 'thrombocytopenia'],
    },
    {
      pearl: 'HUS = TTP without neuro symptoms; often follows E. coli O157:H7 (bloody diarrhea).',
      category: 'Differential',
      tags: ['HUS', 'E. coli'],
    },
    {
      pearl:
        'DIC: elevated PT/PTT/INR, low platelets, low fibrinogen, elevated D-dimer, schistocytes on smear.',
      category: 'Diagnostics',
      tags: ['DIC', 'coagulopathy'],
    },
    {
      pearl:
        'Heparin-induced thrombocytopenia: platelets drop >50% 5-10 days after starting heparin; STOP heparin, start argatroban.',
      category: 'Emergency',
      tags: ['HIT', 'heparin'],
    },
    {
      pearl:
        'Sickle cell crisis: pain management, IV fluids, oxygen if hypoxic. Exchange transfusion for stroke/ACS.',
      category: 'Treatment',
      tags: ['sickle cell', 'crisis'],
    },
    {
      pearl: 'Target INR 2-3 for most indications; 2.5-3.5 for mechanical mitral valve.',
      category: 'Treatment',
      tags: ['warfarin', 'anticoagulation'],
    },
    {
      pearl: 'Polycythemia vera = elevated RBC + low EPO + JAK2 mutation (>95% of cases).',
      category: 'Diagnostics',
      tags: ['polycythemia vera', 'myeloproliferative'],
    },
    {
      pearl: 'Smudge cells on peripheral smear = CLL (fragile lymphocytes).',
      category: 'Diagnostics',
      tags: ['CLL', 'smear'],
    },
  ],

  // INFECTIOUS DISEASE
  ID: [
    {
      pearl:
        'Empiric meningitis treatment: vancomycin + ceftriaxone + dexamethasone (give steroids before or with first antibiotic dose).',
      category: 'Treatment',
      tags: ['meningitis', 'empiric therapy'],
    },
    {
      pearl:
        'LP in meningitis: bacterial = high protein, low glucose, PMN predominance; viral = normal glucose, lymphocyte predominance.',
      category: 'Diagnostics',
      tags: ['meningitis', 'CSF'],
    },
    {
      pearl:
        'C. diff treatment: mild-moderate = oral vancomycin; severe = oral vancomycin + IV metronidazole; fulminant = surgery consult.',
      category: 'Treatment',
      tags: ['C. diff', 'diarrhea'],
    },
    {
      pearl:
        'Cellulitis: beta-hemolytic strep (most common) and Staph aureus. Treat with cephalosporin or penicillin.',
      category: 'Treatment',
      tags: ['cellulitis', 'skin infection'],
    },
    {
      pearl:
        'MRSA coverage needed: purulent cellulitis, abscess, IV drug use, healthcare exposure.',
      category: 'Treatment',
      tags: ['MRSA', 'skin infection'],
    },
    {
      pearl: 'Cat bite = Pasteurella multocida; treat with amoxicillin-clavulanate.',
      category: 'Treatment',
      tags: ['animal bite', 'Pasteurella'],
    },
    {
      pearl:
        'Dog bite: Pasteurella, Capnocytophaga (immunocompromised). Treat with amoxicillin-clavulanate.',
      category: 'Treatment',
      tags: ['animal bite', 'dog bite'],
    },
    {
      pearl: 'PCP prophylaxis: TMP-SMX if CD4 <200 or oral candidiasis in HIV patients.',
      category: 'Prevention',
      tags: ['HIV', 'PCP', 'prophylaxis'],
    },
    {
      pearl:
        'TB: 4-drug therapy (RIPE: Rifampin, Isoniazid, Pyrazinamide, Ethambutol) for 2 months, then INH + Rifampin for 4 months.',
      category: 'Treatment',
      tags: ['TB', 'treatment'],
    },
    {
      pearl:
        'Sepsis: lactate >2, start fluids + antibiotics within 1 hour. Septic shock: MAP <65 despite fluids, add vasopressors.',
      category: 'Emergency',
      tags: ['sepsis', 'septic shock'],
    },
  ],

  // NEUROLOGY
  NEURO: [
    {
      pearl:
        'Stroke: "time is brain" - tPA within 4.5 hours of symptom onset if no contraindications.',
      category: 'Emergency',
      tags: ['stroke', 'tPA'],
    },
    {
      pearl: 'NIHSS score: higher = worse stroke. Use for tPA eligibility and prognosis.',
      category: 'Assessment',
      tags: ['stroke', 'NIHSS'],
    },
    {
      pearl:
        'Worst headache of life + nuchal rigidity = SAH until proven otherwise. Get CT head, then LP if CT negative.',
      category: 'Emergency',
      tags: ['SAH', 'headache'],
    },
    {
      pearl: 'Xanthochromia in CSF confirms SAH (blood breakdown products).',
      category: 'Diagnostics',
      tags: ['SAH', 'LP'],
    },
    {
      pearl:
        'Status epilepticus: lorazepam first, then fosphenytoin/levetiracetam if seizures persist.',
      category: 'Emergency',
      tags: ['seizure', 'status epilepticus'],
    },
    {
      pearl:
        'New onset seizure in adult: always get imaging (CT/MRI) to rule out mass, stroke, or other structural cause.',
      category: 'Workup',
      tags: ['seizure', 'imaging'],
    },
    {
      pearl:
        'Guillain-Barré: ascending paralysis + areflexia + albuminocytologic dissociation (high protein, normal cells in CSF).',
      category: 'Diagnostics',
      tags: ['Guillain-Barré', 'CSF'],
    },
    {
      pearl:
        'MS: lesions disseminated in time AND space; treat acute flare with IV methylprednisolone.',
      category: 'Diagnostics',
      tags: ['MS', 'demyelinating'],
    },
    {
      pearl:
        "Parkinson's: resting tremor + rigidity + bradykinesia + postural instability. Start with carbidopa-levodopa or dopamine agonist.",
      category: 'Treatment',
      tags: ['Parkinson', 'movement disorder'],
    },
    {
      pearl:
        'Myasthenia gravis: fatigable weakness, ptosis worse at end of day. Diagnose with anti-AChR antibodies and EMG.',
      category: 'Diagnostics',
      tags: ['myasthenia gravis', 'weakness'],
    },
  ],

  // MUSCULOSKELETAL
  MSK: [
    {
      pearl:
        'Septic arthritis: monoarticular, hot, swollen joint = tap it! WBC >50,000 with >75% PMNs is highly suggestive.',
      category: 'Emergency',
      tags: ['septic arthritis', 'joint'],
    },
    {
      pearl:
        'Gout: negatively birefringent needle-shaped crystals. Pseudogout: positively birefringent rhomboid crystals.',
      category: 'Diagnostics',
      tags: ['gout', 'pseudogout', 'crystals'],
    },
    {
      pearl:
        "Don't start allopurinol during acute gout flare - it can worsen the attack. Wait until resolved.",
      category: 'Treatment',
      tags: ['gout', 'allopurinol'],
    },
    {
      pearl:
        'Compartment syndrome: pain out of proportion, pain with passive stretch, paresthesias. Measure compartment pressure >30 mmHg = fasciotomy.',
      category: 'Emergency',
      tags: ['compartment syndrome', 'orthopedic emergency'],
    },
    {
      pearl:
        'Scaphoid fracture: snuffbox tenderness, may have negative initial X-ray. Treat as fracture even if X-ray negative, repeat in 2 weeks.',
      category: 'Treatment',
      tags: ['scaphoid fracture', 'wrist'],
    },
    {
      pearl:
        'Cauda equina syndrome: saddle anesthesia, urinary retention, bilateral leg weakness. Surgical emergency!',
      category: 'Emergency',
      tags: ['cauda equina', 'back pain'],
    },
    {
      pearl:
        'Straight leg raise positive at 30-70° suggests L4-S1 nerve root compression (sciatica).',
      category: 'Physical Exam',
      tags: ['sciatica', 'herniated disc'],
    },
    {
      pearl:
        'Ottawa ankle rules: X-ray needed if bone tenderness at posterior malleoli, navicular, or base of 5th metatarsal, or unable to bear weight.',
      category: 'Clinical Decision',
      tags: ['ankle', 'X-ray', 'Ottawa rules'],
    },
    {
      pearl: 'Lachman test is most sensitive for ACL tear; anterior drawer is less sensitive.',
      category: 'Physical Exam',
      tags: ['ACL', 'knee'],
    },
    {
      pearl:
        'Hip fracture in elderly: shortened and externally rotated leg. Get X-ray; if negative but high suspicion, get MRI.',
      category: 'Diagnostics',
      tags: ['hip fracture', 'elderly'],
    },
  ],

  // DERMATOLOGY
  DERM: [
    {
      pearl:
        'Stevens-Johnson syndrome: <10% BSA involvement; TEN: >30% BSA. Both are emergencies - stop offending drug!',
      category: 'Emergency',
      tags: ['SJS', 'TEN', 'drug reaction'],
    },
    {
      pearl:
        'ABCDE of melanoma: Asymmetry, Border irregularity, Color variation, Diameter >6mm, Evolution/change.',
      category: 'Diagnostics',
      tags: ['melanoma', 'skin cancer'],
    },
    {
      pearl: 'Erythema multiforme: target lesions, usually HSV-related. EM major involves mucosa.',
      category: 'Differential',
      tags: ['erythema multiforme', 'HSV'],
    },
    {
      pearl:
        'Psoriasis: well-demarcated erythematous plaques with silvery scale, Auspitz sign (bleeding with scale removal).',
      category: 'Physical Exam',
      tags: ['psoriasis', 'skin'],
    },
    {
      pearl:
        'Shingles (herpes zoster): dermatomal distribution, vesicles on erythematous base. Start antivirals within 72 hours.',
      category: 'Treatment',
      tags: ['shingles', 'herpes zoster'],
    },
    {
      pearl:
        'Erysipelas: sharply demarcated, raised, red (strep). Cellulitis: less defined borders (strep or staph).',
      category: 'Differential',
      tags: ['erysipelas', 'cellulitis'],
    },
    {
      pearl:
        'Actinic keratosis: precancerous, rough scaly patches on sun-exposed skin. Can progress to SCC.',
      category: 'Prevention',
      tags: ['actinic keratosis', 'SCC'],
    },
    {
      pearl:
        'Nikolsky sign positive (skin sloughs with pressure) in pemphigus vulgaris, TEN, SSSS.',
      category: 'Physical Exam',
      tags: ['pemphigus', 'Nikolsky sign'],
    },
    {
      pearl:
        'Eczema (atopic dermatitis): pruritus is key feature; affects flexural surfaces in children, extensor in adults.',
      category: 'Diagnostics',
      tags: ['eczema', 'atopic dermatitis'],
    },
    {
      pearl:
        'Contact dermatitis: linear vesicles or geometric pattern suggests external exposure (poison ivy, nickel).',
      category: 'Diagnostics',
      tags: ['contact dermatitis', 'allergy'],
    },
  ],

  // PSYCHIATRY
  PSYCH: [
    {
      pearl:
        'Suicidal patient: always ask about plan, means, and intent. Prior attempts = highest risk factor.',
      category: 'Assessment',
      tags: ['suicide', 'risk assessment'],
    },
    {
      pearl:
        'NMS (neuroleptic malignant syndrome): fever, rigidity, altered mental status, elevated CK after antipsychotic. Stop drug, give dantrolene.',
      category: 'Emergency',
      tags: ['NMS', 'antipsychotic'],
    },
    {
      pearl:
        'Serotonin syndrome: hyperthermia, rigidity, myoclonus, autonomic instability after serotonergic drugs. Treat with cyproheptadine.',
      category: 'Emergency',
      tags: ['serotonin syndrome', 'drug interaction'],
    },
    {
      pearl: 'First-line for depression: SSRI. Wait 4-6 weeks for full effect before switching.',
      category: 'Treatment',
      tags: ['depression', 'SSRI'],
    },
    {
      pearl:
        'Lithium toxicity: tremor → ataxia → seizures. Check levels, ECG (T-wave flattening). Dialysis if severe.',
      category: 'Emergency',
      tags: ['lithium', 'toxicity'],
    },
    {
      pearl:
        'Bipolar disorder: mood stabilizer (lithium, valproate) is maintenance; add antipsychotic for acute mania.',
      category: 'Treatment',
      tags: ['bipolar', 'mood stabilizer'],
    },
    {
      pearl: 'Panic disorder: acute = benzodiazepine; long-term = SSRI + CBT.',
      category: 'Treatment',
      tags: ['panic disorder', 'anxiety'],
    },
    {
      pearl:
        'Schizophrenia: positive symptoms (hallucinations, delusions) respond better to antipsychotics than negative symptoms.',
      category: 'Treatment',
      tags: ['schizophrenia', 'antipsychotic'],
    },
    {
      pearl:
        'Delirium: acute, fluctuating, inattention. Dementia: chronic, progressive, memory loss first.',
      category: 'Differential',
      tags: ['delirium', 'dementia'],
    },
    {
      pearl:
        'Alcohol withdrawal timeline: tremors (6-24h), hallucinations (12-48h), seizures (24-48h), DTs (48-96h).',
      category: 'Emergency',
      tags: ['alcohol withdrawal', 'DTs'],
    },
  ],

  // OB/GYN
  REPRO: [
    {
      pearl:
        'Ectopic pregnancy: positive β-hCG + empty uterus on ultrasound + adnexal mass/free fluid.',
      category: 'Emergency',
      tags: ['ectopic pregnancy', 'emergency'],
    },
    {
      pearl:
        'Preeclampsia: BP >140/90 + proteinuria after 20 weeks. Severe if BP >160/110 or end-organ damage.',
      category: 'Diagnostics',
      tags: ['preeclampsia', 'pregnancy'],
    },
    {
      pearl: 'Eclampsia = preeclampsia + seizures. Treat with magnesium sulfate and delivery.',
      category: 'Emergency',
      tags: ['eclampsia', 'pregnancy'],
    },
    {
      pearl:
        'HELLP syndrome: Hemolysis, Elevated Liver enzymes, Low Platelets. Severe preeclampsia variant.',
      category: 'Emergency',
      tags: ['HELLP', 'preeclampsia'],
    },
    {
      pearl:
        'Placental abruption: painful vaginal bleeding, board-like rigid uterus. Placenta previa: painless vaginal bleeding.',
      category: 'Differential',
      tags: ['abruption', 'previa'],
    },
    {
      pearl: 'Shoulder dystocia: McRoberts maneuver (hyperflexion of maternal hips) is first step.',
      category: 'Emergency',
      tags: ['shoulder dystocia', 'delivery'],
    },
    {
      pearl:
        'Postpartum hemorrhage: uterine atony is #1 cause. Treat with fundal massage, oxytocin, and uterine tamponade.',
      category: 'Emergency',
      tags: ['postpartum hemorrhage', 'delivery'],
    },
    {
      pearl:
        'Group B strep prophylaxis: IV penicillin during labor if positive culture or risk factors.',
      category: 'Prevention',
      tags: ['GBS', 'prophylaxis'],
    },
    {
      pearl:
        'Abnormal uterine bleeding workup: pregnancy test first, then consider ultrasound and endometrial biopsy if >45 years.',
      category: 'Workup',
      tags: ['AUB', 'menorrhagia'],
    },
    {
      pearl:
        'Emergency contraception: levonorgestrel within 72 hours, or copper IUD within 5 days.',
      category: 'Treatment',
      tags: ['emergency contraception', 'contraception'],
    },
  ],

  // PEDIATRICS (spread across systems but some specific)
  PEDS: [
    {
      pearl:
        'Kawasaki disease: 5 days of fever + 4 of 5 criteria (conjunctivitis, rash, adenopathy, mucous membrane changes, extremity changes). Treat with IVIG + aspirin.',
      category: 'Treatment',
      tags: ['Kawasaki', 'pediatric'],
    },
    {
      pearl:
        'Febrile seizure: simple if <15 min, generalized, single episode. No treatment needed; reassure parents.',
      category: 'Treatment',
      tags: ['febrile seizure', 'pediatric'],
    },
    {
      pearl:
        'Croup: barky cough, stridor, steeple sign on X-ray. Treat with dexamethasone; nebulized epinephrine if severe.',
      category: 'Treatment',
      tags: ['croup', 'respiratory'],
    },
    {
      pearl:
        'Bronchiolitis: RSV most common cause. Supportive care only; no routine bronchodilators or steroids.',
      category: 'Treatment',
      tags: ['bronchiolitis', 'RSV'],
    },
    {
      pearl:
        'Failure to thrive: organic vs. non-organic. Calculate caloric needs, evaluate feeding, assess for abuse/neglect.',
      category: 'Workup',
      tags: ['failure to thrive', 'growth'],
    },
    {
      pearl:
        'Developmental milestones: social smile (2 mo), rolls over (4 mo), sits (6 mo), crawls (9 mo), walks (12 mo).',
      category: 'Development',
      tags: ['milestones', 'development'],
    },
    {
      pearl:
        'Neonatal jaundice: physiologic peaks day 3-5. Pathologic if <24 hours, rising rapidly, or very high. Treat with phototherapy.',
      category: 'Treatment',
      tags: ['jaundice', 'newborn'],
    },
    {
      pearl:
        'Tetralogy of Fallot: VSD, overriding aorta, pulmonary stenosis, RVH. Tet spells = knee-to-chest position increases SVR.',
      category: 'Treatment',
      tags: ['TOF', 'congenital heart'],
    },
    {
      pearl: 'Wilms tumor: abdominal mass, does NOT cross midline. Neuroblastoma: crosses midline.',
      category: 'Differential',
      tags: ['Wilms tumor', 'neuroblastoma'],
    },
    {
      pearl:
        'Meningitis in neonates: different bugs (GBS, E. coli, Listeria). Use ampicillin + gentamicin/cefotaxime.',
      category: 'Treatment',
      tags: ['meningitis', 'neonatal'],
    },
  ],

  // HEENT
  HEENT: [
    {
      pearl:
        'Retinal detachment: sudden floaters, flashes of light, "curtain coming down" over vision. Urgent ophthalmology consult.',
      category: 'Emergency',
      tags: ['retinal detachment', 'ophthalmology'],
    },
    {
      pearl:
        'Acute angle-closure glaucoma: severe eye pain, halos around lights, mid-dilated fixed pupil. Emergency!',
      category: 'Emergency',
      tags: ['glaucoma', 'ophthalmology'],
    },
    {
      pearl:
        'Central retinal artery occlusion: painless sudden vision loss, cherry-red spot on fundoscopy. Stroke workup needed.',
      category: 'Emergency',
      tags: ['CRAO', 'vision loss'],
    },
    {
      pearl: 'Peritonsillar abscess: "hot potato" voice, trismus, uvula deviation. Drain it!',
      category: 'Treatment',
      tags: ['peritonsillar abscess', 'ENT'],
    },
    {
      pearl:
        'Epistaxis: anterior bleeds (Kiesselbach plexus) are most common. Apply pressure, cauterize if needed.',
      category: 'Treatment',
      tags: ['epistaxis', 'nosebleed'],
    },
    {
      pearl:
        'Acute otitis media: ear pain, bulging TM, decreased mobility. Treat with amoxicillin first-line.',
      category: 'Treatment',
      tags: ['otitis media', 'ear infection'],
    },
    {
      pearl:
        'Sudden sensorineural hearing loss: ENT emergency! Start high-dose steroids immediately.',
      category: 'Emergency',
      tags: ['hearing loss', 'ENT'],
    },
    {
      pearl: 'BPPV: posterior canal most common. Treat with Epley maneuver.',
      category: 'Treatment',
      tags: ['BPPV', 'vertigo'],
    },
    {
      pearl:
        "Meniere's disease: vertigo + hearing loss + tinnitus + ear fullness. Low-salt diet, diuretics.",
      category: 'Treatment',
      tags: ['Meniere', 'vertigo'],
    },
    {
      pearl:
        'Strep pharyngitis: Centor criteria (fever, tonsillar exudate, no cough, tender anterior cervical nodes). 3+ = treat or test.',
      category: 'Clinical Decision',
      tags: ['strep pharyngitis', 'sore throat'],
    },
  ],

  // GENITOURINARY
  GU: [
    {
      pearl:
        'Testicular torsion: sudden onset severe testicular pain, absent cremasteric reflex, high-riding testis. Surgical emergency!',
      category: 'Emergency',
      tags: ['testicular torsion', 'urology'],
    },
    {
      pearl:
        'BPH treatment ladder: alpha-blocker (tamsulosin) first, add 5-alpha reductase inhibitor (finasteride) if large prostate.',
      category: 'Treatment',
      tags: ['BPH', 'prostate'],
    },
    {
      pearl:
        'PSA >4 ng/mL warrants further evaluation; but PSA can be elevated with BPH, prostatitis, or manipulation.',
      category: 'Diagnostics',
      tags: ['PSA', 'prostate cancer'],
    },
    {
      pearl:
        'Acute urinary retention in male: BPH or medications (anticholinergics). Catheterize, start alpha-blocker.',
      category: 'Treatment',
      tags: ['urinary retention', 'BPH'],
    },
    {
      pearl:
        'UTI treatment: uncomplicated = nitrofurantoin or TMP-SMX. Complicated or pyelonephritis = fluoroquinolone.',
      category: 'Treatment',
      tags: ['UTI', 'pyelonephritis'],
    },
    {
      pearl: 'Kidney stone <5mm: will likely pass spontaneously. >10mm: likely needs intervention.',
      category: 'Treatment',
      tags: ['kidney stone', 'nephrolithiasis'],
    },
    {
      pearl:
        'Struvite stones: "infection stones" from urease-producing bacteria (Proteus). Can form staghorn calculi.',
      category: 'Diagnostics',
      tags: ['kidney stone', 'struvite'],
    },
    {
      pearl: 'Priapism: >4 hours = emergency. Aspirate corporal blood, inject phenylephrine.',
      category: 'Emergency',
      tags: ['priapism', 'urology'],
    },
    {
      pearl:
        'Epididymitis: gradual onset, tender epididymis, positive Prehn sign (pain relief with elevation). Treat cause (STI vs. UTI).',
      category: 'Treatment',
      tags: ['epididymitis', 'scrotal pain'],
    },
    {
      pearl:
        'Varicocele: "bag of worms" on standing, disappears when supine. Left side more common due to left gonadal vein drainage.',
      category: 'Physical Exam',
      tags: ['varicocele', 'scrotal mass'],
    },
  ],
};

interface PearlCandidate {
  pearlText: string;
  fullExplanation?: string;
  system: string;
  category?: string;
  tags: string[];
  source: 'known' | 'ai';
}

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate clinical pearls using AI for conditions without coverage
 */
async function generateAIPearls(
  conditions: { name: string; system: string; content: any }[]
): Promise<PearlCandidate[]> {
  const ai = getAI();
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  const conditionList = conditions.map((c) => ({
    name: c.name,
    system: c.system,
    overview: c.content?.overview,
    treatment: c.content?.treatment,
    diagnostics: c.content?.diagnostics,
    prognosis: c.content?.prognosis,
  }));

  const prompt = `You are a PANCE/PANRE exam expert creating clinical pearls for PA students.

Generate 2-4 HIGH-YIELD clinical pearls for each condition. Each pearl should be:
1. Concise and memorable (1-2 sentences max)
2. Clinically actionable or a key differentiating point
3. The type of fact that appears on board exams
4. NOT a basic definition - should be practical clinical insight

GOOD PEARL EXAMPLES:
- "In DKA, potassium may look normal but total body K+ is depleted - replace early."
- "Troponins rise 3-6 hours after MI - a negative troponin at 1 hour doesn't rule out MI."
- "Never give aspirin to children with viral illness - risk of Reye syndrome."

BAD EXAMPLES (too basic):
- "Diabetes is a disease of high blood sugar." (definition, not insight)
- "Treat infections with antibiotics." (too vague)
- "Get labs when indicated." (not actionable)

Return JSON array:
[
  {
    "conditionName": "Condition A",
    "pearls": [
      {
        "text": "The clinical pearl text",
        "explanation": "Why this is important/the reasoning behind it",
        "category": "Treatment|Diagnostics|Physical Exam|Emergency|Differential|Labs|Prevention",
        "tags": ["relevant", "tags"]
      }
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
    const candidates: PearlCandidate[] = [];

    for (const item of parsed) {
      const condition = conditions.find((c) => c.name === item.conditionName);
      if (!condition) continue;

      for (const p of item.pearls || []) {
        candidates.push({
          pearlText: p.text.trim(),
          fullExplanation: p.explanation,
          system: condition.system,
          category: p.category,
          tags: p.tags || [],
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
 * Get known high-yield pearls
 */
function getKnownPearls(): PearlCandidate[] {
  const candidates: PearlCandidate[] = [];

  for (const [system, pearls] of Object.entries(KNOWN_PEARLS)) {
    for (const p of pearls) {
      candidates.push({
        pearlText: p.pearl,
        fullExplanation: p.explanation,
        system,
        category: p.category,
        tags: p.tags || [],
        source: 'known',
      });
    }
  }

  return candidates;
}

/**
 * Check if pearl already exists (fuzzy match)
 */
async function pearlExists(pearlText: string): Promise<boolean> {
  // Normalize for comparison
  const normalized = pearlText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .substring(0, 50);

  const existing = await prisma.clinicalPearl.findFirst({
    where: {
      pearlText: {
        contains: normalized.substring(0, 30),
        mode: 'insensitive',
      },
    },
  });
  return !!existing;
}

/**
 * Phase 1: Analyze current state
 */
async function analyzeState() {
  console.log('\n📊 Analyzing Current State\n');

  const pearlCount = await prisma.clinicalPearl.count();
  const conditionCount = await prisma.condition.count();

  const bySystem = await prisma.clinicalPearl.groupBy({
    by: ['system'],
    _count: true,
    orderBy: { _count: { system: 'desc' } },
  });

  console.log(`  Total Clinical Pearls: ${pearlCount}`);
  console.log(`  Total Conditions: ${conditionCount}`);

  if (bySystem.length > 0) {
    console.log('\n  Pearls by System:');
    for (const s of bySystem) {
      console.log(`    ${s.system}: ${s._count}`);
    }
  }

  const byCategory = await prisma.clinicalPearl.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });

  if (byCategory.length > 0) {
    console.log('\n  Pearls by Category:');
    for (const c of byCategory) {
      console.log(`    ${c.category || 'uncategorized'}: ${c._count}`);
    }
  }

  const samples = await prisma.clinicalPearl.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  if (samples.length > 0) {
    console.log('\n  Recent Pearls:');
    for (const s of samples) {
      console.log(`    [${s.system}] ${s.pearlText.substring(0, 80)}...`);
    }
  }
}

/**
 * Phase 2: Insert known high-yield pearls
 */
async function insertKnownPearls(dryRun: boolean) {
  console.log('\n🔍 Inserting Known High-Yield Clinical Pearls\n');

  const known = getKnownPearls();
  console.log(
    `  Found ${known.length} known high-yield pearls across ${Object.keys(KNOWN_PEARLS).length} systems`
  );

  let inserted = 0;
  let skipped = 0;

  for (const candidate of known) {
    const exists = await pearlExists(candidate.pearlText);

    if (exists) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  [DRY RUN] Would insert: [${candidate.system}] ${candidate.pearlText.substring(0, 60)}...`
      );
      inserted++;
    } else {
      await prisma.clinicalPearl.create({
        data: {
          id: uuidv4(),
          pearlText: candidate.pearlText,
          fullExplanation: candidate.fullExplanation,
          system: candidate.system,
          category: candidate.category,
          tags: candidate.tags,
        } as any,
      });
      console.log(`  ✅ [${candidate.system}] ${candidate.pearlText.substring(0, 60)}...`);
      inserted++;
    }
  }

  console.log(`\n  Summary: ${inserted} inserted, ${skipped} already existed`);
}

/**
 * Phase 3: Generate AI pearls for conditions
 */
async function generateAIPearlsForConditions(dryRun: boolean, batchSize: number) {
  console.log('\n🤖 Generating AI Clinical Pearls for Conditions\n');

  // Get all conditions from MedicalContent
  const allConditions = await prisma.medicalContent.findMany({
    select: {
      condition: true,
      system: true,
      overview: true,
      treatment: true,
      diagnostics: true,
      prognosis: true,
    },
  });

  console.log(`  Processing ${allConditions.length} conditions in batches of ${batchSize}`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < allConditions.length; i += batchSize) {
    const batch = allConditions.slice(i, i + batchSize);
    console.log(
      `\n  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allConditions.length / batchSize)} (${batch.length} conditions)...`
    );

    const conditionsForAI = batch.map((c) => ({
      name: c.condition,
      system: c.system,
      content: {
        overview: c.overview,
        treatment: c.treatment,
        diagnostics: c.diagnostics,
        prognosis: c.prognosis,
      },
    }));

    try {
      const candidates = await generateAIPearls(conditionsForAI);
      console.log(`    AI generated ${candidates.length} pearl candidates`);

      for (const candidate of candidates) {
        const exists = await pearlExists(candidate.pearlText);

        if (exists) {
          totalSkipped++;
          continue;
        }

        if (dryRun) {
          console.log(
            `    [DRY RUN] Would insert: [${candidate.system}] ${candidate.pearlText.substring(0, 50)}...`
          );
          totalInserted++;
        } else {
          await prisma.clinicalPearl.create({
            data: {
              id: uuidv4(),
              pearlText: candidate.pearlText,
              fullExplanation: candidate.fullExplanation,
              system: candidate.system,
              category: candidate.category,
              tags: candidate.tags,
            } as any,
          });
          console.log(`    ✅ [${candidate.system}] ${candidate.pearlText.substring(0, 50)}...`);
          totalInserted++;
        }
      }
    } catch (e: any) {
      console.error(`    ❌ Error processing batch:`, e.message || e);
    }

    // Small delay between batches
    if (i + batchSize < allConditions.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n  Summary: ${totalInserted} inserted, ${totalSkipped} skipped (duplicates)`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const analyzeOnly = args.includes('--analyze');
  const knownOnly = args.includes('--known-only');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 20;

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        🩺 CLINICAL PEARL DOCTOR - High-Yield Generator         ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  const modeText = dryRun
    ? 'DRY RUN (no changes)'
    : analyzeOnly
      ? 'ANALYZE ONLY'
      : 'LIVE (will make changes)';
  console.log(`║  Mode: ${modeText.padEnd(55)}║`);
  console.log(`║  Batch Size: ${batchSize.toString().padEnd(50)}║`);
  console.log(
    `║  AI Generation: ${knownOnly ? 'DISABLED (known only)' : 'ENABLED'}${' '.repeat(knownOnly ? 33 : 42)}║`
  );
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    await analyzeState();

    if (analyzeOnly) {
      return;
    }

    await insertKnownPearls(dryRun);

    if (!knownOnly) {
      await generateAIPearlsForConditions(dryRun, batchSize);
    }

    console.log('\n📈 FINAL STATE:');
    await analyzeState();

    console.log('\n✨ Clinical Pearl Doctor complete!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
