// AppProviders.tsx — Stateless context providers that wrap the authenticated app shell.
// Extracted from App.tsx to reduce its size. The BehavioralTrackerProvider is intentionally
// NOT included here because it wraps only the QuizView (where it can access session state).
import React from 'react';
import { Toaster } from 'sonner';
import { CommuterProvider } from '../../contexts/CommuterContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { SystemIntegrationProvider } from '../../contexts/SystemIntegrationContext';
import { SWUpdatePrompt } from '../shared/SWUpdatePrompt';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps the authenticated app with context providers in the exact nesting order
 * used by App.tsx: SystemIntegration → Toast → Commuter, then Toaster alongside children.
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <SystemIntegrationProvider>
      <ToastProvider>
        <CommuterProvider>
          {/* Sonner toast notifications */}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              className: 'sonner-toast',
            }}
          />
          <SWUpdatePrompt />
          {children}
        </CommuterProvider>
      </ToastProvider>
    </SystemIntegrationProvider>
  );
};
