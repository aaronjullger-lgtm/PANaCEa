import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';
import { ROUTES } from '@/config/routes';

interface DrillErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  drillName?: string;
}

interface DrillErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DrillErrorBoundary extends Component<
  DrillErrorBoundaryProps,
  DrillErrorBoundaryState
> {
  constructor(props: DrillErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): DrillErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error({
      message: `Drill error boundary caught an error${
        this.props.drillName ? ` in ${this.props.drillName}` : ''
      }`,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const sanitizedMessage =
        this.state.error?.message || 'An unexpected error occurred';

      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--color-bg-primary)' }}
        >
          <div
            className="max-w-md w-full rounded-lg border p-8"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
            }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <AlertCircle
                size={48}
                style={{ color: 'var(--color-accent)' }}
                strokeWidth={1.5}
              />
            </div>

            {/* Title */}
            <h2
              className="text-xl font-semibold text-center mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Something went wrong
            </h2>

            {/* Error Message */}
            <p
              className="text-center text-sm mb-6 break-words"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {sanitizedMessage.length > 120
                ? `${sanitizedMessage.substring(0, 120)}...`
                : sanitizedMessage}
            </p>

            {/* Drill Name (if provided) */}
            {this.props.drillName && (
              <p
                className="text-center text-xs mb-4 italic"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Drill: {this.props.drillName}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-2 px-4 rounded font-medium text-center transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-bg-primary)',
                }}
              >
                Try Again
              </button>

              <a
                href={ROUTES.PRACTICE}
                className="w-full py-2 px-4 rounded font-medium text-center transition-opacity hover:opacity-90 block"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-accent)',
                }}
              >
                Back to Practice
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
