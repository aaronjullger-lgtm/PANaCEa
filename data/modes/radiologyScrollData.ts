/**
 * Radiology Scroll (DICOM Viewer) Data
 * Interactive CT/MRI series for pathology identification
 */

import type { RadiologySeries } from '@/types/drill-modes';

/**
 * Radiology teaching cases with scrollable slices
 */
export const RADIOLOGY_SERIES: RadiologySeries[] = [
  {
    id: 'ct-abdomen-appendicitis',
    modality: 'CT',
    bodyPart: 'abdomen',
    slices: generateSliceData(40, [18, 19, 20, 21]), // Critical slices where appendix is visible
    totalSlices: 40,
    clinicalQuestion: 'A 25-year-old with RLQ pain, fever, and elevated WBC. Evaluate for appendicitis.',
    findings: [
      'Dilated appendix measuring 12mm in diameter',
      'Periappendiceal fat stranding',
      'Appendicolith present',
      'Free fluid in RLQ',
    ],
    diagnosis: 'Acute Appendicitis',
    criticalSlices: [18, 19, 20, 21],
    teachingPoints: [
      'Normal appendix <6mm diameter',
      'Appendicitis: dilated appendix, wall thickening, periappendiceal inflammation',
      'Appendicolith present in ~25% of cases',
      'Look for cecum and trace appendix from base',
    ],
  },
  {
    id: 'ct-head-subdural',
    modality: 'CT',
    bodyPart: 'head',
    slices: generateSliceData(30, [12, 13, 14, 15, 16]),
    totalSlices: 30,
    clinicalQuestion: 'An 80-year-old with fall 2 weeks ago, now with progressive confusion and headache.',
    findings: [
      'Crescent-shaped hypodense collection over right hemisphere',
      'Does not cross midline but crosses suture lines',
      'Mild mass effect with 3mm midline shift',
      'No acute hemorrhage',
    ],
    diagnosis: 'Chronic Subdural Hematoma',
    criticalSlices: [12, 13, 14, 15, 16],
    teachingPoints: [
      'Subdural: crescent shape, crosses suture lines, does not cross midline',
      'Acute: hyperdense (bright); Subacute: isodense; Chronic: hypodense (dark)',
      'Mass effect can be significant even without acute bleeding',
      'Elderly and anticoagulated patients at higher risk',
    ],
  },
  {
    id: 'ct-chest-pe',
    modality: 'CT',
    bodyPart: 'chest',
    slices: generateSliceData(50, [25, 26, 27, 28]),
    totalSlices: 50,
    clinicalQuestion: 'A 55-year-old post-op day 3 with sudden dyspnea and tachycardia. D-dimer elevated.',
    findings: [
      'Filling defect in right main pulmonary artery',
      'Partial filling defect in left lower lobe segmental artery',
      'Right heart strain with RV/LV ratio >1',
      'Small right pleural effusion',
    ],
    diagnosis: 'Bilateral Pulmonary Embolism with RV strain',
    criticalSlices: [25, 26, 27, 28],
    teachingPoints: [
      'PE: filling defect in contrast-enhanced pulmonary arteries',
      'RV strain: RV/LV ratio >1 suggests massive PE',
      'Saddle embolus: at PA bifurcation',
      'Consider thrombolysis if hemodynamically unstable with RV strain',
    ],
  },
  {
    id: 'mri-brain-stroke',
    modality: 'MRI',
    bodyPart: 'head',
    slices: generateSliceData(35, [15, 16, 17, 18, 19]),
    totalSlices: 35,
    clinicalQuestion: 'A 68-year-old with acute right-sided weakness and aphasia. Symptom onset 2 hours ago.',
    findings: [
      'Restricted diffusion in left MCA territory',
      'Loss of gray-white differentiation',
      'Hypodense insular ribbon sign',
      'No hemorrhage on GRE sequences',
    ],
    diagnosis: 'Acute Left MCA Stroke',
    criticalSlices: [15, 16, 17, 18, 19],
    teachingPoints: [
      'DWI (diffusion-weighted imaging) shows acute stroke as bright signal',
      'Stroke appears within minutes on DWI, hours on CT',
      'MCA stroke: contralateral hemiparesis, aphasia (if dominant hemisphere)',
      'CT to rule out hemorrhage; MRI for early detection and small strokes',
    ],
  },
  {
    id: 'ct-abdomen-aaa',
    modality: 'CT',
    bodyPart: 'abdomen',
    slices: generateSliceData(45, [20, 21, 22, 23, 24]),
    totalSlices: 45,
    clinicalQuestion: 'A 72-year-old smoker with pulsatile abdominal mass and back pain.',
    findings: [
      'Infrarenal aortic aneurysm measuring 6.2cm',
      'Mural thrombus present',
      'No contrast extravasation',
      'Aneurysm extends to aortic bifurcation',
    ],
    diagnosis: 'Large Infrarenal Abdominal Aortic Aneurysm',
    criticalSlices: [20, 21, 22, 23, 24],
    teachingPoints: [
      'AAA: aortic diameter >3cm (normal ~2cm)',
      'Surgical repair indicated for >5.5cm or rapid growth',
      'Ruptured AAA: contrast extravasation, retroperitoneal hematoma',
      'Mural thrombus reduces flow lumen but doesn\'t prevent rupture',
    ],
  },
  {
    id: 'ct-chest-pneumothorax',
    modality: 'CT',
    bodyPart: 'chest',
    slices: generateSliceData(40, [18, 19, 20]),
    totalSlices: 40,
    clinicalQuestion: 'A 28-year-old tall, thin male with sudden onset chest pain and dyspnea.',
    findings: [
      'Large left-sided pneumothorax (40% lung collapse)',
      'Visceral pleural line visible',
      'No mediastinal shift (not tension)',
      'Apical blebs present',
    ],
    diagnosis: 'Spontaneous Pneumothorax',
    criticalSlices: [18, 19, 20],
    teachingPoints: [
      'Pneumothorax: visceral pleural line with no lung markings beyond',
      'Primary spontaneous: young, tall, thin males, often apical blebs',
      'Tension PTX: tracheal deviation, mediastinal shift, hemodynamic instability',
      'Treatment: observation (<20%), aspiration, or chest tube',
    ],
  },
];

/**
 * Generate placeholder slice data
 * In production, this would load actual DICOM images
 */
function generateSliceData(totalSlices: number, criticalSlices: number[]) {
  return Array.from({ length: totalSlices }, (_, i) => ({
    sliceNumber: i + 1,
    // In real implementation: imageUrl would point to DICOM or converted images
    imageUrl: undefined,
    findings: criticalSlices.includes(i + 1) 
      ? ['Key pathology visible on this slice']
      : undefined,
  }));
}

/**
 * Calculate radiology scroll score
 */
export function calculateRadiologyScore(
  series: RadiologySeries,
  identifiedFindings: string[],
  diagnosis: string,
  criticalSlicesViewed: number[],
  timeSpent: number
): {
  findingsAccuracy: number;
  diagnosisCorrect: boolean;
  thoroughness: number;
  overall: number;
} {
  // Findings accuracy: percentage of findings correctly identified
  const findingsMatch = identifiedFindings.filter(finding =>
    series.findings.some(correct =>
      correct.toLowerCase().includes(finding.toLowerCase()) ||
      finding.toLowerCase().includes(correct.toLowerCase())
    )
  ).length;
  
  const findingsAccuracy = series.findings.length > 0
    ? Math.round((findingsMatch / series.findings.length) * 100)
    : 0;
  
  // Diagnosis correct (case-insensitive partial match)
  const diagnosisCorrect = series.diagnosis.toLowerCase().includes(diagnosis.toLowerCase()) ||
    diagnosis.toLowerCase().includes(series.diagnosis.toLowerCase());
  
  // Thoroughness: percentage of critical slices viewed
  const criticalSlicesSet = new Set(series.criticalSlices);
  const criticalViewedCount = criticalSlicesViewed.filter(slice =>
    criticalSlicesSet.has(slice)
  ).length;
  
  const thoroughness = series.criticalSlices.length > 0
    ? Math.round((criticalViewedCount / series.criticalSlices.length) * 100)
    : 0;
  
  // Overall score: weighted combination
  const overall = Math.round(
    (findingsAccuracy * 0.4) +
    (diagnosisCorrect ? 40 : 0) +
    (thoroughness * 0.2)
  );
  
  return {
    findingsAccuracy,
    diagnosisCorrect,
    thoroughness,
    overall,
  };
}

/**
 * Get a random radiology case
 */
export function getRandomRadiologySeries(): RadiologySeries {
  const randomIndex = Math.floor(Math.random() * RADIOLOGY_SERIES.length);
  return RADIOLOGY_SERIES[randomIndex];
}

/**
 * Get cases by modality
 */
export function getRadiologySeriesByModality(modality: 'CT' | 'MRI' | 'PET'): RadiologySeries[] {
  return RADIOLOGY_SERIES.filter(series => series.modality === modality);
}

/**
 * Get cases by body part
 */
export function getRadiologySeriesByBodyPart(bodyPart: string): RadiologySeries[] {
  return RADIOLOGY_SERIES.filter(series => 
    series.bodyPart.toLowerCase() === bodyPart.toLowerCase()
  );
}

/**
 * Provide hints based on critical slices viewed
 */
export function getRadiologyHint(
  series: RadiologySeries,
  currentSlice: number,
  criticalSlicesViewed: number[]
): string | null {
  // If they're on a critical slice, give a hint
  if (series.criticalSlices.includes(currentSlice)) {
    return '👀 Key findings visible on this slice! Look carefully at the pathology.';
  }
  
  // If they haven't viewed many critical slices yet
  const criticalViewedCount = criticalSlicesViewed.filter(slice =>
    series.criticalSlices.includes(slice)
  ).length;
  
  if (criticalViewedCount < series.criticalSlices.length / 2) {
    const midCriticalSlice = series.criticalSlices[Math.floor(series.criticalSlices.length / 2)];
    
    if (currentSlice < midCriticalSlice) {
      return '💡 Continue scrolling down to find the key pathology.';
    } else if (currentSlice > midCriticalSlice) {
      return '💡 Scroll back up - you may have passed the critical findings.';
    }
  }
  
  return null;
}
