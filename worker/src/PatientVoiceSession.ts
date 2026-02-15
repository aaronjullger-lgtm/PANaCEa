/**
 * PatientVoiceSession - Cloudflare Durable Object for Voice-to-Voice OSCE
 *
 * Maintains persistent WebSocket connection for audio streaming, A/V state
 * synchronization, and integration with Gemini Multimodal Live API.
 *
 * Responsibilities:
 * 1. Manage WebSocket lifecycle
 * 2. Stream audio to/from Gemini (native_audio_function_call_sandbox)
 * 3. Run PatientAVEngine and emit state transitions
 * 4. Coordinate video generation with veo_cameos
 * 5. Persist transcript to PatientEncounterSession on close
 *
 * @module PatientVoiceSession
 */

import type {
  PatientAVStateMachine,
  AVWebSocketMessage,
  AVStateSyncMessage,
  AVStateTransitionMessage,
  AVVitalsUpdateMessage,
  AVStudentActionMessage,
  AVEvent,
} from '../../types/patient-av-state-machine';
import { PatientAVEngine } from '../../services/av/patientAVEngine';

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  VEO_CAMEOS_API_KEY: string;
  PATIENT_VOICE_SESSION: DurableObjectNamespace;
}

export class PatientVoiceSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private websocket: WebSocket | null = null;
  private geminiConnection: WebSocket | null = null;
  private avEngine: PatientAVEngine | null = null;
  private sessionId: string = '';
  private transcript: string[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle incoming HTTP request to upgrade to WebSocket.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.sessionId = url.pathname.split('/').pop() ?? '';

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Authenticate: Extract Clerk token and verify session ownership
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response('Missing authentication token', { status: 401 });
    }

    // Verify token and load session (pseudo-code - implement with Clerk SDK)
    const userId = await this.verifyToken(token);
    if (!userId) {
      return new Response('Invalid token', { status: 401 });
    }

    const sessionData = await this.loadSession(this.sessionId, userId);
    if (!sessionData) {
      return new Response('Session not found or unauthorized', { status: 404 });
    }

    // Upgrade to WebSocket
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.websocket = server;
    this.state.acceptWebSocket(server);

    // Initialize A/V engine
    await this.initializeAVEngine(sessionData);

    // Connect to Gemini
    await this.connectToGemini(sessionData);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket messages from client.
   */
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (typeof message === 'string') {
      const msg: AVWebSocketMessage = JSON.parse(message);

      switch (msg.type) {
        case 'audio':
          // Forward audio to Gemini
          await this.forwardAudioToGemini(msg.payload);
          break;

        case 'barge_in':
          // Cancel TTS generation
          await this.handleBargeIn();
          break;

        case 'av_vitals_update':
          // Update vitals in A/V engine
          await this.handleVitalsUpdate(msg as AVVitalsUpdateMessage);
          break;

        case 'av_student_action':
          // Record student action
          await this.handleStudentAction(msg as AVStudentActionMessage);
          break;

        default:
          console.warn('Unknown message type:', msg.type);
      }
    } else {
      // Binary audio data (alternative format)
      await this.forwardAudioToGemini(message);
    }
  }

  /**
   * Handle WebSocket close.
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    console.log('WebSocket closed:', code, reason);

    // Close Gemini connection
    if (this.geminiConnection) {
      this.geminiConnection.close();
      this.geminiConnection = null;
    }

    // Persist transcript to database
    await this.persistTranscript();

    this.websocket = null;
    this.avEngine = null;
  }

  /**
   * Initialize the A/V state machine engine.
   */
  private async initializeAVEngine(sessionData: {
    caseId: string;
    stateMachine: PatientAVStateMachine;
    currentVitals: Record<string, string | number>;
    physicalFindings: Record<string, unknown>;
  }): Promise<void> {
    this.avEngine = new PatientAVEngine(sessionData.stateMachine);

    // Initialize with current vitals
    this.avEngine.updateVitals(sessionData.currentVitals, sessionData.physicalFindings);

    // Subscribe to engine events
    this.avEngine.on((event: AVEvent) => this.handleAVEvent(event));

    // Send initial state sync
    const syncMessage: AVStateSyncMessage = {
      type: 'av_state_sync',
      timestamp: new Date().toISOString(),
      payload: {
        currentState: this.avEngine.getCurrentAVState(),
        engineState: this.avEngine.getState(),
        availableActions: ['administer_oxygen', 'order_labs', 'consult_specialist'],
      },
    };

    this.sendToClient(syncMessage);
  }

  /**
   * Connect to Gemini Multimodal Live API.
   */
  private async connectToGemini(sessionData: {
    patientName: string;
    chiefComplaint: string;
    personality: string;
  }): Promise<void> {
    const currentState = this.avEngine?.getCurrentAVState();
    if (!currentState) return;

    // Build system prompt
    const systemPrompt = currentState.systemPromptOverride ?? this.buildSystemPrompt(sessionData);

    // Gemini Multimodal Live API connection (pseudo-code)
    // In production, use Gemini SDK with BidiGenerateContent
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.env.GEMINI_API_KEY}`;

    this.geminiConnection = new WebSocket(geminiUrl);

    this.geminiConnection.onopen = () => {
      // Send initial config
      const config = {
        model: 'models/gemini-2.0-flash-exp',
        systemInstruction: systemPrompt,
        generationConfig: {
          voiceConfig: {
            voiceId: currentState.voice.voiceId,
            rate: currentState.voice.rate,
            pitch: currentState.voice.pitch,
            volume: currentState.voice.volume,
          },
        },
      };

      this.geminiConnection?.send(JSON.stringify({ setup: config }));
    };

    this.geminiConnection.onmessage = (event) => {
      // Receive audio/transcript from Gemini
      this.handleGeminiMessage(event.data);
    };

    this.geminiConnection.onerror = (error) => {
      console.error('Gemini connection error:', error);
    };

    this.geminiConnection.onclose = () => {
      console.log('Gemini connection closed');
    };
  }

  /**
   * Build system prompt for Gemini based on patient context and current state.
   */
  private buildSystemPrompt(sessionData: {
    patientName: string;
    chiefComplaint: string;
    personality: string;
  }): string {
    const currentState = this.avEngine?.getCurrentAVState();
    if (!currentState) return '';

    const toneDescriptors = currentState.voice.toneDescriptors.join(', ');

    return `You are ${sessionData.patientName}, a patient presenting with ${sessionData.chiefComplaint}.

Clinical State: ${currentState.clinicalContext}

Personality: ${sessionData.personality}

Voice Characteristics: ${toneDescriptors}

Instructions:
- Respond naturally to the student's questions about your symptoms and history.
- Stay in character. Match your tone to your clinical state (${toneDescriptors}).
- If you are short of breath, keep answers brief and fragmented.
- Never break character or reveal your diagnosis directly.
- If the student interrupts you, stop speaking immediately (barge-in).

Remember: You are a real patient. Be authentic, not a textbook.`;
  }

  /**
   * Handle A/V engine events and notify client.
   */
  private handleAVEvent(event: AVEvent): void {
    if (event.type === 'TRANSITION_COMPLETED') {
      // State transition occurred - notify client and update Gemini
      const transitionEvent =
        event as import('@/types/patient-av-state-machine').StateTransitionEvent;
      const newState = this.avEngine?.getCurrentAVState();
      if (!newState) return;

      const message: AVStateTransitionMessage = {
        type: 'av_state_transition',
        timestamp: new Date().toISOString(),
        payload: {
          fromState: transitionEvent.payload.fromState,
          toState: transitionEvent.payload.toState,
          newStateDefinition: newState,
          trigger: transitionEvent.payload.trigger,
          transitionAnimation: {
            type: newState.video.transitionType,
            duration: newState.video.transitionDuration,
          },
        },
      };

      this.sendToClient(message);

      // Update Gemini voice config
      this.updateGeminiVoiceConfig(newState.voice);

      // Trigger video generation if needed
      if (newState.video.status === 'pending') {
        this.generateVideo(newState.video);
      }
    } else if (event.type === 'TRIGGER_ACTIVATED') {
      // Just log for now - could notify client of clinical changes
      console.log('Trigger activated:', event.payload);
    }
  }

  /**
   * Update Gemini voice configuration.
   */
  private updateGeminiVoiceConfig(
    voice: import('@/types/patient-av-state-machine').VoiceModulation
  ): void {
    if (!this.geminiConnection) return;

    const configUpdate = {
      voiceConfig: {
        voiceId: voice.voiceId,
        rate: voice.rate,
        pitch: voice.pitch,
        volume: voice.volume,
      },
    };

    this.geminiConnection.send(JSON.stringify({ updateVoice: configUpdate }));
  }

  /**
   * Generate video using veo_cameos.
   */
  private async generateVideo(
    videoState: import('@/types/patient-av-state-machine').VideoState
  ): Promise<void> {
    // veo_cameos API integration (pseudo-code)
    // In production, call Google AI Studio API
    try {
      const response = await fetch('https://aistudio.google.com/api/veo/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.VEO_CAMEOS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: videoState.prompt,
          duration: videoState.duration,
          loop: true,
          style: 'realistic',
        }),
      });

      if (!response.ok) {
        throw new Error(`Video generation failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Notify client when video is ready
      this.sendToClient({
        type: 'av_video_ready',
        timestamp: new Date().toISOString(),
        payload: {
          videoId: videoState.videoId,
          videoUrl: result.url,
        },
      });
    } catch (error) {
      console.error('Video generation error:', error);
      this.sendToClient({
        type: 'av_video_ready',
        timestamp: new Date().toISOString(),
        payload: {
          videoId: videoState.videoId,
          error: String(error),
        },
      });
    }
  }

  /**
   * Handle vitals update from client.
   */
  private handleVitalsUpdate(msg: AVVitalsUpdateMessage): void {
    if (!this.avEngine) return;
    this.avEngine.updateVitals(msg.payload.vitals, msg.payload.physicalFindings);
  }

  /**
   * Handle student action from client.
   */
  private handleStudentAction(msg: AVStudentActionMessage): void {
    if (!this.avEngine) return;
    this.avEngine.recordStudentAction(msg.payload.action);
  }

  /**
   * Handle barge-in (interrupt).
   */
  private async handleBargeIn(): Promise<void> {
    // Cancel Gemini TTS generation
    if (this.geminiConnection) {
      this.geminiConnection.send(JSON.stringify({ cancel: true }));
    }

    this.sendToClient({
      type: 'tts_end',
      timestamp: new Date().toISOString(),
      payload: { reason: 'barge_in' },
    });
  }

  /**
   * Forward audio to Gemini.
   */
  private async forwardAudioToGemini(audio: unknown): Promise<void> {
    if (!this.geminiConnection || this.geminiConnection.readyState !== WebSocket.OPEN) {
      return;
    }

    // Forward audio chunk to Gemini
    this.geminiConnection.send(JSON.stringify({ audio }));
  }

  /**
   * Handle messages from Gemini.
   */
  private handleGeminiMessage(data: string | ArrayBuffer): void {
    if (typeof data === 'string') {
      const msg = JSON.parse(data);

      if (msg.type === 'audio') {
        // Forward AI audio to client
        this.sendToClient({
          type: 'audio',
          timestamp: new Date().toISOString(),
          payload: msg.data,
        });
      } else if (msg.type === 'transcript') {
        // Store transcript
        this.transcript.push(msg.text);
        this.sendToClient({
          type: 'transcript',
          timestamp: new Date().toISOString(),
          payload: { text: msg.text },
        });
      } else if (msg.type === 'tts_start') {
        this.sendToClient({
          type: 'tts_start',
          timestamp: new Date().toISOString(),
          payload: {},
        });
      } else if (msg.type === 'tts_end') {
        this.sendToClient({
          type: 'tts_end',
          timestamp: new Date().toISOString(),
          payload: {},
        });
      }
    }
  }

  /**
   * Send message to client WebSocket.
   */
  private sendToClient(msg: unknown): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(msg));
    }
  }

  /**
   * Persist transcript to database.
   */
  private async persistTranscript(): Promise<void> {
    if (this.transcript.length === 0) return;

    try {
      // Pseudo-code: Update PatientEncounterSession.messages
      await fetch(`${this.env.DATABASE_URL}/api/osce/sessions/${this.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: this.transcript.join('\n'),
        }),
      });
    } catch (error) {
      console.error('Failed to persist transcript:', error);
    }
  }

  /**
   * Verify authentication token (Clerk).
   */
  private async verifyToken(token: string): Promise<string | null> {
    // Pseudo-code: Verify Clerk JWT
    // In production, use Clerk SDK
    try {
      const response = await fetch('https://api.clerk.dev/v1/tokens/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.userId;
    } catch {
      return null;
    }
  }

  /**
   * Load session data from database.
   */
  private async loadSession(
    sessionId: string,
    userId: string
  ): Promise<{
    caseId: string;
    stateMachine: PatientAVStateMachine;
    currentVitals: Record<string, string | number>;
    physicalFindings: Record<string, unknown>;
    patientName: string;
    chiefComplaint: string;
    personality: string;
  } | null> {
    // Pseudo-code: Load from database
    // In production, fetch from Prisma via Pages Function proxy
    try {
      const response = await fetch(
        `${this.env.DATABASE_URL}/api/osce/sessions/${sessionId}?userId=${userId}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data;
    } catch {
      return null;
    }
  }
}
