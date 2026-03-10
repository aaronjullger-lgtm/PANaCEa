#!/usr/bin/env npx tsx
/**
 * Phase 1c: Subcategorize "Uncategorized" Conditions
 *
 * Two-pass approach:
 * 1. Rule-based keyword matching (~80% coverage)
 * 2. Gemini AI for remaining ambiguous cases
 *
 * Usage: npx tsx scripts/fixes/phase1c-subcategorize.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

const DRY_RUN = process.argv.includes('--dry-run');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Keyword maps: subcategory -> keywords/patterns (case-insensitive)
const KEYWORD_MAPS: Record<string, Record<string, string[]>> = {
  CV: {
    'Coronary Artery Disease': ['angina', 'myocardial infarction', 'STEMI', 'NSTEMI', 'ACS', 'coronary'],
    'Heart Failure': ['heart failure', 'cardiomyopathy', 'systolic dysfunction', 'diastolic dysfunction'],
    'Arrhythmias': ['fibrillation', 'flutter', 'tachycardia', 'bradycardia', 'SVT', 'VT', 'VF', 'arrhythmia', 'Wolff-Parkinson', 'WPW', 'long QT', 'Brugada'],
    'Conduction Disorders / Dysrhythmias': ['AV block', 'bundle branch', 'sick sinus'],
    'Valvular Disorders': ['stenosis', 'regurgitation', 'prolapse', 'endocarditis', 'valve', 'mitral', 'aortic', 'tricuspid', 'pulmonic'],
    'Vascular Disease': ['aneurysm', 'dissection', 'DVT', 'thrombosis', 'embolism', 'PAD', 'peripheral artery', 'varicose', 'venous'],
    'Hypertension': ['hypertension', 'hypertensive'],
    'Pericardial Disorders': ['pericarditis', 'tamponade', 'pericardial'],
    'Congenital Heart Disease': ['septal defect', 'tetralogy', 'coarctation', 'PDA', 'ASD', 'VSD', 'congenital'],
    'Shock': ['shock', 'cardiogenic'],
  },
  PULM: {
    'Obstructive Pulmonary Diseases': ['asthma', 'COPD', 'emphysema', 'bronchitis', 'bronchiectasis', 'cystic fibrosis'],
    'Restrictive Pulmonary Diseases': ['fibrosis', 'sarcoidosis', 'restrictive', 'interstitial', 'pneumoconiosis', 'asbestosis', 'silicosis'],
    'Infectious Disorders': ['pneumonia', 'tuberculosis', 'TB', 'influenza', 'COVID', 'bronchiolitis', 'croup', 'pertussis', 'abscess'],
    'Pleural Disorders': ['pleural effusion', 'pneumothorax', 'empyema', 'mesothelioma', 'chylothorax'],
    'Pulmonary Circulation': ['pulmonary embolism', 'pulmonary hypertension', 'cor pulmonale'],
    'Neoplasms': ['lung cancer', 'carcinoma', 'neoplasm', 'nodule', 'mesothelioma'],
    'Sleep-Disordered Breathing': ['sleep apnea', 'OSA', 'narcolepsy'],
    'Occupational / Environmental': ['occupational', 'asbestosis', 'silicosis', 'hypersensitivity pneumonitis'],
  },
  GI: {
    'Esophageal Disorders': ['esophag', 'GERD', 'achalasia', 'Barrett', 'dysphagia', 'Zenker', 'Mallory-Weiss', 'Boerhaave'],
    'Gastric Disorders': ['gastric', 'gastritis', 'peptic ulcer', 'PUD', 'gastroparesis', 'H. pylori', 'Zollinger'],
    'Hepatic Disorders': ['hepat', 'cirrhosis', 'liver', 'Wilson', 'hemochromatosis', 'Gilbert', 'ascites', 'portal hypertension', 'jaundice'],
    'Biliary Disorders': ['cholelithiasis', 'cholecystitis', 'cholangitis', 'gallstone', 'biliary', 'gallbladder'],
    'Pancreatic Disorders': ['pancreati', 'pancreat'],
    'Small Bowel Disorders': ['Crohn', 'celiac', 'small bowel', 'malabsorption', 'Meckel', 'intussusception', 'volvulus', 'SBO'],
    'Colorectal Disorders': ['colitis', 'diverticular', 'diverticul', 'colorectal', 'colon', 'polyp', 'rectal', 'hemorrhoid', 'fissure', 'fistula', 'IBS', 'irritable bowel', 'megacolon', 'hirschsprung'],
    'GI Bleeding': ['GI bleed', 'upper GI', 'lower GI', 'melena', 'hematochezia'],
    'Hernias': ['hernia', 'inguinal', 'femoral', 'umbilical', 'hiatal', 'incisional'],
    'Anorectal Disorders': ['anal', 'perianal', 'pilonidal', 'pruritus ani', 'rectal prolapse'],
    'Infectious GI': ['C. diff', 'clostridium', 'salmonella', 'shigella', 'norovirus', 'rotavirus', 'traveler', 'food poisoning', 'gastroenteritis', 'appendicitis', 'peritonitis', 'SBP'],
    'Neoplasms': ['cancer', 'carcinoma', 'adenocarcinoma', 'neoplasm', 'tumor'],
  },
  NEURO: {
    'Cerebrovascular Disorders': ['stroke', 'TIA', 'hemorrhage', 'subarachnoid', 'cerebral', 'aneurysm', 'AVM', 'cavernous sinus'],
    'Seizure Disorders': ['seizure', 'epilepsy', 'status epilepticus', 'febrile'],
    'Headache Disorders': ['headache', 'migraine', 'cluster', 'tension', 'temporal arteritis'],
    'Demyelinating Disorders': ['multiple sclerosis', 'MS', 'demyelinat', 'Guillain-Barré', 'ADEM', 'optic neuritis'],
    'Movement Disorders': ['Parkinson', 'tremor', 'Huntington', 'dystonia', 'chorea', 'tardive', 'essential tremor', 'restless leg', 'Tourette'],
    'Neuromuscular Disorders': ['myasthenia', 'ALS', 'muscular dystrophy', 'neuropathy', 'radiculopathy', 'plexopathy', 'carpal tunnel', 'peripheral neuropathy'],
    'Infectious Disorders': ['meningitis', 'encephalitis', 'brain abscess', 'prion', 'rabies', 'polio'],
    'Trauma': ['concussion', 'TBI', 'epidural', 'subdural', 'spinal cord', 'cord syndrome', 'Brown-Sequard'],
    'Cognitive Disorders': ['dementia', 'Alzheimer', 'Lewy body', 'delirium', 'vascular dementia', 'normal pressure hydrocephalus'],
    'Cranial Nerve Disorders': ['cranial nerve', 'Bell palsy', 'trigeminal', 'facial nerve'],
    'Neoplasms': ['brain tumor', 'glioblastoma', 'meningioma', 'acoustic neuroma'],
    'Spinal Disorders': ['spinal stenosis', 'syringomyelia', 'cord compression', 'myelopathy', 'cauda equina'],
  },
  MSK: {
    'Trauma / Fractures': ['fracture', 'dislocation', 'luxation', 'sprain', 'strain', 'contusion', 'compartment syndrome'],
    'Joint Disorders': ['osteoarthritis', 'rheumatoid', 'gout', 'pseudogout', 'septic arthritis', 'reactive arthritis', 'psoriatic arthritis', 'juvenile', 'bursitis'],
    'Spinal Disorders': ['scoliosis', 'kyphosis', 'spondyl', 'disc herniation', 'sciatica', 'stenosis', 'back pain', 'ankylosing'],
    'Upper Extremity Disorders': ['shoulder', 'rotator', 'tennis elbow', 'golfer', 'carpal', 'de Quervain', 'Dupuytren', 'trigger finger', 'epicondylitis'],
    'Lower Extremity Disorders': ['ACL', 'MCL', 'meniscus', 'patella', 'Osgood', 'plantar fasciitis', 'Achilles', 'shin splint', 'femoral', 'tibial', 'hip', 'knee', 'ankle', 'foot'],
    'Bone Disorders': ['osteomyelitis', 'osteosarcoma', 'Paget', 'osteogenesis', 'rickets', 'osteomalacia'],
    'Metabolic Bone Diseases': ['osteoporosis', 'osteopenia'],
    'Soft Tissue Disorders': ['ganglion', 'myositis', 'fibromyalgia', 'rhabdomyolysis', 'tendonitis', 'fasciitis'],
    'Autoimmune / Inflammatory': ['lupus', 'SLE', 'polymyalgia', 'dermatomyositis', 'vasculitis', 'scleroderma'],
    'Pediatric Orthopedics': ['Legg', 'Perthes', 'Osgood-Schlatter', 'developmental dysplasia', 'clubfoot', 'nursemaid'],
  },
  HEENT: {
    'Ear - External': ['otitis externa', 'cerumen', 'exostosis', 'auricular'],
    'Ear - Middle': ['otitis media', 'cholesteatoma', 'tympanosclerosis', 'eustachian'],
    'Ear - Inner': ['vertigo', 'Meniere', 'labyrinthitis', 'vestibular', 'BPPV', 'hearing loss', 'sensorineural', 'conductive', 'tinnitus', 'acoustic neuroma'],
    'Ear Disorders': ['tympanic membrane', 'perforation'],
    'Nose / Sinus': ['sinusitis', 'rhinitis', 'epistaxis', 'nasal', 'septal', 'polyp'],
    'Oropharyngeal - Infectious/Inflammatory': ['pharyngitis', 'tonsillitis', 'epiglottitis', 'peritonsillar', 'retropharyngeal', 'Ludwig', 'mononucleosis', 'thrush', 'oral candidiasis'],
    'Dental / Oral': ['dental', 'caries', 'gingivitis', 'periodontitis', 'abscess', 'tooth', 'aphthous', 'leukoplakia', 'oral cancer'],
    'Eye - Anterior Segment': ['conjunctivitis', 'keratitis', 'corneal', 'uveitis', 'iritis', 'glaucoma', 'cataract', 'pterygium', 'pinguecula', 'blepharitis', 'chalazion', 'hordeolum', 'stye', 'dry eye'],
    'Eye - Posterior Segment': ['retinal detachment', 'macular degeneration', 'diabetic retinopathy', 'retinopathy', 'vitreous', 'retinal vein', 'retinal artery'],
    'Eye - Neuro-ophthalmologic': ['optic neuritis', 'papilledema', 'pupil', 'nystagmus', 'diplopia', 'cranial nerve'],
    'Neck / Salivary': ['thyroid', 'salivary', 'parotitis', 'sialadenitis', 'ranula', 'neck mass', 'lymphadenopathy'],
    'Trauma': ['orbital fracture', 'hyphema', 'corneal abrasion', 'chemical burn', 'foreign body'],
  },
  REPRO: {
    'Pregnancy': ['gestational', 'preeclampsia', 'eclampsia', 'ectopic', 'molar', 'hyperemesis', 'placenta', 'HELLP', 'Rh incompatibility', 'TORCH', 'gestational diabetes'],
    'Labor and Delivery': ['labor', 'delivery', 'cesarean', 'induction', 'breech', 'shoulder dystocia', 'cord prolapse', 'prolonged labor'],
    'Postpartum': ['postpartum', 'puerperal', 'mastitis', 'lactation', 'endometritis'],
    'Obstetric Emergencies': ['placental abruption', 'uterine rupture', 'amniotic fluid embolism', 'cord prolapse', 'postpartum hemorrhage'],
    'Menstrual Disorders': ['amenorrhea', 'dysmenorrhea', 'menorrhagia', 'metrorrhagia', 'PMS', 'PMDD', 'menopause', 'endometriosis', 'adenomyosis'],
    'Uterine Disorders': ['fibroids', 'leiomyoma', 'endometrial', 'uterine prolapse', 'Asherman'],
    'Ovarian Disorders': ['ovarian cyst', 'PCOS', 'ovarian torsion', 'ovarian cancer'],
    'Cervical Disorders': ['cervical cancer', 'cervicitis', 'cervical dysplasia', 'Pap', 'HPV'],
    'Breast Disorders': ['breast cancer', 'mastitis', 'fibrocystic', 'fibroadenoma', 'gynecomastia', 'breast mass', 'galactorrhea'],
    'Infectious Diseases': ['vaginitis', 'vulvovaginitis', 'PID', 'bartholin', 'vaginal discharge'],
    'Sexually Transmitted Infections': ['chlamydia', 'gonorrhea', 'syphilis', 'herpes', 'HPV', 'trichomon'],
    'Male Reproductive': ['erectile', 'cryptorchidism', 'varicocele', 'hydrocele', 'phimosis', 'paraphimosis'],
    'Contraception / Family Planning': ['contraception', 'IUD', 'sterilization', 'vasectomy'],
  },
  PSYCH: {
    'Depressive Disorders': ['depression', 'MDD', 'dysthymia', 'persistent depressive'],
    'Bipolar Disorders': ['bipolar', 'mania', 'cyclothymia'],
    'Anxiety Disorders': ['anxiety', 'GAD', 'panic', 'phobia', 'agoraphobia', 'social anxiety', 'selective mutism'],
    'Psychotic Disorders': ['schizophrenia', 'psychosis', 'schizoaffective', 'delusional disorder', 'brief psychotic'],
    'Personality Disorders': ['personality disorder', 'borderline', 'narcissistic', 'antisocial', 'histrionic', 'avoidant', 'dependent', 'obsessive-compulsive personality', 'schizoid', 'schizotypal', 'paranoid personality'],
    'Substance Use Disorders': ['alcohol', 'opioid', 'cocaine', 'cannabis', 'amphetamine', 'benzodiazepine', 'nicotine', 'withdrawal', 'intoxication', 'substance', 'delirium tremens'],
    'Eating Disorders': ['anorexia', 'bulimia', 'binge', 'avoidant/restrictive', 'ARFID', 'pica', 'rumination'],
    'Neurodevelopmental Disorders': ['ADHD', 'autism', 'intellectual disability', 'learning disorder', 'Tourette'],
    'Trauma / Stressor-Related': ['PTSD', 'adjustment', 'acute stress', 'reactive attachment'],
    'Somatic Disorders': ['somatic', 'conversion', 'illness anxiety', 'factitious', 'Munchausen', 'malingering'],
    'Sleep Disorders': ['insomnia', 'sleep', 'narcolepsy', 'restless leg', 'circadian'],
    'OCD / Related': ['OCD', 'obsessive-compulsive', 'body dysmorphic', 'hoarding', 'trichotillomania', 'excoriation'],
    'Dissociative Disorders': ['dissociative', 'depersonalization', 'derealization'],
    'Abuse and Neglect': ['abuse', 'neglect', 'domestic violence', 'elder abuse', 'child abuse'],
  },
  DERM: {
    'Infectious Diseases': ['cellulitis', 'abscess', 'impetigo', 'folliculitis', 'herpes', 'varicella', 'tinea', 'candida', 'scabies', 'lice', 'warts', 'molluscum', 'MRSA', 'necrotizing fasciitis'],
    'Papulosquamous Disorders': ['psoriasis', 'eczema', 'dermatitis', 'lichen', 'seborrheic', 'pityriasis'],
    'Neoplasms': ['melanoma', 'basal cell', 'squamous cell', 'actinic keratosis', 'Kaposi', 'mycosis fungoides'],
    'Autoimmune / Blistering': ['pemphigus', 'pemphigoid', 'lupus', 'dermatomyositis', 'scleroderma', 'morphea', 'vitiligo'],
    'Drug Reactions': ['Stevens-Johnson', 'TEN', 'DRESS', 'erythema multiforme', 'drug eruption', 'fixed drug', 'urticaria'],
    'Vascular Lesions': ['hemangioma', 'port-wine', 'telangiectasia', 'livedo', 'vasculitis'],
    'Pigmentation Disorders': ['vitiligo', 'melasma', 'albinism', 'hyperpigmentation', 'hypopigmentation'],
    'Hair / Nail Disorders': ['alopecia', 'hirsutism', 'onychomycosis', 'paronychia', 'nail'],
    'Benign Growths': ['seborrheic keratosis', 'dermatofibroma', 'lipoma', 'cyst', 'keloid', 'skin tag', 'nevus', 'mole'],
    'Burns / Wound Care': ['burn', 'sunburn', 'wound', 'pressure ulcer', 'decubitus'],
    'Bites and Stings': ['bite', 'sting', 'spider', 'tick', 'snake'],
    'Acne / Rosacea': ['acne', 'rosacea'],
  },
  ENDO: {
    'Diabetes Mellitus': ['diabetes', 'DKA', 'HHS', 'hypoglycemia', 'insulin resistance', 'metabolic syndrome'],
    'Thyroid Disorders': ['thyroid', 'hypothyroid', 'hyperthyroid', 'Graves', 'Hashimoto', 'thyroiditis', 'thyroid nodule', 'thyroid cancer'],
    'Adrenal Disorders': ['adrenal', 'Addison', 'Cushing', 'pheochromocytoma', 'hyperaldosteronism', 'Conn'],
    'Pituitary Disorders': ['pituitary', 'acromegaly', 'prolactinoma', 'SIADH', 'diabetes insipidus', 'Sheehan', 'growth hormone'],
    'Parathyroid / Calcium Disorders': ['hyperparathyroid', 'hypoparathyroid', 'parathyroid', 'hypercalcemia', 'hypocalcemia'],
    'Reproductive Endocrine': ['PCOS', 'hypogonadism', 'precocious puberty', 'delayed puberty', 'amenorrhea', 'infertility', 'Turner', 'Klinefelter'],
    'Metabolic / Genetic Disorders': ['phenylketonuria', 'galactosemia', 'glycogen storage', 'MEN', 'multiple endocrine', 'carcinoid'],
    'Nutritional Deficiencies': ['vitamin', 'deficiency', 'scurvy', 'rickets', 'beriberi', 'pellagra', 'kwashiorkor', 'marasmus'],
    'Lipid Disorders': ['hyperlipidemia', 'dyslipidemia', 'familial hypercholesterolemia'],
  },
  RENAL: {
    'Acute Kidney Injury': ['acute kidney injury', 'AKI', 'acute tubular necrosis', 'ATN', 'prerenal', 'postrenal'],
    'Chronic Kidney Disease': ['chronic kidney', 'CKD', 'ESRD', 'uremia', 'dialysis'],
    'Glomerular Disorders': ['glomerulonephritis', 'nephrotic', 'nephritic', 'IgA', 'membranous', 'focal segmental', 'minimal change', 'Goodpasture', 'Alport'],
    'Tubular / Interstitial Disorders': ['interstitial nephritis', 'Fanconi', 'renal tubular acidosis', 'RTA', 'polycystic kidney'],
    'Fluid and Electrolyte Imbalances': ['hypernatremia', 'hyponatremia', 'hyperkalemia', 'hypokalemia', 'hypermagnesemia', 'hypomagnesemia', 'hyperphosphatemia', 'hypophosphatemia', 'dehydration', 'fluid overload'],
    'Acid-Base Disorders': ['acidosis', 'alkalosis', 'acid-base', 'anion gap'],
    'Obstructive Uropathy': ['hydronephrosis', 'obstruction', 'urolithiasis', 'kidney stone', 'nephrolithiasis', 'renal colic'],
    'Renovascular Disorders': ['renal artery', 'renal vein', 'renovascular'],
    'Infectious Diseases': ['pyelonephritis', 'UTI', 'urinary tract infection', 'perinephric abscess'],
    'Neoplasms': ['renal cell carcinoma', 'Wilms tumor', 'kidney cancer'],
  },
  HEME: {
    'Anemias': ['anemia', 'iron deficiency', 'B12', 'folate', 'sickle cell', 'thalassemia', 'spherocytosis', 'G6PD', 'aplastic', 'hemolytic'],
    'Coagulation Disorders': ['hemophilia', 'DIC', 'von Willebrand', 'coagulopathy', 'factor deficiency', 'anticoagulant'],
    'Platelet Disorders': ['thrombocytopenia', 'ITP', 'TTP', 'HUS', 'thrombocytosis'],
    'White Blood Cell Disorders': ['leukocytosis', 'neutropenia', 'agranulocytosis', 'eosinophilia'],
    'Lymphoproliferative Disorders': ['lymphoma', 'Hodgkin', 'non-Hodgkin', 'CLL', 'Waldenstrom'],
    'Myeloproliferative Disorders': ['leukemia', 'AML', 'CML', 'ALL', 'polycythemia vera', 'essential thrombocythemia', 'myelofibrosis', 'myelodysplastic'],
    'Transfusion Medicine': ['transfusion', 'blood type', 'hemolytic transfusion'],
    'Thrombotic Disorders': ['hypercoagulable', 'Factor V Leiden', 'antiphospholipid', 'protein C', 'protein S'],
  },
  ID: {
    'Bacterial Diseases': ['staphylococc', 'streptococc', 'E. coli', 'salmonella', 'shigella', 'C. diff', 'pertussis', 'diphtheria', 'tetanus', 'botulism', 'anthrax', 'cholera', 'brucella', 'legionella', 'listeria', 'nocardia', 'actinomyces'],
    'Viral Diseases': ['influenza', 'HIV', 'hepatitis', 'EBV', 'CMV', 'HSV', 'varicella', 'measles', 'mumps', 'rubella', 'RSV', 'COVID', 'dengue', 'Zika', 'Ebola', 'rabies', 'West Nile'],
    'Fungal Diseases': ['candida', 'aspergill', 'histoplasm', 'coccidioid', 'blastomyc', 'crypto', 'pneumocystis', 'sporotrich', 'mucor', 'dermatophyte'],
    'Parasitic Diseases': ['malaria', 'toxoplasm', 'giardia', 'amoeb', 'cryptosporidium', 'trichomonas', 'pinworm', 'hookworm', 'tapeworm', 'ascaris', 'strongyloid', 'schistosom', 'leishmania', 'trypanosoma', 'Chagas'],
    'Tick-Borne Diseases': ['Lyme', 'Rocky Mountain', 'ehrlichiosis', 'anaplasmosis', 'babesiosis', 'tularemia'],
    'Sexually Transmitted Infections': ['syphilis', 'gonorrhea', 'chlamydia', 'HPV', 'herpes simplex', 'trichomon', 'lymphogranuloma'],
    'Systemic Infections / Sepsis': ['sepsis', 'septic shock', 'bacteremia', 'endocarditis', 'osteomyelitis', 'abscess', 'cellulitis', 'necrotizing'],
    'Healthcare-Associated Infections': ['MRSA', 'VRE', 'Clostridium', 'catheter-associated', 'ventilator-associated', 'surgical site'],
    'Immunodeficiency / Opportunistic': ['HIV', 'AIDS', 'immunocompromised', 'transplant', 'opportunistic'],
    'Zoonotic / Travel': ['zoonotic', 'travel', 'tropical'],
  },
  GU: {
    'Bladder Disorders': ['bladder', 'cystitis', 'interstitial cystitis', 'overactive bladder', 'neurogenic bladder', 'bladder cancer'],
    'Prostate Disorders': ['BPH', 'prostatitis', 'prostate cancer', 'prostatic'],
    'Penile / Urethral Disorders': ['phimosis', 'paraphimosis', 'balanitis', 'urethritis', 'urethral stricture', 'Peyronie', 'priapism'],
    'Testicular / Scrotal Disorders': ['testicular torsion', 'hydrocele', 'varicocele', 'epididymitis', 'orchitis', 'cryptorchidism', 'testicular cancer', 'spermatocele'],
    'Urinary Incontinence': ['incontinence', 'stress incontinence', 'urge incontinence'],
    'Pelvic Floor Disorders': ['pelvic organ prolapse', 'cystocele', 'rectocele'],
    'Infectious Diseases': ['UTI', 'urinary tract infection', 'pyelonephritis', 'urethritis'],
    'Neoplasms': ['renal cell', 'bladder cancer', 'testicular cancer', 'prostate cancer', 'Wilms'],
    'Urolithiasis': ['kidney stone', 'nephrolithiasis', 'urolithiasis', 'renal colic', 'ureteral stone'],
  },
};

function matchSubcategory(conditionName: string, system: string): string | null {
  const keywords = KEYWORD_MAPS[system];
  if (!keywords) return null;

  const nameLower = conditionName.toLowerCase();

  for (const [subcategory, patterns] of Object.entries(keywords)) {
    for (const pattern of patterns) {
      if (nameLower.includes(pattern.toLowerCase())) {
        return subcategory;
      }
    }
  }

  return null;
}

async function assignWithAI(conditions: Array<{ id: string; condition: string; system: string }>, system: string): Promise<Map<string, string>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Get existing subcategories for this system
  const existingSubcats = await prisma.medicalContent.groupBy({
    by: ['subcategory'],
    where: { system, subcategory: { not: 'Uncategorized' } },
    _count: true,
  });
  const subcatList = existingSubcats.map((s) => s.subcategory).join(', ');

  const conditionNames = conditions.map((c) => c.condition).join('\n- ');

  const prompt = `You are a medical educator. Assign each condition below to the most appropriate subcategory.

System: ${system}
Existing subcategories for this system: ${subcatList}

Conditions to categorize:
- ${conditionNames}

Return a JSON object mapping each condition name (exactly as given) to its subcategory.
Use ONLY the existing subcategories listed above. If none fit well, you may create a new appropriate subcategory name.

Return ONLY valid JSON, no markdown:
{"Condition Name": "Subcategory", ...}`;

  try {
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return new Map();
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

    const parsed = JSON.parse(jsonStr) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.error(`    AI error for ${system}: ${error}`);
    return new Map();
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 1c: Subcategorize "Uncategorized" Conditions       ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  const uncategorized = await prisma.medicalContent.findMany({
    where: { subcategory: 'Uncategorized' },
    select: { id: true, condition: true, system: true, conditionId: true },
    orderBy: [{ system: 'asc' }, { condition: 'asc' }],
  });

  console.log(`\nTotal uncategorized: ${uncategorized.length}\n`);

  let ruleMatched = 0;
  let aiMatched = 0;
  let unmatched = 0;

  // Group by system
  const bySystem = new Map<string, typeof uncategorized>();
  for (const mc of uncategorized) {
    const list = bySystem.get(mc.system) || [];
    list.push(mc);
    bySystem.set(mc.system, list);
  }

  for (const [system, conditions] of bySystem) {
    console.log(`\n--- ${system} (${conditions.length} uncategorized) ---`);

    const needsAI: typeof conditions = [];

    // Pass 1: Rule-based matching
    for (const mc of conditions) {
      const subcategory = matchSubcategory(mc.condition, system);
      if (subcategory) {
        console.log(`  ✅ [rule] "${mc.condition}" -> "${subcategory}"`);
        if (!DRY_RUN) {
          await prisma.medicalContent.update({
            where: { id: mc.id },
            data: { subcategory },
          });
          try {
            await prisma.condition.update({
              where: { id: mc.conditionId },
              data: { subcategory },
            });
          } catch { /* ignore */ }
        }
        ruleMatched++;
      } else {
        needsAI.push(mc);
      }
    }

    // Pass 2: AI for remaining
    if (needsAI.length > 0) {
      console.log(`  🤖 Sending ${needsAI.length} to AI for ${system}...`);
      const aiResults = await assignWithAI(needsAI, system);

      for (const mc of needsAI) {
        const subcategory = aiResults.get(mc.condition);
        if (subcategory && subcategory !== 'Uncategorized') {
          console.log(`  ✅ [AI] "${mc.condition}" -> "${subcategory}"`);
          if (!DRY_RUN) {
            await prisma.medicalContent.update({
              where: { id: mc.id },
              data: { subcategory },
            });
            try {
              await prisma.condition.update({
                where: { id: mc.conditionId },
                data: { subcategory },
              });
            } catch { /* ignore */ }
          }
          aiMatched++;
        } else {
          console.log(`  ❓ UNMATCHED: "${mc.condition}" (${system})`);
          unmatched++;
        }
      }
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Rule-matched: ${ruleMatched}`);
  console.log(`AI-matched: ${aiMatched}`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`Total processed: ${ruleMatched + aiMatched + unmatched}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
