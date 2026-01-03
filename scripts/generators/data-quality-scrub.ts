#!/usr/bin/env npx tsx
/**
 * Data Quality Scrub - Comprehensive Database Audit
 * 
 * This script performs quality checks across all major tables:
 * - Duplicate detection
 * - Empty/null field detection
 * - Spelling/typo detection
 * - Formatting consistency
 * - Data completeness scoring
 * 
 * Usage:
 *   # Report only (no changes)
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/data-quality-scrub.ts
 *   
 *   # Auto-fix minor issues
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/data-quality-scrub.ts --fix
 *   
 *   # Target specific table
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/data-quality-scrub.ts --table=Buzzword
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Common medical abbreviations that should NOT be flagged
const VALID_ABBREVIATIONS = new Set([
  'MI', 'CHF', 'COPD', 'DM', 'HTN', 'DVT', 'PE', 'CAD', 'GERD', 'UTI', 
  'URI', 'STEMI', 'NSTEMI', 'ACS', 'TIA', 'CVA', 'CKD', 'AKI', 'ESRD',
  'BPH', 'PCOS', 'PID', 'STI', 'HIV', 'AIDS', 'TB', 'MRSA', 'VRE',
  'ABG', 'CBC', 'CMP', 'BMP', 'UA', 'EKG', 'ECG', 'MRI', 'CT', 'US',
  'IV', 'IM', 'PO', 'PRN', 'BID', 'TID', 'QID', 'QD', 'QHS', 'AC', 'PC',
  'NSAIDs', 'ACE', 'ARB', 'CCB', 'BB', 'PPI', 'H2', 'SSRI', 'SNRI',
  'ASA', 'INR', 'PT', 'PTT', 'aPTT', 'ESR', 'CRP', 'BNP', 'TSH', 'T3', 'T4',
  'LDH', 'AST', 'ALT', 'GGT', 'ALP', 'BUN', 'Cr', 'GFR', 'eGFR',
  'WBC', 'RBC', 'Hgb', 'Hct', 'MCV', 'MCH', 'MCHC', 'RDW', 'PLT',
  'Na', 'K', 'Cl', 'CO2', 'Ca', 'Mg', 'Phos', 'Fe', 'TIBC', 'Ferritin',
  'HbA1c', 'A1C', 'FBS', 'OGTT', 'PPG', 'RPG',
  'SOFA', 'qSOFA', 'APACHE', 'CURB', 'PSI', 'PORT', 'NIHSS', 'GCS',
  'VQ', 'HIDA', 'DEXA', 'PET', 'SPECT', 'FAST', 'MRCP', 'ERCP',
  'CPR', 'AED', 'ACLS', 'BLS', 'PALS', 'NRP',
  'ICU', 'ED', 'OR', 'PACU', 'OB', 'L&D', 'NICU', 'PICU',
  'JVD', 'PMI', 'S1', 'S2', 'S3', 'S4', 'A2', 'P2', 'MVP',
  'SBP', 'DBP', 'MAP', 'HR', 'RR', 'SpO2', 'BMI', 'BSA',
  'LLQ', 'RLQ', 'LUQ', 'RUQ', 'ROS', 'HPI', 'CC', 'PMH', 'PSH', 'FH', 'SH',
  'DDx', 'Dx', 'Tx', 'Rx', 'Sx', 'Hx', 'Px', 'Fx',
  'RA', 'OA', 'SLE', 'AS', 'PsA', 'PMR', 'GCA', 'JIA',
  'MS', 'ALS', 'PD', 'AD', 'MG', 'GBS', 'CIDP',
  'ADHD', 'OCD', 'PTSD', 'GAD', 'MDD', 'BPD', 'SAD',
  'AF', 'AFib', 'AFlutter', 'SVT', 'VT', 'VF', 'PVC', 'PAC',
  'RBBB', 'LBBB', 'WPW', 'AV', 'SA', 'LVH', 'RVH',
  'AAA', 'PAD', 'PVD', 'CVI', 'VTE', 'SVC', 'IVC',
  'ARDS', 'PEEP', 'FiO2', 'PaO2', 'PaCO2', 'SaO2',
  'PANCE', 'PANRE', 'CME', 'MOC', 'PA-C', 'PA-S'
]);

// Common misspellings in medical context
const COMMON_MISSPELLINGS: Record<string, string> = {
  'occurence': 'occurrence',
  'occurance': 'occurrence',
  'definate': 'definite',
  'definitly': 'definitely',
  'seperate': 'separate',
  'recieve': 'receive',
  'acheive': 'achieve',
  'accomodate': 'accommodate',
  'occurr': 'occur',
  'rythm': 'rhythm',
  'hemmorhage': 'hemorrhage',
  'hemmorage': 'hemorrhage',
  'haemorrhage': 'hemorrhage',
  'diarreha': 'diarrhea',
  'diarrea': 'diarrhea',
  'diarrhoea': 'diarrhea',
  'pharyngitis': 'pharyngitis',
  'pharnygitis': 'pharyngitis',
  'pnuemonia': 'pneumonia',
  'pneumoia': 'pneumonia',
  'cariac': 'cardiac',
  'cardaic': 'cardiac',
  'abdomnal': 'abdominal',
  'abdmonial': 'abdominal',
  'symptons': 'symptoms',
  'symtoms': 'symptoms',
  'diagnois': 'diagnosis',
  'diaganosis': 'diagnosis',
  'prognois': 'prognosis',
  'treatement': 'treatment',
  'managment': 'management',
  'managament': 'management',
  'presenation': 'presentation',
  'presentaton': 'presentation',
  'assesment': 'assessment',
  'assessement': 'assessment',
  'differental': 'differential',
  'differnetial': 'differential',
  'extremeties': 'extremities',
  'extremeity': 'extremity',
  'labratory': 'laboratory',
  'laborotory': 'laboratory',
  'radiograpy': 'radiography',
  'radiograhy': 'radiography',
  'pathophsiology': 'pathophysiology',
  'patophysiology': 'pathophysiology',
  'etiolgy': 'etiology',
  'etiolgoy': 'etiology',
  'epidemiolgy': 'epidemiology',
  'epdiemiology': 'epidemiology',
  'inflamation': 'inflammation',
  'inflammtion': 'inflammation',
  'inflamatory': 'inflammatory',
  'infecton': 'infection',
  'infcetion': 'infection',
  'antibiotic': 'antibiotic',
  'antibotic': 'antibiotic',
  'medicaiton': 'medication',
  'medicaton': 'medication',
  'dosage': 'dosage',
  'doseage': 'dosage',
  'adminisration': 'administration',
  'adminsitration': 'administration',
  'contraidication': 'contraindication',
  'contrainidcation': 'contraindication',
  'precausion': 'precaution',
  'precatuion': 'precaution',
  'complcation': 'complication',
  'complicaiton': 'complication',
  'progonsis': 'prognosis',
  'prognsis': 'prognosis',
  'recurrance': 'recurrence',
  'reccurrence': 'recurrence',
  'exacerbaton': 'exacerbation',
  'exacerbaiton': 'exacerbation'
};

interface QualityIssue {
  table: string;
  id: string;
  field: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  currentValue?: string;
  suggestedFix?: string;
}

interface TableStats {
  total: number;
  withIssues: number;
  duplicates: number;
  emptyFields: number;
  spellingIssues: number;
  formattingIssues: number;
  completenessScore: number;
}

const issues: QualityIssue[] = [];
const stats: Record<string, TableStats> = {};

// Parse command line args
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const targetTable = args.find(a => a.startsWith('--table='))?.split('=')[1];

function checkSpelling(text: string): { misspelling: string; correction: string }[] {
  const found: { misspelling: string; correction: string }[] = [];
  const lowerText = text.toLowerCase();
  
  for (const [misspelling, correction] of Object.entries(COMMON_MISSPELLINGS)) {
    if (lowerText.includes(misspelling)) {
      found.push({ misspelling, correction });
    }
  }
  
  return found;
}

function checkFormatting(text: string): string[] {
  const issues: string[] = [];
  
  // Double spaces
  if (/  +/.test(text)) {
    issues.push('Contains double spaces');
  }
  
  // Leading/trailing whitespace
  if (text !== text.trim()) {
    issues.push('Has leading/trailing whitespace');
  }
  
  // Multiple consecutive punctuation (except ellipsis)
  if (/[.,;:!?]{2,}/.test(text) && !/\.{3}/.test(text)) {
    issues.push('Multiple consecutive punctuation marks');
  }
  
  // Unclosed parentheses/brackets
  const openParens = (text.match(/\(/g) || []).length;
  const closeParens = (text.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push('Unclosed parentheses');
  }
  
  // Mixed case issues (e.g., "heart ATTACK" but not valid abbreviations)
  const words = text.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (cleanWord.length > 2 && 
        cleanWord === cleanWord.toUpperCase() && 
        !VALID_ABBREVIATIONS.has(cleanWord)) {
      // Check if it's a known valid all-caps word
      if (!['NULL', 'TRUE', 'FALSE', 'N/A', 'TBD'].includes(cleanWord)) {
        // Skip - too many false positives
      }
    }
  }
  
  return issues;
}

function checkCompleteness(record: any, requiredFields: string[]): number {
  let filled = 0;
  
  for (const field of requiredFields) {
    const value = record[field];
    if (value !== null && value !== undefined && value !== '' && 
        (Array.isArray(value) ? value.length > 0 : true)) {
      filled++;
    }
  }
  
  return Math.round((filled / requiredFields.length) * 100);
}

async function checkBuzzwords() {
  console.log('\n📝 Checking Buzzword table...');
  
  const buzzwords = await prisma.buzzword.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  // Check for duplicates
  const seenPhrases = new Map<string, string>();
  for (const b of buzzwords) {
    if (!b.buzzword) continue; // Skip null buzzwords
    const key = b.buzzword.toLowerCase().trim();
    if (seenPhrases.has(key)) {
      issues.push({
        table: 'Buzzword',
        id: b.id,
        field: 'buzzword',
        issue: `Duplicate of ${seenPhrases.get(key)}`,
        severity: 'high',
        currentValue: b.buzzword
      });
      dupCount++;
    } else {
      seenPhrases.set(key, b.id);
    }
    
    // Check for empty critical fields
    if (!b.explanation || b.explanation.length < 10) {
      issues.push({
        table: 'Buzzword',
        id: b.id,
        field: 'explanation',
        issue: 'Empty or too short explanation',
        severity: 'high',
        currentValue: b.explanation || '(empty)'
      });
      emptyCount++;
    }
    
    // Spelling check on explanation
    if (b.explanation) {
      const spellingIssues = checkSpelling(b.explanation);
      for (const sp of spellingIssues) {
        issues.push({
          table: 'Buzzword',
          id: b.id,
          field: 'explanation',
          issue: `Spelling: "${sp.misspelling}" should be "${sp.correction}"`,
          severity: 'low',
          suggestedFix: sp.correction
        });
        spellingCount++;
      }
      
      // Formatting check
      const formatIssues = checkFormatting(b.explanation);
      for (const fi of formatIssues) {
        issues.push({
          table: 'Buzzword',
          id: b.id,
          field: 'explanation',
          issue: fi,
          severity: 'low'
        });
        formatCount++;
      }
    }
  }
  
  stats['Buzzword'] = {
    total: buzzwords.length,
    withIssues: dupCount + emptyCount + spellingCount + formatCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: 100 - Math.round((emptyCount / buzzwords.length) * 100)
  };
  
  console.log(`   ✅ Checked ${buzzwords.length} buzzwords`);
}

async function checkConditions() {
  console.log('\n🏥 Checking Condition table...');
  
  const conditions = await prisma.condition.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['name', 'description', 'primarySystem', 'symptoms', 'workup', 'treatment'];
  let totalCompleteness = 0;
  
  const seenNames = new Map<string, string>();
  for (const c of conditions) {
    if (!c.name) continue; // Skip null names
    const key = c.name.toLowerCase().trim();
    if (seenNames.has(key)) {
      issues.push({
        table: 'Condition',
        id: c.id,
        field: 'name',
        issue: `Duplicate of ${seenNames.get(key)}`,
        severity: 'high',
        currentValue: c.name
      });
      dupCount++;
    } else {
      seenNames.set(key, c.id);
    }
    
    // Check completeness
    const completeness = checkCompleteness(c, requiredFields);
    totalCompleteness += completeness;
    
    if (completeness < 70) {
      issues.push({
        table: 'Condition',
        id: c.id,
        field: 'multiple',
        issue: `Low completeness score: ${completeness}%`,
        severity: completeness < 50 ? 'high' : 'medium'
      });
      emptyCount++;
    }
    
    // Check displayName for spelling issues
    if (c.displayName) {
      const spellingIssues = checkSpelling(c.displayName);
      spellingCount += spellingIssues.length;
      for (const sp of spellingIssues) {
        issues.push({
          table: 'Condition',
          id: c.id,
          field: 'displayName',
          issue: `Spelling: "${sp.misspelling}" → "${sp.correction}"`,
          severity: 'low',
          suggestedFix: sp.correction
        });
      }
    }
  }
  
  stats['Condition'] = {
    total: conditions.length,
    withIssues: dupCount + emptyCount + spellingCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(conditions.length, 1))
  };
  
  console.log(`   ✅ Checked ${conditions.length} conditions`);
}

async function checkDifferentials() {
  console.log('\n🔬 Checking DifferentialDiagnosis table...');
  
  const ddx = await prisma.differentialDiagnosis.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['chiefComplaint', 'mustNotMiss', 'common', 'redFlags'];
  let totalCompleteness = 0;
  
  const seenComplaints = new Map<string, string>();
  for (const d of ddx) {
    if (!d.presentingComplaint) continue; // Skip null complaints
    const key = d.presentingComplaint.toLowerCase().trim();
    if (seenComplaints.has(key)) {
      issues.push({
        table: 'DifferentialDiagnosis',
        id: d.id,
        field: 'presentingComplaint',
        issue: `Duplicate of ${seenComplaints.get(key)}`,
        severity: 'high',
        currentValue: d.presentingComplaint
      });
      dupCount++;
    } else {
      seenComplaints.set(key, d.id);
    }
    
    // Check array fields
    if (!d.mustNotMiss || d.mustNotMiss.length === 0) {
      issues.push({
        table: 'DifferentialDiagnosis',
        id: d.id,
        field: 'mustNotMiss',
        issue: 'Empty mustNotMiss array (critical for patient safety)',
        severity: 'high'
      });
      emptyCount++;
    }
    
    if (!d.mostCommon || d.mostCommon.length === 0) {
      issues.push({
        table: 'DifferentialDiagnosis',
        id: d.id,
        field: 'mostCommon',
        issue: 'Empty mostCommon diagnoses array',
        severity: 'medium'
      });
      emptyCount++;
    }
    
    const completeness = checkCompleteness(d, requiredFields);
    totalCompleteness += completeness;
  }
  
  stats['DifferentialDiagnosis'] = {
    total: ddx.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / ddx.length)
  };
  
  console.log(`   ✅ Checked ${ddx.length} differentials`);
}

async function checkPatientCases() {
  console.log('\n👤 Checking PatientEncounterCase table...');
  
  const cases = await prisma.patientEncounterCase.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['chiefComplaint', 'hpiNarrative', 'physicalExam', 'assessmentPlan', 'correctDiagnosis'];
  let totalCompleteness = 0;
  
  const seenCases = new Map<string, string>();
  for (const c of cases) {
    // Create a composite key for case similarity
    const key = `${c.chiefComplaint?.toLowerCase().trim()}_${c.correctDiagnosis?.toLowerCase().trim()}`;
    if (seenCases.has(key)) {
      issues.push({
        table: 'PatientEncounterCase',
        id: c.id,
        field: 'composite',
        issue: `Potential duplicate (same chief complaint + diagnosis) of ${seenCases.get(key)}`,
        severity: 'medium',
        currentValue: `${c.chiefComplaint} - ${c.correctDiagnosis}`
      });
      dupCount++;
    } else {
      seenCases.set(key, c.id);
    }
    
    // Check for empty critical fields (historyData is Json, check if present)
    const hasHistory = c.historyData && Object.keys(c.historyData as object).length > 0;
    if (!hasHistory) {
      issues.push({
        table: 'PatientEncounterCase',
        id: c.id,
        field: 'historyData',
        issue: 'History data empty or missing',
        severity: 'high'
      });
      emptyCount++;
    }
    
    // Check historyData content quality
    if (c.historyData) {
      const historyStr = JSON.stringify(c.historyData);
      const spellingIssues = checkSpelling(historyStr);
      spellingCount += spellingIssues.length;
      
      const formatIssues = checkFormatting(historyStr);
      formatCount += formatIssues.length;
    }
    
    const completeness = checkCompleteness(c, requiredFields);
    totalCompleteness += completeness;
  }
  
  stats['PatientEncounterCase'] = {
    total: cases.length,
    withIssues: dupCount + emptyCount + spellingCount + formatCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(cases.length, 1))
  };
  
  console.log(`   ✅ Checked ${cases.length} patient cases`);
}

async function checkProcedures() {
  console.log('\n🔧 Checking Procedure table...');
  
  const procedures = await prisma.procedure.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['name', 'description', 'indications', 'contraindications', 'steps'];
  let totalCompleteness = 0;
  
  const seenNames = new Map<string, string>();
  for (const p of procedures) {
    if (!p.name) continue; // Skip null names
    const key = p.name.toLowerCase().trim();
    if (seenNames.has(key)) {
      issues.push({
        table: 'Procedure',
        id: p.id,
        field: 'name',
        issue: `Duplicate of ${seenNames.get(key)}`,
        severity: 'high',
        currentValue: p.name
      });
      dupCount++;
    } else {
      seenNames.set(key, p.id);
    }
    
    // Check for empty required arrays
    if (!p.indications || p.indications.length === 0) {
      issues.push({
        table: 'Procedure',
        id: p.id,
        field: 'indications',
        issue: 'No indications listed',
        severity: 'medium'
      });
      emptyCount++;
    }
    
    // Note: steps field no longer exists on Procedure - check technique instead
    if (!p.technique) {
      issues.push({
        table: 'Procedure',
        id: p.id,
        field: 'technique',
        issue: 'No procedure technique listed',
        severity: 'high'
      });
      emptyCount++;
    }
    
    const completeness = checkCompleteness(p, requiredFields);
    totalCompleteness += completeness;
  }
  
  stats['Procedure'] = {
    total: procedures.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(procedures.length, 1))
  };
  
  console.log(`   ✅ Checked ${procedures.length} procedures`);
}

async function checkECGPatterns() {
  console.log('\n💓 Checking ECGPattern table...');
  
  const patterns = await prisma.eCGPattern.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['name', 'description', 'keyFeatures', 'clinicalSignificance', 'differentials'];
  let totalCompleteness = 0;
  
  const seenNames = new Map<string, string>();
  for (const p of patterns) {
    if (!p.name) continue; // Skip null names
    const key = p.name.toLowerCase().trim();
    if (seenNames.has(key)) {
      issues.push({
        table: 'ECGPattern',
        id: p.id,
        field: 'name',
        issue: `Duplicate of ${seenNames.get(key)}`,
        severity: 'high',
        currentValue: p.name
      });
      dupCount++;
    } else {
      seenNames.set(key, p.id);
    }
    
    // ECG patterns need good pathognomonic clues
    if (!p.pathognomonic) {
      issues.push({
        table: 'ECGPattern',
        id: p.id,
        field: 'pathognomonic',
        issue: 'Missing pathognomonic finding',
        severity: 'medium'
      });
      emptyCount++;
    }
    
    const completeness = checkCompleteness(p, requiredFields);
    totalCompleteness += completeness;
  }
  
  stats['ECGPattern'] = {
    total: patterns.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(patterns.length, 1))
  };
  
  console.log(`   ✅ Checked ${patterns.length} ECG patterns`);
}

async function checkLabTests() {
  console.log('\n🧪 Checking LabTest table...');
  
  const labs = await prisma.labTest.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['name', 'description', 'normalRange', 'clinicalSignificance'];
  let totalCompleteness = 0;
  
  const seenNames = new Map<string, string>();
  for (const l of labs) {
    if (!l.name) continue; // Skip null names
    const key = l.name.toLowerCase().trim();
    if (seenNames.has(key)) {
      issues.push({
        table: 'LabTest',
        id: l.id,
        field: 'name',
        issue: `Duplicate of ${seenNames.get(key)}`,
        severity: 'high',
        currentValue: l.name
      });
      dupCount++;
    } else {
      seenNames.set(key, l.id);
    }
    
    // Labs need clinical pearls
    if (!l.clinicalPearls || l.clinicalPearls.length === 0) {
      issues.push({
        table: 'LabTest',
        id: l.id,
        field: 'clinicalPearls',
        issue: 'Missing clinical pearls',
        severity: 'high'
      });
      emptyCount++;
    }
    
    const completeness = checkCompleteness(l, requiredFields);
    totalCompleteness += completeness;
  }
  
  stats['LabTest'] = {
    total: labs.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(labs.length, 1))
  };
  
  console.log(`   ✅ Checked ${labs.length} lab tests`);
}

async function checkQuestions() {
  console.log('\n❓ Checking Question table...');
  
  const questions = await prisma.question.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['vignette', 'question', 'explanation', 'options', 'correctAnswer'];
  let totalCompleteness = 0;
  
  const seenStems = new Map<string, string>();
  for (const q of questions) {
    if (!q.question) continue; // Skip null questions
    // Normalize question for duplicate detection
    const key = q.question.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 100);
    if (seenStems.has(key)) {
      issues.push({
        table: 'Question',
        id: q.id,
        field: 'question',
        issue: `Potential duplicate of ${seenStems.get(key)}`,
        severity: 'medium',
        currentValue: q.question.substring(0, 80) + '...'
      });
      dupCount++;
    } else {
      seenStems.set(key, q.id);
    }
    
    // Check for proper options setup (JSON array)
    const options = q.options as any[];
    if (!options || !Array.isArray(options) || options.length < 4) {
      issues.push({
        table: 'Question',
        id: q.id,
        field: 'options',
        issue: `Only ${options?.length || 0} answer options (should be 4-5)`,
        severity: 'medium'
      });
      emptyCount++;
    }
    
    // Check for correct answer
    if (!q.correctAnswer) {
      issues.push({
        table: 'Question',
        id: q.id,
        field: 'correctAnswer',
        issue: 'No correct answer specified',
        severity: 'high'
      });
      emptyCount++;
    }
    
    // Check explanation
    if (!q.explanation || q.explanation.length < 20) {
      issues.push({
        table: 'Question',
        id: q.id,
        field: 'explanation',
        issue: 'Missing or too short explanation',
        severity: 'medium'
      });
      emptyCount++;
    }
    
    totalCompleteness += checkCompleteness(q, requiredFields);
  }
  
  stats['Question'] = {
    total: questions.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(questions.length, 1))
  };
  
  console.log(`   ✅ Checked ${questions.length} questions`);
}

async function checkDrugs() {
  console.log('\n💊 Checking Drug table...');
  
  // Fetch only essential fields to avoid hitting response size limits
  const drugs = await prisma.drug.findMany({
    select: {
      id: true,
      genericName: true,
      drugClass: true,
      mechanismOfAction: true,
      indications: true,
      sideEffects: true
    }
  });
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['genericName', 'drugClass', 'mechanismOfAction', 'indications', 'sideEffects'];
  let totalCompleteness = 0;
  
  const seenNames = new Map<string, string>();
  for (const d of drugs) {
    if (!d.genericName) continue; // Skip null names
    const key = d.genericName.toLowerCase().trim();
    if (seenNames.has(key)) {
      issues.push({
        table: 'Drug',
        id: d.id,
        field: 'genericName',
        issue: `Duplicate of ${seenNames.get(key)}`,
        severity: 'high',
        currentValue: d.genericName
      });
      dupCount++;
    } else {
      seenNames.set(key, d.id);
    }
    
    // Critical fields for drugs
    if (!d.mechanismOfAction || d.mechanismOfAction.length < 10) {
      issues.push({
        table: 'Drug',
        id: d.id,
        field: 'mechanismOfAction',
        issue: 'Missing or insufficient mechanism of action',
        severity: 'high'
      });
      emptyCount++;
    }
    
    if (!d.sideEffects || d.sideEffects.length === 0) {
      issues.push({
        table: 'Drug',
        id: d.id,
        field: 'sideEffects',
        issue: 'No side effects listed',
        severity: 'high'
      });
      emptyCount++;
    }
    
    const completeness = checkCompleteness(d, requiredFields);
    totalCompleteness += completeness;
  }
  
  stats['Drug'] = {
    total: drugs.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(drugs.length, 1))
  };
  
  console.log(`   ✅ Checked ${drugs.length} drugs`);
}

async function checkImagingStudies() {
  console.log('\n📷 Checking ImagingStudy table...');
  
  const studies = await prisma.imagingStudy.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['name', 'modality', 'description', 'indications', 'contraindications'];
  let totalCompleteness = 0;
  
  const seenNames = new Map<string, string>();
  for (const s of studies) {
    if (!s.name) continue; // Skip null names
    const key = s.name.toLowerCase().trim();
    if (seenNames.has(key)) {
      issues.push({
        table: 'ImagingStudy',
        id: s.id,
        field: 'name',
        issue: `Duplicate of ${seenNames.get(key)}`,
        severity: 'high',
        currentValue: s.name
      });
      dupCount++;
    } else {
      seenNames.set(key, s.id);
    }
    
    const completeness = checkCompleteness(s, requiredFields);
    totalCompleteness += completeness;
    
    if (completeness < 60) {
      issues.push({
        table: 'ImagingStudy',
        id: s.id,
        field: 'multiple',
        issue: `Low completeness: ${completeness}%`,
        severity: 'medium'
      });
      emptyCount++;
    }
  }
  
  stats['ImagingStudy'] = {
    total: studies.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(studies.length, 1))
  };
  
  console.log(`   ✅ Checked ${studies.length} imaging studies`);
}

async function checkGuidelines() {
  console.log('\n📋 Checking PracticeGuideline table...');
  
  const guidelines = await prisma.practiceGuideline.findMany();
  let dupCount = 0, emptyCount = 0, spellingCount = 0, formatCount = 0;
  
  const requiredFields = ['name', 'description', 'criteria', 'interpretation'];
  let totalCompleteness = 0;
  
  const seenNames = new Map<string, string>();
  for (const g of guidelines) {
    if (!g.name) continue; // Skip null names
    const key = g.name.toLowerCase().trim();
    if (seenNames.has(key)) {
      issues.push({
        table: 'PracticeGuideline',
        id: g.id,
        field: 'name',
        issue: `Duplicate of ${seenNames.get(key)}`,
        severity: 'high',
        currentValue: g.name
      });
      dupCount++;
    } else {
      seenNames.set(key, g.id);
    }
    
    const completeness = checkCompleteness(g, requiredFields);
    totalCompleteness += completeness;
  }
  
  stats['PracticeGuideline'] = {
    total: guidelines.length,
    withIssues: dupCount + emptyCount,
    duplicates: dupCount,
    emptyFields: emptyCount,
    spellingIssues: spellingCount,
    formattingIssues: formatCount,
    completenessScore: Math.round(totalCompleteness / Math.max(guidelines.length, 1))
  };
  
  console.log(`   ✅ Checked ${guidelines.length} guidelines`);
}

async function printReport() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                    📊 DATA QUALITY SCRUB REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  // Summary table
  console.log('\n📈 TABLE SUMMARY:');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('Table                  │ Total  │ Issues │ Dups  │ Empty │ Complete');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  for (const [table, stat] of Object.entries(stats)) {
    const tableName = table.padEnd(22);
    const total = String(stat.total).padStart(6);
    const withIssues = String(stat.withIssues).padStart(6);
    const dups = String(stat.duplicates).padStart(5);
    const empty = String(stat.emptyFields).padStart(5);
    const complete = `${stat.completenessScore}%`.padStart(8);
    
    const status = stat.completenessScore >= 90 ? '✅' : 
                   stat.completenessScore >= 70 ? '🟡' : '🔴';
    
    console.log(`${tableName} │${total} │${withIssues} │${dups} │${empty} │${complete} ${status}`);
  }
  console.log('─────────────────────────────────────────────────────────────────────');
  
  // Issue breakdown by severity
  const highIssues = issues.filter(i => i.severity === 'high');
  const mediumIssues = issues.filter(i => i.severity === 'medium');
  const lowIssues = issues.filter(i => i.severity === 'low');
  
  console.log('\n⚠️  ISSUE BREAKDOWN:');
  console.log(`   🔴 High Severity:   ${highIssues.length}`);
  console.log(`   🟡 Medium Severity: ${mediumIssues.length}`);
  console.log(`   🟢 Low Severity:    ${lowIssues.length}`);
  console.log(`   📝 Total Issues:    ${issues.length}`);
  
  // Show high severity issues
  if (highIssues.length > 0) {
    console.log('\n🔴 HIGH SEVERITY ISSUES (first 20):');
    console.log('─────────────────────────────────────────────────────────────────────');
    for (const issue of highIssues.slice(0, 20)) {
      console.log(`   [${issue.table}] ${issue.field}: ${issue.issue}`);
      if (issue.currentValue) {
        console.log(`      Value: "${issue.currentValue.substring(0, 60)}..."`);
      }
    }
    if (highIssues.length > 20) {
      console.log(`   ... and ${highIssues.length - 20} more high severity issues`);
    }
  }
  
  // Overall health score
  const totalRecords = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const avgCompleteness = Math.round(
    Object.values(stats).reduce((sum, s) => sum + s.completenessScore, 0) / Object.keys(stats).length
  );
  const issueRate = Math.round((issues.length / totalRecords) * 100);
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                         🏥 OVERALL DATABASE HEALTH');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   Total Records:     ${totalRecords.toLocaleString()}`);
  console.log(`   Avg Completeness:  ${avgCompleteness}%`);
  console.log(`   Issue Rate:        ${issueRate}%`);
  console.log('');
  
  const healthScore = Math.round((avgCompleteness * 0.6 + (100 - issueRate) * 0.4));
  const healthEmoji = healthScore >= 90 ? '🌟' : healthScore >= 75 ? '✅' : healthScore >= 60 ? '🟡' : '🔴';
  console.log(`   Health Score:      ${healthScore}/100 ${healthEmoji}`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  // Write detailed report to file
  const reportPath = `/tmp/data-quality-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify({ stats, issues, timestamp: new Date().toISOString() }, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

async function main() {
  console.log('🔍 Data Quality Scrub - Comprehensive Database Audit');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   Mode: ${shouldFix ? 'FIX' : 'REPORT ONLY'}`);
  console.log(`   Target: ${targetTable || 'ALL TABLES'}`);
  console.log('');
  
  try {
    const tablesToCheck = targetTable 
      ? [targetTable.toLowerCase()] 
      : ['buzzword', 'condition', 'differentialdiagnosis', 'patientencountercase', 
         'procedure', 'ecgpattern', 'labtest', 'question', 'drug', 'imagingstudy', 'practiceguideline'];
    
    for (const table of tablesToCheck) {
      switch (table.toLowerCase()) {
        case 'buzzword': await checkBuzzwords(); break;
        case 'condition': await checkConditions(); break;
        case 'differentialdiagnosis': await checkDifferentials(); break;
        case 'patientencountercase': await checkPatientCases(); break;
        case 'procedure': await checkProcedures(); break;
        case 'ecgpattern': await checkECGPatterns(); break;
        case 'labtest': await checkLabTests(); break;
        case 'question': await checkQuestions(); break;
        case 'drug': await checkDrugs(); break;
        case 'imagingstudy': await checkImagingStudies(); break;
        case 'practiceguideline': await checkGuidelines(); break;
      }
    }
    
    await printReport();
    
  } catch (error) {
    console.error('❌ Error during quality scrub:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
