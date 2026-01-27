/**
 * Monitor Error Boundary
 *
 * Catches errors in the EMR Monitor/Vitals visualization components
 * and displays a "Monitor Malfunction" fallback UI instead of crashing
 * the entire Patient Encounter mode.
 *
 * This allows the Chat and History panels to continue working even if
 * the monitor visualization fails.
 */

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Activity, Power } from 'lucide-react';
import { motion } from 'framer-motion';

interface MonitorErrorBoundaryProps {
  children: ReactNode;
  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Custom fallback component */
  fallback?: ReactNode;
}

interface MonitorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * Static "Monitor Malfunction" display that mimics a medical monitor failure
 */
function MonitorMalfunctionFallback({
  error,
  onReboot,
  errorCount,
}: {
  error: Error | null;
  onReboot: () => void;
  errorCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-slate-900 rounded-xl border border-red-500/50 p-6 min-h-[200px] flex flex-col items-center justify-center"
    >
      {/* Scanline effect overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)',
        }}
      />

      {/* Warning icon with pulse */}
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mb-4"
      >
        <AlertTriangle className="w-12 h-12 text-red-500" />
      </motion.div>

      {/* Main error message */}
      <h3 className="text-red-400 font-mono text-lg font-bold mb-2">MONITOR MALFUNCTION</h3>

      <p className="text-slate-400 font-mono text-sm text-center mb-4">
        Vital signs display offline.
        <br />
        Patient care systems unaffected.
      </p>

      {/* Error details (collapsed by default in production) */}
      {process.env.NODE_ENV === 'development' && error && (
        <details className="mb-4 w-full max-w-md">
          <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">
            Technical Details
          </summary>
          <pre className="text-red-400/70 text-xs mt-2 p-2 bg-slate-800 rounded overflow-auto max-h-24">
            {error.message}
          </pre>
        </details>
      )}

      {/* Reboot button */}
      <button
        onClick={onReboot}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 
                   border border-slate-600 rounded-lg text-slate-300 font-mono text-sm
                   transition-colors duration-200"
      >
        <Power className="w-4 h-4" />
        Reboot System
      </button>

      {/* Error count indicator */}
      {errorCount > 1 && (
        <p className="text-slate-600 text-xs mt-3 font-mono">
          Error count: {errorCount} | Consider refreshing the page
        </p>
      )}

      {/* Simulated static noise effect */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-slate-600">
        <Activity className="w-3 h-3" />
        <span className="text-xs font-mono">NO SIGNAL</span>
      </div>
    </motion.div>
  );
}

/**
 * Alternative minimal fallback for when even Framer Motion might be problematic
 */
function MinimalFallback({ onReboot }: { onReboot: () => void }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-red-500/50 p-6 min-h-[200px] flex flex-col items-center justify-center">
      <div className="text-red-500 text-4xl mb-4">⚠️</div>
      <h3 className="text-red-400 font-mono text-lg font-bold mb-2">MONITOR OFFLINE</h3>
      <p className="text-slate-400 text-sm text-center mb-4">Display error - click to retry</p>
      <button
        onClick={onReboot}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 
                   rounded-lg text-slate-300 text-sm"
      >
        🔄 Reboot
      </button>
    </div>
  );
}

/**
 * Error Boundary component for EMR Monitor visualizations
 *
 * @example
 * <MonitorErrorBoundary onError={(e) => logError(e)}>
 *   <VitalsMonitor vitals={currentVitals} />
 *   <Sparkline data={trendData} />
 * </MonitorErrorBoundary>
 */
export class MonitorErrorBoundary extends Component<
  MonitorErrorBoundaryProps,
  MonitorErrorBoundaryState
> {
  constructor(props: MonitorErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<MonitorErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Increment error count
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[MonitorErrorBoundary] Caught error:', error);
      console.error('[MonitorErrorBoundary] Error info:', errorInfo);
    }

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleReboot = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use minimal fallback if we've had multiple errors (animation might be the problem)
      if (this.state.errorCount > 2) {
        return <MinimalFallback onReboot={this.handleReboot} />;
      }

      // Default animated fallback
      return (
        <MonitorMalfunctionFallback
          error={this.state.error}
          onReboot={this.handleReboot}
          errorCount={this.state.errorCount}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap any component with MonitorErrorBoundary
 */
export function withMonitorErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  displayName?: string
): React.FC<P> {
  const WithMonitorError: React.FC<P> = (props) => (
    <MonitorErrorBoundary>
      <WrappedComponent {...props} />
    </MonitorErrorBoundary>
  );

  WithMonitorError.displayName = displayName || `WithMonitorError(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithMonitorError;
}

export default MonitorErrorBoundary;
