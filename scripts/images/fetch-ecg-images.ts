#!/usr/bin/env npx tsx
/**
 * ECG Image Fetcher - Specialized Script
 *
 * Fetches ECG images from Wikimedia Commons for PA student visual diagnosis training.
 * Strict criteria for ECG-specific adequacy.
 *
 * ECG Adequacy Criteria:
 * - Must show clear ECG tracing (rhythm strip or 12-lead)
 * - Must have visible grid/calibration
 * - No excessive annotations covering the tracing
 * - Readable rhythm and key features
 * - Not a diagram/illustration (must be actual ECG recording)
 *
 * Usage:
 *   npx tsx scripts/images/fetch-ecg-images.ts
 *   npx tsx scripts/images/fetch-ecg-images.ts --dry-run
 *   npx tsx scripts/images/fetch-ecg-images.ts --condition="atrial fibrillation"
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import 'dotenv/config';

const prisma = new PrismaClient();

// Supabase Storage
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_BUCKET = 'medical-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Gemini for AI verification - use SDK like the working content generator
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '').trim();
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Rate limiting configuration
const RATE_LIMIT = {
  baseDelayMs: 3000, // 3 seconds between API calls
  maxDelayMs: 60000, // Max 60 second backoff
  searchDelayMs: 1500, // 1.5 seconds between searches
  rateLimitBackoffMs: 30000, // 30 second initial backoff on 429
};
let currentBackoff = RATE_LIMIT.baseDelayMs;
let apiCallCount = 0;

async function rateLimitedDelay(afterError = false): Promise<void> {
  if (afterError) {
    // Exponential backoff on errors
    currentBackoff = Math.min(currentBackoff * 2, RATE_LIMIT.maxDelayMs);
    console.log(`  ⏳ Rate limit backoff: ${currentBackoff / 1000}s`);
  } else {
    // Reset backoff on success
    currentBackoff = RATE_LIMIT.baseDelayMs;
  }
  await new Promise((r) => setTimeout(r, currentBackoff));
  apiCallCount++;

  // Extra pause every 10 API calls
  if (apiCallCount % 10 === 0) {
    console.log(`  ⏳ Periodic cooldown (${apiCallCount} API calls)...`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ============================================================================
// ECG CONDITIONS - High-yield for PANCE
// ============================================================================

interface ECGCondition {
  conditionId: string;
  name: string;
  searchTerms: string[];
  correctDiagnosis: string;
  distractors: string[];
  visualFindings: string;
  clinicalContext: string;
  targetImageCount: number; // Minimum images to fetch (10 default, more for high-yield)
}

// High-yield conditions get 20+ images, standard conditions get 10
const ECG_CONDITIONS: ECGCondition[] = [
  // Arrhythmias - HIGH YIELD
  {
    conditionId: 'CV__ecg__atrial_fibrillation',
    name: 'Atrial Fibrillation',
    searchTerms: [
      'atrial fibrillation ECG',
      'afib rhythm strip ECG',
      'irregular irregular ECG',
      'atrial fibrillation 12 lead',
      'AFib RVR ECG',
    ],
    correctDiagnosis: 'Atrial Fibrillation',
    distractors: ['Atrial Flutter', 'Multifocal Atrial Tachycardia', 'Sinus Arrhythmia'],
    visualFindings: 'Irregularly irregular R-R intervals, absent P waves, fibrillatory baseline',
    clinicalContext:
      'Most common sustained arrhythmia. Risk of stroke, managed with rate/rhythm control and anticoagulation.',
    targetImageCount: 25, // Very high yield - most common arrhythmia
  },
  {
    conditionId: 'CV__ecg__atrial_flutter',
    name: 'Atrial Flutter',
    searchTerms: [
      'atrial flutter ECG',
      'sawtooth flutter waves ECG',
      'flutter pattern ECG',
      'typical atrial flutter',
    ],
    correctDiagnosis: 'Atrial Flutter',
    distractors: ['Atrial Fibrillation', 'SVT', 'Sinus Tachycardia'],
    visualFindings:
      'Sawtooth flutter waves (F waves) at ~300 bpm, typically with 2:1 block giving ventricular rate ~150',
    clinicalContext:
      'Macro-reentrant circuit in right atrium. Often converts to A-fib. Similar stroke risk.',
    targetImageCount: 15,
  },
  {
    conditionId: 'CV__ecg__ventricular_tachycardia',
    name: 'Ventricular Tachycardia',
    searchTerms: [
      'ventricular tachycardia ECG',
      'VT rhythm strip',
      'wide complex tachycardia ECG',
      'monomorphic VT',
      'polymorphic VT',
    ],
    correctDiagnosis: 'Ventricular Tachycardia',
    distractors: ['SVT with aberrancy', 'Sinus Tachycardia with BBB', 'Torsades de Pointes'],
    visualFindings: 'Wide QRS (>120ms), regular rhythm, rate >100bpm, AV dissociation',
    clinicalContext:
      'Life-threatening arrhythmia. May degenerate to V-fib. Treat with cardioversion/amiodarone.',
    targetImageCount: 20, // Critical to recognize
  },
  {
    conditionId: 'CV__ecg__ventricular_fibrillation',
    name: 'Ventricular Fibrillation',
    searchTerms: [
      'ventricular fibrillation ECG',
      'VFib rhythm strip',
      'chaotic ventricular rhythm ECG',
      'coarse VFib',
      'fine VFib',
    ],
    correctDiagnosis: 'Ventricular Fibrillation',
    distractors: ['Fine Atrial Fibrillation', 'Artifact', 'Asystole'],
    visualFindings: 'Chaotic, disorganized waveforms without identifiable QRS complexes',
    clinicalContext:
      'Cardiac arrest rhythm. Immediately defibrillate. CPR until defibrillator ready.',
    targetImageCount: 15, // Critical to recognize
  },
  {
    conditionId: 'CV__ecg__supraventricular_tachycardia',
    name: 'Supraventricular Tachycardia',
    searchTerms: [
      'SVT ECG',
      'supraventricular tachycardia ECG',
      'narrow complex tachycardia ECG',
      'AVNRT ECG',
      'AVRT ECG',
    ],
    correctDiagnosis: 'Supraventricular Tachycardia (SVT)',
    distractors: ['Sinus Tachycardia', 'Atrial Flutter', 'Atrial Fibrillation'],
    visualFindings:
      'Narrow QRS, regular, very rapid rate (150-250 bpm), absent or retrograde P waves',
    clinicalContext: 'AVNRT most common. Vagal maneuvers, adenosine for acute termination.',
    targetImageCount: 15,
  },
  // STEMI patterns - EXTREMELY HIGH YIELD
  {
    conditionId: 'CV__ecg__anterior_stemi',
    name: 'Anterior STEMI',
    searchTerms: [
      'anterior STEMI ECG',
      'anterior wall MI ECG',
      'LAD occlusion ECG',
      'anterior MI 12 lead',
      'tombstone T waves',
    ],
    correctDiagnosis: 'Anterior STEMI',
    distractors: ['Pericarditis', 'Early Repolarization', 'LVH strain pattern'],
    visualFindings: 'ST elevation in V1-V4, reciprocal ST depression in inferior leads',
    clinicalContext: 'LAD territory. High mortality. Door-to-balloon <90 min critical.',
    targetImageCount: 25, // Most critical - must recognize immediately
  },
  {
    conditionId: 'CV__ecg__inferior_stemi',
    name: 'Inferior STEMI',
    searchTerms: [
      'inferior STEMI ECG',
      'inferior wall MI ECG',
      'RCA occlusion ECG',
      'inferior MI 12 lead',
    ],
    correctDiagnosis: 'Inferior STEMI',
    distractors: ['Pericarditis', 'PE', 'Early Repolarization'],
    visualFindings: 'ST elevation in II, III, aVF with reciprocal depression in I, aVL',
    clinicalContext:
      'RCA or circumflex territory. Check for RV involvement (V4R). Avoid nitrates if RV MI.',
    targetImageCount: 25, // Most critical - must recognize immediately
  },
  {
    conditionId: 'CV__ecg__lateral_stemi',
    name: 'Lateral STEMI',
    searchTerms: [
      'lateral STEMI ECG',
      'lateral wall MI ECG',
      'circumflex occlusion ECG',
      'high lateral STEMI',
    ],
    correctDiagnosis: 'Lateral STEMI',
    distractors: ['LVH', 'Pericarditis', 'Posterior STEMI'],
    visualFindings: 'ST elevation in I, aVL, V5-V6',
    clinicalContext: 'Circumflex territory. May be electrically silent. Check posterior leads.',
    targetImageCount: 20,
  },
  // Heart blocks - HIGH YIELD
  {
    conditionId: 'CV__conduction_disorders__first_degree_av_block',
    name: 'First Degree AV Block',
    searchTerms: [
      'first degree heart block ECG',
      'prolonged PR interval ECG',
      '1st degree AV block',
      'first degree AV block',
    ],
    correctDiagnosis: 'First Degree AV Block',
    distractors: ['Normal ECG', 'Second Degree AV Block', 'WPW'],
    visualFindings: 'PR interval >200ms (>1 large box), every P wave followed by QRS',
    clinicalContext: 'Usually benign. No treatment needed. Monitor for progression.',
    targetImageCount: 10,
  },
  {
    conditionId: 'CV__conduction_disorders__second_degree_av_block_mobitz_i',
    name: 'Second Degree AV Block Type I (Wenckebach)',
    searchTerms: [
      'Wenckebach ECG',
      'Mobitz I ECG',
      'second degree heart block type 1 ECG',
      'Mobitz type I',
    ],
    correctDiagnosis: 'Second Degree AV Block Type I (Wenckebach)',
    distractors: ['Mobitz II', 'Third Degree Block', 'Sinus Arrhythmia'],
    visualFindings: 'Progressive PR prolongation until dropped beat, grouped beating pattern',
    clinicalContext:
      'AV nodal level. Usually benign, especially with inferior MI. May resolve spontaneously.',
    targetImageCount: 15,
  },
  {
    conditionId: 'CV__conduction_disorders__second_degree_av_block_mobitz_ii',
    name: 'Second Degree AV Block Type II',
    searchTerms: [
      'Mobitz II ECG',
      'Mobitz type 2 heart block ECG',
      'second degree heart block type 2',
      'Mobitz type II',
    ],
    correctDiagnosis: 'Second Degree AV Block Type II',
    distractors: ['Mobitz I', 'Third Degree Block', 'High Grade AV Block'],
    visualFindings: 'Constant PR interval with suddenly dropped QRS, often with wide QRS',
    clinicalContext:
      'Below AV node (His-Purkinje). High risk of progression to complete block. Pacemaker indicated.',
    targetImageCount: 15, // Important to distinguish from Mobitz I
  },
  {
    conditionId: 'CV__conduction_disorders__third_degree_av_block',
    name: 'Third Degree (Complete) Heart Block',
    searchTerms: [
      'complete heart block ECG',
      'third degree AV block ECG',
      '3rd degree heart block',
      'complete AV block',
    ],
    correctDiagnosis: 'Third Degree (Complete) Heart Block',
    distractors: ['Second Degree Block', 'AV Dissociation', 'Junctional Rhythm'],
    visualFindings:
      'Complete AV dissociation - P waves and QRS independent, regular atrial and ventricular rates',
    clinicalContext:
      'No AV conduction. Escape rhythm (junctional or ventricular). Pacemaker required.',
    targetImageCount: 20, // Critical to recognize
  },
  // Bundle branch blocks - HIGH YIELD
  {
    conditionId: 'CV__conduction_disorders__left_bundle_branch_block',
    name: 'Left Bundle Branch Block (LBBB)',
    searchTerms: ['LBBB ECG', 'left bundle branch block ECG', 'William pattern ECG', 'new LBBB'],
    correctDiagnosis: 'Left Bundle Branch Block (LBBB)',
    distractors: ['RBBB', 'WPW', 'Ventricular Paced Rhythm'],
    visualFindings: 'Wide QRS >120ms, broad/notched R in I, aVL, V5-V6 (WiLLiam), deep S in V1',
    clinicalContext:
      'Often indicates structural heart disease. New LBBB with chest pain = STEMI equivalent.',
    targetImageCount: 20, // New LBBB = STEMI equivalent
  },
  {
    conditionId: 'CV__conduction_disorders__right_bundle_branch_block',
    name: 'Right Bundle Branch Block (RBBB)',
    searchTerms: [
      'RBBB ECG',
      'right bundle branch block ECG',
      'MaRRoW pattern ECG',
      'RSR prime V1',
    ],
    correctDiagnosis: 'Right Bundle Branch Block (RBBB)',
    distractors: ['LBBB', 'WPW', 'LVH'],
    visualFindings: "Wide QRS >120ms, RSR' pattern in V1-V2 (MaRRoW), wide S wave in I, V6",
    clinicalContext: 'May be benign or indicate RV strain (PE), septal defects. Evaluate cause.',
    targetImageCount: 15,
  },
  // Other ECG findings
  {
    conditionId: 'CV__ecg__hyperkalemia',
    name: 'Hyperkalemia (ECG)',
    searchTerms: [
      'hyperkalemia ECG',
      'peaked T waves ECG',
      'potassium toxicity ECG',
      'tall T waves hyperkalemia',
      'sine wave ECG',
    ],
    correctDiagnosis: 'Hyperkalemia',
    distractors: ['Benign Early Repolarization', 'Posterior STEMI', 'Normal variant'],
    visualFindings: 'Peaked T waves, widened QRS, prolonged PR, eventually sine wave pattern',
    clinicalContext:
      'Medical emergency. Calcium gluconate for cardiac protection, then shift/eliminate potassium.',
    targetImageCount: 20, // Medical emergency - critical to recognize
  },
  {
    conditionId: 'CV__ecg__long_qt_syndrome',
    name: 'Long QT Syndrome',
    searchTerms: [
      'long QT syndrome ECG',
      'prolonged QT interval ECG',
      'QT prolongation',
      'acquired long QT',
    ],
    correctDiagnosis: 'Long QT Syndrome',
    distractors: ['Normal QT', 'U wave', 'Hypocalcemia'],
    visualFindings: 'QTc >450-470ms, may show T wave abnormalities, risk for Torsades',
    clinicalContext:
      'Risk of Torsades de Pointes. Review medications (antipsychotics, antibiotics). Correct electrolytes.',
    targetImageCount: 15,
  },
  {
    conditionId: 'CV__conduction_disorders__wolff_parkinson_white_syndrome',
    name: 'Wolff-Parkinson-White Syndrome',
    searchTerms: [
      'WPW syndrome ECG',
      'delta wave ECG',
      'Wolff Parkinson White ECG',
      'pre-excitation ECG',
      'short PR delta wave',
    ],
    correctDiagnosis: 'Wolff-Parkinson-White (WPW) Syndrome',
    distractors: ['LBBB', 'Inferior MI', 'LVH'],
    visualFindings: 'Short PR (<120ms), delta wave (slurred QRS upstroke), wide QRS',
    clinicalContext:
      'Accessory pathway. Risk of rapid A-fib with 1:1 conduction. Avoid AV nodal blockers in A-fib.',
    targetImageCount: 15,
  },
  {
    conditionId: 'CV__ecg__pericarditis_ecg',
    name: 'Pericarditis',
    searchTerms: [
      'pericarditis ECG',
      'diffuse ST elevation ECG',
      'PR depression ECG',
      'Spodick sign ECG',
    ],
    correctDiagnosis: 'Acute Pericarditis',
    distractors: ['STEMI', 'Early Repolarization', 'Myocarditis'],
    visualFindings:
      'Diffuse ST elevation (concave up), PR depression, Spodick sign (downsloping TP segment)',
    clinicalContext: 'Viral most common. NSAIDs + colchicine. Rule out effusion with echo.',
    targetImageCount: 20, // Important to distinguish from STEMI
  },
  {
    conditionId: 'CV__ecg__pulmonary_embolism',
    name: 'Pulmonary Embolism (ECG)',
    searchTerms: [
      'pulmonary embolism ECG',
      'S1Q3T3 ECG',
      'PE ECG findings',
      'right heart strain ECG',
    ],
    correctDiagnosis: 'Pulmonary Embolism',
    distractors: ['Inferior STEMI', 'Right Heart Strain', 'RBBB'],
    visualFindings:
      'S1Q3T3 (classic but rare), sinus tachycardia (most common), RBBB, right axis deviation',
    clinicalContext:
      'ECG often nonspecific. Sinus tach most common. CT-PA gold standard for diagnosis.',
    targetImageCount: 15,
  },
  {
    conditionId: 'CV__ecg__sinus_bradycardia',
    name: 'Sinus Bradycardia',
    searchTerms: [
      'sinus bradycardia ECG',
      'slow heart rate ECG',
      'bradycardia rhythm strip',
      'symptomatic bradycardia',
    ],
    correctDiagnosis: 'Sinus Bradycardia',
    distractors: [
      'Junctional Rhythm',
      'Heart Block',
      'Atrial Fibrillation with slow ventricular response',
    ],
    visualFindings: 'Normal P waves before each QRS, regular rhythm, rate <60 bpm',
    clinicalContext: 'May be normal (athletes, sleep). If symptomatic: atropine, pacing if severe.',
    targetImageCount: 10,
  },
  // Additional high-yield conditions from database
  {
    conditionId: 'CV__ecg__sinus_tachycardia',
    name: 'Sinus Tachycardia',
    searchTerms: ['sinus tachycardia ECG', 'fast sinus rhythm ECG', 'tachycardia normal P waves'],
    correctDiagnosis: 'Sinus Tachycardia',
    distractors: ['SVT', 'Atrial Flutter', 'Atrial Fibrillation'],
    visualFindings: 'Normal P waves before each QRS, regular rhythm, rate >100 bpm',
    clinicalContext: 'Usually reactive (fever, pain, dehydration, anemia). Treat underlying cause.',
    targetImageCount: 10,
  },
  {
    conditionId: 'CV__ecg__torsades_de_pointes',
    name: 'Torsades de Pointes',
    searchTerms: [
      'torsades de pointes ECG',
      'polymorphic VT ECG',
      'twisting of the points ECG',
      'long QT torsades',
    ],
    correctDiagnosis: 'Torsades de Pointes',
    distractors: ['Ventricular Fibrillation', 'Monomorphic VT', 'Artifact'],
    visualFindings:
      'Polymorphic VT with QRS complexes twisting around baseline, associated with long QT',
    clinicalContext:
      'Often drug-induced (QT-prolonging drugs). Treat with IV magnesium, correct QT prolongation.',
    targetImageCount: 15,
  },
  {
    conditionId: 'CV__ecg__premature_ventricular_complexes_pvcs',
    name: 'Premature Ventricular Complexes (PVCs)',
    searchTerms: [
      'PVC ECG',
      'premature ventricular contraction ECG',
      'ventricular ectopy ECG',
      'bigeminy PVCs',
    ],
    correctDiagnosis: 'Premature Ventricular Complexes (PVCs)',
    distractors: ['PACs', 'Aberrant Conduction', 'Ventricular Tachycardia'],
    visualFindings: 'Wide bizarre QRS (>120ms), no preceding P wave, compensatory pause',
    clinicalContext:
      'Usually benign if uniform. Concerning if frequent (>10%), multifocal, or R-on-T.',
    targetImageCount: 12,
  },
  {
    conditionId: 'CV__ecg__premature_atrial_complexes_pacs',
    name: 'Premature Atrial Complexes (PACs)',
    searchTerms: [
      'PAC ECG',
      'premature atrial contraction ECG',
      'atrial ectopy ECG',
      'atrial premature beat',
    ],
    correctDiagnosis: 'Premature Atrial Complexes (PACs)',
    distractors: ['PVCs', 'Sinus Arrhythmia', 'Atrial Fibrillation'],
    visualFindings:
      'Early P wave (different morphology), narrow QRS, incomplete compensatory pause',
    clinicalContext: 'Usually benign. May trigger atrial fibrillation if frequent.',
    targetImageCount: 10,
  },
  {
    conditionId: 'CV__ecg__wellens_syndrome',
    name: 'Wellens Syndrome',
    searchTerms: [
      'Wellens syndrome ECG',
      'Wellens sign ECG',
      'LAD stenosis ECG',
      'biphasic T waves V2 V3',
    ],
    correctDiagnosis: 'Wellens Syndrome',
    distractors: ['NSTEMI', 'Pericarditis', 'Normal variant'],
    visualFindings: 'Biphasic or deeply inverted T waves in V2-V3 during pain-free interval',
    clinicalContext:
      'High-grade LAD stenosis. Do NOT stress test - high risk of anterior MI. Needs cath.',
    targetImageCount: 12,
  },
  {
    conditionId: 'CV__ecg__de_winter_t_waves',
    name: 'De Winter T Waves',
    searchTerms: ['De Winter T waves ECG', 'De Winter pattern ECG', 'LAD occlusion ECG pattern'],
    correctDiagnosis: 'De Winter T Waves',
    distractors: ['Hyperkalemia', 'Early Repolarization', 'Anterior STEMI'],
    visualFindings: 'ST depression at J point with upsloping ST into tall, peaked T waves in V1-V6',
    clinicalContext: 'LAD occlusion STEMI equivalent. Emergent cath despite no ST elevation.',
    targetImageCount: 10,
  },
  {
    conditionId: 'CV__ecg__left_ventricular_hypertrophy',
    name: 'Left Ventricular Hypertrophy (LVH)',
    searchTerms: [
      'LVH ECG',
      'left ventricular hypertrophy ECG',
      'voltage criteria LVH',
      'strain pattern ECG',
    ],
    correctDiagnosis: 'Left Ventricular Hypertrophy (LVH)',
    distractors: ['Normal variant', 'LBBB', 'Anterior STEMI'],
    visualFindings: 'Increased QRS voltage (SV1 + RV5/6 > 35mm), strain pattern (ST-T changes)',
    clinicalContext: 'Associated with hypertension, aortic stenosis. Masks STEMI diagnosis.',
    targetImageCount: 12,
  },
  {
    conditionId: 'CV__ecg__hypokalemia',
    name: 'Hypokalemia (ECG)',
    searchTerms: [
      'hypokalemia ECG',
      'low potassium ECG',
      'U wave ECG',
      'flattened T waves hypokalemia',
    ],
    correctDiagnosis: 'Hypokalemia',
    distractors: ['Long QT', 'Digoxin Effect', 'Normal variant'],
    visualFindings: 'Flattened T waves, prominent U waves, ST depression, prolonged QT',
    clinicalContext: 'Risk of arrhythmias including Torsades. Replete potassium (and magnesium).',
    targetImageCount: 12,
  },
  {
    conditionId: 'CV__ecg__digoxin_effect',
    name: 'Digoxin Effect (ECG)',
    searchTerms: [
      'digoxin effect ECG',
      'digitalis effect ECG',
      'Salvador Dali mustache ECG',
      'scooped ST segment',
    ],
    correctDiagnosis: 'Digoxin Effect',
    distractors: ['Ischemia', 'Hypokalemia', 'LVH strain'],
    visualFindings:
      'Scooped ST depression (Salvador Dali mustache), shortened QT, may have T wave inversion',
    clinicalContext: 'Therapeutic effect, not toxicity. Different from digoxin toxicity.',
    targetImageCount: 10,
  },
  {
    conditionId: 'CV__ecg__junctional_rhythm',
    name: 'Junctional Rhythm',
    searchTerms: ['junctional rhythm ECG', 'junctional escape rhythm ECG', 'AV junctional rhythm'],
    correctDiagnosis: 'Junctional Rhythm',
    distractors: ['Sinus Bradycardia', 'Complete Heart Block', 'Atrial Fibrillation'],
    visualFindings: 'Narrow QRS, absent/inverted P waves, regular rate 40-60 bpm',
    clinicalContext:
      'Escape rhythm when SA node fails. Rate 40-60 bpm. May need pacing if symptomatic.',
    targetImageCount: 10,
  },
  {
    conditionId: 'CV__ecg__early_repolarization',
    name: 'Early Repolarization',
    searchTerms: [
      'early repolarization ECG',
      'benign early repolarization ECG',
      'J point elevation ECG',
    ],
    correctDiagnosis: 'Early Repolarization (Benign)',
    distractors: ['STEMI', 'Pericarditis', 'Brugada Syndrome'],
    visualFindings:
      'J point elevation with concave ST elevation, most prominent in V2-V5, young patients',
    clinicalContext:
      'Usually benign, especially in young athletes. Distinguish from STEMI/pericarditis.',
    targetImageCount: 12,
  },
  {
    conditionId: 'CV__ecg__posterior_stemi',
    name: 'Posterior STEMI',
    searchTerms: [
      'posterior STEMI ECG',
      'posterior MI ECG',
      'ST depression V1 V2 V3 reciprocal',
      'posterior leads ECG',
    ],
    correctDiagnosis: 'Posterior STEMI',
    distractors: ['Anterior NSTEMI', 'LBBB', 'RVH'],
    visualFindings:
      'ST depression in V1-V3 (reciprocal), tall R waves V1-V2, check V7-V9 for ST elevation',
    clinicalContext: 'Often missed - isolated posterior MI. Check posterior leads V7-V9.',
    targetImageCount: 12,
  },
];

// ============================================================================
// WIKIMEDIA COMMONS API
// ============================================================================

async function searchWikimediaImages(searchTerm: string, limit: number = 10): Promise<any[]> {
  const baseUrl = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchTerm} filetype:bitmap`,
    gsrlimit: limit.toString(),
    gsrnamespace: '6', // File namespace
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });

  const url = `${baseUrl}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent':
          'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
      },
    };
    https
      .get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const pages = json.query?.pages || {};
            const results = Object.values(pages).map((page: any) => ({
              title: page.title,
              url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
              originalUrl: page.imageinfo?.[0]?.url,
              description: page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || '',
              license: page.imageinfo?.[0]?.extmetadata?.License?.value || 'Unknown',
              author: page.imageinfo?.[0]?.extmetadata?.Artist?.value || 'Unknown',
              mime: page.imageinfo?.[0]?.mime,
              width: page.imageinfo?.[0]?.width,
              height: page.imageinfo?.[0]?.height,
              source: 'wikimedia',
            }));
            resolve(results);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

// ============================================================================
// ECGPEDIA / CARDIONETWORKS API (Additional Source)
// ============================================================================

async function searchECGpedia(searchTerm: string, limit: number = 10): Promise<any[]> {
  // ECGpedia is hosted on Wikimedia Commons as CardioNetworks
  // Search specifically for CardioNetworks ECG images which are high quality
  const baseUrl = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchTerm} CardioNetworks ECGpedia filetype:bitmap`,
    gsrlimit: limit.toString(),
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });

  const url = `${baseUrl}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent':
          'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
      },
    };
    https
      .get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const pages = json.query?.pages || {};
            const results = Object.values(pages).map((page: any) => ({
              title: page.title,
              url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
              originalUrl: page.imageinfo?.[0]?.url,
              description: page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || '',
              license: page.imageinfo?.[0]?.extmetadata?.License?.value || 'CC',
              author: 'CardioNetworks/ECGpedia',
              mime: page.imageinfo?.[0]?.mime,
              width: page.imageinfo?.[0]?.width,
              height: page.imageinfo?.[0]?.height,
              source: 'ecgpedia',
            }));
            resolve(results);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

// ============================================================================
// COMBINED SEARCH - Multiple Sources
// ============================================================================

async function searchAllSources(searchTerm: string, limit: number = 10): Promise<any[]> {
  const results: any[] = [];

  // Try ECGpedia first (higher quality ECGs)
  try {
    const ecgpediaResults = await searchECGpedia(searchTerm, Math.ceil(limit / 2));
    results.push(...ecgpediaResults);
    await new Promise((r) => setTimeout(r, 500)); // Brief pause between APIs
  } catch (e) {
    console.log(`    ⚠️ ECGpedia search failed: ${e}`);
  }

  // Then Wikimedia general search
  try {
    const wikimediaResults = await searchWikimediaImages(searchTerm, limit);
    // Filter out duplicates by URL
    const existingUrls = new Set(results.map((r) => r.originalUrl));
    const newResults = wikimediaResults.filter((r) => !existingUrls.has(r.originalUrl));
    results.push(...newResults);
  } catch (e) {
    console.log(`    ⚠️ Wikimedia search failed: ${e}`);
  }

  return results.slice(0, limit * 2); // Return more results from combined sources
}

// ============================================================================
// AI VERIFICATION - ECG-SPECIFIC
// ============================================================================

interface ECGAnalysis {
  isValidECG: boolean;
  isActualRecording: boolean; // vs diagram/illustration
  hasVisibleGrid: boolean;
  readabilityScore: number; // 1-10
  annotationLevel: 'none' | 'minimal' | 'moderate' | 'heavy';
  detectedRhythm: string;
  matchesCondition: boolean;
  confidence: number;
  rejectReason?: string;
  accept: boolean;
}

// Max image size for Gemini (4MB after base64 = ~3MB original)
const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

async function analyzeECGImage(
  imageUrl: string,
  expectedCondition: string,
  retryCount = 0
): Promise<ECGAnalysis | null> {
  if (!genAI) {
    console.log('⚠️ No Gemini API key - skipping AI verification');
    return null;
  }

  try {
    // Fetch image as base64
    const imageBuffer = await fetchImageAsBuffer(imageUrl);

    // Skip images that are too large for Gemini
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      console.log(`  ⏭️ Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    // Skip if buffer doesn't look like an image (check magic bytes)
    const magicBytes = imageBuffer.slice(0, 4).toString('hex');
    const isJpeg = magicBytes.startsWith('ffd8');
    const isPng = magicBytes === '89504e47';
    if (!isJpeg && !isPng) {
      console.log(`  ⏭️ Not a valid JPEG/PNG image`);
      return null;
    }

    const base64Image = imageBuffer.toString('base64');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

    const prompt = `You are an expert ECG reader and medical educator evaluating ECG images for PA student training.

Analyze this image with STRICT criteria for ECG quality:

Expected condition: ${expectedCondition}

Evaluate and respond in JSON format:
{
  "isValidECG": boolean,           // Is this actually an ECG image?
  "isActualRecording": boolean,    // Is this a real ECG recording (not a diagram/illustration)?
  "hasVisibleGrid": boolean,       // Can you see the standard ECG grid/calibration?
  "readabilityScore": number,      // 1-10, how clearly can rhythm/features be interpreted?
  "annotationLevel": "none|minimal|moderate|heavy",  // Amount of text/arrows on image
  "detectedRhythm": string,        // What rhythm/condition do you see?
  "matchesCondition": boolean,     // Does it match the expected condition?
  "confidence": number,            // 0.0-1.0 confidence in your assessment
  "rejectReason": string|null,     // If rejecting, why?
  "accept": boolean                // Final decision: accept for PA training?
}

STRICT CRITERIA FOR ACCEPTANCE:
- MUST be actual ECG recording (not cartoon/diagram)
- MUST show clear, readable tracing
- readabilityScore >= 6
- annotationLevel must be "none" or "minimal"
- Must reasonably match the expected condition
- NO images that are just text or descriptions

Respond ONLY with valid JSON.`;

    // Use SDK with gemini-2.5-flash (like working content generator)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: { temperature: 0.2 },
    });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ]);

    const text = result.response.text();
    if (!text) return null;

    // Parse JSON response
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);

    // Handle rate limiting (429) with longer backoff
    if (
      errorMsg.includes('429') ||
      errorMsg.toLowerCase().includes('rate limit') ||
      errorMsg.toLowerCase().includes('quota')
    ) {
      console.log(`  ⚠️ Rate limited! Waiting ${RATE_LIMIT.rateLimitBackoffMs / 1000}s...`);
      await rateLimitedDelay(true);
      if (retryCount < 2) {
        return analyzeECGImage(imageUrl, expectedCondition, retryCount + 1);
      }
    }

    // Retry once on transient 400 errors (bad image format)
    if (retryCount < 1 && errorMsg.includes('400')) {
      console.log(`  ⚠️ Retrying after error...`);
      await new Promise((r) => setTimeout(r, 2000));
      return analyzeECGImage(imageUrl, expectedCondition, retryCount + 1);
    }

    console.log(`  Analysis error: ${error}`);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function fetchImageAsBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const protocol = url.startsWith('https') ? https : require('http');
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent':
          'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
      },
    };
    protocol
      .get(options, (res: any) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchImageAsBuffer(res.headers.location).then(resolve).catch(reject);
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function uploadToSupabase(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const storagePath = `ecg/${filename}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

  return data.publicUrl;
}

async function checkDuplicate(conditionId: string, originalUrl: string): Promise<boolean> {
  const existing = await prisma.mediaAsset.findFirst({
    where: {
      OR: [{ conditionId, sourceUrl: originalUrl }, { originalUrl }],
    },
  });
  return !!existing;
}

async function saveMediaAsset(
  conditionId: string,
  publicUrl: string,
  originalUrl: string,
  condition: ECGCondition,
  analysis: ECGAnalysis
): Promise<void> {
  const id = uuidv4();
  const filename = `${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;

  await prisma.mediaAsset.create({
    data: {
      id,
      conditionId,
      type: 'ECG',
      filename,
      originalUrl: publicUrl,
      sourceUrl: originalUrl,
      tags: ['ecg', 'rhythm', condition.name.toLowerCase()],
      description: condition.clinicalContext,
      altText: `ECG showing ${condition.correctDiagnosis}`,
      confidence: analysis.confidence,
      qualityScore: analysis.readabilityScore,
      aiMetadata: {
        detectedRhythm: analysis.detectedRhythm,
        readabilityScore: analysis.readabilityScore,
        annotationLevel: analysis.annotationLevel,
        matchesCondition: analysis.matchesCondition,
      },
      status: 'approved',
      approvalStatus: 'approved',
      modality: 'ecg',
      explanation: condition.visualFindings,
      correctDiagnosis: condition.correctDiagnosis,
      distractors: condition.distractors,
      difficulty: 'medium',
      isClinical: true,
    } as any,
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function processCondition(
  condition: ECGCondition,
  dryRun: boolean
): Promise<{ fetched: number; saved: number; errors: number }> {
  const stats = { fetched: 0, saved: 0, errors: 0 };

  console.log(`\n📊 Processing: ${condition.name} (target: ${condition.targetImageCount} images)`);

  // Check how many images we already have for this condition
  const existingCount = await prisma.mediaAsset.count({
    where: { conditionId: condition.conditionId, type: 'ECG' },
  });

  if (existingCount >= condition.targetImageCount) {
    console.log(`  ✓ Already have ${existingCount} images, skipping`);
    return stats;
  }

  const targetCount = condition.targetImageCount - existingCount;
  console.log(`  Need ${targetCount} more images (have ${existingCount})`);

  // Search with each search term - fetch more results for higher targets
  const resultsPerSearch = Math.min(25, Math.ceil(targetCount / condition.searchTerms.length) + 8);

  for (const searchTerm of condition.searchTerms) {
    if (stats.saved >= targetCount) break;

    console.log(`  🔍 Searching: "${searchTerm}" (fetching up to ${resultsPerSearch})`);

    try {
      // Use combined sources for better coverage
      const results = await searchAllSources(searchTerm, resultsPerSearch);
      stats.fetched += results.length;
      console.log(`    Found ${results.length} results from all sources`);

      for (const result of results) {
        if (stats.saved >= targetCount) break;
        if (!result.url) continue;

        // Skip unsupported formats (SVG, GIF, etc.) - Gemini can't process these
        const urlLower = result.url.toLowerCase();
        if (
          urlLower.includes('.svg') ||
          urlLower.includes('.gif') ||
          urlLower.includes('.webp') ||
          urlLower.includes('.tiff')
        ) {
          console.log(`    ⏭️ Skipping unsupported format: ${result.title?.substring(0, 40)}`);
          continue;
        }

        // Skip if mime type indicates unsupported format
        if (result.mime && !['image/jpeg', 'image/png', 'image/jpg'].includes(result.mime)) {
          console.log(`    ⏭️ Skipping unsupported mime: ${result.mime}`);
          continue;
        }

        // Check for duplicate
        if (await checkDuplicate(condition.conditionId, result.originalUrl || result.url)) {
          console.log(`    ⏭️ Duplicate: ${result.title?.substring(0, 40)}`);
          continue;
        }

        // AI verification
        console.log(`    🤖 Analyzing: ${result.title?.substring(0, 40)}...`);
        const analysis = await analyzeECGImage(result.url, condition.correctDiagnosis);

        if (!analysis) {
          console.log(`    ⚠️ Analysis failed`);
          stats.errors++;
          continue;
        }

        if (!analysis.accept) {
          console.log(`    ❌ Rejected: ${analysis.rejectReason || 'Not suitable'}`);
          continue;
        }

        if (dryRun) {
          console.log(
            `    ✅ Would save: ${analysis.detectedRhythm} (score: ${analysis.readabilityScore})`
          );
          stats.saved++;
          continue;
        }

        // Download and upload to Supabase
        try {
          const imageBuffer = await fetchImageAsBuffer(result.url);
          const filename = `ecg_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;
          const publicUrl = await uploadToSupabase(imageBuffer, filename, 'image/jpeg');

          // Save to database
          await saveMediaAsset(
            condition.conditionId,
            publicUrl,
            result.originalUrl || result.url,
            condition,
            analysis
          );

          console.log(
            `    ✅ Saved: ${analysis.detectedRhythm} (score: ${analysis.readabilityScore})`
          );
          stats.saved++;
        } catch (uploadError) {
          console.log(`    ⚠️ Upload error: ${uploadError}`);
          stats.errors++;
        }

        // Rate limit between API calls
        await rateLimitedDelay();
      }
    } catch (searchError) {
      console.log(`    ⚠️ Search error: ${searchError}`);
      stats.errors++;
    }

    // Rate limit between searches
    await new Promise((r) => setTimeout(r, RATE_LIMIT.searchDelayMs));
  }

  return stats;
}

async function main() {
  console.log('🫀 ECG Image Fetcher for PA Student Training\n');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const conditionFilter = args
    .find((a) => a.startsWith('--condition='))
    ?.split('=')[1]
    ?.toLowerCase();

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No images will be saved\n');
  }

  // Filter conditions if specified
  let conditions = ECG_CONDITIONS;
  if (conditionFilter) {
    conditions = ECG_CONDITIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(conditionFilter) ||
        c.conditionId.toLowerCase().includes(conditionFilter)
    );
    console.log(`Filtered to ${conditions.length} conditions matching "${conditionFilter}"\n`);
  }

  // Verify condition IDs exist in database
  console.log('Verifying condition IDs in database...');
  for (const condition of conditions) {
    const exists = await prisma.condition.findUnique({ where: { id: condition.conditionId } });
    if (!exists) {
      console.log(`  ⚠️ Condition not found: ${condition.conditionId}`);
    }
  }

  const totals = { fetched: 0, saved: 0, errors: 0 };

  for (const condition of conditions) {
    const stats = await processCondition(condition, dryRun);
    totals.fetched += stats.fetched;
    totals.saved += stats.saved;
    totals.errors += stats.errors;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 ECG FETCH SUMMARY');
  console.log('='.repeat(60));
  console.log(`Conditions processed: ${conditions.length}`);
  console.log(`Images fetched:       ${totals.fetched}`);
  console.log(`Images saved:         ${totals.saved}`);
  console.log(`Errors:               ${totals.errors}`);

  await prisma.$disconnect();
}

main().catch(console.error);
