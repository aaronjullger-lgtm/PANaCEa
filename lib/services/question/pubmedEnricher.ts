/**
 * PubMed Enricher Service
 *
 * Queries PubMed's E-Utilities API for clinical evidence citations.
 * Used by both the local dev generation service and Edge question generator
 * to ground explanations with real peer-reviewed references.
 *
 * API docs: https://www.ncbi.nlm.nih.gov/books/NBK25500/
 *
 * @see lib/services/question/generationService.ts
 * @see functions/api/_shared/question-generator.ts
 */

import { logger } from '../../logger';

const LOG_SCOPE = 'PubMed';

export interface PubMedCitation {
  pmid: string;
  title: string;
  authors: string; // "Smith J et al."
  journal: string;
  year: number;
  url: string;
}

const PUBMED_ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

/** Max citations to return per enrichment call */
const MAX_CITATIONS = 3;

/** Only return articles from the last N years for treatment/management topics */
const RECENCY_YEARS = 5;

/**
 * Build a PubMed search query optimized for clinical relevance.
 * Targets reviews and meta-analyses for a given condition.
 */
function buildSearchQuery(condition: string, topic?: string): string {
  const conditionClean = condition.replace(/['"]/g, '');
  const topicFilter = topic ? ` AND (${topic})` : '';
  const typeFilter = '(review[pt] OR meta-analysis[pt] OR guideline[pt] OR practice guideline[pt])';

  return `"${conditionClean}" AND (diagnosis OR treatment OR management)${topicFilter} AND ${typeFilter}`;
}

/**
 * Search PubMed and return structured citations for a condition.
 *
 * Uses NCBI E-Utilities (no API key required for <3 req/sec).
 * If an API key is provided via `ncbiApiKey`, rate limits are relaxed to 10 req/sec.
 */
export async function enrichWithPubMed(
  condition: string,
  options?: {
    topic?: string;
    ncbiApiKey?: string;
    maxResults?: number;
  }
): Promise<PubMedCitation[]> {
  const { topic, ncbiApiKey, maxResults = MAX_CITATIONS } = options ?? {};

  try {
    // Step 1: Search for relevant PMIDs
    const query = buildSearchQuery(condition, topic);
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - RECENCY_YEARS);
    const minDateStr = `${minDate.getFullYear()}/${String(minDate.getMonth() + 1).padStart(2, '0')}/${String(minDate.getDate()).padStart(2, '0')}`;

    const searchParams = new URLSearchParams({
      db: 'pubmed',
      term: query,
      retmax: String(maxResults),
      sort: 'relevance',
      retmode: 'json',
      mindate: minDateStr,
      datetype: 'pdat',
    });
    if (ncbiApiKey) searchParams.set('api_key', ncbiApiKey);

    const searchRes = await fetch(`${PUBMED_ESEARCH}?${searchParams}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!searchRes.ok) {
      logger.warn(LOG_SCOPE, `Search failed: ${searchRes.status}`);
      return [];
    }

    const searchData = (await searchRes.json()) as {
      esearchresult?: { idlist?: string[] };
    };
    const pmids = searchData.esearchresult?.idlist ?? [];

    if (pmids.length === 0) {
      // Retry with broader query (drop type filter) for rare conditions
      const broadParams = new URLSearchParams({
        db: 'pubmed',
        term: `"${condition.replace(/['"]/g, '')}" AND (diagnosis OR treatment)`,
        retmax: String(maxResults),
        sort: 'relevance',
        retmode: 'json',
      });
      if (ncbiApiKey) broadParams.set('api_key', ncbiApiKey);

      const broadRes = await fetch(`${PUBMED_ESEARCH}?${broadParams}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (broadRes.ok) {
        const broadData = (await broadRes.json()) as {
          esearchresult?: { idlist?: string[] };
        };
        const broadPmids = broadData.esearchresult?.idlist ?? [];
        if (broadPmids.length === 0) return [];
        pmids.push(...broadPmids.slice(0, maxResults));
      } else {
        return [];
      }
    }

    // Step 2: Fetch article summaries
    const summaryParams = new URLSearchParams({
      db: 'pubmed',
      id: pmids.join(','),
      retmode: 'json',
    });
    if (ncbiApiKey) summaryParams.set('api_key', ncbiApiKey);

    const summaryRes = await fetch(`${PUBMED_ESUMMARY}?${summaryParams}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!summaryRes.ok) {
      logger.warn(LOG_SCOPE, `Summary fetch failed: ${summaryRes.status}`);
      return [];
    }

    const summaryData = (await summaryRes.json()) as {
      result?: Record<string, any>;
    };

    const result = summaryData.result;
    if (!result) return [];

    // Step 3: Format citations
    const citations: PubMedCitation[] = [];

    for (const pmid of pmids) {
      const article = result[pmid];
      if (!article || !article.title) continue;

      const authors = article.authors as Array<{ name: string }> | undefined;
      let authorStr = 'Unknown';
      if (authors && authors.length > 0) {
        authorStr = authors.length > 2
          ? `${authors[0].name} et al.`
          : authors.map((a: { name: string }) => a.name).join(', ');
      }

      // Parse year from pubdate or sortpubdate
      const pubdate: string = article.pubdate || article.sortpubdate || '';
      const yearMatch = pubdate.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

      // Journal abbreviation
      const journal: string = article.source || article.fulljournalname || 'Unknown Journal';

      citations.push({
        pmid,
        title: (article.title as string).replace(/<[^>]*>/g, ''), // Strip HTML tags
        authors: authorStr,
        journal,
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    }

    return citations.slice(0, maxResults);
  } catch (err) {
    // Non-fatal — questions generate without PubMed if this fails
    logger.warn(LOG_SCOPE, 'Enrichment failed', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Format citations as a text block for injection into Gemini prompts.
 */
export function formatCitationsForPrompt(citations: PubMedCitation[]): string {
  if (citations.length === 0) return '';

  const citationLines = citations.map(
    (c, i) => `[${i + 1}] ${c.authors} (${c.year}). "${c.title}" ${c.journal}. PMID: ${c.pmid}`
  );

  return `\nCURRENT PEER-REVIEWED EVIDENCE:\n${citationLines.join('\n')}\n\nGround your rationale in these references where relevant. Include at least one PMID citation in your explanation.`;
}
