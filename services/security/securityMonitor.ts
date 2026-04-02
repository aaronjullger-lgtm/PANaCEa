/**
 * Security Monitoring Service for PANaCEa
 *
 * Features:
 * 1. Centralized security event logging
 * 2. Real-time alerting for security events
 * 3. Anomaly detection for suspicious patterns
 * 4. Integration with rate limiting and authentication systems
 * 5. Audit trail for compliance requirements
 *
 * Usage:
 *   const monitor = getSecurityMonitor();
 *   await monitor.recordEvent('rate_limit', {
 *     userId: 'user_123',
 *     ipAddress: '192.168.1.1',
 *     endpoint: '/api/gemini',
 *     limitType: 'gemini',
 *   });
 */

import { AppError, ErrorCategory, ErrorCode } from '@/lib/errors/appError';

// Security event types
export enum SecurityEventType {
  // Authentication events
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_BRUTE_FORCE = 'auth_brute_force',
  AUTH_SUSPICIOUS = 'auth_suspicious',

  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  RATE_LIMIT_BURST = 'rate_limit_burst',
  RATE_LIMIT_COST_EXCEEDED = 'rate_limit_cost_exceeded',

  // API security events
  API_ABUSE = 'api_abuse',
  API_INJECTION_ATTEMPT = 'api_injection_attempt',
  API_MALFORMED_REQUEST = 'api_malformed_request',

  // Content security events
  CONTENT_MODIFICATION = 'content_modification',
  CONTENT_UNAUTHORIZED_ACCESS = 'content_unauthorized_access',
  CONTENT_POLICY_VIOLATION = 'content_policy_violation',

  // User behavior events
  USER_SUSPICIOUS_ACTIVITY = 'user_suspicious_activity',
  USER_GEOGRAPHIC_ANOMALY = 'user_geographic_anomaly',
  USER_DEVICE_CHANGE = 'user_device_change',

  // System security events
  SYSTEM_CONFIG_CHANGE = 'system_config_change',
  SYSTEM_SECURITY_ALERT = 'system_security_alert',
  SYSTEM_COMPLIANCE_VIOLATION = 'system_compliance_violation',
}

// Event severity levels
export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Security event interface
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: Date;

  // Actor information
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geographicLocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };

  // Event details
  endpoint?: string;
  method?: string;
  resourceId?: string;
  resourceType?: string;
  details: Record<string, any>;

  // Response information
  statusCode?: number;
  responseTime?: number;
  errorMessage?: string;

  // Alert information
  alerted: boolean;
  alertSentAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

// Alert configuration
export interface SecurityAlertConfig {
  enabled: boolean;
  severityThreshold: SecurityEventSeverity;
  notificationChannels: NotificationChannel[];
  cooldownMinutes: number;
  maxAlertsPerHour: number;
}

// Notification channel types
export enum NotificationChannel {
  CONSOLE = 'console',
  SLACK = 'slack',
  EMAIL = 'email',
  PAGERDUTY = 'pagerduty',
  WEBHOOK = 'webhook',
}

// Anomaly detection rule
export interface AnomalyDetectionRule {
  id: string;
  name: string;
  description: string;
  eventType: SecurityEventType;
  condition: (event: SecurityEvent, history: SecurityEvent[]) => boolean;
  severity: SecurityEventSeverity;
  cooldownMinutes: number;
  enabled: boolean;
}

/**
 * Security Monitor Class
 */
export class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private alerts: SecurityEvent[] = [];
  private anomalyRules: AnomalyDetectionRule[] = [];
  private alertConfig: SecurityAlertConfig;

  // Event type to severity mapping
  private readonly defaultSeverityMapping: Record<SecurityEventType, SecurityEventSeverity> = {
    [SecurityEventType.AUTH_SUCCESS]: SecurityEventSeverity.LOW,
    [SecurityEventType.AUTH_FAILURE]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.AUTH_BRUTE_FORCE]: SecurityEventSeverity.HIGH,
    [SecurityEventType.AUTH_SUSPICIOUS]: SecurityEventSeverity.HIGH,
    [SecurityEventType.RATE_LIMIT_EXCEEDED]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.RATE_LIMIT_BURST]: SecurityEventSeverity.HIGH,
    [SecurityEventType.RATE_LIMIT_COST_EXCEEDED]: SecurityEventSeverity.CRITICAL,
    [SecurityEventType.API_ABUSE]: SecurityEventSeverity.HIGH,
    [SecurityEventType.API_INJECTION_ATTEMPT]: SecurityEventSeverity.CRITICAL,
    [SecurityEventType.API_MALFORMED_REQUEST]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.CONTENT_MODIFICATION]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.CONTENT_UNAUTHORIZED_ACCESS]: SecurityEventSeverity.HIGH,
    [SecurityEventType.CONTENT_POLICY_VIOLATION]: SecurityEventSeverity.HIGH,
    [SecurityEventType.USER_SUSPICIOUS_ACTIVITY]: SecurityEventSeverity.HIGH,
    [SecurityEventType.USER_GEOGRAPHIC_ANOMALY]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.USER_DEVICE_CHANGE]: SecurityEventSeverity.LOW,
    [SecurityEventType.SYSTEM_CONFIG_CHANGE]: SecurityEventSeverity.MEDIUM,
    [SecurityEventType.SYSTEM_SECURITY_ALERT]: SecurityEventSeverity.HIGH,
    [SecurityEventType.SYSTEM_COMPLIANCE_VIOLATION]: SecurityEventSeverity.CRITICAL,
  };

  constructor(config?: Partial<SecurityAlertConfig>) {
    this.alertConfig = {
      enabled: true,
      severityThreshold: SecurityEventSeverity.HIGH,
      notificationChannels: [NotificationChannel.CONSOLE],
      cooldownMinutes: 5,
      maxAlertsPerHour: 10,
      ...config,
    };

    this.initializeAnomalyRules();
  }

  /**
   * Record a security event
   */
  async recordEvent(
    type: SecurityEventType,
    details: Record<string, any>,
    options: {
      severity?: SecurityEventSeverity;
      userId?: string;
      userEmail?: string;
      userRole?: string;
      ipAddress?: string;
      userAgent?: string;
      endpoint?: string;
      method?: string;
      resourceId?: string;
      resourceType?: string;
      statusCode?: number;
      responseTime?: number;
      errorMessage?: string;
    } = {}
  ): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type,
      severity:
        options.severity || this.defaultSeverityMapping[type] || SecurityEventSeverity.MEDIUM,
      timestamp: new Date(),
      userId: options.userId,
      userEmail: options.userEmail,
      userRole: options.userRole,
      ipAddress: options.ipAddress || 'unknown',
      userAgent: options.userAgent,
      endpoint: options.endpoint,
      method: options.method,
      resourceId: options.resourceId,
      resourceType: options.resourceType,
      details,
      statusCode: options.statusCode,
      responseTime: options.responseTime,
      errorMessage: options.errorMessage,
      alerted: false,
      resolved: false,
    };

    // Add geographic information if IP is available
    if (options.ipAddress && options.ipAddress !== 'unknown') {
      event.geographicLocation = await this.getGeographicInfo(options.ipAddress);
    }

    // Add device fingerprint if user agent is available
    if (options.userAgent) {
      event.deviceFingerprint = this.generateDeviceFingerprint(options.userAgent);
    }

    // Store the event
    this.events.push(event);

    // Check for anomalies
    await this.checkForAnomalies(event);

    // Check if alert should be sent
    if (this.shouldSendAlert(event)) {
      await this.sendAlert(event);
    }

    // Clean up old events (keep last 10,000 events)
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }

    // In production, this would persist to database
    console.log('Security event recorded:', {
      id: event.id,
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      endpoint: event.endpoint,
    });

    return event;
  }

  /**
   * Get events with filtering
   */
  getEvents(filters?: {
    type?: SecurityEventType;
    severity?: SecurityEventSeverity;
    userId?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let filtered = [...this.events];

    if (filters?.type) {
      filtered = filtered.filter((e) => e.type === filters.type);
    }

    if (filters?.severity) {
      filtered = filtered.filter((e) => e.severity === filters.severity);
    }

    if (filters?.userId) {
      filtered = filtered.filter((e) => e.userId === filters.userId);
    }

    if (filters?.ipAddress) {
      filtered = filtered.filter((e) => e.ipAddress === filters.ipAddress);
    }

    if (filters?.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= filters.endDate!);
    }

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get alerts (events that triggered alerts)
   */
  getAlerts(filters?: {
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let filtered = [...this.alerts];

    if (filters?.resolved !== undefined) {
      filtered = filtered.filter((e) => e.resolved === filters.resolved);
    }

    if (filters?.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= filters.endDate!);
    }

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(eventId: string, resolution: string): Promise<void> {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.resolved = true;
      event.resolvedAt = new Date();
      event.resolution = resolution;

      // Also update in alerts array
      const alertIndex = this.alerts.findIndex((a) => a.id === eventId);
      if (alertIndex !== -1) {
        this.alerts[alertIndex] = { ...event };
      }

      console.log('Alert resolved:', { eventId, resolution });
    }
  }

  /**
   * Get security statistics
   */
  getStatistics(timeframeHours: number = 24): {
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecurityEventSeverity, number>;
    topUsers: Array<{ userId: string; count: number }>;
    topIPs: Array<{ ipAddress: string; count: number }>;
    alertRate: number;
  } {
    const cutoff = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
    const recentEvents = this.events.filter((e) => e.timestamp >= cutoff);

    const eventsByType: Record<SecurityEventType, number> = {} as any;
    const eventsBySeverity: Record<SecurityEventSeverity, number> = {} as any;
    const userCounts = new Map<string, number>();
    const ipCounts = new Map<string, number>();

    recentEvents.forEach((event) => {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

      // Count by user
      if (event.userId) {
        userCounts.set(event.userId, (userCounts.get(event.userId) || 0) + 1);
      }

      // Count by IP
      ipCounts.set(event.ipAddress, (ipCounts.get(event.ipAddress) || 0) + 1);
    });

    // Convert maps to sorted arrays
    const topUsers = Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topIPs = Array.from(ipCounts.entries())
      .map(([ipAddress, count]) => ({ ipAddress, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate alert rate
    const recentAlerts = this.alerts.filter((a) => a.timestamp >= cutoff);
    const alertRate = recentEvents.length > 0 ? recentAlerts.length / recentEvents.length : 0;

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      topUsers,
      topIPs,
      alertRate,
    };
  }

  /**
   * Check for suspicious patterns
   */
  async detectSuspiciousPatterns(): Promise<SecurityEvent[]> {
    const suspiciousEvents: SecurityEvent[] = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Pattern 1: Multiple auth failures from same IP
    const authFailures = this.getEvents({
      type: SecurityEventType.AUTH_FAILURE,
      startDate: oneHourAgo,
    });

    const failuresByIP = new Map<string, SecurityEvent[]>();
    authFailures.forEach((event) => {
      const ipEvents = failuresByIP.get(event.ipAddress) || [];
      ipEvents.push(event);
      failuresByIP.set(event.ipAddress, ipEvents);
    });

    for (const [ip, events] of failuresByIP.entries()) {
      if (events.length >= 5) {
        // Possible brute force attack
        const bruteForceEvent = await this.recordEvent(
          SecurityEventType.AUTH_BRUTE_FORCE,
          {
            ipAddress: ip,
            failureCount: events.length,
            userIds: events.map((e) => e.userId).filter(Boolean),
          },
          {
            ipAddress: ip,
            severity: SecurityEventSeverity.HIGH,
          }
        );
        suspiciousEvents.push(bruteForceEvent);
      }
    }

    // Pattern 2: Geographic anomalies
    const userSessions = this.getEvents({
      type: SecurityEventType.AUTH_SUCCESS,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const userLocations = new Map<string, Array<{ country?: string; timestamp: Date }>>();
    userSessions.forEach((event) => {
      if (event.userId && event.geographicLocation?.country) {
        const locations = userLocations.get(event.userId) || [];
        locations.push({
          country: event.geographicLocation.country,
          timestamp: event.timestamp,
        });
        userLocations.set(event.userId, locations);
      }
    });

    for (const [userId, locations] of userLocations.entries()) {
      if (locations.length >= 2) {
        const uniqueCountries = new Set(locations.map((l) => l.country));
        if (uniqueCountries.size > 1) {
          // User logged in from multiple countries
          const sortedLocations = locations.sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );
          const timeDiff =
            sortedLocations[sortedLocations.length - 1]!.timestamp.getTime() -
            sortedLocations[0]!.timestamp.getTime();

          // If multiple countries in less than 12 hours, flag as suspicious
          if (timeDiff < 12 * 60 * 60 * 1000) {
            const anomalyEvent = await this.recordEvent(
              SecurityEventType.USER_GEOGRAPHIC_ANOMALY,
              {
                userId,
                countries: Array.from(uniqueCountries),
                locationCount: locations.length,
                timeSpanHours: timeDiff / (60 * 60 * 1000),
              },
              {
                userId,
                severity: SecurityEventSeverity.MEDIUM,
              }
            );
            suspiciousEvents.push(anomalyEvent);
          }
        }
      }
    }

    // Pattern 3: API abuse (high request rate)
    const recentEvents = this.getEvents({ startDate: oneHourAgo });
    const requestsByUser = new Map<string, number>();
    const requestsByIP = new Map<string, number>();

    recentEvents.forEach((event) => {
      if (event.userId) {
        requestsByUser.set(event.userId, (requestsByUser.get(event.userId) || 0) + 1);
      }
      requestsByIP.set(event.ipAddress, (requestsByIP.get(event.ipAddress) || 0) + 1);
    });

    // Check for users with > 1000 requests per hour
    for (const [userId, count] of requestsByUser.entries()) {
      if (count > 1000) {
        const abuseEvent = await this.recordEvent(
          SecurityEventType.API_ABUSE,
          {
            userId,
            requestCount: count,
            timeframeHours: 1,
          },
          {
            userId,
            severity: SecurityEventSeverity.HIGH,
          }
        );
        suspiciousEvents.push(abuseEvent);
      }
    }

    // Check for IPs with > 5000 requests per hour
    for (const [ipAddress, count] of requestsByIP.entries()) {
      if (count > 5000 && ipAddress !== 'unknown') {
        const abuseEvent = await this.recordEvent(
          SecurityEventType.API_ABUSE,
          {
            ipAddress,
            requestCount: count,
            timeframeHours: 1,
          },
          {
            ipAddress,
            severity: SecurityEventSeverity.HIGH,
          }
        );
        suspiciousEvents.push(abuseEvent);
      }
    }

    return suspiciousEvents;
  }

  /**
   * Export events for compliance reporting
   */
  exportEvents(format: 'json' | 'csv' | 'pdf' = 'json'): string {
    const events = this.getEvents();

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);

      case 'csv': {
        const headers = [
          'id',
          'timestamp',
          'type',
          'severity',
          'userId',
          'ipAddress',
          'endpoint',
          'method',
          'statusCode',
        ];
        const rows = events.map((event) => [
          event.id,
          event.timestamp.toISOString(),
          event.type,
          event.severity,
          event.userId || '',
          event.ipAddress,
          event.endpoint || '',
          event.method || '',
          event.statusCode || '',
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');

        return csvContent;
      }
      case 'pdf':
        // PDF generation requires a server-side library; export as CSV instead
        return this.exportEvents('csv');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Private helper methods
   */

  private initializeAnomalyRules(): void {
    this.anomalyRules = [
      {
        id: 'rule-001',
        name: 'Rapid Authentication Failures',
        description: 'Multiple authentication failures from same IP in short timeframe',
        eventType: SecurityEventType.AUTH_FAILURE,
        condition: (event, history) => {
          const recentFailures = history.filter(
            (e) =>
              e.type === SecurityEventType.AUTH_FAILURE &&
              e.ipAddress === event.ipAddress &&
              e.timestamp.getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
          );
          return recentFailures.length >= 3;
        },
        severity: SecurityEventSeverity.HIGH,
        cooldownMinutes: 5,
        enabled: true,
      },
      {
        id: 'rule-002',
        name: 'Cost Limit Exceeded',
        description: 'AI API cost limit exceeded for user',
        eventType: SecurityEventType.RATE_LIMIT_COST_EXCEEDED,
        condition: () => true, // Always trigger for cost exceeded
        severity: SecurityEventSeverity.CRITICAL,
        cooldownMinutes: 60,
        enabled: true,
      },
      {
        id: 'rule-003',
        name: 'Injection Attempt',
        description: 'Potential SQL or code injection attempt detected',
        eventType: SecurityEventType.API_INJECTION_ATTEMPT,
        condition: () => true,
        severity: SecurityEventSeverity.CRITICAL,
        cooldownMinutes: 0,
        enabled: true,
      },
    ];
  }

  private async checkForAnomalies(event: SecurityEvent): Promise<void> {
    for (const rule of this.anomalyRules) {
      if (!rule.enabled || rule.eventType !== event.type) continue;

      // Check cooldown
      const lastAlert = this.alerts
        .filter((a) => a.details.ruleId === rule.id)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (
        lastAlert &&
        lastAlert.timestamp.getTime() > Date.now() - rule.cooldownMinutes * 60 * 1000
      ) {
        continue; // Still in cooldown period
      }

      // Check condition
      const recentEvents = this.getEvents({
        startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      });

      if (rule.condition(event, recentEvents)) {
        // Create anomaly event
        const anomalyEvent = await this.recordEvent(
          SecurityEventType.SYSTEM_SECURITY_ALERT,
          {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleDescription: rule.description,
            triggeredByEvent: event.id,
          },
          {
            severity: rule.severity,
            userId: event.userId,
            ipAddress: event.ipAddress,
            endpoint: event.endpoint,
          }
        );

        // Mark as alerted
        anomalyEvent.alerted = true;
        anomalyEvent.alertSentAt = new Date();
        this.alerts.push(anomalyEvent);
      }
    }
  }

  private shouldSendAlert(event: SecurityEvent): boolean {
    if (!this.alertConfig.enabled) return false;

    // Check severity threshold
    const severityOrder = {
      [SecurityEventSeverity.LOW]: 0,
      [SecurityEventSeverity.MEDIUM]: 1,
      [SecurityEventSeverity.HIGH]: 2,
      [SecurityEventSeverity.CRITICAL]: 3,
    };

    if (severityOrder[event.severity] < severityOrder[this.alertConfig.severityThreshold]) {
      return false;
    }

    // Check rate limiting
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlerts = this.alerts.filter((a) => a.timestamp >= oneHourAgo);
    if (recentAlerts.length >= this.alertConfig.maxAlertsPerHour) {
      return false;
    }

    // Check cooldown for similar events
    const similarRecentAlerts = this.alerts.filter(
      (a) =>
        a.type === event.type &&
        a.userId === event.userId &&
        a.ipAddress === event.ipAddress &&
        a.timestamp.getTime() > Date.now() - this.alertConfig.cooldownMinutes * 60 * 1000
    );

    return similarRecentAlerts.length === 0;
  }

  private async sendAlert(event: SecurityEvent): Promise<void> {
    event.alerted = true;
    event.alertSentAt = new Date();
    this.alerts.push(event);

    const alertMessage = this.formatAlertMessage(event);

    for (const channel of this.alertConfig.notificationChannels) {
      try {
        switch (channel) {
          case NotificationChannel.CONSOLE:
            console.warn('SECURITY ALERT:', alertMessage);
            break;

          case NotificationChannel.SLACK:
            await this.sendSlackAlert(alertMessage, event);
            break;

          case NotificationChannel.EMAIL:
            await this.sendEmailAlert(alertMessage, event);
            break;

          case NotificationChannel.PAGERDUTY:
            await this.sendPagerDutyAlert(alertMessage, event);
            break;

          case NotificationChannel.WEBHOOK:
            await this.sendWebhookAlert(alertMessage, event);
            break;
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel}:`, error);
      }
    }
  }

  private formatAlertMessage(event: SecurityEvent): string {
    return `[${event.severity.toUpperCase()}] ${event.type}
Time: ${event.timestamp.toISOString()}
User: ${event.userId || 'Unknown'}
IP: ${event.ipAddress}
Endpoint: ${event.endpoint || 'Unknown'}
Details: ${JSON.stringify(event.details, null, 2)}`;
  }

  private async sendSlackAlert(message: string, event: SecurityEvent): Promise<void> {
    // In production, this would call Slack webhook
    console.log('Slack alert (simulated):', message);
  }

  private async sendEmailAlert(message: string, event: SecurityEvent): Promise<void> {
    // In production, this would send email
    console.log('Email alert (simulated):', message);
  }

  private async sendPagerDutyAlert(message: string, event: SecurityEvent): Promise<void> {
    // In production, this would call PagerDuty API
    console.log('PagerDuty alert (simulated):', message);
  }

  private async sendWebhookAlert(message: string, event: SecurityEvent): Promise<void> {
    // In production, this would call configured webhook
    console.log('Webhook alert (simulated):', message);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getGeographicInfo(ipAddress: string): Promise<SecurityEvent['geographicLocation']> {
    // In production, this would use a geo-IP service
    // For now, return mock data
    return {
      country: 'US',
      region: 'California',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194,
    };
  }

  private generateDeviceFingerprint(userAgent: string): string {
    // Simple fingerprint based on user agent (Node crypto; use Web Crypto in edge if needed)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hash = require('crypto').createHash('md5').update(userAgent).digest('hex');
    return `device_${hash.substr(0, 16)}`;
  }
}

/**
 * Singleton instance
 */
let securityMonitorInstance: SecurityMonitor | null = null;

export function getSecurityMonitor(config?: Partial<SecurityAlertConfig>): SecurityMonitor {
  if (!securityMonitorInstance) {
    securityMonitorInstance = new SecurityMonitor(config);
  }
  return securityMonitorInstance;
}

/**
 * Helper functions for common security monitoring tasks
 */

export async function recordAuthEvent(
  type: SecurityEventType.AUTH_SUCCESS | SecurityEventType.AUTH_FAILURE,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  ipAddress?: string,
  userAgent?: string,
  details: Record<string, any> = {}
): Promise<SecurityEvent> {
  const monitor = getSecurityMonitor();
  return monitor.recordEvent(type, details, {
    userId,
    userEmail,
    userRole,
    ipAddress,
    userAgent,
    endpoint: '/api/auth',
    method: 'POST',
  });
}

export async function recordRateLimitEvent(
  type:
    | SecurityEventType.RATE_LIMIT_EXCEEDED
    | SecurityEventType.RATE_LIMIT_BURST
    | SecurityEventType.RATE_LIMIT_COST_EXCEEDED,
  userId?: string,
  ipAddress?: string,
  endpoint?: string,
  limitType?: string,
  details: Record<string, any> = {}
): Promise<SecurityEvent> {
  const monitor = getSecurityMonitor();
  return monitor.recordEvent(
    type,
    {
      limitType,
      ...details,
    },
    {
      userId,
      ipAddress,
      endpoint,
      method: 'GET',
    }
  );
}

export async function recordContentModification(
  userId: string,
  userRole: string,
  resourceType: string,
  resourceId: string,
  action: string,
  changes: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<SecurityEvent> {
  const monitor = getSecurityMonitor();
  return monitor.recordEvent(
    SecurityEventType.CONTENT_MODIFICATION,
    {
      resourceType,
      resourceId,
      action,
      changes,
    },
    {
      userId,
      userRole,
      ipAddress,
      userAgent,
      resourceType,
      resourceId,
      severity: SecurityEventSeverity.MEDIUM,
    }
  );
}

/**
 * Middleware for automatic security event recording
 */
export function withSecurityMonitoring() {
  return async (context: any, next: () => Promise<any>) => {
    const startTime = Date.now();

    try {
      const response = await next();
      const responseTime = Date.now() - startTime;

      // Record successful request
      if (context.auth?.userId) {
        await recordAuthEvent(
          SecurityEventType.AUTH_SUCCESS,
          context.auth.userId,
          context.auth.userEmail,
          context.auth.userRole,
          context.request.headers.get('cf-connecting-ip') || undefined,
          context.request.headers.get('user-agent') || undefined,
          {
            endpoint: new URL(context.request.url).pathname,
            method: context.request.method,
            statusCode: response.status || 200,
          }
        );
      }

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed request
      if (context.auth?.userId) {
        await recordAuthEvent(
          SecurityEventType.AUTH_FAILURE,
          context.auth.userId,
          context.auth.userEmail,
          context.auth.userRole,
          context.request.headers.get('cf-connecting-ip') || undefined,
          context.request.headers.get('user-agent') || undefined,
          {
            endpoint: new URL(context.request.url).pathname,
            method: context.request.method,
            error: error instanceof Error ? error.message : String(error),
            responseTime,
          }
        );
      }

      throw error;
    }
  };
}
