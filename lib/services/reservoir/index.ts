/**
 * Proactive Question Reservoir
 *
 * Per-student warm buffer of pre-selected questions. Background refill jobs
 * keep the reservoir above a low-water mark so session generation is instant.
 *
 * Architecture:
 *   reservoirPolicy.ts    — Constants, types, TTL computation
 *   reservoirService.ts   — CRUD: reserve, insert, consume, maintain
 *   refillOrchestrator.ts — Job creation with deduplication + cooldown
 *   refillWorker.ts       — Question selection logic for refill jobs
 *
 * @module lib/services/reservoir
 */

export {
  RESERVOIR_POLICY,
  computeExpiry,
  deriveScope,
  type ReservoirStatus,
  type QuestionSource,
  type RefillReason,
  type ReservoirItem,
  type RefillResult,
  type ReservoirHealthReport,
} from './reservoirPolicy';

export {
  reserveFromReservoir,
  markConsumed,
  releaseReservation,
  failReservation,
  bulkInsertReservoirItems,
  getQueueDepth,
  needsRefill,
  runMaintenance,
  type ReservedQuestion,
  type InsertReservoirItemInput,
  type MaintenanceResult,
} from './reservoirService';

export {
  requestRefill,
  triggerRefillsForLowUsers,
  type RefillRequest,
} from './refillOrchestrator';

export {
  executeRefill,
  type RefillJobPayload,
} from './refillWorker';

export {
  analyzeBlueprintGaps,
  analyzeAndTriggerGeneration,
  type BlueprintGapResult,
  type GapAnalysisReport,
} from './blueprintGapAnalyzer';
