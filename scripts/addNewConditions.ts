// scripts/addNewConditions.ts
// Script to add new medical conditions to conditionContent.correct.json using Gemini

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = 'gemini-2.5-pro';
const OUTPUT_FILE = path.resolve('conditionContent.correct.json');
const MAX_RETRIES = 3;
const MAX_CONCURRENCY = 2;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay

// ======================================================
// API KEY (optional - if not provided, will use placeholder content)
// ======================================================
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

let client: GoogleGenerativeAI | null = null;
let model: any = null;

if (apiKey) {
  client = new GoogleGenerativeAI(apiKey);
  model = client.getGenerativeModel({ model: MODEL_NAME });
  console.log('✅ Gemini API key found - will generate content with AI');
} else {
  console.log('[WARNING] No Gemini API key found - will use placeholder content');
}

// ======================================================
// ASCII CLEANER
// ======================================================
function asciiClean(str: string = ''): string {
  return str
    .normalize('NFKC')
    .replace(/[""„‟]/g, '"')
    .replace(/[''‚‛]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x00-\x7F]/g, '');
}

// ======================================================
// GENERATE CONDITION KEY
// ======================================================
function generateConditionKey(system: string, subcategory: string, condition: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  return `${system}__${normalize(subcategory)}__${normalize(condition)}`;
}

// ======================================================
// CONDITION INTERFACE
// ======================================================
interface ConditionContent {
  diagnostics: { notes?: string };
  overview: string;
  etiologyPathophysiology: string;
  epidemiology: string;
  riskFactors?: string[];
  clinicalPresentation: string;
  symptoms?: string[];
  examFindings?: string[];
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis: string;
  aliases?: string[];
}

interface NewCondition {
  system: string;
  subcategory: string;
  condition: string;
  aliases?: string[];
}

// ======================================================
// NEW CONDITIONS TO ADD
// ======================================================
const NEW_CONDITIONS: NewCondition[] = [
  // =====================================================
  // PSYCHIATRY & BEHAVIORAL - New 2025 Blueprint additions
  // =====================================================
  {
    system: 'PSYCH',
    subcategory: 'Trauma- and Stressor-Related Disorders',
    condition: 'Grief and Bereavement',
    aliases: ['Bereavement', 'Grief Disorder', 'Prolonged Grief Disorder'],
  },
  {
    system: 'PSYCH',
    subcategory: 'Abuse & Neglect',
    condition: 'Child Abuse and Neglect',
    aliases: ['Child Maltreatment', 'Pediatric Abuse'],
  },
  {
    system: 'PSYCH',
    subcategory: 'Abuse & Neglect',
    condition: 'Intimate Partner Violence',
    aliases: ['Domestic Violence', 'Domestic Abuse', 'IPV', 'Spousal Abuse'],
  },
  {
    system: 'PSYCH',
    subcategory: 'Abuse & Neglect',
    condition: 'Elder Abuse and Neglect',
    aliases: ['Elder Maltreatment', 'Geriatric Abuse'],
  },
  {
    system: 'PSYCH',
    subcategory: 'Abuse & Neglect',
    condition: 'Sexual Assault',
    aliases: ['Rape', 'Sexual Violence'],
  },
  {
    system: 'PSYCH',
    subcategory: 'Substance Use - Opioids',
    condition: 'Opioid Overdose',
    aliases: ['Opioid Toxicity', 'Narcotic Overdose'],
  },
  {
    system: 'PSYCH',
    subcategory: 'Somatic Symptom & Related Disorders',
    condition: 'Psychogenic Nonepileptic Seizures',
    aliases: ['PNES', 'Pseudoseizures', 'Nonepileptic Seizures', 'Functional Seizures'],
  },

  // =====================================================
  // HEENT - Eye Conditions
  // =====================================================
  {
    system: 'HEENT',
    subcategory: 'Eye - Cornea & Anterior Segment',
    condition: 'Corneal Abrasion',
    aliases: ['Scratched Cornea', 'Corneal Scratch'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Cornea & Anterior Segment',
    condition: 'Corneal Foreign Body',
    aliases: ['Foreign Body in Eye', 'Eye Foreign Body'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Lids & Lacrimal',
    condition: 'Ectropion',
    aliases: ['Outward Turning Eyelid'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Lids & Lacrimal',
    condition: 'Entropion',
    aliases: ['Inward Turning Eyelid'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Conjunctiva',
    condition: 'Pinguecula',
    aliases: ['Yellow Bump on Eye'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Conjunctiva',
    condition: 'Scleritis',
    aliases: ['Scleral Inflammation'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Retina',
    condition: 'Retinal Vascular Occlusion',
    aliases: ['Retinal Artery Occlusion', 'Retinal Vein Occlusion', 'Eye Stroke'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Optic Nerve',
    condition: 'Nystagmus',
    aliases: ['Involuntary Eye Movement', 'Dancing Eyes'],
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Optic Nerve',
    condition: 'Papilledema',
    aliases: ['Optic Disc Swelling', 'Optic Disc Edema'],
  },

  // =====================================================
  // HEENT - Ear Conditions
  // =====================================================
  {
    system: 'HEENT',
    subcategory: 'Ear - Middle',
    condition: 'Eustachian Tube Dysfunction',
    aliases: ['ETD', 'Blocked Eustachian Tube'],
  },
  {
    system: 'HEENT',
    subcategory: 'Ear - Middle',
    condition: 'Barotrauma',
    aliases: ['Ear Barotrauma', 'Pressure Injury to Ear', 'Airplane Ear'],
  },
  {
    system: 'HEENT',
    subcategory: 'Ear - Middle',
    condition: 'Otosclerosis',
    aliases: ['Otospongiosis', 'Stapes Fixation'],
  },
  {
    system: 'HEENT',
    subcategory: 'Ear - Inner / Vestibular',
    condition: 'Benign Paroxysmal Positional Vertigo',
    aliases: ['BPPV', 'Positional Vertigo'],
  },

  // =====================================================
  // HEENT - Nose/Sinus Conditions
  // =====================================================
  {
    system: 'HEENT',
    subcategory: 'Nose & Sinus',
    condition: 'Vasomotor Rhinitis',
    aliases: ['Non-Allergic Rhinitis', 'Idiopathic Rhinitis'],
  },

  // =====================================================
  // HEENT - Throat/Mouth Conditions
  // =====================================================
  {
    system: 'HEENT',
    subcategory: 'Throat & Pharynx',
    condition: 'Deep Neck Infection',
    aliases: ["Ludwig's Angina", 'Ludwigs Angina', 'Submandibular Space Infection'],
  },
  {
    system: 'HEENT',
    subcategory: 'Salivary Glands',
    condition: 'Sialolithiasis',
    aliases: ['Salivary Stone', 'Salivary Duct Stone', 'Salivary Calculus'],
  },
  {
    system: 'HEENT',
    subcategory: 'Salivary Glands',
    condition: 'Mumps Parotitis',
    aliases: ['Mumps', 'Epidemic Parotitis'],
  },
  {
    system: 'HEENT',
    subcategory: 'Oral Cavity',
    condition: 'Erythroplakia',
    aliases: ['Red Patch in Mouth', 'Oral Erythroplakia'],
  },

  // =====================================================
  // REPRODUCTIVE - Female Tract
  // =====================================================
  {
    system: 'REPRO',
    subcategory: 'Gynecology',
    condition: 'Uterine Prolapse',
    aliases: ['Prolapsed Uterus', 'Pelvic Organ Prolapse'],
  },
  {
    system: 'REPRO',
    subcategory: 'Gynecology',
    condition: 'Cystocele',
    aliases: ['Bladder Prolapse', 'Anterior Vaginal Wall Prolapse'],
  },
  {
    system: 'REPRO',
    subcategory: 'Gynecology',
    condition: 'Rectocele',
    aliases: ['Rectal Prolapse', 'Posterior Vaginal Wall Prolapse'],
  },
  {
    system: 'REPRO',
    subcategory: 'Vaginal Disorders',
    condition: 'Vaginitis',
    aliases: ['Vaginal Infection', 'Vaginal Inflammation'],
  },
  {
    system: 'REPRO',
    subcategory: 'Cervix / STI',
    condition: 'Cervical Cancer',
    aliases: ['Cervical Carcinoma', 'Cancer of the Cervix'],
  },
  {
    system: 'REPRO',
    subcategory: 'Gynecology',
    condition: 'Endometrial Hyperplasia',
    aliases: ['Thickened Uterine Lining', 'Uterine Hyperplasia'],
  },

  // =====================================================
  // REPRODUCTIVE - Breast
  // =====================================================
  {
    system: 'REPRO',
    subcategory: 'Breast',
    condition: 'Breast Cancer',
    aliases: ['Mammary Carcinoma', 'Breast Carcinoma', 'Carcinoma of the Breast'],
  },

  // =====================================================
  // REPRODUCTIVE - Menstruation
  // =====================================================
  {
    system: 'REPRO',
    subcategory: 'Menstrual Disorders',
    condition: 'Menopause',
    aliases: ['Climacteric', 'Change of Life'],
  },
  {
    system: 'REPRO',
    subcategory: 'Menstrual Disorders',
    condition: 'Atrophic Vaginitis',
    aliases: ['Vaginal Atrophy', 'Genitourinary Syndrome of Menopause', 'GSM'],
  },

  // =====================================================
  // REPRODUCTIVE - Pregnancy & Complications
  // =====================================================
  {
    system: 'REPRO',
    subcategory: 'Antepartum',
    condition: 'Molar Pregnancy',
    aliases: ['Hydatidiform Mole', 'Gestational Trophoblastic Disease'],
  },
  {
    system: 'REPRO',
    subcategory: 'Antepartum',
    condition: 'Rh Incompatibility',
    aliases: ['Rh Disease', 'Rhesus Incompatibility', 'Hemolytic Disease of the Newborn'],
  },
  {
    system: 'REPRO',
    subcategory: 'Early Pregnancy',
    condition: 'Spontaneous Abortion',
    aliases: ['Miscarriage', 'Pregnancy Loss'],
  },

  // =====================================================
  // REPRODUCTIVE - Male Specific
  // =====================================================
  {
    system: 'GU',
    subcategory: 'Penile',
    condition: 'Erectile Dysfunction',
    aliases: ['ED', 'Impotence', 'Male Sexual Dysfunction'],
  },
  {
    system: 'GU',
    subcategory: 'Testicular',
    condition: 'Cryptorchidism',
    aliases: ['Undescended Testicle', 'Undescended Testis'],
  },
  {
    system: 'GU',
    subcategory: 'Oncology',
    condition: 'Prostate Cancer',
    aliases: ['Prostatic Carcinoma', 'Carcinoma of the Prostate'],
  },

  // =====================================================
  // HEMATOLOGY - Anemias
  // =====================================================
  {
    system: 'HEME',
    subcategory: 'Anemia',
    condition: 'Sideroblastic Anemia',
    aliases: ['Refractory Anemia with Ring Sideroblasts'],
  },
  {
    system: 'HEME',
    subcategory: 'Anemia',
    condition: 'Lead Poisoning Anemia',
    aliases: ['Lead Toxicity Anemia', 'Plumbism'],
  },
  {
    system: 'HEME',
    subcategory: 'Hemolytic',
    condition: 'Pernicious Anemia',
    aliases: ['Vitamin B12 Deficiency Anemia', 'Megaloblastic Anemia'],
  },

  // =====================================================
  // HEMATOLOGY - Coagulation
  // =====================================================
  {
    system: 'HEME',
    subcategory: 'Coagulation',
    condition: 'Hemophilia A',
    aliases: ['Factor VIII Deficiency', 'Classic Hemophilia'],
  },
  {
    system: 'HEME',
    subcategory: 'Coagulation',
    condition: 'Hemophilia B',
    aliases: ['Factor IX Deficiency', 'Christmas Disease'],
  },
  {
    system: 'HEME',
    subcategory: 'Coagulation',
    condition: 'Von Willebrand Disease',
    aliases: ['VWD', 'Von Willebrand Factor Deficiency'],
  },
  {
    system: 'HEME',
    subcategory: 'Thrombosis',
    condition: 'Factor V Leiden',
    aliases: ['Factor V Leiden Mutation', 'Activated Protein C Resistance'],
  },
  {
    system: 'HEME',
    subcategory: 'Thrombosis',
    condition: 'Protein C Deficiency',
    aliases: ['Protein C Thrombophilia'],
  },
  {
    system: 'HEME',
    subcategory: 'Thrombosis',
    condition: 'Protein S Deficiency',
    aliases: ['Protein S Thrombophilia'],
  },

  // =====================================================
  // HEMATOLOGY - Platelets
  // =====================================================
  {
    system: 'HEME',
    subcategory: 'Platelet',
    condition: 'Idiopathic Thrombocytopenic Purpura',
    aliases: ['ITP', 'Immune Thrombocytopenic Purpura', 'Immune Thrombocytopenia'],
  },
  {
    system: 'HEME',
    subcategory: 'Platelet',
    condition: 'Thrombotic Thrombocytopenic Purpura',
    aliases: ['TTP', 'Moschcowitz Disease'],
  },
  {
    system: 'HEME',
    subcategory: 'Platelet',
    condition: 'Hemolytic Uremic Syndrome',
    aliases: ['HUS', 'Atypical HUS'],
  },
  {
    system: 'HEME',
    subcategory: 'Platelet',
    condition: 'Heparin-Induced Thrombocytopenia',
    aliases: ['HIT', 'Heparin-Induced Thrombocytopenia and Thrombosis'],
  },

  // =====================================================
  // HEMATOLOGY - Malignancy
  // =====================================================
  {
    system: 'HEME',
    subcategory: 'Leukemia',
    condition: 'Acute Lymphoblastic Leukemia',
    aliases: ['ALL', 'Acute Lymphocytic Leukemia'],
  },
  {
    system: 'HEME',
    subcategory: 'Leukemia',
    condition: 'Acute Myeloid Leukemia',
    aliases: ['AML', 'Acute Myelogenous Leukemia'],
  },
  {
    system: 'HEME',
    subcategory: 'Leukemia',
    condition: 'Chronic Lymphocytic Leukemia',
    aliases: ['CLL', 'Chronic Lymphoid Leukemia'],
  },
  {
    system: 'HEME',
    subcategory: 'Leukemia',
    condition: 'Chronic Myelogenous Leukemia',
    aliases: ['CML', 'Chronic Myeloid Leukemia'],
  },
  {
    system: 'HEME',
    subcategory: 'Plasma Cell',
    condition: 'Multiple Myeloma',
    aliases: ['Myeloma', 'Plasma Cell Myeloma', 'Kahler Disease'],
  },
  {
    system: 'HEME',
    subcategory: 'Lymphoma',
    condition: 'Hodgkin Lymphoma',
    aliases: ['Hodgkin Disease', 'Hodgkins Lymphoma'],
  },
  {
    system: 'HEME',
    subcategory: 'Lymphoma',
    condition: 'Non-Hodgkin Lymphoma',
    aliases: ['NHL', 'Non-Hodgkins Lymphoma'],
  },

  // =====================================================
  // RENAL & GENITOURINARY
  // =====================================================
  {
    system: 'RENAL',
    subcategory: 'Acute Kidney Injury',
    condition: 'Prerenal Acute Kidney Injury',
    aliases: ['Prerenal AKI', 'Prerenal Azotemia'],
  },
  {
    system: 'RENAL',
    subcategory: 'Acute Kidney Injury',
    condition: 'Intrinsic Acute Kidney Injury',
    aliases: ['Intrinsic AKI', 'Intrarenal AKI'],
  },
  {
    system: 'RENAL',
    subcategory: 'Acute Kidney Injury',
    condition: 'Postrenal Acute Kidney Injury',
    aliases: ['Postrenal AKI', 'Obstructive AKI'],
  },
  {
    system: 'RENAL',
    subcategory: 'Glomerular',
    condition: 'Nephritic Syndrome',
    aliases: ['Glomerulonephritis', 'Acute Nephritic Syndrome'],
  },
  {
    system: 'RENAL',
    subcategory: 'Glomerular',
    condition: 'Nephrotic Syndrome',
    aliases: ['Nephrosis'],
  },
  {
    system: 'RENAL',
    subcategory: 'Congenital',
    condition: 'Horseshoe Kidney',
    aliases: ['Renal Fusion', 'Fused Kidneys'],
  },
  {
    system: 'GU',
    subcategory: 'Bladder',
    condition: 'Urinary Incontinence',
    aliases: ['Incontinence', 'Bladder Leakage'],
  },
  {
    system: 'GU',
    subcategory: 'Emergency',
    condition: 'Fournier Gangrene',
    aliases: ["Fournier's Gangrene", 'Necrotizing Fasciitis of Perineum'],
  },
  {
    system: 'GU',
    subcategory: 'Penile',
    condition: 'Priapism',
    aliases: ['Prolonged Erection', 'Persistent Erection'],
  },
  {
    system: 'RENAL',
    subcategory: 'Oncology',
    condition: 'Wilms Tumor',
    aliases: ['Nephroblastoma', "Wilms' Tumor"],
  },

  // =====================================================
  // CARDIOLOGY - New 2025 Blueprint
  // =====================================================
  {
    system: 'CV',
    subcategory: 'Cardiomyopathy',
    condition: 'Stress Cardiomyopathy',
    aliases: ['Takotsubo Cardiomyopathy', 'Broken Heart Syndrome', 'Apical Ballooning Syndrome'],
  },
  {
    system: 'CV',
    subcategory: 'ECG',
    condition: 'Junctional Rhythm',
    aliases: ['Junctional Escape Rhythm', 'AV Junctional Rhythm'],
  },
  {
    system: 'CV',
    subcategory: 'ECG',
    condition: 'Idioventricular Rhythm',
    aliases: ['Ventricular Escape Rhythm', 'Accelerated Idioventricular Rhythm', 'AIVR'],
  },
  {
    system: 'CV',
    subcategory: 'Traumatic Heart Conditions',
    condition: 'Myocardial Contusion',
    aliases: ['Cardiac Contusion', 'Bruised Heart'],
  },
  {
    system: 'CV',
    subcategory: 'Traumatic Heart Conditions',
    condition: 'Cardiac Tamponade',
    aliases: ['Pericardial Tamponade', 'Tamponade'],
  },
  {
    system: 'CV',
    subcategory: 'Heart Failure',
    condition: 'Cor Pulmonale',
    aliases: ['Right Heart Failure', 'Pulmonary Heart Disease'],
  },
  {
    system: 'CV',
    subcategory: 'Shock',
    condition: 'Cardiogenic Shock',
    aliases: ['Cardiac Shock', 'Pump Failure'],
  },
  {
    system: 'CV',
    subcategory: 'Shock',
    condition: 'Hypovolemic Shock',
    aliases: ['Hemorrhagic Shock', 'Volume Depletion Shock'],
  },
  {
    system: 'CV',
    subcategory: 'Shock',
    condition: 'Distributive Shock',
    aliases: ['Vasodilatory Shock', 'Septic Shock', 'Anaphylactic Shock', 'Neurogenic Shock'],
  },
  {
    system: 'CV',
    subcategory: 'Metabolic',
    condition: 'Hyperlipidemia',
    aliases: ['Dyslipidemia', 'High Cholesterol', 'Hypercholesterolemia'],
  },

  // =====================================================
  // PULMONARY
  // =====================================================
  {
    system: 'PULM',
    subcategory: 'Pediatric',
    condition: 'Acute Bronchiolitis',
    aliases: ['RSV Bronchiolitis', 'Respiratory Syncytial Virus Bronchiolitis'],
  },
  {
    system: 'PULM',
    subcategory: 'Neonatal',
    condition: 'Hyaline Membrane Disease',
    aliases: ['Neonatal RDS', 'Respiratory Distress Syndrome of Newborn', 'Surfactant Deficiency'],
  },
  {
    system: 'PULM',
    subcategory: 'Acute Respiratory Failure',
    condition: 'Acute Respiratory Distress Syndrome',
    aliases: ['ARDS', 'Adult Respiratory Distress Syndrome'],
  },
  {
    system: 'PULM',
    subcategory: 'Airway',
    condition: 'Foreign Body Aspiration',
    aliases: ['Aspirated Foreign Body', 'Choking'],
  },
  {
    system: 'PULM',
    subcategory: 'Sleep-Disordered Breathing',
    condition: 'Obstructive Sleep Apnea',
    aliases: ['OSA', 'Sleep Apnea', 'Obstructive Sleep Apnea Syndrome'],
  },
  {
    system: 'PULM',
    subcategory: 'Occupational',
    condition: 'Silicosis',
    aliases: ['Silica Pneumoconiosis'],
  },
  {
    system: 'PULM',
    subcategory: 'Occupational',
    condition: 'Asbestosis',
    aliases: ['Asbestos-Related Lung Disease'],
  },
  {
    system: 'PULM',
    subcategory: 'Occupational',
    condition: 'Coal Workers Pneumoconiosis',
    aliases: ['Black Lung Disease', 'Coal Miners Lung'],
  },

  // =====================================================
  // NEUROLOGY
  // =====================================================
  {
    system: 'NEURO',
    subcategory: 'Trauma',
    condition: 'Post-Concussion Syndrome',
    aliases: ['Postconcussive Syndrome', 'Persistent Postconcussive Symptoms'],
  },
  {
    system: 'NEURO',
    subcategory: 'Trauma',
    condition: 'Traumatic Brain Injury',
    aliases: ['TBI', 'Head Injury', 'Brain Trauma'],
  },
  {
    system: 'NEURO',
    subcategory: 'Movement Disorders',
    condition: 'Tardive Dyskinesia',
    aliases: ['TD', 'Antipsychotic-Induced Movement Disorder'],
  },
  {
    system: 'NEURO',
    subcategory: 'Demyelinating Disease',
    condition: 'Guillain-Barre Syndrome',
    aliases: ['GBS', 'Acute Inflammatory Demyelinating Polyneuropathy', 'AIDP'],
  },
  {
    system: 'NEURO',
    subcategory: 'Neuromuscular Junction',
    condition: 'Myasthenia Gravis',
    aliases: ['MG', 'Myasthenia'],
  },
  {
    system: 'NEURO',
    subcategory: 'Pediatric Neurology',
    condition: 'Cerebral Palsy',
    aliases: ['CP', 'Spastic Paralysis'],
  },
  {
    system: 'NEURO',
    subcategory: 'Pain Disorders',
    condition: 'Complex Regional Pain Syndrome',
    aliases: ['CRPS', 'Reflex Sympathetic Dystrophy', 'RSD', 'Causalgia'],
  },
  {
    system: 'NEURO',
    subcategory: 'Peripheral Neuropathy',
    condition: 'Diabetic Neuropathy',
    aliases: ['Diabetic Peripheral Neuropathy', 'DPN'],
  },
  {
    system: 'NEURO',
    subcategory: 'Peripheral Neuropathy',
    condition: 'Alcoholic Neuropathy',
    aliases: ['Alcohol-Related Neuropathy'],
  },
  {
    system: 'NEURO',
    subcategory: 'Syncope',
    condition: 'Syncope',
    aliases: ['Fainting', 'Vasovagal Syncope', 'Neurocardiogenic Syncope'],
  },
  {
    system: 'NEURO',
    subcategory: 'Encephalopathy',
    condition: 'Wernicke Encephalopathy',
    aliases: ['Wernicke-Korsakoff Syndrome', 'Thiamine Deficiency Encephalopathy'],
  },

  // =====================================================
  // DERMATOLOGY - Hair/Nails
  // =====================================================
  {
    system: 'DERM',
    subcategory: 'Hair Disorders',
    condition: 'Alopecia',
    aliases: ['Hair Loss', 'Baldness'],
  },
  {
    system: 'DERM',
    subcategory: 'Nail Disorders',
    condition: 'Onychomycosis',
    aliases: ['Toenail Fungus', 'Nail Fungal Infection', 'Tinea Unguium'],
  },
  {
    system: 'DERM',
    subcategory: 'Nail Disorders',
    condition: 'Paronychia',
    aliases: ['Nail Infection', 'Whitlow'],
  },
  {
    system: 'DERM',
    subcategory: 'Nail Disorders',
    condition: 'Felon',
    aliases: ['Whitlow', 'Finger Pulp Infection'],
  },
  {
    system: 'DERM',
    subcategory: 'Infectious - Viral',
    condition: 'Condyloma Acuminatum',
    aliases: ['Genital Warts', 'HPV Warts', 'Venereal Warts'],
  },
  {
    system: 'DERM',
    subcategory: 'Infectious - Viral',
    condition: 'Molluscum Contagiosum',
    aliases: ['Water Warts', 'Molluscum'],
  },
  {
    system: 'DERM',
    subcategory: 'Infectious - Viral',
    condition: 'Verrucae',
    aliases: ['Warts', 'Common Warts', 'Verruca Vulgaris'],
  },
  {
    system: 'DERM',
    subcategory: 'Benign Lesions',
    condition: 'Lipoma',
    aliases: ['Fatty Tumor', 'Adipose Tumor'],
  },
  {
    system: 'DERM',
    subcategory: 'Benign Lesions',
    condition: 'Epithelial Inclusion Cyst',
    aliases: ['Epidermal Cyst', 'Sebaceous Cyst'],
  },
  {
    system: 'DERM',
    subcategory: 'Pigmentary',
    condition: 'Acanthosis Nigricans',
    aliases: ['Dark Skin Patches', 'Insulin Resistance Skin Sign'],
  },
  {
    system: 'DERM',
    subcategory: 'Inflammatory',
    condition: 'Hidradenitis Suppurativa',
    aliases: ['HS', 'Acne Inversa'],
  },
  {
    system: 'DERM',
    subcategory: 'Cysts & Abscesses',
    condition: 'Pilonidal Disease',
    aliases: ['Pilonidal Cyst', 'Pilonidal Sinus'],
  },
  {
    system: 'DERM',
    subcategory: 'Ulcers & Wounds',
    condition: 'Decubitus Ulcer',
    aliases: ['Pressure Ulcer', 'Pressure Sore', 'Bedsore'],
  },

  // =====================================================
  // TRAUMA
  // =====================================================
  {
    system: 'DERM',
    subcategory: 'Burns',
    condition: 'Burns',
    aliases: ['Thermal Burns', 'First Degree Burn', 'Second Degree Burn', 'Third Degree Burn'],
  },
  {
    system: 'DERM',
    subcategory: 'Ulcers & Wounds',
    condition: 'Pressure Injuries',
    aliases: ['Pressure Ulcers', 'Pressure Sores', 'Decubitus Ulcers'],
  },
  {
    system: 'OTHER',
    subcategory: 'Environmental',
    condition: 'Hypothermia',
    aliases: ['Cold Exposure', 'Accidental Hypothermia'],
  },
  {
    system: 'OTHER',
    subcategory: 'Environmental',
    condition: 'Hyperthermia',
    aliases: ['Heat Stroke', 'Heat Exhaustion', 'Heat Illness'],
  },

  // =====================================================
  // GASTROINTESTINAL/NUTRITIONAL
  // =====================================================
  {
    system: 'GI',
    subcategory: 'Colon',
    condition: 'Fecal Impaction',
    aliases: ['Impacted Stool', 'Constipation'],
  },
  {
    system: 'GI',
    subcategory: 'Small Bowel',
    condition: 'Ileus',
    aliases: ['Paralytic Ileus', 'Adynamic Ileus'],
  },
  {
    system: 'GI',
    subcategory: 'Metabolic Disorders',
    condition: 'Phenylketonuria',
    aliases: ['PKU', 'Phenylalanine Hydroxylase Deficiency'],
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Vitamin A Deficiency',
    aliases: ['Night Blindness', 'Xerophthalmia'],
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Vitamin D Deficiency',
    aliases: ['Rickets', 'Osteomalacia'],
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Vitamin E Deficiency',
    aliases: ['Tocopherol Deficiency'],
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Vitamin K Deficiency',
    aliases: ['Bleeding Disorder', 'Hemorrhagic Disease of Newborn'],
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Vitamin C Deficiency',
    aliases: ['Scurvy', 'Ascorbic Acid Deficiency'],
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Thiamine Deficiency',
    aliases: ['Beriberi', 'Vitamin B1 Deficiency', 'Wernicke-Korsakoff'],
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Niacin Deficiency',
    aliases: ['Pellagra', 'Vitamin B3 Deficiency'],
  },
  {
    system: 'GI',
    subcategory: 'Esophagus',
    condition: 'Zenkers Diverticulum',
    aliases: ['Zenker Diverticulum', 'Pharyngeal Pouch', 'Pharyngoesophageal Diverticulum'],
  },
  {
    system: 'GI',
    subcategory: 'Esophagus',
    condition: 'Esophageal Perforation',
    aliases: ['Boerhaave Syndrome', 'Esophageal Rupture'],
  },
  {
    system: 'GI',
    subcategory: 'Biliary',
    condition: 'Primary Sclerosing Cholangitis',
    aliases: ['PSC', 'Sclerosing Cholangitis'],
  },
  {
    system: 'GI',
    subcategory: 'Biliary',
    condition: 'Primary Biliary Cholangitis',
    aliases: ['PBC', 'Primary Biliary Cirrhosis'],
  },
  {
    system: 'GI',
    subcategory: 'Hernias',
    condition: 'Inguinal Hernia',
    aliases: ['Groin Hernia', 'Direct Inguinal Hernia', 'Indirect Inguinal Hernia'],
  },
  { system: 'GI', subcategory: 'Hernias', condition: 'Femoral Hernia', aliases: ['Crural Hernia'] },
  {
    system: 'GI',
    subcategory: 'Hernias',
    condition: 'Umbilical Hernia',
    aliases: ['Belly Button Hernia'],
  },
  {
    system: 'GI',
    subcategory: 'Hernias',
    condition: 'Incisional Hernia',
    aliases: ['Ventral Hernia', 'Post-Surgical Hernia'],
  },
  {
    system: 'GI',
    subcategory: 'Hernias',
    condition: 'Hiatal Hernia',
    aliases: ['Hiatus Hernia', 'Diaphragmatic Hernia'],
  },
  {
    system: 'GI',
    subcategory: 'Pediatric GI',
    condition: 'Pyloric Stenosis',
    aliases: ['Infantile Hypertrophic Pyloric Stenosis', 'IHPS'],
  },
  {
    system: 'GI',
    subcategory: 'Pediatric GI',
    condition: 'Intussusception',
    aliases: ['Intestinal Intussusception'],
  },
  {
    system: 'GI',
    subcategory: 'Pediatric GI',
    condition: 'Hirschsprung Disease',
    aliases: ['Congenital Megacolon', 'Aganglionic Megacolon'],
  },
  {
    system: 'GI',
    subcategory: 'Pediatric GI',
    condition: 'Meckels Diverticulum',
    aliases: ['Meckel Diverticulum', 'Ileal Diverticulum'],
  },
  {
    system: 'GI',
    subcategory: 'Infectious Diarrhea',
    condition: 'Giardiasis',
    aliases: ['Giardia Infection', 'Beaver Fever'],
  },
  {
    system: 'GI',
    subcategory: 'Infectious Diarrhea',
    condition: 'Cholera',
    aliases: ['Vibrio Cholerae Infection', 'Asiatic Cholera'],
  },
  {
    system: 'GI',
    subcategory: 'Colorectal',
    condition: 'Anal Fissure',
    aliases: ['Fissure in Ano'],
  },
  {
    system: 'GI',
    subcategory: 'Colorectal',
    condition: 'Anorectal Abscess',
    aliases: ['Perianal Abscess', 'Perirectal Abscess'],
  },
  {
    system: 'GI',
    subcategory: 'Colorectal',
    condition: 'Hemorrhoids',
    aliases: ['Piles', 'Internal Hemorrhoids', 'External Hemorrhoids'],
  },

  // =====================================================
  // MUSCULOSKELETAL
  // =====================================================
  {
    system: 'MSK',
    subcategory: 'Back & Spine',
    condition: 'Kyphosis',
    aliases: ['Hunchback', 'Roundback'],
  },
  {
    system: 'MSK',
    subcategory: 'Back & Spine',
    condition: 'Scoliosis',
    aliases: ['Spinal Curvature', 'Curved Spine'],
  },
  {
    system: 'MSK',
    subcategory: 'Back & Spine',
    condition: 'Torticollis',
    aliases: ['Wry Neck', 'Twisted Neck'],
  },
  {
    system: 'MSK',
    subcategory: 'Pediatrics',
    condition: 'Slipped Capital Femoral Epiphysis',
    aliases: ['SCFE', 'Slipped Hip'],
  },
  {
    system: 'MSK',
    subcategory: 'Pediatrics',
    condition: 'Legg-Calve-Perthes Disease',
    aliases: ['Perthes Disease', 'Avascular Necrosis of Hip in Children'],
  },
  {
    system: 'MSK',
    subcategory: 'Pediatrics',
    condition: 'Osgood-Schlatter Disease',
    aliases: ['Tibial Tubercle Apophysitis'],
  },
  {
    system: 'MSK',
    subcategory: 'Trauma/Fracture',
    condition: 'Nursemaids Elbow',
    aliases: ["Nursemaid's Elbow", 'Radial Head Subluxation', 'Pulled Elbow'],
  },
  {
    system: 'MSK',
    subcategory: 'Neoplasm',
    condition: 'Osteosarcoma',
    aliases: ['Osteogenic Sarcoma', 'Bone Cancer'],
  },
  {
    system: 'MSK',
    subcategory: 'Neoplasm',
    condition: 'Ewing Sarcoma',
    aliases: ["Ewing's Sarcoma", 'Bone Cancer'],
  },
  {
    system: 'MSK',
    subcategory: 'Neoplasm',
    condition: 'Chondrosarcoma',
    aliases: ['Cartilage Cancer'],
  },
  {
    system: 'MSK',
    subcategory: 'Soft Tissue/Overuse',
    condition: 'Ganglion Cyst',
    aliases: ['Bible Cyst', 'Wrist Ganglion'],
  },
  {
    system: 'MSK',
    subcategory: 'Emergency',
    condition: 'Compartment Syndrome',
    aliases: ['Acute Compartment Syndrome'],
  },
  {
    system: 'MSK',
    subcategory: 'Emergency',
    condition: 'Rhabdomyolysis',
    aliases: ['Muscle Breakdown', 'Myoglobinuria'],
  },
  {
    system: 'MSK',
    subcategory: 'Rheumatologic',
    condition: 'Fibromyalgia',
    aliases: ['Fibromyalgia Syndrome', 'Chronic Pain Syndrome'],
  },
  {
    system: 'MSK',
    subcategory: 'Rheumatologic',
    condition: 'Polyarteritis Nodosa',
    aliases: ['PAN', 'Periarteritis Nodosa'],
  },
  {
    system: 'MSK',
    subcategory: 'Hand/Upper Extremity',
    condition: 'Dupuytren Contracture',
    aliases: ["Dupuytren's Contracture", 'Palmar Fibromatosis'],
  },
  {
    system: 'MSK',
    subcategory: 'Hand/Upper Extremity',
    condition: 'Mallet Finger',
    aliases: ['Baseball Finger', 'Drop Finger'],
  },
  {
    system: 'MSK',
    subcategory: 'Hand/Upper Extremity',
    condition: 'Boutonniere Deformity',
    aliases: ['Buttonhole Deformity'],
  },
  {
    system: 'MSK',
    subcategory: 'Hand/Upper Extremity',
    condition: 'Swan Neck Deformity',
    aliases: ['Swan-Neck Deformity'],
  },

  // =====================================================
  // ENDOCRINOLOGY
  // =====================================================
  {
    system: 'ENDO',
    subcategory: 'Pituitary',
    condition: 'Diabetes Insipidus',
    aliases: ['DI', 'Central Diabetes Insipidus', 'Nephrogenic Diabetes Insipidus'],
  },
  {
    system: 'ENDO',
    subcategory: 'Adrenal',
    condition: 'Pheochromocytoma',
    aliases: ['Pheo', 'Adrenal Tumor', 'Paraganglioma'],
  },
  {
    system: 'ENDO',
    subcategory: 'Adrenal',
    condition: 'Addisons Disease',
    aliases: ['Addison Disease', 'Primary Adrenal Insufficiency', 'Adrenal Insufficiency'],
  },
  {
    system: 'ENDO',
    subcategory: 'Adrenal',
    condition: 'Hyperaldosteronism',
    aliases: ['Conn Syndrome', 'Primary Aldosteronism'],
  },

  // =====================================================
  // INFECTIOUS DISEASE
  // =====================================================
  {
    system: 'ID',
    subcategory: 'Parasitic',
    condition: 'Pinworm Infection',
    aliases: ['Enterobiasis', 'Enterobius vermicularis', 'Threadworm'],
  },
  {
    system: 'ID',
    subcategory: 'Parasitic',
    condition: 'Tapeworm Infection',
    aliases: ['Cestode Infection', 'Taeniasis'],
  },
  {
    system: 'ID',
    subcategory: 'Parasitic',
    condition: 'Hookworm Infection',
    aliases: ['Ancylostomiasis', 'Necatoriasis'],
  },
  {
    system: 'ID',
    subcategory: 'Parasitic',
    condition: 'Malaria',
    aliases: ['Plasmodium Infection'],
  },
  {
    system: 'ID',
    subcategory: 'Parasitic',
    condition: 'Toxoplasmosis',
    aliases: ['Toxoplasma gondii Infection'],
  },
  {
    system: 'ID',
    subcategory: 'Spirochetal',
    condition: 'Syphilis',
    aliases: ['Lues', 'Treponema pallidum Infection'],
  },
  {
    system: 'ID',
    subcategory: 'Tick-Borne',
    condition: 'Lyme Disease',
    aliases: ['Lyme Borreliosis', 'Borrelia burgdorferi Infection'],
  },
  {
    system: 'ID',
    subcategory: 'Tick-Borne',
    condition: 'Rocky Mountain Spotted Fever',
    aliases: ['RMSF', 'Spotted Fever Rickettsiosis'],
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Rabies',
    aliases: ['Hydrophobia', 'Rabies Virus Infection'],
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Epstein-Barr Virus Infection',
    aliases: ['EBV', 'Mononucleosis', 'Mono', 'Kissing Disease'],
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Cytomegalovirus Infection',
    aliases: ['CMV', 'CMV Infection'],
  },
  { system: 'ID', subcategory: 'Viral', condition: 'Measles', aliases: ['Rubeola', 'Red Measles'] },
  { system: 'ID', subcategory: 'Viral', condition: 'Mumps', aliases: ['Epidemic Parotitis'] },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Rubella',
    aliases: ['German Measles', 'Three-Day Measles'],
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Erythema Infectiosum',
    aliases: ['Fifth Disease', 'Parvovirus B19 Infection', 'Slapped Cheek Disease'],
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Roseola',
    aliases: ['Exanthem Subitum', 'Sixth Disease', 'Roseola Infantum'],
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Hand Foot and Mouth Disease',
    aliases: ['HFMD', 'Coxsackie Virus Infection'],
  },
  {
    system: 'ID',
    subcategory: 'Systemic',
    condition: 'Rheumatic Fever',
    aliases: ['Acute Rheumatic Fever', 'ARF'],
  },
  {
    system: 'ID',
    subcategory: 'Environmental',
    condition: 'Botulism',
    aliases: ['Clostridium botulinum Infection', 'Food Poisoning'],
  },
  {
    system: 'ID',
    subcategory: 'Environmental',
    condition: 'Tetanus',
    aliases: ['Lockjaw', 'Clostridium tetani Infection'],
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Zika Virus Infection',
    aliases: ['Zika', 'Zika Fever'],
  },
];

// ======================================================
// GENERATE PLACEHOLDER CONTENT (when no API key)
// ======================================================
function generatePlaceholderContent(condition: NewCondition): ConditionContent {
  return {
    diagnostics: {
      notes: `Diagnostic workup for ${condition.condition}. Content to be generated.`,
    },
    overview: `${condition.condition} is a condition in the ${condition.system} system, ${condition.subcategory} category. Detailed overview to be generated.`,
    etiologyPathophysiology: `Etiology and pathophysiology of ${condition.condition}. Content to be generated.`,
    epidemiology: `Epidemiology of ${condition.condition}. Content to be generated.`,
    riskFactors: ['--'],
    clinicalPresentation: `Clinical presentation of ${condition.condition}. Content to be generated.`,
    symptoms: ['--'],
    examFindings: ['--'],
    treatment: ['--'],
    management: ['--'],
    complications: ['--'],
    prognosis: `Prognosis for ${condition.condition}. Content to be generated.`,
    aliases: condition.aliases,
  };
}

// ======================================================
// GENERATE CONTENT FOR A CONDITION (with Gemini API)
// ======================================================
async function generateConditionContent(condition: NewCondition): Promise<ConditionContent | null> {
  // If no API key, return placeholder content
  if (!model) {
    return generatePlaceholderContent(condition);
  }

  const prompt = `Generate comprehensive medical content for the condition "${condition.condition}" (${condition.system} system, ${condition.subcategory} subcategory).

Format the response as a valid JSON object with the following fields:
{
  "diagnostics": {
    "notes": "Detailed diagnostic workup including labs, imaging, and clinical tests"
  },
  "overview": "2-3 paragraph overview of the condition including definition, classification, and clinical significance",
  "etiologyPathophysiology": "Detailed explanation of causes and disease mechanisms",
  "epidemiology": "Incidence, prevalence, demographics, and risk factors",
  "riskFactors": ["List of risk factors as bullet points"],
  "clinicalPresentation": "How patients typically present, including history and physical exam findings",
  "symptoms": ["List of common symptoms"],
  "examFindings": ["List of physical examination findings"],
  "treatment": ["Acute and chronic treatment options"],
  "management": ["Long-term management strategies"],
  "complications": ["Potential complications"],
  "prognosis": "Expected outcomes and prognosis"
}

Provide medically accurate, board-exam-level content suitable for PA/medical students. Use proper medical terminology.
IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      // Clean the response
      text = asciiClean(text);
      text = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const content = JSON.parse(text) as ConditionContent;

      // Add aliases if provided
      if (condition.aliases && condition.aliases.length > 0) {
        content.aliases = condition.aliases;
      }

      return content;
    } catch (err: any) {
      console.error(
        `  [ERROR] Attempt ${attempt} failed for ${condition.condition}: ${err.message}`
      );
      if (attempt === MAX_RETRIES) {
        return null;
      }
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  return null;
}

// ======================================================
// MAIN
// ======================================================
async function main() {
  console.log('🚀 Starting condition content generation');
  console.log(`📌 Total new conditions to add: ${NEW_CONDITIONS.length}`);

  // Load existing content
  let existingContent: Record<string, ConditionContent> = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
    existingContent = JSON.parse(raw);
    console.log(`📂 Loaded ${Object.keys(existingContent).length} existing conditions`);
  }

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < NEW_CONDITIONS.length; i++) {
    const condition = NEW_CONDITIONS[i];
    const key = generateConditionKey(condition.system, condition.subcategory, condition.condition);

    // Skip if already exists
    if (existingContent[key]) {
      console.log(`⏩ Skipping (exists): ${condition.condition}`);
      skipped++;
      continue;
    }

    console.log(`\n[${i + 1}/${NEW_CONDITIONS.length}] 🔵 Generating: ${condition.condition}`);

    const content = await generateConditionContent(condition);

    if (content) {
      existingContent[key] = content;
      added++;
      console.log(`  ✅ Added: ${condition.condition}`);

      // Save after each successful addition
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingContent, null, 2), 'utf8');
    } else {
      failed++;
      console.log(`  [ERROR] Failed: ${condition.condition}`);
    }

    // Delay between requests
    await new Promise((res) => setTimeout(res, DELAY_BETWEEN_REQUESTS));
  }

  console.log('\n🎉 Generation complete!');
  console.log(`  ✅ Added: ${added}`);
  console.log(`  ⏩ Skipped: ${skipped}`);
  console.log(`  [ERROR] Failed: ${failed}`);
  console.log(`  [INFO] Total conditions now: ${Object.keys(existingContent).length}`);
}

main().catch(console.error);
