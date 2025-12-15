/**
 * DDx Comparison Table Builder
 * 
 * Generates dynamically-updated differential diagnosis comparison tables
 * for commonly confused condition pairs. Uses structured condition JSON
 * to extract and compare key clinical features.
 */

import type { DDxComparison } from './services/confusionService';

// ============================================================================
// Types
// ============================================================================

interface ConditionData {
  name: string;
  buzzwords?: string[];
  clinicalPresentation?: string;
  diagnosticFindings?: string;
  treatment?: string;
  etiology?: string;
  riskFactors?: string;
  differentialDiagnosis?: string;
  [key: string]: string | string[] | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract bullet points from a text section
 */
function extractBulletPoints(text: string | undefined): string[] {
  if (!text) return [];
  
  const lines = text.split('\n');
  const bullets: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines starting with -, *, •, or numbered lists
    if (/^[-*•]\s*/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*•]\s*/, '').trim());
    } else if (/^\d+[.)]\s*/.test(trimmed)) {
      bullets.push(trimmed.replace(/^\d+[.)]\s*/, '').trim());
    } else if (trimmed.length > 10 && trimmed.length < 150) {
      // Short sentences that might be key points
      bullets.push(trimmed);
    }
  }
  
  return bullets.slice(0, 10); // Limit to 10 points
}

/**
 * Find similarities between two arrays of strings
 */
function findSimilarities(listA: string[], listB: string[]): string[] {
  const similarities: string[] = [];
  const lowerB = listB.map(s => s.toLowerCase());
  
  for (const itemA of listA) {
    const lowerA = itemA.toLowerCase();
    
    // Check for exact or partial matches
    for (const itemB of lowerB) {
      // Check for significant word overlap
      const wordsA = new Set(lowerA.split(/\s+/).filter(w => w.length > 3));
      const wordsB = new Set(itemB.split(/\s+/).filter(w => w.length > 3));
      
      let overlap = 0;
      for (const word of wordsA) {
        if (wordsB.has(word)) overlap++;
      }
      
      if (overlap >= 2 || (wordsA.size <= 3 && overlap >= 1)) {
        similarities.push(itemA);
        break;
      }
    }
  }
  
  return [...new Set(similarities)].slice(0, 5);
}

/**
 * Find differences between two lists (items in A but not similar to B)
 */
function findDifferences(listA: string[], listB: string[]): string[] {
  const differences: string[] = [];
  const lowerB = listB.map(s => s.toLowerCase());
  
  for (const itemA of listA) {
    const lowerA = itemA.toLowerCase();
    let isSimilar = false;
    
    for (const itemB of lowerB) {
      const wordsA = new Set(lowerA.split(/\s+/).filter(w => w.length > 3));
      const wordsB = new Set(itemB.split(/\s+/).filter(w => w.length > 3));
      
      let overlap = 0;
      for (const word of wordsA) {
        if (wordsB.has(word)) overlap++;
      }
      
      if (overlap >= 2) {
        isSimilar = true;
        break;
      }
    }
    
    if (!isSimilar) {
      differences.push(itemA);
    }
  }
  
  return differences.slice(0, 5);
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate a DDx comparison table from two condition JSON objects
 * 
 * @param conditionAJson - First condition's structured data
 * @param conditionBJson - Second condition's structured data
 * @returns DDxComparison object with similarities and differences
 */
export function generateDDxTable(
  conditionAJson: ConditionData,
  conditionBJson: ConditionData
): DDxComparison {
  const conditionA = conditionAJson.name || 'Condition A';
  const conditionB = conditionBJson.name || 'Condition B';
  
  // Extract buzzwords
  const buzzwordsA = conditionAJson.buzzwords || [];
  const buzzwordsB = conditionBJson.buzzwords || [];
  
  // Extract clinical presentation points
  const presentationA = extractBulletPoints(conditionAJson.clinicalPresentation);
  const presentationB = extractBulletPoints(conditionBJson.clinicalPresentation);
  
  // Extract diagnostic findings
  const diagnosticA = extractBulletPoints(conditionAJson.diagnosticFindings);
  const diagnosticB = extractBulletPoints(conditionBJson.diagnosticFindings);
  
  // Extract treatments
  const treatmentA = extractBulletPoints(conditionAJson.treatment);
  const treatmentB = extractBulletPoints(conditionBJson.treatment);
  
  // Find similarities in presentation
  const allFeaturesA = [...presentationA, ...diagnosticA];
  const allFeaturesB = [...presentationB, ...diagnosticB];
  const similarities = findSimilarities(allFeaturesA, allFeaturesB);
  
  // Find distinguishing differences
  const diffA = findDifferences(allFeaturesA, allFeaturesB);
  const diffB = findDifferences(allFeaturesB, allFeaturesA);
  
  // Find distinguishing buzzwords
  const uniqueBuzzwordsA = buzzwordsA.filter(
    bw => !buzzwordsB.some(b => b.toLowerCase() === bw.toLowerCase())
  );
  const uniqueBuzzwordsB = buzzwordsB.filter(
    bw => !buzzwordsA.some(a => a.toLowerCase() === bw.toLowerCase())
  );
  
  // Find distinguishing diagnostics
  const uniqueDiagA = findDifferences(diagnosticA, diagnosticB);
  const uniqueDiagB = findDifferences(diagnosticB, diagnosticA);
  
  // Find distinguishing treatments
  const uniqueTreatmentA = findDifferences(treatmentA, treatmentB);
  const uniqueTreatmentB = findDifferences(treatmentB, treatmentA);
  
  return {
    conditionA,
    conditionB,
    similarities: similarities.length > 0 ? similarities : ['Data pending - check condition details'],
    differences: {
      A: diffA.length > 0 ? diffA : ['Review condition profile for distinguishing features'],
      B: diffB.length > 0 ? diffB : ['Review condition profile for distinguishing features'],
    },
    buzzwords: {
      A: uniqueBuzzwordsA.length > 0 ? uniqueBuzzwordsA : ['See condition buzzwords'],
      B: uniqueBuzzwordsB.length > 0 ? uniqueBuzzwordsB : ['See condition buzzwords'],
    },
    diagnostic: {
      A: uniqueDiagA.length > 0 ? uniqueDiagA : ['Refer to diagnostic workup'],
      B: uniqueDiagB.length > 0 ? uniqueDiagB : ['Refer to diagnostic workup'],
    },
    treatments: {
      A: uniqueTreatmentA.length > 0 ? uniqueTreatmentA : ['See treatment guidelines'],
      B: uniqueTreatmentB.length > 0 ? uniqueTreatmentB : ['See treatment guidelines'],
    },
  };
}

/**
 * Generate a comparison table for well-known confused pairs
 * Uses hardcoded high-yield comparisons for common PANCE topics
 */
export function getPrebuiltComparison(
  conditionA: string,
  conditionB: string
): DDxComparison | null {
  // Normalize names for lookup
  const keyA = conditionA.toLowerCase().replace(/\s+/g, '_');
  const keyB = conditionB.toLowerCase().replace(/\s+/g, '_');
  const pairKey = [keyA, keyB].sort().join('|');
  
  // Pre-built comparisons for high-yield confused pairs
  const prebuiltComparisons: Record<string, DDxComparison> = {
    'appendicitis|diverticulitis': {
      conditionA: 'Appendicitis',
      conditionB: 'Diverticulitis',
      similarities: [
        'Abdominal pain',
        'Fever',
        'Elevated WBC',
        'Nausea/vomiting',
        'CT abdomen for diagnosis',
      ],
      differences: {
        A: [
          'RLQ pain (McBurney point)',
          'Pain migrates from periumbilical to RLQ',
          'Younger patients (teens to 30s)',
          'Rovsing sign, Psoas sign, Obturator sign',
        ],
        B: [
          'LLQ pain',
          'Older patients (>50 years)',
          'History of diverticulosis',
          'May have rectal bleeding',
        ],
      },
      buzzwords: {
        A: ['McBurney point', 'Migration of pain', 'Anorexia'],
        B: ['Left lower quadrant', 'Sigmoid colon', 'Diverticulosis history'],
      },
      diagnostic: {
        A: ['CT: inflamed appendix, periappendiceal fat stranding', 'Target sign on US'],
        B: ['CT: pericolic fat stranding, diverticula', 'Colonic wall thickening'],
      },
      treatments: {
        A: ['Appendectomy (urgent surgical intervention)', 'IV antibiotics'],
        B: ['Uncomplicated: oral antibiotics, bowel rest', 'Complicated: IV antibiotics, possible surgery'],
      },
    },
    'crohn_disease|ulcerative_colitis': {
      conditionA: 'Crohn Disease',
      conditionB: 'Ulcerative Colitis',
      similarities: [
        'Inflammatory bowel disease',
        'Chronic diarrhea',
        'Abdominal pain',
        'Weight loss',
        'Extraintestinal manifestations',
      ],
      differences: {
        A: [
          'Skip lesions (patchy involvement)',
          'Transmural inflammation',
          'Any part of GI tract (mouth to anus)',
          'Fistulas and strictures common',
          'Cobblestone mucosa',
        ],
        B: [
          'Continuous involvement from rectum',
          'Mucosal/submucosal only',
          'Limited to colon',
          'Bloody diarrhea more prominent',
          'Lead pipe colon',
        ],
      },
      buzzwords: {
        A: ['Skip lesions', 'String sign', 'Cobblestone', 'Fistula', 'Terminal ileum'],
        B: ['Lead pipe colon', 'Pseudopolyps', 'Bloody diarrhea', 'Continuous', 'Rectal involvement'],
      },
      diagnostic: {
        A: ['Non-caseating granulomas on biopsy', 'String sign on imaging'],
        B: ['Crypt abscesses on biopsy', 'Loss of haustra'],
      },
      treatments: {
        A: ['5-ASA, steroids, immunomodulators', 'Surgery does NOT cure'],
        B: ['5-ASA (mesalamine)', 'Colectomy is curative'],
      },
    },
    'hyperthyroidism|hypothyroidism': {
      conditionA: 'Hyperthyroidism',
      conditionB: 'Hypothyroidism',
      similarities: [
        'Thyroid dysfunction',
        'May have goiter',
        'Affects metabolism',
        'TSH abnormality',
      ],
      differences: {
        A: [
          'Weight loss despite increased appetite',
          'Heat intolerance',
          'Tachycardia, palpitations',
          'Tremor, anxiety, insomnia',
          'Hyperactive reflexes',
        ],
        B: [
          'Weight gain',
          'Cold intolerance',
          'Bradycardia',
          'Fatigue, depression',
          'Delayed relaxation of reflexes',
        ],
      },
      buzzwords: {
        A: ['Exophthalmos', 'Pretibial myxedema', 'Thyroid bruit', 'Lid lag'],
        B: ['Myxedema', 'Periorbital edema', 'Coarse hair', 'Delayed reflexes'],
      },
      diagnostic: {
        A: ['Low TSH, High T4/T3', 'Increased radioiodine uptake (Graves)'],
        B: ['High TSH, Low T4', 'Anti-TPO antibodies (Hashimoto)'],
      },
      treatments: {
        A: ['Methimazole/PTU', 'Radioiodine ablation', 'Beta-blockers for symptoms'],
        B: ['Levothyroxine replacement'],
      },
    },
  };
  
  return prebuiltComparisons[pairKey] || null;
}

/**
 * Format comparison table for display
 */
export function formatComparisonForDisplay(comparison: DDxComparison): string {
  const lines: string[] = [];
  
  lines.push(`## ${comparison.conditionA} vs ${comparison.conditionB}`);
  lines.push('');
  
  lines.push('### Shared Features');
  for (const item of comparison.similarities) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  
  lines.push('### Key Differences');
  lines.push(`**${comparison.conditionA}:**`);
  for (const item of comparison.differences.A) {
    lines.push(`- ${item}`);
  }
  lines.push(`**${comparison.conditionB}:**`);
  for (const item of comparison.differences.B) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  
  lines.push('### Buzzwords');
  lines.push(`**${comparison.conditionA}:** ${comparison.buzzwords.A.join(', ')}`);
  lines.push(`**${comparison.conditionB}:** ${comparison.buzzwords.B.join(', ')}`);
  
  return lines.join('\n');
}
