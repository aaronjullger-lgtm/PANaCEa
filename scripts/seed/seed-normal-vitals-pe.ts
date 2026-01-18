/**
 * Seed Normal Vital Signs & Physical Exam Findings
 *
 * Seeds the NormalVitalSign and NormalPhysicalExamFinding tables
 * with comprehensive normal reference values.
 *
 * Usage: npx tsx scripts/seed/seed-normal-vitals-pe.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// VITAL SIGNS
// =============================================================================
interface NormalVitalSignSeed {
  vitalName: string;
  normalRangeLow?: number;
  normalRangeHigh?: number;
  units: string;
  sex?: string;
  ageGroup?: string;
  ageRangeLow?: number;
  ageRangeHigh?: number;
  context?: string;
  clinicalNotes?: string;
  abnormalIndicates?: string[];
}

const vitalSigns: NormalVitalSignSeed[] = [
  // Heart Rate
  {
    vitalName: 'Heart Rate',
    normalRangeLow: 60,
    normalRangeHigh: 100,
    units: 'bpm',
    ageGroup: 'adult',
    context: 'at rest',
    clinicalNotes: 'Bradycardia <60, Tachycardia >100. Athletes may have lower resting HR.',
    abnormalIndicates: [
      'Arrhythmia',
      'Thyroid disease',
      'Infection (tachycardia)',
      'Heart block (bradycardia)',
    ],
  },
  {
    vitalName: 'Heart Rate',
    normalRangeLow: 100,
    normalRangeHigh: 160,
    units: 'bpm',
    ageGroup: 'neonate',
    ageRangeLow: 0,
    ageRangeHigh: 1,
    context: 'at rest',
    clinicalNotes: 'Neonates have significantly higher resting heart rates',
  },
  {
    vitalName: 'Heart Rate',
    normalRangeLow: 80,
    normalRangeHigh: 130,
    units: 'bpm',
    ageGroup: 'infant',
    ageRangeLow: 1,
    ageRangeHigh: 2,
    context: 'at rest',
  },
  {
    vitalName: 'Heart Rate',
    normalRangeLow: 70,
    normalRangeHigh: 110,
    units: 'bpm',
    ageGroup: 'child',
    ageRangeLow: 2,
    ageRangeHigh: 12,
    context: 'at rest',
  },

  // Blood Pressure - Systolic
  {
    vitalName: 'Systolic Blood Pressure',
    normalRangeLow: 90,
    normalRangeHigh: 120,
    units: 'mmHg',
    ageGroup: 'adult',
    context: 'at rest',
    clinicalNotes: 'Elevated 120-129. Stage 1 HTN 130-139. Stage 2 HTN ≥140.',
    abnormalIndicates: ['Hypertension', 'Hypotension/shock', 'Dehydration', 'Cardiac dysfunction'],
  },
  {
    vitalName: 'Systolic Blood Pressure',
    normalRangeLow: 90,
    normalRangeHigh: 140,
    units: 'mmHg',
    ageGroup: 'elderly',
    ageRangeLow: 65,
    context: 'at rest',
    clinicalNotes: 'Higher targets in elderly. Avoid aggressive lowering to prevent falls.',
  },

  // Blood Pressure - Diastolic
  {
    vitalName: 'Diastolic Blood Pressure',
    normalRangeLow: 60,
    normalRangeHigh: 80,
    units: 'mmHg',
    ageGroup: 'adult',
    context: 'at rest',
    clinicalNotes:
      'Stage 1 HTN 80-89. Stage 2 HTN ≥90. Wide pulse pressure in aortic regurgitation.',
    abnormalIndicates: ['Hypertension', 'Aortic regurgitation (low)', 'Shock (low)'],
  },

  // Respiratory Rate
  {
    vitalName: 'Respiratory Rate',
    normalRangeLow: 12,
    normalRangeHigh: 20,
    units: 'breaths/min',
    ageGroup: 'adult',
    context: 'at rest',
    clinicalNotes:
      'Tachypnea >20. Often first sign of respiratory distress. Count for full minute.',
    abnormalIndicates: ['Respiratory distress', 'Metabolic acidosis', 'Anxiety', 'Pain', 'Sepsis'],
  },
  {
    vitalName: 'Respiratory Rate',
    normalRangeLow: 30,
    normalRangeHigh: 60,
    units: 'breaths/min',
    ageGroup: 'neonate',
    context: 'at rest',
    clinicalNotes: 'Neonates breathe faster. Periodic breathing normal.',
  },
  {
    vitalName: 'Respiratory Rate',
    normalRangeLow: 20,
    normalRangeHigh: 30,
    units: 'breaths/min',
    ageGroup: 'child',
    ageRangeLow: 2,
    ageRangeHigh: 12,
    context: 'at rest',
  },

  // Temperature
  {
    vitalName: 'Temperature (Oral)',
    normalRangeLow: 97.8,
    normalRangeHigh: 99.1,
    units: '°F',
    ageGroup: 'adult',
    context: 'oral',
    clinicalNotes: 'Fever ≥100.4°F (38°C). Hypothermia <95°F. Varies with time of day.',
    abnormalIndicates: [
      'Infection (high)',
      'Hyperthyroidism (high)',
      'Hypothermia (low)',
      'Sepsis (may be low or high)',
    ],
  },
  {
    vitalName: 'Temperature (Rectal)',
    normalRangeLow: 98.6,
    normalRangeHigh: 100.4,
    units: '°F',
    ageGroup: 'adult',
    context: 'rectal',
    clinicalNotes: 'Rectal temp ~0.5-1°F higher than oral. Most accurate core temp measurement.',
  },
  {
    vitalName: 'Temperature (Axillary)',
    normalRangeLow: 96.6,
    normalRangeHigh: 98.0,
    units: '°F',
    ageGroup: 'adult',
    context: 'axillary',
    clinicalNotes: 'Axillary temp ~1°F lower than oral. Less accurate.',
  },

  // Oxygen Saturation
  {
    vitalName: 'Oxygen Saturation (SpO2)',
    normalRangeLow: 95,
    normalRangeHigh: 100,
    units: '%',
    ageGroup: 'adult',
    context: 'room air',
    clinicalNotes: '<94% hypoxemia. <90% severe hypoxemia. COPD patients may have lower baseline.',
    abnormalIndicates: [
      'Hypoxemia',
      'Pulmonary disease',
      'Cardiac shunt',
      'Anemia (falsely normal)',
    ],
  },
  {
    vitalName: 'Oxygen Saturation (SpO2)',
    normalRangeLow: 88,
    normalRangeHigh: 92,
    units: '%',
    ageGroup: 'adult',
    context: 'COPD on room air',
    clinicalNotes: 'COPD patients target 88-92% to avoid suppressing hypoxic drive.',
  },

  // Mean Arterial Pressure
  {
    vitalName: 'Mean Arterial Pressure (MAP)',
    normalRangeLow: 70,
    normalRangeHigh: 105,
    units: 'mmHg',
    ageGroup: 'adult',
    context: 'at rest',
    clinicalNotes: 'MAP = DBP + 1/3(SBP-DBP). MAP >65 needed for organ perfusion.',
    abnormalIndicates: ['Shock (<65)', 'Hypertensive emergency (>130)', 'Sepsis'],
  },

  // Pain Score
  {
    vitalName: 'Pain Score',
    normalRangeLow: 0,
    normalRangeHigh: 0,
    units: 'numeric scale 0-10',
    ageGroup: 'adult',
    context: 'at rest',
    clinicalNotes: '0 = no pain. 1-3 mild. 4-6 moderate. 7-10 severe. Subjective measure.',
    abnormalIndicates: ['Acute illness', 'Injury', 'Chronic pain condition'],
  },
];

// =============================================================================
// PHYSICAL EXAM FINDINGS
// =============================================================================
interface NormalPEFindingSeed {
  system: string;
  examComponent: string;
  normalFinding: string;
  technique?: string;
  ageGroup?: string;
  abnormalVariations?: string[];
  clinicalPearls?: string[];
}

const peFindings: NormalPEFindingSeed[] = [
  // HEENT
  {
    system: 'HEENT',
    examComponent: 'Pupils',
    normalFinding:
      'PERRLA - Pupils Equal, Round, Reactive to Light and Accommodation. 2-5mm diameter.',
    technique: 'Dim lights. Shine light in each eye, observe direct and consensual response.',
    abnormalVariations: [
      'Anisocoria (unequal)',
      'Fixed dilated (CN III palsy)',
      'Pinpoint (opioids)',
      'Blown pupil (herniation)',
    ],
    clinicalPearls: [
      'Document size in mm',
      'Always check consensual reflex',
      'Marcus Gunn pupil = afferent defect',
    ],
  },
  {
    system: 'HEENT',
    examComponent: 'Fundoscopic Exam',
    normalFinding:
      'Clear media. Sharp optic disc margins. Cup-to-disc ratio <0.5. No hemorrhages, exudates, or papilledema.',
    technique: 'Darkened room. Patient fixates on distant target. Approach at 15° angle.',
    abnormalVariations: [
      'Papilledema (ICP)',
      'Copper wiring (HTN)',
      'Dot-blot hemorrhages (DM)',
      'Pale disc (optic neuritis)',
    ],
    clinicalPearls: [
      'Papilledema = bilateral swelling, no spontaneous venous pulsations',
      'Cotton wool spots indicate ischemia',
    ],
  },
  {
    system: 'HEENT',
    examComponent: 'Tympanic Membrane',
    normalFinding:
      "Pearly gray, translucent. Light reflex (cone of light) at 5 o'clock (right) or 7 o'clock (left). Mobile. Landmarks visible.",
    technique: 'Pull pinna up and back (adults). Use pneumatic otoscopy to assess mobility.',
    abnormalVariations: [
      'Bulging (acute otitis media)',
      'Retracted (ETD)',
      'Perforation',
      'Effusion (amber/bubbles)',
    ],
    clinicalPearls: [
      'Absent light reflex suggests fluid',
      'Red bulging TM = AOM',
      'Cholesteatoma: white mass behind TM',
    ],
  },
  {
    system: 'HEENT',
    examComponent: 'Oropharynx',
    normalFinding:
      'Moist mucous membranes. Pink uvula midline. Tonsils without exudate. No erythema or lesions.',
    technique: 'Tongue blade to depress tongue. Say "ahh" to assess palate elevation.',
    abnormalVariations: [
      'Tonsillar exudate (strep, mono)',
      'Petechiae (strep)',
      'Cobblestoning (post-nasal drip)',
      'Uvular deviation (CN X palsy)',
    ],
    clinicalPearls: [
      'Centor criteria for strep',
      'Peritonsillar abscess: uvula deviated AWAY from affected side',
    ],
  },

  // Neck
  {
    system: 'Neck',
    examComponent: 'Thyroid',
    normalFinding:
      'Non-tender. No palpable nodules. Rises with swallowing. Isthmus palpable over trachea.',
    technique: 'Stand behind patient. Palpate while patient swallows water.',
    abnormalVariations: [
      'Goiter (enlarged)',
      'Nodule',
      'Tenderness (thyroiditis)',
      'Bruit (Graves)',
    ],
    clinicalPearls: [
      'Have patient swallow to distinguish thyroid from other neck masses',
      'Solitary nodule needs workup',
    ],
  },
  {
    system: 'Neck',
    examComponent: 'Lymph Nodes',
    normalFinding:
      'No palpable lymphadenopathy. If palpable: small (<1cm), soft, mobile, non-tender.',
    technique:
      'Systematic palpation: submental, submandibular, preauricular, posterior auricular, anterior/posterior cervical, supraclavicular.',
    abnormalVariations: [
      'Tender (infection)',
      'Hard/fixed (malignancy)',
      'Rubbery (lymphoma)',
      'Supraclavicular (serious until proven otherwise)',
    ],
    clinicalPearls: [
      'Shotty nodes (small, BB-like) in children often normal',
      'Left supraclavicular = Virchow node (GI malignancy)',
    ],
  },
  {
    system: 'Neck',
    examComponent: 'JVP (Jugular Venous Pressure)',
    normalFinding:
      'JVP ≤3-4 cm above sternal angle at 45°. Visible pulsations with "a" and "v" waves.',
    technique: 'Patient at 45°. Turn head slightly away. Observe right internal jugular.',
    abnormalVariations: [
      'Elevated JVP (heart failure, tamponade)',
      'Kussmaul sign (inspiration increases JVP)',
      'Cannon a waves (AV dissociation)',
    ],
    clinicalPearls: [
      'Add 5cm to measured height above sternal angle for RA pressure',
      'Hepatojugular reflux: +3cm rise sustained >15 sec = positive',
    ],
  },

  // Cardiovascular
  {
    system: 'Cardiovascular',
    examComponent: 'Heart Sounds',
    normalFinding:
      'S1, S2 regular rate and rhythm. No murmurs, rubs, or gallops. PMI at 5th ICS, MCL.',
    technique: 'Auscultate 4 areas: aortic, pulmonic, tricuspid, mitral. Use bell and diaphragm.',
    abnormalVariations: [
      'Murmur (valvular disease)',
      'S3 gallop (heart failure)',
      'S4 gallop (stiff ventricle)',
      'Friction rub (pericarditis)',
    ],
    clinicalPearls: [
      'S3 = volume overload, heard with bell',
      'S4 = pressure overload',
      'Murmur radiation helps localize',
    ],
  },
  {
    system: 'Cardiovascular',
    examComponent: 'Peripheral Pulses',
    normalFinding:
      '2+ and symmetric bilaterally at radial, brachial, femoral, popliteal, dorsalis pedis, and posterior tibial.',
    technique:
      'Palpate with fingertips. Compare sides. 0=absent, 1+=diminished, 2+=normal, 3+=bounding.',
    abnormalVariations: [
      'Absent (PAD, embolism)',
      'Diminished (stenosis)',
      'Bounding (aortic regurgitation)',
      'Asymmetric (dissection, coarctation)',
    ],
    clinicalPearls: [
      'Absent DP pulse may be normal variant',
      'Radio-femoral delay = coarctation',
      'Pulsus paradoxus: BP drop >10mmHg with inspiration',
    ],
  },
  {
    system: 'Cardiovascular',
    examComponent: 'Capillary Refill',
    normalFinding: '<2 seconds. Nail bed returns to pink quickly after blanching.',
    technique: 'Press on nail bed for 5 seconds, release, count seconds to return of color.',
    abnormalVariations: [
      'Delayed (>2 sec): dehydration, shock, PAD',
      'Very rapid (<1 sec): hyperdynamic states',
    ],
    clinicalPearls: [
      'Temperature affects results',
      'Poor sensitivity for shock but very specific if delayed',
    ],
  },

  // Respiratory
  {
    system: 'Respiratory',
    examComponent: 'Breath Sounds',
    normalFinding:
      'Clear to auscultation bilaterally. Vesicular sounds over lung fields. Bronchovesicular at main bronchi.',
    technique:
      'Auscultate systematically comparing sides. Anterior, lateral, posterior. At least 6 areas.',
    abnormalVariations: [
      'Crackles/rales (fluid, fibrosis)',
      'Wheezes (obstruction)',
      'Rhonchi (secretions)',
      'Diminished (effusion, pneumothorax)',
    ],
    clinicalPearls: [
      'Fine crackles = interstitial disease',
      'Coarse crackles = alveolar fluid',
      'Wheezes that clear with cough = secretions',
    ],
  },
  {
    system: 'Respiratory',
    examComponent: 'Percussion',
    normalFinding: 'Resonant throughout lung fields. Dull over heart and liver.',
    technique: 'Place non-dominant hand firmly on chest. Tap middle finger with dominant hand.',
    abnormalVariations: [
      'Dull (consolidation, effusion)',
      'Hyperresonant (pneumothorax, emphysema)',
      'Flat (large effusion, atelectasis)',
    ],
    clinicalPearls: [
      'Diaphragm excursion should be symmetric',
      'Stony dullness = effusion',
      'Egophony: "E" sounds like "A" over consolidation',
    ],
  },
  {
    system: 'Respiratory',
    examComponent: 'Tactile Fremitus',
    normalFinding: 'Symmetric vibration felt bilaterally when patient says "99" or "toy boat".',
    technique: 'Place ulnar aspect of hands on chest wall. Compare sides.',
    abnormalVariations: [
      'Increased (consolidation)',
      'Decreased (effusion, pneumothorax, emphysema)',
    ],
    clinicalPearls: [
      'Consolidation: increased fremitus, dull percussion, bronchial breath sounds',
      'Effusion: decreased fremitus, dull percussion, decreased breath sounds',
    ],
  },

  // Abdomen
  {
    system: 'Abdominal',
    examComponent: 'Inspection',
    normalFinding:
      'Soft, flat or scaphoid. No distension, visible peristalsis, or pulsations. No scars.',
    technique: 'Inspect with patient supine, knees bent. Note contour, scars, hernias.',
    abnormalVariations: [
      'Distension (ascites, obstruction)',
      'Visible peristalsis (obstruction)',
      'Caput medusae (portal HTN)',
    ],
    clinicalPearls: [
      'Scaphoid abdomen may indicate malnutrition',
      'Grey-Turner sign: flank ecchymosis in pancreatitis',
    ],
  },
  {
    system: 'Abdominal',
    examComponent: 'Auscultation',
    normalFinding: 'Normoactive bowel sounds, ~5-30 per minute. No bruits.',
    technique:
      'Listen in all 4 quadrants before palpation. Listen for at least 2 minutes before calling absent.',
    abnormalVariations: [
      'Hyperactive (early obstruction, gastroenteritis)',
      'Hypoactive/absent (ileus, peritonitis)',
      'High-pitched tinkling (obstruction)',
    ],
    clinicalPearls: [
      'Always auscultate before palpation',
      'Bruits: renal artery stenosis, AAA',
      'Absent bowel sounds require full 2-5 min listen',
    ],
  },
  {
    system: 'Abdominal',
    examComponent: 'Palpation',
    normalFinding:
      'Soft, non-tender, non-distended. No masses, hepatomegaly, or splenomegaly. No rebound or guarding.',
    technique:
      "Start away from pain. Superficial then deep. Watch patient's face. Palpate liver and spleen.",
    abnormalVariations: [
      'Rigidity (peritonitis)',
      'Guarding (inflammation)',
      'Rebound tenderness (peritoneal irritation)',
      'Mass',
    ],
    clinicalPearls: [
      'Rovsing sign: RLQ pain with LLQ palpation = appendicitis',
      'Murphy sign: inspiratory arrest with RUQ palpation = cholecystitis',
    ],
  },
  {
    system: 'Abdominal',
    examComponent: 'Liver Span',
    normalFinding: 'Liver span 6-12 cm at MCL. Edge smooth, non-tender, below right costal margin.',
    technique: 'Percuss down from lung resonance. Palpate up from iliac crest. Measure span.',
    abnormalVariations: [
      'Enlarged (hepatitis, CHF, cirrhosis)',
      'Small (advanced cirrhosis)',
      'Nodular edge (cirrhosis, metastases)',
    ],
    clinicalPearls: [
      'Scratch test can help locate liver edge',
      'Pulsatile liver = tricuspid regurgitation',
    ],
  },

  // Neurological
  {
    system: 'Neurological',
    examComponent: 'Mental Status',
    normalFinding:
      'Alert and oriented x4 (person, place, time, situation). Appropriate affect. Normal speech.',
    technique:
      'Observe during interview. Ask orientation questions. Assess attention, memory, language.',
    abnormalVariations: ['Confusion', 'Delirium', 'Aphasia', 'Dysarthria'],
    clinicalPearls: [
      'Document A&Ox3 vs A&Ox4',
      'Mini-mental status exam (MMSE) for formal assessment',
      'Acute change = delirium until proven otherwise',
    ],
  },
  {
    system: 'Neurological',
    examComponent: 'Cranial Nerves',
    normalFinding:
      'CN II-XII intact. Visual fields full. Extraocular movements intact. Face symmetric. Tongue midline.',
    technique: 'Systematic testing of each cranial nerve. Document any deficits.',
    abnormalVariations: [
      'CN III palsy (down and out, ptosis)',
      'CN VII palsy (facial droop)',
      'CN X palsy (uvular deviation)',
      'CN XII palsy (tongue deviation)',
    ],
    clinicalPearls: [
      'UMN vs LMN facial weakness: forehead sparing = UMN (stroke)',
      'Horner syndrome: ptosis, miosis, anhidrosis',
    ],
  },
  {
    system: 'Neurological',
    examComponent: 'Motor Strength',
    normalFinding:
      '5/5 strength in all extremities. No pronator drift. No atrophy or fasciculations.',
    technique: 'Test major muscle groups. Grade 0-5. Compare sides. Check for drift.',
    abnormalVariations: [
      'Weakness (UMN or LMN)',
      'Pronator drift (subtle UMN lesion)',
      'Atrophy (LMN, disuse)',
      'Fasciculations (ALS)',
    ],
    clinicalPearls: [
      'Pronator drift is sensitive for subtle weakness',
      'UMN: spastic, hyperreflexic',
      'LMN: flaccid, hyporeflexic',
    ],
  },
  {
    system: 'Neurological',
    examComponent: 'Deep Tendon Reflexes',
    normalFinding:
      '2+ and symmetric at biceps, triceps, brachioradialis, patellar, and Achilles. Plantar response downgoing.',
    technique: 'Strike tendon with reflex hammer. Grade 0-4+. Compare sides. Check Babinski.',
    abnormalVariations: [
      'Hyperreflexia (UMN lesion)',
      'Hyporeflexia (LMN, neuropathy)',
      'Clonus (UMN)',
      'Babinski positive (UMN)',
    ],
    clinicalPearls: [
      'Babinski: upgoing toe + fanning = UMN lesion',
      'Absent ankle jerks common in elderly, DM',
      'Crossed adductor reflex = spread',
    ],
  },
  {
    system: 'Neurological',
    examComponent: 'Sensation',
    normalFinding:
      'Intact to light touch, pinprick, temperature, vibration, and proprioception in all dermatomes.',
    technique:
      'Test light touch with cotton. Pinprick with pin. Vibration with tuning fork. Compare sides.',
    abnormalVariations: [
      'Dermatomal loss (radiculopathy)',
      'Stocking-glove (neuropathy)',
      'Sensory level (spinal cord)',
      'Hemisensory loss (stroke)',
    ],
    clinicalPearls: [
      'Stocking-glove = peripheral neuropathy (DM)',
      'Sensory level = spinal cord pathology',
      'Crossed sensory/motor = brainstem',
    ],
  },
  {
    system: 'Neurological',
    examComponent: 'Cerebellar Function',
    normalFinding:
      'Finger-to-nose and heel-to-shin accurate. No dysmetria, dysdiadochokinesia, or ataxia. Romberg negative.',
    technique:
      'Finger-to-nose with eyes open and closed. Rapid alternating movements. Gait and tandem walk.',
    abnormalVariations: [
      'Dysmetria (past-pointing)',
      'Intention tremor',
      'Ataxia',
      'Positive Romberg',
    ],
    clinicalPearls: [
      'Cerebellar lesion: ipsilateral signs',
      'Romberg tests proprioception, not cerebellar function',
      'Cerebellar ataxia: wide-based gait',
    ],
  },

  // Musculoskeletal
  {
    system: 'Musculoskeletal',
    examComponent: 'Spine',
    normalFinding:
      'Normal cervical lordosis, thoracic kyphosis, lumbar lordosis. No tenderness. Full ROM.',
    technique: 'Inspect curvature. Palpate spinous processes. Test flexion, extension, rotation.',
    abnormalVariations: ['Scoliosis', 'Kyphosis', 'Lordosis', 'Point tenderness'],
    clinicalPearls: [
      'Straight leg raise for lumbar radiculopathy',
      'FABER test for hip/SI joint',
      'Spurling test for cervical radiculopathy',
    ],
  },
  {
    system: 'Musculoskeletal',
    examComponent: 'Joint Exam',
    normalFinding:
      'No swelling, erythema, warmth, or deformity. Full ROM. No crepitus. Stable to stress testing.',
    technique: 'Inspect, palpate, range of motion (active then passive), special tests.',
    abnormalVariations: [
      'Effusion',
      'Warmth (inflammation)',
      'Crepitus (OA)',
      'Instability',
      'Limited ROM',
    ],
    clinicalPearls: [
      'Swelling + warmth + erythema = inflammatory',
      'Mechanical pain worse with activity',
      'Inflammatory pain worse in AM with stiffness',
    ],
  },

  // Skin
  {
    system: 'Skin',
    examComponent: 'General Skin Exam',
    normalFinding: 'Warm, dry, intact. Good turgor. No rashes, lesions, or discoloration.',
    technique:
      'Full body inspection in good lighting. Check turgor on sternum or forehead (elderly).',
    abnormalVariations: ['Jaundice', 'Pallor', 'Cyanosis', 'Mottling', 'Petechiae', 'Rash'],
    clinicalPearls: [
      'Tenting in elderly may be normal - check forehead/sternum',
      'Jaundice visible at bilirubin >2.5',
      'Central cyanosis: hypoxemia',
    ],
  },
  {
    system: 'Skin',
    examComponent: 'Nail Exam',
    normalFinding:
      "Pink nail beds. No clubbing, splinter hemorrhages, or Beau's lines. Capillary refill <2 sec.",
    technique: 'Inspect all nails. Check angle at nail bed. Press for capillary refill.',
    abnormalVariations: [
      'Clubbing (cardiopulmonary disease)',
      'Splinter hemorrhages (endocarditis)',
      'Koilonychia (iron deficiency)',
      'Terry nails (cirrhosis)',
    ],
    clinicalPearls: [
      'Schamroth sign: loss of diamond-shaped window = clubbing',
      "Beau's lines indicate previous systemic illness",
    ],
  },
];

// =============================================================================
// MAIN SEEDING FUNCTION
// =============================================================================
async function seedVitalSigns(): Promise<void> {
  console.log('💓 Seeding Normal Vital Signs...\n');

  let created = 0;
  let updated = 0;

  for (const vital of vitalSigns) {
    const existing = await prisma.normalVitalSign.findFirst({
      where: {
        vitalName: vital.vitalName,
        sex: vital.sex || null,
        ageGroup: vital.ageGroup || null,
        context: vital.context || null,
      },
    });

    const data = {
      vitalName: vital.vitalName,
      normalRangeLow: vital.normalRangeLow,
      normalRangeHigh: vital.normalRangeHigh,
      units: vital.units,
      sex: vital.sex,
      ageGroup: vital.ageGroup,
      ageRangeLow: vital.ageRangeLow,
      ageRangeHigh: vital.ageRangeHigh,
      context: vital.context,
      clinicalNotes: vital.clinicalNotes,
      abnormalIndicates: vital.abnormalIndicates || [],
    };

    if (existing) {
      await prisma.normalVitalSign.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.normalVitalSign.create({ data });
      created++;
    }

    console.log(
      `  ✅ ${vital.vitalName} (${vital.ageGroup || 'all'}, ${vital.context || 'default'})`
    );
  }

  console.log(`\n   Created: ${created}, Updated: ${updated}`);
}

async function seedPhysicalExamFindings(): Promise<void> {
  console.log('\n🩺 Seeding Normal Physical Exam Findings...\n');

  let created = 0;
  let updated = 0;

  for (const finding of peFindings) {
    const existing = await prisma.normalPhysicalExamFinding.findFirst({
      where: {
        system: finding.system,
        examComponent: finding.examComponent,
        ageGroup: finding.ageGroup || null,
      },
    });

    const data = {
      system: finding.system,
      examComponent: finding.examComponent,
      normalFinding: finding.normalFinding,
      technique: finding.technique,
      ageGroup: finding.ageGroup,
      abnormalVariations: finding.abnormalVariations || [],
      clinicalPearls: finding.clinicalPearls || [],
    };

    if (existing) {
      await prisma.normalPhysicalExamFinding.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.normalPhysicalExamFinding.create({ data });
      created++;
    }

    console.log(`  ✅ ${finding.system} - ${finding.examComponent}`);
  }

  console.log(`\n   Created: ${created}, Updated: ${updated}`);
}

async function main(): Promise<void> {
  try {
    await seedVitalSigns();
    await seedPhysicalExamFindings();

    // Summary
    const vitalCount = await prisma.normalVitalSign.count();
    const peCount = await prisma.normalPhysicalExamFinding.count();

    console.log('\n📊 Final Counts:');
    console.log(`   Vital Signs: ${vitalCount}`);
    console.log(`   Physical Exam Findings: ${peCount}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
