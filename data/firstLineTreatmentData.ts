/**
 * First Line Treatment Drill Data
 * 
 * High-yield PANCE first-line treatment associations.
 * Focus on the go-to treatment for common conditions.
 */

export interface FirstLineTreatment {
  id: string;
  condition: string;
  category: string;
  firstLine: string;
  alternatives?: string[];
  explanation: string;
  pearl?: string;
}

/**
 * Master database of first-line treatments
 */
export const FIRST_LINE_TREATMENTS: FirstLineTreatment[] = [
  // =====================================================
  // CARDIOLOGY
  // =====================================================
  {
    id: 'fl-htn-uncomplicated',
    condition: 'Hypertension (uncomplicated)',
    category: 'Cardiology',
    firstLine: 'Thiazide diuretic (e.g., hydrochlorothiazide, chlorthalidone)',
    alternatives: ['ACE inhibitor', 'ARB', 'Calcium channel blocker'],
    explanation: 'Thiazides are first-line for uncomplicated hypertension per JNC 8 guidelines.',
    pearl: 'All four drug classes (thiazide, ACEi, ARB, CCB) are considered first-line. Choice depends on comorbidities.',
  },
  {
    id: 'fl-htn-diabetes',
    condition: 'Hypertension with Diabetes',
    category: 'Cardiology',
    firstLine: 'ACE inhibitor or ARB',
    alternatives: ['Thiazide diuretic', 'Calcium channel blocker'],
    explanation: 'ACE inhibitors and ARBs provide renal protection in diabetic patients.',
    pearl: 'Do not combine ACEi + ARB due to increased risk of hyperkalemia and renal dysfunction.',
  },
  {
    id: 'fl-htn-ckd',
    condition: 'Hypertension with CKD (proteinuria)',
    category: 'Cardiology',
    firstLine: 'ACE inhibitor or ARB',
    explanation: 'Slows progression of diabetic and non-diabetic proteinuric CKD.',
    pearl: 'Monitor potassium and creatinine closely. Expect up to 30% rise in Cr.',
  },
  {
    id: 'fl-chf-hfref',
    condition: 'Heart Failure with reduced EF (HFrEF)',
    category: 'Cardiology',
    firstLine: 'ACE inhibitor + Beta-blocker + Diuretic',
    alternatives: ['ARB if ACEi intolerant', 'ARNI (sacubitril/valsartan)'],
    explanation: 'Guideline-directed medical therapy reduces mortality in HFrEF.',
    pearl: 'Add spironolactone (aldosterone antagonist) for additional mortality benefit.',
  },
  {
    id: 'fl-afib-rate',
    condition: 'Atrial Fibrillation (rate control)',
    category: 'Cardiology',
    firstLine: 'Beta-blocker (metoprolol, atenolol) or Calcium channel blocker (diltiazem, verapamil)',
    explanation: 'Rate control is preferred for most patients with chronic AFib.',
    pearl: 'Avoid CCBs in patients with HFrEF. Use beta-blockers or digoxin instead.',
  },
  {
    id: 'fl-afib-anticoag',
    condition: 'Atrial Fibrillation (anticoagulation)',
    category: 'Cardiology',
    firstLine: 'DOAC (apixaban, rivaroxaban, dabigatran, edoxaban)',
    alternatives: ['Warfarin'],
    explanation: 'DOACs are preferred over warfarin for non-valvular AFib.',
    pearl: 'Warfarin still preferred for mechanical heart valves and moderate-severe mitral stenosis.',
  },
  {
    id: 'fl-acs-stemi',
    condition: 'STEMI',
    category: 'Cardiology',
    firstLine: 'Aspirin + P2Y12 inhibitor + Anticoagulant + Primary PCI',
    explanation: 'Door-to-balloon time <90 minutes is the goal for STEMI.',
    pearl: 'MONA (Morphine, Oxygen, Nitrates, Aspirin) is the initial management.',
  },
  {
    id: 'fl-stable-angina',
    condition: 'Stable Angina',
    category: 'Cardiology',
    firstLine: 'Beta-blocker',
    alternatives: ['Calcium channel blocker', 'Nitrates'],
    explanation: 'Beta-blockers reduce myocardial oxygen demand and prevent angina.',
    pearl: 'Add sublingual nitroglycerin for acute episodes.',
  },

  // =====================================================
  // PULMONOLOGY
  // =====================================================
  {
    id: 'fl-asthma-intermittent',
    condition: 'Asthma (Intermittent)',
    category: 'Pulmonology',
    firstLine: 'Short-acting beta-agonist (SABA) PRN (albuterol)',
    explanation: 'Intermittent asthma: symptoms ≤2 days/week, no daily controller needed.',
    pearl: 'If SABA use >2 days/week, step up therapy.',
  },
  {
    id: 'fl-asthma-persistent',
    condition: 'Asthma (Mild Persistent)',
    category: 'Pulmonology',
    firstLine: 'Low-dose inhaled corticosteroid (ICS)',
    alternatives: ['Leukotriene receptor antagonist (montelukast)'],
    explanation: 'Daily ICS is the cornerstone of persistent asthma treatment.',
    pearl: 'ICS reduces exacerbations and improves lung function.',
  },
  {
    id: 'fl-copd-maintenance',
    condition: 'COPD (maintenance)',
    category: 'Pulmonology',
    firstLine: 'Long-acting bronchodilator (LAMA or LABA)',
    alternatives: ['ICS + LABA for frequent exacerbators'],
    explanation: 'LAMA (tiotropium) or LABA for daily symptom control.',
    pearl: 'Add ICS only for patients with frequent exacerbations and elevated eosinophils.',
  },
  {
    id: 'fl-copd-exacerbation',
    condition: 'COPD Exacerbation',
    category: 'Pulmonology',
    firstLine: 'Short-acting bronchodilators + Systemic corticosteroids + Antibiotics (if indicated)',
    explanation: 'Steroids shorten recovery time. Antibiotics if purulent sputum.',
    pearl: 'Prednisone 40mg x 5 days is the typical steroid course.',
  },
  {
    id: 'fl-cap-outpatient',
    condition: 'Community-Acquired Pneumonia (outpatient, healthy)',
    category: 'Pulmonology',
    firstLine: 'Amoxicillin OR Doxycycline OR Macrolide (azithromycin)',
    explanation: 'Monotherapy for healthy outpatients with no risk factors.',
    pearl: 'Consider local resistance patterns when choosing empiric therapy.',
  },
  {
    id: 'fl-cap-outpatient-comorbid',
    condition: 'Community-Acquired Pneumonia (outpatient with comorbidities)',
    category: 'Pulmonology',
    firstLine: 'Respiratory fluoroquinolone OR Beta-lactam + Macrolide',
    explanation: 'Broader coverage for patients with comorbidities.',
    pearl: 'Respiratory FQs: levofloxacin, moxifloxacin.',
  },

  // =====================================================
  // INFECTIOUS DISEASE
  // =====================================================
  {
    id: 'fl-uti-uncomplicated',
    condition: 'UTI (uncomplicated cystitis)',
    category: 'Infectious Disease',
    firstLine: 'Nitrofurantoin OR Trimethoprim-sulfamethoxazole (TMP-SMX)',
    alternatives: ['Fosfomycin'],
    explanation: 'Short course: Nitrofurantoin 5 days, TMP-SMX 3 days, Fosfomycin single dose.',
    pearl: 'Avoid fluoroquinolones for uncomplicated UTI due to resistance and side effects.',
  },
  {
    id: 'fl-pyelonephritis',
    condition: 'Pyelonephritis (outpatient)',
    category: 'Infectious Disease',
    firstLine: 'Fluoroquinolone (ciprofloxacin, levofloxacin)',
    alternatives: ['TMP-SMX if susceptible'],
    explanation: 'Fluoroquinolones achieve high renal tissue concentrations.',
    pearl: 'Duration: 5-7 days for uncomplicated, 10-14 days for complicated.',
  },
  {
    id: 'fl-strep-pharyngitis',
    condition: 'Streptococcal Pharyngitis (Strep throat)',
    category: 'Infectious Disease',
    firstLine: 'Penicillin V OR Amoxicillin',
    alternatives: ['Azithromycin (if penicillin allergic)'],
    explanation: 'Group A Strep remains uniformly susceptible to penicillin.',
    pearl: 'Treatment prevents rheumatic fever but not post-strep glomerulonephritis.',
  },
  {
    id: 'fl-cellulitis-nonpurulent',
    condition: 'Cellulitis (non-purulent)',
    category: 'Infectious Disease',
    firstLine: 'Cephalexin OR Dicloxacillin',
    explanation: 'Target Strep pyogenes and MSSA.',
    pearl: 'If no improvement in 48-72 hours, consider MRSA coverage.',
  },
  {
    id: 'fl-cellulitis-purulent',
    condition: 'Cellulitis (purulent/abscess)',
    category: 'Infectious Disease',
    firstLine: 'Incision & Drainage + TMP-SMX or Doxycycline',
    explanation: 'Purulent cellulitis often caused by MRSA. I&D is essential.',
    pearl: 'Antibiotics alone without drainage are often ineffective.',
  },
  {
    id: 'fl-otitis-media',
    condition: 'Acute Otitis Media',
    category: 'Infectious Disease',
    firstLine: 'Amoxicillin (high dose: 80-90 mg/kg/day)',
    alternatives: ['Amoxicillin-clavulanate if treatment failure'],
    explanation: 'First-line for uncomplicated AOM in children.',
    pearl: 'Watchful waiting appropriate for >2 years old with mild symptoms.',
  },
  {
    id: 'fl-sinusitis-acute',
    condition: 'Acute Bacterial Sinusitis',
    category: 'Infectious Disease',
    firstLine: 'Amoxicillin-clavulanate',
    alternatives: ['Doxycycline', 'Respiratory fluoroquinolone'],
    explanation: 'Most cases are viral. Antibiotics if symptoms >10 days or severe.',
    pearl: 'Amoxicillin alone is no longer first-line due to beta-lactamase producing organisms.',
  },

  // =====================================================
  // ENDOCRINE
  // =====================================================
  {
    id: 'fl-dm2-initial',
    condition: 'Type 2 Diabetes (initial therapy)',
    category: 'Endocrinology',
    firstLine: 'Metformin',
    explanation: 'First-line for T2DM. Start with lifestyle modifications.',
    pearl: 'Avoid in eGFR <30. Hold before contrast procedures.',
  },
  {
    id: 'fl-dm2-ascvd',
    condition: 'Type 2 Diabetes with ASCVD',
    category: 'Endocrinology',
    firstLine: 'Metformin + GLP-1 RA or SGLT2 inhibitor',
    explanation: 'GLP-1 RAs and SGLT2i have proven cardiovascular benefits.',
    pearl: 'Empagliflozin and liraglutide reduce CV mortality.',
  },
  {
    id: 'fl-dm2-ckd',
    condition: 'Type 2 Diabetes with CKD',
    category: 'Endocrinology',
    firstLine: 'Metformin + SGLT2 inhibitor',
    explanation: 'SGLT2 inhibitors slow CKD progression and reduce proteinuria.',
    pearl: 'Can use SGLT2i for renal protection even with eGFR as low as 20.',
  },
  {
    id: 'fl-hypothyroid',
    condition: 'Hypothyroidism',
    category: 'Endocrinology',
    firstLine: 'Levothyroxine',
    explanation: 'Synthetic T4, take on empty stomach in morning.',
    pearl: 'Wait 4-6 weeks before rechecking TSH after dose changes.',
  },
  {
    id: 'fl-hyperthyroid-graves',
    condition: 'Hyperthyroidism (Graves disease)',
    category: 'Endocrinology',
    firstLine: 'Methimazole',
    alternatives: ['Propylthiouracil (PTU) in first trimester pregnancy'],
    explanation: 'Thionamides block thyroid hormone synthesis.',
    pearl: 'Beta-blockers for symptom control. PTU preferred in first trimester.',
  },
  {
    id: 'fl-osteoporosis',
    condition: 'Osteoporosis',
    category: 'Endocrinology',
    firstLine: 'Oral bisphosphonate (alendronate, risedronate)',
    alternatives: ['IV zoledronic acid', 'Denosumab'],
    explanation: 'Bisphosphonates inhibit osteoclast-mediated bone resorption.',
    pearl: 'Take on empty stomach with full glass of water, remain upright 30 min.',
  },

  // =====================================================
  // GASTROENTEROLOGY
  // =====================================================
  {
    id: 'fl-gerd',
    condition: 'GERD',
    category: 'Gastroenterology',
    firstLine: 'Proton pump inhibitor (omeprazole, pantoprazole)',
    alternatives: ['H2 blocker (famotidine)'],
    explanation: 'PPIs are most effective for acid suppression.',
    pearl: 'Take 30-60 minutes before meals. Consider stepping down after 8 weeks.',
  },
  {
    id: 'fl-pud-hpylori',
    condition: 'Peptic Ulcer Disease (H. pylori positive)',
    category: 'Gastroenterology',
    firstLine: 'PPI + Clarithromycin + Amoxicillin (triple therapy)',
    alternatives: ['Bismuth quadruple therapy'],
    explanation: 'Eradicate H. pylori to heal ulcer and prevent recurrence.',
    pearl: 'Confirm eradication with stool antigen or urea breath test 4 weeks after treatment.',
  },
  {
    id: 'fl-ibd-uc-mild',
    condition: 'Ulcerative Colitis (mild)',
    category: 'Gastroenterology',
    firstLine: '5-ASA (mesalamine) - oral and/or rectal',
    explanation: 'Topical and oral aminosalicylates for mild-moderate UC.',
    pearl: 'Rectal formulations are particularly effective for distal disease.',
  },
  {
    id: 'fl-ibd-crohns',
    condition: 'Crohn Disease (moderate-severe)',
    category: 'Gastroenterology',
    firstLine: 'Anti-TNF agent (infliximab, adalimumab)',
    alternatives: ['Corticosteroids for flares'],
    explanation: 'Biologics are first-line for moderate-severe Crohn disease.',
    pearl: 'Screen for latent TB before starting anti-TNF therapy.',
  },
  {
    id: 'fl-cdiff',
    condition: 'C. difficile Infection (initial, non-severe)',
    category: 'Gastroenterology',
    firstLine: 'Fidaxomicin OR Vancomycin (oral)',
    explanation: 'Fidaxomicin preferred for lower recurrence rate. Oral vancomycin is alternative.',
    pearl: 'Metronidazole no longer first-line per 2021 IDSA guidelines.',
  },

  // =====================================================
  // NEUROLOGY/PSYCHIATRY
  // =====================================================
  {
    id: 'fl-mdd',
    condition: 'Major Depressive Disorder',
    category: 'Psychiatry',
    firstLine: 'SSRI (sertraline, escitalopram, fluoxetine)',
    alternatives: ['SNRI (venlafaxine, duloxetine)', 'Bupropion'],
    explanation: 'SSRIs are first-line due to efficacy and tolerability.',
    pearl: 'Takes 4-6 weeks for full effect. Continue for at least 6-12 months.',
  },
  {
    id: 'fl-gad',
    condition: 'Generalized Anxiety Disorder',
    category: 'Psychiatry',
    firstLine: 'SSRI or SNRI',
    alternatives: ['Buspirone'],
    explanation: 'First-line agents are the same as for depression.',
    pearl: 'Benzodiazepines for short-term use only. Buspirone is non-addictive.',
  },
  {
    id: 'fl-panic',
    condition: 'Panic Disorder',
    category: 'Psychiatry',
    firstLine: 'SSRI',
    alternatives: ['SNRI', 'Benzodiazepine (short-term)'],
    explanation: 'SSRIs reduce frequency and severity of panic attacks.',
    pearl: 'CBT is effective adjunct. Avoid long-term benzodiazepine use.',
  },
  {
    id: 'fl-schizophrenia',
    condition: 'Schizophrenia (first episode)',
    category: 'Psychiatry',
    firstLine: 'Second-generation (atypical) antipsychotic',
    alternatives: ['First-generation if cost is a concern'],
    explanation: 'Atypicals (risperidone, olanzapine, aripiprazole) have fewer EPS.',
    pearl: 'Monitor for metabolic syndrome with atypical antipsychotics.',
  },
  {
    id: 'fl-bipolar-acute-mania',
    condition: 'Bipolar Disorder (acute mania)',
    category: 'Psychiatry',
    firstLine: 'Lithium OR Valproate OR Atypical antipsychotic',
    explanation: 'Mood stabilizers are cornerstone of bipolar treatment.',
    pearl: 'Monitor lithium levels, renal function, and thyroid function.',
  },
  {
    id: 'fl-migraine-acute',
    condition: 'Migraine (acute)',
    category: 'Neurology',
    firstLine: 'NSAID or Triptan (sumatriptan)',
    explanation: 'Triptans are serotonin agonists effective for moderate-severe migraine.',
    pearl: 'Take early in attack. Contraindicated in CAD/uncontrolled HTN.',
  },
  {
    id: 'fl-migraine-prevention',
    condition: 'Migraine (prevention)',
    category: 'Neurology',
    firstLine: 'Beta-blocker (propranolol) OR Topiramate OR Amitriptyline',
    alternatives: ['CGRP inhibitors (erenumab)'],
    explanation: 'Prophylaxis indicated if ≥4 migraines/month or significant disability.',
    pearl: 'CGRP inhibitors are newer options with good efficacy.',
  },
  {
    id: 'fl-seizure-partial',
    condition: 'Focal (Partial) Seizures',
    category: 'Neurology',
    firstLine: 'Levetiracetam OR Lamotrigine OR Carbamazepine',
    explanation: 'Newer agents (levetiracetam) have fewer drug interactions.',
    pearl: 'Carbamazepine and oxcarbazepine can worsen absence seizures.',
  },
  {
    id: 'fl-seizure-generalized',
    condition: 'Generalized Tonic-Clonic Seizures',
    category: 'Neurology',
    firstLine: 'Valproate OR Levetiracetam OR Lamotrigine',
    explanation: 'Valproate is highly effective but has teratogenic risks.',
    pearl: 'Avoid valproate in women of childbearing potential.',
  },

  // =====================================================
  // RHEUMATOLOGY/MSK
  // =====================================================
  {
    id: 'fl-gout-acute',
    condition: 'Gout (acute flare)',
    category: 'Rheumatology',
    firstLine: 'NSAID OR Colchicine OR Corticosteroids',
    explanation: 'Any of the three are appropriate first-line.',
    pearl: 'Do not start urate-lowering therapy during acute attack.',
  },
  {
    id: 'fl-gout-urate',
    condition: 'Gout (urate lowering)',
    category: 'Rheumatology',
    firstLine: 'Allopurinol',
    alternatives: ['Febuxostat'],
    explanation: 'Start after acute attack resolves. Target uric acid <6 mg/dL.',
    pearl: 'Start low (100mg) and titrate slowly to avoid precipitating flares.',
  },
  {
    id: 'fl-ra',
    condition: 'Rheumatoid Arthritis',
    category: 'Rheumatology',
    firstLine: 'Methotrexate',
    alternatives: ['Hydroxychloroquine', 'Sulfasalazine'],
    explanation: 'DMARDs should be started early to prevent joint damage.',
    pearl: 'Add folic acid to reduce methotrexate side effects.',
  },
  {
    id: 'fl-oa',
    condition: 'Osteoarthritis',
    category: 'Rheumatology',
    firstLine: 'Acetaminophen OR Topical NSAIDs',
    alternatives: ['Oral NSAIDs', 'Intra-articular corticosteroids'],
    explanation: 'Start with acetaminophen or topical NSAIDs for safety.',
    pearl: 'Exercise and weight loss are key non-pharmacologic interventions.',
  },
];

/**
 * Get all first-line treatments
 */
export function getAllFirstLineTreatments(): FirstLineTreatment[] {
  return FIRST_LINE_TREATMENTS;
}

/**
 * Get treatments by category
 */
export function getTreatmentsByCategory(category: string): FirstLineTreatment[] {
  return FIRST_LINE_TREATMENTS.filter(t => t.category === category);
}

/**
 * Get a random treatment for quiz
 */
export function getRandomTreatment(): FirstLineTreatment {
  return FIRST_LINE_TREATMENTS[Math.floor(Math.random() * FIRST_LINE_TREATMENTS.length)];
}

/**
 * Get unique categories
 */
export function getCategories(): string[] {
  return [...new Set(FIRST_LINE_TREATMENTS.map(t => t.category))];
}

export default FIRST_LINE_TREATMENTS;
