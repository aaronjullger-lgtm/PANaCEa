/**
 * Seed Normal Imaging Findings
 * 
 * Seeds the NormalImagingFinding table with normal reference appearances
 * for common imaging modalities.
 * 
 * Usage: npx tsx scripts/seed/seed-normal-imaging-findings.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface NormalImagingFindingSeed {
  imagingStudyName: string;
  modality: string;
  bodyRegion: string;
  findingName: string;
  normalAppearance: string;
  normalMeasurement?: string;
  measurementUnit?: string;
  measurementLow?: number;
  measurementHigh?: number;
  view?: string;
  protocol?: string;
  significance?: string;
  abnormalIndicates?: string[];
  clinicalPearls?: string[];
  source?: string;
  isHighYield?: boolean;
  panceRelevance?: number;
}

// =============================================================================
// CHEST X-RAY (CXR)
// =============================================================================
const cxrFindings: NormalImagingFindingSeed[] = [
  // Cardiac silhouette
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Cardiac Silhouette',
    normalAppearance: 'Smooth, well-defined borders. Left heart border formed by left ventricle, right border by right atrium.',
    normalMeasurement: 'Cardiothoracic ratio (CTR) < 0.5',
    measurementUnit: 'ratio',
    measurementHigh: 0.5,
    view: 'PA',
    significance: 'CTR assesses heart size relative to thoracic width',
    abnormalIndicates: ['Cardiomegaly (CTR >0.5)', 'Pericardial effusion', 'Chamber enlargement'],
    clinicalPearls: ['AP films falsely enlarge heart - always prefer PA', 'CTR less reliable in patients with hyperinflation'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Lung fields
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Lung Fields',
    normalAppearance: 'Clear, black (radiolucent) with visible vascular markings tapering toward periphery. No focal opacities, masses, or nodules.',
    view: 'PA',
    significance: 'Clear lung fields indicate normal aeration without consolidation or effusion',
    abnormalIndicates: ['Consolidation (pneumonia)', 'Effusion', 'Pneumothorax', 'Masses/nodules', 'Interstitial disease'],
    clinicalPearls: ['Compare both sides systematically', 'Look behind heart and below diaphragm for hidden pathology'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Costophrenic angles
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Costophrenic Angles',
    normalAppearance: 'Sharp, acute angles bilaterally where diaphragm meets lateral chest wall',
    view: 'PA',
    significance: 'Blunting indicates pleural effusion (requires ~200-300mL to blunt)',
    abnormalIndicates: ['Pleural effusion', 'Pleural thickening', 'Elevated hemidiaphragm'],
    clinicalPearls: ['Lateral decubitus film can detect smaller effusions', 'Blunting on lateral film occurs with ~50mL fluid'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Mediastinum
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Mediastinum',
    normalAppearance: 'Midline position. Aortic knob visible on left. Clear aortopulmonary window. Trachea centered.',
    normalMeasurement: 'Mediastinal width < 8 cm',
    measurementUnit: 'cm',
    measurementHigh: 8,
    view: 'PA',
    significance: 'Widened mediastinum may indicate aortic dissection, mass, or lymphadenopathy',
    abnormalIndicates: ['Aortic dissection (>8cm)', 'Mediastinal mass', 'Lymphadenopathy', 'Aortic aneurysm'],
    clinicalPearls: ['AP films widen mediastinum - use PA when possible', 'Clinical context critical for interpretation'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Trachea
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Trachea',
    normalAppearance: 'Midline, slight rightward deviation at aortic arch level. Air-filled, smooth walls.',
    view: 'PA',
    significance: 'Tracheal deviation indicates mass effect or volume loss',
    abnormalIndicates: ['Tension pneumothorax (away from)', 'Atelectasis (toward)', 'Thyroid mass', 'Mediastinal mass'],
    clinicalPearls: ['Tension pneumothorax: trachea deviates AWAY from affected side', 'Atelectasis: trachea pulled TOWARD affected side'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Diaphragm
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Hemidiaphragms',
    normalAppearance: 'Smooth, dome-shaped. Right hemidiaphragm slightly higher than left (liver beneath). Clear above diaphragm.',
    view: 'PA',
    significance: 'Elevated hemidiaphragm may indicate phrenic nerve palsy, subphrenic process, or atelectasis',
    abnormalIndicates: ['Phrenic nerve palsy', 'Subphrenic abscess', 'Lower lobe atelectasis', 'Hepatomegaly'],
    clinicalPearls: ['Right normally 1-3cm higher than left', 'Free air under diaphragm = perforated viscus'],
    isHighYield: true,
    panceRelevance: 4,
  },
  
  // Bones
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Bony Thorax',
    normalAppearance: 'Ribs intact with smooth cortices. Spine straight. Clavicles symmetric. No lytic or blastic lesions.',
    view: 'PA',
    significance: 'Bone abnormalities may indicate metastases, trauma, or metabolic disease',
    abnormalIndicates: ['Rib fractures', 'Metastatic lesions', 'Osteoporosis', 'Scoliosis'],
    clinicalPearls: ['Always check bones systematically - easy to miss fractures', 'Lytic lesions: multiple myeloma, metastases'],
    isHighYield: false,
    panceRelevance: 3,
  },
  
  // Soft tissues
  {
    imagingStudyName: 'Chest X-ray',
    modality: 'X-ray',
    bodyRegion: 'Chest',
    findingName: 'Soft Tissues',
    normalAppearance: 'Symmetric. Breast shadows present in females. No subcutaneous emphysema or masses.',
    view: 'PA',
    significance: 'Soft tissue abnormalities may indicate trauma, mastectomy, or subcutaneous disease',
    abnormalIndicates: ['Subcutaneous emphysema', 'Mastectomy', 'Soft tissue mass'],
    isHighYield: false,
    panceRelevance: 2,
  },
];

// =============================================================================
// CT HEAD
// =============================================================================
const ctHeadFindings: NormalImagingFindingSeed[] = [
  // Brain parenchyma
  {
    imagingStudyName: 'CT Head',
    modality: 'CT',
    bodyRegion: 'Head',
    findingName: 'Brain Parenchyma',
    normalAppearance: 'Gray-white matter differentiation preserved. No focal hypodensity or hyperdensity. No mass effect.',
    protocol: 'Non-contrast',
    significance: 'Loss of gray-white differentiation is early sign of ischemia',
    abnormalIndicates: ['Acute stroke (hypodense)', 'Hemorrhage (hyperdense)', 'Tumor', 'Edema'],
    clinicalPearls: ['Acute stroke may be normal in first 6 hours', 'Blood is bright (hyperdense) on non-contrast CT'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Ventricles
  {
    imagingStudyName: 'CT Head',
    modality: 'CT',
    bodyRegion: 'Head',
    findingName: 'Ventricular System',
    normalAppearance: 'Symmetric lateral ventricles. Third and fourth ventricles midline. No dilation. CSF dark (hypodense).',
    protocol: 'Non-contrast',
    significance: 'Ventricular enlargement may indicate hydrocephalus or atrophy',
    abnormalIndicates: ['Hydrocephalus', 'Cerebral atrophy', 'Mass effect (compression)', 'Intraventricular hemorrhage'],
    clinicalPearls: ['Communicating vs obstructive hydrocephalus based on 4th ventricle size', 'Elderly have larger ventricles (ex vacuo)'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Midline structures
  {
    imagingStudyName: 'CT Head',
    modality: 'CT',
    bodyRegion: 'Head',
    findingName: 'Midline Structures',
    normalAppearance: 'Septum pellucidum, third ventricle, and falx midline. No shift. Pineal gland may be calcified.',
    protocol: 'Non-contrast',
    normalMeasurement: 'Midline shift < 5mm',
    measurementUnit: 'mm',
    measurementHigh: 5,
    significance: 'Midline shift >5mm often requires surgical intervention',
    abnormalIndicates: ['Mass (tumor, abscess)', 'Large stroke with edema', 'Subdural/epidural hematoma'],
    clinicalPearls: ['Measure shift at septum pellucidum level', 'Shift toward opposite side of mass lesion'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Sulci and cisterns
  {
    imagingStudyName: 'CT Head',
    modality: 'CT',
    bodyRegion: 'Head',
    findingName: 'Sulci and Cisterns',
    normalAppearance: 'Sulci and basal cisterns patent (CSF-filled, dark). Symmetric. No effacement.',
    protocol: 'Non-contrast',
    significance: 'Effaced sulci/cisterns indicate increased ICP or mass effect',
    abnormalIndicates: ['Cerebral edema', 'Mass effect', 'Subarachnoid hemorrhage (bright cisterns)'],
    clinicalPearls: ['Effaced basal cisterns = impending herniation', 'SAH: blood in sulci/cisterns appears bright'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Calvarium
  {
    imagingStudyName: 'CT Head',
    modality: 'CT',
    bodyRegion: 'Head',
    findingName: 'Calvarium (Skull)',
    normalAppearance: 'Intact bony calvarium. No fractures. Normal thickness. Symmetric.',
    protocol: 'Non-contrast',
    significance: 'Skull fractures may be associated with underlying brain injury',
    abnormalIndicates: ['Skull fracture', 'Lytic lesions (metastases)', 'Paget disease'],
    clinicalPearls: ['Base of skull fractures may not be visible - look for indirect signs', 'Temporal bone fracture: look for mastoid air cells'],
    isHighYield: true,
    panceRelevance: 4,
  },
  
  // Extra-axial spaces
  {
    imagingStudyName: 'CT Head',
    modality: 'CT',
    bodyRegion: 'Head',
    findingName: 'Extra-axial Spaces',
    normalAppearance: 'No subdural or epidural collections. Convexity follows skull contour.',
    protocol: 'Non-contrast',
    significance: 'Extra-axial collections may represent hematoma or hygroma',
    abnormalIndicates: ['Subdural hematoma (crescentic)', 'Epidural hematoma (lenticular)', 'Subdural hygroma'],
    clinicalPearls: ['Epidural: lenticular, limited by sutures', 'Subdural: crescentic, crosses sutures', 'Chronic subdural may be isodense'],
    isHighYield: true,
    panceRelevance: 5,
  },
];

// =============================================================================
// ECHOCARDIOGRAM
// =============================================================================
const echoFindings: NormalImagingFindingSeed[] = [
  // Left ventricular function
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Left Ventricular Ejection Fraction (LVEF)',
    normalAppearance: 'Normal wall motion. Symmetric contraction.',
    normalMeasurement: 'LVEF 55-70%',
    measurementUnit: '%',
    measurementLow: 55,
    measurementHigh: 70,
    significance: 'LVEF is primary measure of systolic function',
    abnormalIndicates: ['Heart failure with reduced EF (<40%)', 'Cardiomyopathy', 'Post-MI dysfunction'],
    clinicalPearls: ['HFrEF: EF ≤40%', 'HFmrEF: EF 41-49%', 'HFpEF: EF ≥50% with diastolic dysfunction'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Chamber sizes
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Left Ventricular Internal Diameter (LVIDd)',
    normalAppearance: 'Normal LV cavity size in diastole',
    normalMeasurement: 'LVIDd 3.5-5.6 cm',
    measurementUnit: 'cm',
    measurementLow: 3.5,
    measurementHigh: 5.6,
    significance: 'Dilated LV indicates volume overload or cardiomyopathy',
    abnormalIndicates: ['Dilated cardiomyopathy', 'Chronic regurgitation', 'High output states'],
    isHighYield: true,
    panceRelevance: 4,
  },
  
  // Left atrium
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Left Atrial Size',
    normalAppearance: 'Normal LA cavity without significant enlargement',
    normalMeasurement: 'LA diameter < 4.0 cm',
    measurementUnit: 'cm',
    measurementHigh: 4.0,
    significance: 'LA enlargement associated with atrial fibrillation, mitral disease',
    abnormalIndicates: ['Mitral stenosis', 'Mitral regurgitation', 'Atrial fibrillation', 'Diastolic dysfunction'],
    clinicalPearls: ['LA enlargement increases stroke risk in afib', 'LA volume index >34 mL/m² is dilated'],
    isHighYield: true,
    panceRelevance: 4,
  },
  
  // Aortic root
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Aortic Root Diameter',
    normalAppearance: 'Normal aortic root without dilation',
    normalMeasurement: 'Aortic root < 4.0 cm',
    measurementUnit: 'cm',
    measurementHigh: 4.0,
    significance: 'Aortic root dilation may indicate aneurysm, Marfan syndrome',
    abnormalIndicates: ['Aortic aneurysm', 'Marfan syndrome', 'Bicuspid aortic valve', 'Aortic dissection'],
    clinicalPearls: ['Surgery typically considered at 5.5 cm (5.0 cm for Marfan)', 'Annual imaging for stable aneurysms'],
    isHighYield: true,
    panceRelevance: 4,
  },
  
  // Valves - Aortic
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Aortic Valve',
    normalAppearance: 'Trileaflet valve with thin, mobile leaflets. Opens fully. No calcification.',
    normalMeasurement: 'AVA > 2.0 cm²',
    measurementUnit: 'cm²',
    measurementLow: 2.0,
    significance: 'Stenosis or regurgitation indicates valvular disease',
    abnormalIndicates: ['Aortic stenosis (calcification, reduced opening)', 'Aortic regurgitation', 'Bicuspid valve', 'Endocarditis'],
    clinicalPearls: ['Severe AS: AVA <1.0 cm², mean gradient >40 mmHg', 'Bicuspid valve in ~1-2% of population'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Valves - Mitral
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Mitral Valve',
    normalAppearance: 'Two thin, mobile leaflets. Normal coaptation. No prolapse or regurgitation.',
    significance: 'Mitral valve disease common cause of heart failure symptoms',
    abnormalIndicates: ['Mitral regurgitation', 'Mitral stenosis (rheumatic)', 'Mitral valve prolapse', 'Endocarditis'],
    clinicalPearls: ['Rheumatic MS: "fish mouth" orifice', 'MVP: leaflet displacement >2mm above annulus'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Pericardium
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Pericardium',
    normalAppearance: 'No pericardial effusion. Normal pericardial thickness.',
    significance: 'Pericardial effusion may indicate pericarditis, malignancy, or trauma',
    abnormalIndicates: ['Pericardial effusion', 'Cardiac tamponade', 'Constrictive pericarditis'],
    clinicalPearls: ['Tamponade: RA/RV diastolic collapse', 'Large effusion: >2cm circumferential'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // IVC
  {
    imagingStudyName: 'Echocardiogram',
    modality: 'Ultrasound',
    bodyRegion: 'Heart',
    findingName: 'Inferior Vena Cava (IVC)',
    normalAppearance: 'IVC diameter <2.1cm with >50% inspiratory collapse',
    normalMeasurement: 'IVC < 2.1 cm, collapse >50%',
    measurementUnit: 'cm',
    measurementHigh: 2.1,
    significance: 'IVC size and collapse estimate right atrial pressure',
    abnormalIndicates: ['Elevated RA pressure (dilated, non-collapsing)', 'Volume overload', 'RV failure', 'Tamponade'],
    clinicalPearls: ['Normal IVC with >50% collapse → RAP ~3 mmHg', 'Dilated IVC with <50% collapse → RAP ~15 mmHg'],
    isHighYield: true,
    panceRelevance: 4,
  },
];

// =============================================================================
// ECG FINDINGS (as imaging for drill purposes)
// =============================================================================
const ecgFindings: NormalImagingFindingSeed[] = [
  {
    imagingStudyName: 'Electrocardiogram',
    modality: 'ECG',
    bodyRegion: 'Heart',
    findingName: 'Normal Sinus Rhythm',
    normalAppearance: 'Upright P wave before each QRS in leads I, II, aVF. Regular R-R intervals. Rate 60-100 bpm.',
    normalMeasurement: 'Rate 60-100 bpm',
    measurementUnit: 'bpm',
    measurementLow: 60,
    measurementHigh: 100,
    significance: 'Confirms SA node as pacemaker with normal conduction',
    abnormalIndicates: ['Arrhythmia if irregular', 'Ectopic rhythm if no P waves', 'Heart block if dissociated'],
    clinicalPearls: ['P wave axis 0-75° (upright in II)', 'Athletes may have physiologic sinus bradycardia'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'Electrocardiogram',
    modality: 'ECG',
    bodyRegion: 'Heart',
    findingName: 'PR Interval',
    normalAppearance: 'Isoelectric line from end of P wave to start of QRS',
    normalMeasurement: 'PR interval 0.12-0.20 seconds',
    measurementUnit: 'seconds',
    measurementLow: 0.12,
    measurementHigh: 0.20,
    significance: 'Represents AV node conduction time',
    abnormalIndicates: ['First-degree AV block (>0.20s)', 'Pre-excitation/WPW (<0.12s)', 'Higher degree AV blocks'],
    clinicalPearls: ['Short PR + delta wave = WPW', 'Progressive PR lengthening before dropped beat = Mobitz I'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'Electrocardiogram',
    modality: 'ECG',
    bodyRegion: 'Heart',
    findingName: 'QRS Complex',
    normalAppearance: 'Narrow complex with normal axis. No pathological Q waves.',
    normalMeasurement: 'QRS duration < 0.12 seconds',
    measurementUnit: 'seconds',
    measurementHigh: 0.12,
    significance: 'Represents ventricular depolarization',
    abnormalIndicates: ['Bundle branch block (>0.12s)', 'Ventricular rhythm', 'Hyperkalemia', 'Prior MI (Q waves)'],
    clinicalPearls: ['RBBB: RSR\' in V1', 'LBBB: broad notched R in V5-V6', 'Wide QRS + irregular = afib with aberrancy or VT'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'Electrocardiogram',
    modality: 'ECG',
    bodyRegion: 'Heart',
    findingName: 'QT Interval',
    normalAppearance: 'QT interval varies with heart rate. Use corrected QT (QTc).',
    normalMeasurement: 'QTc < 450ms (men), < 460ms (women)',
    measurementUnit: 'ms',
    measurementHigh: 450,
    significance: 'Prolonged QT increases risk of Torsades de Pointes',
    abnormalIndicates: ['Long QT syndrome', 'Drug effect (antipsychotics, antibiotics)', 'Electrolyte abnormalities', 'Torsades risk'],
    clinicalPearls: ['Bazett formula: QTc = QT/√RR', 'QTc >500ms = high Torsades risk', 'Hypokalemia/hypomagnesemia prolong QT'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'Electrocardiogram',
    modality: 'ECG',
    bodyRegion: 'Heart',
    findingName: 'ST Segment',
    normalAppearance: 'Isoelectric (flat) at baseline. Begins at J point, ends at T wave onset.',
    significance: 'ST changes indicate ischemia, injury, or other conditions',
    abnormalIndicates: ['STEMI (elevation)', 'Ischemia (depression)', 'Pericarditis (diffuse elevation)', 'Early repolarization'],
    clinicalPearls: ['STEMI: ≥1mm elevation in contiguous leads', 'Reciprocal changes support diagnosis', 'Posterior MI: ST depression V1-V3'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'Electrocardiogram',
    modality: 'ECG',
    bodyRegion: 'Heart',
    findingName: 'T Wave',
    normalAppearance: 'Upright in most leads (I, II, V3-V6). Inverted in aVR normal. Asymmetric.',
    significance: 'T wave changes may indicate ischemia, electrolyte abnormalities',
    abnormalIndicates: ['Ischemia (inversions)', 'Hyperkalemia (peaked)', 'Hypokalemia (flattened, U waves)', 'Wellens syndrome'],
    clinicalPearls: ['Hyperacute T waves: early STEMI sign', 'Wellens T waves: LAD stenosis warning', 'Symmetrically inverted T = ischemia'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'Electrocardiogram',
    modality: 'ECG',
    bodyRegion: 'Heart',
    findingName: 'Cardiac Axis',
    normalAppearance: 'Normal axis: -30° to +90°. QRS predominantly positive in leads I and II.',
    normalMeasurement: 'Axis -30° to +90°',
    measurementUnit: 'degrees',
    measurementLow: -30,
    measurementHigh: 90,
    significance: 'Axis deviation may indicate chamber enlargement, conduction abnormality, or MI',
    abnormalIndicates: ['LAD: LVH, LAFB, inferior MI', 'RAD: RVH, LPFB, lateral MI, PE', 'Extreme axis: ventricular rhythm'],
    clinicalPearls: ['Quick method: Lead I and aVF positivity', 'Lead I (+), aVF (+) = normal axis'],
    isHighYield: true,
    panceRelevance: 4,
  },
];

// =============================================================================
// ABDOMINAL IMAGING
// =============================================================================
const abdominalFindings: NormalImagingFindingSeed[] = [
  // Abdominal X-ray
  {
    imagingStudyName: 'Abdominal X-ray',
    modality: 'X-ray',
    bodyRegion: 'Abdomen',
    findingName: 'Bowel Gas Pattern',
    normalAppearance: 'Gas distributed throughout small and large bowel. No significant dilation. Gas in rectum.',
    normalMeasurement: 'Small bowel <3cm, Large bowel <6cm, Cecum <9cm',
    measurementUnit: 'cm',
    view: 'Supine',
    significance: 'Abnormal gas pattern suggests obstruction or ileus',
    abnormalIndicates: ['Small bowel obstruction', 'Large bowel obstruction', 'Ileus', 'Toxic megacolon'],
    clinicalPearls: ['3-6-9 rule for dilated bowel', 'Air-fluid levels on upright film suggest obstruction', 'Paucity of gas may indicate early obstruction'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'Abdominal X-ray',
    modality: 'X-ray',
    bodyRegion: 'Abdomen',
    findingName: 'Free Air',
    normalAppearance: 'No free intraperitoneal air. Diaphragm outline smooth.',
    view: 'Upright or Left lateral decubitus',
    significance: 'Free air indicates perforated viscus until proven otherwise',
    abnormalIndicates: ['Perforated ulcer', 'Perforated diverticulitis', 'Perforated appendicitis', 'Post-surgical (normal for 7 days)'],
    clinicalPearls: ['Best seen on upright CXR (under diaphragm)', 'Left lateral decubitus if patient cannot stand', 'Rigler sign: both sides of bowel wall visible'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // RUQ Ultrasound
  {
    imagingStudyName: 'RUQ Ultrasound',
    modality: 'Ultrasound',
    bodyRegion: 'Abdomen',
    findingName: 'Gallbladder',
    normalAppearance: 'Thin-walled (<3mm), anechoic (black) bile, no stones or sludge. No pericholecystic fluid.',
    normalMeasurement: 'Wall thickness < 3mm',
    measurementUnit: 'mm',
    measurementHigh: 3,
    significance: 'Gallbladder abnormalities suggest cholecystitis or cholelithiasis',
    abnormalIndicates: ['Cholelithiasis (stones)', 'Acute cholecystitis (wall thickening, + Murphy)', 'Cholangitis'],
    clinicalPearls: ['Sonographic Murphy sign: tenderness with probe pressure', 'Shadowing behind stones confirms diagnosis', 'Sludge: low-level echoes without shadowing'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  {
    imagingStudyName: 'RUQ Ultrasound',
    modality: 'Ultrasound',
    bodyRegion: 'Abdomen',
    findingName: 'Common Bile Duct',
    normalAppearance: 'Smooth walls. Measures from inner wall to inner wall.',
    normalMeasurement: 'CBD < 6mm (add 1mm per decade over 60)',
    measurementUnit: 'mm',
    measurementHigh: 6,
    significance: 'Dilated CBD suggests biliary obstruction',
    abnormalIndicates: ['Choledocholithiasis', 'Pancreatic head mass', 'Cholangiocarcinoma', 'Stricture'],
    clinicalPearls: ['Post-cholecystectomy: CBD may be up to 10mm', 'Dilated CBD + jaundice = urgent workup needed'],
    isHighYield: true,
    panceRelevance: 5,
  },
  
  // Renal Ultrasound
  {
    imagingStudyName: 'Renal Ultrasound',
    modality: 'Ultrasound',
    bodyRegion: 'Abdomen',
    findingName: 'Kidney Size',
    normalAppearance: 'Bean-shaped with echogenic cortex and hypoechoic medullary pyramids. Smooth contour.',
    normalMeasurement: 'Length 9-12 cm, Cortical thickness >1cm',
    measurementUnit: 'cm',
    measurementLow: 9,
    measurementHigh: 12,
    significance: 'Small kidneys suggest chronic kidney disease. Large may indicate acute process.',
    abnormalIndicates: ['CKD (small, echogenic)', 'Acute nephritis (enlarged)', 'Polycystic kidney disease (enlarged, cystic)', 'Hydronephrosis'],
    clinicalPearls: ['Asymmetry >2cm suggests unilateral disease', 'Increased echogenicity = parenchymal disease', 'Loss of corticomedullary differentiation indicates chronic damage'],
    isHighYield: true,
    panceRelevance: 4,
  },
  
  {
    imagingStudyName: 'Renal Ultrasound',
    modality: 'Ultrasound',
    bodyRegion: 'Abdomen',
    findingName: 'Collecting System',
    normalAppearance: 'No dilation of renal pelvis or calyces. No hydronephrosis.',
    significance: 'Hydronephrosis indicates urinary tract obstruction',
    abnormalIndicates: ['Ureteral stone', 'UPJ obstruction', 'Bladder outlet obstruction', 'Pregnancy (physiologic)'],
    clinicalPearls: ['Grade hydronephrosis: mild (pelvis only), moderate (calyces), severe (cortical thinning)', 'Acute obstruction may not show dilation initially'],
    isHighYield: true,
    panceRelevance: 5,
  },
];

// =============================================================================
// MAIN SEEDING FUNCTION
// =============================================================================
async function seedNormalImagingFindings(): Promise<void> {
  console.log('🔬 Starting Normal Imaging Findings Seeding...\n');
  
  const allFindings: NormalImagingFindingSeed[] = [
    ...cxrFindings,
    ...ctHeadFindings,
    ...echoFindings,
    ...ecgFindings,
    ...abdominalFindings,
  ];
  
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const finding of allFindings) {
    try {
      // Try to find existing by unique constraint
      const existing = await prisma.normalImagingFinding.findFirst({
        where: {
          imagingStudyName: finding.imagingStudyName,
          findingName: finding.findingName,
          view: finding.view || null,
        },
      });
      
      const data = {
        imagingStudyName: finding.imagingStudyName,
        modality: finding.modality,
        bodyRegion: finding.bodyRegion,
        findingName: finding.findingName,
        normalAppearance: finding.normalAppearance,
        normalMeasurement: finding.normalMeasurement,
        measurementUnit: finding.measurementUnit,
        measurementLow: finding.measurementLow,
        measurementHigh: finding.measurementHigh,
        view: finding.view,
        protocol: finding.protocol,
        significance: finding.significance,
        abnormalIndicates: finding.abnormalIndicates || [],
        clinicalPearls: finding.clinicalPearls || [],
        source: finding.source,
        isHighYield: finding.isHighYield || false,
        panceRelevance: finding.panceRelevance,
      };
      
      if (existing) {
        await prisma.normalImagingFinding.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await prisma.normalImagingFinding.create({ data });
        created++;
      }
      
      console.log(`  ✅ ${finding.imagingStudyName} - ${finding.findingName}`);
    } catch (error) {
      errors++;
      console.error(`  ❌ Error seeding ${finding.findingName}:`, error);
    }
  }
  
  console.log('\n📊 Seeding Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${allFindings.length}`);
}

// =============================================================================
// RUN
// =============================================================================
async function main(): Promise<void> {
  try {
    await seedNormalImagingFindings();
    
    // Print modality summary
    const modalities = await prisma.normalImagingFinding.groupBy({
      by: ['modality'],
      _count: { id: true },
    });
    
    console.log('\n📋 Findings by Modality:');
    for (const mod of modalities) {
      console.log(`   ${mod.modality}: ${mod._count.id}`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
