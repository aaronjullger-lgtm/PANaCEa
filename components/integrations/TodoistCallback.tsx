import React, { useEffect, useState } from 'react';
// import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { exchangeCodeForToken, type TodoistOAuthConfig } from '../lib/services/todoistService';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Connecting to Todoist
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we complete the connection...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Successfully Connected!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your Todoist account has been connected to PANaCEa.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Redirecting you back to the app...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Connection Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{errorMessage}</p>
              <button
                onClick={() => (window.location.href = '/')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
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
