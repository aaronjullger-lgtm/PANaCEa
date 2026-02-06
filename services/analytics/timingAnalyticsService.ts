/**
 * Timing Analytics Service (echoscript + echo_paths)
 * 
 * Captures and analyzes clinical timing metrics during OSCE sessions.
 * Tracks decision-making pathways and identifies efficient vs. wasteful questioning.
 * 
 * Features:
 * - Time-to-action metrics (e.g., "Time to antibiotics")
 * - Conversation tree visualization (echo_paths)
 * - Rabbit hole detection
 * - Optimal path comparison
 * - Performance milestones
 * 
 * @module timingAnalyticsService
 */

import type {
  TimingMetric,
  EchoPath,
  EchoPathNode,
  SessionTimingAnalytics,
} from '@/types/smart-scribe-system';

interface TimingAnalyticsConfig {
  enableRealTimeTracking: boolean;
  captureTranscript: boolean;
}

export class TimingAnalyticsService {
  private activeSessions: Map<string, SessionTimingAnalytics> = new Map();
  private config: TimingAnalyticsConfig;

  constructor(config: TimingAnalyticsConfig = { enableRealTimeTracking: true, captureTranscript: true }) {
    this.config = config;
  }

  /**
   * Start timing analytics for a session.
   */
  startSession(sessionId: string, caseId: string): void {
    const analytics: SessionTimingAnalytics = {
      sessionId,
      metrics: [],
      echoPath: {
        id: `path-${sessionId}`,
        sessionId,
        nodes: [],
        optimalPath: [],
        actualPath: [],
        efficiencyScore: 0,
        rabbitHoles: [],
        criticalPathsCovered: [],
        criticalPathsMissed: [],
        visualization: {
          layout: 'tree',
          nodePositions: {},
          edgeList: [],
        },
      },
      milestones: [],
      timeline: [],
      summary: {
        totalDuration: 0,
        efficientlySpent: 0,
        wastefullySpent: 0,
        criticalActionsTimeliness: 0,
        questioningEfficiency: 0,
      },
    };

    this.activeSessions.set(sessionId, analytics);

    // Start initial milestone
    this.recordMilestone(sessionId, 'Session Start');
  }

  /**
   * Start a timing metric.
   */
  startMetric(
    sessionId: string,
    name: string,
    type: TimingMetric['type'],
    significance: TimingMetric['significance'] = 'routine',
    targetDuration?: number
  ): string {
    const analytics = this.activeSessions.get(sessionId);
    if (!analytics) throw new Error(`No active session: ${sessionId}`);

    const metric: TimingMetric = {
      id: `metric-${Date.now()}`,
      type,
      name,
      startTime: new Date().toISOString(),
      status: 'in_progress',
      significance,
      targetDuration,
      description: `${type}: ${name}`,
    };

    analytics.metrics.push(metric);

    return metric.id;
  }

  /**
   * End a timing metric.
   */
  endMetric(sessionId: string, metricId: string): void {
    const analytics = this.activeSessions.get(sessionId);
    if (!analytics) return;

    const metric = analytics.metrics.find((m) => m.id === metricId);
    if (!metric) return;

    metric.endTime = new Date().toISOString();
    metric.duration =
      (new Date(metric.endTime).getTime() - new Date(metric.startTime).getTime()) / 1000;

    // Check if exceeded target
    if (metric.targetDuration && metric.duration > metric.targetDuration) {
      metric.status = 'exceeded_target';
    } else {
      metric.status = 'completed';
    }

    // Add to timeline
    analytics.timeline.push({
      timestamp: metric.startTime,
      event: metric.name,
      duration: metric.duration,
      category: this.getTimelineCategory(metric.type),
    });
  }

  /**
   * Record a conversation node (question or action).
   */
  recordConversationNode(
    sessionId: string,
    type: EchoPathNode['type'],
    content: string,
    parentId?: string,
    relevanceScore: number = 0.5
  ): string {
    const analytics = this.activeSessions.get(sessionId);
    if (!analytics) throw new Error(`No active session: ${sessionId}`);

    const node: EchoPathNode = {
      id: `node-${Date.now()}`,
      type,
      content,
      timestamp: new Date().toISOString(),
      parentId,
      childrenIds: [],
      relevanceScore,
      isOptimalPath: false, // Will be determined during analysis
      timeSpent: 0,
    };

    // Add to parent's children
    if (parentId) {
      const parent = analytics.echoPath.nodes.find((n) => n.id === parentId);
      if (parent) {
        parent.childrenIds.push(node.id);
      }
    }

    analytics.echoPath.nodes.push(node);
    analytics.echoPath.actualPath.push(node.id);

    return node.id;
  }

  /**
   * Record a milestone.
   */
  recordMilestone(
    sessionId: string,
    name: string,
    target?: number,
    achieved: boolean = true
  ): void {
    const analytics = this.activeSessions.get(sessionId);
    if (!analytics) return;

    const sessionStart = analytics.milestones[0]?.timestamp || new Date().toISOString();
    const elapsed = (new Date().getTime() - new Date(sessionStart).getTime()) / 1000;

    analytics.milestones.push({
      name,
      timestamp: new Date().toISOString(),
      elapsed,
      target,
      achieved,
    });
  }

  /**
   * End session and generate final analytics.
   */
  async endSession(sessionId: string): Promise<SessionTimingAnalytics> {
    const analytics = this.activeSessions.get(sessionId);
    if (!analytics) throw new Error(`No active session: ${sessionId}`);

    // Record final milestone
    this.recordMilestone(sessionId, 'Session End');

    // Calculate total duration
    const firstMilestone = analytics.milestones[0];
    const lastMilestone = analytics.milestones[analytics.milestones.length - 1];
    
    if (firstMilestone && lastMilestone) {
      analytics.summary.totalDuration =
        (new Date(lastMilestone.timestamp).getTime() - new Date(firstMilestone.timestamp).getTime()) / 1000;
    }

    // Analyze conversation path
    await this.analyzeEchoPath(sessionId);

    // Calculate summary metrics
    this.calculateSummary(analytics);

    return analytics;
  }

  /**
   * Get real-time analytics snapshot.
   */
  getSnapshot(sessionId: string): SessionTimingAnalytics | null {
    return this.activeSessions.get(sessionId) ?? null;
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Analyze echo path to identify optimal path and rabbit holes.
   */
  private async analyzeEchoPath(sessionId: string): Promise<void> {
    const analytics = this.activeSessions.get(sessionId);
    if (!analytics) return;

    const echoPath = analytics.echoPath;

    // Determine optimal path based on relevance scores
    const optimalPath = this.findOptimalPath(echoPath.nodes);
    echoPath.optimalPath = optimalPath;

    // Mark optimal nodes
    for (const nodeId of optimalPath) {
      const node = echoPath.nodes.find((n) => n.id === nodeId);
      if (node) node.isOptimalPath = true;
    }

    // Detect rabbit holes (low-relevance branches)
    echoPath.rabbitHoles = this.detectRabbitHoles(echoPath.nodes);

    // Calculate efficiency score
    const optimalSteps = optimalPath.length;
    const actualSteps = echoPath.actualPath.length;
    echoPath.efficiencyScore = Math.round((optimalSteps / actualSteps) * 100);

    // Generate visualization
    echoPath.visualization = this.generateVisualization(echoPath.nodes);
  }

  /**
   * Find optimal path through conversation tree.
   */
  private findOptimalPath(nodes: EchoPathNode[]): string[] {
    if (nodes.length === 0) return [];

    // Start with root node
    const root = nodes.find((n) => !n.parentId);
    if (!root) return [];

    const path: string[] = [root.id];

    // Greedily select highest relevance child at each step
    let currentNode = root;
    while (currentNode.childrenIds.length > 0) {
      const children = currentNode.childrenIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is EchoPathNode => !!n);

      if (children.length === 0) break;

      // Select child with highest relevance
      children.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const bestChild = children[0];

      path.push(bestChild.id);
      currentNode = bestChild;
    }

    return path;
  }

  /**
   * Detect rabbit holes (unproductive question branches).
   */
  private detectRabbitHoles(nodes: EchoPathNode[]): EchoPath['rabbitHoles'] {
    const rabbitHoles: EchoPath['rabbitHoles'] = [];

    for (const node of nodes) {
      // Skip if on optimal path
      if (node.isOptimalPath) continue;

      // If relevance < 0.3, consider it a rabbit hole
      if (node.relevanceScore < 0.3) {
      // Find the subtree from this node
      const subtree = this.getSubtree(node, nodes);
      const timeWasted = subtree.reduce((sum, n) => sum + n.timeSpent, 0);

      if (timeWasted > 10) {
        // > 10 seconds wasted
        const lastNode = subtree[subtree.length - 1];
        rabbitHoles.push({
          startNodeId: node.id,
          endNodeId: lastNode ? lastNode.id : node.id,
          timeWasted,
          reason: this.identifyRabbitHoleReason(node),
        });
      }
      }
    }

    return rabbitHoles;
  }

  /**
   * Get subtree starting from a node.
   */
  private getSubtree(node: EchoPathNode, allNodes: EchoPathNode[]): EchoPathNode[] {
    const subtree: EchoPathNode[] = [node];

    for (const childId of node.childrenIds) {
      const child = allNodes.find((n) => n.id === childId);
      if (child) {
        subtree.push(...this.getSubtree(child, allNodes));
      }
    }

    return subtree;
  }

  /**
   * Identify reason for rabbit hole.
   */
  private identifyRabbitHoleReason(node: EchoPathNode): string {
    // Simple heuristics
    if (node.content.toLowerCase().includes('family history') && node.relevanceScore < 0.3) {
      return 'Excessive focus on non-critical family history';
    }
    if (node.content.toLowerCase().includes('diet') || node.content.toLowerCase().includes('exercise')) {
      return 'Excessive focus on lifestyle factors when critical findings needed';
    }
    return 'Low-relevance questioning';
  }

  /**
   * Generate visualization data for conversation tree.
   */
  private generateVisualization(
    nodes: EchoPathNode[]
  ): EchoPath['visualization'] {
    // Simple tree layout algorithm
    const nodePositions: Record<string, { x: number; y: number }> = {};
    const edgeList: Array<{ from: string; to: string; weight: number }> = [];

    // Assign positions (simple vertical tree)
    let y = 0;
    for (const node of nodes) {
      const level = this.getNodeLevel(node, nodes);
      nodePositions[node.id] = { x: level * 100, y: y * 80 };
      y++;

      // Add edges
      if (node.parentId) {
        edgeList.push({
          from: node.parentId,
          to: node.id,
          weight: node.relevanceScore,
        });
      }
    }

    return {
      layout: 'tree',
      nodePositions,
      edgeList,
    };
  }

  /**
   * Get node level in tree (depth from root).
   */
  private getNodeLevel(node: EchoPathNode, allNodes: EchoPathNode[]): number {
    let level = 0;
    let current = node;

    while (current.parentId) {
      level++;
      const parent = allNodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      current = parent;
    }

    return level;
  }

  /**
   * Calculate summary metrics.
   */
  private calculateSummary(analytics: SessionTimingAnalytics): void {
    // Calculate time spent efficiently vs. wastefully
    const efficientTime = analytics.echoPath.nodes
      .filter((n) => n.isOptimalPath)
      .reduce((sum, n) => sum + n.timeSpent, 0);

    const wastefulTime = analytics.echoPath.rabbitHoles.reduce(
      (sum, rh) => sum + rh.timeWasted,
      0
    );

    analytics.summary.efficientlySpent = efficientTime;
    analytics.summary.wastefullySpent = wastefulTime;

    // Calculate critical actions timeliness
    const criticalMetrics = analytics.metrics.filter((m) => m.significance === 'critical');
    const onTimeMetrics = criticalMetrics.filter(
      (m) => m.status === 'completed' && (!m.targetDuration || m.duration! <= m.targetDuration)
    );

    analytics.summary.criticalActionsTimeliness =
      criticalMetrics.length > 0
        ? Math.round((onTimeMetrics.length / criticalMetrics.length) * 100)
        : 100;

    // Questioning efficiency (from echo path)
    analytics.summary.questioningEfficiency = analytics.echoPath.efficiencyScore;
  }

  /**
   * Get timeline category from metric type.
   */
  private getTimelineCategory(
    type: TimingMetric['type']
  ): SessionTimingAnalytics['timeline'][0]['category'] {
    switch (type) {
      case 'recognition':
      case 'diagnosis':
      case 'decision':
        return 'decision';
      case 'action':
      case 'intervention':
        return 'action';
      case 'communication':
        return 'question';
      default:
        return 'system';
    }
  }
}

/**
 * Factory function.
 */
export function createTimingAnalyticsService(): TimingAnalyticsService {
  return new TimingAnalyticsService();
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Track STEMI case timing.
 */
export async function trackSTEMICase(service: TimingAnalyticsService, sessionId: string): Promise<void> {
  // Start session
  service.startSession(sessionId, 'stemi-case-001');

  // Start recognition metric
  const recognitionMetric = service.startMetric(
    sessionId,
    'Time to recognize STEMI',
    'recognition',
    'critical',
    60 // Target: 60 seconds
  );

  // Record questions
  const node1 = service.recordConversationNode(
    sessionId,
    'question',
    'What brings you in today?',
    undefined,
    0.9 // High relevance
  );

  const node2 = service.recordConversationNode(
    sessionId,
    'question',
    'Can you describe the chest pain?',
    node1,
    0.95
  );

  // Student asks about diet (rabbit hole)
  const node3 = service.recordConversationNode(
    sessionId,
    'question',
    'What does your typical diet look like?',
    node2,
    0.2 // Low relevance for acute chest pain
  );

  // Recognize STEMI
  service.endMetric(sessionId, recognitionMetric);
  service.recordMilestone(sessionId, 'STEMI Recognized', 60, true);

  // Start action metric
  const actionMetric = service.startMetric(
    sessionId,
    'Time to ECG order',
    'action',
    'critical',
    10 // Target: 10 minutes
  );

  // ... more actions ...

  // End session
  const analytics = await service.endSession(sessionId);
  console.log('Efficiency Score:', analytics.echoPath.efficiencyScore);
  console.log('Rabbit Holes:', analytics.echoPath.rabbitHoles);
}
