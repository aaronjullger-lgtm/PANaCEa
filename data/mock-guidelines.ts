import type { Guideline } from '@/types/guidelines';

/**
 * CURB-65 Score for Community-Acquired Pneumonia Severity
 * 
 * Used to assess severity and guide disposition decisions for patients
 * with community-acquired pneumonia (CAP).
 * 
 * Components:
 * - Confusion (1 point)
 * - Urea > 7 mmol/L (1 point)
 * - Respiratory Rate ≥ 30/min (1 point)
 * - Blood Pressure < 90 systolic or ≤ 60 diastolic (1 point)
 * - Age ≥ 65 years (1 point)
 */
export const CURB65_GUIDELINE: Guideline = {
  id: 'curb-65',
  name: 'CURB-65',
  description: 'Severity score for community-acquired pneumonia to guide treatment setting.',
  clinicalContext: 'Use in adult patients with suspected or confirmed community-acquired pneumonia to help determine if outpatient, inpatient, or ICU-level care is appropriate.',
  maxScore: 5,
  components: [
    {
      id: 'confusion',
      label: 'Confusion',
      pointValue: 1,
      description: 'New-onset mental confusion (AMTS ≤ 8 or new disorientation)',
    },
    {
      id: 'urea',
      label: 'Urea > 7 mmol/L',
      pointValue: 1,
      description: 'Blood urea nitrogen > 7 mmol/L (or BUN > 19 mg/dL)',
    },
    {
      id: 'respiratory-rate',
      label: 'Respiratory Rate ≥ 30/min',
      pointValue: 1,
      description: 'Tachypnea with respiratory rate of 30 breaths per minute or higher',
    },
    {
      id: 'blood-pressure',
      label: 'Blood Pressure < 90/60 mmHg',
      pointValue: 1,
      description: 'Systolic BP < 90 mmHg OR diastolic BP ≤ 60 mmHg',
    },
    {
      id: 'age',
      label: 'Age ≥ 65 years',
      pointValue: 1,
      description: 'Patient is 65 years of age or older',
    },
  ],
  scoringMap: [
    {
      minScore: 0,
      maxScore: 1,
      tier: 'Low Risk',
      recommendation: 'Consider outpatient treatment. Mortality risk ~1.5%.',
    },
    {
      minScore: 2,
      maxScore: 2,
      tier: 'Moderate Risk',
      recommendation: 'Consider short inpatient hospitalization or hospital-supervised outpatient treatment. Mortality risk ~9%.',
    },
    {
      minScore: 3,
      maxScore: 5,
      tier: 'High Risk',
      recommendation: 'Manage as severe pneumonia. Consider ICU admission if score ≥4. Mortality risk 15-40%.',
    },
  ],
  vignettes: [
    {
      id: 'curb65-case-1',
      story: `A 72-year-old male presents to the ED with a 3-day history of productive cough, fever, and shortness of breath. 
      
On examination:
- He is confused and oriented only to person
- Temperature: 38.9°C (102°F)
- Heart Rate: 110 bpm
- Respiratory Rate: 24/min
- Blood Pressure: 85/55 mmHg
- SpO2: 91% on room air

Labs show:
- BUN: 12 mg/dL (normal)
- WBC: 15,000/μL

Chest X-ray reveals right lower lobe consolidation consistent with pneumonia.`,
      metCriteriaIds: ['confusion', 'blood-pressure', 'age'],
      correctScore: 3,
      explanation: `This patient scores 3 on CURB-65:

[✓] **Confusion** (1 point): Patient is confused and oriented only to person - this is new-onset mental confusion.

[×] **Urea** (0 points): BUN of 12 mg/dL is within normal limits (not > 19 mg/dL).

[×] **Respiratory Rate** (0 points): RR is 24/min, which is below the threshold of ≥30/min.

[✓] **Blood Pressure** (1 point): BP of 85/55 mmHg meets criteria (systolic < 90 mmHg).

[✓] **Age** (1 point): Patient is 72 years old (≥ 65 years).

**Interpretation**: Score of 3 = High Risk. This patient should be admitted and managed as severe pneumonia. The combination of confusion and hypotension is particularly concerning for sepsis.`,
    },
    {
      id: 'curb65-case-2',
      story: `A 24-year-old female presents to urgent care with a 5-day history of cough and low-grade fever. She reports feeling tired but is able to work from home.

On examination:
- She is alert and oriented x4
- Temperature: 37.8°C (100°F)
- Heart Rate: 88 bpm
- Respiratory Rate: 18/min
- Blood Pressure: 118/72 mmHg
- SpO2: 98% on room air

Labs show:
- BUN: 10 mg/dL (normal)
- WBC: 11,000/μL

Chest X-ray shows a small right middle lobe infiltrate.`,
      metCriteriaIds: [],
      correctScore: 0,
      explanation: `This patient scores 0 on CURB-65:

[×] **Confusion** (0 points): Patient is alert and oriented x4 - no mental status changes.

[×] **Urea** (0 points): BUN of 10 mg/dL is normal (not > 19 mg/dL).

[×] **Respiratory Rate** (0 points): RR is 18/min, well below the threshold of ≥30/min.

[×] **Blood Pressure** (0 points): BP of 118/72 mmHg is normal.

[×] **Age** (0 points): Patient is 24 years old (< 65 years).

**Interpretation**: Score of 0 = Low Risk. This patient can be safely managed as an outpatient with oral antibiotics. She should have close follow-up and return precautions for worsening symptoms.`,
    },
    {
      id: 'curb65-case-3',
      story: `An 80-year-old nursing home resident is brought in by ambulance for worsening respiratory distress. She has dementia at baseline but staff report she has been more confused than usual for 2 days.

On examination:
- Oriented only to self (baseline: oriented x2)
- Temperature: 39.2°C (102.5°F)
- Heart Rate: 120 bpm
- Respiratory Rate: 34/min
- Blood Pressure: 78/50 mmHg
- SpO2: 85% on room air

Labs show:
- BUN: 35 mg/dL (elevated)
- WBC: 18,000/μL
- Creatinine: 2.1 mg/dL

Chest X-ray shows bilateral infiltrates.`,
      metCriteriaIds: ['confusion', 'urea', 'respiratory-rate', 'blood-pressure', 'age'],
      correctScore: 5,
      explanation: `This patient scores 5 on CURB-65 (maximum score):

[✓] **Confusion** (1 point): Despite baseline dementia, she is MORE confused than usual - this counts as acute confusion.

[✓] **Urea** (1 point): BUN of 35 mg/dL is significantly elevated (> 19 mg/dL).

[✓] **Respiratory Rate** (1 point): RR of 34/min exceeds the threshold of ≥30/min.

[✓] **Blood Pressure** (1 point): BP of 78/50 mmHg is severely hypotensive.

[✓] **Age** (1 point): Patient is 80 years old (≥ 65 years).

**Interpretation**: Score of 5 = Very High Risk. This patient requires immediate ICU admission. The combination of all criteria plus bilateral infiltrates suggests severe sepsis from pneumonia. Mortality risk is approximately 40% or higher.`,
    },
  ],
};

/**
 * Glasgow Coma Scale (GCS)
 * 
 * Universal scale for assessing level of consciousness in acute brain injury.
 */
export const GLASGOW_COMA_SCALE: Guideline = {
  id: 'gcs',
  name: 'Glasgow Coma Scale (GCS)',
  description: 'Standardized assessment of consciousness level in acute brain injury.',
  clinicalContext: 'Use to assess and monitor level of consciousness in trauma, stroke, metabolic encephalopathy, and other acute neurological conditions.',
  maxScore: 15,
  components: [
    { id: 'eye-4', label: 'Eyes open spontaneously', pointValue: 4, description: 'E4: Eyes open spontaneously' },
    { id: 'eye-3', label: 'Eyes open to voice', pointValue: 3, description: 'E3: Eyes open to verbal command' },
    { id: 'eye-2', label: 'Eyes open to pain', pointValue: 2, description: 'E2: Eyes open to painful stimuli' },
    { id: 'eye-1', label: 'No eye opening', pointValue: 1, description: 'E1: No eye opening' },
    { id: 'verbal-5', label: 'Oriented', pointValue: 5, description: 'V5: Oriented (knows name, place, date)' },
    { id: 'verbal-4', label: 'Confused', pointValue: 4, description: 'V4: Confused conversation' },
    { id: 'verbal-3', label: 'Inappropriate words', pointValue: 3, description: 'V3: Inappropriate words only' },
    { id: 'verbal-2', label: 'Incomprehensible sounds', pointValue: 2, description: 'V2: Incomprehensible sounds' },
    { id: 'verbal-1', label: 'No verbal response', pointValue: 1, description: 'V1: No verbal response' },
    { id: 'motor-6', label: 'Obeys commands', pointValue: 6, description: 'M6: Obeys commands' },
    { id: 'motor-5', label: 'Localizes pain', pointValue: 5, description: 'M5: Localizes to painful stimuli' },
    { id: 'motor-4', label: 'Withdraws from pain', pointValue: 4, description: 'M4: Withdraws from pain' },
    { id: 'motor-3', label: 'Abnormal flexion (decorticate)', pointValue: 3, description: 'M3: Abnormal flexion to pain' },
    { id: 'motor-2', label: 'Extension (decerebrate)', pointValue: 2, description: 'M2: Extension to pain' },
    { id: 'motor-1', label: 'No motor response', pointValue: 1, description: 'M1: No motor response' },
  ],
  scoringMap: [
    { minScore: 13, maxScore: 15, tier: 'Minor', recommendation: 'Minor head injury. Observe and reassess.' },
    { minScore: 9, maxScore: 12, tier: 'Moderate', recommendation: 'Moderate head injury. CT scan and close monitoring required.' },
    { minScore: 3, maxScore: 8, tier: 'Severe', recommendation: 'Severe head injury. Airway protection and ICU admission indicated.' },
  ],
  vignettes: [
    {
      id: 'gcs-case-1',
      story: `A 45-year-old male is brought to the trauma bay after a motorcycle accident. He is wearing a helmet.

On examination:
- Opens eyes when you call his name loudly
- When asked questions, he responds with inappropriate words like "banana" and "car"
- He withdraws his arm when you apply a sternal rub

Calculate the GCS score.`,
      metCriteriaIds: ['eye-3', 'verbal-3', 'motor-4'],
      correctScore: 10,
      explanation: `GCS = E3 + V3 + M4 = 10

**Eye Response (E3)**: Opens eyes to voice command = 3 points
**Verbal Response (V3)**: Inappropriate words = 3 points  
**Motor Response (M4)**: Withdraws from pain = 4 points

**Interpretation**: GCS 10 indicates moderate head injury. This patient requires urgent CT head and close neurological monitoring.`,
    },
    {
      id: 'gcs-case-2',
      story: `An 18-year-old female is found unconscious at a party. EMS suspects drug overdose.

On examination:
- Eyes open only when you pinch her trapezius
- She makes groaning sounds but no words
- She flexes her arm and pulls away from the painful stimulus

Calculate the GCS score.`,
      metCriteriaIds: ['eye-2', 'verbal-2', 'motor-4'],
      correctScore: 8,
      explanation: `GCS = E2 + V2 + M4 = 8

**Eye Response (E2)**: Opens eyes to pain = 2 points
**Verbal Response (V2)**: Incomprehensible sounds (groaning) = 2 points
**Motor Response (M4)**: Withdraws from pain = 4 points

**Interpretation**: GCS 8 is the threshold for severe injury. Consider intubation for airway protection. Toxicology screen and supportive care needed.`,
    },
  ],
};

/**
 * JONES Criteria for Acute Rheumatic Fever
 * 
 * Used to diagnose acute rheumatic fever after Group A Strep infection.
 */
export const JONES_CRITERIA: Guideline = {
  id: 'jones-criteria',
  name: 'Jones Criteria',
  description: 'Diagnostic criteria for acute rheumatic fever (ARF) following Group A Streptococcal pharyngitis.',
  clinicalContext: 'Use when acute rheumatic fever is suspected, typically 2-4 weeks after strep pharyngitis. Requires evidence of preceding strep infection plus major/minor criteria.',
  maxScore: 10,
  components: [
    // Major Criteria (2 points each)
    { id: 'carditis', label: 'Carditis', pointValue: 2, description: 'Major: Pericarditis, myocarditis, or valvulitis (new murmur)' },
    { id: 'polyarthritis', label: 'Migratory Polyarthritis', pointValue: 2, description: 'Major: Migratory arthritis of large joints' },
    { id: 'chorea', label: 'Sydenham Chorea', pointValue: 2, description: 'Major: Involuntary, rapid movements' },
    { id: 'erythema-marginatum', label: 'Erythema Marginatum', pointValue: 2, description: 'Major: Evanescent, pink, non-pruritic rash on trunk' },
    { id: 'subcutaneous-nodules', label: 'Subcutaneous Nodules', pointValue: 2, description: 'Major: Firm, painless nodules over extensor surfaces' },
    // Minor Criteria (1 point each)
    { id: 'arthralgia', label: 'Arthralgia', pointValue: 1, description: 'Minor: Joint pain without objective findings' },
    { id: 'fever', label: 'Fever', pointValue: 1, description: 'Minor: Temperature ≥38.5°C' },
    { id: 'elevated-esr-crp', label: 'Elevated ESR/CRP', pointValue: 1, description: 'Minor: Elevated acute phase reactants' },
    { id: 'prolonged-pr', label: 'Prolonged PR Interval', pointValue: 1, description: 'Minor: First-degree AV block on ECG' },
  ],
  scoringMap: [
    { minScore: 0, maxScore: 2, tier: 'Not ARF', recommendation: 'Does not meet criteria for acute rheumatic fever diagnosis.' },
    { minScore: 3, maxScore: 4, tier: 'Possible ARF', recommendation: 'May meet criteria if evidence of prior strep infection is present. Need 2 major OR 1 major + 2 minor criteria.' },
    { minScore: 5, maxScore: 10, tier: 'Probable ARF', recommendation: 'Likely meets Jones criteria. Confirm prior strep infection and initiate treatment.' },
  ],
  vignettes: [
    {
      id: 'jones-case-1',
      story: `A 10-year-old boy presents 3 weeks after a sore throat with a new heart murmur, fever, and joint pain that moves from knee to ankle.

On examination:
- Temperature: 39°C
- New holosystolic murmur at apex
- Right knee is swollen and tender; left ankle was swollen yesterday but is now normal
- No rash or nodules

Labs:
- ASO titer: elevated
- ESR: 65 mm/hr (elevated)
- CRP: 8 mg/dL (elevated)

Which Jones Criteria are met?`,
      metCriteriaIds: ['carditis', 'polyarthritis', 'fever', 'elevated-esr-crp'],
      correctScore: 6,
      explanation: `Jones Criteria Met:

**Major Criteria:**
[✓] **Carditis** (2 points): New holosystolic murmur suggests mitral regurgitation
[✓] **Migratory Polyarthritis** (2 points): Joint swelling that moved from knee to ankle

**Minor Criteria:**
[✓] **Fever** (1 point): Temperature 39°C
[✓] **Elevated ESR/CRP** (1 point): Both markers elevated

**Diagnosis**: This patient meets Jones Criteria (2 major + 2 minor) with evidence of prior strep infection (elevated ASO). Diagnosis of acute rheumatic fever is confirmed. Initiate penicillin treatment and anti-inflammatory therapy.`,
    },
  ],
};

/**
 * Light's Criteria for Pleural Effusion
 * 
 * Distinguishes transudative from exudative pleural effusions.
 */
export const LIGHTS_CRITERIA: Guideline = {
  id: 'lights-criteria',
  name: "Light's Criteria",
  description: 'Differentiates exudative from transudative pleural effusions using pleural fluid and serum protein/LDH ratios.',
  clinicalContext: 'Use when analyzing pleural fluid from thoracentesis. Meeting ANY ONE criterion indicates an exudate.',
  maxScore: 3,
  components: [
    { id: 'protein-ratio', label: 'Pleural/Serum Protein > 0.5', pointValue: 1, description: 'Pleural fluid protein divided by serum protein > 0.5' },
    { id: 'ldh-ratio', label: 'Pleural/Serum LDH > 0.6', pointValue: 1, description: 'Pleural fluid LDH divided by serum LDH > 0.6' },
    { id: 'ldh-absolute', label: 'Pleural LDH > 2/3 Upper Limit of Normal', pointValue: 1, description: 'Pleural fluid LDH > 2/3 the upper limit of normal serum LDH' },
  ],
  scoringMap: [
    { minScore: 0, maxScore: 0, tier: 'Transudate', recommendation: 'Effusion is transudative. Consider CHF, cirrhosis, nephrotic syndrome.' },
    { minScore: 1, maxScore: 3, tier: 'Exudate', recommendation: 'Effusion is exudative. Consider infection, malignancy, PE, autoimmune disease.' },
  ],
  vignettes: [
    {
      id: 'lights-case-1',
      story: `A 65-year-old woman with a history of CHF presents with dyspnea. CXR shows a large right pleural effusion. Thoracentesis is performed.

Results:
- Serum protein: 6.0 g/dL
- Serum LDH: 200 U/L (upper limit normal: 225 U/L)
- Pleural fluid protein: 2.0 g/dL
- Pleural fluid LDH: 80 U/L

Apply Light's Criteria.`,
      metCriteriaIds: [],
      correctScore: 0,
      explanation: `Light's Criteria Analysis:

[×] **Protein Ratio**: 2.0/6.0 = 0.33 (NOT > 0.5)
[×] **LDH Ratio**: 80/200 = 0.40 (NOT > 0.6)
[×] **LDH Absolute**: 80 U/L (NOT > 150, which is 2/3 of 225)

**Interpretation**: This is a TRANSUDATE. The effusion is likely due to her CHF (increased hydrostatic pressure). Treat the underlying heart failure.`,
    },
    {
      id: 'lights-case-2',
      story: `A 58-year-old male smoker presents with cough and weight loss. CXR shows a moderate left pleural effusion. Thoracentesis is performed.

Results:
- Serum protein: 7.0 g/dL
- Serum LDH: 180 U/L (upper limit normal: 225 U/L)
- Pleural fluid protein: 4.5 g/dL
- Pleural fluid LDH: 300 U/L

Apply Light's Criteria.`,
      metCriteriaIds: ['protein-ratio', 'ldh-ratio', 'ldh-absolute'],
      correctScore: 3,
      explanation: `Light's Criteria Analysis:

[✓] **Protein Ratio**: 4.5/7.0 = 0.64 (> 0.5)
[✓] **LDH Ratio**: 300/180 = 1.67 (> 0.6)
[✓] **LDH Absolute**: 300 U/L (> 150, which is 2/3 of 225)

**Interpretation**: This is an EXUDATE (meets all 3 criteria). Given smoking history and weight loss, malignancy is a major concern. Send cytology and consider CT chest and possible pleural biopsy.`,
    },
  ],
};

/**
 * CHA2DS2-VASc Score for Atrial Fibrillation Stroke Risk
 */
export const CHADS_VASC: Guideline = {
  id: 'chads-vasc',
  name: 'CHA2DS2-VASc',
  description: 'Stroke risk stratification in non-valvular atrial fibrillation.',
  clinicalContext: 'Use to determine need for anticoagulation in patients with atrial fibrillation or flutter.',
  maxScore: 9,
  components: [
    { id: 'chf', label: 'CHF or LV dysfunction', pointValue: 1, description: 'C: Congestive heart failure or LVEF ≤40%' },
    { id: 'htn', label: 'Hypertension', pointValue: 1, description: 'H: History of hypertension or on antihypertensive therapy' },
    { id: 'age-75', label: 'Age ≥ 75 years', pointValue: 2, description: 'A2: Age 75 or older (2 points)' },
    { id: 'diabetes', label: 'Diabetes mellitus', pointValue: 1, description: 'D: Diabetes mellitus' },
    { id: 'stroke-tia', label: 'Prior Stroke/TIA/Thromboembolism', pointValue: 2, description: 'S2: Previous stroke, TIA, or systemic embolism (2 points)' },
    { id: 'vascular', label: 'Vascular disease', pointValue: 1, description: 'V: Prior MI, PAD, or aortic plaque' },
    { id: 'age-65', label: 'Age 65-74 years', pointValue: 1, description: 'A: Age 65-74 years (1 point)' },
    { id: 'female', label: 'Female sex', pointValue: 1, description: 'Sc: Sex category (female)' },
  ],
  scoringMap: [
    { minScore: 0, maxScore: 0, tier: 'Low Risk (Male)', recommendation: 'Score 0 in male: No anticoagulation recommended. May consider aspirin or nothing.' },
    { minScore: 1, maxScore: 1, tier: 'Low-Moderate', recommendation: 'Score 1: Consider anticoagulation. Weigh bleeding risk (HAS-BLED score).' },
    { minScore: 2, maxScore: 9, tier: 'Moderate-High', recommendation: 'Score ≥2: Anticoagulation recommended (DOAC or warfarin preferred over aspirin).' },
  ],
  vignettes: [
    {
      id: 'chads-case-1',
      story: `A 78-year-old female with a history of hypertension and diabetes presents with new-onset atrial fibrillation. She has no history of stroke, heart failure, or vascular disease.

Calculate her CHA2DS2-VASc score.`,
      metCriteriaIds: ['htn', 'age-75', 'diabetes', 'female'],
      correctScore: 5,
      explanation: `CHA2DS2-VASc Score:

[×] **C** (CHF): 0 points - No heart failure
[✓] **H** (Hypertension): 1 point
[✓] **A2** (Age ≥75): 2 points
[✓] **D** (Diabetes): 1 point
[×] **S2** (Stroke/TIA): 0 points
[×] **V** (Vascular disease): 0 points
N/A **A** (Age 65-74): Not applicable (she is ≥75)
[✓] **Sc** (Female): 1 point

**Total Score: 5**

**Recommendation**: High stroke risk (~6.7% annual risk). Anticoagulation is strongly recommended. Start a DOAC (preferred) or warfarin. Assess bleeding risk with HAS-BLED.`,
    },
  ],
};

/**
 * Wells Criteria for DVT
 */
export const WELLS_DVT: Guideline = {
  id: 'wells-dvt',
  name: 'Wells Criteria for DVT',
  description: 'Clinical prediction rule for estimating pretest probability of deep vein thrombosis.',
  clinicalContext: 'Use in outpatients with suspected DVT to determine need for D-dimer testing vs. imaging.',
  maxScore: 9,
  components: [
    { id: 'active-cancer', label: 'Active cancer', pointValue: 1, description: 'Treatment within 6 months or palliative' },
    { id: 'paralysis', label: 'Paralysis, paresis, or recent cast', pointValue: 1, description: 'Lower extremity immobilization' },
    { id: 'bedridden', label: 'Bedridden >3 days or major surgery', pointValue: 1, description: 'Within 12 weeks requiring anesthesia' },
    { id: 'tenderness', label: 'Localized tenderness along deep veins', pointValue: 1, description: 'Tenderness along the deep venous system' },
    { id: 'leg-swelling', label: 'Entire leg swollen', pointValue: 1, description: 'Entire leg swelling' },
    { id: 'calf-swelling', label: 'Calf swelling >3cm vs. other leg', pointValue: 1, description: 'Measured 10cm below tibial tuberosity' },
    { id: 'pitting-edema', label: 'Pitting edema (symptomatic leg)', pointValue: 1, description: 'Greater in the symptomatic leg' },
    { id: 'collateral-veins', label: 'Collateral superficial veins', pointValue: 1, description: 'Non-varicose superficial veins' },
    { id: 'prior-dvt', label: 'Previously documented DVT', pointValue: 1, description: 'Prior confirmed DVT' },
    { id: 'alternative-diagnosis', label: 'Alternative diagnosis as likely', pointValue: -2, description: 'Alternative diagnosis as or more likely than DVT' },
  ],
  scoringMap: [
    { minScore: -2, maxScore: 0, tier: 'Low Probability', recommendation: 'DVT unlikely (~5%). Check D-dimer. If negative, DVT excluded.' },
    { minScore: 1, maxScore: 2, tier: 'Moderate Probability', recommendation: 'Moderate risk (~17%). Check D-dimer. If positive, proceed to ultrasound.' },
    { minScore: 3, maxScore: 9, tier: 'High Probability', recommendation: 'DVT likely (~53%). Proceed directly to ultrasound.' },
  ],
  vignettes: [
    {
      id: 'wells-dvt-case-1',
      story: `A 55-year-old woman presents with 3 days of left leg swelling and pain. She had a total knee replacement 4 weeks ago. On exam, her left calf is 4cm larger than the right, with pitting edema and tenderness along the popliteal vein.

Calculate her Wells score for DVT.`,
      metCriteriaIds: ['bedridden', 'tenderness', 'leg-swelling', 'calf-swelling', 'pitting-edema'],
      correctScore: 5,
      explanation: `Wells Score for DVT:

[×] Active cancer: 0
[×] Paralysis/cast: 0
[✓] **Bedridden/major surgery**: 1 point (knee replacement 4 weeks ago)
[✓] **Localized tenderness**: 1 point (along popliteal vein)
[✓] **Entire leg swollen**: 1 point
[✓] **Calf >3cm larger**: 1 point (4cm difference)
[✓] **Pitting edema**: 1 point
[×] Collateral veins: 0
[×] Prior DVT: 0
[×] Alternative diagnosis equally likely: Not subtracted

**Total: 5 points = High Probability**

Proceed directly to compression ultrasound. Do not delay with D-dimer.`,
    },
  ],
};

/**
 * All available guidelines for the drill mode.
 */
export const MOCK_GUIDELINES: Guideline[] = [
  CURB65_GUIDELINE,
  GLASGOW_COMA_SCALE,
  JONES_CRITERIA,
  LIGHTS_CRITERIA,
  CHADS_VASC,
  WELLS_DVT,
];

/**
 * Get a guideline by its ID.
 */
export function getGuidelineById(id: string): Guideline | undefined {
  return MOCK_GUIDELINES.find((g) => g.id === id);
}

/**
 * Get all guideline names for display
 */
export function getGuidelineNames(): { id: string; name: string }[] {
  return MOCK_GUIDELINES.map((g) => ({ id: g.id, name: g.name }));
}
