/**
 * Clinical Data Reference Library
 *
 * Structured reference data for imaging, auscultation, and vitals
 * interpretation. Used by drill modes, OSCE encounters, and the
 * knowledge base reference hub.
 *
 * Sprint 5: Clinical Data Integration
 */

// ============================================================================
// IMAGING REFERENCE
// ============================================================================

export type ImagingModality = 'xray' | 'ct' | 'mri' | 'ultrasound' | 'ecg';

export interface ImagingPattern {
  id: string;
  modality: ImagingModality;
  name: string;
  finding: string;
  diagnosis: string;
  system: string;         // NCCPA system abbreviation
  /** Key features to identify on the image */
  identificationKeys: string[];
  /** Common conditions that look similar */
  mimics?: string[];
  /** Clinical context that helps differentiate */
  clinicalCorrelation?: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

export const IMAGING_PATTERNS: ImagingPattern[] = [
  // === CHEST X-RAY ===
  {
    id: 'cxr_pneumonia',
    modality: 'xray',
    name: 'Lobar Pneumonia',
    finding: 'Consolidation with air bronchograms in a lobar distribution',
    diagnosis: 'Community-acquired pneumonia',
    system: 'PULM',
    identificationKeys: ['Air bronchograms', 'Lobar consolidation', 'Silhouette sign (if adjacent to heart/diaphragm)'],
    mimics: ['Atelectasis', 'Lung mass', 'Pulmonary hemorrhage'],
    clinicalCorrelation: 'Fever, productive cough, elevated WBC. Right middle lobe most common in aspiration.',
    difficulty: 'basic',
  },
  {
    id: 'cxr_pneumothorax',
    modality: 'xray',
    name: 'Pneumothorax',
    finding: 'Visceral pleural line with absent lung markings beyond the line',
    diagnosis: 'Pneumothorax',
    system: 'PULM',
    identificationKeys: ['Visceral pleural line', 'Absent lung markings peripherally', 'Deep sulcus sign (supine)'],
    mimics: ['Skin fold artifact', 'Bullous disease'],
    clinicalCorrelation: 'Sudden pleuritic chest pain, dyspnea. Tension: tracheal deviation, hemodynamic instability.',
    difficulty: 'basic',
  },
  {
    id: 'cxr_chf',
    modality: 'xray',
    name: 'Congestive Heart Failure',
    finding: 'Cardiomegaly, cephalization, Kerley B lines, bilateral pleural effusions',
    diagnosis: 'Congestive heart failure',
    system: 'CV',
    identificationKeys: ['Cardiomegaly (CTR >0.5)', 'Cephalization of vessels', 'Kerley B lines', 'Bilateral pleural effusions', 'Bat-wing pulmonary edema'],
    mimics: ['Bilateral pneumonia', 'ARDS', 'Fluid overload'],
    clinicalCorrelation: 'Dyspnea on exertion, orthopnea, PND, peripheral edema. BNP elevated.',
    difficulty: 'basic',
  },
  {
    id: 'cxr_pe',
    modality: 'xray',
    name: 'Pulmonary Embolism (CXR findings)',
    finding: 'Often normal. Hampton hump, Westermark sign, or Fleischner sign if present.',
    diagnosis: 'Pulmonary embolism',
    system: 'PULM',
    identificationKeys: ['Hampton hump (wedge-shaped opacity)', 'Westermark sign (focal oligemia)', 'Fleischner sign (enlarged pulmonary artery)'],
    mimics: ['Pneumonia', 'Atelectasis'],
    clinicalCorrelation: 'CXR is often normal in PE. CT-PA is the diagnostic test of choice. Wells criteria for risk stratification.',
    difficulty: 'intermediate',
  },

  // === CT HEAD ===
  {
    id: 'ct_ischemic_stroke',
    modality: 'ct',
    name: 'Ischemic Stroke',
    finding: 'Hypodense area in vascular distribution, loss of gray-white differentiation',
    diagnosis: 'Ischemic stroke',
    system: 'NEURO',
    identificationKeys: ['Hypodense (dark) area', 'Loss of gray-white junction', 'Sulcal effacement', 'Hyperdense vessel sign (acute)'],
    mimics: ['Hemorrhagic stroke', 'Brain tumor', 'Encephalitis'],
    clinicalCorrelation: 'Non-contrast CT may be normal in first 6-12 hours. CT mainly done to rule out hemorrhage before tPA.',
    difficulty: 'intermediate',
  },
  {
    id: 'ct_hemorrhagic_stroke',
    modality: 'ct',
    name: 'Intracerebral Hemorrhage',
    finding: 'Hyperdense (bright white) area in brain parenchyma',
    diagnosis: 'Hemorrhagic stroke',
    system: 'NEURO',
    identificationKeys: ['Hyperdense (white) lesion', 'Surrounding edema', 'Mass effect/midline shift', 'Possible intraventricular extension'],
    mimics: ['Hemorrhagic tumor', 'Vascular malformation bleed', 'Contusion'],
    clinicalCorrelation: 'Sudden severe headache, focal neuro deficit. Hypertension is #1 risk factor. tPA is contraindicated.',
    difficulty: 'basic',
  },
  {
    id: 'ct_appendicitis',
    modality: 'ct',
    name: 'Acute Appendicitis',
    finding: 'Dilated appendix >6mm, periappendiceal fat stranding, appendicolith',
    diagnosis: 'Acute appendicitis',
    system: 'GI',
    identificationKeys: ['Appendix >6mm diameter', 'Periappendiceal fat stranding', 'Appendicolith', 'Wall enhancement'],
    mimics: ['Mesenteric lymphadenitis', 'Right ovarian pathology', 'Crohn ileitis'],
    clinicalCorrelation: 'RLQ pain, McBurney point tenderness, migration from periumbilical. Surgical emergency.',
    difficulty: 'basic',
  },

  // === ECG ===
  {
    id: 'ecg_afib',
    modality: 'ecg',
    name: 'Atrial Fibrillation',
    finding: 'Irregularly irregular rhythm, absent P waves, fibrillatory baseline',
    diagnosis: 'Atrial fibrillation',
    system: 'CV',
    identificationKeys: ['Irregularly irregular R-R intervals', 'Absent P waves', 'Fibrillatory baseline', 'Variable ventricular rate'],
    mimics: ['Multifocal atrial tachycardia (MAT)', 'Frequent PACs'],
    clinicalCorrelation: 'Palpitations, stroke risk. CHA₂DS₂-VASc for anticoagulation decision. Rate vs rhythm control.',
    difficulty: 'basic',
  },
  {
    id: 'ecg_stemi',
    modality: 'ecg',
    name: 'ST-Elevation MI',
    finding: 'ST elevation ≥1mm in 2+ contiguous leads with reciprocal changes',
    diagnosis: 'STEMI',
    system: 'CV',
    identificationKeys: ['ST elevation ≥1mm in limb leads or ≥2mm in precordial', 'Reciprocal ST depression', 'Contiguous lead pattern', 'Possible Q waves (late)'],
    mimics: ['Benign early repolarization', 'Pericarditis (diffuse)', 'Left ventricular aneurysm', 'Brugada syndrome'],
    clinicalCorrelation: 'Chest pain, diaphoresis, elevated troponin. Door-to-balloon <90min. Activate cath lab.',
    difficulty: 'intermediate',
  },
  {
    id: 'ecg_heart_blocks',
    modality: 'ecg',
    name: 'Heart Blocks (1st, 2nd, 3rd degree)',
    finding: 'Prolonged PR, dropped beats, or AV dissociation',
    diagnosis: 'AV conduction block',
    system: 'CV',
    identificationKeys: [
      '1st degree: PR >200ms, all P waves conducted',
      '2nd degree Type I (Wenckebach): Progressive PR prolongation → dropped QRS',
      '2nd degree Type II: Constant PR → sudden dropped QRS (more dangerous)',
      '3rd degree: Complete AV dissociation, regular P-P and R-R but unrelated',
    ],
    clinicalCorrelation: '1st degree: usually benign. Type II and 3rd degree may need pacemaker. Mobitz II is high-risk.',
    difficulty: 'intermediate',
  },
  {
    id: 'ecg_axis_deviation',
    modality: 'ecg',
    name: 'Axis Deviation',
    finding: 'Abnormal QRS axis determined by leads I and aVF',
    diagnosis: 'Left or right axis deviation',
    system: 'CV',
    identificationKeys: [
      'Normal axis: I(+) aVF(+)',
      'LAD: I(+) aVF(-) — LVH, LAFB, inferior MI',
      'RAD: I(-) aVF(+) — RVH, PE, LPFB',
      'Extreme axis: I(-) aVF(-) — ventricular rhythm',
    ],
    clinicalCorrelation: 'LAD common in LVH, elderly. RAD suggests right heart strain (PE, COPD, pulmonary HTN).',
    difficulty: 'advanced',
  },
];

// ============================================================================
// AUSCULTATION REFERENCE
// ============================================================================

export type AuscultationType = 'heart' | 'lung' | 'bowel';

export interface AuscultationSound {
  id: string;
  type: AuscultationType;
  name: string;
  description: string;
  /** Where to best auscultate */
  location: string;
  /** Timing in cardiac/respiratory cycle */
  timing?: string;
  /** Associated conditions */
  conditions: string[];
  system: string;
  /** Key features to differentiate from similar sounds */
  differentiatingFeatures: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

export const AUSCULTATION_SOUNDS: AuscultationSound[] = [
  // === HEART SOUNDS ===
  {
    id: 'heart_s3',
    type: 'heart',
    name: 'S3 (Third Heart Sound)',
    description: 'Low-pitched sound in early diastole, best heard at apex with bell',
    location: 'Apex (mitral area), left lateral decubitus position',
    timing: 'Early diastole (after S2)',
    conditions: ['Heart failure (volume overload)', 'Mitral regurgitation', 'Normal in young adults/pregnancy'],
    system: 'CV',
    differentiatingFeatures: ['Low-pitched "Kentucky" cadence (S1-S2-S3)', 'Best with bell of stethoscope', 'Pathologic after age 40'],
    difficulty: 'basic',
  },
  {
    id: 'heart_s4',
    type: 'heart',
    name: 'S4 (Fourth Heart Sound)',
    description: 'Low-pitched sound in late diastole (presystolic), indicates stiff ventricle',
    location: 'Apex, with bell',
    timing: 'Late diastole (before S1)',
    conditions: ['LVH (hypertension, aortic stenosis)', 'Acute MI', 'Hypertrophic cardiomyopathy'],
    system: 'CV',
    differentiatingFeatures: ['"Tennessee" cadence (S4-S1-S2)', 'Always pathologic', 'Absent in atrial fibrillation (no atrial kick)'],
    difficulty: 'intermediate',
  },
  {
    id: 'heart_aortic_stenosis',
    type: 'heart',
    name: 'Aortic Stenosis Murmur',
    description: 'Crescendo-decrescendo systolic murmur radiating to carotids',
    location: 'Right upper sternal border (aortic area)',
    timing: 'Systolic',
    conditions: ['Calcific aortic stenosis', 'Bicuspid aortic valve', 'Rheumatic heart disease'],
    system: 'CV',
    differentiatingFeatures: ['Crescendo-decrescendo (diamond shaped)', 'Radiates to carotids', 'Parvus et tardus pulse', 'Increases with squatting, decreases with Valsalva'],
    difficulty: 'basic',
  },
  {
    id: 'heart_mitral_regurgitation',
    type: 'heart',
    name: 'Mitral Regurgitation Murmur',
    description: 'Holosystolic (pansystolic) murmur radiating to axilla',
    location: 'Apex (mitral area)',
    timing: 'Holosystolic',
    conditions: ['MVP with regurgitation', 'Rheumatic heart disease', 'Papillary muscle dysfunction', 'Dilated cardiomyopathy'],
    system: 'CV',
    differentiatingFeatures: ['Blowing, holosystolic', 'Radiates to left axilla', 'S3 may be present', 'Increases with handgrip (afterload increase)'],
    difficulty: 'basic',
  },
  {
    id: 'heart_mvp',
    type: 'heart',
    name: 'Mitral Valve Prolapse',
    description: 'Mid-systolic click, may have late systolic murmur',
    location: 'Apex',
    timing: 'Mid-systolic click ± late systolic murmur',
    conditions: ['Mitral valve prolapse', 'Connective tissue disorders (Marfan, Ehlers-Danlos)'],
    system: 'CV',
    differentiatingFeatures: ['Click moves earlier with standing/Valsalva (less preload)', 'Click moves later with squatting (more preload)', 'Murmur gets longer with standing'],
    difficulty: 'intermediate',
  },

  // === LUNG SOUNDS ===
  {
    id: 'lung_crackles',
    type: 'lung',
    name: 'Crackles (Rales)',
    description: 'Discontinuous, popping sounds heard during inspiration',
    location: 'Lung bases (bilateral in CHF, unilateral in pneumonia)',
    timing: 'Inspiratory',
    conditions: ['Pulmonary edema/CHF', 'Pneumonia', 'Pulmonary fibrosis', 'Atelectasis'],
    system: 'PULM',
    differentiatingFeatures: ['Fine crackles: velcro-like (fibrosis)', 'Coarse crackles: bubbling (pneumonia, secretions)', 'Bibasilar: think CHF', 'Unilateral: think pneumonia/atelectasis'],
    difficulty: 'basic',
  },
  {
    id: 'lung_wheezes',
    type: 'lung',
    name: 'Wheezes',
    description: 'High-pitched, musical, continuous sounds from narrowed airways',
    location: 'Diffuse (asthma/COPD) or focal (foreign body/mass)',
    timing: 'Usually expiratory; inspiratory+expiratory = severe obstruction',
    conditions: ['Asthma', 'COPD', 'Bronchospasm', 'Foreign body', 'Anaphylaxis'],
    system: 'PULM',
    differentiatingFeatures: ['Polyphonic diffuse: asthma/COPD', 'Monophonic focal: mass/foreign body', 'Silent chest in severe asthma = ominous', 'Responds to bronchodilators in asthma'],
    difficulty: 'basic',
  },
  {
    id: 'lung_stridor',
    type: 'lung',
    name: 'Stridor',
    description: 'High-pitched inspiratory sound from upper airway obstruction',
    location: 'Neck/upper airway, audible without stethoscope',
    timing: 'Inspiratory (extrathoracic obstruction)',
    conditions: ['Croup', 'Epiglottitis', 'Anaphylaxis', 'Foreign body', 'Vocal cord dysfunction'],
    system: 'PULM',
    differentiatingFeatures: ['Inspiratory = extrathoracic obstruction', 'Biphasic = fixed lesion', 'Barking cough with stridor = croup', 'Drooling + stridor = epiglottitis (emergency)'],
    difficulty: 'intermediate',
  },
  {
    id: 'lung_pleural_rub',
    type: 'lung',
    name: 'Pleural Friction Rub',
    description: 'Grating, creaking sound from inflamed pleural surfaces rubbing',
    location: 'Lateral chest wall, may be heard in inspiration and expiration',
    timing: 'Both inspiration and expiration',
    conditions: ['Pleuritis/pleurisy', 'Pulmonary embolism', 'Pneumonia with pleural involvement'],
    system: 'PULM',
    differentiatingFeatures: ['Sounds like leather rubbing', 'Disappears with effusion (surfaces separated)', 'Not affected by coughing (unlike crackles)', 'Heard in both phases (unlike pericardial rub which is triphasic)'],
    difficulty: 'intermediate',
  },

  // === BOWEL SOUNDS ===
  {
    id: 'bowel_hyperactive',
    type: 'bowel',
    name: 'Hyperactive Bowel Sounds',
    description: 'Loud, frequent, high-pitched rushing sounds (borborygmi)',
    location: 'All four quadrants',
    conditions: ['Early bowel obstruction', 'Gastroenteritis', 'Diarrhea', 'GI bleed'],
    system: 'GI',
    differentiatingFeatures: ['High-pitched rushes in obstruction', 'Frequent gurgling in gastroenteritis', 'Listen for at least 2 minutes'],
    difficulty: 'basic',
  },
  {
    id: 'bowel_absent',
    type: 'bowel',
    name: 'Absent/Hypoactive Bowel Sounds',
    description: 'No sounds or rare, quiet sounds after listening for 2+ minutes',
    location: 'All four quadrants (must listen in all)',
    conditions: ['Ileus (post-surgical)', 'Late bowel obstruction', 'Peritonitis', 'Mesenteric ischemia'],
    system: 'GI',
    differentiatingFeatures: ['Must listen full 2 minutes before declaring absent', 'Post-op ileus is most common cause', 'Peritonitis: absent sounds + rigid abdomen', 'Late obstruction: absent after initial hyperactive phase'],
    difficulty: 'basic',
  },
];

// ============================================================================
// VITALS INTERPRETATION
// ============================================================================

export interface VitalRange {
  name: string;
  unit: string;
  adult: { low: number; high: number };
  pediatric?: { low: number; high: number; ageRange: string };
  geriatric?: { low: number; high: number };
  /** Clinical scenarios associated with abnormal values */
  abnormalScenarios: {
    high: string[];
    low: string[];
  };
}

export const VITAL_RANGES: VitalRange[] = [
  {
    name: 'Heart Rate',
    unit: 'bpm',
    adult: { low: 60, high: 100 },
    pediatric: { low: 80, high: 150, ageRange: 'Infant (1-12 months)' },
    abnormalScenarios: {
      high: ['Tachycardia: fever, dehydration, PE, thyrotoxicosis, SVT, anemia, pain, anxiety'],
      low: ['Bradycardia: beta-blocker, hypothyroidism, heart block, athlete, increased ICP (Cushing)'],
    },
  },
  {
    name: 'Blood Pressure (Systolic)',
    unit: 'mmHg',
    adult: { low: 90, high: 140 },
    abnormalScenarios: {
      high: ['Hypertension: essential, renal artery stenosis, pheochromocytoma, Cushing, preeclampsia'],
      low: ['Hypotension: sepsis, hemorrhage, cardiogenic shock, anaphylaxis, adrenal crisis, dehydration'],
    },
  },
  {
    name: 'Respiratory Rate',
    unit: 'breaths/min',
    adult: { low: 12, high: 20 },
    pediatric: { low: 20, high: 40, ageRange: 'Infant' },
    abnormalScenarios: {
      high: ['Tachypnea: PE, pneumonia, DKA (Kussmaul), asthma, anxiety, metabolic acidosis, sepsis'],
      low: ['Bradypnea: opioid overdose, CNS depression, hypothyroidism, severe hypothermia'],
    },
  },
  {
    name: 'Temperature',
    unit: '°F',
    adult: { low: 97.0, high: 99.5 },
    abnormalScenarios: {
      high: ['Fever: infection, malignancy, autoimmune, drug reaction, heat stroke, thyroid storm'],
      low: ['Hypothermia: exposure, sepsis (late), hypothyroidism, hypoglycemia, adrenal crisis'],
    },
  },
  {
    name: 'Oxygen Saturation (SpO₂)',
    unit: '%',
    adult: { low: 95, high: 100 },
    abnormalScenarios: {
      high: ['SpO₂ 100% on room air: normal (can mask CO poisoning — check ABG)'],
      low: ['Hypoxemia: COPD, pneumonia, PE, asthma, ARDS, CHF, pneumothorax, anemia (SpO₂ may be normal)'],
    },
  },
];

/**
 * SIRS Criteria (still clinically relevant despite qSOFA)
 */
export const SIRS_CRITERIA = {
  description: 'Systemic Inflammatory Response Syndrome — 2+ of the following:',
  criteria: [
    'Temperature >38°C (100.4°F) or <36°C (96.8°F)',
    'Heart rate >90 bpm',
    'Respiratory rate >20/min or PaCO₂ <32 mmHg',
    'WBC >12,000/μL or <4,000/μL or >10% bands',
  ],
  clinicalNote: 'SIRS + suspected infection = Sepsis. Use qSOFA at bedside (RR≥22, SBP≤100, altered mentation).',
};

/**
 * Shock classification by vital sign patterns
 */
export const SHOCK_PATTERNS = [
  {
    type: 'Hypovolemic',
    hr: 'Increased',
    bp: 'Decreased',
    svr: 'Increased',
    co: 'Decreased',
    examples: ['Hemorrhage', 'Dehydration', 'Burns'],
  },
  {
    type: 'Cardiogenic',
    hr: 'Increased',
    bp: 'Decreased',
    svr: 'Increased',
    co: 'Decreased',
    examples: ['MI', 'CHF', 'Tamponade', 'Tension pneumothorax'],
  },
  {
    type: 'Distributive (Septic)',
    hr: 'Increased',
    bp: 'Decreased',
    svr: 'Decreased',
    co: 'Increased (early) / Decreased (late)',
    examples: ['Sepsis', 'Anaphylaxis', 'Neurogenic'],
  },
  {
    type: 'Obstructive',
    hr: 'Increased',
    bp: 'Decreased',
    svr: 'Increased',
    co: 'Decreased',
    examples: ['PE', 'Cardiac tamponade', 'Tension pneumothorax'],
  },
];

/**
 * Get imaging patterns filtered by system or modality.
 */
export function getImagingBySystem(system: string): ImagingPattern[] {
  return IMAGING_PATTERNS.filter(p => p.system === system);
}

export function getImagingByModality(modality: ImagingModality): ImagingPattern[] {
  return IMAGING_PATTERNS.filter(p => p.modality === modality);
}

/**
 * Get auscultation sounds by type.
 */
export function getAuscultationByType(type: AuscultationType): AuscultationSound[] {
  return AUSCULTATION_SOUNDS.filter(s => s.type === type);
}
