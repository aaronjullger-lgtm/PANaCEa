/**
 * Top 50 High-Yield PANCE Conditions
 * 
 * Selected based on:
 * 1. PANCE content blueprint percentages
 * 2. Historical exam frequency data
 * 3. Clinical prevalence
 * 4. Disease severity (don't miss diagnoses)
 * 
 * Distribution follows PANCE blueprint:
 * - CV (11%): 5-6 conditions
 * - PULM (9%): 4-5 conditions
 * - GI (8%): 4 conditions
 * - MSK (8%): 4 conditions
 * - ID (7%): 3-4 conditions
 * - NEURO (7%): 3-4 conditions
 * - PSYCH (7%): 3-4 conditions
 * - REPRO (7%): 3-4 conditions
 * - ENDO (6%): 3 conditions
 * - HEENT (6%): 3 conditions
 * - HEME (5%): 2-3 conditions
 * - RENAL (5%): 2-3 conditions
 * - DERM (4%): 2 conditions
 * - GU (4%): 2 conditions
 */

import type { SystemCode } from '../types';

export interface HighYieldCondition {
  condition: string;
  system: SystemCode;
  /** Brief clinical pearl for context */
  pearl: string;
  /** Key buzzwords associated with this condition */
  buzzwords: string[];
  /** Why this is high-yield */
  importance: 'critical' | 'very_high' | 'high';
}

export const TOP_50_HIGH_YIELD_CONDITIONS: HighYieldCondition[] = [
  // CARDIOVASCULAR (6)
  {
    condition: "Acute Coronary Syndrome (ACS)",
    system: "CV",
    pearl: "Troponin elevation with ST changes; immediate antiplatelet therapy",
    buzzwords: ["chest pain radiating to left arm", "diaphoresis", "ST elevation", "troponin I/T"],
    importance: "critical"
  },
  {
    condition: "Atrial Fibrillation",
    system: "CV",
    pearl: "Irregularly irregular rhythm; stroke prevention with anticoagulation",
    buzzwords: ["irregularly irregular", "absent P waves", "CHA2DS2-VASc"],
    importance: "very_high"
  },
  {
    condition: "Heart Failure",
    system: "CV",
    pearl: "Left = pulmonary congestion; Right = peripheral edema; BNP diagnostic",
    buzzwords: ["dyspnea on exertion", "orthopnea", "JVD", "S3 gallop", "BNP"],
    importance: "critical"
  },
  {
    condition: "Essential Hypertension",
    system: "CV",
    pearl: "Silent killer; first-line varies by comorbidity; ACE-I if diabetic",
    buzzwords: ["asymptomatic", "target organ damage", "lifestyle modification"],
    importance: "very_high"
  },
  {
    condition: "Deep Vein Thrombosis (DVT)",
    system: "CV",
    pearl: "Wells criteria for pretest probability; D-dimer if low risk",
    buzzwords: ["unilateral leg swelling", "Homans sign", "Wells score", "D-dimer"],
    importance: "critical"
  },
  {
    condition: "Aortic Stenosis",
    system: "CV",
    pearl: "SAD triad: Syncope, Angina, Dyspnea; crescendo-decrescendo murmur",
    buzzwords: ["crescendo-decrescendo murmur", "pulsus parvus et tardus", "S4"],
    importance: "very_high"
  },

  // PULMONARY (5)
  {
    condition: "Community-Acquired Pneumonia (CAP)",
    system: "PULM",
    pearl: "CURB-65 for severity; empiric coverage includes atypicals",
    buzzwords: ["productive cough", "fever", "consolidation", "CURB-65"],
    importance: "critical"
  },
  {
    condition: "Pulmonary Embolism (PE)",
    system: "PULM",
    pearl: "Modified Wells criteria; CT angiography gold standard",
    buzzwords: ["pleuritic chest pain", "sudden dyspnea", "sinus tachycardia", "V/Q mismatch"],
    importance: "critical"
  },
  {
    condition: "Asthma",
    system: "PULM",
    pearl: "Reversible airway obstruction; step-up/step-down therapy based on control",
    buzzwords: ["wheezing", "bronchodilator response", "peak flow variability"],
    importance: "very_high"
  },
  {
    condition: "COPD",
    system: "PULM",
    pearl: "FEV1/FVC < 0.70 post-bronchodilator; GOLD staging; smoking cessation key",
    buzzwords: ["barrel chest", "pursed lip breathing", "diminished breath sounds", "hyperinflation"],
    importance: "very_high"
  },
  {
    condition: "Acute Respiratory Distress Syndrome (ARDS)",
    system: "PULM",
    pearl: "Berlin criteria: acute onset, bilateral infiltrates, P/F ratio ≤300",
    buzzwords: ["acute hypoxemia", "bilateral infiltrates", "non-cardiogenic"],
    importance: "critical"
  },

  // GASTROINTESTINAL (4)
  {
    condition: "Acute Pancreatitis",
    system: "GI",
    pearl: "I GET SMASHED (causes); Ranson/APACHE for severity; NPO and fluids",
    buzzwords: ["epigastric pain radiating to back", "elevated lipase", "Cullen sign", "Grey Turner sign"],
    importance: "critical"
  },
  {
    condition: "Gastroesophageal Reflux Disease (GERD)",
    system: "GI",
    pearl: "Lifestyle modification first; PPI for 8 weeks; endoscopy if alarm symptoms",
    buzzwords: ["heartburn", "regurgitation", "water brash", "Barrett esophagus"],
    importance: "very_high"
  },
  {
    condition: "Acute Appendicitis",
    system: "GI",
    pearl: "McBurney point tenderness; CT scan for diagnosis; surgical emergency",
    buzzwords: ["periumbilical pain migrating to RLQ", "McBurney point", "Rovsing sign"],
    importance: "critical"
  },
  {
    condition: "Hepatitis B",
    system: "GI",
    pearl: "HBsAg = current infection; anti-HBs = immunity; chronicity if >6 months",
    buzzwords: ["elevated transaminases", "HBsAg positive", "jaundice"],
    importance: "very_high"
  },

  // MUSCULOSKELETAL (4)
  {
    condition: "Osteoarthritis",
    system: "MSK",
    pearl: "Morning stiffness <30 min; weight-bearing joints; osteophytes on X-ray",
    buzzwords: ["joint stiffness improving with activity", "Heberden nodes", "crepitus"],
    importance: "very_high"
  },
  {
    condition: "Rheumatoid Arthritis",
    system: "MSK",
    pearl: "Morning stiffness >1 hour; symmetric small joints; RF/anti-CCP positive",
    buzzwords: ["symmetric polyarthritis", "morning stiffness >1 hour", "swan neck deformity", "anti-CCP"],
    importance: "very_high"
  },
  {
    condition: "Gout",
    system: "MSK",
    pearl: "Monosodium urate crystals; colchicine/NSAIDs acute; allopurinol prophylaxis",
    buzzwords: ["podagra", "negatively birefringent crystals", "tophi", "uric acid"],
    importance: "very_high"
  },
  {
    condition: "Low Back Pain",
    system: "MSK",
    pearl: "Red flags: cancer, infection, cauda equina; most resolve conservatively",
    buzzwords: ["mechanical pain", "radiculopathy", "straight leg raise"],
    importance: "high"
  },

  // INFECTIOUS DISEASE (4)
  {
    condition: "Urinary Tract Infection (UTI)",
    system: "ID",
    pearl: "E. coli most common; nitrofurantoin/TMP-SMX first line uncomplicated",
    buzzwords: ["dysuria", "frequency", "urgency", "pyuria", "nitrites"],
    importance: "very_high"
  },
  {
    condition: "Cellulitis",
    system: "ID",
    pearl: "Strep/Staph most common; warm erythema without clear border",
    buzzwords: ["erythema", "warmth", "edema", "poorly demarcated borders"],
    importance: "very_high"
  },
  {
    condition: "HIV/AIDS",
    system: "ID",
    pearl: "CD4 <200 = AIDS; ART regardless of CD4; PCP prophylaxis when CD4 <200",
    buzzwords: ["opportunistic infections", "CD4 count", "viral load", "Pneumocystis jirovecii"],
    importance: "critical"
  },
  {
    condition: "Sepsis",
    system: "ID",
    pearl: "SIRS + infection; qSOFA for screening; early antibiotics and fluids key",
    buzzwords: ["altered mental status", "tachycardia", "hypotension", "lactate >2"],
    importance: "critical"
  },

  // NEUROLOGY (4)
  {
    condition: "Ischemic Stroke",
    system: "NEURO",
    pearl: "Time is brain; tPA within 4.5 hours; NIHSS for severity",
    buzzwords: ["sudden focal deficit", "facial droop", "arm drift", "slurred speech"],
    importance: "critical"
  },
  {
    condition: "Migraine Headache",
    system: "NEURO",
    pearl: "Unilateral, pulsating; photo/phonophobia; triptans for acute",
    buzzwords: ["unilateral pulsating headache", "aura", "photophobia", "phonophobia"],
    importance: "very_high"
  },
  {
    condition: "Seizure Disorders/Epilepsy",
    system: "NEURO",
    pearl: "Two unprovoked seizures = epilepsy; EEG diagnostic; AEDs for prevention",
    buzzwords: ["tonic-clonic", "postictal confusion", "aura", "automatisms"],
    importance: "very_high"
  },
  {
    condition: "Meningitis",
    system: "NEURO",
    pearl: "Kernig/Brudzinski signs; LP for diagnosis; empiric antibiotics stat",
    buzzwords: ["nuchal rigidity", "Kernig sign", "Brudzinski sign", "photophobia"],
    importance: "critical"
  },

  // PSYCHIATRY (3)
  {
    condition: "Major Depressive Disorder",
    system: "PSYCH",
    pearl: "SIG E CAPS for ≥2 weeks; SSRIs first line; assess suicide risk",
    buzzwords: ["depressed mood", "anhedonia", "sleep disturbance", "worthlessness"],
    importance: "very_high"
  },
  {
    condition: "Generalized Anxiety Disorder",
    system: "PSYCH",
    pearl: "Excessive worry ≥6 months; SSRIs/SNRIs first line; CBT effective",
    buzzwords: ["excessive worry", "restlessness", "muscle tension", "insomnia"],
    importance: "very_high"
  },
  {
    condition: "Bipolar Disorder",
    system: "PSYCH",
    pearl: "Manic episodes define; lithium/valproate mood stabilizers; avoid antidepressant monotherapy",
    buzzwords: ["grandiosity", "decreased need for sleep", "pressured speech", "racing thoughts"],
    importance: "very_high"
  },

  // REPRODUCTIVE (3)
  {
    condition: "Ectopic Pregnancy",
    system: "REPRO",
    pearl: "β-hCG + no intrauterine pregnancy = ectopic until proven otherwise",
    buzzwords: ["amenorrhea", "vaginal bleeding", "unilateral pelvic pain", "adnexal mass"],
    importance: "critical"
  },
  {
    condition: "Preeclampsia",
    system: "REPRO",
    pearl: "HTN + proteinuria after 20 weeks; delivery is definitive treatment",
    buzzwords: ["hypertension after 20 weeks", "proteinuria", "edema", "headache"],
    importance: "critical"
  },
  {
    condition: "Polycystic Ovary Syndrome (PCOS)",
    system: "REPRO",
    pearl: "Rotterdam criteria (2 of 3); metformin if metabolic syndrome",
    buzzwords: ["oligomenorrhea", "hirsutism", "polycystic ovaries", "LH:FSH ratio >2:1"],
    importance: "very_high"
  },

  // ENDOCRINE (3)
  {
    condition: "Diabetes Mellitus Type 2",
    system: "ENDO",
    pearl: "Metformin first line; HbA1c goal <7%; microvascular complications",
    buzzwords: ["polyuria", "polydipsia", "HbA1c ≥6.5%", "fasting glucose ≥126"],
    importance: "critical"
  },
  {
    condition: "Hypothyroidism",
    system: "ENDO",
    pearl: "High TSH, low free T4; levothyroxine replacement; recheck in 6 weeks",
    buzzwords: ["fatigue", "cold intolerance", "weight gain", "constipation", "high TSH"],
    importance: "very_high"
  },
  {
    condition: "Diabetic Ketoacidosis (DKA)",
    system: "ENDO",
    pearl: "Anion gap metabolic acidosis; fluids, insulin, K+ replacement",
    buzzwords: ["fruity breath", "Kussmaul respirations", "anion gap", "ketones"],
    importance: "critical"
  },

  // HEENT (3)
  {
    condition: "Acute Otitis Media",
    system: "HEENT",
    pearl: "Bulging TM with effusion; amoxicillin first line; watch and wait if mild",
    buzzwords: ["ear pain", "bulging tympanic membrane", "decreased mobility on pneumatic otoscopy"],
    importance: "high"
  },
  {
    condition: "Streptococcal Pharyngitis",
    system: "HEENT",
    pearl: "Centor criteria; rapid strep test; penicillin to prevent rheumatic fever",
    buzzwords: ["sore throat", "tonsillar exudates", "cervical lymphadenopathy", "fever"],
    importance: "very_high"
  },
  {
    condition: "Sinusitis",
    system: "HEENT",
    pearl: "Viral if <10 days; amoxicillin-clavulanate if bacterial suspected",
    buzzwords: ["facial pain/pressure", "purulent nasal discharge", "maxillary tooth pain"],
    importance: "high"
  },

  // HEMATOLOGY (3)
  {
    condition: "Iron Deficiency Anemia",
    system: "HEME",
    pearl: "Microcytic; low ferritin diagnostic; find source of blood loss",
    buzzwords: ["microcytic hypochromic", "low ferritin", "high TIBC", "koilonychia"],
    importance: "very_high"
  },
  {
    condition: "Sickle Cell Disease",
    system: "HEME",
    pearl: "Vaso-occlusive crises; hydroxyurea preventive; functional asplenia",
    buzzwords: ["pain crisis", "acute chest syndrome", "autosplenectomy", "target cells"],
    importance: "very_high"
  },
  {
    condition: "Thrombocytopenia",
    system: "HEME",
    pearl: "Platelet <150,000; ITP vs TTP vs HIT; bleeding risk below 20,000",
    buzzwords: ["petechiae", "purpura", "easy bruising", "mucosal bleeding"],
    importance: "very_high"
  },

  // RENAL (3)
  {
    condition: "Acute Kidney Injury (AKI)",
    system: "RENAL",
    pearl: "Prerenal (most common), intrinsic, postrenal; BUN:Cr ratio helps differentiate",
    buzzwords: ["oliguria", "elevated creatinine", "BUN:Cr >20:1 (prerenal)"],
    importance: "critical"
  },
  {
    condition: "Chronic Kidney Disease (CKD)",
    system: "RENAL",
    pearl: "GFR staging; ACE-I/ARB for proteinuria; avoid nephrotoxins",
    buzzwords: ["decreased GFR", "proteinuria", "anemia of chronic disease", "secondary hyperparathyroidism"],
    importance: "very_high"
  },
  {
    condition: "Nephrolithiasis",
    system: "RENAL",
    pearl: "Calcium oxalate most common; CT KUB best imaging; fluids and analgesia",
    buzzwords: ["colicky flank pain", "hematuria", "hydronephrosis"],
    importance: "very_high"
  },

  // DERMATOLOGY (2)
  {
    condition: "Psoriasis",
    system: "DERM",
    pearl: "Silvery scales, Auspitz sign; topical steroids first; biologics if severe",
    buzzwords: ["silvery scales", "Auspitz sign", "extensor surfaces", "nail pitting"],
    importance: "very_high"
  },
  {
    condition: "Melanoma",
    system: "DERM",
    pearl: "ABCDE criteria; Breslow depth for staging; wide excision",
    buzzwords: ["asymmetry", "irregular border", "color variation", "evolving lesion"],
    importance: "critical"
  },

  // GENITOURINARY (2)
  {
    condition: "Benign Prostatic Hyperplasia (BPH)",
    system: "GU",
    pearl: "LUTS; alpha-blockers for symptoms; 5-ARI for large prostates",
    buzzwords: ["hesitancy", "weak stream", "nocturia", "post-void residual"],
    importance: "high"
  },
  {
    condition: "Testicular Torsion",
    system: "GU",
    pearl: "Surgical emergency; absent cremasteric reflex; blue dot sign",
    buzzwords: ["sudden severe testicular pain", "absent cremasteric reflex", "high-riding testis"],
    importance: "critical"
  }
];

/**
 * Get conditions by system for targeted practice
 */
export function getHighYieldBySystem(system: SystemCode): HighYieldCondition[] {
  return TOP_50_HIGH_YIELD_CONDITIONS.filter(c => c.system === system);
}

/**
 * Get random high-yield conditions for cram session
 */
export function getRandomHighYield(count: number = 50): HighYieldCondition[] {
  const shuffled = [...TOP_50_HIGH_YIELD_CONDITIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, TOP_50_HIGH_YIELD_CONDITIONS.length));
}

/**
 * Get conditions by importance level
 */
export function getByImportance(level: 'critical' | 'very_high' | 'high'): HighYieldCondition[] {
  return TOP_50_HIGH_YIELD_CONDITIONS.filter(c => c.importance === level);
}

/**
 * Get all critical "don't miss" conditions
 */
export function getCriticalConditions(): HighYieldCondition[] {
  return TOP_50_HIGH_YIELD_CONDITIONS.filter(c => c.importance === 'critical');
}
