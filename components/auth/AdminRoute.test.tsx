/**
 * SEC-002 regression — admin route guard. Proves logged-out users are redirected,
 * authenticated non-admins get 403 (AccessDenied), and admins render children.
 * (Client-side UX guard; server-side enforcement is adminAuthenticatedEndpoint.)
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ROUTES } from '@/config/routes';

// Mutable Clerk auth state the mock reads from.
const authState: {
  isSignedIn: boolean;
  isAuthLoaded: boolean;
  isUserLoaded: boolean;
  user: { publicMetadata?: { role?: string } } | null;
} = { isSignedIn: false, isAuthLoaded: true, isUserLoaded: true, user: null };

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: authState.user, isLoaded: authState.isUserLoaded }),
  useAuth: () => ({ isSignedIn: authState.isSignedIn, isLoaded: authState.isAuthLoaded }),
}));

import { AdminRoute } from './AdminRoute';

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>ADMIN CONTENT</div>
            </AdminRoute>
          }
        />
        <Route path={ROUTES.STUDY} element={<div>STUDY PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminRoute (SEC-002)', () => {
  beforeEach(() => {
    authState.isSignedIn = false;
    authState.isAuthLoaded = true;
    authState.isUserLoaded = true;
    authState.user = null;
  });

  it('shows a loading state while auth resolves', () => {
    authState.isAuthLoaded = false;
    renderAdmin();
    expect(screen.getByText(/Verifying access/i)).toBeTruthy();
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
  });

  it('redirects logged-out users away from admin (to study)', () => {
    authState.isSignedIn = false;
    authState.user = null;
    renderAdmin();
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
    expect(screen.getByText('STUDY PAGE')).toBeTruthy();
  });

  it('denies authenticated non-admin users (403)', () => {
    authState.isSignedIn = true;
    authState.user = { publicMetadata: { role: 'user' } };
    renderAdmin();
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
    expect(screen.getByText(/Access Denied/i)).toBeTruthy();
  });

  it('allows admin users', () => {
    authState.isSignedIn = true;
    authState.user = { publicMetadata: { role: 'admin' } };
    renderAdmin();
    expect(screen.getByText('ADMIN CONTENT')).toBeTruthy();
  });

  it('allows superadmin users', () => {
    authState.isSignedIn = true;
    authState.user = { publicMetadata: { role: 'superadmin' } };
    renderAdmin();
    expect(screen.getByText('ADMIN CONTENT')).toBeTruthy();
  });
});
