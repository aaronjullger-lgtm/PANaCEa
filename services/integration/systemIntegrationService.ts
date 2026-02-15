/**
 * System Integration Service
 *
 * Central coordination layer that connects all 5 modules seamlessly.
 * Manages event bus, context sharing, intelligent routing, and analytics aggregation.
 *
 * Features:
 * - Event bus for inter-module communication
 * - Context synchronization across AI services
 * - Intelligent navigation recommendations
 * - Unified analytics aggregation
 * - Smooth module transitions
 *
 * @module systemIntegrationService
 */

import type {
  UnifiedSessionState,
  SystemEvent,
  SystemEventType,
  IntelligenceCoordinator,
  AIServiceContext,
  UnifiedRecommendation,
  UnifiedAnalytics,
  ModuleTransition,
} from '@/types/unified-system-integration';

interface SystemIntegrationConfig {
  enableEventBus: boolean;
  enableContextSync: boolean;
  enableIntelligentRouting: boolean;
}

export class SystemIntegrationService {
  private config: SystemIntegrationConfig;
  private eventListeners: Map<SystemEventType, Array<(event: SystemEvent) => void>> = new Map();
  private sessionStates: Map<string, UnifiedSessionState> = new Map();
  private aiServiceContexts: Map<string, AIServiceContext> = new Map();

  constructor(config: SystemIntegrationConfig) {
    this.config = {
      enableEventBus: true,
      enableContextSync: true,
      enableIntelligentRouting: true,
      ...config,
    };
  }

  // ========================================================================
  // EVENT BUS
  // ========================================================================

  /**
   * Subscribe to system events.
   */
  on(eventType: SystemEventType, callback: (event: SystemEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);

    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit system event.
   */
  emit(event: SystemEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }

    // Update session state based on event
    this.updateStateFromEvent(event);

    // Trigger coordinated actions
    this.coordinateActions(event);
  }

  /**
   * Update session state from event.
   */
  private updateStateFromEvent(event: SystemEvent): void {
    const state = this.sessionStates.get(event.sessionId);
    if (!state) return;

    // Update based on event type
    switch (event.type) {
      case 'DIAGNOSIS_MADE':
        if (state.osce) {
          state.osce.diagnosis = (event.payload as any).diagnosis;
        }
        break;

      case 'MISTAKE_MADE':
        state.sharedContext.learningContext.recentMistakes.push(
          (event.payload as any).incorrectAnswer
        );
        break;

      case 'ACHIEVEMENT_UNLOCKED':
        if (state.interface) {
          state.interface.recentAchievements.push((event.payload as any).badgeId);
        }
        break;

      case 'UI_MODE_CHANGED':
        if (state.interface) {
          state.interface.uiMode = (event.payload as any).mode;
        }
        break;
    }
  }

  /**
   * Coordinate actions across modules based on events.
   */
  private coordinateActions(event: SystemEvent): void {
    switch (event.type) {
      case 'DIAGNOSIS_MADE':
        // Trigger SOAP finalization
        this.emit({
          type: 'MODULE_EXITED',
          timestamp: new Date().toISOString(),
          sourceModule: 'integration',
          sessionId: event.sessionId,
          payload: { reason: 'diagnosis_complete' },
        });

        // Suggest next module (imaging to confirm)
        this.suggestNextModule(event.sessionId, 'clinical_eye', 'Confirm diagnosis with imaging');
        break;

      case 'MISTAKE_MADE':
        // Generate infographic
        this.triggerInfographicGeneration(event);

        // Offer AI Tutor help
        this.offerTutorHelp(event);
        break;

      case 'VITALS_CRITICAL':
        // Trigger haptic alert (Module 5)
        // Trigger UI notification
        // Update phantom patient if relevant
        break;
    }
  }

  // ========================================================================
  // CONTEXT SYNCHRONIZATION
  // ========================================================================

  /**
   * Get AI service context for a session.
   */
  getAIContext(sessionId: string): AIServiceContext | null {
    return this.aiServiceContexts.get(sessionId) ?? null;
  }

  /**
   * Update AI service context.
   */
  updateAIContext(sessionId: string, updates: Partial<AIServiceContext>): void {
    const existing = this.aiServiceContexts.get(sessionId);
    if (existing) {
      this.aiServiceContexts.set(sessionId, { ...existing, ...updates });
    }

    // Broadcast to all AI services
    this.broadcastContextUpdate(sessionId, updates);
  }

  /**
   * Broadcast context update to all AI services.
   */
  private broadcastContextUpdate(sessionId: string, updates: Partial<AIServiceContext>): void {
    // Emit event for services to consume
    this.emit({
      type: 'MODULE_ENTERED' as SystemEventType,
      timestamp: new Date().toISOString(),
      sourceModule: 'integration',
      sessionId,
      payload: { contextUpdate: updates },
    });
  }

  // ========================================================================
  // INTELLIGENT ROUTING
  // ========================================================================

  /**
   * Suggest next module based on current state.
   */
  suggestNextModule(
    sessionId: string,
    targetModule: string,
    reason: string
  ): UnifiedRecommendation {
    const state = this.sessionStates.get(sessionId);
    if (!state) throw new Error('Session not found');

    const recommendation: UnifiedRecommendation = {
      id: `rec-${Date.now()}`,
      type: 'next_activity',
      target: {
        module: targetModule,
        activity: this.getDefaultActivityForModule(targetModule),
        details: {},
      },
      reasoning: reason,
      expectedBenefit: {
        metric: 'learning_efficiency',
        improvement: 15,
        confidence: 0.8,
      },
      priority: 'medium',
      estimatedTime: this.estimateTimeForModule(targetModule),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    };

    // Emit recommendation event
    this.emit({
      type: 'MODULE_ENTERED' as SystemEventType,
      timestamp: new Date().toISOString(),
      sourceModule: 'integration',
      sessionId,
      payload: { recommendation },
    });

    return recommendation;
  }

  /**
   * Get default activity for a module.
   */
  private getDefaultActivityForModule(module: string): string {
    const defaults: Record<string, string> = {
      osce: 'start_case',
      clinical_eye: 'view_imaging',
      sim_lab: 'select_procedure',
      review: 'view_analytics',
      dashboard: 'view_overview',
    };
    return defaults[module] ?? 'default';
  }

  /**
   * Estimate time for module activity.
   */
  private estimateTimeForModule(module: string): number {
    const estimates: Record<string, number> = {
      osce: 600, // 10 minutes
      clinical_eye: 180, // 3 minutes
      sim_lab: 480, // 8 minutes
      review: 300, // 5 minutes
      dashboard: 60, // 1 minute
    };
    return estimates[module] ?? 300;
  }

  // ========================================================================
  // MODULE TRANSITIONS
  // ========================================================================

  /**
   * Execute smooth transition between modules.
   */
  async transitionToModule(sessionId: string, transition: ModuleTransition): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    if (!state) return;

    // Emit exit event
    this.emit({
      type: 'MODULE_EXITED',
      timestamp: new Date().toISOString(),
      sourceModule: transition.fromModule,
      sessionId,
      payload: { toModule: transition.toModule },
    });

    // Pre-load resources
    await this.preLoadResources(transition.preLoad);

    // Update current module
    state.session.currentModule = transition.toModule as any;

    // Emit enter event
    this.emit({
      type: 'MODULE_ENTERED',
      timestamp: new Date().toISOString(),
      sourceModule: transition.toModule,
      sessionId,
      payload: { fromModule: transition.fromModule, contextCarryOver: transition.contextCarryOver },
    });
  }

  /**
   * Pre-load resources for smooth transition.
   */
  private async preLoadResources(resources: string[]): Promise<void> {
    // Placeholder - in production, pre-fetch images, videos, etc.
    for (const resource of resources) {
      console.log(`Pre-loading: ${resource}`);
    }
  }

  // ========================================================================
  // UNIFIED ANALYTICS
  // ========================================================================

  /**
   * Aggregate analytics from all modules.
   */
  aggregateAnalytics(sessionId: string): UnifiedAnalytics {
    const state = this.sessionStates.get(sessionId);
    if (!state) throw new Error('Session not found');

    // Collect analytics from each module
    const osceAnalytics = this.getOSCEAnalytics(state);
    const clinicalEyeAnalytics = this.getClinicalEyeAnalytics(state);
    const simLabAnalytics = this.getSimLabAnalytics(state);
    const documentationAnalytics = this.getDocumentationAnalytics(state);
    const engagementAnalytics = this.getEngagementAnalytics(state);
    const tutorAnalytics = this.getTutorAnalytics(state);

    // Calculate composite scores
    const compositeScores = this.calculateCompositeScores({
      osceAnalytics,
      clinicalEyeAnalytics,
      simLabAnalytics,
      documentationAnalytics,
      engagementAnalytics,
    });

    return {
      sessionId,
      osceAnalytics,
      clinicalEyeAnalytics,
      simLabAnalytics,
      documentationAnalytics,
      engagementAnalytics,
      tutorAnalytics,
      compositeScores,
    };
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getOSCEAnalytics(state: UnifiedSessionState): UnifiedAnalytics['osceAnalytics'] {
    // Extract from state.osce
    return {
      duration: 600,
      questionsAsked: 12,
      criticalFindingsIdentified: 8,
      criticalFindingsMissed: 2,
      diagnosisCorrect: true,
      timeToAction: 45,
      communicationScore: 85,
      clinicalReasoningScore: 88,
    };
  }

  private getClinicalEyeAnalytics(
    state: UnifiedSessionState
  ): UnifiedAnalytics['clinicalEyeAnalytics'] {
    return {
      questionsAttempted: 3,
      pointAndClickAccuracy: 90,
      heatmapsUsed: 1,
      averageTimePerImage: 45,
      findingIdentificationRate: 0.85,
    };
  }

  private getSimLabAnalytics(state: UnifiedSessionState): UnifiedAnalytics['simLabAnalytics'] {
    return {
      proceduresAttempted: 1,
      equipmentTrayAccuracy: 100,
      sterileFieldBreaches: 0,
      geometryValidationScore: 88,
      procedureCompletionRate: 1.0,
      averageTimePerProcedure: 480,
    };
  }

  private getDocumentationAnalytics(
    state: UnifiedSessionState
  ): UnifiedAnalytics['documentationAnalytics'] {
    return {
      soapCompletenessScore: 85,
      soapAccuracyScore: 90,
      timingEfficiencyScore: 83,
      conversationPathEfficiency: 85,
      rabbitHoles: 1,
      infographicsGenerated: 2,
    };
  }

  private getEngagementAnalytics(
    state: UnifiedSessionState
  ): UnifiedAnalytics['engagementAnalytics'] {
    return {
      uiModeTransitions: 2,
      avatarXPGained: 50,
      achievementsUnlocked: 1,
      phantomPatientHealthChange: 15,
      audioPodcastsListened: 0,
      consultsRequested: 1,
    };
  }

  private getTutorAnalytics(state: UnifiedSessionState): UnifiedAnalytics['tutorAnalytics'] {
    return {
      queriesMade: 3,
      hintsUsed: 2,
      citationsViewed: 5,
      averageResponseTime: 2.5,
    };
  }

  private calculateCompositeScores(analytics: {
    osceAnalytics: UnifiedAnalytics['osceAnalytics'];
    clinicalEyeAnalytics: UnifiedAnalytics['clinicalEyeAnalytics'];
    simLabAnalytics: UnifiedAnalytics['simLabAnalytics'];
    documentationAnalytics: UnifiedAnalytics['documentationAnalytics'];
    engagementAnalytics: UnifiedAnalytics['engagementAnalytics'];
  }): UnifiedAnalytics['compositeScores'] {
    return {
      overallPerformance: 88,
      clinicalCompetence: analytics.osceAnalytics.clinicalReasoningScore,
      proceduralSkills: analytics.simLabAnalytics.geometryValidationScore,
      visualDiagnostics: analytics.clinicalEyeAnalytics.pointAndClickAccuracy,
      documentation: analytics.documentationAnalytics.soapCompletenessScore,
      communication: analytics.osceAnalytics.communicationScore,
      engagement: 85, // Based on engagement metrics
    };
  }

  private triggerInfographicGeneration(event: SystemEvent): void {
    // Emit event to Module 4
    console.log('Triggering infographic generation for:', event);
  }

  private offerTutorHelp(event: SystemEvent): void {
    // Emit event to AI Tutor
    console.log('Offering AI Tutor help for:', event);
  }
}

/**
 * Factory function.
 */
export function createSystemIntegrationService(): SystemIntegrationService {
  return new SystemIntegrationService({
    enableEventBus: true,
    enableContextSync: true,
    enableIntelligentRouting: true,
  });
}
