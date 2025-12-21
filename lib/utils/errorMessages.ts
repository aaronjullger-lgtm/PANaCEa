/**
 * User-Friendly Error Message Utility
 * 
 * Maps technical error messages to user-friendly strings.
 * Prevents exposing internal implementation details to users.
 */

/**
 * Known error patterns and their user-friendly messages
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp | string; message: string; suggestion?: string }> = [
  // Network/Connection errors
  { pattern: /fetch|network|connection|offline/i, message: 'Unable to connect to the server', suggestion: 'Please check your internet connection and try again.' },
  { pattern: /timeout|timed out/i, message: 'The request took too long', suggestion: 'Please try again in a moment.' },
  
  // Authentication errors
  { pattern: /unauthorized|401|auth/i, message: 'Please sign in to continue', suggestion: 'Your session may have expired.' },
  { pattern: /forbidden|403/i, message: 'You don\'t have permission to do this', suggestion: 'Contact support if you believe this is an error.' },
  
  // Rate limiting
  { pattern: /rate limit|429|too many/i, message: 'You\'ve made too many requests', suggestion: 'Please wait a moment before trying again.' },
  
  // Gemini/AI errors
  { pattern: /gemini|proxy error|ai service/i, message: 'The AI service is temporarily unavailable', suggestion: 'Please try again in a few seconds.' },
  { pattern: /empty response/i, message: 'No response received from AI', suggestion: 'Try rephrasing your question or try again.' },
  
  // Server errors
  { pattern: /500|internal server/i, message: 'Something went wrong on our end', suggestion: 'We\'re working on it. Please try again later.' },
  { pattern: /502|503|504|bad gateway|unavailable/i, message: 'The service is temporarily down', suggestion: 'Please try again in a few minutes.' },
  
  // Data errors
  { pattern: /not found|404/i, message: 'The requested content wasn\'t found', suggestion: 'It may have been removed or the link is incorrect.' },
  { pattern: /invalid|validation/i, message: 'Some information appears to be incorrect', suggestion: 'Please check your input and try again.' },
  
  // Database errors
  { pattern: /database|prisma|sql/i, message: 'Unable to save your data', suggestion: 'Please try again in a moment.' },
  
  // Challenge/Quiz specific
  { pattern: /challenge|submission/i, message: 'Unable to submit your response', suggestion: 'Your progress has been saved locally.' },
  { pattern: /load.*question|fetch.*question/i, message: 'Unable to load the question', suggestion: 'Please refresh and try again.' },
];

/**
 * Formats a technical error into a user-friendly message
 * 
 * @param error - The error to format (Error object, string, or unknown)
 * @param context - Optional context to help determine the message
 * @returns User-friendly error message object
 */
export function formatUserError(
  error: Error | string | unknown,
  context?: 'quiz' | 'challenge' | 'sync' | 'ai' | 'auth' | 'general'
): { title: string; message: string; suggestion?: string } {
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : 'An unexpected error occurred';
  
  // Check against known patterns
  for (const { pattern, message, suggestion } of ERROR_PATTERNS) {
    const matches = typeof pattern === 'string' 
      ? errorMessage.toLowerCase().includes(pattern.toLowerCase())
      : pattern.test(errorMessage);
    
    if (matches) {
      return {
        title: getTitleForContext(context),
        message,
        suggestion,
      };
    }
  }
  
  // Context-specific fallbacks
  switch (context) {
    case 'quiz':
      return {
        title: 'Quiz Error',
        message: 'There was a problem with the quiz',
        suggestion: 'Your progress has been saved. Please try again.',
      };
    case 'challenge':
      return {
        title: 'Challenge Error',
        message: 'Unable to complete the challenge action',
        suggestion: 'Please try again or check back later.',
      };
    case 'sync':
      return {
        title: 'Sync Error',
        message: 'Unable to sync your data',
        suggestion: 'Your data is saved locally and will sync when connection is restored.',
      };
    case 'ai':
      return {
        title: 'AI Service Error',
        message: 'The AI assistant is unavailable',
        suggestion: 'Please try again in a few moments.',
      };
    case 'auth':
      return {
        title: 'Authentication Error',
        message: 'There was a problem with your session',
        suggestion: 'Please sign out and sign back in.',
      };
    default:
      return {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred',
        suggestion: 'Please try again. If the problem persists, contact support.',
      };
  }
}

/**
 * Gets an appropriate title based on context
 */
function getTitleForContext(context?: string): string {
  switch (context) {
    case 'quiz': return 'Quiz Error';
    case 'challenge': return 'Challenge Error';
    case 'sync': return 'Sync Error';
    case 'ai': return 'AI Service Error';
    case 'auth': return 'Sign In Required';
    default: return 'Oops!';
  }
}

/**
 * Simple string formatter for inline error messages
 * Use this when you just need a string, not the full object
 */
export function formatErrorString(error: Error | string | unknown): string {
  const formatted = formatUserError(error);
  return formatted.suggestion 
    ? `${formatted.message}. ${formatted.suggestion}`
    : formatted.message;
}

/**
 * Check if an error is likely a network issue
 */
export function isNetworkError(error: Error | unknown): boolean {
  if (error instanceof Error) {
    return /fetch|network|offline|connection/i.test(error.message);
  }
  return false;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error | unknown): boolean {
  if (error instanceof Error) {
    return /429|503|502|504|timeout|network|fetch/i.test(error.message);
  }
  return false;
}
