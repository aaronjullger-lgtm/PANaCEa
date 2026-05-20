/**
 * React hook for integrating with external medical databases
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ExternalMedicalDatabaseService,
  MedicalDatabaseSearchParams,
  MedicalDatabaseResult,
  DatabaseHealthStatus,
  ClinicalTrialResult,
} from '@/services/externalMedicalDatabaseService';

interface UseExternalMedicalDatabasesOptions {
  autoCheckHealth?: boolean;
}

export function useExternalMedicalDatabases(options: UseExternalMedicalDatabasesOptions = {}) {
  const { autoCheckHealth = false } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MedicalDatabaseResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealthStatus[]>([]);
  const [selectedTrial, setSelectedTrial] = useState<ClinicalTrialResult | null>(null);

  const service = ExternalMedicalDatabaseService;

  /**
   * Search external medical databases
   */
  const searchDatabases = useCallback(
    async (params: MedicalDatabaseSearchParams) => {
      setIsLoading(true);
      setError(null);

      try {
        const instance = new service();
        const results = await instance.searchWithCache(params);
        setSearchResults(results);
        return results;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to search medical databases';
        setError(errorMessage);
        setSearchResults([]);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  /**
   * Search PubMed specifically
   */
  const searchPubMed = useCallback(
    async (query: string, limit: number = 10) => {
      return searchDatabases({
        query,
        database: 'pubmed',
        limit,
      });
    },
    [searchDatabases]
  );

  /**
   * Search ClinicalTrials.gov
   */
  const searchClinicalTrials = useCallback(
    async (query: string, limit: number = 10) => {
      return searchDatabases({
        query,
        database: 'clinicaltrials',
        limit,
      });
    },
    [searchDatabases]
  );

  /**
   * Get clinical trial details
   */
  const getClinicalTrialDetails = useCallback(
    async (trialId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const instance = new service();
        const trial = await instance.getClinicalTrialDetails(trialId);
        setSelectedTrial(trial);
        return trial;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get trial details';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  /**
   * Get related articles for a medical concept
   */
  const getRelatedArticles = useCallback(
    async (concept: string, maxResults: number = 5) => {
      setIsLoading(true);
      setError(null);

      try {
        const instance = new service();
        const results = await instance.getRelatedArticles(concept, maxResults);
        setSearchResults(results);
        return results;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get related articles';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  /**
   * Check database health status
   */
  const checkDatabaseHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const instance = new service();
      const health = await instance.checkDatabaseHealth();
      setDatabaseHealth(health);
      return health;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check database health';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setSearchResults([]);
    setError(null);
    setSelectedTrial(null);
  }, []);

  /**
   * Format results for display
   */
  const formatResultsForDisplay = useCallback(() => {
    const instance = new service();
    return instance.formatResultsForDisplay(searchResults);
  }, [searchResults, service]);

  /**
   * Check if databases are healthy
   */
  const areDatabasesHealthy = useCallback(() => {
    return databaseHealth.every((db) => db.status === 'healthy');
  }, [databaseHealth]);

  /**
   * Get unhealthy databases
   */
  const getUnhealthyDatabases = useCallback(() => {
    return databaseHealth.filter((db) => db.status !== 'healthy');
  }, [databaseHealth]);

  useEffect(() => {
    if (!autoCheckHealth) return;
    void checkDatabaseHealth();
  }, [autoCheckHealth, checkDatabaseHealth]);

  return {
    // State
    isLoading,
    searchResults,
    error,
    databaseHealth,
    selectedTrial,

    // Actions
    searchDatabases,
    searchPubMed,
    searchClinicalTrials,
    getClinicalTrialDetails,
    getRelatedArticles,
    checkDatabaseHealth,
    clearResults,
    formatResultsForDisplay,

    // Utilities
    areDatabasesHealthy,
    getUnhealthyDatabases,

    // Service instance (for advanced usage)
    service: new service(),
  };
}

export type UseExternalMedicalDatabasesReturn = ReturnType<typeof useExternalMedicalDatabases>;
