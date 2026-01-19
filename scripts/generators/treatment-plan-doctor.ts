#!/usr/bin/env npx tsx
/**
 * Treatment Plan Doctor - Comprehensive Treatment Protocol Generator
 *
 * Generates full treatment PROTOCOLS for conditions - complete management approaches:
 * - Initial stabilization
 * - Definitive treatment
 * - Supportive care
 * - Monitoring & follow-up
 *
 * NOTE: This is NOT for individual drugs (use Drug table for pharmacology).
 * This is for comprehensive management strategies like "STEMI Protocol" or "DKA Management".
 *
 * Key Schema Fields:
 *   name (unique), category (Medical/Surgical/Procedural/Emergency/etc),
 *   type (First-line/Second-line/Adjunct/etc), description (overview),
 *   indications[], contraindications[], complications[],
 *   timing (Acute/Chronic), duration, timeToEffect, followUp,
 *   evidenceLevel (A/B/C/D), guidelineSource, guidelineYear,
 *   panceYield (1-3), isHighYield, isFirstLine, boardYieldFacts[],
 *   clinicalPearls[], commonMistakes[], alternativeTo[], advantages[], disadvantages[]
 *
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/treatment-plan-doctor.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/treatment-plan-doctor.ts --batch=20
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/treatment-plan-doctor.ts --analyze
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/treatment-plan-doctor.ts --known-only
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();

// Rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

type TreatmentCategory =
  | 'Medical'
  | 'Surgical'
  | 'Procedural'
  | 'Physical Therapy'
  | 'Lifestyle'
  | 'Emergency'
  | 'Supportive'
  | 'Multimodal';
type TreatmentType =
  | 'First-line'
  | 'Second-line'
  | 'Adjunct'
  | 'Salvage'
  | 'Prophylaxis'
  | 'Maintenance';

interface TreatmentProtocol {
  name: string;
  displayName?: string;
  category: TreatmentCategory;
  type: TreatmentType;

  // Protocol overview
  description: string;
  recommendation?: string; // Guideline recommendation text

  // Key protocol sections (stored in description but structured)
  initialManagement?: string;
  definitiveTherapy?: string;
  supportiveCare?: string;
  monitoring?: string;

  // When to use
  indications: string[];
  contraindications: string[];
  complications: string[];

  // Timing
  timing: string; // Acute, Chronic, Maintenance
  duration?: string;
  timeToEffect?: string;
  followUp?: string;

  // Evidence
  evidenceLevel?: string;
  guidelineSource?: string;
  guidelineYear?: number;

  // PANCE relevance
  panceYield: number;
  isHighYield: boolean;
  isFirstLine: boolean;
  boardYieldFacts: string[];
  clinicalPearls: string[];
  commonMistakes?: string[];

  // Alternatives & comparison
  alternativeTo: string[];
  advantages: string[];
  disadvantages: string[];
}

// High-yield treatment protocols (curated)
const KNOWN_TREATMENT_PROTOCOLS: TreatmentProtocol[] = [
  // ========== CARDIOLOGY ==========
  {
    name: 'STEMI Management Protocol',
    category: 'Emergency',
    type: 'First-line',
    description:
      'Time-critical management of ST-elevation myocardial infarction with focus on rapid reperfusion',
    indications: ['STEMI on ECG', 'Chest pain with ST elevations ≥1mm in 2 contiguous leads'],
    contraindications: [
      'Active bleeding',
      'Recent surgery (relative for lytics)',
      'Prior intracranial hemorrhage (absolute for lytics)',
    ],
    complications: [
      'Reperfusion arrhythmias',
      'Bleeding (with anticoagulation)',
      'Cardiogenic shock',
      'Mechanical complications',
    ],
    initialManagement:
      'MONA (Morphine, Oxygen if SpO2<90%, Nitroglycerin, Aspirin 325mg) + Dual antiplatelet (P2Y12 inhibitor) + Anticoagulation (Heparin)',
    definitiveTherapy:
      'Primary PCI (preferred, door-to-balloon <90 min) OR Fibrinolytics (if PCI unavailable within 120 min)',
    supportiveCare: 'Continuous telemetry, IV access x2, NPO, bed rest, anxiety management',
    timing: 'Acute',
    duration: 'Acute phase 24-48 hours, then transition to post-MI care',
    timeToEffect: 'Immediate reperfusion goal',
    followUp: 'Echo before discharge, cardiac rehab, secondary prevention',
    evidenceLevel: 'A',
    guidelineSource: 'AHA/ACC 2021',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Door-to-balloon <90 minutes',
      'Door-to-needle <30 minutes for lytics',
      'Aspirin 325mg for ALL ACS',
    ],
    clinicalPearls: [
      'Time is muscle - every minute counts',
      'Do NOT delay PCI for additional testing',
      'RV infarct = avoid nitrates, give fluids',
    ],
    alternativeTo: [],
    advantages: ['Rapid reperfusion', 'Mortality reduction'],
    disadvantages: ['Time-dependent efficacy', 'Bleeding risk'],
  },
  {
    name: 'Atrial Fibrillation Rate Control',
    category: 'Medical',
    type: 'First-line',
    description:
      'Rate control strategy for atrial fibrillation - preferred initial approach for most patients',
    indications: [
      'Atrial fibrillation with rapid ventricular response',
      'Symptomatic AFib',
      'New-onset AFib',
    ],
    contraindications: [
      'Pre-excitation (WPW) - avoid AV nodal blockers',
      'Decompensated heart failure (avoid CCBs)',
      'Severe bradycardia',
    ],
    complications: ['Bradycardia', 'Hypotension', 'Heart failure exacerbation'],
    initialManagement:
      'Beta-blocker (metoprolol 5mg IV, may repeat) OR Diltiazem (0.25mg/kg IV) for rapid rate control',
    definitiveTherapy:
      'Oral beta-blocker or non-DHP CCB for long-term rate control. Target HR <110 at rest.',
    supportiveCare:
      'Anticoagulation based on CHA2DS2-VASc score (≥2 men, ≥3 women = anticoagulate)',
    timing: 'Acute and Chronic',
    duration: 'Indefinite for chronic AFib',
    timeToEffect: 'IV agents: 5-15 minutes; Oral: hours to days',
    followUp: 'Rate assessment, anticoagulation monitoring, consider rhythm control if symptomatic',
    evidenceLevel: 'A',
    guidelineSource: 'AHA/ACC/HRS 2023',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'CHA2DS2-VASc determines anticoagulation',
      'AVOID nodal blockers in WPW',
      'Rate control = first-line for most',
    ],
    clinicalPearls: [
      'Diltiazem preferred if no HFrEF',
      'Beta-blocker preferred if HFrEF',
      'Digoxin only as adjunct - slow onset',
    ],
    alternativeTo: ['Rhythm control'],
    advantages: ['Fewer side effects than antiarrhythmics', 'Effective symptom control'],
    disadvantages: ['Does not restore sinus rhythm', 'Lifelong anticoagulation often needed'],
  },
  {
    name: 'Heart Failure with Reduced EF (HFrEF) GDMT',
    category: 'Medical',
    type: 'First-line',
    description: 'Guideline-directed medical therapy for HFrEF - the four pillars approach',
    indications: ['Heart failure with EF ≤40%', 'Symptomatic HF (NYHA II-IV)'],
    contraindications: [
      'ACEi/ARB: Bilateral renal artery stenosis, angioedema, pregnancy',
      'Beta-blocker: Cardiogenic shock, severe bradycardia',
      'MRA: K>5.0, eGFR<30',
      'SGLT2i: Type 1 DM',
    ],
    complications: ['Hypotension', 'Hyperkalemia', 'Acute kidney injury', 'Bradycardia'],
    initialManagement:
      'Start all four pillars simultaneously or rapidly sequentially: ACEi/ARB/ARNI + Beta-blocker + MRA + SGLT2i',
    definitiveTherapy:
      'ARNI (sacubitril/valsartan) preferred over ACEi, Carvedilol/Metoprolol succinate/Bisoprolol, Spironolactone/Eplerenone, Dapagliflozin/Empagliflozin',
    supportiveCare:
      'Sodium restriction <2g/day, fluid restriction if hyponatremic, daily weights, diuretics PRN for congestion',
    timing: 'Chronic',
    duration: 'Lifelong',
    timeToEffect: 'Mortality benefit seen over months-years',
    followUp: 'Labs (K, Cr) 1-2 weeks after initiation/titration, titrate to target doses',
    evidenceLevel: 'A',
    guidelineSource: 'AHA/ACC/HFSA 2022',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Four pillars: ARNI/ACEi + BB + MRA + SGLT2i',
      'ARNI preferred over ACEi',
      'All four reduce mortality',
    ],
    clinicalPearls: [
      'Start low, go slow but GO',
      'Uptitrate every 2-4 weeks',
      'Some hypotension/creatinine rise acceptable',
    ],
    alternativeTo: [],
    advantages: ['Mortality reduction 30-40%', 'Improved symptoms', 'Reduced hospitalizations'],
    disadvantages: ['Polypharmacy', 'Multiple side effects to monitor', 'Cost of newer agents'],
  },

  // ========== PULMONOLOGY ==========
  {
    name: 'Community-Acquired Pneumonia (Outpatient)',
    category: 'Medical',
    type: 'First-line',
    description: 'Empiric antibiotic therapy for CAP in healthy outpatients',
    indications: [
      'CAP in healthy patient without comorbidities',
      'CURB-65 score 0-1',
      'No recent antibiotic use',
    ],
    contraindications: [
      'Allergy to recommended antibiotics',
      'Severe CAP requiring hospitalization',
    ],
    complications: ['Treatment failure', 'C. diff colitis', 'Drug allergies'],
    initialManagement:
      'Amoxicillin 1g TID x 5 days OR Doxycycline 100mg BID x 5 days OR Azithromycin 500mg day 1, then 250mg days 2-5',
    definitiveTherapy: 'Same as initial - complete 5-day course',
    supportiveCare: 'Rest, hydration, antipyretics PRN, cough suppressants at night',
    timing: 'Acute',
    duration: '5 days minimum (may extend if slow response)',
    timeToEffect: '48-72 hours to see improvement',
    followUp: 'Return if worsening, no improvement at 48-72 hours, or new symptoms',
    evidenceLevel: 'A',
    guidelineSource: 'ATS/IDSA 2019',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Amoxicillin or doxycycline first-line for healthy outpatients',
      '5 days is standard duration',
      'Add coverage for atypicals if comorbidities',
    ],
    clinicalPearls: [
      'Azithromycin resistance increasing - amoxicillin preferred',
      'Chest X-ray not required for uncomplicated CAP',
      'Switch to oral when improving',
    ],
    alternativeTo: [],
    advantages: ['Simple regimen', 'High efficacy for typical pathogens'],
    disadvantages: ['May miss atypicals (with amoxicillin alone)'],
  },
  {
    name: 'COPD Exacerbation Management',
    category: 'Medical',
    type: 'First-line',
    description: 'ABCs of COPD exacerbation: Antibiotics, Bronchodilators, Corticosteroids',
    indications: [
      'Increased dyspnea, sputum volume, or sputum purulence',
      'COPD patient with acute worsening',
    ],
    contraindications: [
      'Steroids: Active untreated infection, uncontrolled diabetes (relative)',
      'Antibiotics: Mild exacerbation without purulent sputum',
    ],
    complications: ['Respiratory failure', 'Steroid side effects', 'Antibiotic resistance'],
    initialManagement:
      'Nebulized SABA (albuterol) + SAMA (ipratropium) q4-6h, Prednisone 40mg daily x 5 days, Antibiotics if purulent sputum (azithromycin or doxycycline)',
    definitiveTherapy:
      'Continue bronchodilators, complete steroid course, adjust maintenance therapy if frequent exacerbations',
    supportiveCare: 'Supplemental O2 to target SpO2 88-92%, respiratory therapy, smoking cessation',
    timing: 'Acute',
    duration: 'Steroids x 5 days, Antibiotics x 5-7 days',
    timeToEffect: '24-48 hours for improvement',
    followUp: 'Reassess maintenance therapy, pulmonology referral if frequent exacerbations',
    evidenceLevel: 'A',
    guidelineSource: 'GOLD 2024',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'ABCs: Antibiotics (if purulent), Bronchodilators, Corticosteroids',
      'Target SpO2 88-92% (avoid hyperoxia)',
      '5 days steroids is sufficient',
    ],
    clinicalPearls: [
      'Do NOT give high-flow O2 - lose hypoxic drive',
      'Antibiotics only if increased sputum purulence',
      'Consider BiPAP if severe',
    ],
    alternativeTo: [],
    advantages: ['Rapid symptom improvement', 'Reduced hospitalization'],
    disadvantages: ['Steroid side effects', 'Does not address underlying disease'],
  },
  {
    name: 'Asthma Exacerbation (Acute)',
    category: 'Emergency',
    type: 'First-line',
    description: 'Step-wise management of acute asthma exacerbation',
    indications: [
      'Acute wheezing/dyspnea in known asthmatic',
      'Peak flow <80% predicted',
      'Accessory muscle use',
    ],
    contraindications: ['Systemic steroids: Active varicella, herpes zoster (relative)'],
    complications: ['Status asthmaticus', 'Respiratory failure', 'Pneumothorax'],
    initialManagement:
      'Albuterol nebulizer (2.5-5mg) or MDI with spacer (4-8 puffs) q20min x 3, Ipratropium 0.5mg nebulized x 1-3 doses, Prednisone 40-60mg PO or methylprednisolone 125mg IV',
    definitiveTherapy:
      'Continue bronchodilators as needed, oral steroids x 5 days, step up maintenance therapy',
    supportiveCare:
      'Oxygen to maintain SpO2 >92%, continuous monitoring, prepare for intubation if severe',
    timing: 'Acute',
    duration: 'ED course 1-4 hours, oral steroids x 5 days',
    timeToEffect: 'Bronchodilators: minutes; Steroids: 4-6 hours',
    followUp: 'PCP/pulmonology within 1-2 weeks, reassess controller therapy',
    evidenceLevel: 'A',
    guidelineSource: 'GINA 2024',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Albuterol + ipratropium + systemic steroids',
      'Steroids take 4-6 hours to work',
      'Silent chest = ominous sign',
    ],
    clinicalPearls: [
      'Magnesium sulfate 2g IV for severe exacerbation',
      'Heliox if not responding',
      'Avoid sedation',
    ],
    alternativeTo: [],
    advantages: ['Rapid bronchodilation', 'Prevents progression'],
    disadvantages: ['Tachycardia from beta-agonists', 'Steroid side effects'],
  },

  // ========== GI ==========
  {
    name: 'Acute Pancreatitis Management',
    category: 'Supportive',
    type: 'First-line',
    description: 'Supportive care is the mainstay - no specific treatment exists',
    indications: [
      'Acute pancreatitis (2 of 3: characteristic pain, lipase >3x ULN, imaging findings)',
    ],
    contraindications: [],
    complications: [
      'Necrotizing pancreatitis',
      'Pseudocyst',
      'ARDS',
      'Multiorgan failure',
      'Infected necrosis',
    ],
    initialManagement:
      'NPO initially, Aggressive IV fluid resuscitation (LR preferred, 250-500mL/hr initially), Pain control (IV opioids), Antiemetics',
    definitiveTherapy:
      'Supportive care. ERCP within 24h if biliary obstruction/cholangitis. Surgery for infected necrosis.',
    supportiveCare:
      'Monitor for organ failure (Ranson, APACHE II), early enteral nutrition (within 24-48h) if tolerated, ICU if severe',
    timing: 'Acute',
    duration: 'Days to weeks depending on severity',
    timeToEffect: 'Improvement typically 3-5 days',
    followUp: 'Identify and treat cause (gallstones, alcohol, meds), lipid panel, Ca2+ level',
    evidenceLevel: 'A',
    guidelineSource: 'ACG 2024',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Aggressive fluid resuscitation is KEY',
      'NPO then early enteral nutrition',
      'No prophylactic antibiotics',
    ],
    clinicalPearls: [
      'LR preferred over NS (less SIRS)',
      'Early feeding reduces complications',
      'CT not needed for diagnosis if clinical criteria met',
    ],
    alternativeTo: [],
    advantages: ['Prevents hypovolemic shock', 'Allows pancreatic rest'],
    disadvantages: ['Fluid overload risk', 'May need ICU-level care'],
  },
  {
    name: 'H. pylori Eradication Therapy',
    category: 'Medical',
    type: 'First-line',
    description: 'Triple or quadruple therapy for H. pylori infection',
    indications: [
      'H. pylori positive (any test)',
      'PUD',
      'MALT lymphoma',
      'Dyspepsia in endemic areas',
    ],
    contraindications: ['Allergy to components', 'Recent macrolide use (consider resistance)'],
    complications: ['C. diff', 'Drug interactions', 'Treatment failure (resistance)'],
    initialManagement:
      'Bismuth quadruple therapy (if prior macrolide exposure): PPI BID + Bismuth QID + Metronidazole TID + Tetracycline QID x 14 days',
    definitiveTherapy:
      'Clarithromycin triple therapy (if no prior macrolide): PPI BID + Clarithromycin 500mg BID + Amoxicillin 1g BID x 14 days',
    supportiveCare: 'Avoid NSAIDs, smoking cessation, limit alcohol',
    timing: 'Acute treatment',
    duration: '14 days',
    timeToEffect: 'Eradication confirmed 4+ weeks after completing therapy',
    followUp: 'Confirm eradication with urea breath test or stool antigen (NOT serology)',
    evidenceLevel: 'A',
    guidelineSource: 'ACG 2024',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      '14 days is standard duration',
      'Confirm eradication with breath test or stool antigen',
      'Bismuth quad if macrolide resistance suspected',
    ],
    clinicalPearls: [
      'Check for penicillin allergy before amoxicillin',
      'Compliance is critical - counsel patient',
      'Wait 4 weeks after PPI/antibiotic to retest',
    ],
    alternativeTo: [],
    advantages: ['High eradication rates (>90%)', 'Prevents ulcer recurrence'],
    disadvantages: ['Complex regimen', 'Side effects common', 'Resistance increasing'],
  },

  // ========== INFECTIOUS DISEASE ==========
  {
    name: 'Sepsis/Septic Shock Management',
    category: 'Emergency',
    type: 'First-line',
    description: 'Hour-1 bundle for sepsis and septic shock',
    indications: [
      'Suspected or confirmed sepsis',
      'qSOFA ≥2',
      'Septic shock (requiring vasopressors)',
    ],
    contraindications: ['Specific antibiotic allergies (adjust regimen)'],
    complications: ['Multiorgan failure', 'ARDS', 'DIC', 'Death'],
    initialManagement:
      'Hour-1 bundle: Lactate, Blood cultures (before abx), Broad-spectrum antibiotics, 30mL/kg crystalloid for hypotension/lactate≥4, Vasopressors if hypotensive after fluids',
    definitiveTherapy:
      'Source control (drain abscess, remove line, surgery), Narrow antibiotics based on cultures',
    supportiveCare:
      'Central line, arterial line, Foley, ICU admission, stress ulcer prophylaxis, DVT prophylaxis, glucose control',
    timing: 'Acute',
    duration: '7-10 days antibiotics (source dependent)',
    timeToEffect: 'Each hour delay in antibiotics increases mortality 7%',
    followUp: 'Source identification, daily assessment, de-escalation when possible',
    evidenceLevel: 'A',
    guidelineSource: 'Surviving Sepsis Campaign 2021',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Hour-1 bundle is critical',
      'Blood cultures BEFORE antibiotics (but dont delay abx)',
      '30mL/kg crystalloid bolus',
    ],
    clinicalPearls: [
      'Norepinephrine is first-line vasopressor',
      'Add vasopressin if still hypotensive',
      'Lactate clearance guides resuscitation',
    ],
    alternativeTo: [],
    advantages: ['Mortality reduction with early intervention'],
    disadvantages: ['Aggressive fluids can cause overload', 'Broad antibiotics promote resistance'],
  },
  {
    name: 'Cellulitis Treatment (Non-purulent)',
    category: 'Medical',
    type: 'First-line',
    description: 'Antibiotics targeting streptococcal and staphylococcal coverage',
    indications: ['Spreading erythema, warmth, tenderness', 'No purulent drainage or abscess'],
    contraindications: ['Penicillin allergy (use alternatives)', 'Need for surgical drainage'],
    complications: ['Abscess formation', 'Bacteremia', 'Necrotizing fasciitis'],
    initialManagement:
      'Outpatient: Cephalexin 500mg QID x 5-7 days OR Dicloxacillin 500mg QID x 5-7 days. Elevate affected extremity.',
    definitiveTherapy:
      'Complete antibiotic course, treat underlying predisposing factors (edema, tinea pedis)',
    supportiveCare:
      'Mark borders with pen, elevation, warm compresses, treat tinea pedis if present',
    timing: 'Acute',
    duration: '5-7 days (may extend if slow response)',
    timeToEffect: '48-72 hours to see improvement',
    followUp: 'Return if worsening, spreading despite antibiotics, or systemic symptoms',
    evidenceLevel: 'A',
    guidelineSource: 'IDSA 2014',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Non-purulent = strep coverage (cephalexin)',
      'Purulent = MRSA coverage (TMP-SMX or doxy)',
      'Mark borders to monitor spread',
    ],
    clinicalPearls: [
      'Distinguish from DVT (unilateral leg swelling)',
      'Treat tinea pedis to prevent recurrence',
      'No MRSA coverage needed for non-purulent',
    ],
    alternativeTo: [],
    advantages: ['Simple oral regimen', 'High cure rate'],
    disadvantages: ['May fail if MRSA or abscess present'],
  },

  // ========== ENDOCRINE ==========
  {
    name: 'DKA Management Protocol',
    category: 'Emergency',
    type: 'First-line',
    description: 'Fluid, insulin, potassium, and monitoring for diabetic ketoacidosis',
    indications: ['DKA: Glucose >250, pH <7.3, Bicarb <18, Anion gap >12, Ketones positive'],
    contraindications: [
      'Hypoglycemia (do not give insulin until glucose addressed)',
      'Severe hypokalemia (replete K before insulin)',
    ],
    complications: [
      'Cerebral edema (especially pediatrics)',
      'Hypokalemia',
      'Hypoglycemia',
      'ARDS',
    ],
    initialManagement:
      'NS 1-2L bolus, then 250-500mL/hr. Regular insulin 0.1 units/kg/hr IV drip. K replacement if <5.2. Check glucose hourly, BMP q2-4h.',
    definitiveTherapy:
      'Continue insulin drip until anion gap closes. Transition to subcutaneous insulin BEFORE stopping drip (overlap 1-2 hours).',
    supportiveCare:
      'Identify precipitant (infection, MI, noncompliance), ICU admission, continuous monitoring',
    timing: 'Acute',
    duration: '12-24 hours typically for gap to close',
    timeToEffect: 'Gap closure guides treatment, not glucose',
    followUp: 'Diabetes education, insulin adjustment, identify/treat precipitant',
    evidenceLevel: 'A',
    guidelineSource: 'ADA 2024',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Fluids first, then insulin',
      'Replace K if <5.2 before insulin',
      'Goal: Close the gap, not just lower glucose',
    ],
    clinicalPearls: [
      'Add D5 to fluids when glucose <250',
      'Do NOT stop insulin drip until gap closed + SQ given',
      'K drops with insulin - monitor closely',
    ],
    alternativeTo: [],
    advantages: ['Life-saving', 'Well-established protocol'],
    disadvantages: ['Requires ICU monitoring', 'Electrolyte shifts can be dangerous'],
  },
  {
    name: 'Hypothyroidism (Primary) Treatment',
    category: 'Medical',
    type: 'First-line',
    description: 'Levothyroxine replacement therapy',
    indications: [
      'Elevated TSH with low free T4',
      'Symptomatic hypothyroidism',
      'TSH >10 even if asymptomatic',
    ],
    contraindications: [
      'Untreated adrenal insufficiency (treat cortisol first)',
      'Recent MI (start low dose)',
    ],
    complications: [
      'Overreplacement (hyperthyroidism symptoms)',
      'Angina/MI (in cardiac patients)',
    ],
    initialManagement:
      'Levothyroxine 1.6 mcg/kg/day (full replacement). Start lower in elderly or cardiac patients (25-50 mcg/day).',
    definitiveTherapy:
      'Titrate to TSH goal (0.5-2.5 for most). Recheck TSH in 6-8 weeks after any dose change.',
    supportiveCare:
      'Take on empty stomach, 30-60 min before breakfast or at bedtime. Separate from calcium, iron, antacids by 4 hours.',
    timing: 'Chronic',
    duration: 'Lifelong',
    timeToEffect: 'Weeks to months for symptom improvement',
    followUp: 'TSH q6-8 weeks until stable, then annually',
    evidenceLevel: 'A',
    guidelineSource: 'ATA 2014',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Levothyroxine is first-line',
      'Check TSH 6-8 weeks after dose change',
      'Take on empty stomach, separate from Ca/Fe',
    ],
    clinicalPearls: [
      'T3 supplementation generally not recommended',
      'Pregnancy requires 25-50% dose increase',
      'Generic is acceptable',
    ],
    alternativeTo: [],
    advantages: ['Once daily dosing', 'Inexpensive', 'Well-tolerated'],
    disadvantages: ['Narrow therapeutic window', 'Drug/food interactions'],
  },

  // ========== NEUROLOGY ==========
  {
    name: 'Acute Ischemic Stroke (tPA Protocol)',
    category: 'Emergency',
    type: 'First-line',
    description: 'IV thrombolysis for acute ischemic stroke within treatment window',
    indications: [
      'Acute ischemic stroke',
      'Within 4.5 hours of symptom onset (or last known well)',
      'No contraindications',
    ],
    contraindications: [
      'Intracranial hemorrhage on CT',
      'Recent surgery/trauma',
      'Active bleeding',
      'BP >185/110 despite treatment',
      'INR >1.7',
      'Platelet <100k',
    ],
    complications: ['Symptomatic ICH (6%)', 'Angioedema', 'Systemic bleeding'],
    initialManagement:
      'STAT non-contrast CT head (rule out bleed), Check glucose, coags, platelets. If eligible: Alteplase 0.9mg/kg (max 90mg), 10% bolus, rest over 60 min.',
    definitiveTherapy:
      'Consider thrombectomy if large vessel occlusion (up to 24h in select patients). Admit to stroke unit.',
    supportiveCare:
      'BP management (<180/105 after tPA for 24h), NPO until swallow eval, DVT prophylaxis, PT/OT',
    timing: 'Acute',
    duration: 'tPA infusion 1 hour, then 24-hour monitoring',
    timeToEffect: 'Earlier treatment = better outcomes (NNT improves)',
    followUp: 'MRI, vascular imaging, cardiology (echo, Holter), secondary prevention',
    evidenceLevel: 'A',
    guidelineSource: 'AHA/ASA 2019',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      '4.5-hour window for IV tPA',
      'Non-contrast CT to rule out hemorrhage',
      'BP must be <185/110 before tPA',
    ],
    clinicalPearls: [
      'Time is brain - do not delay for MRI',
      'Dont lower glucose unless >180',
      'Tenecteplase is alternative to alteplase',
    ],
    alternativeTo: [],
    advantages: ['Proven mortality and disability reduction'],
    disadvantages: ['Narrow time window', 'ICH risk', 'Many contraindications'],
  },
  {
    name: 'Status Epilepticus Management',
    category: 'Emergency',
    type: 'First-line',
    description: 'Staged approach to terminate seizures lasting >5 minutes',
    indications: ['Continuous seizure >5 minutes', 'Recurrent seizures without return to baseline'],
    contraindications: ['Specific drug allergies'],
    complications: ['Aspiration', 'Rhabdomyolysis', 'Brain injury', 'Death'],
    initialManagement:
      'ABCs, O2, IV access, glucose check. Lorazepam 4mg IV (or 10mg IM midazolam if no IV). May repeat x1 in 5-10 min.',
    definitiveTherapy:
      'If seizures continue: Load fosphenytoin 20mg PE/kg OR levetiracetam 60mg/kg OR valproate 40mg/kg. If refractory: anesthetic doses (propofol, midazolam, pentobarbital).',
    supportiveCare:
      'Continuous EEG, ICU admission, identify cause (AED levels, electrolytes, tox screen, imaging)',
    timing: 'Acute',
    duration: 'Until seizures terminate',
    timeToEffect: 'Benzodiazepines work within 1-3 minutes',
    followUp: 'AED optimization, EEG monitoring, address underlying cause',
    evidenceLevel: 'A',
    guidelineSource: 'AAN 2016',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Lorazepam 4mg IV is first-line',
      'Fosphenytoin/levetiracetam/valproate for refractory',
      'Check glucose - hypoglycemia causes seizures',
    ],
    clinicalPearls: [
      'Do NOT wait 5 min if actively seizing in front of you',
      'IM midazolam if no IV access',
      'Pyridoxine for INH overdose seizures',
    ],
    alternativeTo: [],
    advantages: ['Rapid seizure termination'],
    disadvantages: ['Respiratory depression risk', 'Hypotension'],
  },

  // ========== PSYCHIATRY ==========
  {
    name: 'Major Depressive Disorder (First-line)',
    category: 'Medical',
    type: 'First-line',
    description: 'SSRI therapy with psychotherapy for MDD',
    indications: [
      'Major depressive disorder (DSM-5 criteria)',
      'PHQ-9 ≥10',
      'Significant functional impairment',
    ],
    contraindications: [
      'SSRI: Concurrent MAOI (14-day washout)',
      'Bipolar (can trigger mania)',
      'Severe suicidal ideation (consider inpatient)',
    ],
    complications: [
      'Serotonin syndrome',
      'Suicidal ideation (monitor in first weeks)',
      'Sexual dysfunction',
      'GI upset',
    ],
    initialManagement:
      'Start SSRI at low dose: Sertraline 50mg daily OR Escitalopram 10mg daily. Add psychotherapy (CBT or IPT).',
    definitiveTherapy:
      'Titrate to therapeutic dose over 4-6 weeks. If no response, switch SSRI or augment. Continue 6-12 months after remission.',
    supportiveCare: 'Safety assessment, social support, sleep hygiene, exercise',
    timing: 'Chronic',
    duration: '6-12 months minimum after first episode; lifelong if recurrent',
    timeToEffect: '2-4 weeks for initial effect, 6-8 weeks for full effect',
    followUp: 'Weekly initially for safety, then monthly, PHQ-9 at each visit',
    evidenceLevel: 'A',
    guidelineSource: 'APA 2023',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'SSRIs are first-line',
      'Takes 2-4 weeks to see effect',
      'Monitor for suicidality in first weeks',
    ],
    clinicalPearls: [
      'Sertraline or escitalopram preferred (fewer interactions)',
      'Avoid paroxetine in elderly (anticholinergic)',
      'Dont stop abruptly - taper',
    ],
    alternativeTo: [],
    advantages: ['Well-tolerated', 'Once daily dosing', 'Multiple options'],
    disadvantages: ['Delayed onset', 'Sexual side effects', 'Discontinuation syndrome'],
  },

  // ========== MSK ==========
  {
    name: 'Acute Gout Flare Management',
    category: 'Medical',
    type: 'First-line',
    description: 'Anti-inflammatory therapy for acute gout attack',
    indications: [
      'Acute monoarticular arthritis',
      'Monosodium urate crystals on aspirate',
      'Classic podagra presentation',
    ],
    contraindications: [
      'NSAIDs: GI bleeding, CKD, heart failure',
      'Colchicine: Severe renal/hepatic impairment',
      'Steroids: Active infection',
    ],
    complications: ['GI bleeding (NSAIDs)', 'Diarrhea (colchicine)', 'Hyperglycemia (steroids)'],
    initialManagement:
      'NSAIDs (indomethacin 50mg TID or naproxen 500mg BID) x 5-7 days OR Colchicine 1.2mg then 0.6mg in 1 hour (low-dose regimen) OR Prednisone 30-40mg daily x 5 days',
    definitiveTherapy:
      'Complete anti-inflammatory course. Do NOT start or stop urate-lowering therapy during flare.',
    supportiveCare: 'Ice, rest, elevate joint, avoid alcohol and purine-rich foods during flare',
    timing: 'Acute',
    duration: '5-7 days',
    timeToEffect: '24-48 hours for significant improvement',
    followUp: 'Discuss urate-lowering therapy after flare resolves (2-4 weeks)',
    evidenceLevel: 'A',
    guidelineSource: 'ACR 2020',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'NSAIDs, colchicine, or steroids for acute flare',
      'Do NOT start allopurinol during flare',
      'Low-dose colchicine as effective as high-dose',
    ],
    clinicalPearls: [
      'Intra-articular steroid injection is excellent option',
      'Continuing allopurinol if already on it is OK',
      'Joint aspiration rules out septic arthritis',
    ],
    alternativeTo: [],
    advantages: ['Rapid symptom relief', 'Multiple treatment options'],
    disadvantages: ['Does not address uric acid', 'NSAIDs/steroids have significant side effects'],
  },

  // ========== HEME ==========
  {
    name: 'Iron Deficiency Anemia Treatment',
    category: 'Medical',
    type: 'First-line',
    description: 'Oral iron replacement with workup for source',
    indications: ['Microcytic anemia with low ferritin', 'Iron deficiency confirmed'],
    contraindications: [
      'Hemochromatosis',
      'IV iron: Active infection',
      'Oral iron: Unable to tolerate/absorb',
    ],
    complications: [
      'GI upset (constipation, nausea)',
      'Iron overload (with IV)',
      'Anaphylaxis (rare with IV)',
    ],
    initialManagement:
      'Oral ferrous sulfate 325mg (65mg elemental iron) TID or every other day. Take with vitamin C to enhance absorption. Avoid with antacids/calcium.',
    definitiveTherapy:
      'Continue until ferritin >100 and Hgb normalized (usually 3-6 months). IV iron if oral intolerant or malabsorption.',
    supportiveCare: 'Identify and treat source (GI workup if no obvious cause)',
    timing: 'Chronic',
    duration: '3-6 months after Hgb normalizes to replete stores',
    timeToEffect: 'Reticulocyte response in 1-2 weeks, Hgb rise 1-2 g/dL per month',
    followUp: 'CBC/ferritin at 4-8 weeks, GI referral if source unclear',
    evidenceLevel: 'A',
    guidelineSource: 'ASH 2020',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Oral iron first-line',
      'Every other day dosing may be better absorbed',
      'Must identify source (GI malignancy in older adults)',
    ],
    clinicalPearls: [
      'Ferrous sulfate cheapest and effective',
      'GI side effects limit compliance - every other day helps',
      'IV iron for IBD, CKD, post-bariatric',
    ],
    alternativeTo: [],
    advantages: ['Inexpensive', 'Effective', 'Oral'],
    disadvantages: ['GI side effects', 'Slow response', 'Poor absorption in some'],
  },

  // ========== RENAL ==========
  {
    name: 'Hyperkalemia Management',
    category: 'Emergency',
    type: 'First-line',
    description: 'Stabilize, shift, and eliminate potassium',
    indications: [
      'K >6.0 mEq/L',
      'ECG changes (peaked T waves, widened QRS)',
      'Symptomatic hyperkalemia',
    ],
    contraindications: [
      'Calcium: Digoxin toxicity (give slowly)',
      'Insulin: Hypoglycemia (give with glucose)',
    ],
    complications: ['Arrhythmia', 'Cardiac arrest', 'Hypoglycemia (from insulin)'],
    initialManagement:
      'Stabilize: Calcium gluconate 1-2g IV (cardiac membrane). Shift: Insulin 10 units + D50 25g IV, Albuterol nebulized, Sodium bicarb if acidotic.',
    definitiveTherapy:
      'Eliminate: Loop diuretics (if volume), Kayexalate (slow), Dialysis (if severe or refractory). Fix underlying cause (stop ACEi, K-sparing diuretics).',
    supportiveCare: 'Continuous telemetry, repeat K q2-4h, low-K diet',
    timing: 'Acute',
    duration: 'Until K normalized and cause addressed',
    timeToEffect: 'Calcium: seconds. Insulin: 15-30 min. Dialysis: immediate.',
    followUp: 'Identify cause, adjust medications, dietary counseling',
    evidenceLevel: 'B',
    guidelineSource: 'KDIGO',
    panceYield: 3,
    isHighYield: true,
    isFirstLine: true,
    boardYieldFacts: [
      'Calcium stabilizes the heart (does NOT lower K)',
      'Insulin + glucose shifts K into cells',
      'Dialysis for severe/refractory',
    ],
    clinicalPearls: [
      'ECG changes = give calcium immediately',
      'Kayexalate works slowly (not for acute)',
      'Check for hemolysis as lab artifact',
    ],
    alternativeTo: [],
    advantages: ['Life-saving', 'Multiple options'],
    disadvantages: ['Shifting is temporary', 'Dialysis access required for severe'],
  },
];

// Helper to ensure array fields - returns placeholder if empty
function ensureArray(value: any, placeholder?: string): string[] {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return placeholder ? [placeholder] : [];
  }
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') return [value];
  return placeholder ? [placeholder] : [];
}

// Helper to ensure string fields have a value
function ensureString(value: any, fieldName: string): string | undefined {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `No ${fieldName} information available`;
  }
  return String(value);
}

// Helper for optional string fields - returns undefined if empty (allows null in DB)
function optionalString(value: any): string | undefined {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return undefined;
  }
  return String(value);
}

async function insertTreatmentProtocol(protocol: TreatmentProtocol): Promise<boolean> {
  try {
    // Build structured description from protocol components
    let fullDescription = protocol.description || 'No description available';

    // Add protocol sections with clear labels
    fullDescription += `\n\n**Initial Management:** ${protocol.initialManagement || 'Not specified'}`;
    fullDescription += `\n\n**Definitive Therapy:** ${protocol.definitiveTherapy || 'Not specified'}`;
    fullDescription += `\n\n**Supportive Care:** ${protocol.supportiveCare || 'Not specified'}`;
    if (protocol.monitoring) fullDescription += `\n\n**Monitoring:** ${protocol.monitoring}`;

    // Ensure all array fields have meaningful content
    const boardYieldFacts = ensureArray(
      protocol.boardYieldFacts,
      'Review protocol steps for board questions'
    );
    const clinicalPearls = ensureArray(protocol.clinicalPearls, 'Follow evidence-based guidelines');
    const commonMistakes = ensureArray(
      protocol.commonMistakes,
      'No common mistakes documented for this protocol'
    );
    const alternativeTo = ensureArray(
      protocol.alternativeTo,
      'No specific alternatives - this is the standard approach'
    );
    const advantages = ensureArray(protocol.advantages, 'Standard evidence-based approach');
    const disadvantages = ensureArray(
      protocol.disadvantages,
      'Requires appropriate clinical judgment'
    );

    await prisma.treatment.upsert({
      where: { name: protocol.name },
      create: {
        id: crypto.randomUUID(),
        name: protocol.name,
        displayName: protocol.displayName || protocol.name,
        category: protocol.category,
        type: protocol.type || 'First-line',
        description: fullDescription,
        recommendation:
          protocol.recommendation || 'Follow current clinical guidelines for this condition.',
        indications: ensureArray(protocol.indications, 'No specific indications listed'),
        contraindications: ensureArray(
          protocol.contraindications,
          'No absolute contraindications listed'
        ),
        complications: ensureArray(protocol.complications, 'No specific complications listed'),
        timing: protocol.timing || 'Not specified',
        duration: protocol.duration || 'Not specified',
        timeToEffect: protocol.timeToEffect || 'Variable',
        followUp: protocol.followUp || 'Follow-up as clinically indicated',
        evidenceLevel: protocol.evidenceLevel || 'Not graded',
        guidelineSource: protocol.guidelineSource || 'Not specified',
        guidelineYear: protocol.guidelineYear,
        panceYield: protocol.panceYield ?? 2,
        isHighYield: protocol.isHighYield ?? false,
        isFirstLine: protocol.isFirstLine ?? true,
        boardYieldFacts,
        clinicalPearls,
        commonMistakes,
        alternativeTo,
        advantages,
        disadvantages,
      } as any,
      update: {
        displayName: protocol.displayName || protocol.name,
        category: protocol.category,
        type: protocol.type || 'First-line',
        description: fullDescription,
        recommendation:
          protocol.recommendation || 'Follow current clinical guidelines for this condition.',
        indications: ensureArray(protocol.indications, 'No specific indications listed'),
        contraindications: ensureArray(
          protocol.contraindications,
          'No absolute contraindications listed'
        ),
        complications: ensureArray(protocol.complications, 'No specific complications listed'),
        timing: protocol.timing || 'Not specified',
        duration: protocol.duration || 'Not specified',
        timeToEffect: protocol.timeToEffect || 'Variable',
        followUp: protocol.followUp || 'Follow-up as clinically indicated',
        evidenceLevel: protocol.evidenceLevel || 'Not graded',
        guidelineSource: protocol.guidelineSource || 'Not specified',
        guidelineYear: protocol.guidelineYear,
        panceYield: protocol.panceYield ?? 2,
        isHighYield: protocol.isHighYield ?? false,
        isFirstLine: protocol.isFirstLine ?? true,
        boardYieldFacts,
        clinicalPearls,
        commonMistakes,
        alternativeTo,
        advantages,
        disadvantages,
      },
    });
    return true;
  } catch (error: any) {
    console.error(`    Error inserting ${protocol.name}:`, error.message);
    return false;
  }
}

async function generateAITreatmentProtocols(conditions: string[]): Promise<TreatmentProtocol[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('  ⚠️ No GEMINI_API_KEY - skipping AI generation');
    return [];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  await rateLimiter.acquire();

  const prompt = `You are a PA educator creating comprehensive TREATMENT PROTOCOLS for PANCE preparation.

For these conditions: ${conditions.join(', ')}

Create FULL TREATMENT PROTOCOLS (NOT individual drug entries - those go in Drug table).
Each protocol should be the complete management approach for a condition.

Protocol sections to include:
1. Initial management/stabilization
2. Definitive therapy (may include specific drugs, but as part of protocol)
3. Supportive care
4. Monitoring requirements

For each treatment PROTOCOL provide:
- name: Protocol name (e.g., "Community-Acquired Pneumonia Management", "DKA Protocol", "Acute Gout Management")
- category: Medical, Surgical, Procedural, Emergency, Supportive, Physical Therapy, Lifestyle, or Multimodal
- type: First-line, Second-line, Adjunct, Salvage, Prophylaxis, or Maintenance
- description: Brief overview of the management approach
- recommendation: Key guideline recommendation statement (optional)
- indications: Array of when to use this protocol
- contraindications: Array of when NOT to use (or when to modify)
- complications: Potential complications of treatment
- initialManagement: First steps to take (string)
- definitiveTherapy: Main treatment approach (string)
- supportiveCare: Additional supportive measures (string)
- monitoring: What to monitor during/after treatment (string)
- timing: Acute, Chronic, or Maintenance
- duration: How long to treat
- timeToEffect: When to expect improvement
- followUp: What follow-up is needed
- evidenceLevel: A, B, C, or D
- guidelineSource: Organization (e.g., "AHA/ACC", "IDSA", "GOLD")
- guidelineYear: Year of guideline (number, optional)
- panceYield: 1-3 (3 = very high yield for PANCE)
- isHighYield: boolean
- isFirstLine: boolean (is this first-line management?)
- boardYieldFacts: Array of key facts likely on PANCE
- clinicalPearls: Array of practical clinical tips
- commonMistakes: Array of common errors to avoid (optional)
- testQuestionTips: Array of tips for answering test questions (optional)
- alternativeTo: Alternative treatment approaches
- advantages: Benefits of this approach
- disadvantages: Drawbacks/limitations

Focus on PANCE-relevant conditions with current evidence-based protocols.
DO NOT include individual drug entries - focus on management PROTOCOLS.

Return JSON: { "protocols": [...] }`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // Clean up common JSON issues
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    text = text.replace(/[\x00-\x1F\x7F]/g, ' '); // Remove control characters
    text = text.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas

    const data = JSON.parse(text);
    return data.protocols || [];
  } catch (error) {
    console.log('  ⚠️ AI generation failed:', error);
    return [];
  }
}

async function analyzeState() {
  console.log('\n📊 Analyzing Treatment Protocols\n');

  const total = await prisma.treatment.count();
  console.log(`  Total Treatment Protocols: ${total}`);

  const byCategory = await prisma.treatment.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\n  By Category:');
  for (const group of byCategory) {
    console.log(`    ${group.category}: ${group._count.id}`);
  }

  const byType = await prisma.treatment.groupBy({
    by: ['type'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\n  By Type:');
  for (const group of byType) {
    console.log(`    ${group.type || 'Unspecified'}: ${group._count.id}`);
  }

  const highYield = await prisma.treatment.count({ where: { isHighYield: true } });
  console.log(`\n  High-Yield Plans: ${highYield}`);

  const recent = await prisma.treatment.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { name: true, category: true, isHighYield: true },
  });

  console.log('\n  Recent Plans:');
  for (const plan of recent) {
    const marker = plan.isHighYield ? '⭐' : '  ';
    console.log(`    ${marker} ${plan.name} (${plan.category})`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const analyzeOnly = args.includes('--analyze');
  const knownOnly = args.includes('--known-only');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 15;

  console.log('\n🏥 Treatment Protocol Doctor - Comprehensive Management Protocol Generator\n');

  if (analyzeOnly) {
    await analyzeState();
    await prisma.$disconnect();
    return;
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No database changes\n');
  }

  // Phase 1: Insert known treatment protocols
  console.log('📚 Phase 1: Inserting Known Treatment Protocols\n');
  console.log(`  Found ${KNOWN_TREATMENT_PROTOCOLS.length} known treatment protocols`);

  let inserted = 0;
  let updated = 0;

  for (const protocol of KNOWN_TREATMENT_PROTOCOLS) {
    if (isDryRun) {
      console.log(`  Would insert: ${protocol.name}`);
      inserted++;
    } else {
      const existed = await prisma.treatment.findUnique({ where: { name: protocol.name } });
      const success = await insertTreatmentProtocol(protocol);
      if (success) {
        if (existed) {
          updated++;
          console.log(`  ♻️ Updated: ${protocol.name}`);
        } else {
          inserted++;
          console.log(`  ✅ Created: ${protocol.name}`);
        }
      }
    }
  }

  console.log(`\n  Summary: ${inserted} inserted, ${updated} updated\n`);

  if (knownOnly) {
    console.log('📈 FINAL STATE:\n');
    await analyzeState();
    await prisma.$disconnect();
    console.log('\n✨ Treatment Protocol Doctor complete (known only)!\n');
    return;
  }

  // Phase 2: AI Generation for more conditions
  console.log('🤖 Phase 2: AI-Assisted Treatment Protocol Generation\n');

  // Get high-yield conditions that might need treatment protocols
  const conditions = await prisma.condition.findMany({
    where: {
      system: {
        in: [
          'CV',
          'PULM',
          'GI',
          'NEURO',
          'MSK',
          'ID',
          'ENDO',
          'HEME',
          'RENAL',
          'PSYCH',
          'DERM',
          'REPRO',
        ],
      },
    },
    select: { name: true },
  });

  // Filter to conditions that don't already have treatment protocols
  const existingProtocols = await prisma.treatment.findMany({ select: { name: true } });
  const existingNames = new Set(existingProtocols.map((p) => p.name.toLowerCase()));

  const conditionsNeedingProtocols = conditions.filter((c) => {
    const protocolName = `${c.name} Management`.toLowerCase();
    const protocolName2 = `${c.name} Treatment`.toLowerCase();
    const protocolName3 = `${c.name} Protocol`.toLowerCase();
    return (
      !existingNames.has(protocolName) &&
      !existingNames.has(protocolName2) &&
      !existingNames.has(protocolName3) &&
      !existingNames.has(c.name.toLowerCase())
    );
  });

  console.log(
    `  Processing ${conditionsNeedingProtocols.length} conditions for treatment protocols\n`
  );

  const conditionNames = conditionsNeedingProtocols.map((c) => c.name);
  const totalBatches = Math.ceil(conditionNames.length / batchSize);
  let aiInserted = 0;
  let aiSkipped = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batch = conditionNames.slice(i * batchSize, (i + 1) * batchSize);
    console.log(`  Processing batch ${i + 1}/${totalBatches} (${batch.length} conditions)...`);

    if (isDryRun) {
      console.log(`    Would generate AI protocols for: ${batch.slice(0, 3).join(', ')}...`);
      continue;
    }

    const aiProtocols = await generateAITreatmentProtocols(batch);

    if (aiProtocols.length > 0) {
      console.log(`    AI generated ${aiProtocols.length} protocol candidates`);

      for (const protocol of aiProtocols) {
        if (!protocol.name || !protocol.category) continue;

        const success = await insertTreatmentProtocol(protocol);
        if (success) {
          aiInserted++;
          console.log(`    ✅ ${protocol.name}`);
        } else {
          aiSkipped++;
        }
      }
    }
  }

  console.log(`\n  Summary: ${aiInserted} inserted, ${aiSkipped} skipped\n`);

  console.log('📈 FINAL STATE:\n');
  await analyzeState();

  await prisma.$disconnect();
  console.log('\n✨ Treatment Protocol Doctor complete!\n');
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
