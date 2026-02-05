/**
 * Patient A/V Engine Runtime Service
 * 
 * Event-driven state machine that synchronizes real-time voice interaction
 * with dynamic video loops based on clinical triggers.
 * 
 * This service:
 * 1. Evaluates clinical conditions against vitals/physicalFindings
 * 2. Activates appropriate triggers
 * 3. Executes state transitions
 * 4. Emits WebSocket events for client synchronization
 * 5. Updates voice modulation and video states
 * 
 * @module patientAVEngine
 */

import type {
  PatientAVStateMachine,
  AVEngineState,
  ClinicalTrigger,
  ClinicalConditionExpression,
  AVState,
  AVEvent,
  StateTransitionEvent,
  TriggerActivationEvent,
  VitalsUpdateEvent,
  StateTransitionRule,
} from '@/types/patient-av-state-machine';

// ============================================================================
// CONDITION EVALUATOR
// ============================================================================

/**
 * Evaluates a clinical condition expression against current vitals/findings.
 */
export function evaluateCondition(
  expression: ClinicalConditionExpression,
  context: Record<string, unknown>
): boolean {
  if ('field' in expression) {
    // Leaf node: evaluate field comparison
    const value = getNestedValue(context, expression.field);
    
    switch (expression.operator) {
      case 'eq':
        return value === expression.value;
      case 'neq':
        return value !== expression.value;
      case 'lt':
        return typeof value === 'number' && value < (expression.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (expression.value as number);
      case 'gt':
        return typeof value === 'number' && value > (expression.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (expression.value as number);
      case 'contains':
        return typeof value === 'string' && value.includes(expression.value as string);
      case 'in':
        return Array.isArray(expression.value) && expression.value.includes(value);
      default:
        return false;
    }
  } else {
    // Branch node: evaluate logical operator
    switch (expression.operator) {
      case 'and':
        return expression.conditions.every((cond) => evaluateCondition(cond, context));
      case 'or':
        return expression.conditions.some((cond) => evaluateCondition(cond, context));
      case 'not':
        return !expression.conditions.every((cond) => evaluateCondition(cond, context));
      default:
        return false;
    }
  }
}

/**
 * Get nested value from object using dot-notation path.
 * Example: getNestedValue({ vitals: { o2: 88 } }, 'vitals.o2') => 88
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

// ============================================================================
// STATE MACHINE ENGINE
// ============================================================================

export class PatientAVEngine {
  private stateMachine: PatientAVStateMachine;
  private engineState: AVEngineState;
  private eventListeners: Array<(event: AVEvent) => void> = [];
  private transitionCooldowns: Map<string, number> = new Map();

  constructor(stateMachine: PatientAVStateMachine) {
    this.stateMachine = stateMachine;
    this.engineState = {
      currentState: stateMachine.initialState,
      stateHistory: [
        {
          stateId: stateMachine.initialState,
          timestamp: new Date().toISOString(),
        },
      ],
      activeTriggers: [],
      currentVitals: {
        hr: 80,
        bp: '120/80',
        temp: 98.6,
        rr: 16,
        o2: 98,
      },
      currentPhysicalFindings: {},
      studentActions: [],
      lastTransitionAt: new Date().toISOString(),
    };
  }

  /**
   * Subscribe to engine events.
   */
  public on(listener: (event: AVEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Emit an event to all listeners.
   */
  private emit(event: AVEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  /**
   * Get current engine state.
   */
  public getState(): AVEngineState {
    return { ...this.engineState };
  }

  /**
   * Get current AV state definition.
   */
  public getCurrentAVState(): AVState {
    return this.stateMachine.states[this.engineState.currentState]!;
  }

  /**
   * Update vitals and evaluate triggers.
   */
  public updateVitals(
    vitals: Record<string, string | number>,
    physicalFindings?: Record<string, unknown>
  ): void {
    const previousVitals = { ...this.engineState.currentVitals };
    this.engineState.currentVitals = { ...this.engineState.currentVitals, ...vitals };
    
    if (physicalFindings) {
      this.engineState.currentPhysicalFindings = {
        ...this.engineState.currentPhysicalFindings,
        ...physicalFindings,
      };
    }

    const changedFields = Object.keys(vitals).filter(
      (key) => previousVitals[key] !== vitals[key]
    );

    // Evaluate all triggers
    const triggersEvaluated = this.evaluateTriggers();

    // Emit vitals update event
    const event: VitalsUpdateEvent = {
      type: 'VITALS_UPDATED',
      timestamp: new Date().toISOString(),
      sessionId: this.stateMachine.id,
      payload: {
        vitals,
        changedFields,
        triggersEvaluated,
      },
    };
    this.emit(event);

    // Attempt auto-transitions if any triggers are active
    this.attemptAutoTransitions();
  }

  /**
   * Record a student action.
   */
  public recordStudentAction(action: string): void {
    this.engineState.studentActions.push({
      action,
      timestamp: new Date().toISOString(),
    });

    this.emit({
      type: 'STUDENT_ACTION',
      timestamp: new Date().toISOString(),
      sessionId: this.stateMachine.id,
      payload: { action },
    });

    // Re-evaluate transitions in case the action satisfies a requirement
    this.attemptAutoTransitions();
  }

  /**
   * Evaluate all triggers against current context.
   */
  private evaluateTriggers(): ClinicalTrigger[] {
    const context = {
      vitals: this.engineState.currentVitals,
      physicalFindings: this.engineState.currentPhysicalFindings,
      studentActions: this.engineState.studentActions.map((a) => a.action),
    };

    const activeTriggerIds = new Set(this.engineState.activeTriggers.map((t) => t.id));
    const newActiveTriggers: ClinicalTrigger[] = [];

    // Collect all triggers from global and current state
    const allTriggers = [
      ...this.stateMachine.globalTransitions.flatMap((t) => t.triggers),
      ...(this.stateMachine.stateTransitions[this.engineState.currentState] ?? []).flatMap(
        (t) => t.triggers
      ),
      ...(this.getCurrentAVState().autoTransitions ?? []).flatMap((t) => t.triggers),
    ];

    for (const trigger of allTriggers) {
      const isActive = evaluateCondition(trigger.condition, context);

      if (isActive && !activeTriggerIds.has(trigger.id)) {
        // New trigger activated
        const activatedTrigger = { ...trigger, activatedAt: new Date().toISOString() };
        newActiveTriggers.push(activatedTrigger);

        const event: TriggerActivationEvent = {
          type: 'TRIGGER_ACTIVATED',
          timestamp: new Date().toISOString(),
          sessionId: this.stateMachine.id,
          payload: {
            trigger: activatedTrigger,
            vitalsSnapshot: { ...this.engineState.currentVitals },
          },
        };
        this.emit(event);
      } else if (!isActive && activeTriggerIds.has(trigger.id)) {
        // Trigger deactivated
        this.emit({
          type: 'TRIGGER_DEACTIVATED',
          timestamp: new Date().toISOString(),
          sessionId: this.stateMachine.id,
          payload: { triggerId: trigger.id },
        });
      }
    }

    // Update active triggers
    this.engineState.activeTriggers = [
      ...this.engineState.activeTriggers.filter((t) => {
        const context = {
          vitals: this.engineState.currentVitals,
          physicalFindings: this.engineState.currentPhysicalFindings,
          studentActions: this.engineState.studentActions.map((a) => a.action),
        };
        return evaluateCondition(t.condition, context);
      }),
      ...newActiveTriggers,
    ];

    return this.engineState.activeTriggers;
  }

  /**
   * Attempt automatic state transitions based on active triggers.
   */
  private attemptAutoTransitions(): void {
    const now = Date.now();
    const currentState = this.engineState.currentState;

    // Collect all applicable transitions
    const transitions: Array<{ rule: StateTransitionRule; trigger?: ClinicalTrigger }> = [];

    // Global transitions
    for (const rule of this.stateMachine.globalTransitions) {
      const matchingTrigger = this.findMatchingTrigger(rule);
      if (matchingTrigger) {
        transitions.push({ rule, trigger: matchingTrigger });
      }
    }

    // State-specific transitions
    for (const rule of this.stateMachine.stateTransitions[currentState] ?? []) {
      const matchingTrigger = this.findMatchingTrigger(rule);
      if (matchingTrigger) {
        transitions.push({ rule, trigger: matchingTrigger });
      }
    }

    // Auto-transitions from current state definition
    for (const rule of this.getCurrentAVState().autoTransitions ?? []) {
      const matchingTrigger = this.findMatchingTrigger(rule);
      if (matchingTrigger) {
        transitions.push({ rule, trigger: matchingTrigger });
      }
    }

    if (transitions.length === 0) return;

    // Sort by trigger priority (highest first)
    transitions.sort((a, b) => (b.trigger?.priority ?? 0) - (a.trigger?.priority ?? 0));

    // Execute the highest-priority transition that passes cooldown
    for (const { rule, trigger } of transitions) {
      const cooldownKey = `${currentState}-${rule.toState}`;
      const lastTransition = this.transitionCooldowns.get(cooldownKey) ?? 0;
      const cooldownSeconds = rule.cooldown ?? 0;

      if (now - lastTransition < cooldownSeconds * 1000) {
        continue; // Still in cooldown
      }

      // Check if student action requirement is satisfied
      if (
        rule.requiresStudentAction &&
        !this.engineState.studentActions.some((a) => a.action === rule.requiresStudentAction)
      ) {
        continue; // Required action not performed
      }

      // Execute transition
      this.transition(rule.toState, trigger);
      this.transitionCooldowns.set(cooldownKey, now);
      return; // Only execute one transition per evaluation
    }
  }

  /**
   * Find a matching trigger for a transition rule.
   */
  private findMatchingTrigger(rule: StateTransitionRule): ClinicalTrigger | undefined {
    for (const trigger of rule.triggers) {
      if (this.engineState.activeTriggers.some((t) => t.id === trigger.id)) {
        return trigger;
      }
    }
    return undefined;
  }

  /**
   * Execute a state transition.
   */
  public transition(toState: string, trigger?: ClinicalTrigger): void {
    const fromState = this.engineState.currentState;

    if (!this.stateMachine.states[toState]) {
      console.error(`Invalid state transition: ${toState} does not exist`);
      return;
    }

    const startTime = Date.now();

    // Emit exit event
    this.emit({
      type: 'STATE_EXIT',
      timestamp: new Date().toISOString(),
      sessionId: this.stateMachine.id,
      payload: { stateId: fromState },
    });

    // Update state
    this.engineState.currentState = toState;
    this.engineState.lastTransitionAt = new Date().toISOString();
    this.engineState.stateHistory.push({
      stateId: toState,
      timestamp: this.engineState.lastTransitionAt,
      trigger: trigger?.id,
    });

    // Emit enter event
    this.emit({
      type: 'STATE_ENTER',
      timestamp: new Date().toISOString(),
      sessionId: this.stateMachine.id,
      payload: { stateId: toState },
    });

    // Emit transition completed event
    const event: StateTransitionEvent = {
      type: 'TRANSITION_COMPLETED',
      timestamp: new Date().toISOString(),
      sessionId: this.stateMachine.id,
      payload: {
        fromState,
        toState,
        trigger,
        duration: Date.now() - startTime,
      },
    };
    this.emit(event);
  }

  /**
   * Manually trigger a state transition (for testing or override).
   */
  public forceTransition(toState: string): void {
    this.transition(toState);
  }

  /**
   * Get state machine definition (for debugging).
   */
  public getStateMachine(): PatientAVStateMachine {
    return this.stateMachine;
  }
}

// ============================================================================
// STATE MACHINE BUILDER
// ============================================================================

/**
 * Builder pattern for constructing state machines fluently.
 */
export class StateMachineBuilder {
  private machine: Partial<PatientAVStateMachine> = {
    states: {},
    globalTransitions: [],
    stateTransitions: {},
  };

  public withId(id: string): this {
    this.machine.id = id;
    return this;
  }

  public withVersion(version: string): this {
    this.machine.version = version;
    return this;
  }

  public withInitialState(stateId: string): this {
    this.machine.initialState = stateId;
    return this;
  }

  public withMetadata(metadata: PatientAVStateMachine['metadata']): this {
    this.machine.metadata = metadata;
    return this;
  }

  public addState(state: AVState): this {
    this.machine.states![state.id] = state;
    return this;
  }

  public addGlobalTransition(transition: StateTransitionRule): this {
    this.machine.globalTransitions!.push(transition);
    return this;
  }

  public addStateTransition(fromState: string, transition: StateTransitionRule): this {
    if (!this.machine.stateTransitions![fromState]) {
      this.machine.stateTransitions![fromState] = [];
    }
    this.machine.stateTransitions![fromState]!.push(transition);
    return this;
  }

  public build(): PatientAVStateMachine {
    if (
      !this.machine.id ||
      !this.machine.version ||
      !this.machine.initialState ||
      !this.machine.metadata
    ) {
      throw new Error('Missing required fields: id, version, initialState, metadata');
    }

    return this.machine as PatientAVStateMachine;
  }
}
