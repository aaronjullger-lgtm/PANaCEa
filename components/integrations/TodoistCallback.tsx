import React, { useEffect, useState } from 'react';
// import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import { exchangeCodeForToken, type TodoistOAuthConfig } from '@/lib/services/todoistService';

const TODOIST_CONFIG: TodoistOAuthConfig = {
  clientId: import.meta.env.VITE_TODOIST_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_TODOIST_CLIENT_SECRET || '',
  redirectUri: `${window.location.origin}/todoist-callback`,
};

export default function TodoistCallback() {
  // const [searchParams] = useSearchParams();
  // const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setErrorMessage(`OAuth error: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setErrorMessage('Missing authorization code or state parameter');
        return;
      }

      try {
        await exchangeCodeForToken(code, state, TODOIST_CONFIG);
        setStatus('success');

        // Redirect back to the main app after a short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to complete OAuth flow');
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
      <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {status === 'loading' && (
            <div role="status" aria-live="polite">
              <div className="flex justify-center mb-4">
                <InlineSpinner size="xl" className="text-[var(--color-accent)]" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Connecting to Todoist
              </h2>
              <p className="text-[var(--color-text-muted)]">
                Please wait while we complete the connection...
              </p>
            </div>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-[var(--color-data-pass)] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Successfully Connected!
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-4">
                Your Todoist account has been connected to PANaCEa.
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Redirecting you back to the app...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-[var(--color-data-fail)] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Connection Failed
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-4">{errorMessage}</p>
              <button
                onClick={() => (window.location.href = '/')}
                className="bg-[var(--color-accent)] text-[var(--color-text-inverse)] px-4 py-2 rounded-xl hover:bg-[var(--color-accent-hover)]"
              >
                Return to App
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
