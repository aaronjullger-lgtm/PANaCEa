/**
 * AuthenticatedRoute — Client-side guard for authenticated-only routes.
 *
 * Defence-in-depth alongside the App.tsx auth gate (which renders LandingPage
 * when `!isSignedIn`).  If a user somehow reaches a protected <Route> without
 * being signed in, this component redirects to /study — which the App.tsx gate
 * will then turn into LandingPage.
 *
 * Server-side security is enforced independently in Cloudflare Functions.
 *
 * Usage in AppRoutes.tsx:
 *   <Route path="/practice" element={<AuthenticatedRoute><PracticePage /></AuthenticatedRoute>} />
 */

import React from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

export const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({
  children,
}) => {
  const { isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded } = useUser();

  // Still loading auth state — show nothing to avoid flash of protected content
  if (!isUserLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[var(--color-text-tertiary)]">
          Loading…
        </div>
      </div>
    );
  }

  // Not signed in — redirect to /study (App.tsx gate renders LandingPage for unauth)
  if (!isSignedIn) {
    return <Navigate to={ROUTES.STUDY} replace />;
  }

  return <>{children}</>;
};

export default AuthenticatedRoute;
