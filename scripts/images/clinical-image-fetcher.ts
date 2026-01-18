/**
 * Clinical Image Acquisition Script
 *
 * Fetches pathognomonic clinical images for photo drill modes using ImageSorcery API.
 *
 * Categories:
 * - ECG strips (pathognomonic rhythms)
 * - ECG 12-leads
 * - X-rays (chest, MSK, abdominal)
 * - CT scans
 * - MRI images
 * - Dermatology lesions
 * - Physical exam findings (pathognomonic signs)
 *
 * Usage:
 *   IMAGESORCERY_API_KEY=xxx npm run images:fetch
 *   IMAGESORCERY_API_KEY=xxx npm run images:fetch -- --category=ecg
 *   IMAGESORCERY_API_KEY=xxx npm run images:fetch -- --dry-run
 *
 * @see https://imagesorcery.ai/docs (update with actual docs URL)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const IMAGESORCERY_API_KEY = process.env.IMAGESORCERY_API_KEY;
const IMAGESORCERY_BASE_URL = process.env.IMAGESORCERY_BASE_URL || 'https://api.imagesorcery.ai/v1';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MEDIA_BUCKET = 'medical-images';
const BATCH_SIZE = 10;
const DELAY_MS = 1000; // Rate limiting

// ============================================================================
// TYPES
// ============================================================================

interface ImageSearchResult {
  id: string;
  url: string;
  title: string;
  description?: string;
  source?: string;
  license?: string;
  attribution?: string;
  tags?: string[];
  quality_score?: number;
}

interface ImageSorceryResponse {
  success: boolean;
  results: ImageSearchResult[];
  total: number;
  page: number;
  error?: string;
}

type ImageCategory = 'ecg' | 'ecg_12lead' | 'xray' | 'ct' | 'mri' | 'derm' | 'physical_exam';

interface VisualCondition {
  name: string;
  category: ImageCategory;
  searchTerms: string[];
  correctDiagnosis: string;
  distractors: string[];
  clinicalContext?: string;
  system?: string;
}

// ============================================================================
// VISUAL CONDITIONS DATABASE
// Comprehensive list of conditions with pathognomonic visual findings
// ============================================================================

const VISUAL_CONDITIONS: VisualCondition[] = [
  // =========== ECG STRIPS ===========
  {
    name: 'Atrial Fibrillation',
    category: 'ecg',
    searchTerms: ['atrial fibrillation ECG', 'afib rhythm strip', 'irregular irregular rhythm ECG'],
    correctDiagnosis: 'Atrial Fibrillation',
    distractors: ['Atrial Flutter', 'Multifocal Atrial Tachycardia', 'Sinus Arrhythmia'],
    clinicalContext: 'Irregularly irregular rhythm without discernible P waves',
  },
  {
    name: 'Atrial Flutter',
    category: 'ecg',
    searchTerms: ['atrial flutter ECG', 'sawtooth pattern ECG', 'flutter waves'],
    correctDiagnosis: 'Atrial Flutter',
    distractors: ['Atrial Fibrillation', 'SVT', 'Sinus Tachycardia'],
    clinicalContext: 'Classic sawtooth flutter waves at ~300 bpm with variable block',
  },
  {
    name: 'Ventricular Tachycardia',
    category: 'ecg',
    searchTerms: [
      'ventricular tachycardia ECG',
      'VT rhythm strip',
      'wide complex tachycardia monomorphic',
    ],
    correctDiagnosis: 'Ventricular Tachycardia',
    distractors: ['SVT with Aberrancy', 'Torsades de Pointes', 'Ventricular Fibrillation'],
    clinicalContext: 'Wide complex tachycardia with AV dissociation',
  },
  {
    name: 'Ventricular Fibrillation',
    category: 'ecg',
    searchTerms: ['ventricular fibrillation ECG', 'vfib rhythm strip', 'chaotic rhythm ECG'],
    correctDiagnosis: 'Ventricular Fibrillation',
    distractors: ['Ventricular Tachycardia', 'Artifact', 'Asystole'],
    clinicalContext: 'Chaotic, disorganized electrical activity - pulseless arrest',
  },
  {
    name: 'Torsades de Pointes',
    category: 'ecg',
    searchTerms: ['torsades de pointes ECG', 'polymorphic VT', 'twisting QRS'],
    correctDiagnosis: 'Torsades de Pointes',
    distractors: ['Ventricular Fibrillation', 'Monomorphic VT', 'Atrial Fibrillation with WPW'],
    clinicalContext: 'Polymorphic VT with QRS complexes that twist around baseline',
  },
  {
    name: 'Complete Heart Block',
    category: 'ecg',
    searchTerms: ['third degree heart block ECG', 'complete heart block', 'AV dissociation ECG'],
    correctDiagnosis: 'Third Degree Heart Block',
    distractors: ['Second Degree Type II', 'Mobitz Type I', 'Sinus Bradycardia'],
    clinicalContext: 'Complete AV dissociation - P waves march through QRS at independent rate',
  },
  {
    name: 'Mobitz Type I',
    category: 'ecg',
    searchTerms: ['Wenckebach ECG', 'Mobitz Type I', 'progressive PR prolongation'],
    correctDiagnosis: 'Second Degree AV Block Type I (Wenckebach)',
    distractors: ['Mobitz Type II', 'First Degree AV Block', 'Complete Heart Block'],
    clinicalContext: 'Progressive PR prolongation until dropped QRS',
  },
  {
    name: 'Mobitz Type II',
    category: 'ecg',
    searchTerms: ['Mobitz Type II ECG', 'second degree type 2', 'sudden dropped beats ECG'],
    correctDiagnosis: 'Second Degree AV Block Type II',
    distractors: ['Mobitz Type I', 'Complete Heart Block', 'Sinus Pause'],
    clinicalContext: 'Fixed PR interval with sudden dropped QRS - infranodal block',
  },
  {
    name: 'Wolff-Parkinson-White',
    category: 'ecg',
    searchTerms: ['WPW ECG', 'delta wave ECG', 'Wolff Parkinson White pre-excitation'],
    correctDiagnosis: 'Wolff-Parkinson-White Syndrome',
    distractors: ['Bundle Branch Block', 'Ventricular Paced Rhythm', 'LVH'],
    clinicalContext: 'Short PR interval, delta wave, widened QRS',
  },
  {
    name: 'STEMI Anterior',
    category: 'ecg_12lead',
    searchTerms: ['anterior STEMI ECG', 'ST elevation V1-V4', 'LAD occlusion ECG'],
    correctDiagnosis: 'Anterior STEMI',
    distractors: ['Pericarditis', 'LVH with Strain', 'Early Repolarization'],
    clinicalContext: 'ST elevation in V1-V4, reciprocal changes in inferior leads',
  },
  {
    name: 'STEMI Inferior',
    category: 'ecg_12lead',
    searchTerms: ['inferior STEMI ECG', 'ST elevation II III aVF', 'RCA occlusion ECG'],
    correctDiagnosis: 'Inferior STEMI',
    distractors: ['Pericarditis', 'Pulmonary Embolism', 'Early Repolarization'],
    clinicalContext: 'ST elevation in II, III, aVF with reciprocal changes in aVL',
  },
  {
    name: 'Pericarditis',
    category: 'ecg_12lead',
    searchTerms: ['pericarditis ECG', 'diffuse ST elevation', 'PR depression ECG'],
    correctDiagnosis: 'Acute Pericarditis',
    distractors: ['STEMI', 'Early Repolarization', 'Myocarditis'],
    clinicalContext: 'Diffuse ST elevation with PR depression, Spodick sign',
  },
  {
    name: 'Pulmonary Embolism',
    category: 'ecg_12lead',
    searchTerms: ['pulmonary embolism ECG', 'S1Q3T3 pattern', 'right heart strain ECG'],
    correctDiagnosis: 'Pulmonary Embolism',
    distractors: ['Right Bundle Branch Block', 'Inferior STEMI', 'RVH'],
    clinicalContext: 'S1Q3T3 pattern, right heart strain, sinus tachycardia',
  },
  {
    name: 'Hyperkalemia',
    category: 'ecg',
    searchTerms: ['hyperkalemia ECG', 'peaked T waves', 'sine wave ECG'],
    correctDiagnosis: 'Hyperkalemia',
    distractors: ['Acute MI', 'Hypercalcemia', 'Normal Variant'],
    clinicalContext: 'Peaked T waves, widened QRS, flattened P waves',
  },
  {
    name: 'Hypokalemia',
    category: 'ecg',
    searchTerms: ['hypokalemia ECG', 'U waves', 'flattened T waves hypokalemia'],
    correctDiagnosis: 'Hypokalemia',
    distractors: ['Hyperkalemia', 'Digoxin Effect', 'Hypocalcemia'],
    clinicalContext: 'Flattened T waves, prominent U waves, prolonged QT',
  },
  {
    name: 'Long QT Syndrome',
    category: 'ecg',
    searchTerms: ['long QT ECG', 'prolonged QTc', 'QT prolongation'],
    correctDiagnosis: 'Long QT Syndrome',
    distractors: ['Hypocalcemia', 'Hypokalemia', 'Normal Variant'],
    clinicalContext: 'Corrected QT interval >500ms',
  },
  {
    name: 'Left Bundle Branch Block',
    category: 'ecg',
    searchTerms: ['LBBB ECG', 'left bundle branch block', 'WiLLiaM pattern'],
    correctDiagnosis: 'Left Bundle Branch Block',
    distractors: ['Right Bundle Branch Block', 'WPW', 'Ventricular Paced Rhythm'],
    clinicalContext: 'QRS >120ms, broad R in I/aVL/V5-V6, no septal Q waves',
  },
  {
    name: 'Right Bundle Branch Block',
    category: 'ecg',
    searchTerms: ['RBBB ECG', 'right bundle branch block', 'MaRRoW pattern'],
    correctDiagnosis: 'Right Bundle Branch Block',
    distractors: ['Left Bundle Branch Block', 'WPW', 'RVH'],
    clinicalContext: "QRS >120ms, RSR' in V1-V2, wide S in I/V6",
  },

  // =========== CHEST X-RAYS ===========
  {
    name: 'Pneumothorax',
    category: 'xray',
    searchTerms: ['pneumothorax chest xray', 'collapsed lung xray', 'visceral pleural line'],
    correctDiagnosis: 'Pneumothorax',
    distractors: ['Skin Fold Artifact', 'Bullous Emphysema', 'Pneumomediastinum'],
    clinicalContext: 'Visceral pleural line with absent lung markings peripherally',
  },
  {
    name: 'Tension Pneumothorax',
    category: 'xray',
    searchTerms: ['tension pneumothorax xray', 'mediastinal shift', 'tracheal deviation xray'],
    correctDiagnosis: 'Tension Pneumothorax',
    distractors: ['Simple Pneumothorax', 'Large Pleural Effusion', 'Atelectasis'],
    clinicalContext: 'Pneumothorax with mediastinal shift to contralateral side',
  },
  {
    name: 'Pleural Effusion',
    category: 'xray',
    searchTerms: ['pleural effusion chest xray', 'blunted costophrenic angle', 'meniscus sign'],
    correctDiagnosis: 'Pleural Effusion',
    distractors: ['Consolidation', 'Atelectasis', 'Elevated Hemidiaphragm'],
    clinicalContext: 'Blunted costophrenic angle with meniscus sign',
  },
  {
    name: 'Lobar Pneumonia',
    category: 'xray',
    searchTerms: ['lobar pneumonia chest xray', 'consolidation air bronchograms', 'lobar opacity'],
    correctDiagnosis: 'Lobar Pneumonia',
    distractors: ['Lung Cancer', 'Atelectasis', 'Pulmonary Edema'],
    clinicalContext: 'Dense lobar consolidation with air bronchograms',
  },
  {
    name: 'Pulmonary Edema',
    category: 'xray',
    searchTerms: ['pulmonary edema chest xray', 'bat wing infiltrates', 'cardiogenic edema'],
    correctDiagnosis: 'Pulmonary Edema',
    distractors: ['Bilateral Pneumonia', 'ARDS', 'Interstitial Lung Disease'],
    clinicalContext: 'Bat wing perihilar infiltrates, Kerley B lines, cardiomegaly',
  },
  {
    name: 'Cardiomegaly',
    category: 'xray',
    searchTerms: ['cardiomegaly chest xray', 'enlarged heart xray', 'cardiothoracic ratio'],
    correctDiagnosis: 'Cardiomegaly',
    distractors: ['Pericardial Effusion', 'Normal Variant', 'Mediastinal Mass'],
    clinicalContext: 'Cardiothoracic ratio >0.5 on PA film',
  },
  {
    name: 'Tuberculosis',
    category: 'xray',
    searchTerms: ['tuberculosis chest xray', 'TB cavitation', 'apical infiltrate TB'],
    correctDiagnosis: 'Pulmonary Tuberculosis',
    distractors: ['Lung Cancer', 'Pneumonia', 'Sarcoidosis'],
    clinicalContext: 'Upper lobe cavitary lesion, Ghon complex, miliary pattern',
  },
  {
    name: 'Sarcoidosis',
    category: 'xray',
    searchTerms: ['sarcoidosis chest xray', 'bilateral hilar lymphadenopathy', 'BHL xray'],
    correctDiagnosis: 'Sarcoidosis',
    distractors: ['Lymphoma', 'Tuberculosis', 'Metastatic Disease'],
    clinicalContext: 'Bilateral hilar lymphadenopathy, interstitial infiltrates',
  },
  {
    name: 'COPD/Emphysema',
    category: 'xray',
    searchTerms: ['emphysema chest xray', 'hyperinflated lungs', 'flattened diaphragms COPD'],
    correctDiagnosis: 'COPD/Emphysema',
    distractors: ['Asthma', 'Normal Variant', 'Pneumothorax'],
    clinicalContext: 'Hyperinflated lungs, flattened diaphragms, increased AP diameter',
  },

  // =========== MUSCULOSKELETAL X-RAYS ===========
  {
    name: 'Colles Fracture',
    category: 'xray',
    searchTerms: ['Colles fracture xray', 'distal radius fracture dinner fork', 'FOOSH fracture'],
    correctDiagnosis: 'Colles Fracture',
    distractors: ['Smith Fracture', 'Barton Fracture', 'Chauffeur Fracture'],
    clinicalContext: 'Distal radius fracture with dorsal angulation - dinner fork deformity',
  },
  {
    name: 'Smith Fracture',
    category: 'xray',
    searchTerms: ['Smith fracture xray', 'reverse Colles', 'volar angulated distal radius'],
    correctDiagnosis: 'Smith Fracture',
    distractors: ['Colles Fracture', 'Barton Fracture', 'Scaphoid Fracture'],
    clinicalContext: 'Distal radius fracture with volar angulation - garden spade deformity',
  },
  {
    name: "Boxer's Fracture",
    category: 'xray',
    searchTerms: ['boxers fracture xray', '5th metacarpal fracture', 'metacarpal neck fracture'],
    correctDiagnosis: "Boxer's Fracture",
    distractors: ['Bennett Fracture', 'Metacarpal Shaft Fracture', "Gamekeeper's Thumb"],
    clinicalContext: 'Fracture of 5th metacarpal neck with volar angulation',
  },
  {
    name: 'Hip Fracture',
    category: 'xray',
    searchTerms: ['hip fracture xray', 'femoral neck fracture', 'intertrochanteric fracture xray'],
    correctDiagnosis: 'Hip Fracture',
    distractors: ['Hip Dislocation', 'Avascular Necrosis', 'Pathologic Fracture'],
    clinicalContext: 'Femoral neck or intertrochanteric fracture, shortened/externally rotated leg',
  },
  {
    name: 'Scaphoid Fracture',
    category: 'xray',
    searchTerms: ['scaphoid fracture xray', 'navicular fracture', 'snuffbox tenderness xray'],
    correctDiagnosis: 'Scaphoid Fracture',
    distractors: ['Triquetrum Fracture', 'Distal Radius Fracture', 'Lunate Fracture'],
    clinicalContext: 'Fracture through scaphoid waist - risk of AVN',
  },
  {
    name: 'Jefferson Fracture',
    category: 'xray',
    searchTerms: ['Jefferson fracture xray', 'C1 burst fracture', 'atlas fracture'],
    correctDiagnosis: 'Jefferson Fracture',
    distractors: ["Hangman's Fracture", 'Odontoid Fracture', "Clay Shoveler's Fracture"],
    clinicalContext: 'C1 burst fracture - lateral mass offset on open mouth view',
  },
  {
    name: "Hangman's Fracture",
    category: 'xray',
    searchTerms: ['hangmans fracture xray', 'C2 pars fracture', 'traumatic spondylolisthesis C2'],
    correctDiagnosis: "Hangman's Fracture",
    distractors: ['Jefferson Fracture', 'Odontoid Fracture', 'C3 Fracture'],
    clinicalContext: 'Bilateral C2 pars interarticularis fractures',
  },

  // =========== CT IMAGING ===========
  {
    name: 'Acute Appendicitis',
    category: 'ct',
    searchTerms: ['appendicitis CT', 'dilated appendix CT', 'periappendiceal fat stranding'],
    correctDiagnosis: 'Acute Appendicitis',
    distractors: ['Mesenteric Adenitis', 'Ovarian Cyst', "Crohn's Disease"],
    clinicalContext: 'Dilated appendix >6mm, periappendiceal fat stranding, appendicolith',
  },
  {
    name: 'Bowel Obstruction',
    category: 'ct',
    searchTerms: ['small bowel obstruction CT', 'dilated loops CT', 'transition point SBO'],
    correctDiagnosis: 'Small Bowel Obstruction',
    distractors: ['Ileus', 'Large Bowel Obstruction', 'Gastric Outlet Obstruction'],
    clinicalContext: 'Dilated proximal loops >3cm, decompressed distal bowel, transition point',
  },
  {
    name: 'Acute Pancreatitis',
    category: 'ct',
    searchTerms: ['pancreatitis CT', 'pancreatic inflammation CT', 'peripancreatic stranding'],
    correctDiagnosis: 'Acute Pancreatitis',
    distractors: ['Pancreatic Cancer', 'Pancreatic Pseudocyst', 'Cholecystitis'],
    clinicalContext: 'Pancreatic edema, peripancreatic fat stranding, fluid collections',
  },
  {
    name: 'Pulmonary Embolism CT',
    category: 'ct',
    searchTerms: ['pulmonary embolism CT', 'PE CTPA', 'filling defect pulmonary artery'],
    correctDiagnosis: 'Pulmonary Embolism',
    distractors: ['Artifact', 'Mucus Plug', 'Lymphadenopathy'],
    clinicalContext: 'Filling defect in pulmonary artery on contrast-enhanced CT',
  },
  {
    name: 'Aortic Dissection',
    category: 'ct',
    searchTerms: ['aortic dissection CT', 'intimal flap CT', 'Stanford type A dissection'],
    correctDiagnosis: 'Aortic Dissection',
    distractors: ['Aortic Aneurysm', 'Intramural Hematoma', 'Artifact'],
    clinicalContext: 'Intimal flap separating true and false lumens',
  },
  {
    name: 'Epidural Hematoma',
    category: 'ct',
    searchTerms: ['epidural hematoma CT', 'biconvex lens hemorrhage', 'EDH head CT'],
    correctDiagnosis: 'Epidural Hematoma',
    distractors: ['Subdural Hematoma', 'Subarachnoid Hemorrhage', 'Intracerebral Hemorrhage'],
    clinicalContext: 'Biconvex (lentiform) hyperdensity that does not cross suture lines',
  },
  {
    name: 'Subdural Hematoma',
    category: 'ct',
    searchTerms: ['subdural hematoma CT', 'crescent shaped hemorrhage', 'SDH head CT'],
    correctDiagnosis: 'Subdural Hematoma',
    distractors: ['Epidural Hematoma', 'Subarachnoid Hemorrhage', 'Chronic SDH'],
    clinicalContext: 'Crescent-shaped collection that crosses suture lines',
  },
  {
    name: 'Subarachnoid Hemorrhage',
    category: 'ct',
    searchTerms: ['subarachnoid hemorrhage CT', 'SAH CT head', 'blood in cisterns'],
    correctDiagnosis: 'Subarachnoid Hemorrhage',
    distractors: ['Subdural Hematoma', 'Epidural Hematoma', 'Artifact'],
    clinicalContext: 'Hyperdensity in basal cisterns and sulci',
  },
  {
    name: 'Ischemic Stroke',
    category: 'ct',
    searchTerms: ['ischemic stroke CT', 'hypodense MCA territory', 'acute infarct CT'],
    correctDiagnosis: 'Acute Ischemic Stroke',
    distractors: ['Hemorrhagic Stroke', 'Brain Tumor', 'Encephalitis'],
    clinicalContext: 'Hypodense region in vascular territory, loss of grey-white differentiation',
  },
  {
    name: 'Hemorrhagic Stroke',
    category: 'ct',
    searchTerms: ['hemorrhagic stroke CT', 'intracerebral hemorrhage', 'ICH head CT'],
    correctDiagnosis: 'Hemorrhagic Stroke',
    distractors: ['Ischemic Stroke', 'Brain Tumor', 'Contusion'],
    clinicalContext: 'Hyperdense intraparenchymal collection with surrounding edema',
  },

  // =========== MRI ===========
  {
    name: 'Multiple Sclerosis',
    category: 'mri',
    searchTerms: ['multiple sclerosis MRI', 'periventricular lesions MS', 'Dawson fingers MRI'],
    correctDiagnosis: 'Multiple Sclerosis',
    distractors: ['Small Vessel Disease', 'ADEM', 'NMO'],
    clinicalContext:
      'Periventricular white matter lesions perpendicular to ventricles (Dawson fingers)',
  },
  {
    name: 'ACL Tear',
    category: 'mri',
    searchTerms: ['ACL tear MRI', 'anterior cruciate ligament rupture', 'ACL discontinuity'],
    correctDiagnosis: 'ACL Tear',
    distractors: ['PCL Tear', 'MCL Tear', 'Meniscal Tear'],
    clinicalContext: 'Discontinuous ACL fibers with abnormal signal on sagittal images',
  },
  {
    name: 'Meniscal Tear',
    category: 'mri',
    searchTerms: ['meniscal tear MRI', 'meniscus signal knee MRI', 'bucket handle tear'],
    correctDiagnosis: 'Meniscal Tear',
    distractors: ['ACL Tear', 'Articular Cartilage Injury', 'Bone Bruise'],
    clinicalContext: 'High signal extending to articular surface of meniscus',
  },
  {
    name: 'Disc Herniation',
    category: 'mri',
    searchTerms: ['disc herniation MRI', 'lumbar disc protrusion', 'HNP spine MRI'],
    correctDiagnosis: 'Disc Herniation',
    distractors: ['Disc Bulge', 'Spinal Stenosis', 'Disc Desiccation'],
    clinicalContext: 'Focal disc material extending beyond disc space, may compress nerve root',
  },
  {
    name: 'Spinal Stenosis',
    category: 'mri',
    searchTerms: ['spinal stenosis MRI', 'central canal narrowing', 'lumbar stenosis'],
    correctDiagnosis: 'Spinal Stenosis',
    distractors: ['Disc Herniation', 'Spondylolisthesis', 'Normal Variant'],
    clinicalContext: 'Narrowing of spinal canal with compression of thecal sac',
  },
  {
    name: 'Avascular Necrosis Hip',
    category: 'mri',
    searchTerms: ['avascular necrosis hip MRI', 'AVN femoral head', 'osteonecrosis MRI'],
    correctDiagnosis: 'Avascular Necrosis of Femoral Head',
    distractors: ['Osteoarthritis', 'Transient Osteoporosis', 'Stress Fracture'],
    clinicalContext: 'Double line sign on T2, subchondral changes in femoral head',
  },

  // =========== DERMATOLOGY ===========
  {
    name: 'Psoriasis',
    category: 'derm',
    searchTerms: ['psoriasis plaque', 'silvery scale psoriasis', 'extensor psoriasis'],
    correctDiagnosis: 'Psoriasis',
    distractors: ['Eczema', 'Seborrheic Dermatitis', 'Tinea Corporis'],
    clinicalContext: 'Well-demarcated erythematous plaques with silvery scale on extensors',
  },
  {
    name: 'Pityriasis Rosea',
    category: 'derm',
    searchTerms: ['pityriasis rosea', 'herald patch', 'christmas tree pattern rash'],
    correctDiagnosis: 'Pityriasis Rosea',
    distractors: ['Tinea Corporis', 'Secondary Syphilis', 'Psoriasis'],
    clinicalContext: 'Herald patch followed by christmas tree pattern distribution',
  },
  {
    name: 'Erythema Migrans',
    category: 'derm',
    searchTerms: ['erythema migrans', 'bulls eye rash', 'target lesion lyme'],
    correctDiagnosis: 'Erythema Migrans (Lyme Disease)',
    distractors: ['Tinea Corporis', 'Erythema Multiforme', 'Cellulitis'],
    clinicalContext: 'Expanding erythematous patch with central clearing - target/bullseye',
  },
  {
    name: 'Stevens-Johnson Syndrome',
    category: 'derm',
    searchTerms: ['Stevens Johnson syndrome', 'SJS skin', 'mucosal erosions SJS'],
    correctDiagnosis: 'Stevens-Johnson Syndrome',
    distractors: ['Erythema Multiforme', 'TEN', 'Drug Rash'],
    clinicalContext: 'Targetoid lesions with mucosal involvement, <10% BSA detachment',
  },
  {
    name: 'Herpes Zoster',
    category: 'derm',
    searchTerms: ['herpes zoster', 'shingles dermatomal', 'vesicular rash dermatomal'],
    correctDiagnosis: 'Herpes Zoster (Shingles)',
    distractors: ['Herpes Simplex', 'Contact Dermatitis', 'Impetigo'],
    clinicalContext: 'Painful vesicular eruption in dermatomal distribution',
  },
  {
    name: 'Impetigo',
    category: 'derm',
    searchTerms: ['impetigo honey crusted', 'bullous impetigo', 'staph impetigo'],
    correctDiagnosis: 'Impetigo',
    distractors: ['Herpes Simplex', 'Contact Dermatitis', 'Ecthyma'],
    clinicalContext: 'Honey-colored crusted lesions, highly contagious',
  },
  {
    name: 'Tinea Corporis',
    category: 'derm',
    searchTerms: ['tinea corporis', 'ringworm', 'annular scaly rash'],
    correctDiagnosis: 'Tinea Corporis (Ringworm)',
    distractors: ['Pityriasis Rosea', 'Psoriasis', 'Nummular Eczema'],
    clinicalContext: 'Annular erythematous plaque with raised scaly border and central clearing',
  },
  {
    name: 'Tinea Versicolor',
    category: 'derm',
    searchTerms: ['tinea versicolor', 'pityriasis versicolor', 'hypopigmented patches back'],
    correctDiagnosis: 'Tinea Versicolor',
    distractors: ['Vitiligo', 'Pityriasis Alba', 'Post-inflammatory Hypopigmentation'],
    clinicalContext: 'Hypo or hyperpigmented patches with fine scale on trunk',
  },
  {
    name: 'Basal Cell Carcinoma',
    category: 'derm',
    searchTerms: ['basal cell carcinoma', 'BCC pearly papule', 'rodent ulcer'],
    correctDiagnosis: 'Basal Cell Carcinoma',
    distractors: ['Squamous Cell Carcinoma', 'Melanoma', 'Sebaceous Hyperplasia'],
    clinicalContext: 'Pearly papule with telangiectasias and rolled borders',
  },
  {
    name: 'Squamous Cell Carcinoma',
    category: 'derm',
    searchTerms: ['squamous cell carcinoma skin', 'SCC keratotic', 'scaly nodule SCC'],
    correctDiagnosis: 'Squamous Cell Carcinoma',
    distractors: ['Basal Cell Carcinoma', 'Keratoacanthoma', 'Actinic Keratosis'],
    clinicalContext: 'Indurated keratotic papule or nodule, often ulcerated',
  },
  {
    name: 'Melanoma',
    category: 'derm',
    searchTerms: ['melanoma ABCDE', 'malignant melanoma', 'irregular pigmented lesion'],
    correctDiagnosis: 'Melanoma',
    distractors: ['Dysplastic Nevus', 'Seborrheic Keratosis', 'Lentigo'],
    clinicalContext:
      'Pigmented lesion with ABCDE features - asymmetry, border, color, diameter, evolution',
  },
  {
    name: 'Actinic Keratosis',
    category: 'derm',
    searchTerms: ['actinic keratosis', 'solar keratosis', 'rough scaly sun damage'],
    correctDiagnosis: 'Actinic Keratosis',
    distractors: ['Squamous Cell Carcinoma', 'Seborrheic Keratosis', 'Psoriasis'],
    clinicalContext: 'Rough, scaly patch on sun-exposed skin - precancerous',
  },
  {
    name: 'Seborrheic Keratosis',
    category: 'derm',
    searchTerms: ['seborrheic keratosis', 'stuck on appearance', 'waxy keratosis'],
    correctDiagnosis: 'Seborrheic Keratosis',
    distractors: ['Melanoma', 'Actinic Keratosis', 'Wart'],
    clinicalContext: 'Well-demarcated waxy/stuck-on appearing lesion',
  },
  {
    name: 'Vitiligo',
    category: 'derm',
    searchTerms: ['vitiligo', 'depigmented patches', 'autoimmune depigmentation'],
    correctDiagnosis: 'Vitiligo',
    distractors: ['Tinea Versicolor', 'Post-inflammatory Hypopigmentation', 'Pityriasis Alba'],
    clinicalContext: 'Complete depigmented patches with well-defined borders',
  },
  {
    name: 'Cafe au Lait Spots',
    category: 'derm',
    searchTerms: ['cafe au lait spots', 'NF1 skin findings', 'light brown macules'],
    correctDiagnosis: 'Café au Lait Spots (consider Neurofibromatosis)',
    distractors: ['Freckles', 'Post-inflammatory Hyperpigmentation', 'Melanocytic Nevus'],
    clinicalContext: 'Uniformly tan/light brown macules with smooth borders - >6 suggests NF1',
  },
  {
    name: 'Erythema Nodosum',
    category: 'derm',
    searchTerms: ['erythema nodosum', 'pretibial nodules', 'tender shin nodules'],
    correctDiagnosis: 'Erythema Nodosum',
    distractors: ['Cellulitis', 'Deep Vein Thrombosis', 'Panniculitis'],
    clinicalContext: 'Tender erythematous nodules on shins - panniculitis',
  },
  {
    name: 'Henoch-Schonlein Purpura',
    category: 'derm',
    searchTerms: ['HSP rash', 'palpable purpura buttocks', 'IgA vasculitis rash'],
    correctDiagnosis: 'Henoch-Schönlein Purpura (IgA Vasculitis)',
    distractors: ['Meningococcemia', 'Thrombocytopenia', 'Trauma'],
    clinicalContext: 'Palpable purpura on buttocks and lower extremities',
  },
  {
    name: 'Kawasaki Disease',
    category: 'derm',
    searchTerms: ['kawasaki rash', 'strawberry tongue kawasaki', 'desquamating fingertips'],
    correctDiagnosis: 'Kawasaki Disease',
    distractors: ['Scarlet Fever', 'Measles', 'Drug Reaction'],
    clinicalContext:
      'Polymorphous rash, strawberry tongue, conjunctival injection, desquamating fingertips',
  },
  {
    name: 'Scarlet Fever',
    category: 'derm',
    searchTerms: ['scarlet fever rash', 'sandpaper rash', 'pastia lines'],
    correctDiagnosis: 'Scarlet Fever',
    distractors: ['Kawasaki Disease', 'Drug Rash', 'Viral Exanthem'],
    clinicalContext: 'Sandpaper-textured rash, Pastia lines in skin folds, strawberry tongue',
  },

  // =========== PHYSICAL EXAM FINDINGS ===========
  {
    name: 'Kayser-Fleischer Rings',
    category: 'physical_exam',
    searchTerms: ['Kayser Fleischer rings', 'Wilson disease eyes', 'copper cornea'],
    correctDiagnosis: "Wilson's Disease",
    distractors: ['Arcus Senilis', 'Pterygium', 'Normal Variant'],
    clinicalContext: 'Golden-brown ring at corneal limbus from copper deposition',
  },
  {
    name: 'Janeway Lesions',
    category: 'physical_exam',
    searchTerms: ['Janeway lesions', 'endocarditis hands', 'painless palmar lesions'],
    correctDiagnosis: 'Infective Endocarditis',
    distractors: ['Osler Nodes', 'Palmar Erythema', 'Trauma'],
    clinicalContext: 'Painless erythematous lesions on palms/soles - septic emboli',
  },
  {
    name: 'Osler Nodes',
    category: 'physical_exam',
    searchTerms: ['Osler nodes', 'painful finger nodules endocarditis', 'tender fingertip lesions'],
    correctDiagnosis: 'Infective Endocarditis',
    distractors: ['Janeway Lesions', 'Herpetic Whitlow', 'Trauma'],
    clinicalContext: 'Painful erythematous nodules on fingers/toes - immune complex deposition',
  },
  {
    name: 'Splinter Hemorrhages',
    category: 'physical_exam',
    searchTerms: ['splinter hemorrhages', 'nail bed hemorrhage', 'linear nail hemorrhage'],
    correctDiagnosis: 'Splinter Hemorrhages (consider Endocarditis)',
    distractors: ['Trauma', 'Psoriasis', 'Normal Variant'],
    clinicalContext: 'Linear red-brown streaks in nail bed',
  },
  {
    name: 'Dupuytren Contracture',
    category: 'physical_exam',
    searchTerms: ['Dupuytren contracture', 'palmar fibromatosis', 'flexion contracture finger'],
    correctDiagnosis: 'Dupuytren Contracture',
    distractors: ['Trigger Finger', 'Camptodactyly', 'Arthritis'],
    clinicalContext: 'Flexion contracture of fingers due to palmar fascia thickening',
  },
  {
    name: 'Heberden Nodes',
    category: 'physical_exam',
    searchTerms: ['Heberden nodes', 'DIP joint nodules', 'osteoarthritis hands'],
    correctDiagnosis: 'Osteoarthritis',
    distractors: ['Rheumatoid Nodules', 'Gout Tophi', 'Bouchard Nodes'],
    clinicalContext: 'Bony enlargement of DIP joints',
  },
  {
    name: 'Bouchard Nodes',
    category: 'physical_exam',
    searchTerms: ['Bouchard nodes', 'PIP joint nodules', 'osteoarthritis PIP'],
    correctDiagnosis: 'Osteoarthritis',
    distractors: ['Heberden Nodes', 'Rheumatoid Arthritis', 'Gout'],
    clinicalContext: 'Bony enlargement of PIP joints',
  },
  {
    name: 'Swan Neck Deformity',
    category: 'physical_exam',
    searchTerms: [
      'swan neck deformity',
      'rheumatoid arthritis hands',
      'PIP hyperextension DIP flexion',
    ],
    correctDiagnosis: 'Rheumatoid Arthritis',
    distractors: ['Osteoarthritis', 'Psoriatic Arthritis', 'Trauma'],
    clinicalContext: 'PIP hyperextension with DIP flexion',
  },
  {
    name: 'Boutonniere Deformity',
    category: 'physical_exam',
    searchTerms: [
      'boutonniere deformity',
      'PIP flexion DIP hyperextension',
      'central slip rupture',
    ],
    correctDiagnosis: 'Boutonniere Deformity (Rheumatoid Arthritis or Trauma)',
    distractors: ['Swan Neck Deformity', 'Trigger Finger', 'Mallet Finger'],
    clinicalContext: 'PIP flexion with DIP hyperextension',
  },
  {
    name: 'Clubbing',
    category: 'physical_exam',
    searchTerms: ['digital clubbing', 'nail clubbing', 'Schamroth sign'],
    correctDiagnosis: 'Digital Clubbing',
    distractors: ['Normal Variant', 'Nail Dystrophy', 'Koilonychia'],
    clinicalContext:
      'Loss of nail bed angle, bulbous fingertips - pulmonary, cardiac, or GI disease',
  },
  {
    name: 'Xanthelasma',
    category: 'physical_exam',
    searchTerms: ['xanthelasma', 'yellow eyelid plaques', 'hyperlipidemia eyes'],
    correctDiagnosis: 'Xanthelasma (consider Hyperlipidemia)',
    distractors: ['Milia', 'Syringoma', 'Normal Variant'],
    clinicalContext: 'Yellow plaques on medial eyelids - lipid deposits',
  },
  {
    name: 'Exophthalmos',
    category: 'physical_exam',
    searchTerms: ['exophthalmos', 'proptosis Graves', 'thyroid eye disease'],
    correctDiagnosis: "Graves' Disease (Thyroid Eye Disease)",
    distractors: ['Orbital Tumor', 'Orbital Cellulitis', 'Normal Variant'],
    clinicalContext: 'Protrusion of eyeballs, lid retraction, lid lag',
  },
  {
    name: 'Lid Lag',
    category: 'physical_exam',
    searchTerms: ['lid lag hyperthyroidism', 'von Graefe sign', 'thyroid lid retraction'],
    correctDiagnosis: 'Hyperthyroidism',
    distractors: ['Myasthenia Gravis', 'Normal Variant', "Bell's Palsy"],
    clinicalContext: 'Upper lid lags behind globe on downward gaze',
  },
  {
    name: 'Asterixis',
    category: 'physical_exam',
    searchTerms: ['asterixis', 'flapping tremor', 'hepatic encephalopathy hands'],
    correctDiagnosis: 'Hepatic Encephalopathy (or Uremia, CO2 Retention)',
    distractors: ['Essential Tremor', 'Parkinson Tremor', 'Cerebellar Ataxia'],
    clinicalContext: 'Flapping tremor with wrist dorsiflexion - metabolic encephalopathy',
  },
  {
    name: 'Spider Angioma',
    category: 'physical_exam',
    searchTerms: [
      'spider angioma',
      'spider nevus liver disease',
      'telangiectasia central arteriole',
    ],
    correctDiagnosis: 'Spider Angioma (consider Liver Disease)',
    distractors: ['Cherry Angioma', 'Petechiae', 'Telangiectasia'],
    clinicalContext: 'Central arteriole with radiating vessels that blanch with pressure',
  },
  {
    name: 'Caput Medusae',
    category: 'physical_exam',
    searchTerms: ['caput medusae', 'portal hypertension abdomen', 'periumbilical veins'],
    correctDiagnosis: 'Portal Hypertension',
    distractors: ['IVC Obstruction', 'Normal Variant', 'Superficial Thrombophlebitis'],
    clinicalContext: 'Dilated periumbilical veins radiating from umbilicus',
  },
  {
    name: 'Cullen Sign',
    category: 'physical_exam',
    searchTerms: ['Cullen sign', 'periumbilical ecchymosis', 'hemorrhagic pancreatitis sign'],
    correctDiagnosis: 'Hemorrhagic Pancreatitis (or Ectopic Pregnancy)',
    distractors: ['Trauma', 'Grey Turner Sign', 'Normal Variant'],
    clinicalContext: 'Periumbilical ecchymosis from retroperitoneal hemorrhage',
  },
  {
    name: 'Grey Turner Sign',
    category: 'physical_exam',
    searchTerms: ['Grey Turner sign', 'flank ecchymosis', 'retroperitoneal hemorrhage'],
    correctDiagnosis: 'Hemorrhagic Pancreatitis (or Retroperitoneal Hemorrhage)',
    distractors: ['Trauma', 'Cullen Sign', 'Normal Variant'],
    clinicalContext: 'Flank ecchymosis from retroperitoneal hemorrhage',
  },
  {
    name: 'Chvostek Sign',
    category: 'physical_exam',
    searchTerms: ['Chvostek sign', 'hypocalcemia facial twitch', 'facial nerve tap'],
    correctDiagnosis: 'Hypocalcemia',
    distractors: ["Bell's Palsy", 'Normal Variant', 'Tetany'],
    clinicalContext: 'Facial muscle contraction when tapping over facial nerve',
  },
  {
    name: 'Trousseau Sign',
    category: 'physical_exam',
    searchTerms: ['Trousseau sign', 'hypocalcemia carpopedal spasm', 'BP cuff tetany'],
    correctDiagnosis: 'Hypocalcemia',
    distractors: ['Carpal Tunnel', 'Peripheral Neuropathy', 'Normal Variant'],
    clinicalContext: 'Carpopedal spasm when BP cuff inflated above systolic',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function mapCategoryToDbType(category: ImageCategory): string {
  const mapping: Record<ImageCategory, string> = {
    ecg: 'ecg',
    ecg_12lead: 'ecg',
    xray: 'radiology',
    ct: 'radiology',
    mri: 'radiology',
    derm: 'derm',
    physical_exam: 'derm',
  };
  return mapping[category] || 'other';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search ImageSorcery for clinical images
 * NOTE: Update this function with actual ImageSorcery API format
 */
async function searchImageSorcery(
  query: string,
  options: {
    limit?: number;
    category?: string;
  } = {}
): Promise<ImageSearchResult[]> {
  if (!IMAGESORCERY_API_KEY) {
    throw new Error('IMAGESORCERY_API_KEY not set');
  }

  const { limit = 5, category } = options;

  // Build request - UPDATE THIS WITH ACTUAL API FORMAT
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    // Add category/filter params as needed
    ...(category && { type: category }),
  });

  const response = await fetch(`${IMAGESORCERY_BASE_URL}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${IMAGESORCERY_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ImageSorcery API error: ${response.status} - ${error}`);
  }

  const data: ImageSorceryResponse = await response.json();

  if (!data.success) {
    throw new Error(`ImageSorcery error: ${data.error}`);
  }

  return data.results;
}

/**
 * Download image and upload to Supabase Storage
 */
async function downloadAndStoreImage(
  imageUrl: string,
  filename: string,
  folder: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase credentials not set');
  }

  try {
    // Download image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(`Failed to download: ${imageUrl}`);
      return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to Supabase Storage
    const storagePath = `${folder}/${filename}`;
    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: imageBuffer,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error(`Failed to upload to Supabase: ${error}`);
      return null;
    }

    // Return public URL
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;
  } catch (error) {
    console.error(`Error storing image: ${error}`);
    return null;
  }
}

// ============================================================================
// MAIN ACQUISITION FUNCTION
// ============================================================================

async function acquireImagesForCondition(
  prisma: PrismaClient,
  condition: VisualCondition,
  dryRun: boolean
): Promise<number> {
  console.log(`\n📸 Processing: ${condition.name}`);
  console.log(`   Category: ${condition.category}`);
  console.log(`   Search terms: ${condition.searchTerms[0]}`);

  let imagesAcquired = 0;

  for (const searchTerm of condition.searchTerms) {
    try {
      // Search for images
      const results = await searchImageSorcery(searchTerm, {
        limit: 3,
        category: condition.category,
      });

      if (results.length === 0) {
        console.log(`   ⚠️ No results for: "${searchTerm}"`);
        continue;
      }

      console.log(`   Found ${results.length} results for: "${searchTerm}"`);

      for (const result of results) {
        if (dryRun) {
          console.log(`   [DRY RUN] Would download: ${result.title}`);
          imagesAcquired++;
          continue;
        }

        // Generate filename
        const ext = result.url.split('.').pop()?.split('?')[0] || 'jpg';
        const sanitizedName = condition.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const filename = `${sanitizedName}_${Date.now()}.${ext}`;
        const folder = mapCategoryToDbType(condition.category);

        // Download and store
        const storedUrl = await downloadAndStoreImage(result.url, filename, folder);

        if (!storedUrl) {
          console.log(`   ❌ Failed to store: ${result.title}`);
          continue;
        }

        // Create MediaAsset record
        await prisma.mediaAsset.create({
          data: {
            id: generateId(),
            type: mapCategoryToDbType(condition.category),
            filename,
            originalUrl: storedUrl,
            tags: [condition.category, condition.name, ...(result.tags || [])],
            description: result.description || condition.clinicalContext,
            correctDiagnosis: condition.correctDiagnosis,
            distractors: condition.distractors,
            approvalStatus: 'pending',
            status: 'pending_review',
            folder: 'inbox',
            mediaType: 'image',
            isClinical: true,
            sourceUrl: result.url,
            citation: result.attribution,
            clinicalContext: {
              searchTerm,
              originalTitle: result.title,
              license: result.license,
              qualityScore: result.quality_score,
            },
            updatedAt: new Date(),
          },
        });

        console.log(`   ✅ Stored: ${filename}`);
        imagesAcquired++;

        // Rate limiting
        await delay(DELAY_MS);
      }

      // Don't search all terms if we got results from first one
      if (results.length >= 3) break;
    } catch (error) {
      console.error(`   ❌ Error searching "${searchTerm}":`, error);
    }
  }

  return imagesAcquired;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        🏥 CLINICAL IMAGE ACQUISITION - ImageSorcery            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Parse CLI args
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  // Validate environment
  if (!IMAGESORCERY_API_KEY) {
    console.error('\n❌ IMAGESORCERY_API_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  IMAGESORCERY_API_KEY=xxx npm run images:fetch');
    console.log('  IMAGESORCERY_API_KEY=xxx npm run images:fetch -- --dry-run');
    console.log('  IMAGESORCERY_API_KEY=xxx npm run images:fetch -- --category=ecg');
    console.log('  IMAGESORCERY_API_KEY=xxx npm run images:fetch -- --limit=10');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\n❌ Supabase credentials not set');
    console.log('  Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('\nConfiguration:');
  console.log(`  API URL: ${IMAGESORCERY_BASE_URL}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Category Filter: ${categoryArg || 'all'}`);
  console.log(`  Limit: ${limit || 'all conditions'}`);

  // Filter conditions if category specified
  let conditions = VISUAL_CONDITIONS;
  if (categoryArg) {
    conditions = conditions.filter(
      (c) => c.category === categoryArg || c.category.startsWith(categoryArg)
    );
    console.log(`\n  Filtered to ${conditions.length} conditions for category "${categoryArg}"`);
  }

  if (limit) {
    conditions = conditions.slice(0, limit);
    console.log(`  Limited to first ${limit} conditions`);
  }

  console.log(`\n📋 Processing ${conditions.length} visual conditions...\n`);

  const prisma = new PrismaClient();
  let totalImages = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      console.log(`\n[${i + 1}/${conditions.length}] ────────────────────────────────────`);

      try {
        const images = await acquireImagesForCondition(prisma, condition, dryRun);
        totalImages += images;
        if (images > 0) successCount++;
      } catch (error) {
        console.error(`❌ Error processing ${condition.name}:`, error);
        errorCount++;
      }

      // Batch delay
      if ((i + 1) % BATCH_SIZE === 0 && i < conditions.length - 1) {
        console.log(`\n⏳ Batch complete. Waiting ${DELAY_MS * 2}ms...`);
        await delay(DELAY_MS * 2);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         SUMMARY                                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`  Conditions processed: ${conditions.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Total images ${dryRun ? '(would be)' : ''} acquired: ${totalImages}`);

    if (!dryRun) {
      console.log('\n✅ Images stored in Supabase and MediaAsset records created.');
      console.log('   They are pending approval - use the Admin Media Dashboard to review.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
