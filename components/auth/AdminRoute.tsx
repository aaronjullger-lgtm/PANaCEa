/**
 * AdminRoute — Client-side route guard for admin pages.
 *
 * Wraps admin route elements so that:
 *  1. Unauthenticated users are redirected to /study.
 *  2. Authenticated non-admin users see a "403 — Access Denied" page.
 *  3. Admin/superadmin users render the child element normally.
 *
 * This is a UX guard only — actual security is enforced server-side via
 * `adminAuthenticatedEndpoint` in Cloudflare Functions.
 *
 * Usage in AppRoutes.tsx:
 *   <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
 */

import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Shield, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { isAdmin, type UserRole } from '@/lib/auth/rbac';

interface AdminRouteProps {
  children: React.ReactNode;
  /** Minimum role required. Defaults to 'admin'. */
  requiredRole?: UserRole;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  requiredRole = 'admin',
}) => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();

  // Still loading auth state — show nothing to avoid flash
  if (!isAuthLoaded || !isUserLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[var(--color-text-tertiary)]">
          Verifying access…
        </div>
      </div>
    );
  }

  // Not signed in — redirect to study hub
  if (!isSignedIn || !user) {
    return <Navigate to={ROUTES.STUDY} replace />;
  }

  // Check role from Clerk public metadata
  const userRole = (user.publicMetadata?.role as UserRole) || 'user';
  const hasAccess = requiredRole === 'admin'
    ? isAdmin(userRole)
    : userRole === requiredRole;

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

/** Minimal 403 page shown to authenticated non-admin users */
function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <div className="p-4 rounded-full bg-[var(--color-data-fail)]/10">
        <Shield className="w-10 h-10 text-[var(--color-data-fail)]" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Denied
        </h1>
        <p className="text-[var(--color-text-secondary)] max-w-md">
          You don't have permission to view this page. If you believe this is an
          error, contact your administrator.
        </p>
      </div>
      <button
        onClick={() => navigate(ROUTES.STUDY)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}

export default AdminRoute;
