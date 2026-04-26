/**
 * OSCE Session Durable Object
 *
 * Purpose: Manage multi-agent session state for OSCE simulations
 * Agents: Auxiliary (intent classifier), Patient, Evaluation (SPBench scorer)
 *
 * Sprint: OSCE-01 Sprint 4
 */

export interface OsceSessionState {
  currentAgent: 'auxiliary' | 'patient' | 'evaluation';
  auxiliaryState: {
    lastIntent?: string;
    intentHistory: Array<{ intent: string; timestamp: number }>;
  };
  patientState: {
    empathyLevel: number; // 0-1, affects response openness
    questionsAsked: number;
    criticalMissed: string[];
  };
  evaluationState: {
    transcript: Array<{ role: 'student' | 'patient'; text: string; timestamp: number }>;
    startTime: number;
    endTime?: number;
  };
}

export class OsceSessionDO implements DurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    switch (method) {
      case 'POST':
        if (url.pathname === '/classify') {
          return this.handleIntentClassification(request);
        }
        if (url.pathname === '/respond') {
          return this.handlePatientResponse(request);
        }
        if (url.pathname === '/evaluate') {
          return this.handleEvaluation(request);
        }
        break;
      case 'GET':
        if (url.pathname === '/state') {
          return this.getSessionState(request);
        }
        break;
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleIntentClassification(request: Request): Promise<Response> {
    const { studentText, sessionId } = await request.json();
    const state = await this.state.storage.get<OsceSessionState>('session');

    if (!state) {
      return new Response('Session not found', { status: 404 });
    }

    // Store for routing
    state.auxiliaryState.lastIntent = undefined; // Will be set by intent.ts endpoint
    await this.state.storage.put('session', state);

    // Forward to intent.ts endpoint
    const intentResponse = await this.env.AI_ENDPOINT.fetch(
      new URL('/api/osce/intent', this.env.BASE_URL),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, studentText }),
      },
    );

    const intent = await intentResponse.json();

    // Update state
    state.auxiliaryState.lastIntent = intent.data?.intent;
    state.auxiliaryState.intentHistory.push({
      intent: intent.data?.intent,
      timestamp: Date.now(),
    });
    await this.state.storage.put('session', state);

    return new Response(JSON.stringify({ intent: intent.data?.intent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handlePatientResponse(request: Request): Promise<Response> {
    const { sessionId, classifiedIntent, studentQuestion } = await request.json();
    const state = await this.state.storage.get<OsceSessionState>('session');

    if (!state) {
      return new Response('Session not found', { status: 404 });
    }

    // Forward to patient.ts endpoint
    const patientResponse = await this.env.AI_ENDPOINT.fetch(
      new URL('/api/osce/patient', this.env.BASE_URL),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, classifiedIntent, studentQuestion }),
      },
    );

    const response = await patientResponse.json();

    // Update empathy level based on intent
    if (['COMMUNICATION', 'EMPATHY'].includes(classifiedIntent.toUpperCase())) {
      state.patientState.empathyLevel = Math.min(1, state.patientState.empathyLevel + 0.1);
    }

    state.patientState.questionsAsked++;

    // Add to transcript
    state.evaluationState.transcript.push({
      role: 'student',
      text: studentQuestion,
      timestamp: Date.now(),
    });
    state.evaluationState.transcript.push({
      role: 'patient',
      text: response.data?.response || '',
      timestamp: Date.now(),
    });

    await this.state.storage.put('session', state);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleEvaluation(request: Request): Promise<Response> {
    const { sessionId } = await request.json();
    const state = await this.state.storage.get<OsceSessionState>('session');

    if (!state) {
      return new Response('Session not found', { status: 404 });
    }

    state.evaluationState.endTime = Date.now();
    await this.state.storage.put('session', state);

    // Forward to evaluate.ts endpoint
    const evalResponse = await this.env.AI_ENDPOINT.fetch(
      new URL('/api/osce/evaluate', this.env.BASE_URL),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      },
    );

    return new Response(await evalResponse.text());
  }

  private async getSessionState(request: Request): Promise<Response> {
    const state = await this.state.storage.get<OsceSessionState>('session');

    if (!state) {
      return new Response('Session not found', { status: 404 });
    }

    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.OSCE_SESSION.idFromName(request);
    const stubDurableObject = env.get(id);
    const durableObject = new OsceSessionDO(stubDurableObject, env);
    return durableObject.fetch(request);
  },
};
