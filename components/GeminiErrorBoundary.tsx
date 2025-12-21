/**
 * GeminiErrorBoundary
 * 
 * Specialized error boundary for Gemini API errors.
 * Provides user-friendly error messages and retry functionality.
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Wifi, Clock, Server } from 'lucide-react';

export interface GeminiErrorInfo {
  type: 'rate_limit' | 'server_error' | 'network' | 'timeout' | 'generic';
  status?: number;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

interface GeminiErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  fallback?: ReactNode;
}

interface GeminiErrorBoundaryState {
  hasError: boolean;
  errorInfo: GeminiErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

/**
 * Parse Gemini API error to determine type and if retryable
 */
export function parseGeminiError(error: Error | Response | unknown): GeminiErrorInfo {
  // Handle Response objects
  if (error instanceof Response) {
    const status = error.status;
    
    if (status === 429) {
      return {
        type: 'rate_limit',
        status,
        message: 'Too many requests. Please wait a moment before trying again.',
        retryable: true,
        retryAfterMs: 60000, // Default 60 seconds
      };
    }
    
    if (status === 503 || status === 502 || status === 504) {
      return {
        type: 'server_error',
        status,
        message: 'The AI service is temporarily unavailable. Retrying...',
        retryable: true,
        retryAfterMs: 3000,
      };
    }
    
    if (status === 408) {
      return {
        type: 'timeout',
        status,
        message: 'The request timed out. Please try again.',
        retryable: true,
        retryAfterMs: 1000,
      };
    }
    
    return {
      type: 'generic',
      status,
      message: `Request failed with status ${status}`,
      retryable: status >= 500,
    };
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection lost. Please check your internet and try again.',
        retryable: true,
        retryAfterMs: 2000,
      };
    }
    
    if (message.includes('timeout')) {
      return {
        type: 'timeout',
        message: 'The request took too long. Please try again.',
        retryable: true,
        retryAfterMs: 1000,
      };
    }
    
    if (message.includes('rate') || message.includes('429')) {
      return {
        type: 'rate_limit',
        message: 'Rate limit reached. Please wait before retrying.',
        retryable: true,
        retryAfterMs: 60000,
      };
    }
    
    if (message.includes('503') || message.includes('unavailable')) {
      return {
        type: 'server_error',
        message: 'AI service temporarily unavailable.',
        retryable: true,
        retryAfterMs: 3000,
      };
    }
    
    return {
      type: 'generic',
      message: error.message || 'An unexpected error occurred',
      retryable: false,
    };
  }
  
  return {
    type: 'generic',
    message: 'An unexpected error occurred',
    retryable: false,
  };
}

/**
 * Get icon for error type
 */
function ErrorIcon({ type }: { type: GeminiErrorInfo['type'] }) {
  switch (type) {
    case 'rate_limit':
      return <Clock className="w-12 h-12 text-yellow-500" />;
    case 'network':
      return <Wifi className="w-12 h-12 text-orange-500" />;
    case 'server_error':
      return <Server className="w-12 h-12 text-red-500" />;
    case 'timeout':
      return <Clock className="w-12 h-12 text-orange-500" />;
    default:
      return <AlertTriangle className="w-12 h-12 text-red-500" />;
  }
}

export class GeminiErrorBoundary extends Component<GeminiErrorBoundaryProps, GeminiErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  constructor(props: GeminiErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<GeminiErrorBoundaryState> {
    const errorInfo = parseGeminiError(error);
    return { hasError: true, errorInfo };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GeminiErrorBoundary] Caught error:', error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { errorInfo, retryCount } = this.state;
    const maxRetries = 3;
    
    if (retryCount >= maxRetries) {
      console.warn('[GeminiErrorBoundary] Max retries exceeded');
      return;
    }
    
    this.setState({ isRetrying: true });
    
    // Apply exponential backoff
    const backoffMs = errorInfo?.retryAfterMs || Math.min(1000 * Math.pow(2, retryCount), 30000);
    
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        errorInfo: null,
        retryCount: retryCount + 1,
        isRetrying: false,
      });
      
      this.props.onRetry?.();
    }, backoffMs);
  };

  render() {
    const { hasError, errorInfo, retryCount, isRetrying } = this.state;
    const { children, fallback } = this.props;
    
    if (!hasError) {
      return children;
    }
    
    if (fallback) {
      return fallback;
    }
    
    const maxRetries = 3;
    const canRetry = errorInfo?.retryable && retryCount < maxRetries;
    
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
        <ErrorIcon type={errorInfo?.type || 'generic'} />
        
        <h3 className="mt-4 text-lg font-semibold text-[var(--color-text-primary)]">
          {errorInfo?.type === 'rate_limit' && 'Rate Limit Reached'}
          {errorInfo?.type === 'server_error' && 'Service Unavailable'}
          {errorInfo?.type === 'network' && 'Connection Lost'}
          {errorInfo?.type === 'timeout' && 'Request Timed Out'}
          {errorInfo?.type === 'generic' && 'Something Went Wrong'}
        </h3>
        
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md">
          {errorInfo?.message}
        </p>
        
        {canRetry && (
          <button
            onClick={this.handleRetry}
            disabled={isRetrying}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-primary)] text-white rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        )}
        
        {retryCount > 0 && (
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            Retry attempt {retryCount} of {maxRetries}
          </p>
        )}
        
        {!canRetry && retryCount >= maxRetries && (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Please refresh the page or try again later.
          </p>
        )}
      </div>
    );
  }
}

/**
 * Hook for using Gemini error handling in functional components
 */
export function useGeminiRetry(maxRetries = 2) {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);
  
  const executeWithRetry = React.useCallback(async <T,>(
    fn: () => Promise<T>
  ): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setRetryCount(attempt);
        const result = await fn();
        setRetryCount(0);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorInfo = parseGeminiError(error);
        
        if (!errorInfo.retryable || attempt >= maxRetries) {
          setRetryCount(0);
          throw lastError;
        }
        
        // Wait before retry with exponential backoff
        const backoffMs = errorInfo.retryAfterMs || Math.min(1000 * Math.pow(2, attempt), 30000);
        setIsRetrying(true);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        setIsRetrying(false);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }, [maxRetries]);
  
  return { executeWithRetry, retryCount, isRetrying };
}
