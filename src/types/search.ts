/**
 * Unified Search Types
 * Supports polymorphic search across Conditions, Drugs, Treatments, Tests, and Concepts
 */

export type SearchResultType =
  | 'condition'
  | 'drug'
  | 'treatment'
  | 'special_test'
  | 'physiology'
  | 'lab_test'
  | 'imaging'
  | 'surgery';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  displayName: string;
  subtitle?: string;
  category?: string;
  system?: string;
  score: number;
  matchedAlias?: string; // If search matched an alias, show it
  url?: string; // Link to detail page
}

export interface GroupedSearchResults {
  conditions: SearchResult[];
  pharmacology: SearchResult[];
  concepts: SearchResult[];
  procedures: SearchResult[];
  diagnostics: SearchResult[];
}

export interface SearchFilters {
  types?: SearchResultType[];
  system?: string;
  category?: string;
  minScore?: number;
}

export interface SearchOptions {
  filters?: SearchFilters;
  limit?: number;
  groupByType?: boolean;
  includeAliases?: boolean;
}
