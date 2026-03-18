/**
 * TASK 3: Systematic Buzzword Integrity Audit
 *
 * Audit all MedicalContent records to:
 * 1. Build condition → expected buzzwords map
 * 2. Detect cross-contamination (acronyms appearing in wrong conditions)
 * 3. Report scope of integrity issues
 * 4. DO NOT GENERATE OR MODIFY DATA - only report findings
 */

import { prisma, disconnect } from './_shared/db';

// Acronym mappings - legitimate acronyms that belong to specific systems/conditions
const SYSTEM_ACRONYMS: Record<string, string[]> = {
  CV: [
    'AV Block', 'VT', 'AF', 'SVT', 'PAC', 'PVC', 'JVP', 'S1', 'S2', 'S3', 'S4',
    'MI', 'ACS', 'STEMI', 'NSTEMI', 'ECG', 'EF', 'BNP', 'troponin', 'CK-MB',
    'ACE', 'ARB', 'BB', 'CCB', 'thiazide', 'loop diuretic', 'PAH', 'CHF', 'HFrEF',
    'HFpEF', 'restrictive', 'hypertrophic', 'takotsubo',
  ],
  REPRO: [
    'PROM', 'PPROM', 'GDM', 'eclampsia', 'preeclampsia', 'PIH', 'oligohydramnios',
    'polyhydramnios', 'FGR', 'IUGR', 'LGA', 'SGA', 'TOLAC', 'VBAC', 'C-section',
    'TVH', 'manual removal', 'postpartum hemorrhage', 'DIC', 'amniotic fluid embolism',
  ],
  PULM: [
    'ARDS', 'COPD', 'asthma', 'bronchiectasis', 'cystic fibrosis', 'CF', 'PFT',
    'FEV1', 'FVC', 'DLCO', 'V/Q', 'pulmonary hypertension', 'PAH', 'IPF',
    'UIP', 'AIP', 'PE', 'DVT', 'pneumothorax', 'hemothorax',
  ],
  GI: [
    'GERD', 'PUD', 'Barrett esophagus', 'achalasia', 'IBD', 'Crohn', 'UC',
    'IBS', 'celiac', 'CRC', 'FAP', 'Lynch', 'hepatitis', 'cirrhosis', 'HCC',
    'varices', 'portal hypertension', 'ascites', 'SBP', 'hepatic encephalopathy',
  ],
  HEME: [
    'CBC', 'RBC', 'WBC', 'Plt', 'Hgb', 'Hct', 'MCV', 'MCH', 'MCHC', 'RDW',
    'anemia', 'thrombocytopenia', 'leukocytosis', 'leukopenia', 'DIC',
    'TTP', 'HUS', 'ITP', 'AIHA', 'sickle cell', 'thalassemia', 'hemophilia',
    'vWF', 'G6PD', 'spherocytosis',
  ],
  NEURO: [
    'ICP', 'CSF', 'CT', 'MRI', 'LP', 'EEG', 'EMG', 'NCS', 'seizure', 'epilepsy',
    'status epilepticus', 'TIA', 'CVA', 'stroke', 'subdural', 'epidural',
    'subarachnoid', 'aneurysm', 'AVM', 'Alzheimer', 'Parkinson', 'MS',
    'ALS', 'Guillain-Barré', 'myasthenia', 'neuropathy',
  ],
  ENDO: [
    'DM', 'T1DM', 'T2DM', 'DKA', 'HHS', 'HbA1c', 'glucose', 'insulin',
    'metformin', 'thyroid', 'TSH', 'T3', 'T4', 'hypothyroid', 'hyperthyroid',
    'goiter', 'nodule', 'Graves', 'Hashimoto', 'thyroiditis', 'adrenal',
    'cortisol', 'ACTH', 'pituitary',
  ],
  RENAL: [
    'GFR', 'eGFR', 'creatinine', 'BUN', 'ACR', 'proteinuria', 'hematuria',
    'casts', 'AKI', 'CKD', 'ESRD', 'nephrotic', 'nephritic', 'GN', 'IgA',
    'FSGS', 'MPGN', 'membranous', 'lupus nephritis', 'diabetic nephropathy',
  ],
};

interface ContentRecord {
  id: string;
  condition: string;
  system: string;
  buzzwords: string[];
}

interface AuditFinding {
  type: 'orphan' | 'cross_contamination' | 'possible_acronym';
  severity: 'critical' | 'high' | 'medium' | 'low';
  contentId: string;
  condition: string;
  system: string;
  issue: string;
  buzzwords: string[];
}

async function auditBuzzwordIntegrity() {
  try {
    console.log('🔍 TASK 3: BUZZWORD INTEGRITY AUDIT\n');
    console.log('='.repeat(70));

    // Get all MedicalContent records
    console.log('\n📊 Fetching all MedicalContent records...');
    const allContent = await (prisma as any).medicalContent.findMany({
      select: {
        id: true,
        condition: true,
        system: true,
        buzzwords: true,
      },
    });

    console.log(`✅ Found ${allContent.length} content records\n`);

    // Build condition → buzzword map
    const conditionMap = new Map<string, ContentRecord>();
    allContent.forEach((content: ContentRecord) => {
      conditionMap.set(content.id, content);
    });

    // Audit for cross-contamination
    const findings: AuditFinding[] = [];
    const systemBuzzwordMap = new Map<string, Set<string>>();

    console.log('🔎 Analyzing buzzwords for cross-contamination...\n');

    for (const content of allContent) {
      const systemBuzzwords = systemBuzzwordMap.get(content.system) || new Set();

      // Check each buzzword
      for (const buzzword of content.buzzwords || []) {
        // Look for exact matches in other systems
        for (const otherContent of allContent) {
          if (otherContent.system === content.system) continue;

          const otherBuzzwords = otherContent.buzzwords || [];
          if (otherBuzzwords.includes(buzzword)) {
            findings.push({
              type: 'cross_contamination',
              severity: 'critical',
              contentId: content.id,
              condition: content.condition,
              system: content.system,
              issue: `Buzzword "${buzzword}" also appears in ${otherContent.system} system (${otherContent.condition})`,
              buzzwords: [buzzword],
            });
          }
        }

        // Collect buzzwords by system
        systemBuzzwords.add(buzzword);
      }

      systemBuzzwordMap.set(content.system, systemBuzzwords);
    }

    // Check for acronyms that might be misplaced
    console.log('🔎 Checking for misplaced acronyms...\n');

    for (const content of allContent) {
      const systemAcronyms = SYSTEM_ACRONYMS[content.system] || [];

      for (const buzzword of content.buzzwords || []) {
        // Extract acronyms from buzzword (look for ALL CAPS sequences)
        const acronymMatches = buzzword.match(/\b([A-Z]{2,})\b/g) || [];

        for (const acronym of acronymMatches) {
          // Check if this acronym belongs to a different system
          for (const [otherSystem, acronyms] of Object.entries(SYSTEM_ACRONYMS)) {
            if (otherSystem === content.system) continue;
            if (acronyms.includes(acronym)) {
              findings.push({
                type: 'possible_acronym',
                severity: 'medium',
                contentId: content.id,
                condition: content.condition,
                system: content.system,
                issue: `Acronym "${acronym}" in buzzword "${buzzword}" is typically associated with ${otherSystem} system`,
                buzzwords: [buzzword],
              });
            }
          }
        }
      }
    }

    // Report findings
    console.log('='.repeat(70));
    console.log('\n📋 AUDIT FINDINGS\n');

    if (findings.length === 0) {
      console.log('✅ No cross-contamination or anomalies detected!');
    } else {
      // Group by severity
      const bySeverity = new Map<string, AuditFinding[]>();
      findings.forEach((f) => {
        const list = bySeverity.get(f.severity) || [];
        list.push(f);
        bySeverity.set(f.severity, list);
      });

      for (const severity of ['critical', 'high', 'medium', 'low']) {
        const items = bySeverity.get(severity) || [];
        if (items.length === 0) continue;

        const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`\n${icon} ${severity.toUpperCase()} (${items.length} issues):\n`);

        for (const finding of items) {
          console.log(`  • ${finding.condition} (${finding.system})`);
          console.log(`    ID: ${finding.contentId}`);
          console.log(`    Issue: ${finding.issue}`);
          console.log('');
        }
      }
    }

    // Summary statistics
    console.log('='.repeat(70));
    console.log('\n📊 SUMMARY STATISTICS\n');
    console.log(`Total Content Records: ${allContent.length}`);
    console.log(`Total Cross-Contamination Issues: ${findings.filter((f) => f.type === 'cross_contamination').length}`);
    console.log(`Total Possible Acronym Misplacements: ${findings.filter((f) => f.type === 'possible_acronym').length}`);
    console.log(`Total Unique Issues: ${findings.length}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ AUDIT COMPLETE - See findings above');
  } finally {
    await disconnect();
  }
}

auditBuzzwordIntegrity().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
