/**
 * Medical Database Search Component
 * 
 * Provides UI for searching external medical databases and displaying results
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExternalMedicalDatabases } from '@/hooks/useExternalMedicalDatabases';
import { StandardButton } from '@/components/shared/StandardButton';
import { 
  Search, 
  Database, 
  ExternalLink, 
  FileText, 
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
  Filter,
  Download
} from 'lucide-react';

interface MedicalDatabaseSearchProps {
  initialQuery?: string;
  onClose?: () => void;
  onSelectResult?: (result: any) => void;
}

export const MedicalDatabaseSearch: React.FC<MedicalDatabaseSearchProps> = ({
  initialQuery = '',
  onClose,
  onSelectResult
}) => {
  const {
    isLoading,
    searchResults,
    error,
    databaseHealth,
    searchDatabases,
    searchPubMed,
    searchClinicalTrials,
    getRelatedArticles,
    checkDatabaseHealth,
    clearResults,
    formatResultsForDisplay,
    areDatabasesHealthy,
    getUnhealthyDatabases
  } = useExternalMedicalDatabases();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedDatabase, setSelectedDatabase] = useState<'pubmed' | 'clinicaltrials' | 'guidelines'>('pubmed');
  const [resultLimit, setResultLimit] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'results' | 'health'>('search');

  // Perform initial search if there's an initial query
  useEffect(() => {
    if (initialQuery.trim()) {
      handleSearch();
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      await searchDatabases({
        query: searchQuery,
        database: selectedDatabase,
        limit: resultLimit
      });
      setActiveTab('results');
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectResult = (result: any) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
  };

  const handleRefreshHealth = async () => {
    await checkDatabaseHealth();
  };

  const handleExportResults = () => {
    const formattedResults = formatResultsForDisplay();
    const blob = new Blob([JSON.stringify(formattedResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-search-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDatabaseIcon = (db: string) => {
    switch (db) {
      case 'pubmed': return <FileText className="w-4 h-4" />;
      case 'clinicaltrials': return <Database className="w-4 h-4" />;
      case 'guidelines': return <FileText className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getDatabaseName = (db: string) => {
    switch (db) {
      case 'pubmed': return 'PubMed';
      case 'clinicaltrials': return 'ClinicalTrials.gov';
      case 'guidelines': return 'Medical Guidelines';
      default: return db;
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unavailable': return <X className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="font-semibold text-[var(--color-text-primary)]">
                Medical Database Search
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Search PubMed, ClinicalTrials.gov, and medical guidelines
              </p>
            </div>
          </div>
          {onClose && (
            <StandardButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              icon={<X className="w-4 h-4" />}
            />
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {(['search', 'results', 'health'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm transition-colors relative capitalize ${
                activeTab === tab
                  ? 'text-blue-600'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search medical databases (e.g., 'hypertension treatment guidelines')"
                className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Search medical databases"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['pubmed', 'clinicaltrials', 'guidelines'] as const).map((db) => (
                <button
                  key={db}
                  onClick={() => setSelectedDatabase(db)}
                  className={`p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                    selectedDatabase === db
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                  }`}
                >
                  {getDatabaseIcon(db)}
                  <div className="text-left">
                    <div className="font-medium text-sm text-[var(--color-text-primary)]">
                      {getDatabaseName(db)}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {db === 'pubmed' && 'Medical literature'}
                      {db === 'clinicaltrials' && 'Clinical studies'}
                      {db === 'guidelines' && 'Treatment guidelines'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <Filter className="w-4 h-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <StandardButton
                variant="primary"
                onClick={handleSearch}
                disabled={isLoading || !searchQuery.trim()}
                icon={<Search className="w-4 h-4" />}
              >
                {isLoading ? 'Searching...' : 'Search'}
              </StandardButton>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                          Results Limit
                        </label>
                        <select
                          value={resultLimit}
                          onChange={(e) => setResultLimit(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          title="Number of results to display"
                          aria-label="Number of results to display"
                        >
                          <option value="5">5 results</option>
                          <option value="10">10 results</option>
                          <option value="20">20 results</option>
                          <option value="50">50 results</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)]">
                  Search Results
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {searchResults.length} results from {getDatabaseName(selectedDatabase)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StandardButton
                  variant="outline"
                  size="sm"
                  onClick={handleExportResults}
                  icon={<Download className="w-4 h-4" />}
                >
                  Export
                </StandardButton>
                <StandardButton
                  variant="ghost"
                  size="sm"
                  onClick={clearResults}
                >
                  Clear
                </StandardButton>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Search Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Searching {getDatabaseName(selectedDatabase)}...
                  </p>
                </div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">
                  No Results Found
                </h4>
                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                  Try a different search query or select another database
                </p>
                <StandardButton
                  variant="outline"
                  onClick={() => setActiveTab('search')}
                >
                  New Search
                </StandardButton>
              </div>
            ) : (
              <div className="space-y-3">
                {formatResultsForDisplay().map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-[var(--color-text-primary)] line-clamp-2">
                          {result.title}
                        </h4>
                        <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-600 rounded-full whitespace-nowrap">
                          {result.source}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{result.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span className="truncate">{result.authors}</span>
                        </div>
                      </div>

                      <p className="text-sm text-[var(--color-text-primary)] mb-3 line-clamp-3">
                        {result.abstract}
                      </p>

                      <div className="flex items-center justify-between">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Source
                        </a>
                        <StandardButton
                          variant="ghost"
                          size="xs"
                          onClick={() => handleSelectResult(result)}
                        >
                          Select
                        </StandardButton>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)]">
                  Database Health Status
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Real-time status of external medical databases
                </p>
              </div>
              <StandardButton
                variant="outline"
                size="sm"
                onClick={handleRefreshHealth}
                disabled={isLoading}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh
              </StandardButton>
            </div>

            <div className="space-y-3">
              {databaseHealth.map((db) => (
                <div
                  key={db.database}
                  className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getHealthStatusIcon(db.status)}
                      <div>
                        <h4 className="font-medium text-[var(--color-text-primary)]">
                          {getDatabaseName(db.database)}
                        </h4>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Last checked: {new Date(db.lastChecked).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      db.status === 'healthy' ? 'bg-green-500/20 text-green-600' :
                      db.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-600' :
                      'bg-red-500/20 text-red-600'
                    }`}>
                      {db.status.toUpperCase()}
                    </span>
                  </div>
                  
                  {db.responseTime && (
                    <div className="text-sm text-[var(--color-text-muted)]">
                      Response time: {db.responseTime}ms
                    </div>
                  )}
                  
                  {db.error && (
                    <div className="mt-2 text-sm text-red-600">
                      Error: {db.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={`p-4 rounded-lg border ${
              areDatabasesHealthy() 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {areDatabasesHealthy() ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {areDatabasesHealthy() ? 'All Systems Operational' : 'Some Systems Degraded'}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {areDatabasesHealthy() 
                  ? 'All external medical databases are responding normally.'
                  : `${getUnhealthyDatabases().length} database(s) are experiencing issues.`
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};