/**
 * PANaCEa Internal SDK — Barrel Export
 *
 * Usage:
 *   import { createApiClient, createDrillsClient, ApiError } from '@/lib/sdk';
 *
 *   const api = createApiClient(getToken);
 *   const drills = createDrillsClient(api);
 *   const result = await drills.submitReview(payload);
 *
 * @module lib/sdk
 */

// Core
export { createApiClient, type ApiClient } from './core';

// Domain clients
export { createDrillsClient, type DrillsClient } from './drillsClient';
export { createSessionsClient, type SessionsClient } from './sessionsClient';
export { createSrsClient, type SrsClient } from './srsClient';
export { createUserClient, type UserClient } from './userClient';
export { createContentClient, type ContentClient } from './contentClient';

// Shared types
export {
  ApiError,
  type TokenProvider,
  type SdkClientOptions,
  type WrappedResponse,
  type DrillSubmitPayload,
  type DrillSubmitResult,
  type SessionGeneratePayload,
  type SessionGenerateResult,
  type SRSItem,
  type SRSDueResult,
  type SRSSubmitPayload,
  type UserProfile,
  type UserStats,
  type FSRSParams,
  type ContentSearchResult,
  type SemanticSearchPayload,
  type SemanticSearchResult,
} from './types';
