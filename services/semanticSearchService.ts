/**
 * Semantic Search Service
 * Allows students to search concepts, not just keywords
 * Phase 17: Requirement 67
 */

import type { Question } from '../types';

interface SearchResult {
  question: Question;
  relevanceScore: number;
  matchedConcepts: string[];
}

interface ConceptMapping {
  concept: string;
  synonyms: string[];
  relatedConditions: string[];
  keywords: string[];
}

// Medical concept mappings for semantic search
const CONCEPT_MAPPINGS: ConceptMapping[] = [
  {
    concept: 'Chest Pain',
    synonyms: ['chest discomfort', 'thoracic pain', 'chest tightness', 'angina'],
    relatedConditions: ['MI', 'Pericarditis', 'PE', 'GERD', 'Costochondritis', 'Pneumothorax'],
    keywords: ['pain', 'pressure', 'substernal', 'radiating', 'crushing'],
  },
  {
    concept: 'Shortness of Breath',
    synonyms: ['dyspnea', 'breathlessness', 'difficulty breathing', 'SOB'],
    relatedConditions: ['CHF', 'Asthma', 'COPD', 'PE', 'Pneumonia', 'Pneumothorax'],
    keywords: ['respiratory', 'breathing', 'air', 'oxygen', 'hypoxia'],
  },
  {
    concept: 'Pericarditis',
    synonyms: ['pericardial inflammation'],
    relatedConditions: ['pericardial effusion', 'cardiac tamponade', 'viral pericarditis'],
    keywords: ['chest pain', 'friction rub', 'ST elevation', 'sitting forward', 'pleuritic'],
  },
  {
    concept: 'Pulmonary Embolism',
    synonyms: ['PE', 'blood clot in lung', 'pulmonary thromboembolism'],
    relatedConditions: ['DVT', 'VTE', 'right heart strain'],
    keywords: [
      'chest pain',
      'shortness of breath',
      'hypoxia',
      'tachycardia',
      'hemoptysis',
      'Wells score',
    ],
  },
  {
    concept: 'Myocardial Infarction',
    synonyms: ['MI', 'heart attack', 'STEMI', 'NSTEMI', 'acute coronary syndrome', 'ACS'],
    relatedConditions: ['unstable angina', 'coronary artery disease', 'atherosclerosis'],
    keywords: [
      'chest pain',
      'troponin',
      'ECG changes',
      'ST elevation',
      'crushing pain',
      'jaw pain',
    ],
  },
  {
    concept: 'Congestive Heart Failure',
    synonyms: ['CHF', 'heart failure', 'cardiac failure', 'HFrEF', 'HFpEF'],
    relatedConditions: ['cardiomyopathy', 'pulmonary edema'],
    keywords: ['shortness of breath', 'dyspnea', 'edema', 'JVD', 'orthopnea', 'PND', 'BNP'],
  },
];

/**
 * Perform semantic search on questions
 */
export function semanticSearch(
  query: string,
  questions: Question[],
  minRelevanceScore: number = 0.3
): SearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  // Extract concepts from query
  const queryConcepts = extractConcepts(normalizedQuery);

  questions.forEach((question) => {
    const relevance = calculateRelevance(normalizedQuery, queryConcepts, question);

    if (relevance.score >= minRelevanceScore) {
      results.push({
        question,
        relevanceScore: relevance.score,
        matchedConcepts: relevance.matchedConcepts,
      });
    }
  });

  // Sort by relevance score
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Extract medical concepts from search query
 */
function extractConcepts(query: string): ConceptMapping[] {
  const matchedConcepts: ConceptMapping[] = [];

  CONCEPT_MAPPINGS.forEach((mapping) => {
    // Check if query contains concept or synonyms
    const conceptMatches =
      query.includes(mapping.concept.toLowerCase()) ||
      mapping.synonyms.some((syn) => query.includes(syn.toLowerCase())) ||
      mapping.keywords.some((kw) => query.includes(kw.toLowerCase()));

    if (conceptMatches) {
      matchedConcepts.push(mapping);
    }
  });

  return matchedConcepts;
}

/**
 * Calculate relevance score between query and question
 */
function calculateRelevance(
  query: string,
  queryConcepts: ConceptMapping[],
  question: Question
): { score: number; matchedConcepts: string[] } {
  let score = 0;
  const matchedConcepts: string[] = [];
  const questionText =
    `${question.question} ${question.condition} ${question.rationale}`.toLowerCase();

  // Direct text match (baseline)
  const queryWords = query.split(/\s+/);
  const matchedWords = queryWords.filter((word) => word.length > 3 && questionText.includes(word));
  score += (matchedWords.length / queryWords.length) * 0.3;

  // Concept-based matching
  queryConcepts.forEach((concept) => {
    // Check if question relates to this concept
    const conceptScore = calculateConceptScore(concept, question);

    if (conceptScore > 0) {
      score += conceptScore;
      matchedConcepts.push(concept.concept);
    }
  });

  return {
    score: Math.min(score, 1.0), // Cap at 1.0
    matchedConcepts,
  };
}

/**
 * Calculate how well a concept matches a question
 */
function calculateConceptScore(concept: ConceptMapping, question: Question): number {
  let score = 0;
  const questionText =
    `${question.question} ${question.condition} ${question.rationale}`.toLowerCase();

  // Check for related conditions
  concept.relatedConditions.forEach((condition) => {
    if (questionText.includes(condition.toLowerCase())) {
      score += 0.3;
    }
  });

  // Check for concept keywords
  concept.keywords.forEach((keyword) => {
    if (questionText.includes(keyword.toLowerCase())) {
      score += 0.1;
    }
  });

  // Exact condition match
  if (
    question.condition.toLowerCase() === concept.concept.toLowerCase() ||
    concept.relatedConditions.some((c) => c.toLowerCase() === question.condition.toLowerCase())
  ) {
    score += 0.4;
  }

  return score;
}

/**
 * Get related concepts for a given query
 */
export function getRelatedConcepts(query: string): string[] {
  const normalizedQuery = query.toLowerCase();
  const related = new Set<string>();

  CONCEPT_MAPPINGS.forEach((mapping) => {
    // If query matches this concept
    const matches =
      normalizedQuery.includes(mapping.concept.toLowerCase()) ||
      mapping.synonyms.some((syn) => normalizedQuery.includes(syn.toLowerCase()));

    if (matches) {
      // Add related conditions
      mapping.relatedConditions.forEach((condition) => related.add(condition));
    }
  });

  return Array.from(related);
}

/**
 * Expand search query with medical synonyms
 */
export function expandQuery(query: string): string[] {
  const normalizedQuery = query.toLowerCase();
  const expandedTerms = new Set<string>([query]);

  CONCEPT_MAPPINGS.forEach((mapping) => {
    if (normalizedQuery.includes(mapping.concept.toLowerCase())) {
      mapping.synonyms.forEach((syn) => expandedTerms.add(syn));
      mapping.keywords.forEach((kw) => expandedTerms.add(kw));
    }
  });

  return Array.from(expandedTerms);
}

/**
 * Suggest search corrections for typos or alternative terms
 */
export function suggestSearchTerms(query: string): string[] {
  const normalizedQuery = query.toLowerCase();
  const suggestions: string[] = [];

  CONCEPT_MAPPINGS.forEach((mapping) => {
    // Simple fuzzy matching - check if query is similar to concept
    const similarity = calculateStringSimilarity(normalizedQuery, mapping.concept.toLowerCase());

    if (similarity > 0.6) {
      suggestions.push(mapping.concept);
      suggestions.push(...mapping.synonyms.slice(0, 2));
    }
  });

  return suggestions.slice(0, 5); // Return top 5 suggestions
}

/**
 * Calculate string similarity (simple Levenshtein-like approach)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = calculateEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance between two strings
 */
function calculateEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Get example semantic searches
 */
export function getExampleSearches(): string[] {
  return [
    'My chest hurts when I breathe',
    'Patient has crushing chest pain',
    'Shortness of breath with leg swelling',
    'Sharp chest pain worse when lying flat',
    'Sudden onset breathlessness with cough',
  ];
}
