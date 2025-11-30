/**
 * Clinical Guidelines Database for PANaCEa
 * 
 * Contains high-yield PANCE clinical criteria, scoring systems, and screening guidelines.
 * Each guideline includes components for scoring and sample vignettes for practice.
 */

import type { Guideline, GuidelineComponent, ScoreTier, GuidelineCase } from '@/types/guidelines';

/**
 * Master registry of all clinical guidelines
 */
export const GUIDELINES_DATABASE: Guideline[] = [
  // =====================================================
  // CARDIOLOGY
  // =====================================================
  {
    id: 'wells-dvt',
    name: 'Wells Criteria (DVT)',
    description: 'Clinical decision rule for estimating pretest probability of deep vein thrombosis.',
    clinicalContext: 'Use to determine the need for D-dimer testing or imaging in suspected DVT.',
    maxScore: 9,
    components: [
      { id: 'active-cancer', label: 'Active cancer (treatment ongoing or within 6 months)', pointValue: 1 },
      { id: 'paralysis-paresis', label: 'Paralysis, paresis, or recent cast immobilization', pointValue: 1 },
      { id: 'bedridden', label: 'Recently bedridden >3 days or major surgery within 12 weeks', pointValue: 1 },
      { id: 'localized-tenderness', label: 'Localized tenderness along deep venous system', pointValue: 1 },
      { id: 'entire-leg-swollen', label: 'Entire leg swollen', pointValue: 1 },
      { id: 'calf-swelling', label: 'Calf swelling >3 cm compared to other leg', pointValue: 1 },
      { id: 'pitting-edema', label: 'Pitting edema (greater in symptomatic leg)', pointValue: 1 },
      { id: 'collateral-veins', label: 'Collateral superficial veins (non-varicose)', pointValue: 1 },
      { id: 'previous-dvt', label: 'Previously documented DVT', pointValue: 1 },
      { id: 'alternative-diagnosis', label: 'Alternative diagnosis as likely or more likely', pointValue: -2 },
    ],
    scoringMap: [
      { minScore: -2, maxScore: 0, tier: 'Low Risk', recommendation: 'D-dimer testing. If negative, DVT can be ruled out.' },
      { minScore: 1, maxScore: 2, tier: 'Moderate Risk', recommendation: 'D-dimer testing. If positive, perform ultrasound.' },
      { minScore: 3, maxScore: 9, tier: 'High Risk', recommendation: 'Proceed directly to ultrasound.' },
    ],
    vignettes: [
      {
        id: 'wells-dvt-v1',
        story: 'A 58-year-old woman presents with left leg swelling for 3 days. She had knee replacement surgery 8 weeks ago and has been less mobile since. On exam, her left calf is 4 cm larger than the right with pitting edema. She has tenderness along the popliteal fossa.',
        metCriteriaIds: ['bedridden', 'localized-tenderness', 'calf-swelling', 'pitting-edema'],
        correctScore: 4,
        explanation: 'This patient has 4 points: bedridden/surgery (+1), localized tenderness (+1), calf swelling >3cm (+1), pitting edema (+1). This is HIGH risk requiring direct ultrasound.',
      },
      {
        id: 'wells-dvt-v2',
        story: 'A 35-year-old otherwise healthy male presents with mild calf pain after a long flight. He has no swelling, no tenderness, and full range of motion. Exam reveals no abnormalities. He is worried about DVT because his father had one.',
        metCriteriaIds: ['alternative-diagnosis'],
        correctScore: -2,
        explanation: 'No DVT criteria are met, and an alternative diagnosis (muscle strain, anxiety) is more likely. Score is -2 (alternative diagnosis), making this LOW risk.',
      },
    ],
  },

  {
    id: 'wells-pe',
    name: 'Wells Criteria (PE)',
    description: 'Clinical prediction rule for estimating pretest probability of pulmonary embolism.',
    clinicalContext: 'Use alongside clinical judgment to determine the need for imaging in suspected PE.',
    maxScore: 12,
    components: [
      { id: 'dvt-signs', label: 'Clinical signs and symptoms of DVT', pointValue: 3 },
      { id: 'pe-likely', label: 'PE is #1 diagnosis or equally likely', pointValue: 3 },
      { id: 'hr-100', label: 'Heart rate >100 bpm', pointValue: 1.5 },
      { id: 'immobilization-surgery', label: 'Immobilization or surgery in previous 4 weeks', pointValue: 1.5 },
      { id: 'previous-pe-dvt', label: 'Previous PE or DVT', pointValue: 1.5 },
      { id: 'hemoptysis', label: 'Hemoptysis', pointValue: 1 },
      { id: 'malignancy', label: 'Malignancy (on treatment, treated in last 6 months, or palliative)', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 4, tier: 'PE Unlikely', recommendation: 'D-dimer testing. If negative, PE ruled out. If positive, imaging.' },
      { minScore: 4.5, maxScore: 12, tier: 'PE Likely', recommendation: 'Proceed to CT pulmonary angiography.' },
    ],
    vignettes: [
      {
        id: 'wells-pe-v1',
        story: 'A 62-year-old woman with breast cancer on chemotherapy presents with acute dyspnea and pleuritic chest pain. HR 108, RR 22. No leg swelling. You suspect PE is the most likely diagnosis.',
        metCriteriaIds: ['pe-likely', 'hr-100', 'malignancy'],
        correctScore: 5.5,
        explanation: 'PE #1 diagnosis (+3), HR >100 (+1.5), malignancy (+1) = 5.5 points. This is PE LIKELY, requiring CT-PA.',
      },
    ],
  },

  {
    id: 'curb-65',
    name: 'CURB-65 Score',
    description: 'Severity scoring system for community-acquired pneumonia to guide disposition.',
    clinicalContext: 'Determines if pneumonia can be treated as outpatient or requires hospital/ICU admission.',
    maxScore: 5,
    components: [
      { id: 'confusion', label: 'Confusion (new disorientation)', pointValue: 1 },
      { id: 'urea', label: 'Urea (BUN) >7 mmol/L (>19 mg/dL)', pointValue: 1 },
      { id: 'resp-rate', label: 'Respiratory rate ≥30/min', pointValue: 1 },
      { id: 'bp-low', label: 'Blood pressure (SBP <90 or DBP ≤60 mmHg)', pointValue: 1 },
      { id: 'age-65', label: 'Age ≥65 years', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 1, tier: 'Low Risk', recommendation: 'Outpatient treatment (mortality ~1.5%)' },
      { minScore: 2, maxScore: 2, tier: 'Moderate Risk', recommendation: 'Consider hospital admission (mortality ~9%)' },
      { minScore: 3, maxScore: 5, tier: 'High Risk', recommendation: 'Hospital admission; consider ICU if 4-5 (mortality 15-40%)' },
    ],
    vignettes: [
      {
        id: 'curb-65-v1',
        story: 'A 72-year-old man presents with cough, fever, and dyspnea for 2 days. He is confused about the date. Vitals: BP 100/65, HR 95, RR 28, T 101.5°F. Labs show BUN 25 mg/dL.',
        metCriteriaIds: ['confusion', 'urea', 'age-65'],
        correctScore: 3,
        explanation: 'Confusion (+1), BUN >19 (+1), Age 65+ (+1) = 3 points. RR is 28 (not ≥30), BP is adequate. HIGH risk requiring hospital admission.',
      },
      {
        id: 'curb-65-v2',
        story: 'A 45-year-old woman presents with productive cough and fever. She is alert and oriented. Vitals: BP 118/75, HR 88, RR 20, T 100.8°F. Labs show BUN 12 mg/dL.',
        metCriteriaIds: [],
        correctScore: 0,
        explanation: 'No criteria met. Age <65, alert, normal BUN, normal RR, normal BP. Score = 0, LOW risk, outpatient treatment appropriate.',
      },
    ],
  },

  {
    id: 'chadsvasc',
    name: 'CHA₂DS₂-VASc Score',
    description: 'Stroke risk stratification for patients with non-valvular atrial fibrillation.',
    clinicalContext: 'Determines the need for anticoagulation therapy in atrial fibrillation.',
    maxScore: 9,
    components: [
      { id: 'chf', label: 'Congestive heart failure (or LVEF ≤40%)', pointValue: 1 },
      { id: 'hypertension', label: 'Hypertension', pointValue: 1 },
      { id: 'age-75', label: 'Age ≥75 years', pointValue: 2 },
      { id: 'diabetes', label: 'Diabetes mellitus', pointValue: 1 },
      { id: 'stroke-tia', label: 'Prior Stroke/TIA/Thromboembolism', pointValue: 2 },
      { id: 'vascular-disease', label: 'Vascular disease (prior MI, PAD, or aortic plaque)', pointValue: 1 },
      { id: 'age-65-74', label: 'Age 65-74 years', pointValue: 1 },
      { id: 'female', label: 'Sex category (female)', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 0, tier: 'Low Risk (Males)', recommendation: 'No anticoagulation (or aspirin)' },
      { minScore: 1, maxScore: 1, tier: 'Low-Moderate Risk', recommendation: 'Consider anticoagulation based on bleeding risk' },
      { minScore: 2, maxScore: 9, tier: 'High Risk', recommendation: 'Anticoagulation recommended' },
    ],
    vignettes: [
      {
        id: 'chadsvasc-v1',
        story: 'A 78-year-old woman with a history of hypertension and type 2 diabetes is found to have new-onset atrial fibrillation during a routine visit. She has no history of stroke, heart failure, or vascular disease.',
        metCriteriaIds: ['hypertension', 'age-75', 'diabetes', 'female'],
        correctScore: 5,
        explanation: 'HTN (+1), Age ≥75 (+2), DM (+1), Female (+1) = 5 points. HIGH risk requiring anticoagulation.',
      },
    ],
  },

  {
    id: 'timi-nstemi',
    name: 'TIMI Score (UA/NSTEMI)',
    description: 'Risk stratification for patients with unstable angina or NSTEMI.',
    clinicalContext: 'Predicts 14-day risk of death, new MI, or urgent revascularization.',
    maxScore: 7,
    components: [
      { id: 'age-65', label: 'Age ≥65 years', pointValue: 1 },
      { id: 'cad-risk-factors', label: '≥3 CAD risk factors (HTN, DM, family Hx, hyperlipidemia, smoking)', pointValue: 1 },
      { id: 'known-cad', label: 'Known CAD (stenosis ≥50%)', pointValue: 1 },
      { id: 'asa-use', label: 'ASA use in past 7 days', pointValue: 1 },
      { id: 'severe-angina', label: 'Severe angina (≥2 episodes in 24 hours)', pointValue: 1 },
      { id: 'st-deviation', label: 'ST deviation ≥0.5mm', pointValue: 1 },
      { id: 'positive-troponin', label: 'Positive cardiac biomarker (troponin)', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 2, tier: 'Low Risk', recommendation: '14-day event rate ~8%' },
      { minScore: 3, maxScore: 4, tier: 'Intermediate Risk', recommendation: '14-day event rate ~13-20%' },
      { minScore: 5, maxScore: 7, tier: 'High Risk', recommendation: '14-day event rate ~26-41%; early invasive strategy' },
    ],
    vignettes: [
      {
        id: 'timi-v1',
        story: 'A 68-year-old man with DM, HTN, and hyperlipidemia presents with 3 episodes of chest pain in the past day. He takes aspirin daily. ECG shows 1mm ST depression. Troponin I is elevated at 0.8 ng/mL. He had a stent placed 2 years ago.',
        metCriteriaIds: ['age-65', 'cad-risk-factors', 'known-cad', 'asa-use', 'severe-angina', 'st-deviation', 'positive-troponin'],
        correctScore: 7,
        explanation: 'All 7 criteria are met. This is HIGH risk requiring early invasive management.',
      },
    ],
  },

  // =====================================================
  // GASTROINTESTINAL
  // =====================================================
  {
    id: 'ranson-pancreatitis',
    name: "Ranson's Criteria (Pancreatitis)",
    description: 'Prognostic scoring system for acute pancreatitis severity.',
    clinicalContext: 'Assessed at admission and at 48 hours to predict mortality risk.',
    maxScore: 11,
    components: [
      // Admission criteria (GA LAW)
      { id: 'glucose', label: 'Glucose >200 mg/dL (at admission)', pointValue: 1, description: 'GA LAW - G' },
      { id: 'age', label: 'Age >55 years (at admission)', pointValue: 1, description: 'GA LAW - A' },
      { id: 'ldh', label: 'LDH >350 U/L (at admission)', pointValue: 1, description: 'GA LAW - L' },
      { id: 'ast', label: 'AST >250 U/L (at admission)', pointValue: 1, description: 'GA LAW - A' },
      { id: 'wbc', label: 'WBC >16,000/mm³ (at admission)', pointValue: 1, description: 'GA LAW - W' },
      // 48-hour criteria (C HOBBS)
      { id: 'calcium', label: 'Calcium <8 mg/dL (at 48h)', pointValue: 1, description: 'C HOBBS - C' },
      { id: 'hematocrit', label: 'Hematocrit decrease >10% (at 48h)', pointValue: 1, description: 'C HOBBS - H' },
      { id: 'oxygen', label: 'PaO2 <60 mmHg (at 48h)', pointValue: 1, description: 'C HOBBS - O' },
      { id: 'bun', label: 'BUN increase >5 mg/dL (at 48h)', pointValue: 1, description: 'C HOBBS - B' },
      { id: 'base-deficit', label: 'Base deficit >4 mEq/L (at 48h)', pointValue: 1, description: 'C HOBBS - B' },
      { id: 'fluid-sequestration', label: 'Fluid sequestration >6L (at 48h)', pointValue: 1, description: 'C HOBBS - S' },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 2, tier: 'Mild', recommendation: 'Mortality ~2%' },
      { minScore: 3, maxScore: 4, tier: 'Moderate', recommendation: 'Mortality ~15%' },
      { minScore: 5, maxScore: 6, tier: 'Severe', recommendation: 'Mortality ~40%' },
      { minScore: 7, maxScore: 11, tier: 'Critical', recommendation: 'Mortality ~100%' },
    ],
    vignettes: [
      {
        id: 'ranson-v1',
        story: 'A 60-year-old man presents with acute epigastric pain and vomiting. Labs at admission: Glucose 220 mg/dL, WBC 18,000, AST 320 U/L, LDH 400 U/L. Lipase is elevated.',
        metCriteriaIds: ['glucose', 'age', 'ldh', 'ast', 'wbc'],
        correctScore: 5,
        explanation: 'At admission: Glucose >200 (+1), Age >55 (+1), LDH >350 (+1), AST >250 (+1), WBC >16k (+1) = 5 points. SEVERE pancreatitis.',
      },
    ],
  },

  {
    id: 'alvarado',
    name: 'Alvarado Score (Appendicitis)',
    description: 'Clinical scoring system to aid diagnosis of acute appendicitis.',
    clinicalContext: 'Used to determine if imaging or surgical consultation is needed.',
    maxScore: 10,
    components: [
      // MANTRELS mnemonic
      { id: 'migration', label: 'Migration of pain to RLQ', pointValue: 1, description: 'M' },
      { id: 'anorexia', label: 'Anorexia', pointValue: 1, description: 'A' },
      { id: 'nausea', label: 'Nausea/Vomiting', pointValue: 1, description: 'N' },
      { id: 'tenderness', label: 'Tenderness in RLQ', pointValue: 2, description: 'T (+2)' },
      { id: 'rebound', label: 'Rebound tenderness', pointValue: 1, description: 'R' },
      { id: 'elevated-temp', label: 'Elevated temperature (≥37.3°C/99.1°F)', pointValue: 1, description: 'E' },
      { id: 'leukocytosis', label: 'Leukocytosis (WBC >10,000)', pointValue: 2, description: 'L (+2)' },
      { id: 'shift', label: 'Shift to left (>75% neutrophils)', pointValue: 1, description: 'S' },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 4, tier: 'Low Risk', recommendation: 'Appendicitis unlikely; observe or discharge' },
      { minScore: 5, maxScore: 6, tier: 'Intermediate Risk', recommendation: 'Possible appendicitis; imaging recommended' },
      { minScore: 7, maxScore: 10, tier: 'High Risk', recommendation: 'Probable appendicitis; surgical consultation' },
    ],
    vignettes: [
      {
        id: 'alvarado-v1',
        story: 'A 22-year-old man presents with periumbilical pain that has migrated to the RLQ over 12 hours. He has anorexia and nausea. T 99.5°F. RLQ tenderness with rebound. WBC 14,000 with 80% neutrophils.',
        metCriteriaIds: ['migration', 'anorexia', 'nausea', 'tenderness', 'rebound', 'elevated-temp', 'leukocytosis', 'shift'],
        correctScore: 10,
        explanation: 'All criteria met: Migration (+1), Anorexia (+1), Nausea (+1), Tenderness RLQ (+2), Rebound (+1), Fever (+1), Leukocytosis (+2), Left shift (+1) = 10 points. HIGH probability of appendicitis.',
      },
    ],
  },

  // =====================================================
  // EMERGENCY / CRITICAL CARE
  // =====================================================
  {
    id: 'sirs',
    name: 'SIRS Criteria',
    description: 'Systemic Inflammatory Response Syndrome criteria (2+ required).',
    clinicalContext: 'Foundation for sepsis diagnosis. SIRS + suspected infection = sepsis.',
    maxScore: 4,
    components: [
      { id: 'temp', label: 'Temperature >38°C (100.4°F) or <36°C (96.8°F)', pointValue: 1 },
      { id: 'hr', label: 'Heart rate >90 bpm', pointValue: 1 },
      { id: 'rr', label: 'Respiratory rate >20/min or PaCO₂ <32 mmHg', pointValue: 1 },
      { id: 'wbc', label: 'WBC >12,000 or <4,000 or >10% bands', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 1, tier: 'Not SIRS', recommendation: 'SIRS criteria not met' },
      { minScore: 2, maxScore: 4, tier: 'SIRS Present', recommendation: 'If infection suspected, evaluate for sepsis' },
    ],
    vignettes: [
      {
        id: 'sirs-v1',
        story: 'A 55-year-old woman with UTI symptoms presents with T 101.2°F, HR 105, RR 24, BP 100/60. WBC is 15,000.',
        metCriteriaIds: ['temp', 'hr', 'rr', 'wbc'],
        correctScore: 4,
        explanation: 'All 4 SIRS criteria met. With suspected UTI, this meets criteria for sepsis.',
      },
    ],
  },

  {
    id: 'qsofa',
    name: 'qSOFA Score',
    description: 'Quick Sequential Organ Failure Assessment for sepsis risk stratification.',
    clinicalContext: 'Identifies patients at risk of poor outcome outside the ICU.',
    maxScore: 3,
    components: [
      { id: 'rr', label: 'Respiratory rate ≥22/min', pointValue: 1 },
      { id: 'ams', label: 'Altered mentation (GCS <15)', pointValue: 1 },
      { id: 'sbp', label: 'Systolic blood pressure ≤100 mmHg', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 1, tier: 'Low Risk', recommendation: 'Low risk of poor outcome' },
      { minScore: 2, maxScore: 3, tier: 'High Risk', recommendation: 'Increased risk of mortality; intensive monitoring' },
    ],
    vignettes: [
      {
        id: 'qsofa-v1',
        story: 'A 68-year-old man with pneumonia presents confused about his location. Vitals: BP 95/55, HR 110, RR 26, SpO2 91%.',
        metCriteriaIds: ['rr', 'ams', 'sbp'],
        correctScore: 3,
        explanation: 'RR ≥22 (+1), Altered mentation (+1), SBP ≤100 (+1) = 3 points. HIGH risk.',
      },
    ],
  },

  {
    id: 'gcs',
    name: 'Glasgow Coma Scale (GCS)',
    description: 'Standardized assessment of consciousness level.',
    clinicalContext: 'Used in trauma, neurology, and critical care for prognosis and management decisions.',
    maxScore: 15,
    components: [
      { id: 'eye-4', label: 'Eye Opening: Spontaneous', pointValue: 4 },
      { id: 'eye-3', label: 'Eye Opening: To voice', pointValue: 3 },
      { id: 'eye-2', label: 'Eye Opening: To pain', pointValue: 2 },
      { id: 'eye-1', label: 'Eye Opening: None', pointValue: 1 },
      { id: 'verbal-5', label: 'Verbal: Oriented', pointValue: 5 },
      { id: 'verbal-4', label: 'Verbal: Confused', pointValue: 4 },
      { id: 'verbal-3', label: 'Verbal: Inappropriate words', pointValue: 3 },
      { id: 'verbal-2', label: 'Verbal: Incomprehensible sounds', pointValue: 2 },
      { id: 'verbal-1', label: 'Verbal: None', pointValue: 1 },
      { id: 'motor-6', label: 'Motor: Obeys commands', pointValue: 6 },
      { id: 'motor-5', label: 'Motor: Localizes pain', pointValue: 5 },
      { id: 'motor-4', label: 'Motor: Withdraws from pain', pointValue: 4 },
      { id: 'motor-3', label: 'Motor: Abnormal flexion (decorticate)', pointValue: 3 },
      { id: 'motor-2', label: 'Motor: Extension (decerebrate)', pointValue: 2 },
      { id: 'motor-1', label: 'Motor: None', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 3, maxScore: 8, tier: 'Severe (Coma)', recommendation: 'Intubation often required; poor prognosis' },
      { minScore: 9, maxScore: 12, tier: 'Moderate', recommendation: 'Close monitoring required' },
      { minScore: 13, maxScore: 15, tier: 'Mild', recommendation: 'Alert or mildly impaired' },
    ],
    vignettes: [
      {
        id: 'gcs-v1',
        story: 'A patient is brought in after a motor vehicle collision. He opens his eyes to painful stimuli, makes incomprehensible sounds, and withdraws his extremities from pain.',
        metCriteriaIds: ['eye-2', 'verbal-2', 'motor-4'],
        correctScore: 8,
        explanation: 'Eye to pain (2) + Incomprehensible sounds (2) + Withdraws (4) = GCS 8. SEVERE impairment.',
      },
    ],
  },

  // =====================================================
  // NEUROLOGY / PSYCHIATRY
  // =====================================================
  {
    id: 'sigecaps',
    name: 'SIGECAPS (Major Depression)',
    description: 'Mnemonic for Major Depressive Episode diagnostic criteria.',
    clinicalContext: '5 or more symptoms for ≥2 weeks, including depressed mood or anhedonia.',
    maxScore: 9,
    components: [
      { id: 'sleep', label: 'Sleep disturbance (insomnia or hypersomnia)', pointValue: 1, description: 'S' },
      { id: 'interest', label: 'Interest decreased (anhedonia)', pointValue: 1, description: 'I' },
      { id: 'guilt', label: 'Guilt or worthlessness', pointValue: 1, description: 'G' },
      { id: 'energy', label: 'Energy decreased / fatigue', pointValue: 1, description: 'E' },
      { id: 'concentration', label: 'Concentration decreased', pointValue: 1, description: 'C' },
      { id: 'appetite', label: 'Appetite change (increased or decreased)', pointValue: 1, description: 'A' },
      { id: 'psychomotor', label: 'Psychomotor agitation or retardation', pointValue: 1, description: 'P' },
      { id: 'suicide', label: 'Suicidal ideation', pointValue: 1, description: 'S' },
      { id: 'depressed-mood', label: 'Depressed mood (most of the day, nearly every day)', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 4, tier: 'Subclinical', recommendation: 'Does not meet criteria for Major Depressive Episode' },
      { minScore: 5, maxScore: 9, tier: 'Major Depressive Episode', recommendation: 'Must include depressed mood or anhedonia for ≥2 weeks' },
    ],
    vignettes: [
      {
        id: 'sigecaps-v1',
        story: 'A 35-year-old woman reports 3 weeks of feeling sad and "empty." She has lost interest in hobbies, has trouble sleeping, has low energy, difficulty concentrating at work, and has lost 8 lbs without trying. She denies suicidal ideation.',
        metCriteriaIds: ['depressed-mood', 'interest', 'sleep', 'energy', 'concentration', 'appetite'],
        correctScore: 6,
        explanation: 'Depressed mood (+1), Anhedonia (+1), Sleep (+1), Energy (+1), Concentration (+1), Appetite (+1) = 6 criteria. Meets MDE criteria.',
      },
    ],
  },

  {
    id: 'cage',
    name: 'CAGE Questionnaire',
    description: 'Screening tool for alcohol use disorder.',
    clinicalContext: '≥2 positive answers suggests alcohol use disorder.',
    maxScore: 4,
    components: [
      { id: 'cut-down', label: 'Have you ever felt you should Cut down on your drinking?', pointValue: 1, description: 'C' },
      { id: 'annoyed', label: 'Have people Annoyed you by criticizing your drinking?', pointValue: 1, description: 'A' },
      { id: 'guilty', label: 'Have you ever felt Guilty about your drinking?', pointValue: 1, description: 'G' },
      { id: 'eye-opener', label: 'Have you ever had a drink first thing in the morning (Eye-opener)?', pointValue: 1, description: 'E' },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 1, tier: 'Low Suspicion', recommendation: 'Low likelihood of alcohol use disorder' },
      { minScore: 2, maxScore: 4, tier: 'High Suspicion', recommendation: 'Further evaluation for alcohol use disorder recommended' },
    ],
    vignettes: [
      {
        id: 'cage-v1',
        story: 'During a routine visit, a 50-year-old man admits he has tried to cut down on drinking, his wife nags him about it, and he sometimes has a drink in the morning to "calm his nerves."',
        metCriteriaIds: ['cut-down', 'annoyed', 'eye-opener'],
        correctScore: 3,
        explanation: 'Cut down (+1), Annoyed (+1), Eye-opener (+1) = 3 points. HIGH suspicion for alcohol use disorder.',
      },
    ],
  },

  // =====================================================
  // MSK / TRAUMA
  // =====================================================
  {
    id: 'ottawa-ankle',
    name: 'Ottawa Ankle Rules',
    description: 'Clinical decision rule to determine need for X-ray in ankle injuries.',
    clinicalContext: 'High sensitivity for ruling out fractures; reduces unnecessary imaging.',
    maxScore: 4,
    components: [
      { id: 'malleolar-zone', label: 'Pain in malleolar zone', pointValue: 1, description: 'Required' },
      { id: 'post-lat-malleolus', label: 'Bone tenderness at posterior edge of lateral malleolus (6 cm)', pointValue: 1 },
      { id: 'post-med-malleolus', label: 'Bone tenderness at posterior edge of medial malleolus (6 cm)', pointValue: 1 },
      { id: 'unable-weight-bear', label: 'Inability to bear weight (4 steps) immediately and in ED', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 1, tier: 'X-ray Not Needed', recommendation: 'Pain in zone but no tenderness or weight-bearing issue' },
      { minScore: 2, maxScore: 4, tier: 'X-ray Indicated', recommendation: 'Pain + bone tenderness OR inability to bear weight' },
    ],
    vignettes: [
      {
        id: 'ottawa-ankle-v1',
        story: 'A 28-year-old man twisted his ankle playing basketball. He has pain over the lateral malleolus with tenderness at the posterior tip. He was able to walk off the court but now cannot bear weight.',
        metCriteriaIds: ['malleolar-zone', 'post-lat-malleolus', 'unable-weight-bear'],
        correctScore: 3,
        explanation: 'Malleolar zone pain (+1), posterior lateral malleolus tenderness (+1), unable to bear weight (+1) = X-ray indicated.',
      },
    ],
  },

  {
    id: 'kocher',
    name: 'Kocher Criteria (Septic Arthritis)',
    description: 'Clinical prediction rule to differentiate septic arthritis from transient synovitis in children.',
    clinicalContext: 'Used in pediatric hip pain to determine need for joint aspiration.',
    maxScore: 4,
    components: [
      { id: 'non-weight-bearing', label: 'Non-weight bearing on affected side', pointValue: 1 },
      { id: 'esr', label: 'ESR >40 mm/hr', pointValue: 1 },
      { id: 'fever', label: 'Fever >38.5°C (101.3°F)', pointValue: 1 },
      { id: 'wbc', label: 'WBC >12,000/mm³', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 0, tier: '<3% Risk', recommendation: 'Transient synovitis likely; observe' },
      { minScore: 1, maxScore: 1, tier: '~3% Risk', recommendation: 'Low probability; consider observation' },
      { minScore: 2, maxScore: 2, tier: '~40% Risk', recommendation: 'Consider joint aspiration' },
      { minScore: 3, maxScore: 3, tier: '~93% Risk', recommendation: 'Joint aspiration recommended' },
      { minScore: 4, maxScore: 4, tier: '~99% Risk', recommendation: 'Septic arthritis highly likely; urgent aspiration' },
    ],
    vignettes: [
      {
        id: 'kocher-v1',
        story: 'A 4-year-old boy presents with right hip pain and refusal to walk for 1 day. T 102°F, ESR 55 mm/hr, WBC 14,500. He will not bear weight on the right leg.',
        metCriteriaIds: ['non-weight-bearing', 'esr', 'fever', 'wbc'],
        correctScore: 4,
        explanation: 'All 4 criteria met = 99% probability of septic arthritis. Urgent joint aspiration required.',
      },
    ],
  },

  // =====================================================
  // OB/GYN
  // =====================================================
  {
    id: 'amsel',
    name: 'Amsel Criteria (Bacterial Vaginosis)',
    description: 'Diagnostic criteria for bacterial vaginosis (3 of 4 required).',
    clinicalContext: 'Clinical diagnosis of BV; more practical than Nugent scoring.',
    maxScore: 4,
    components: [
      { id: 'discharge', label: 'Thin, white, homogeneous discharge', pointValue: 1 },
      { id: 'whiff', label: 'Positive whiff test (fishy odor with KOH)', pointValue: 1 },
      { id: 'ph', label: 'Vaginal pH >4.5', pointValue: 1 },
      { id: 'clue-cells', label: 'Clue cells on wet mount (>20% of epithelial cells)', pointValue: 1 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 2, tier: 'Not BV', recommendation: 'Bacterial vaginosis criteria not met' },
      { minScore: 3, maxScore: 4, tier: 'Bacterial Vaginosis', recommendation: 'Treat with metronidazole or clindamycin' },
    ],
    vignettes: [
      {
        id: 'amsel-v1',
        story: 'A 28-year-old woman presents with vaginal discharge and odor. Exam shows thin, grayish-white discharge. Vaginal pH is 5.0. KOH whiff test is positive. Wet mount shows epithelial cells with obscured borders.',
        metCriteriaIds: ['discharge', 'whiff', 'ph', 'clue-cells'],
        correctScore: 4,
        explanation: 'All 4 Amsel criteria met. Diagnosis: Bacterial Vaginosis.',
      },
    ],
  },

  // =====================================================
  // PEDIATRICS
  // =====================================================
  {
    id: 'apgar',
    name: 'APGAR Score',
    description: 'Rapid assessment of newborn status at 1 and 5 minutes after birth.',
    clinicalContext: 'Guides need for resuscitation; does not predict long-term outcomes.',
    maxScore: 10,
    components: [
      { id: 'appearance-2', label: 'Appearance: Pink all over', pointValue: 2 },
      { id: 'appearance-1', label: 'Appearance: Pink body, blue extremities', pointValue: 1 },
      { id: 'appearance-0', label: 'Appearance: Blue/pale all over', pointValue: 0 },
      { id: 'pulse-2', label: 'Pulse: >100 bpm', pointValue: 2 },
      { id: 'pulse-1', label: 'Pulse: <100 bpm', pointValue: 1 },
      { id: 'pulse-0', label: 'Pulse: Absent', pointValue: 0 },
      { id: 'grimace-2', label: 'Grimace: Cry/cough with stimulation', pointValue: 2 },
      { id: 'grimace-1', label: 'Grimace: Grimace only', pointValue: 1 },
      { id: 'grimace-0', label: 'Grimace: No response', pointValue: 0 },
      { id: 'activity-2', label: 'Activity: Active movement', pointValue: 2 },
      { id: 'activity-1', label: 'Activity: Some flexion', pointValue: 1 },
      { id: 'activity-0', label: 'Activity: Limp', pointValue: 0 },
      { id: 'respiration-2', label: 'Respiration: Good crying', pointValue: 2 },
      { id: 'respiration-1', label: 'Respiration: Weak/irregular', pointValue: 1 },
      { id: 'respiration-0', label: 'Respiration: Absent', pointValue: 0 },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 3, tier: 'Critically Low', recommendation: 'Immediate resuscitation required' },
      { minScore: 4, maxScore: 6, tier: 'Moderately Low', recommendation: 'Some assistance needed' },
      { minScore: 7, maxScore: 10, tier: 'Normal', recommendation: 'Normal newborn; routine care' },
    ],
    vignettes: [
      {
        id: 'apgar-v1',
        story: 'A newborn at 1 minute after birth: Pink body with blue hands/feet, HR 120, cries with suction, active movement, strong cry.',
        metCriteriaIds: ['appearance-1', 'pulse-2', 'grimace-2', 'activity-2', 'respiration-2'],
        correctScore: 9,
        explanation: 'Appearance 1 + Pulse 2 + Grimace 2 + Activity 2 + Respiration 2 = APGAR 9. Normal.',
      },
    ],
  },

  {
    id: 'kawasaki',
    name: 'Kawasaki Disease Criteria',
    description: 'Diagnostic criteria for Kawasaki disease (fever + 4 of 5 criteria).',
    clinicalContext: 'Fever ≥5 days required. Treat with IVIG to prevent coronary artery aneurysms.',
    maxScore: 6,
    components: [
      { id: 'fever', label: 'Fever ≥5 days', pointValue: 1, description: 'Required' },
      { id: 'conjunctivitis', label: 'Bilateral non-exudative conjunctivitis', pointValue: 1, description: 'C' },
      { id: 'rash', label: 'Polymorphous rash', pointValue: 1, description: 'R' },
      { id: 'adenopathy', label: 'Cervical lymphadenopathy (>1.5 cm)', pointValue: 1, description: 'A' },
      { id: 'strawberry', label: 'Oral changes (strawberry tongue, lip cracking)', pointValue: 1, description: 'S' },
      { id: 'extremity', label: 'Extremity changes (edema, erythema, desquamation)', pointValue: 1, description: 'H' },
    ],
    scoringMap: [
      { minScore: 0, maxScore: 4, tier: 'Incomplete/Atypical', recommendation: 'Consider incomplete Kawasaki if fever + 2-3 criteria with lab support' },
      { minScore: 5, maxScore: 6, tier: 'Classic Kawasaki', recommendation: 'Fever + 4/5 criteria. Start IVIG + aspirin.' },
    ],
    vignettes: [
      {
        id: 'kawasaki-v1',
        story: 'A 3-year-old presents with 6 days of fever, bilateral red eyes without discharge, a diffuse maculopapular rash, red cracked lips, and swollen hands. No lymphadenopathy noted.',
        metCriteriaIds: ['fever', 'conjunctivitis', 'rash', 'strawberry', 'extremity'],
        correctScore: 5,
        explanation: 'Fever ≥5 days (+1), Conjunctivitis (+1), Rash (+1), Oral changes (+1), Extremity changes (+1) = 5 criteria. Classic Kawasaki disease.',
      },
    ],
  },
];

/**
 * Get a guideline by its ID
 */
export function getGuidelineById(id: string): Guideline | undefined {
  return GUIDELINES_DATABASE.find(g => g.id === id);
}

/**
 * Get all guidelines for a specific category
 */
export function getGuidelinesByCategory(category: string): Guideline[] {
  return GUIDELINES_DATABASE.filter(g => {
    // Infer category from guideline context
    if (category === 'Cardiology') {
      return ['wells-dvt', 'wells-pe', 'chadsvasc', 'timi-nstemi'].includes(g.id);
    }
    if (category === 'Pulmonology') {
      return ['curb-65'].includes(g.id);
    }
    if (category === 'GI') {
      return ['ranson-pancreatitis', 'alvarado'].includes(g.id);
    }
    if (category === 'Emergency') {
      return ['sirs', 'qsofa', 'gcs'].includes(g.id);
    }
    if (category === 'Psychiatry') {
      return ['sigecaps', 'cage'].includes(g.id);
    }
    if (category === 'MSK') {
      return ['ottawa-ankle', 'kocher'].includes(g.id);
    }
    if (category === 'OB/GYN') {
      return ['amsel'].includes(g.id);
    }
    if (category === 'Pediatrics') {
      return ['apgar', 'kawasaki'].includes(g.id);
    }
    return false;
  });
}

/**
 * Get all available guideline IDs
 */
export function getAllGuidelineIds(): string[] {
  return GUIDELINES_DATABASE.map(g => g.id);
}

/**
 * Get a random vignette from a guideline
 */
export function getRandomVignette(guidelineId: string): GuidelineCase | undefined {
  const guideline = getGuidelineById(guidelineId);
  if (!guideline || guideline.vignettes.length === 0) return undefined;
  return guideline.vignettes[Math.floor(Math.random() * guideline.vignettes.length)];
}

export default GUIDELINES_DATABASE;
