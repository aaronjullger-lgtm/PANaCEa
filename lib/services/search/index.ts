/**
 * Search Services barrel export
 * @module lib/services/search
 */

export { hybridSearchRRF, classifyQuery, type HybridSearchConfig, type SearchResult, type QueryComplexity, type Reranker } from './hybridSearch';
export { contextualizeChunk, batchContextualize, buildContextPrompt, splitIntoParentChild, type ContentChunk, type ContextualizedChunk, type ContextualizationOptions } from './contextualRetrieval';
export { gradeDocument, gradeDocuments, buildCRAGContext, type RetrievedDocument, type GradeResult, type CRAGResult, type CRAGConfig } from './correctiveRag';
