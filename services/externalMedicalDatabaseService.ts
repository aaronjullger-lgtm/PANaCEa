/**
 * External Medical Database Integration Service
 *
 * Provides integration with external medical databases and resources:
 * - PubMed/NCBI
 * - UpToDate (via API if available)
 * - ClinicalTrials.gov
 * - CDC/NIH resources
 * - Medical guidelines databases
 */

import { z } from 'zod';

export interface MedicalDatabaseSearchParams {
  query: string;
  database: 'pubmed' | 'clinicaltrials' | 'uptodate' | 'guidelines' | 'cdc' | 'nih';
  limit?: number;
  filters?: Record<string, any>;
}

export interface MedicalDatabaseResult {
  id: string;
  title: string;
  abstract?: string;
  authors?: string[];
  publicationDate?: string;
  source: string;
  url?: string;
  relevanceScore?: number;
  tags?: string[];
  citationCount?: number;
}

export interface ClinicalTrialResult {
  id: string;
  title: string;
  status: string;
  phase?: string;
  conditions: string[];
  interventions: string[];
  locations: string[];
  startDate?: string;
  completionDate?: string;
  url: string;
}

export interface GuidelineResult {
  id: string;
  title: string;
  organization: string;
  publicationDate: string;
  topic: string;
  recommendations: string[];
  strengthOfEvidence?: string;
  url: string;
}

export interface DatabaseHealthStatus {
  database: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

export class ExternalMedicalDatabaseService {
  private readonly baseUrls = {
    pubmed: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    clinicaltrials: 'https://clinicaltrials.gov/api/v2',
    uptodate: 'https://api.uptodate.com',
    guidelines: 'https://guidelines.gov/api',
    cdc: 'https://data.cdc.gov/api',
    nih: 'https://api.nih.gov',
  };

  private readonly apiKeys: Record<string, string> = {};

  constructor(apiKeys?: Record<string, string>) {
    if (apiKeys) {
      this.apiKeys = apiKeys;
    }
  }

  /**
   * Search across multiple medical databases
   */
  async searchMedicalDatabases(
    params: MedicalDatabaseSearchParams
  ): Promise<MedicalDatabaseResult[]> {
    switch (params.database) {
      case 'pubmed':
        return this.searchPubMed(params);
      case 'clinicaltrials':
        return this.searchClinicalTrials(params);
      case 'guidelines':
        return this.searchGuidelines(params);
      default:
        throw new Error(`Database ${params.database} not yet implemented`);
    }
  }

  /**
   * Search PubMed/NCBI database
   */
  private async searchPubMed(
    params: MedicalDatabaseSearchParams
  ): Promise<MedicalDatabaseResult[]> {
    try {
      const { query, limit = 10 } = params;
      const searchUrl = `${this.baseUrls.pubmed}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`PubMed API error: ${response.statusText}`);
      }

      const data = await response.json();
      const ids = data.esearchresult?.idlist || [];

      if (ids.length === 0) {
        return [];
      }

      // Fetch details for the IDs
      const detailsUrl = `${this.baseUrls.pubmed}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();

      const results: MedicalDatabaseResult[] = [];
      const articles = detailsData.result || {};

      for (const id of ids) {
        const article = articles[id];
        if (article) {
          results.push({
            id: article.uid,
            title: article.title || 'No title available',
            abstract: article.abstract || undefined,
            authors: article.authors?.map((a: any) => a.name) || [],
            publicationDate: article.pubdate,
            source: 'PubMed',
            url: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
            citationCount: article.pmcids ? parseInt(article.pmcids) : undefined,
            tags: article.attributes?.term || [],
          });
        }
      }

      return results;
    } catch (error) {
      console.error('PubMed search error:', error);
      return [];
    }
  }

  /**
   * Search ClinicalTrials.gov database
   */
  private async searchClinicalTrials(
    params: MedicalDatabaseSearchParams
  ): Promise<MedicalDatabaseResult[]> {
    try {
      const { query, limit = 10 } = params;
      const searchUrl = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=${limit}`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`ClinicalTrials API error: ${response.statusText}`);
      }

      const data = await response.json();
      const studies = data.studies || [];

      return studies.map((study: any) => ({
        id: study.protocolSection.identificationModule.nctId,
        title:
          study.protocolSection.identificationModule.briefTitle ||
          study.protocolSection.identificationModule.officialTitle,
        abstract: study.protocolSection.descriptionModule?.briefSummary,
        authors: study.protocolSection.identificationModule?.organization?.fullName
          ? [study.protocolSection.identificationModule.organization.fullName]
          : [],
        publicationDate: study.protocolSection.statusModule.startDate,
        source: 'ClinicalTrials.gov',
        url: `https://clinicaltrials.gov/study/${study.protocolSection.identificationModule.nctId}`,
        tags: study.protocolSection.conditionsModule?.conditions || [],
      }));
    } catch (error) {
      console.error('ClinicalTrials search error:', error);
      return [];
    }
  }

  /**
   * Search medical guidelines databases
   */
  private async searchGuidelines(
    params: MedicalDatabaseSearchParams
  ): Promise<MedicalDatabaseResult[]> {
    try {
      const { query, limit = 10 } = params;
      // Using a mock implementation since guidelines.gov API may require authentication
      // In production, this would connect to actual guidelines APIs

      const mockGuidelines: MedicalDatabaseResult[] = [
        {
          id: 'guideline-1',
          title: 'Hypertension Management Guidelines',
          abstract: 'Comprehensive guidelines for the management of hypertension in adults.',
          authors: ['American Heart Association', 'American College of Cardiology'],
          publicationDate: '2023-01-15',
          source: 'AHA/ACC Guidelines',
          url: 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065',
          tags: ['Cardiovascular', 'Hypertension', 'Guidelines'],
        },
        {
          id: 'guideline-2',
          title: 'Diabetes Mellitus Type 2 Management',
          abstract: 'Evidence-based guidelines for the management of type 2 diabetes.',
          authors: ['American Diabetes Association'],
          publicationDate: '2023-12-01',
          source: 'ADA Standards of Care',
          url: 'https://diabetesjournals.org/care/issue/46/Supplement_1',
          tags: ['Endocrine', 'Diabetes', 'Guidelines'],
        },
      ];

      // Filter mock data based on query
      return mockGuidelines
        .filter(
          (g) =>
            g.title.toLowerCase().includes(query.toLowerCase()) ||
            g.abstract?.toLowerCase().includes(query.toLowerCase()) ||
            g.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, limit);
    } catch (error) {
      console.error('Guidelines search error:', error);
      return [];
    }
  }

  /**
   * Get clinical trial details by ID
   */
  async getClinicalTrialDetails(trialId: string): Promise<ClinicalTrialResult | null> {
    try {
      const url = `https://clinicaltrials.gov/api/v2/studies/${trialId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`ClinicalTrial details error: ${response.statusText}`);
      }

      const data = await response.json();
      const study = data.study;

      return {
        id: study.protocolSection.identificationModule.nctId,
        title: study.protocolSection.identificationModule.officialTitle,
        status: study.protocolSection.statusModule.overallStatus,
        phase: study.protocolSection.designModule?.phases?.[0],
        conditions: study.protocolSection.conditionsModule?.conditions || [],
        interventions:
          study.protocolSection.armsInterventionsModule?.interventions?.map((i: any) => i.name) ||
          [],
        locations:
          study.protocolSection.contactsLocationsModule?.locations?.map((l: any) => l.facility) ||
          [],
        startDate: study.protocolSection.statusModule.startDate,
        completionDate: study.protocolSection.statusModule.completionDate,
        url: `https://clinicaltrials.gov/study/${study.protocolSection.identificationModule.nctId}`,
      };
    } catch (error) {
      console.error('Clinical trial details error:', error);
      return null;
    }
  }

  /**
   * Get related articles for a medical concept
   */
  async getRelatedArticles(
    concept: string,
    maxResults: number = 5
  ): Promise<MedicalDatabaseResult[]> {
    return this.searchPubMed({
      query: concept,
      database: 'pubmed',
      limit: maxResults,
    });
  }

  /**
   * Check health status of all external databases
   */
  async checkDatabaseHealth(): Promise<DatabaseHealthStatus[]> {
    const databases = ['pubmed', 'clinicaltrials'] as const;
    const statuses: DatabaseHealthStatus[] = [];

    for (const db of databases) {
      try {
        const startTime = Date.now();

        // Simple health check - try a basic search
        switch (db) {
          case 'pubmed':
            await fetch(
              `${this.baseUrls.pubmed}/esearch.fcgi?db=pubmed&term=test&retmax=1&retmode=json`
            );
            break;
          case 'clinicaltrials':
            await fetch('https://clinicaltrials.gov/api/v2/studies?query.term=test&pageSize=1');
            break;
        }

        const responseTime = Date.now() - startTime;

        statuses.push({
          database: db,
          status: 'healthy',
          responseTime,
          lastChecked: new Date().toISOString(),
        });
      } catch (error) {
        statuses.push({
          database: db,
          status: 'unavailable',
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return statuses;
  }

  /**
   * Cache search results for performance
   */
  private cacheResults(key: string, results: MedicalDatabaseResult[], ttl: number = 3600000): void {
    try {
      const cacheItem = {
        results,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`medical-db-cache-${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Failed to cache results:', error);
    }
  }

  /**
   * Get cached results if available and not expired
   */
  private getCachedResults(key: string): MedicalDatabaseResult[] | null {
    try {
      const cached = localStorage.getItem(`medical-db-cache-${key}`);
      if (!cached) return null;

      const cacheItem = JSON.parse(cached);
      const now = Date.now();

      if (now - cacheItem.timestamp > cacheItem.ttl) {
        localStorage.removeItem(`medical-db-cache-${key}`);
        return null;
      }

      return cacheItem.results;
    } catch (error) {
      console.warn('Failed to read cache:', error);
      return null;
    }
  }

  /**
   * Search with caching
   */
  async searchWithCache(params: MedicalDatabaseSearchParams): Promise<MedicalDatabaseResult[]> {
    const cacheKey = `${params.database}-${params.query}-${params.limit}`;

    // Try to get cached results
    const cached = this.getCachedResults(cacheKey);
    if (cached) {
      return cached;
    }

    // Perform fresh search
    const results = await this.searchMedicalDatabases(params);

    // Cache the results
    this.cacheResults(cacheKey, results);

    return results;
  }

  /**
   * Format search results for display
   */
  formatResultsForDisplay(results: MedicalDatabaseResult[]): Array<{
    id: string;
    title: string;
    source: string;
    date: string;
    authors: string;
    abstract: string;
    url: string;
  }> {
    return results.map((result) => ({
      id: result.id,
      title: result.title,
      source: result.source,
      date: result.publicationDate || 'Unknown date',
      authors: result.authors?.join(', ') || 'Unknown authors',
      abstract: result.abstract || 'No abstract available',
      url: result.url || '#',
    }));
  }
}

// Singleton instance
let instance: ExternalMedicalDatabaseService | null = null;

export function getExternalMedicalDatabaseService(): ExternalMedicalDatabaseService {
  if (!instance) {
    // In production, API keys would come from environment variables
    const apiKeys = {
      // uptodate: process.env.UPTODATE_API_KEY,
      // guidelines: process.env.GUIDELINES_API_KEY
    };

    instance = new ExternalMedicalDatabaseService(apiKeys);
  }
  return instance;
}
