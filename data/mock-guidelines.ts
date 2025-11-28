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

✅ **Confusion** (1 point): Patient is confused and oriented only to person - this is new-onset mental confusion.

❌ **Urea** (0 points): BUN of 12 mg/dL is within normal limits (not > 19 mg/dL).

❌ **Respiratory Rate** (0 points): RR is 24/min, which is below the threshold of ≥30/min.

✅ **Blood Pressure** (1 point): BP of 85/55 mmHg meets criteria (systolic < 90 mmHg).

✅ **Age** (1 point): Patient is 72 years old (≥ 65 years).

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

❌ **Confusion** (0 points): Patient is alert and oriented x4 - no mental status changes.

❌ **Urea** (0 points): BUN of 10 mg/dL is normal (not > 19 mg/dL).

❌ **Respiratory Rate** (0 points): RR is 18/min, well below the threshold of ≥30/min.

❌ **Blood Pressure** (0 points): BP of 118/72 mmHg is normal.

❌ **Age** (0 points): Patient is 24 years old (< 65 years).

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

✅ **Confusion** (1 point): Despite baseline dementia, she is MORE confused than usual - this counts as acute confusion.

✅ **Urea** (1 point): BUN of 35 mg/dL is significantly elevated (> 19 mg/dL).

✅ **Respiratory Rate** (1 point): RR of 34/min exceeds the threshold of ≥30/min.

✅ **Blood Pressure** (1 point): BP of 78/50 mmHg is severely hypotensive.

✅ **Age** (1 point): Patient is 80 years old (≥ 65 years).

**Interpretation**: Score of 5 = Very High Risk. This patient requires immediate ICU admission. The combination of all criteria plus bilateral infiltrates suggests severe sepsis from pneumonia. Mortality risk is approximately 40% or higher.`,
    },
  ],
};

/**
 * All available guidelines for the drill mode.
 */
export const MOCK_GUIDELINES: Guideline[] = [CURB65_GUIDELINE];

/**
 * Get a guideline by its ID.
 */
export function getGuidelineById(id: string): Guideline | undefined {
  return MOCK_GUIDELINES.find((g) => g.id === id);
}
