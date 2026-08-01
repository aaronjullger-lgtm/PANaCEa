/**
 * GET /api/osce/live-engine
 * Hyper-Real OSCE: Unified config for Live API (Voice + Text, dynamic persona, tools).
 * Returns setup (system instruction, tools get_current_vitals, reveal_lab_result) and
 * optionally an ephemeral token for client-to-Gemini WebSocket.
 *
 * Client connects to wss://generativelanguage.googleapis.com/ws/.../BidiGenerateContent
 * with token (or key for dev), sends setup first, then realtimeInput (audio) and
 * clientContent (text) in the same session. Barge-in: clientContent interrupts model.
 *
 * Orchestrator Phase 3: the flow logic lives in
 * lib/agents/strategies/liveEngineStrategy.ts (runLiveEngineFlow). This endpoint
 * delegates to it — one source of truth — and only owns the HTTP envelope.
 * Response shape is unchanged.
 */

import { aiEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  LiveEngineInputSchema,
  runLiveEngineFlow,
} from '../../../lib/agents/strategies/liveEngineStrategy';

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): builds Gemini Live
// API WebSocket config with dynamic persona/voice modulation and mints an
// ephemeral auth token via generativelanguage.googleapis.com. 25 rpm 'ai' bucket.
export const onRequestGet = aiEndpoint(
  LiveEngineInputSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/osce/live-engine');

    try {
      const output = await runLiveEngineFlow(validated, {
        env: { GEMINI_API_KEY: env.GEMINI_API_KEY },
        logger,
      });

      if (!output.tokenUsed) {
        logger.error('Ephemeral Live API token creation failed; refusing to expose server API key', {
          sessionId: validated.sessionId,
        });
        return new Response(
          JSON.stringify({
            error: 'Unable to create a temporary Live API session token. Please retry.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }

      logger.info('Live engine config requested', { sessionId: validated.sessionId });

      return new Response(
        JSON.stringify({
          data: {
            wsUrl: output.wsUrl,
            setup: output.setup,
            sessionId: output.sessionId,
            tokenUsed: output.tokenUsed,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error('live-engine error', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId?.substring(0, 10),
      });
      throw new Error('Failed to get live engine config');
    }
  },
  { source: 'query' }
);
