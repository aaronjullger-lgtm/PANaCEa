/**
 * Session Context Service
 * 
 * Captures environmental context for study sessions:
 * - Screen size (from window.screen API)
 * - Connection type (from navigator.connection API)
 * - Likely context inference (commute, home, library, etc.)
 * 
 * This data is used for:
 * - Adaptive difficulty based on device
 * - Context-aware scheduling (avoid mobile-heavy reviews on desktop)
 * - Circadian analysis (e.g., late-night mobile usage)
 * - Performance correlation (how does environment affect accuracy?)
 */

/**
 * Connection type from navigator.connection API
 */
export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown';

/**
 * Inferred study context
 */
export type StudyContext = 'commute' | 'home' | 'library' | 'work' | 'unknown';

/**
 * Session context data
 */
export interface SessionContext {
  /** Screen resolution as "WIDTHxHEIGHT" */
  screenSize: string;
  /** Connection type */
  connectionType: ConnectionType;
  /** Inferred likely context */
  likelyContext: StudyContext;
  /** Whether this is likely a quick session (< 10 questions) */
  isQuickSession: boolean;
  /** Device type */
  deviceType: 'desktop' | 'tablet' | 'mobile';
  /** Browser name */
  browserName: string;
  /** Timezone */
  timezone: string;
  /** Time of day when session started */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

/**
 * Get screen size from window.screen API
 */
export function getScreenSize(): string {
  try {
    if (typeof window !== 'undefined' && window.screen) {
      const { width, height } = window.screen;
      return `${width}x${height}`;
    }
  } catch (error) {
    console.warn('[sessionService] Failed to get screen size:', error);
  }
  return 'unknown';
}

/**
 * Get connection type from navigator.connection API
 */
export function getConnectionType(): ConnectionType {
  try {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        const effectiveType = connection.effectiveType;
        const type = connection.type;
        
        // Check explicit type first
        if (type === 'wifi') return 'wifi';
        if (type === 'ethernet') return 'ethernet';
        if (type === 'cellular' || type === 'wimax') return 'cellular';
        
        // Fallback to effectiveType (4g, 3g, 2g, slow-2g)
        if (effectiveType === '4g' || effectiveType === '3g' || effectiveType === '2g' || effectiveType === 'slow-2g') {
          return 'cellular';
        }
      }
    }
  } catch (error) {
    console.warn('[sessionService] Failed to get connection type:', error);
  }
  return 'unknown';
}

/**
 * Detect device type from screen size and user agent
 */
export function getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  try {
    const ua = navigator.userAgent.toLowerCase();
    const width = window.screen?.width || 0;
    
    // Check user agent first for explicit device indicators
    if (/ipad|tablet|kindle|playbook|silk/.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) return 'mobile';
    
    // Fallback to screen width
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  } catch (error) {
    console.warn('[sessionService] Failed to detect device type:', error);
    return 'desktop';
  }
}

/**
 * Detect browser name
 */
export function getBrowserName(): string {
  try {
    const ua = navigator.userAgent;
    
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    
    return 'Other';
  } catch (error) {
    console.warn('[sessionService] Failed to detect browser:', error);
    return 'Unknown';
  }
}

/**
 * Get current timezone
 */
export function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('[sessionService] Failed to get timezone:', error);
    return 'UTC';
  }
}

/**
 * Get time of day category
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Infer likely study context from environmental signals
 * 
 * Heuristics:
 * - Mobile + Cellular → Likely commute
 * - Mobile + Late night → Likely home (bed)
 * - Desktop + Daytime → Likely work/library
 * - Tablet + Afternoon → Could be home or library
 * - Mobile + Quick session → Likely commute or break
 */
export function inferStudyContext(
  deviceType: 'desktop' | 'tablet' | 'mobile',
  connectionType: ConnectionType,
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
  isQuickSession: boolean
): StudyContext {
  // Strong signal: Mobile + cellular → commute
  if (deviceType === 'mobile' && connectionType === 'cellular') {
    return 'commute';
  }
  
  // Strong signal: Desktop + daytime + wifi → work/library
  if (deviceType === 'desktop' && (timeOfDay === 'morning' || timeOfDay === 'afternoon')) {
    return 'work';
  }
  
  // Strong signal: Late night → home
  if (timeOfDay === 'night') {
    return 'home';
  }
  
  // Moderate signal: Mobile + quick session → commute/break
  if (deviceType === 'mobile' && isQuickSession) {
    return 'commute';
  }
  
  // Moderate signal: Desktop + evening → home
  if (deviceType === 'desktop' && timeOfDay === 'evening') {
    return 'home';
  }
  
  // Moderate signal: Tablet + afternoon → library
  if (deviceType === 'tablet' && timeOfDay === 'afternoon') {
    return 'library';
  }
  
  // Default: unknown
  return 'unknown';
}

/**
 * Capture full session context
 */
export function captureSessionContext(isQuickSession: boolean = false): SessionContext {
  const screenSize = getScreenSize();
  const connectionType = getConnectionType();
  const deviceType = getDeviceType();
  const browserName = getBrowserName();
  const timezone = getTimezone();
  const timeOfDay = getTimeOfDay();
  
  const likelyContext = inferStudyContext(
    deviceType,
    connectionType,
    timeOfDay,
    isQuickSession
  );
  
  return {
    screenSize,
    connectionType,
    likelyContext,
    isQuickSession,
    deviceType,
    browserName,
    timezone,
    timeOfDay,
  };
}

/**
 * Check if session was likely interrupted
 * (large gaps between questions suggest interruption)
 */
export function detectInterruption(questionTimestamps: number[]): boolean {
  if (questionTimestamps.length < 2) return false;
  
  const INTERRUPTION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  
  for (let i = 1; i < questionTimestamps.length; i++) {
    const gap = questionTimestamps[i] - questionTimestamps[i - 1];
    if (gap > INTERRUPTION_THRESHOLD_MS) {
      return true;
    }
  }
  
  return false;
}

/**
 * Format context for logging/debugging
 */
export function formatSessionContext(context: SessionContext): string {
  return [
    `Device: ${context.deviceType}`,
    `Screen: ${context.screenSize}`,
    `Connection: ${context.connectionType}`,
    `Context: ${context.likelyContext}`,
    `Time: ${context.timeOfDay}`,
    `Quick: ${context.isQuickSession ? 'Yes' : 'No'}`,
  ].join(' | ');
}

export default {
  captureSessionContext,
  getScreenSize,
  getConnectionType,
  getDeviceType,
  getBrowserName,
  getTimezone,
  getTimeOfDay,
  inferStudyContext,
  detectInterruption,
  formatSessionContext,
};
