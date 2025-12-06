/**
 * Polypharmacy Puzzle Data
 * Geriatric deprescribing challenges
 */

import type { PolypharmacyCase, Medication } from '@/types/drill-modes';

export const POLYPHARMACY_CASES: PolypharmacyCase[] = [
  {
    id: 'fall-risk-elderly',
    patientInfo: 'Mrs. Johnson, 85-year-old woman with recent fall. Lives alone. PMH: HTN, T2DM, insomnia, osteoarthritis.',
    age: 85,
    medications: [
      {
        id: 'med-001',
        name: 'Metformin 1000mg BID',
        indication: 'Type 2 Diabetes',
        class: 'Biguanide',
      },
      {
        id: 'med-002',
        name: 'Glyburide 10mg daily',
        indication: 'Type 2 Diabetes',
        class: 'Sulfonylurea',
        sideEffects: ['Hypoglycemia risk'],
      },
      {
        id: 'med-003',
        name: 'Lisinopril 10mg daily',
        indication: 'Hypertension',
        class: 'ACE Inhibitor',
      },
      {
        id: 'med-004',
        name: 'Hydrochlorothiazide 25mg daily',
        indication: 'Hypertension',
        class: 'Thiazide Diuretic',
        sideEffects: ['Orthostatic hypotension', 'Hyponatremia'],
      },
      {
        id: 'med-005',
        name: 'Diphenhydramine 50mg qHS',
        indication: 'Insomnia',
        class: 'Antihistamine',
        sideEffects: ['Anticholinergic effects', 'Confusion', 'Falls'],
      },
      {
        id: 'med-006',
        name: 'Ibuprofen 800mg TID',
        indication: 'Osteoarthritis',
        class: 'NSAID',
        sideEffects: ['GI bleeding', 'Renal impairment', 'Falls'],
      },
    ],
    clinicalConcern: 'Fall risk reduction',
    correctMedicationsToStop: ['med-002', 'med-005', 'med-006'],
    explanation: 'Glyburide (hypoglycemia), Diphenhydramine (anticholinergic/sedation), and Ibuprofen (dizziness/bleeding risk) all significantly increase fall risk in elderly.',
    deprescribingRationale: {
      'med-002': 'Glyburide has high hypoglycemia risk in elderly. Metformin alone is safer. Consider switching to a DPP-4 inhibitor if needed.',
      'med-005': 'Diphenhydramine is a Beers Criteria drug - avoid in elderly. Strong anticholinergic causes confusion and falls. Try melatonin or CBT-I for insomnia.',
      'med-006': 'High-dose NSAID increases fall and GI bleed risk. Try acetaminophen, topical NSAIDs, or nonpharmacologic approaches (PT, heat/ice).',
    },
    teachingPoints: [
      'Beers Criteria: avoid anticholinergics in elderly',
      'Sulfonylureas cause hypoglycemia → falls',
      'NSAIDs increase bleeding and renal injury risk',
      'Deprescribing improves quality of life and reduces adverse events',
    ],
  },
  {
    id: 'qt-prolongation',
    patientInfo: 'Mr. Davis, 78-year-old man with syncope. ECG shows QTc 510ms. PMH: AFib, depression, GERD, BPH.',
    age: 78,
    medications: [
      {
        id: 'med-007',
        name: 'Amiodarone 200mg daily',
        indication: 'Atrial Fibrillation',
        class: 'Antiarrhythmic',
        sideEffects: ['QT prolongation', 'Pulmonary toxicity'],
      },
      {
        id: 'med-008',
        name: 'Citalopram 40mg daily',
        indication: 'Depression',
        class: 'SSRI',
        sideEffects: ['QT prolongation'],
      },
      {
        id: 'med-009',
        name: 'Ondansetron 8mg PRN',
        indication: 'Nausea',
        class: 'Antiemetic',
        sideEffects: ['QT prolongation'],
      },
      {
        id: 'med-010',
        name: 'Tamsulosin 0.4mg daily',
        indication: 'BPH',
        class: 'Alpha blocker',
      },
      {
        id: 'med-011',
        name: 'Omeprazole 40mg daily',
        indication: 'GERD',
        class: 'PPI',
      },
    ],
    clinicalConcern: 'QT prolongation and syncope risk',
    correctMedicationsToStop: ['med-008', 'med-009'],
    explanation: 'Multiple QT-prolonging drugs increase risk of Torsades. Stop citalopram (switch to sertraline) and ondansetron. Consider reducing amiodarone dose or switching to alternative.',
    deprescribingRationale: {
      'med-008': 'Citalopram dose >20mg increases QT interval. Reduce to 20mg or switch to sertraline (no QT effect). Continue amiodarone if essential for AFib control.',
      'med-009': 'Ondansetron causes QT prolongation. Use alternative antiemetic (metoclopramide, prochlorperazine) or address underlying nausea cause.',
    },
    teachingPoints: [
      'Multiple QT-prolonging drugs are additive',
      'Citalopram max dose 20mg in elderly',
      'Amiodarone has many toxicities but may be necessary',
      'Always check drug interactions for QT effects',
    ],
  },
  {
    id: 'anticholinergic-burden',
    patientInfo: 'Mrs. Lee, 82-year-old with worsening confusion and urinary retention. PMH: Parkinsons, OAB, allergies, insomnia.',
    age: 82,
    medications: [
      {
        id: 'med-012',
        name: 'Benztropine 1mg BID',
        indication: 'Parkinsons tremor',
        class: 'Anticholinergic',
        sideEffects: ['Confusion', 'Urinary retention', 'Constipation'],
      },
      {
        id: 'med-013',
        name: 'Oxybutynin 5mg TID',
        indication: 'Overactive bladder',
        class: 'Anticholinergic',
        sideEffects: ['Confusion', 'Urinary retention'],
      },
      {
        id: 'med-014',
        name: 'Diphenhydramine 25mg qHS',
        indication: 'Insomnia',
        class: 'Antihistamine',
        sideEffects: ['Anticholinergic effects'],
      },
      {
        id: 'med-015',
        name: 'Carbidopa-Levodopa 25/100 TID',
        indication: 'Parkinsons disease',
        class: 'Dopamine precursor',
      },
    ],
    clinicalConcern: 'Anticholinergic burden causing delirium',
    correctMedicationsToStop: ['med-012', 'med-013', 'med-014'],
    explanation: 'High anticholinergic burden from three medications causing confusion and urinary retention. Stop all three anticholinergics.',
    deprescribingRationale: {
      'med-012': 'Benztropine is high anticholinergic burden. For Parkinson tremor, try increasing carbidopa-levodopa instead.',
      'med-013': 'Oxybutynin is Beers Criteria drug. Paradoxically causing urinary retention. Try mirabegron (non-anticholinergic) or behavioral therapy.',
      'med-014': 'Diphenhydramine has strong anticholinergic effects. Try melatonin or trazodone for sleep.',
    },
    teachingPoints: [
      'Anticholinergic burden is cumulative',
      'Anticholinergics cause confusion, falls, urinary retention',
      'Avoid in Parkinsons and dementia patients',
      'Consider Anticholinergic Cognitive Burden scale',
    ],
  },
  {
    id: 'renal-impairment',
    patientInfo: 'Mr. Brown, 88-year-old with CKD Stage 4 (GFR 25). Hospitalized for AKI. PMH: DM, HTN, CHF, GERD.',
    age: 88,
    medications: [
      {
        id: 'med-016',
        name: 'Metformin 1000mg BID',
        indication: 'Type 2 Diabetes',
        class: 'Biguanide',
        sideEffects: ['Lactic acidosis in renal failure'],
      },
      {
        id: 'med-017',
        name: 'Gabapentin 600mg TID',
        indication: 'Neuropathic pain',
        class: 'Anticonvulsant',
        sideEffects: ['Accumulation in renal failure'],
      },
      {
        id: 'med-018',
        name: 'Atorvastatin 40mg daily',
        indication: 'Hyperlipidemia',
        class: 'Statin',
      },
      {
        id: 'med-019',
        name: 'Allopurinol 300mg daily',
        indication: 'Gout prophylaxis',
        class: 'Xanthine oxidase inhibitor',
        sideEffects: ['Requires dose reduction in renal failure'],
      },
      {
        id: 'med-020',
        name: 'Lisinopril 20mg daily',
        indication: 'Heart failure, HTN',
        class: 'ACE Inhibitor',
      },
    ],
    clinicalConcern: 'Medication safety in severe renal impairment',
    correctMedicationsToStop: ['med-016', 'med-017', 'med-019'],
    explanation: 'Metformin contraindicated in severe CKD. Gabapentin and allopurinol need dose reduction or discontinuation.',
    deprescribingRationale: {
      'med-016': 'Metformin contraindicated with GFR <30. Risk of lactic acidosis. Switch to insulin or DPP-4 inhibitor.',
      'med-017': 'Gabapentin accumulates in renal failure causing severe sedation/confusion. Reduce dose significantly or stop.',
      'med-019': 'Allopurinol needs dose adjustment in CKD. Consider stopping during acute illness. Restart at lower dose (50-100mg) when stable.',
    },
    teachingPoints: [
      'Metformin contraindicated GFR <30',
      'Many drugs need renal dose adjustment',
      'Renally excreted drugs accumulate → toxicity',
      'Review medications with every hospitalization',
    ],
  },
];

/**
 * Evaluate deprescribing choices
 */
export function evaluateDeprescribing(
  caseData: PolypharmacyCase,
  selectedMedIds: string[]
): { correct: boolean; partialCredit: number; feedback: string } {
  const correctIds = new Set(caseData.correctMedicationsToStop);
  const selectedIds = new Set(selectedMedIds);
  
  // Calculate matches
  const correctSelections = selectedMedIds.filter(id => correctIds.has(id)).length;
  const incorrectSelections = selectedMedIds.filter(id => !correctIds.has(id)).length;
  const missedCorrect = caseData.correctMedicationsToStop.filter(id => !selectedIds.has(id)).length;
  
  const totalCorrect = caseData.correctMedicationsToStop.length;
  const partialCredit = Math.round((correctSelections / totalCorrect) * 100);
  
  const correct = correctSelections === totalCorrect && incorrectSelections === 0;
  
  let feedback = '';
  
  if (correct) {
    feedback = `✓ Perfect! You identified all ${totalCorrect} medications that should be stopped. ${caseData.explanation}`;
  } else {
    const feedbackParts: string[] = [];
    
    if (correctSelections > 0) {
      feedbackParts.push(`✓ Correctly identified ${correctSelections}/${totalCorrect} medications to stop.`);
    }
    
    if (incorrectSelections > 0) {
      feedbackParts.push(`✗ Incorrectly selected ${incorrectSelections} medication(s) that should be continued.`);
    }
    
    if (missedCorrect > 0) {
      feedbackParts.push(`⚠️ Missed ${missedCorrect} medication(s) that should be stopped.`);
    }
    
    feedbackParts.push(`\n${caseData.explanation}`);
    feedback = feedbackParts.join(' ');
  }
  
  return { correct, partialCredit, feedback };
}

/**
 * Get a random polypharmacy case
 */
export function getRandomPolypharmacyCase(): PolypharmacyCase {
  const randomIndex = Math.floor(Math.random() * POLYPHARMACY_CASES.length);
  return POLYPHARMACY_CASES[randomIndex];
}
