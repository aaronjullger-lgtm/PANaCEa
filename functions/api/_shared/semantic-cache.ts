interface CacheQuery {
  queryText: string;
  questionType: string;
  system?: string;
  difficulty?: string;
}

interface CacheMatch {
  question: any;
  similarity: number;
  cacheId: string;
}

const SIMILARITY_THRESHOLD = 0.85;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function calculateSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function normalizeMedicalTerms(text: string): string {
  const normalizations: Record<string, string> = {
    pericarditis: 'pericarditis',
    'acute pericarditis': 'pericarditis',
    'pericardial inflammation': 'pericarditis',
    'myocardial infarction': 'mi',
    'heart attack': 'mi',
    mi: 'mi',
    stemi: 'mi',
    nstemi: 'mi',
    'diabetes mellitus': 'diabetes',
    diabetes: 'diabetes',
    'type 2 diabetes': 'diabetes',
    t2dm: 'diabetes',
    'congestive heart failure': 'chf',
    'heart failure': 'chf',
    chf: 'chf',
    copd: 'copd',
    'chronic obstructive pulmonary disease': 'copd',
    pneumonia: 'pneumonia',
    'community acquired pneumonia': 'pneumonia',
    cap: 'pneumonia',
  };

  let normalized = text.toLowerCase();

  for (const [variant, canonical] of Object.entries(normalizations)) {
    const regex = new RegExp(`\\b${variant}\\b`, 'gi');
    normalized = normalized.replace(regex, canonical);
  }

  return normalized;
}

export async function findSimilarCachedQuestion(
  prisma: any,
  query: CacheQuery
): Promise<CacheMatch | null> {
  try {
    const normalizedQuery = normalizeMedicalTerms(query.queryText);
    const queryTokens = tokenize(normalizedQuery);

    const cacheEntries = await prisma.semanticCache.findMany({
      where: {
        questionType: query.questionType,
        ...(query.system && { system: query.system }),
        ...(query.difficulty && { difficulty: query.difficulty }),
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
      take: 50,
    });

    let bestMatch: CacheMatch | null = null;
    let highestSimilarity = 0;

    for (const entry of cacheEntries) {
      const normalizedCache = normalizeMedicalTerms(entry.queryText);
      const cacheTokens = tokenize(normalizedCache);

      const similarity = calculateSimilarity(queryTokens, cacheTokens);

      if (similarity > highestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
        highestSimilarity = similarity;
        bestMatch = {
          question: entry.cachedQuestion,
          similarity,
          cacheId: entry.id,
        };
      }
    }

    if (bestMatch) {
      await prisma.semanticCache.update({
        where: { id: bestMatch.cacheId },
        data: {
          lastUsedAt: new Date(),
          useCount: { increment: 1 },
        },
      });
    }

    return bestMatch;
  } catch (error) {
    console.error('Error finding cached question:', error);
    return null;
  }
}

export async function cacheGeneratedQuestion(
  prisma: any,
  query: CacheQuery,
  question: any
): Promise<void> {
  try {
    await prisma.semanticCache.create({
      data: {
        queryText: query.queryText,
        questionType: query.questionType,
        system: query.system,
        difficulty: query.difficulty,
        cachedQuestion: question,
        lastUsedAt: new Date(),
        useCount: 1,
      },
    });
  } catch (error) {
    console.error('Error caching question:', error);
  }
}
