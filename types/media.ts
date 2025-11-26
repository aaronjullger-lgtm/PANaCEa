/**
 * Media Integration Types
 * Type definitions for the media integration system.
 */

import type { MediaType } from "../lib/mediaMatcherUtils";

/**
 * Represents a media asset in the system.
 * Equivalent to the Prisma MediaAsset model from requirements.
 */
export interface MediaAsset {
  id: string;
  conditionId: string | null;
  type: MediaType;
  filename: string;
  filepath: string;
  tags: string[];
  confidence: number;
  createdAt: Date;
}

/**
 * Represents a successful media-to-condition link.
 * Used in media_links.json output.
 */
export interface MediaLink {
  filename: string;
  filepath: string;
  conditionId: string;
  type: MediaType;
  confidence: number;
  tags: string[];
}

/**
 * Represents an unresolved or ambiguous media match.
 * Used in media_audit.json output.
 */
export interface MediaAuditEntry {
  file: string;
  filepath: string;
  type: MediaType;
  reason: "unresolved" | "ambiguous";
  possibleMatches: Array<{
    conditionId: string;
    conditionName: string;
    score: number;
  }>;
  tags: string[];
}

/**
 * Sidecar metadata file structure.
 * Expected to be <filename>.json alongside media files.
 */
export interface MediaSidecarMetadata {
  tags?: string[];
  annotations?: string[];
  conditionHint?: string;
  description?: string;
}

/**
 * Condition entry from conditionContent.transformed.json
 */
export interface ConditionEntry {
  condition: string;
  sections: {
    [key: string]: string | string[] | { notes?: string } | null;
  };
  mediaIds?: string[];
}

/**
 * Conditions dataset structure
 */
export type ConditionsDataset = Record<string, ConditionEntry>;

/**
 * Configuration for the matching algorithm
 */
export interface MatchingConfig {
  /** Minimum score for auto-match (default: 0.55) */
  autoMatchThreshold: number;
  /** Minimum gap between top candidate and next for definitive match (default: 0.15) */
  ambiguityGap: number;
  /** Maximum number of candidates to consider */
  maxCandidates: number;
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  autoMatchThreshold: 0.55,
  ambiguityGap: 0.15,
  maxCandidates: 5,
};
