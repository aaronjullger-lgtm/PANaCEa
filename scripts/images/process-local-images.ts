#!/usr/bin/env npx ts-node

/**
 * Process Local Images Script (Enhanced with AI Analysis)
 *
 * Processes PowerPoint-sourced images from local folders and uploads them to Supabase.
 * Features:
 * - AI-powered image analysis using Gemini Vision API
 * - Intelligent condition verification (checks if image matches expected diagnosis)
 * - Annotation detection (rejects images with visible labels/answers)
 * - Smart cropping suggestions to remove annotations
 * - Perceptual hash-based duplicate detection
 * - Filename-to-condition mapping with fallback to AI classification
 *
 * Usage: npm run images:local
 * Options:
 *   --dry-run     Preview what would be uploaded without making changes
 *   --skip-ai     Skip AI analysis (faster, uses filename matching only)
 *   --force       Upload even if AI detects annotations
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import {
  analyzeImage,
  DuplicateDetector,
  generatePerceptualHash,
  type ImageAnalysis,
} from './image-analyzer';
import { processForQuiz, isSharpAvailable } from './image-cropper';

config();

// Rate limiting helper - wait between API calls to avoid 429s
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_DELAY_MS = 2000; // 2s between Gemini API calls to avoid rate limiting

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
// Use direct database URL for pg client (not Prisma Accelerate)
const DATABASE_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !DATABASE_URL) {
  console.error('❌ Missing required environment variables');
  console.error('Need: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, DATABASE_URL');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Base path for local images
const BASE_PATH = '/Users/aaronullger/PANaCEa/DATA/DATA';

// Define image source folders - prioritize curated_images (better organized)
// MISC/good contains duplicates of curated_images - process curated first
// sorted_images contains 6,717 additional images from PowerPoint presentations
// ALL IMAGES contains the comprehensive collection from PowerPoint presentations
const IMAGE_SOURCES = [
  // Primary sources - curated and organized
  { folder: 'curated_images/ECG', category: 'ECG', priority: 1 },
  { folder: 'curated_images/DERM', category: 'DERM', priority: 1 },
  { folder: 'curated_images/RAD', category: 'RADIOLOGY', priority: 1 },
  // Secondary sources - may have duplicates but also unique content
  { folder: 'MISC/good/ECG', category: 'ECG', priority: 2 },
  { folder: 'MISC/good/DERM', category: 'DERM', priority: 2 },
  { folder: 'MISC/good/Radiology', category: 'RADIOLOGY', priority: 2 },
  { folder: 'MISC/good/Clinical', category: 'CLINICAL', priority: 2 },
  // Sorted images from PowerPoint presentations (6,717 total images)
  { folder: 'MISC/output/sorted_images/RAD', category: 'RADIOLOGY', priority: 3 },
  { folder: 'MISC/output/sorted_images/ECG', category: 'ECG', priority: 3 },
  { folder: 'MISC/output/sorted_images/DERM', category: 'DERM', priority: 3 },
  { folder: 'MISC/output/sorted_images/OTHER', category: 'CLINICAL', priority: 3 },
  // Comprehensive collection - highest volume, mixed categories
  { folder: 'ALL IMAGES', category: 'MIXED', priority: 4 },
];

// Filename to condition ID mapping
// Maps common patterns from PowerPoint filenames to database condition IDs
const FILENAME_TO_CONDITION_MAP: Record<string, string> = {
  // === REMAINING UNMAPPED (previously missed) ===
  Oral_Herpes_simplex: 'DERM__infectious_viral__herpes_simplex',
  Hemorrhagic_Stroke: 'NEURO__cerebrovascular__intracerebral_hemorrhage',
  Salter_Harris_Fractures: 'MSK__pediatric__salter_harris_fractures',
  'ForeignBodyBattery_Doubleringsign-Step-off': 'GI__esophagus__foreign_body_ingestion',
  Genu_Valgum: 'MSK__pediatric__genu_valgum',
  Genu_Varum: 'MSK__pediatric__genu_varum',
  Hydrocephalus_01: 'NEURO__pediatrics__hydrocephalus_pediatric',
  'Legg-Calve-Perthes_Flattenedfemoralhead': 'MSK__pediatrics__leggcalvperthes_disease',
  Pneumonia_Lobarconsolidation: 'PULM__infectious__communityacquired_pneumonia',
  'Salter-HarrisFractures_Physisfracture': 'MSK__pediatric__salter_harris_fractures',
  MethMouth_Severedentalcaries: 'PSYCH__substance_use__methamphetamine_use_disorder',
  SisterMaryJosephNodule_Umbilicalnodule: 'GI__oncology__metastatic_gi_cancer',

  // === ECG CONDITIONS ===
  Atrial_Fibrillation: 'CV__ecg__atrial_fibrillation',
  Atrial_Flutter: 'CV__ecg__atrial_flutter',
  Ventricular_Tachycardia: 'CV__ecg__ventricular_tachycardia',
  Ventricular_Fibrillation: 'CV__ecg__ventricular_fibrillation',
  Torsades_de_Pointes: 'CV__ecg__torsades_de_pointes',
  Normal_Sinus_Rhythm: 'CV__ecg__normal_sinus_rhythm_nsr',
  Sinus_Bradycardia: 'CV__ecg__sinus_bradycardia',
  Sinus_Tachycardia: 'CV__ecg__sinus_tachycardia',
  First_Degree_AV_Block: 'CV__conduction_disorders__first_degree_av_block',
  Second_Degree_AV_Block_Mobitz_I: 'CV__conduction_disorders__second_degree_av_block_mobitz_i',
  Second_Degree_AV_Block_Mobitz_II: 'CV__conduction_disorders__second_degree_av_block_mobitz_ii',
  Third_Degree_AV_Block: 'CV__conduction_disorders__third_degree_av_block',
  Wolff_Parkinson_White: 'CV__conduction_disorders__wolff_parkinson_white_syndrome',
  LBBB: 'CV__conduction_disorders__left_bundle_branch_block',
  RBBB: 'CV__conduction_disorders__right_bundle_branch_block',
  Brugada_Syndrome: 'CV__ecg__brugada_syndrome',
  Pericarditis: 'CV__carditis__pericarditis',
  Acute_Coronary_Syndrome__STEMI_: 'CV__ischemic_heart_disease__stemi',
  STEMI: 'CV__ischemic_heart_disease__stemi',
  Hypothermia: 'CV__environmental__hypothermia',

  // === DERMATOLOGY CONDITIONS ===
  Acanthosis_Nigricans: 'DERM__pigmentary__acanthosis_nigricans',
  Actinic_Keratosis: 'DERM__oncology__actinic_keratosis',
  Alopecia_Areata: 'DERM__hair_disorders__alopecia_areata',
  Basal_Cell_Carcinoma: 'DERM__oncology__basal_cell_carcinoma',
  Bullous_Pemphigoid: 'DERM__bullous__bullous_pemphigoid',
  Candidiasis: 'DERM__infectious_fungal__cutaneous_candidiasis',
  Dermatomyositis: 'DERM__connective_tissue__dermatomyositis',
  Erythema_Migrans:
    'DERM__infectious_bacterial_systemic_with_cutaneous_manifestations__erythema_migrans',
  Erythema_Multiforme: 'DERM__reactive__hypersensitivity__erythema_multiforme',
  Erythema_Nodosum: 'DERM__reactive__hypersensitivity__erythema_nodosum',
  Gout: 'MSK__arthritis__gout',
  Hand_Foot_Mouth: 'DERM__infectious_viral_childhood_exanthem__hand_foot_mouth_disease_hfmd',
  Hidradenitis_Suppurativa: 'DERM__inflammatory__hidradenitis_suppurativa',
  Impetigo: 'DERM__infectious_bacterial__impetigo',
  Kaposi_Sarcoma: 'DERM__oncology__kaposi_sarcoma',
  Lichen_Planus: 'DERM__papulosquamous__lichen_planus',
  Melanoma: 'DERM__oncology__melanoma',
  Nummular_dermatitis: 'DERM__dermatitis__eczema__nummular_dermatitis',
  Onychomycosis: 'DERM__nail_disorders__onychomycosis',
  Oral_Herpes_simplex_2: 'DERM__infectious_viral__herpes_simplex',
  Paronychia: 'DERM__nail_disorders__paronychia',
  Pemphigus_Vulgaris: 'DERM__bullous__pemphigus_vulgaris',
  Perioral_dermatitis: 'DERM__dermatitis__eczema__perioral_dermatitis',
  Periorbital_cellulitis: 'DERM__infectious_bacterial__periorbital_cellulitis_preseptal_cellulitis',
  Pityriasis_Rosea: 'DERM__papulosquamous__pityriasis_rosea',
  Prurigo_nodularis: 'DERM__dermatitis__eczema__prurigo_nodularis',
  Psoriasis: 'DERM__papulosquamous__plaque_psoriasis',
  Rosacea: 'DERM__acneiform__rosacea',
  SLE__Lupus_: 'DERM__connective_tissue__lupus__acute_cutaneous_lupus_erythematosus',
  Scabies: 'DERM__infectious__scabies',
  Scarlet_Fever: 'ID__bacterial__scarlet_fever',
  Seborrheic_Keratosis: 'DERM__benign_lesions__seborrheic_keratosis',
  Seborrheic_dermatitis: 'DERM__dermatitis__eczema__seborrheic_dermatitis',
  Shingles: 'DERM__infectious_viral__herpes_zoster_shingles',
  Squamous_Cell_Carcinoma: 'DERM__oncology__squamous_cell_carcinoma',
  Tinea_Corporis: 'DERM__infectious__tinea_corporis_ringworm',
  Tinea_Versicolor: 'DERM__infectious__tinea_versicolor',
  Vitiligo: 'DERM__pigmentary__vitiligo',
  Measles: 'ID__viral__measles',
  Chickenpox: 'ID__viral__varicella_chickenpox',

  // === RADIOLOGY CONDITIONS ===
  Achalasia: 'GI__esophagus__achalasia',
  Aortic_Dissection: 'CV__vascular_disease__aortic_dissection',
  Cholelithiasis: 'GI__gallbladder__cholelithiasis',
  Colles_Fracture: 'MSK__traumafracture__colles_fracture',
  Crohn_s_Disease: 'GI__colon__crohn_disease',
  Diverticulitis: 'GI__colon__diverticulitis',
  Epidural_Hematoma: 'NEURO__trauma__epidural_hematoma',
  Epiglottitis: 'PULM__upper_airway_emergency__acute_epiglottitis',
  Hemorrhagic_Stroke_v2: 'NEURO__vascular__hemorrhagic_stroke',
  Hodgkin_Lymphoma: 'HEME__lymphoma__hodgkin_lymphoma',
  Jones_Fracture: 'MSK__traumafracture__jones_fracture',
  Mastoiditis: 'HEENT__ear__middle__mastoiditis',
  Multiple_Myeloma: 'HEME__plasma_cell__multiple_myeloma',
  Nephrolithiasis: 'RENAL__stones__nephrolithiasis_general_evaluation',
  Orbital_Blowout_Fracture: 'HEENT__eye__orbit__blunt_ocular_trauma__globe_injury',
  Osteoarthritis: 'MSK__arthritis__osteoarthritis',
  Pancreatitis: 'GI__pancreas__acute_pancreatitis',
  Pneumothorax: 'PULM__pleural_disease__pneumothorax',
  Pulmonary_Edema: 'CV__heart_failure__leftsided_heart_failure',
  Radial_Head_Fracture: 'MSK__traumafracture__radial_head_fracture',
  Retinal_Detachment: 'HEENT__eye__retina__retinal_detachment',
  Rheumatoid_Arthritis: 'MSK__arthritis__rheumatoid_arthritis',
  Salter_Harris_Fractures_v2: 'MSK__pediatric__salter_harris_fractures',
  Sarcoidosis: 'PULM__interstitial__sarcoidosis',
  Sigmoid_Volvulus: 'GI__obstruction__sigmoid_volvulus',
  Small_Bowel_Obstruction: 'GI__small_bowel__small_bowel_obstruction',
  Thalassemia: 'HEME__hemoglobinopathy__beta_thalassemia',
  Tuberculosis: 'PULM__infectious__tuberculosis',
  Ulcerative_Colitis: 'GI__colon__ulcerative_colitis',

  // Additional Radiology from filename patterns
  Intussusception: 'GI__small_bowel__intussusception',
  Croup: 'HEENT__larynx__upper_airway__croup_laryngotracheobronchitis',
  Pneumonia: 'PULM__infectious__community_acquired_pneumonia',
  PleuralEffusion: 'PULM__pleural__pleural_effusion',
  Hydrocephalus: 'NEURO__pediatric__hydrocephalus',
  HipFracture: 'MSK__trauma__fractures__hip_fracture',
  BoxersFracture: 'MSK__trauma__fractures__boxers_fracture',

  // === CLINICAL/OPHTHALMOLOGY CONDITIONS ===
  Angle_Closure_Glaucoma: 'HEENT__eye__glaucoma__acute_angleclosure_glaucoma',
  'AcuteAngle-ClosureGlaucoma': 'HEENT__eye__glaucoma__acute_angleclosure_glaucoma',
  CRAO: 'HEENT__eye__retina__central_retinal_artery_occlusion_crao',
  CRVO: 'HEENT__eye__retina__central_retinal_vein_occlusion_crvo',
  Cataracts: 'HEENT__eye__lens__cataract',
  Corneal_Abrasion: 'HEENT__eye__cornea__anterior_segment__corneal_foreign_body',
  Dendritic_Keratitis: 'HEENT__eye__cornea__anterior_segment__herpes_simplex_keratitis',
  Hyphema: 'HEENT__eye__orbit__hyphema',
  Pterygium: 'HEENT__eye__conjunctiva__pterygium',
  Orbital_Cellulitis: 'HEENT__eye__orbit__orbital_cellulitis',
  Blepharitis: 'HEENT__eye__lids__lacrimal__blepharitis',

  // === HEMATOLOGY CONDITIONS ===
  AML: 'HEME__leukemia__acute_myeloid_leukemia_aml',
  CLL: 'HEME__leukemia__chronic_lymphocytic_leukemia_cll',
  B12_Deficiency: 'HEME__anemia__vitamin_b12_deficiency_anemia',
  G6PD_Deficiency: 'HEME__hemolytic__g6pd_deficiency',
  Lead_Poisoning: 'HEME__anemia__lead_poisoning',
  DVT: 'CV__vascular_disease__deep_venous_thrombosis_dvt',

  // === GI CONDITIONS ===
  Appendicitis: 'GI__large_bowel_acute_abdomen__appendicitis',
  Hemorrhoids: 'GI__anorectal__hemorrhoids',
  Parotitis: 'HEENT__salivary_glands__parotitis_nonmumps',
  COPD: 'PULM__obstructive__chronic_obstructive_pulmonary_disease_copd',
  Infective_Endocarditis: 'CV__carditis__endocarditis',
  Cholecystitis: 'GI__gallbladder__cholecystitis',
  Cirrhosis: 'GI__liver__cirrhosis',
  PylricStenosis: 'GI__stomach__pyloric_stenosis',

  // === Additional Clinical Signs (from Clinical folder) ===
  AphthousUlcer: 'HEENT__oral__aphthous_ulcers',
  Angioedema: 'DERM__reactive__hypersensitivity__angioedema',
  ATN: 'RENAL__acute_kidney_injury__acute_tubular_necrosis',

  // === Additional mappings from unmapped list ===
  AnteriorShoulderDislocation: 'MSK__trauma__shoulder_dislocation',
  AorticDissection: 'CV__vascular_disease__aortic_dissection',
  AvascularNecrosis: 'MSK__arthritis__avascular_necrosis',
  BoxersFracture_v2: 'MSK__trauma__fractures__boxers_fracture',
  CollesFracture: 'MSK__traumafracture__colles_fracture',
  ColonCutoffSign: 'GI__pancreas__acute_pancreatitis',
  Croup_v2: 'HEENT__larynx__upper_airway__croup_laryngotracheobronchitis',
  Developmental_Hip_Dysplasia: 'MSK__pediatric__developmental_dysplasia_hip',
  EpiduralHematoma: 'NEURO__trauma__epidural_hematoma',
  ForeignBodyBattery: 'GI__esophagus__foreign_body_ingestion',
  GaleazziFracture: 'MSK__trauma__fractures__galeazzi_fracture',
  Genu_Valgum_v2: 'MSK__pediatric__genu_valgum',
  Genu_Varum_v2: 'MSK__pediatric__genu_varum',
  HiatalHernia: 'GI__esophagus__hiatal_hernia',
  HipDislocationPosterior: 'MSK__trauma__hip_dislocation',
  HipFracture_v2: 'MSK__trauma__fractures__hip_fracture',
  HorseshoeKidney: 'RENAL__congenital__horseshoe_kidney',
  Hydrocephalus_v2: 'NEURO__pediatric__hydrocephalus',
  JonesFracture: 'MSK__traumafracture__jones_fracture',
  'Legg-Calve-Perthes': 'MSK__pediatric__legg_calve_perthes',
  LisfracFracture: 'MSK__trauma__fractures__lisfranc_injury',
  MaisonneuveFracture: 'MSK__trauma__fractures__maisonneuve_fracture',
  MalloryWeissTear: 'GI__esophagus__mallory_weiss_tear',
  MontegiaFracture: 'MSK__trauma__fractures__monteggia_fracture',
  NurseemaidElbow: 'MSK__pediatric__nursemaid_elbow',
  OpenBookPelvis: 'MSK__trauma__fractures__pelvic_fracture',
  PancostTumor: 'PULM__oncology__lung_cancer',
  PeritonsillarAbscess: 'HEENT__pharynx_tonsil__peritonsillar_abscess',
  PleuralEffusion_v2: 'PULM__pleural__pleural_effusion',
  PosteriorShoulderDislocation: 'MSK__trauma__shoulder_dislocation',
  RadialHeadSubluxation: 'MSK__pediatric__nursemaid_elbow',
  RetropharyngealAbscess: 'HEENT__pharynx_tonsil__retropharyngeal_abscess',
  RupturedAorticAneurysm: 'CV__vascular_disease__abdominal_aortic_aneurysm',
  SBO: 'GI__small_bowel__small_bowel_obstruction',
  SCFE: 'MSK__pediatric__slipped_capital_femoral_epiphysis',
  SalterHarris: 'MSK__pediatric__salter_harris_fractures',
  ScaphoidFracture: 'MSK__trauma__fractures__scaphoid_fracture',
  SepticArthritis: 'MSK__infectious__septic_arthritis',
  SmithFracture: 'MSK__trauma__fractures__smith_fracture',
  SubduralHematoma: 'NEURO__trauma__subdural_hematoma',
  SupracondylarFracture: 'MSK__pediatric__supracondylar_fracture',
  TensionPneumothorax: 'PULM__pleural_disease__tension_pneumothorax',
  TorusFracture: 'MSK__pediatric__torus_buckle_fracture',
  TransverseProcessFx: 'MSK__trauma__fractures__vertebral_fracture',
  TriplaneFracture: 'MSK__pediatric__triplane_fracture',
  VolvulusCecal: 'GI__obstruction__cecal_volvulus',
  WedgeFracture: 'MSK__trauma__fractures__vertebral_compression_fracture',

  // === SORTED_IMAGES FOLDER MAPPINGS (underscore format) ===
  // These map the underscore format filenames from sorted_images folder
  Subdural_Hematoma: 'NEURO__trauma__subdural_hematoma',
  Subarachnoid_Hemorrhage: 'NEURO__vascular__subarachnoid_hemorrhage',
  Spinal_Stenosis: 'MSK__spine__spinal_stenosis',
  Pleural_Effusion: 'PULM__pleural_disease__pleural_effusion',
  Pulmonary_Embolism: 'PULM__vascular__pulmonary_embolism',
  Idiopathic_Pulmonary: 'PULM__interstitial__idiopathic_pulmonary_fibrosis',
  Avascular_Necrosis: 'MSK__metabolicbone__avascular_necrosis_of_the_femoral_head',
  Polycystic_Kidney: 'RENAL__congenital__polycystic_kidney_disease',
  Nephrotic_Syndrome: 'RENAL__glomerular__nephrotic_syndrome',
  Central_Retinal: 'HEENT__eye__retina__central_retinal_artery_occlusion_crao',
  Deep_Vein: 'CV__vascular_disease__deep_venous_thrombosis_dvt',
  Wilson_s: 'GI__liver__wilson_disease',
  Tetralogy_of: 'PEDS__cardiac__tetralogy_of_fallot',
  Normal_Pressure: 'NEURO__dementia__normal_pressure_hydrocephalus',
  Chronic_Lymphocytic: 'HEME__leukemia__chronic_lymphocytic_leukemia_cll',
  Chronic_Renal: 'RENAL__chronic_kidney_disease__chronic_kidney_disease',
  Acute_Tubular: 'RENAL__aki__acute_tubular_necrosis',
  Legg_Calve: 'MSK__pediatric__legg_calve_perthes',
  Ethylene_Glycol: 'OTHER__toxicology__ethylene_glycol_poisoning',
  Malaria: 'ID__parasitic__malaria',
  Molluscum_Contagiosum: 'DERM__infectious_viral__molluscum_contagiosum',
  Herpes_Zoster: 'DERM__infectious_viral__herpes_zoster_shingles',
  Systemic_Lupus: 'DERM__connective_tissue__systemic_lupus_erythematosus',
  Multiple_Sclerosis: 'NEURO__demyelinating__multiple_sclerosis',
  Impetigo_v2: 'DERM__infectious_bacterial__impetigo',
  Hypothermia_v2: 'CV__environmental__hypothermia',
  Hyperkalemia: 'ENDO__electrolyte__hyperkalemia',
  Second_Degree: 'CV__conduction_disorders__second_degree_av_block_mobitz_i',
  Third_Degree: 'CV__conduction_disorders__third_degree_av_block',
  Acute_Coronary: 'CV__ischemic_heart_disease__stemi',
  Acute_Angle: 'HEENT__eye__glaucoma__acute_angleclosure_glaucoma',
  Epidural_Hematoma_v2: 'NEURO__trauma__epidural_hematoma',
  Hodgkin_Lymphoma_v2: 'HEME__lymphoma__hodgkin_lymphoma',
  Testicular_Torsion: 'GU__testicular__testicular_torsion',
  Hyphema_v2: 'HEENT__eye__orbit__hyphema',

  // === EXPANDED MAPPINGS FROM ALL IMAGES FOLDER ===
  // Ophthalmology
  Diabetic_Retinopathy: 'HEENT__eye__retina__diabetic_retinopathy',
  DiabeticRetinopathy: 'HEENT__eye__retina__diabetic_retinopathy',
  Hypertensive_Retinopathy: 'HEENT__eye__retina__hypertensive_retinopathy',
  Papilledema: 'HEENT__eye__retina__papilledema',
  SubconjunctivalHemorrhage: 'HEENT__eye__conjunctiva__subconjunctival_hemorrhage',
  Chalazion: 'HEENT__eye__lids__chalazion',
  Hordeolum: 'HEENT__eye__lids__hordeolum',
  Ectropion: 'HEENT__eye__lids__ectropion',
  Entropion: 'HEENT__eye__lids__entropion',
  Dacryocystitis: 'HEENT__eye__lacrimal__dacryocystitis',
  Leukocoria: 'HEENT__eye__trauma__leukocoria',
  HollenhorstPlaque: 'HEENT__eye__retina__hollenhorst_plaque',
  Hypopyon: 'HEENT__eye__trauma__hypopyon',
  Pinguecula: 'HEENT__eye__conjunctiva__pinguecula',
  CornealAbrasion: 'HEENT__eye__cornea__anterior_segment__corneal_foreign_body',
  DendriticKeratitis: 'HEENT__eye__cornea__anterior_segment__herpes_simplex_keratitis',
  RetinalDetachment: 'HEENT__eye__retina__retinal_detachment',

  // Oral/ENT
  GeographicTongue: 'HEENT__oral__geographic_tongue',
  BlackHairyTongue: 'HEENT__oral__black_hairy_tongue',
  Leukoplakia: 'HEENT__oral__leukoplakia',
  OralHairyLeukoplakia: 'HEENT__oral__oral_hairy_leukoplakia',
  Ranula: 'HEENT__oral__ranula',
  TorusPalatinus: 'HEENT__oral__torus_palatinus',
  GingivalHyperplasia: 'HEENT__oral__gingival_hyperplasia',
  TetracyclineStaining: 'HEENT__oral__tetracycline_staining',
  PerforatedTympanicMembrane: 'HEENT__ear__tympanic_membrane_perforation',
  Perforated_tympanic_membrane: 'HEENT__ear__tympanic_membrane_perforation',
  OtitisMedia: 'HEENT__ear__otitis_media',
  AuricularHematoma: 'HEENT__ear__auricular_hematoma',
  SeptalHematoma: 'HEENT__nose__septal_hematoma',
  Sialolithiasis: 'HEENT__salivary_glands__sialolithiasis',
  Aphthous_ulcers: 'HEENT__oral__aphthous_ulcers',

  // MSK/Orthopedic
  'Osgood-Schlatter': 'MSK__pediatric__osgood_schlatter',
  Clubfoot: 'MSK__pediatric__clubfoot',
  TalipesEquinovarus: 'MSK__pediatric__clubfoot',
  Torticollis: 'MSK__pediatric__torticollis',
  OlecranonBursitis: 'MSK__trauma__olecranon_bursitis',
  PrepatellarBursitis: 'MSK__trauma__prepatellar_bursitis',
  BakersCyst: 'MSK__trauma__bakers_cyst',
  Pseudogout: 'MSK__arthritis__pseudogout',
  'PseudogoutX-ray': 'MSK__arthritis__pseudogout',
  DupuytrensContracture: 'MSK__hand__dupuytrens_contracture',
  TriggerFinger: 'MSK__hand__trigger_finger',
  Osteosarcoma: 'MSK__oncology__osteosarcoma',
  Ewing_Sarcoma: 'MSK__oncology__ewing_sarcoma',
  'GoutX-ray': 'MSK__arthritis__gout',
  RadialHeadFracture: 'MSK__traumafracture__radial_head_fracture',
  Galeazzi_Fracture: 'MSK__trauma__fractures__galeazzi_fracture',
  TripodFracture: 'MSK__trauma__fractures__tripod_fracture',

  // Infectious Disease and Dermatology
  Babesiosis: 'ID__parasitic__babesiosis',
  Cryptococcus: 'ID__fungal__cryptococcosis',
  Felon: 'DERM__infectious_bacterial__felon',
  HerpeticWhitlow: 'DERM__infectious_bacterial__herpetic_whitlow',
  InfectiousTenosynovitis: 'DERM__infectious_bacterial__infectious_tenosynovitis',
  Dermatitis_herpetiformis: 'DERM__bullous__dermatitis_herpetiformis',
  RaynaudsPhenomenon: 'DERM__vascular__raynauds',
  DependentRubor: 'DERM__vascular__dependent_rubor',
  BeausLines: 'DERM__pigmentary__beaus_lines',
  MongolianSpot: 'DERM__pigmentary__mongolian_spot',
  PortWineStain: 'DERM__vascular__port_wine_stain',
  StrawberryHemangioma: 'DERM__vascular__strawberry_hemangioma',
  Neurofibromatosis: 'DERM__genetic__neurofibromatosis',
  BreastAbscess: 'DERM__oncology__breast_abscess',
  Peaudorange: 'DERM__oncology__peau_dorange',
  Angioedema_Lip: 'DERM__reactive__hypersensitivity__angioedema',

  // Neuro
  Tetanus: 'NEURO__infectious__tetanus',
  MultipleSclerosis: 'NEURO__demyelinating__multiple_sclerosis',
  MyastheniaGravis: 'NEURO__neuromuscular__myasthenia_gravis',
  CNIIIPalsy: 'NEURO__cranial_nerve__cn_iii_palsy',
  BasilarSkullFracture: 'NEURO__trauma__basilar_skull_fracture',
  Epidural_Hematoma_v3: 'NEURO__trauma__epidural_hematoma',

  // GI
  AnalFissure: 'GI__anorectal__anal_fissure',
  ZenkersDiverticulum: 'GI__esophagus__zenkers_diverticulum',
  Zenker_s_Diverticulum: 'GI__esophagus__zenkers_diverticulum',
  ToxicMegacolon: 'GI__colon__toxic_megacolon',
  Toxic_Megacolon: 'GI__colon__toxic_megacolon',
  CecalVolvulus: 'GI__obstruction__cecal_volvulus',
  SigmoidVolvulus: 'GI__obstruction__sigmoid_volvulus',
  PorcelainGallbladder: 'GI__pancreas__porcelain_gallbladder',
  Pneumoperitoneum: 'GI__obstruction__pneumoperitoneum',
  SmallBowelObstruction: 'GI__small_bowel__small_bowel_obstruction',
  PyloricStenosis: 'GI__stomach__pyloric_stenosis',
  Diverticulitis_Wallthickeningstranding: 'GI__colon__diverticulitis',
  PancreatitisCT: 'GI__pancreas__acute_pancreatitis',

  // Endo/Cushing/Pediatric
  CongenitalHypothyroidism: 'ENDO__thyroid__congenital_hypothyroidism',
  Pellagra: 'ENDO__nutritional__pellagra',
  BitotsSpots: 'ENDO__nutritional__bitot_spots',
  CushingsSyndrome: 'ENDO__adrenal__cushing_syndrome',
  FetalAlcoholSyndrome: 'PEDS__congenital__fetal_alcohol_syndrome',
  TurnerSyndrome: 'PEDS__congenital__turner_syndrome',
  CaputSuccedaneum: 'PEDS__congenital__caput_succedaneum',
  WilmsTumor: 'PEDS__oncology__wilms_tumor',
  Neuroblastoma: 'PEDS__oncology__neuroblastoma',
  TranspositionofGreatArteries: 'PEDS__cardiac__transposition_great_arteries',

  // PULM/CV
  PneumocystisPneumonia: 'PULM__infectious__pneumocystis_pneumonia',
  TuberculosisPrimary: 'PULM__infectious__tuberculosis_primary',
  PulmonaryEdema: 'CV__heart_failure__leftsided_heart_failure',
  WaterBottleHeart: 'CV__pericardial_disease__pericardial_effusion',
  PlacenatalAbruption: 'OB__placental__placental_abruption',

  // GU
  InguinalHernia: 'GU__male__inguinal_hernia',
  Testicular_Torsion_v2: 'GU__male__testicular_torsion',

  // Vertigo
  Vertigo: 'HEENT__vertigo__benign_paroxysmal_positional_vertigo',

  // Additional filename variants
  Epiglottitis_EM: 'PULM__upper_airway_emergency__acute_epiglottitis',
  Epiglottitis_Foreign: 'PULM__other__foreign_body_aspiration',
  Iron_Deficiency_Anemia: 'HEME__anemia__iron_deficiency_anemia',
  SisterMaryJosephNodule: 'GI__oncology__metastatic_cancer',
  MethMouth: 'PSYCH__substance_use__methamphetamine_use_disorder',

  // === ADDITIONAL UNMAPPED CONDITIONS ===
  // Dermatology/Vascular
  PortWineStain_v2: 'DERM__benign_lesions__portwine_stain',
  StrawberryHemangioma_v2: 'DERM__benign_lesions__strawberry_hemangioma_infantile_hemangioma',
  Felon_v2: 'DERM__infectious_bacterial__felon',
  HerpeticWhitlow_v2: 'DERM__infectious_bacterial__herpetic_whitlow',
  BeausLines_v2: 'DERM__pigmentary__beaus_lines',
  MongolianSpot_v2: 'DERM__pigmentary__mongolian_spot',

  // HEENT/Oral
  GeographicTongue_v2: 'HEENT__oral__geographic_tongue',
  BlackHairyTongue_v2: 'HEENT__oral__black_hairy_tongue',
  OralHairyLeukoplakia_v2: 'HEENT__oral__oral_hairy_leukoplakia',
  TorusPalatinus_v2: 'HEENT__oral__torus_palatinus',
  HollenhorstPlaque_v2: 'HEENT__eye__retina__hollenhorst_plaque',

  // Nutritional
  BitotsSpots_v2: 'ENDO__nutritional__bitot_spots',
  Pellagra_v2: 'ENDO__nutritional__pellagra',

  // MSK Hand
  DupuytrensContracture_v2: 'MSK__hand__dupuytrens_contracture',
  TriggerFinger_v2: 'MSK__hand__trigger_finger',

  // MSK Oncology
  Ewing_Sarcoma_v2: 'MSK__oncology__ewing_sarcoma',

  // Scaphoid and other fractures
  ScaphoidFracture_v2: 'MSK__trauma__fractures__scaphoid_fracture',
  SmithFracture_v2: 'MSK__traumafracture__smith_fracture',
  GaleazziFracture_v2: 'MSK__trauma__fractures__galeazzi_fracture',
  Galeazzi_Fracture_v2: 'MSK__trauma__fractures__galeazzi_fracture',
  TripodFracture_v2: 'MSK__trauma__fractures__tripod_fracture',
  SupracondylarFracture_v2: 'MSK__pediatric__supracondylar_fracture',
  OrbitalBlowoutFracture: 'HEENT__eye__orbit__blunt_ocular_trauma__globe_injury',

  // Additional clinical signs
  BrudzinskisSign: 'NEURO__infectious__bacterial_meningitis',
  RaynaudsPhenomenon_v2: 'DERM__vascular__raynauds',
  DependentRubor_v2: 'CV__vascular_disease__peripheral_arterial_disease_pad',
  InfectiousTenosynovitis_v2: 'DERM__infectious_bacterial__infectious_tenosynovitis',

  // Pediatric conditions
  OsgoodSchlatter: 'MSK__pediatric__osgood_schlatter',
  'Osgood-Schlatter_v2': 'MSK__pediatric__osgood_schlatter',
  SCFE_v2: 'MSK__pediatric__slipped_capital_femoral_epiphysis',
  'Legg-Calve-Perthes_v2': 'MSK__pediatric__legg_calve_perthes',

  // GI conditions
  CecalVolvulus_v2: 'GI__obstruction__cecal_volvulus',
  PorcelainGallbladder_v2: 'GI__gallbladder__porcelain_gallbladder',
  HiatalHernia_v2: 'GI__esophagus__hiatal_hernia',
  PyloricStenosis_v2: 'GI__stomach__pyloric_stenosis',
  MalloryWeiss: 'GI__esophagus__mallory_weiss_tear',
  ColonCutoffSign_v2: 'GI__pancreas__acute_pancreatitis',

  // Pulmonary
  PneumocystisPneumonia_v2: 'PULM__infectious__pneumocystis_pneumonia',
  Pneumonia_v2: 'PULM__infectious__community_acquired_pneumonia',
  PleuralEffusion_v3: 'PULM__pleural__pleural_effusion',

  // Cardiac/Vascular
  WaterBottleHeart_v2: 'CV__pericardial_disease__pericardial_effusion',

  // Neuro
  SubduralHematoma_v2: 'NEURO__trauma__subdural_hematoma',
  MultipleSclerosis_v2: 'NEURO__demyelinating__multiple_sclerosis',
  Tetanus_v2: 'NEURO__infectious__tetanus',
  Hydrocephalus_v3: 'NEURO__pediatric__hydrocephalus',

  // Infectious
  Cryptococcus_v2: 'ID__fungal__cryptococcosis',

  // Endocrine
  CushingsSyndrome_v2: 'ENDO__adrenal__cushing_syndrome',
  CongenitalHypothyroidism_v2: 'ENDO__thyroid__congenital_hypothyroidism',

  // Peds
  CaputSuccedaneum_v2: 'PEDS__newborn__caput_succedaneum',
  TurnerSyndrome_v2: 'PEDS__genetic__turner_syndrome',
  FetalAlcoholSyndrome_v2: 'PEDS__congenital__fetal_alcohol_syndrome',
  WilmsTumor_v2: 'PEDS__oncology__wilms_tumor',
  Neuroblastoma_v2: 'PEDS__oncology__neuroblastoma',
  TranspositionofGreatArteries_v2: 'PEDS__cardiac__transposition_great_arteries',

  // Eye additional
  SubconjunctivalHemorrhage_v2: 'HEENT__eye__conjunctiva__subconjunctival_hemorrhage',

  // Bursitis
  OlecranonBursitis_v2: 'MSK__trauma__olecranon_bursitis',
  PrepatellarBursitis_v2: 'MSK__trauma__prepatellar_bursitis',
  BakersCyst_v2: 'MSK__trauma__bakers_cyst',

  // Ear
  OtitisMedia_v2: 'HEENT__ear__middle__acute_otitis_media',
  AuricularHematoma_v2: 'HEENT__ear__auricular_hematoma',
  SeptalHematoma_v2: 'HEENT__nose__septal_hematoma',

  // GU
  Testicular_Torsion_v3: 'GU__testicular__testicular_torsion',
  InguinalHernia_v2: 'GU__male__inguinal_hernia',

  // Placental
  PlacentalAbruption: 'OB__placental__placental_abruption',
};

// Additional mappings for complex filenames (Clinical folder format)
const CLINICAL_FILENAME_MAP: Record<string, string> = {
  BrudzinskisSign: 'NEURO__meningitis__bacterial_meningitis',
  KernigSign: 'NEURO__meningitis__bacterial_meningitis',
  ChvosteSign: 'ENDO__calciumparathyroid__hypocalcemia',
  TrousseauSign: 'ENDO__calciumparathyroid__hypocalcemia',
  JanewayLesions: 'CV__carditis__endocarditis',
  OslerNodes: 'CV__carditis__endocarditis',
  SplinterHemorrhages: 'CV__carditis__endocarditis',
  RothSpots: 'CV__carditis__endocarditis',
  KayserFleischerRings: 'GI__liver__wilson_disease',
  XanthomaXanthelasma: 'ENDO__metabolic__hyperlipidemia',
  AcuteCholecystitis: 'GI__hepatobiliary__acute_cholecystitis',
  MurphySign: 'GI__hepatobiliary__acute_cholecystitis',
  CullenSign: 'GI__pancreas__acute_pancreatitis',
  GreyTurnerSign: 'GI__pancreas__acute_pancreatitis',
  // Additional clinical signs
  BattleSign: 'NEURO__trauma__basilar_skull_fracture',
  RacoonEyes: 'NEURO__trauma__basilar_skull_fracture',
  PeriorbitalEcchymosis: 'NEURO__trauma__basilar_skull_fracture',
  Hematotympanum: 'NEURO__trauma__basilar_skull_fracture',
  CSFRhinorrhea: 'NEURO__trauma__basilar_skull_fracture',
  CSFOtorrhea: 'NEURO__trauma__basilar_skull_fracture',
  HeberdenNodes: 'MSK__arthritis__osteoarthritis',
  BouchardNodes: 'MSK__arthritis__osteoarthritis',
  SwanNeckDeformity: 'MSK__arthritis__rheumatoid_arthritis',
  BoutonniereDeformity: 'MSK__arthritis__rheumatoid_arthritis',
  UlnarDeviation: 'MSK__arthritis__rheumatoid_arthritis',
  Tophi: 'MSK__arthritis__gout',
  Podagra: 'MSK__arthritis__gout',
  ErythemaMigrans:
    'DERM__infectious_bacterial_systemic_with_cutaneous_manifestations__erythema_migrans',
  TargetLesion: 'DERM__reactive__hypersensitivity__erythema_multiforme',
  NikolskySign: 'DERM__bullous__pemphigus_vulgaris',
  KoebnerPhenomenon: 'DERM__papulosquamous__plaque_psoriasis',
  AuspitzSign: 'DERM__papulosquamous__plaque_psoriasis',
  DermographismDermatographism: 'DERM__reactive__hypersensitivity__urticaria',
  Telangiectasia: 'DERM__vascular__telangiectasia',
  SpiderAngioma: 'GI__liver__cirrhosis',
  CherryAngioma: 'DERM__vascular__cherry_angioma',
  PalmarErythema: 'GI__liver__cirrhosis',
  Asterixis: 'GI__liver__hepatic_encephalopathy',
  GynecomastiaMale: 'GI__liver__cirrhosis',
  CarotidBruit: 'CV__vascular_disease__carotid_artery_disease',
  AbdominalBruit: 'CV__vascular_disease__abdominal_aortic_aneurysm',
  JVD: 'CV__heart_failure__rightsided_heart_failure',
  HepatojugularReflux: 'CV__heart_failure__rightsided_heart_failure',
  PulsusParadoxus: 'CV__pericardial_disease__cardiac_tamponade',
  BeckTriad: 'CV__pericardial_disease__cardiac_tamponade',
  KussmaulSign: 'CV__pericardial_disease__constrictive_pericarditis',
  PittingEdema: 'CV__heart_failure__rightsided_heart_failure',
  Clubbing: 'PULM__interstitial__idiopathic_pulmonary_fibrosis',
  Cyanosis: 'PULM__respiratory_failure__hypoxemic_respiratory_failure',
  Pinguecula: 'HEENT__eye__conjunctiva__pinguecula',
  Pterygium: 'HEENT__eye__conjunctiva__pterygium',
  Arcus: 'ENDO__metabolic__hyperlipidemia',
  Xanthelasma: 'ENDO__metabolic__hyperlipidemia',
  Exophthalmos: 'ENDO__thyroid__graves_disease',
  LidLag: 'ENDO__thyroid__graves_disease',
  PretibialMyxedema: 'ENDO__thyroid__graves_disease',
  ThyroidEyeDisease: 'ENDO__thyroid__graves_disease',
  MoonFacies: 'ENDO__adrenal__cushing_syndrome',
  BuffaloHump: 'ENDO__adrenal__cushing_syndrome',
  Striae: 'ENDO__adrenal__cushing_syndrome',
  Acromegaly: 'ENDO__pituitary__acromegaly',
  BitTemporalHemianopia: 'ENDO__pituitary__pituitary_adenoma',
  Galactorrhea: 'ENDO__pituitary__prolactinoma',
  Sialolithiasis: 'HEENT__salivary_glands__sialolithiasis',
  TesticularTorsion: 'GU__male__testicular_torsion',
  Varicocele: 'GU__male__varicocele',
  Hydrocele: 'GU__male__hydrocele',
  Epididymitis: 'GU__male__epididymitis',
  PrehnSign: 'GU__male__epididymitis',
  Phimosis: 'GU__male__phimosis',
  Paraphimosis: 'GU__male__paraphimosis',
  Balanoposthitis: 'GU__male__balanitis',

  // === COMPREHENSIVE MAPPINGS FOR ALL REMAINING UNMAPPED CONDITIONS ===
  // These are complex filenames with descriptors (e.g. ConditionName_Description)

  // MSK/Orthopedic with descriptors
  'AnteriorShoulderDislocation_Squared-offshoulderX-ray':
    'MSK__traumafracture__anterior_shoulder_dislocation',
  AnteriorShoulderDislocation: 'MSK__traumafracture__anterior_shoulder_dislocation',
  PosteriorShoulderDislocation_Lightbulbsign: 'MSK__traumafracture__posterior_shoulder_dislocation',
  PosteriorShoulderDislocation: 'MSK__traumafracture__posterior_shoulder_dislocation',
  AvascularNecrosis_Crescentsign: 'MSK__metabolicbone__avascular_necrosis_of_the_femoral_head',
  AvascularNecrosis: 'MSK__metabolicbone__avascular_necrosis_of_the_femoral_head',
  BoxersFracture_5thmetacarpalneck: 'MSK__traumafracture__boxer_fracture',
  'CollesFracture_DinnerforkdeformityX-rayview': 'MSK__traumafracture__colles_fracture',
  'SmithFracture_GardenspadedeformityX-rayview': 'MSK__traumafracture__smith_fracture',
  GaleazziFracture_RadialfxDRUJdislocation: 'MSK__traumafracture__galeazzi_fracture',
  MonteggiaFracture_UlnarfxRadialheaddislocation: 'MSK__traumafracture__monteggia_fracture',
  HipFracture_Femoralneckfracture: 'MSK__traumafracture__hip_fracture',
  'HipDislocationPosterior_DislocationX-ray': 'MSK__traumafracture__hip_dislocation',
  JonesFracture_Baseof5thmetatarsal: 'MSK__traumafracture__jones_fracture',
  'ScaphoidFracture_SnuffboxfractureX-ray': 'MSK__traumafracture__scaphoid_fracture',
  'SupracondylarFracture_Posteriorfatpad-Anteriorhumeralline':
    'MSK__traumafracture__supracondylar_humerus_fracture',
  'RadialHeadFracture_Sailsign-Fatpad': 'MSK__traumafracture__radial_head_fracture',
  OrbitalBlowoutFracture_Teardropsign: 'HEENT__eye__orbit__blunt_ocular_trauma__globe_injury',
  TripodFracture_Zygomaticfracture: 'MSK__trauma__fractures__tripod_fracture',
  'Salter-HarrisFractures_Physisfracture': 'MSK__pediatric__salter_harris_fractures',
  SCFE_Icecreamfallingoffcone: 'MSK__pediatrics__slipped_capital_femoral_epiphysis',
  'Legg-Calve-Perthes_Flattenedfemoralhead': 'MSK__pediatric__legg_calve_perthes',
  'Osgood-Schlatter_Tibialtuberclefragmentation': 'MSK__pediatrics__osgoodschlatter_disease',
  OlecranonBursitis_Elbowgooseegg: 'MSK__trauma__olecranon_bursitis',
  PrepatellarBursitis_Kneeswelling: 'MSK__trauma__prepatellar_bursitis',
  BakersCyst_Poplitealswelling: 'MSK__soft_tissue__bakers_cyst',
  DupuytrensContracture_Handdeformity: 'MSK__hand__dupuytrens_contracture',
  TriggerFinger_Lockingofdigit: 'MSK__hand__trigger_finger',
  Clubfoot_TalipesEquinovarus: 'MSK__pediatric__clubfoot',
  Torticollis_01: 'MSK__pediatric__torticollis',

  // Pediatric hip conditions
  Developmental_Hip_Dysplasia: 'MSK__pediatrics__developmental_dysplasia_of_the_hip',
  Genu_Valgum: 'MSK__pediatric__genu_valgum',
  Genu_Varum: 'MSK__pediatric__genu_varum',

  // Neuro/Head trauma
  'EpiduralHematoma_Lens-Biconvexshape': 'NEURO__trauma__epidural_hematoma',
  BasilarSkullFracture_Raccooneyes: 'NEURO__trauma__basilar_skull_fracture',
  Hemorrhagic_Stroke: 'NEURO__vascular__hemorrhagic_stroke',
  MultipleSclerosis_Dawsonsfingers: 'NEURO__demyelinating__multiple_sclerosis',
  BrudzinskisSign_Neckflexioncauseshipflexion: 'NEURO__infectious__bacterial_meningitis',

  // Eye conditions with descriptors
  Dacryocystitis_Medialcanthalswelling: 'HEENT__eye__lacrimal__dacryocystitis',
  Chalazion_Nodule: 'HEENT__eye__lids__chalazion',
  Hordeolum_Stye: 'HEENT__eye__lids__hordeolum',
  Ectropion_Eyelidturnsoutward: 'HEENT__eye__lids__ectropion',
  Entropion_Eyelidturnsinward: 'HEENT__eye__lids__entropion',
  Blepharitis_Crustingatlashbase: 'HEENT__eye__lids__lacrimal__blepharitis',
  Pterygium_Conjunctivalgrowthcrossingcornea: 'HEENT__eye__conjunctiva__pterygium',
  Pinguecula_Yellownodule: 'HEENT__eye__conjunctiva__pinguecula',
  SubconjunctivalHemorrhage_Bloodpatchonsclera:
    'HEENT__eye__conjunctiva__subconjunctival_hemorrhage',
  Hyphema_Bloodinanteriorchamber: 'HEENT__eye__orbit__hyphema',
  Hypopyon_Pusinanteriorchamber: 'HEENT__eye__trauma__hypopyon',
  Leukocoria_WhitepupillaryreflexRetinoblastoma: 'HEENT__eye__trauma__leukocoria',
  'AcuteAngle-ClosureGlaucoma_Steamycornea': 'HEENT__eye__glaucoma__acute_angleclosure_glaucoma',
  CRAO_Cherryredspot: 'HEENT__eye__retina__central_retinal_artery_occlusion_crao',
  CRVO_Bloodandthunder: 'HEENT__eye__retina__central_retinal_vein_occlusion_crvo',
  HollenhorstPlaque_Cholesterolembolusinretina: 'HEENT__eye__retina__hollenhorst_plaque',
  RetinalDetachment_CurtainappearingFundoscopy: 'HEENT__eye__retina__retinal_detachment',
  'DiabeticRetinopathy_Cottonwool-ExudatesFundoscopy': 'HEENT__eye__retina__diabetic_retinopathy',
  DendriticKeratitis_Branchingulcer:
    'HEENT__eye__cornea__anterior_segment__herpes_simplex_keratitis',
  CornealAbrasion_Fluoresceinuptake: 'HEENT__eye__cornea__anterior_segment__corneal_foreign_body',

  // Oral/ENT conditions with descriptors
  Oral_Herpes_simplex: 'DERM__infectious_viral__herpes_simplex',
  AphthousUlcer_Cankersore: 'HEENT__oral_cavity__aphthous_ulcers',
  'GeographicTongue_Map-liketonguelesions': 'HEENT__oral__geographic_tongue',
  BlackHairyTongue_Darkpapillae: 'HEENT__oral__black_hairy_tongue',
  Leukoplakia_Whitepatch: 'HEENT__oral__leukoplakia',
  OralHairyLeukoplakia_Corrugatedlateraltongue: 'HEENT__oral__oral_hairy_leukoplakia',
  Ranula_Bluefloorofmouthcyst: 'HEENT__oral__ranula',
  TorusPalatinus_Bonypalategrowth: 'HEENT__oral__torus_palatinus',
  GingivalHyperplasia_Overgrowngums: 'HEENT__oral__gingival_hyperplasia',
  TetracyclineStaining_Graybandsonteeth: 'HEENT__oral__tetracycline_staining',
  Sialolithiasis_Salivaryductstone: 'HEENT__salivary_glands__sialolithiasis',
  SeptalHematoma_Boggypurplenasalseptum: 'HEENT__nose__septal_hematoma',
  AuricularHematoma_CauliflowerearAcute: 'HEENT__ear__auricular_hematoma',
  PerforatedTympanicMembrane_Eardrumhole: 'HEENT__ear__tympanic_membrane_perforation',
  OtitisMedia_BulgingTM: 'HEENT__ear__middle__acute_otitis_media',
  OtitisExterna_Canaledema: 'HEENT__ear__external__otitis_externa',

  // GI with descriptors
  Achalasia_Birdsbeaksign: 'GI__esophagus__achalasia',
  'HiatalHernia_Retrocardiacair-fluidlevel': 'GI__hernia__hiatal_hernia',
  ZenkersDiverticulum_OutpouchingBarium: 'GI__esophagus__zenkers_diverticulum',
  MalloryWeiss_Esophagealtear: 'GI__esophagus__mallory_weiss_tear',
  'ForeignBodyBattery_Doubleringsign-Step-off': 'GI__esophagus__foreign_body_ingestion',
  ColonCutoffSign_AbruptgasstopPancreatitis: 'GI__pancreas__acute_pancreatitis',
  'PancreatitisCT_Inflammation-Edema': 'GI__pancreas__acute_pancreatitis',
  PorcelainGallbladder_Calcifiedgallbladderwall: 'GI__gallbladder__porcelain_gallbladder',
  'SmallBowelObstruction_Step-ladderair-fluidlevels': 'GI__small_bowel__small_bowel_obstruction',
  CecalVolvulus_Embryosign: 'GI__obstruction__cecal_volvulus',
  SigmoidVolvulus_Coffeebeansign: 'GI__obstruction__sigmoid_volvulus',
  ToxicMegacolon_Dilatedcolon6cm: 'GI__colon__toxic_megacolon',
  'Intussusception_Targetsign-Coiledspring': 'GI__small_bowel__intussusception',
  Pneumoperitoneum_FreeairunderdiaphragmCXR: 'GI__obstruction__pneumoperitoneum',
  AnalFissure_Posteriormidlinetear: 'GI__anorectal__anal_fissure',
  'PyloricStenosis_Stringsign-Targetsign': 'GI__stomach__pyloric_stenosis',
  SisterMaryJosephNodule_Umbilicalnodule: 'GI__oncology__metastatic_cancer',
  Diverticulitis_Wallthickeningstranding: 'GI__colon__diverticulitis',

  // Pulmonary with descriptors
  Croup_Steeplesign: 'HEENT__larynx__upper_airway__croup_laryngotracheobronchitis',
  Epiglottitis_Thumbprintsign: 'PULM__upper_airway_emergency__acute_epiglottitis',
  'PneumocystisPneumonia_Bat-wing-Diffuseinfiltrates': 'PULM__infectious__pneumocystis_pneumonia',
  Pneumonia_Lobarconsolidation: 'PULM__infectious__community_acquired_pneumonia',
  PleuralEffusion_Bluntedcostophrenicangles: 'PULM__pleural_disease__pleural_effusion',
  PleuralEffusion_Meniscussign: 'PULM__pleural_disease__pleural_effusion',
  Pneumothorax_Visceralpleuralline: 'PULM__pleural_disease__pneumothorax',
  'PulmonaryEdema_Bat-wingappearance': 'CV__heart_failure__leftsided_heart_failure',
  PulmonaryEdema_KerleyBlines: 'CV__heart_failure__leftsided_heart_failure',
  TuberculosisPrimary_Ghoncomplex: 'PULM__infectious__tuberculosis',

  // CV with descriptors
  AorticDissection_Widenedmediastinum: 'CV__vascular_disease__aortic_dissection',
  WaterBottleHeart_EnlargedcardiacsilhouetteEffusion:
    'CV__pericardial_disease__pericardial_effusion',
  DependentRubor_Redfeetwhenlowered: 'CV__vascular_disease__peripheral_arterial_disease_pad',
  'RaynaudsPhenomenon_White-Blue-Redfingers': 'CV__vascular_disease__raynauds_disease',

  // Derm with descriptors
  'MongolianSpot_Blue-greysacralpatch': 'DERM__pigmentary__mongolian_spot',
  'PortWineStain_FacialbirthmarkSturge-Weber': 'DERM__vascular__port_wine_stain',
  StrawberryHemangioma_RedraisednoduleInfant: 'DERM__vascular__strawberry_hemangioma',
  BeausLines_Transversenaildepressions: 'DERM__pigmentary__beaus_lines',
  'Neurofibromatosis_Cafe-au-laitspots': 'NEURO__genetic__neurofibromatosis',
  Peaudorange_Dimpledbreastskin: 'DERM__oncology__peau_dorange',
  HerpeticWhitlow_Fingervesicles: 'DERM__infectious_bacterial__herpetic_whitlow',
  Felon_Fingerpulpabscess: 'DERM__infectious__abscess',
  BreastAbscess_Fluctuantbreastmass: 'DERM__infectious__abscess',
  InfectiousTenosynovitis_KanavelSignsSausagedigit:
    'DERM__infectious_bacterial__infectious_tenosynovitis',
  Dermatitis_herpetiformis: 'DERM__bullous__dermatitis_herpetiformis',
  'Angioedema_Lip-Tongueswelling': 'DERM__reactive__hypersensitivity__angioedema',

  // Heme with descriptors
  Iron_Deficiency_Anemia: 'HEME__anemia__iron_deficiency_anemia',
  Thalassemia_Targetcells: 'HEME__hemoglobinopathy__beta_thalassemia',
  Babesiosis_Maltesecross: 'ID__tickborne__babesiosis',
  Cryptococcus_Indiainkstain: 'ID__fungal__cryptococcosis',

  // Endocrine with descriptors
  CushingsSyndrome_Moonfacies: 'ENDO__adrenal__cushing_syndrome',
  'CongenitalHypothyroidism_Macroglossia-Umbilicalhernia':
    'ENDO__thyroid__congenital_hypothyroidism',
  Pellagra_Casalsnecklace: 'ENDO__nutritional__pellagra',
  BitotsSpots_Foamyconjunctivalspots: 'ENDO__nutritional__bitot_spots',

  // Peds with descriptors
  CaputSuccedaneum_Swellingcrossingsuturelines: 'PEDS__newborn__caput_succedaneum',
  TurnerSyndrome_Shieldchest: 'PEDS__genetic__turner_syndrome',
  FetalAlcoholSyndrome_Smoothphiltrum: 'PEDS__congenital__fetal_alcohol_syndrome',
  WilmsTumor_Abdominalmassnotcrossingmidline: 'PEDS__oncology__wilms_tumor',
  Neuroblastoma_Abdominalmasscrossingmidline: 'PEDS__oncology__neuroblastoma',
  TranspositionofGreatArteries_Eggonastring: 'PEDS__cardiac__transposition_great_arteries',

  // Renal with descriptors
  HorseshoeKidney_Fusedlowerpoles: 'RENAL__congenital__horseshoe_kidney',
  Nephrolithiasis_Kidneystone: 'RENAL__stones__nephrolithiasis_general_evaluation',
  ATN: 'RENAL__aki__acute_tubular_necrosis',

  // GU with descriptors
  InguinalHernia_Groinbulge: 'GI__hernia__inguinal_hernia',
  Testicular_Torsion: 'GU__testicular__testicular_torsion',

  // Neuro with descriptors
  CNIIIPalsy_Downandouteyedeviation: 'NEURO__cranial_nerve__cn_iii_palsy',
  MyastheniaGravis_Ptosis: 'NEURO__neuromuscular_junction__myasthenia_gravis',
  'Tetanus_Risussardonicus-Opisthotonos': 'ID__environmental__tetanus',
  Hydrocephalus_01: 'NEURO__pediatric__hydrocephalus',

  // OB
  PlacentalAbruption_RetroplacentalhematomaUS: 'OB__placental__placental_abruption',

  // Special image naming patterns (with folder context)
  'Epiglottitis_EM ENT_image51': 'PULM__upper_airway_emergency__acute_epiglottitis',
  'Epiglottitis_EM ENT_image55': 'PULM__upper_airway_emergency__acute_epiglottitis',
  'Epiglottitis_EM ENT_image56': 'PULM__upper_airway_emergency__acute_epiglottitis',
  'Epiglottitis_Foreign Body Aspiration_image': 'PULM__other__foreign_body_aspiration',
  'Ewing_Sarcoma_MSK Neoplasms_image': 'MSK__oncology__ewing_sarcoma',
  'Galeazzi_Fracture_Hand & Wrist_image': 'MSK__traumafracture__galeazzi_fracture',
  'Epidural_Hematoma_EM NEURO_image': 'NEURO__trauma__epidural_hematoma',
  'Basilar Skull Fracture Battle Sign': 'NEURO__trauma__basilar_skull_fracture',

  // Additional psychiatric
  MethMouth_Severedentalcaries: 'PSYCH__substance_use__methamphetamine_use_disorder',

  // Oncology
  'Osteosarcoma_Sunburst-Codmans': 'MSK__oncology__osteosarcoma',

  // === REMAINING UNMAPPED FROM DRY-RUN (2025-01-22) ===
  // These were identified in the unmapped-conditions.txt from the dry-run
  Crohn_s: 'GI__colon__crohn_disease',
  Avascular_Necrosis__AVN_: 'MSK__metabolicbone__avascular_necrosis_of_the_femoral_head',
  'Pneumonia_Oxygen Therapy': 'PULM__infectious__community_acquired_pneumonia',
  Normal_Sinus_Rhythm_EKG: 'CV__ecg__normal_sinus_rhythm_nsr',
  Normal_Sinus_Rhythm_Pituitary: 'CV__ecg__normal_sinus_rhythm_nsr',
  Second_Degree_AV_Block_Mobitz_I__Wenckebach_:
    'CV__conduction_disorders__second_degree_av_block_mobitz_i',
  Herpes_Zoster__Shingles__Varicella: 'DERM__infectious_viral__herpes_zoster_shingles',
  'Psoriasis_Vulva and Vaginal': 'DERM__papulosquamous__plaque_psoriasis',
  Acute_Angle_Closure_Glaucoma: 'HEENT__eye__glaucoma__acute_angleclosure_glaucoma',
  Central_Retinal_Vein_Occlusion__CRVO_: 'HEENT__eye__retina__central_retinal_vein_occlusion_crvo',
  Chronic_Lymphocytic_Leukemia__CLL_: 'HEME__leukemia__chronic_lymphocytic_leukemia_cll',
  Deep_Vein_Thrombosis__DVT_: 'CV__vascular_disease__deep_venous_thrombosis_dvt',
  Ethylene_Glycol_Poisoning: 'OTHER__toxicology__ethylene_glycol_poisoning',
  'Hyperkalemia_Electrolyte-Volume': 'ENDO__electrolyte__hyperkalemia',
  Legg_Calve_Perthes: 'MSK__pediatric__legg_calve_perthes',
  Normal_Pressure_Hydrocephalus__NPH_: 'NEURO__dementia__normal_pressure_hydrocephalus',
};

// Command line options
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const SKIP_AI = ARGS.includes('--skip-ai');
const FORCE_UPLOAD = ARGS.includes('--force');

interface ImageFile {
  path: string;
  filename: string;
  category: string;
  conditionName: string;
  conditionId: string | null;
  priority: number; // Lower = higher priority (curated vs misc)
  analysis?: ImageAnalysis;
  perceptualHash?: string;
}

interface ProcessingStats {
  total: number;
  matched: number;
  analyzed: number;
  uploaded: number;
  skipped: number;
  skippedAnnotated: number;
  skippedDuplicate: number;
  skippedMismatch: number;
  rerouted: number; // NEW: Images moved to AI-detected condition
  cropped: number;
  failed: number;
  unmapped: string[];
  conditionsWithImages: number;
  excellentImages: number;
  goodImages: number;
}

/**
 * Extract condition name from filename
 * Handles multiple naming patterns:
 * 1. Standard: "Condition_Name_1234.jpg" → "Condition_Name"
 * 2. Clinical: "ConditionName_Description_01.jpg" → "ConditionName_Description"
 * 3. Sorted images: "Condition_Name_Lecture Topic_image5.png" → "Condition_Name"
 */
function extractConditionName(filename: string): string {
  // Remove extension
  let name = filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');

  // Remove trailing image numbers (like _image5, _image51)
  name = name.replace(/_image\d+$/, '');

  // Remove trailing numbers (like _3890)
  name = name.replace(/_\d{4}$/, '');

  // Handle sorted_images format: "Condition_Name_Lecture Topic_image5.png"
  // The lecture topic part often has spaces and comes after the condition name
  // Split by underscore and look for parts that look like lecture names
  const parts = name.split('_');

  // Common lecture topic indicators (these parts should be removed)
  const lectureIndicators = [
    /^EM\s/i,
    /^CM\s/i,
    /^MSK\s/i,
    /^DERM\s/i,
    /^GI\s/i,
    /^CV\s/i,
    /^PULM\s/i,
    /^NEURO/i,
    /^HEENT/i,
    /^ID\s/i,
    /^ENDO/i,
    /^HEME/i,
    /^RENAL/i,
    /^GU\s/i,
    /Hemorrhage$/i,
    /Disorders$/i,
    /Disease$/i,
    /Diseases$/i,
    /Conditions$/i,
    /Infections$/i,
    /Neoplasms$/i,
    /Syndrome$/i,
    /Treatment$/i,
    /Management$/i,
    /^Intracranial/i,
    /^Behavioral/i,
    /^Emotional/i,
    /^Breast/i,
    /^Menstrual/i,
    /^Menopause/i,
    /^Pregnancy/i,
    /^Kidney/i,
    /^Surgical/i,
    /^Asthma/i,
    /^OBGYN/i,
    /^SURGERY/i,
    /^Arthritis$/i,
    /^Rheumatology$/i,
    /^Carditis$/i,
    /^Spirochetal$/i,
    /^Immunizations$/i,
    /^Sepsis$/i,
    /^Pleural$/i,
    /^COPD$/i,
    /^Hip$/i,
    /^Knee$/i,
    /^Lower\s/i,
    /^Upper\s/i,
    /^Hand\s/i,
    /^Wrist$/i,
    /^Gallbladder$/i,
    /^Esophagus$/i,
    /^Anorectal$/i,
    /^Movement$/i,
    /^Benign\s/i,
    /^Acneiform$/i,
    /^Biologics$/i,
    /^Gynecologic$/i,
    /^The\s/i,
    /^Red\s/i,
    /^Painful$/i,
    /Eye$/i,
    /^Ear$/i,
    /^Prostate$/i,
    /^Oxygen$/i,
    /^Therapy$/i,
    /^ARDS$/i,
    /^Measles$/i,
    /^ABG$/i,
    /^Septic$/i,
    /^Seizure$/i,
    /^CKD$/i,
    /^ENVIRONMENTAL$/i,
    /^EXPOSURES$/i,
    /^Therapeutics$/i,
    /^Complicated$/i,
    /^Infertility$/i,
    /^Mumps$/i,
    /^Parathyroid$/i,
    /^SHOCK$/i,
    /^Adrenal$/i,
    /^Corneal$/i,
    /^Ulcer$/i,
    /^Vulva$/i,
    /^Vaginal$/i,
    /^Myco$/i,
    /^Fungal$/i,
  ];

  // Find where the condition name ends and lecture topic begins
  const conditionParts: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Check if this part looks like a lecture topic indicator
    const isLectureTopic = lectureIndicators.some((regex) => regex.test(part));

    // Check if this part has a space (lecture topics often have spaces)
    const hasSpace = part.includes(' ');

    // If it's a lecture topic indicator or has spaces (except first 2 parts), stop
    if (isLectureTopic || (hasSpace && i >= 2)) {
      break;
    }

    conditionParts.push(part);
  }

  // Reconstruct condition name
  if (conditionParts.length > 0) {
    name = conditionParts.join('_');
  }

  // Handle Clinical folder format: "ConditionName_Description_01.jpg"
  // If there's a description after first underscore group, extract main condition
  const finalParts = name.split('_');
  if (finalParts.length > 2 && /^\d{2}$/.test(finalParts[finalParts.length - 1])) {
    // Clinical format with number suffix
    name = finalParts.slice(0, -1).join('_');
  }

  return name;
}

/**
 * Find condition ID for a given filename
 * Returns null if the condition ID doesn't exist in the database
 */
function findConditionId(conditionName: string, conditions: Map<string, string>): string | null {
  // Direct lookup in our mapping
  if (FILENAME_TO_CONDITION_MAP[conditionName]) {
    const mappedId = FILENAME_TO_CONDITION_MAP[conditionName];
    // Validate it exists in database
    if (isValidConditionId(mappedId)) {
      return mappedId;
    }
    // If not valid, fall through to try other methods
  }

  // Check clinical filename map
  for (const [pattern, condId] of Object.entries(CLINICAL_FILENAME_MAP)) {
    if (conditionName.includes(pattern)) {
      if (isValidConditionId(condId)) {
        return condId;
      }
    }
  }

  // Try normalized matching against database conditions (these are guaranteed valid)
  const normalizedSearch = conditionName
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');

  for (const [condId, condName] of conditions) {
    const normalizedName = condName.toLowerCase().replace(/[^a-z0-9 ]/g, '');

    // Exact match
    if (normalizedName === normalizedSearch) {
      return condId;
    }

    // Contains match (for partial matches)
    if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
      return condId;
    }
  }

  return null;
}

/**
 * Find condition ID from AI-detected condition name
 * More fuzzy matching for AI responses which may use different terminology
 */
function findConditionIdFromAIDetection(
  detectedCondition: string,
  conditions: Map<string, string>
): string | null {
  const normalizedDetected = detectedCondition.toLowerCase().replace(/[^a-z0-9 ]/g, '');

  // Common AI response → condition ID mappings
  const AI_RESPONSE_MAP: Record<string, string[]> = {
    'atrial fibrillation': ['CV__ecg__atrial_fibrillation', 'afib', 'a-fib'],
    'atrial flutter': ['CV__ecg__atrial_flutter'],
    'ventricular tachycardia': ['CV__ecg__ventricular_tachycardia', 'vtach', 'v-tach'],
    'ventricular fibrillation': ['CV__ecg__ventricular_fibrillation', 'vfib', 'v-fib'],
    'torsades de pointes': ['CV__ecg__torsades_de_pointes', 'torsades', 'tdp'],
    'sinus bradycardia': ['CV__ecg__sinus_bradycardia'],
    'sinus tachycardia': ['CV__ecg__sinus_tachycardia'],
    'first degree av block': ['CV__conduction_disorders__first_degree_av_block'],
    'second degree av block': ['CV__conduction_disorders__second_degree_av_block_mobitz_i'],
    'mobitz i': ['CV__conduction_disorders__second_degree_av_block_mobitz_i', 'wenckebach'],
    'mobitz ii': ['CV__conduction_disorders__second_degree_av_block_mobitz_ii'],
    'third degree av block': [
      'CV__conduction_disorders__third_degree_av_block',
      'complete heart block',
    ],
    'complete heart block': ['CV__conduction_disorders__third_degree_av_block'],
    'left bundle branch block': ['CV__conduction_disorders__left_bundle_branch_block', 'lbbb'],
    'right bundle branch block': ['CV__conduction_disorders__right_bundle_branch_block', 'rbbb'],
    stemi: ['CV__ischemic_heart_disease__stemi', 'st elevation myocardial infarction'],
    'myocardial infarction': ['CV__ischemic_heart_disease__stemi'],
    pericarditis: ['CV__carditis__pericarditis'],
    melanoma: ['DERM__oncology__melanoma'],
    'basal cell carcinoma': ['DERM__oncology__basal_cell_carcinoma', 'bcc'],
    'squamous cell carcinoma': ['DERM__oncology__squamous_cell_carcinoma', 'scc'],
    psoriasis: ['DERM__papulosquamous__plaque_psoriasis'],
    eczema: ['DERM__dermatitis__eczema__atopic_dermatitis'],
    'atopic dermatitis': ['DERM__dermatitis__eczema__atopic_dermatitis'],
    'seborrheic keratosis': ['DERM__benign_lesions__seborrheic_keratosis'],
    'actinic keratosis': ['DERM__oncology__actinic_keratosis'],
    'herpes zoster': ['DERM__infectious_viral__herpes_zoster_shingles', 'shingles'],
    shingles: ['DERM__infectious_viral__herpes_zoster_shingles'],
    pneumothorax: ['PULM__pleural_disease__pneumothorax'],
    'pleural effusion': ['PULM__pleural__pleural_effusion'],
    pneumonia: ['PULM__infectious__community_acquired_pneumonia'],
    'aortic dissection': ['CV__vascular_disease__aortic_dissection'],
    'pulmonary embolism': ['PULM__vascular__pulmonary_embolism'],
    'epidural hematoma': ['NEURO__trauma__epidural_hematoma'],
    'subdural hematoma': ['NEURO__trauma__subdural_hematoma'],
    'intracranial hemorrhage': ['NEURO__vascular__hemorrhagic_stroke'],
    'ischemic stroke': ['NEURO__vascular__ischemic_stroke'],
    'sweet syndrome': ['DERM__reactive__hypersensitivity__sweet_syndrome'],
    'erythema nodosum': ['DERM__reactive__hypersensitivity__erythema_nodosum'],
    'erythema multiforme': ['DERM__reactive__hypersensitivity__erythema_multiforme'],
  };

  // Check direct AI response map
  for (const [aiTerm, conditionIds] of Object.entries(AI_RESPONSE_MAP)) {
    if (normalizedDetected.includes(aiTerm) || aiTerm.includes(normalizedDetected)) {
      // Return first matching condition that exists in database
      for (const potentialId of conditionIds) {
        if (conditions.has(potentialId)) {
          return potentialId;
        }
      }
    }
  }

  // Fuzzy match against condition names
  for (const [condId, condName] of conditions) {
    const normalizedName = condName.toLowerCase().replace(/[^a-z0-9 ]/g, '');

    // Check if detected condition is similar
    if (
      normalizedName.includes(normalizedDetected) ||
      normalizedDetected.includes(normalizedName)
    ) {
      return condId;
    }

    // Check keywords overlap
    const detectedWords = normalizedDetected.split(' ').filter((w) => w.length > 3);
    const condWords = normalizedName.split(' ').filter((w) => w.length > 3);
    const overlap = detectedWords.filter((w) =>
      condWords.some((cw) => cw.includes(w) || w.includes(cw))
    );

    if (overlap.length >= 2 || (overlap.length === 1 && detectedWords.length === 1)) {
      return condId;
    }
  }

  return null;
}

/**
 * Scan folder for images
 */
function scanFolder(folderPath: string, category: string, priority: number): ImageFile[] {
  const files: ImageFile[] = [];

  if (!fs.existsSync(folderPath)) {
    console.log(`⚠️ Folder not found: ${folderPath}`);
    return files;
  }

  const items = fs.readdirSync(folderPath);

  for (const item of items) {
    if (item.startsWith('.')) continue;

    const ext = path.extname(item).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) continue;

    const conditionName = extractConditionName(item);

    files.push({
      path: path.join(folderPath, item),
      filename: item,
      category,
      conditionName,
      conditionId: null, // Will be populated later
      priority,
    });
  }

  return files;
}

/**
 * Upload image to Supabase Storage
 */
async function uploadImage(file: ImageFile): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(file.path);
    const ext = path.extname(file.filename).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/jpeg';

    // Create a unique filename
    const timestamp = Date.now();
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `conditions/${file.conditionId}/${timestamp}_${safeName}`;

    const { data, error } = await supabase.storage
      .from('medical-images')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error(`❌ Upload failed for ${file.filename}:`, error.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('medical-images').getPublicUrl(storagePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error(`❌ Error uploading ${file.filename}:`, err);
    return null;
  }
}

/**
 * Insert MediaAsset record using raw SQL
 */
async function insertMediaAsset(
  conditionId: string,
  imageUrl: string,
  filename: string,
  category: string,
  isAnnotated = false,
  quizSuitability = 'fair'
): Promise<boolean> {
  try {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    const id = `media_local_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Determine media type based on category
    let mediaType = 'clinical_photo';
    if (category === 'ECG') mediaType = 'ecg';
    else if (category === 'RADIOLOGY') mediaType = 'xray';
    else if (category === 'DERM') mediaType = 'clinical_photo';
    else if (category === 'CLINICAL') mediaType = 'clinical_photo';

    // Determine usage type based on suitability
    let usageType = 'quiz';
    if (quizSuitability === 'poor' || isAnnotated) {
      usageType = 'reference'; // Not suitable for quiz, use as reference only
    } else if (quizSuitability === 'excellent' || quizSuitability === 'good') {
      usageType = 'both'; // Great for quiz and reference
    }

    await client.query(
      `
      INSERT INTO "MediaAsset" (
        id, "conditionId", type, "originalUrl", filename, "sourceUrl", "isAnnotated", "usageType", "approvalStatus", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `,
      [
        id,
        conditionId,
        mediaType,
        imageUrl,
        filename,
        'PowerPoint Curated (AI Verified)',
        isAnnotated,
        usageType,
        'approved', // Auto-approve since these are curated
      ]
    );

    await client.end();
    return true;
  } catch (err) {
    console.error(`❌ DB insert failed:`, err);
    return false;
  }
}

/**
 * Check if condition already has enough images
 */
async function getExistingImageCount(conditionId: string): Promise<number> {
  try {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    const result = await client.query(
      `SELECT COUNT(*) as count FROM "MediaAsset" WHERE "conditionId" = $1`,
      [conditionId]
    );

    await client.end();
    return parseInt(result.rows[0].count, 10);
  } catch (err) {
    return 0;
  }
}

/**
 * Fetch all conditions from database
 */
async function fetchConditions(): Promise<Map<string, string>> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const result = await client.query(`SELECT id, name FROM "Condition"`);
  await client.end();

  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(row.id, row.name);
  }

  return map;
}

// Global set of valid condition IDs (populated from database)
let validConditionIds: Set<string> = new Set();

/**
 * Validate that a condition ID exists in the database
 */
function isValidConditionId(conditionId: string): boolean {
  return validConditionIds.has(conditionId);
}

/**
 * Main processing function
 */
async function main() {
  console.log('🖼️ AI-Enhanced Local Image Processor\n');
  console.log('='.repeat(60));

  // Show options
  if (DRY_RUN) console.log('🔍 DRY RUN MODE - No changes will be made');
  if (SKIP_AI) console.log('⏭️ AI analysis disabled');
  if (FORCE_UPLOAD) console.log('⚠️ Force mode - will upload annotated images');
  console.log('');

  // Initialize duplicate detector
  const duplicateDetector = new DuplicateDetector();

  // Fetch conditions from database
  console.log('📊 Fetching conditions from database...');
  const conditions = await fetchConditions();
  console.log(`Found ${conditions.size} conditions in database`);

  // Populate valid condition IDs set for validation
  validConditionIds = new Set(conditions.keys());

  // Load existing image hashes for duplicate detection
  console.log('🔍 Loading existing image hashes...');
  try {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await duplicateDetector.loadExistingHashes(client);
    await client.end();
  } catch (err) {
    console.warn('⚠️ Could not load existing hashes');
  }

  // Collect all images
  console.log('\n📁 Scanning image folders...');
  let allFiles: ImageFile[] = [];

  for (const source of IMAGE_SOURCES) {
    const folderPath = path.join(BASE_PATH, source.folder);
    const files = scanFolder(folderPath, source.category, source.priority);
    console.log(`  ${source.folder}: ${files.length} images`);
    allFiles = allFiles.concat(files);
  }

  // Deduplicate by filename - prefer higher priority (curated) sources
  const seenFilenames = new Map<string, ImageFile>();
  const deduplicatedFiles: ImageFile[] = [];
  let duplicatesRemoved = 0;

  for (const file of allFiles) {
    const key = file.filename.toLowerCase();
    if (seenFilenames.has(key)) {
      const existing = seenFilenames.get(key)!;
      if (file.priority < existing.priority) {
        // Replace with higher priority version
        const idx = deduplicatedFiles.indexOf(existing);
        if (idx !== -1) {
          deduplicatedFiles[idx] = file;
          seenFilenames.set(key, file);
        }
      }
      duplicatesRemoved++;
    } else {
      seenFilenames.set(key, file);
      deduplicatedFiles.push(file);
    }
  }

  allFiles = deduplicatedFiles;

  console.log(`\n📷 Total images found: ${allFiles.length + duplicatesRemoved}`);
  console.log(`   Duplicates removed: ${duplicatesRemoved}`);
  console.log(`   Unique images: ${allFiles.length}`);

  // Initialize stats
  const stats: ProcessingStats = {
    total: allFiles.length,
    matched: 0,
    analyzed: 0,
    uploaded: 0,
    skipped: 0,
    skippedAnnotated: 0,
    skippedDuplicate: 0,
    skippedMismatch: 0,
    rerouted: 0,
    cropped: 0,
    failed: 0,
    unmapped: [],
    conditionsWithImages: 0,
    excellentImages: 0,
    goodImages: 0,
  };

  // Match images to conditions
  console.log('\n🔗 Matching images to conditions...');
  const conditionImages = new Map<string, ImageFile[]>();

  for (const file of allFiles) {
    const condId = findConditionId(file.conditionName, conditions);
    file.conditionId = condId;

    if (condId) {
      stats.matched++;

      if (!conditionImages.has(condId)) {
        conditionImages.set(condId, []);
      }
      conditionImages.get(condId)!.push(file);
    } else {
      if (!stats.unmapped.includes(file.conditionName)) {
        stats.unmapped.push(file.conditionName);
      }
    }
  }

  console.log(`Matched: ${stats.matched} images to ${conditionImages.size} conditions`);
  console.log(`Unmapped condition names: ${stats.unmapped.length}`);

  // Process each condition - NO LIMIT: add all available images
  // User requested: "Lets not skip any just because there are already 5 images in there. Lets just continue adding"
  const MAX_IMAGES_PER_CONDITION = 999; // Effectively unlimited - add ALL images

  // Track rerouted images to add to proper condition
  const reroutedImages: ImageFile[] = [];

  console.log('\n🤖 Processing images with AI analysis...\n');

  let processedConditions = 0;
  const totalConditions = conditionImages.size;
  for (const [condId, files] of conditionImages) {
    processedConditions++;
    // Check existing image count
    const existingCount = await getExistingImageCount(condId);
    const needed = MAX_IMAGES_PER_CONDITION - existingCount;

    if (needed <= 0) {
      stats.skipped += files.length;
      console.log(
        `  [${processedConditions}/${totalConditions}] ${condId}: already has ${existingCount} images, skipping`
      );
      continue;
    }

    console.log(
      `  [${processedConditions}/${totalConditions}] Processing ${condId} (need ${needed} more images)...`
    );

    // Process and rank images by quality
    const candidateFiles: ImageFile[] = [];

    for (const file of files) {
      // Generate perceptual hash for duplicate detection
      file.perceptualHash = await generatePerceptualHash(file.path);

      // Check for duplicates
      if (duplicateDetector.isDuplicate(file.perceptualHash)) {
        stats.skippedDuplicate++;
        continue;
      }

      // AI Analysis (if not skipped)
      if (!SKIP_AI) {
        const conditionName = conditions.get(condId) || file.conditionName;
        file.analysis = await analyzeImage(file.path, {
          expectedCondition: conditionName,
          checkForAnnotations: true,
          suggestCropping: true,
        });
        stats.analyzed++;

        // Rate limit: wait between API calls
        await delay(API_DELAY_MS);

        // Handle condition mismatch - REROUTE instead of skip
        if (!file.analysis.matchesExpected && file.analysis.confidence > 0.7) {
          const detectedCond = file.analysis.detectedCondition;
          const suggestedId = file.analysis.suggestedConditionId;

          // Try to find the correct condition ID
          let newConditionId: string | null = null;

          // First try the suggested ID if provided
          if (suggestedId && conditions.has(suggestedId)) {
            newConditionId = suggestedId;
          } else if (detectedCond) {
            // Try to match detected condition to our database
            newConditionId = findConditionIdFromAIDetection(detectedCond, conditions);
          }

          if (newConditionId && newConditionId !== condId) {
            console.log(
              `  🔀 ${file.conditionName}: Rerouting to ${conditions.get(newConditionId) || newConditionId} (AI: ${detectedCond})`
            );
            file.conditionId = newConditionId;
            reroutedImages.push(file);
            stats.rerouted++;
            continue; // Don't process here, will be added to correct condition later
          } else {
            // Can't reroute - log but don't necessarily skip
            console.log(
              `  ℹ️ ${file.conditionName}: AI detected "${detectedCond}" but keeping original classification`
            );
          }
        }

        // Skip images with PROBLEMATIC annotations (not standard labels)
        if (
          file.analysis.hasAnnotations &&
          file.analysis.annotationType !== 'none' &&
          !FORCE_UPLOAD
        ) {
          // Check if cropping can help (for source text at edges)
          if ((file.analysis.hasSourceText || file.analysis.suggestedCrop) && isSharpAvailable()) {
            console.log(
              `  📐 ${file.conditionName}: Will crop to remove: ${file.analysis.annotationDetails.join(', ')}`
            );
            // Continue processing - will crop later
          } else if (
            file.analysis.annotationType === 'diagnostic_label' ||
            file.analysis.annotationType === 'answer_revealing'
          ) {
            console.log(
              `  ⚠️ ${file.conditionName}: Skipped (${file.analysis.annotationType}: ${file.analysis.annotationDetails.join(', ')})`
            );
            stats.skippedAnnotated++;
            continue;
          }
          // For other minor annotations, continue but note it
        }

        // Skip unusable images
        if (file.analysis.quizSuitability === 'unusable') {
          console.log(
            `  ⚠️ ${file.conditionName}: Skipped (${file.analysis.quizSuitabilityReason})`
          );
          stats.skipped++;
          continue;
        }

        // Track quality stats
        if (file.analysis.quizSuitability === 'excellent') stats.excellentImages++;
        else if (file.analysis.quizSuitability === 'good') stats.goodImages++;
      }

      candidateFiles.push(file);
    }

    // Sort by quiz suitability if we have analysis
    if (!SKIP_AI) {
      const suitabilityRank = { excellent: 0, good: 1, fair: 2, poor: 3, unusable: 4 };
      candidateFiles.sort((a, b) => {
        const rankA = suitabilityRank[a.analysis?.quizSuitability || 'fair'];
        const rankB = suitabilityRank[b.analysis?.quizSuitability || 'fair'];
        return rankA - rankB;
      });
    }

    // Upload best candidates
    const toUpload = candidateFiles.slice(0, needed);

    for (const file of toUpload) {
      const suitability = file.analysis?.quizSuitability || 'N/A';
      process.stdout.write(`  ${file.conditionName} [${suitability}]... `);

      if (DRY_RUN) {
        console.log('📋 (dry run)');
        stats.uploaded++;
        duplicateDetector.addImage(file.path, file.perceptualHash!);
        continue;
      }

      // Process image (crop if needed)
      let uploadPath = file.path;
      if (file.analysis?.suggestedCrop && isSharpAvailable()) {
        const cropResult = await processForQuiz(file.path, file.analysis.suggestedCrop);
        if (cropResult.success) {
          uploadPath = cropResult.outputPath;
          stats.cropped++;
        }
      }

      const url = await uploadImage({ ...file, path: uploadPath });
      if (!url) {
        stats.failed++;
        console.log('❌ upload failed');
        continue;
      }

      // Determine if annotated (after cropping attempt)
      const isAnnotated = file.analysis?.hasAnnotations && !file.analysis.suggestedCrop;

      const inserted = await insertMediaAsset(
        condId,
        url,
        file.filename,
        file.category,
        isAnnotated,
        file.analysis?.quizSuitability || 'fair'
      );

      if (inserted) {
        stats.uploaded++;
        duplicateDetector.addImage(file.path, file.perceptualHash!);
        console.log('✅');
      } else {
        stats.failed++;
        console.log('❌ db insert failed');
      }

      // Clean up processed file if different from original
      if (uploadPath !== file.path) {
        try {
          fs.unlinkSync(uploadPath);
        } catch (e) {
          console.error(e);
        }
      }

      // Rate limiting delay
      await new Promise((r) => setTimeout(r, 200));
    }

    processedConditions++;
    if (toUpload.length > 0) stats.conditionsWithImages++;
  }

  // Process rerouted images - add them to their correct conditions
  if (reroutedImages.length > 0) {
    console.log(`\n🔀 Processing ${reroutedImages.length} rerouted images...\n`);

    // Group by new condition
    const reroutedByCondition = new Map<string, ImageFile[]>();
    for (const file of reroutedImages) {
      if (!file.conditionId) continue;
      if (!reroutedByCondition.has(file.conditionId)) {
        reroutedByCondition.set(file.conditionId, []);
      }
      reroutedByCondition.get(file.conditionId)!.push(file);
    }

    for (const [condId, files] of reroutedByCondition) {
      const existingCount = await getExistingImageCount(condId);
      const needed = MAX_IMAGES_PER_CONDITION - existingCount;

      if (needed <= 0) continue;

      const toUpload = files.slice(0, needed);
      for (const file of toUpload) {
        const suitability = file.analysis?.quizSuitability || 'N/A';
        const condName = conditions.get(condId) || condId;
        process.stdout.write(`  → ${condName} [${suitability}]... `);

        if (DRY_RUN) {
          console.log('📋 (dry run - rerouted)');
          stats.uploaded++;
          duplicateDetector.addImage(file.path, file.perceptualHash!);
          continue;
        }

        const url = await uploadImage({ ...file, conditionId: condId });
        if (!url) {
          stats.failed++;
          console.log('❌ upload failed');
          continue;
        }

        const inserted = await insertMediaAsset(
          condId,
          url,
          file.filename,
          file.category,
          false,
          file.analysis?.quizSuitability || 'fair'
        );

        if (inserted) {
          stats.uploaded++;
          duplicateDetector.addImage(file.path, file.perceptualHash!);
          console.log('✅ (rerouted)');
        } else {
          stats.failed++;
          console.log('❌ db insert failed');
        }

        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Processing Summary\n');
  console.log(`  Total images found:        ${stats.total}`);
  console.log(`  Matched to conditions:     ${stats.matched}`);
  console.log(`  AI analyzed:               ${stats.analyzed}`);
  console.log(`  Successfully uploaded:     ${stats.uploaded}`);
  console.log(`  Images rerouted by AI:     ${stats.rerouted}`);
  console.log(`  Images cropped:            ${stats.cropped}`);
  console.log(`  Excellent quality:         ${stats.excellentImages}`);
  console.log(`  Good quality:              ${stats.goodImages}`);
  console.log(`  Skipped (already have):    ${stats.skipped}`);
  console.log(`  Skipped (bad annotations): ${stats.skippedAnnotated}`);
  console.log(`  Skipped (duplicates):      ${stats.skippedDuplicate}`);
  console.log(`  Failed:                    ${stats.failed}`);
  console.log(`  Conditions with images:    ${stats.conditionsWithImages}`);
  console.log(`  Conditions processed:      ${processedConditions}`);

  if (stats.unmapped.length > 0) {
    console.log('\n⚠️ Unmapped condition names (need manual mapping):');
    stats.unmapped.slice(0, 20).forEach((name) => console.log(`  - ${name}`));
    if (stats.unmapped.length > 20) {
      console.log(`  ... and ${stats.unmapped.length - 20} more`);
    }
    // Write all unmapped to file for review
    const unmappedPath = path.join(process.cwd(), 'unmapped-conditions.txt');
    fs.writeFileSync(unmappedPath, stats.unmapped.sort().join('\n'));
    console.log(`  Full list written to: unmapped-conditions.txt`);
  }

  // Show duplicate summary
  const duplicates = duplicateDetector.getDuplicates();
  if (duplicates.size > 0) {
    console.log(`\n🔄 Found ${duplicates.size} sets of duplicate images`);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
