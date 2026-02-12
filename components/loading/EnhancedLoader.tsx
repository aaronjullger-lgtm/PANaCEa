/**
 * Enhanced Loader Component with Progress, Timeout, and Error States
 * Provides better UX for authentication and loading scenarios
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, User, Clock, WifiOff, Shield } from 'lucide-react';
import { useEnhancedAuth, shouldOfferGuestMode } from '@/hooks/useEnhancedAuth';
import { StandardButton, PrimaryButton, SecondaryButton, OutlineButton } from '@/components/shared/StandardButton';

interface EnhancedLoaderProps {
  /** Custom message to display */
  message?: string;
  /** Force dark background */
  forceDark?: boolean;
  /** Show authentication-specific UI */
  isAuthLoading?: boolean;
}

const EnhancedLoader: React.FC<EnhancedLoaderProps> = ({ 
  message, 
  forceDark = false,
  isAuthLoading = true 
}) => {
  const [localMessage, setLocalMessage] = useState(message || 'Loading...');
  const [progress, setProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  
  const { 
    isLoading, 
    error, 
    elapsedTime, 
    hasTimedOut, 
    retryAuth, 
    enterGuestMode,
    isGuestMode 
  } = useEnhancedAuth();

  // Prevent scrolling behind the overlay
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Update progress based on elapsed time
  useEffect(() => {
    if (!isAuthLoading || !isLoading) {
      setProgress(100);
      return;
    }

    const totalTime = 15000; // 15 seconds max
    const calculatedProgress = Math.min(95, (elapsedTime / totalTime) * 100);
    setProgress(calculatedProgress);

    // Update messages based on elapsed time
    if (elapsedTime < 3000) {
      setLocalMessage('Initializing...');
    } else if (elapsedTime < 8000) {
      setLocalMessage('Connecting to authentication service...');
    } else if (elapsedTime < 12000) {
      setLocalMessage('Almost there...');
    } else {
      setLocalMessage('Taking longer than expected...');
    }
  }, [elapsedTime, isLoading, isAuthLoading]);

  // Use theme colors instead of hardcoded colors
  const bgClass = forceDark ? 'bg-slate-950' : 'bg-[var(--color-bg-primary)]/95 backdrop-blur-lg';
  const textClass = forceDark ? 'text-slate-200' : 'text-[var(--color-text-primary)]';
  const accentClass = forceDark ? 'text-slate-100' : 'text-[var(--color-accent)]';
  const borderClass = forceDark ? 'border-slate-700' : 'border-[var(--color-border)]';
  const errorBgClass = forceDark ? 'bg-red-900/20' : 'bg-[var(--color-error-bg)]';
  const warningBgClass = forceDark ? 'bg-amber-900/20' : 'bg-[var(--color-warning-bg)]';
  const successColor = forceDark ? 'text-green-400' : 'text-[var(--color-success)]';
  const errorColor = forceDark ? 'text-red-400' : 'text-[var(--color-error)]';
  const warningColor = forceDark ? 'text-amber-400' : 'text-[var(--color-warning)]';

  const offerGuestMode = shouldOfferGuestMode() || hasTimedOut;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 ${bgClass} flex flex-col items-center justify-center z-50 p-4`}
    >
      <div className="max-w-md w-full space-y-6">
        {/* Header with logo/brand */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-accent)]/10 mb-3">
            <Shield className={`w-6 h-6 ${accentClass}`} />
          </div>
          <h1 className={`text-xl font-semibold ${textClass} mb-1`}>PANaCEa</h1>
          <p className={`text-sm ${textClass}/70`}>Physician Assistant National Certifying Exam Adaptive Engine</p>
        </div>

        {/* Progress section */}
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${forceDark ? 'bg-slate-100' : 'bg-[var(--color-accent)]'}`}
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 100 }}
            />
          </div>

          {/* Status message and time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'animate-pulse bg-[var(--color-accent)]' : successColor}`} />
              <span className={`text-sm font-medium ${textClass}`}>{localMessage}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className={`w-3 h-3 ${textClass}/60`} />
              <span className={`text-xs ${textClass}/60`}>
                {(elapsedTime / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
        </div>

        {/* Error or timeout state */}
        <AnimatePresence>
          {(error || hasTimedOut) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-lg ${error ? errorBgClass : warningBgClass} ${borderClass} border`}
            >
              <div className="flex items-start space-x-3">
                <AlertCircle className={`w-5 h-5 mt-0.5 ${error ? errorColor : warningColor}`} />
                <div className="flex-1">
                  <h3 className={`font-medium ${textClass} mb-1`}>
                    {hasTimedOut ? 'Authentication is taking too long' : 'Authentication issue'}
                  </h3>
                  <p className={`text-sm ${textClass}/80 mb-3`}>
                    {error || 'The authentication service is not responding. This could be due to network issues or service downtime.'}
                  </p>
                  
                  <div className="flex flex-wrap gap-3">
                    <PrimaryButton
                      onClick={retryAuth}
                      leftIcon={<RefreshCw className="w-4 h-4" />}
                      size="md"
                    >
                      Try Again
                    </PrimaryButton>
                    
                    {offerGuestMode && (
                      <SecondaryButton
                        onClick={enterGuestMode}
                        leftIcon={<User className="w-4 h-4" />}
                        size="md"
                      >
                        Try Guest Mode
                      </SecondaryButton>
                    )}
                    
                    <OutlineButton
                      onClick={() => setShowDetails(!showDetails)}
                      size="md"
                    >
                      {showDetails ? 'Hide Details' : 'Show Details'}
                    </OutlineButton>
                  </div>
                </div>
              </div>

              {/* Technical details */}
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-[var(--color-border)]"
                >
                  <h4 className={`text-xs font-medium ${textClass}/70 mb-2`}>Technical Details</h4>
                  <div className={`text-xs ${textClass}/60 space-y-1`}>
                    <div className="flex justify-between">
                      <span>Elapsed Time:</span>
                      <span>{(elapsedTime / 1000).toFixed(2)} seconds</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span>{hasTimedOut ? 'Timed out' : isLoading ? 'Loading' : 'Ready'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guest Mode:</span>
                      <span>{isGuestMode ? 'Active' : 'Available'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connection:</span>
                      <span className="flex items-center">
                        {navigator.onLine ? (
                          <>
                            <div className={`w-2 h-2 rounded-full ${successColor} mr-1`} />
                            Online
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-3 h-3 mr-1" />
                            Offline
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guest mode info */}
        {!error && !hasTimedOut && offerGuestMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 rounded-lg ${warningBgClass} ${borderClass} border`}
          >
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-amber-500" />
              <p className={`text-sm ${textClass}/80`}>
                Having trouble signing in?{' '}
                <button
                  onClick={enterGuestMode}
                  className="text-[var(--color-accent)] hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-1 rounded"
                >
                  Try guest mode
                </button>{' '}
                to explore the platform.
              </p>
            </div>
          </motion.div>
        )}

        {/* Loading animation (only when no errors) */}
        {!error && !hasTimedOut && (
          <div className="flex justify-center pt-4">
            <div className="flex space-x-2">
              {[0, 0.15, 0.3].map((delay) => (
                <motion.div
                  key={delay}
                  className={`w-3 h-3 ${forceDark ? 'bg-slate-100' : 'bg-[var(--color-accent)]'} rounded-full`}
                  animate={{ y: [-8, 0, -8] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer with help link */}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <p className={`text-center text-xs ${textClass}/60`}>
            Need help?{' '}
            <a 
              href="https://github.com/yourusername/panacea/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default EnhancedLoader;