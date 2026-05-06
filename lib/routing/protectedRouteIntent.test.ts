import { describe, expect, it } from 'vitest';
import { getProtectedRouteIntent, isProtectedAppPath } from './protectedRouteIntent';

describe('protected route intent', () => {
  it('keeps the marketing home route public', () => {
    expect(isProtectedAppPath('/')).toBe(false);
    expect(getProtectedRouteIntent('/')).toMatchObject({
      isProtected: false,
      primaryAction: 'sign-up',
    });
  });

  it.each(['/study', '/study/main-session', '/practice', '/progress', '/medical-database'])(
    'marks %s as protected',
    (path) => {
      expect(isProtectedAppPath(path)).toBe(true);
      expect(getProtectedRouteIntent(path)).toMatchObject({
        isProtected: true,
        primaryAction: 'sign-in',
      });
    }
  );

  it('uses admin-specific unauthenticated copy for admin routes', () => {
    expect(getProtectedRouteIntent('/admin/question-generator')).toMatchObject({
      isProtected: true,
      eyebrow: 'Admin access',
      title: 'Sign in with an authorized admin account.',
    });
  });

  it('does not over-match similarly named public paths', () => {
    expect(isProtectedAppPath('/studypanacea')).toBe(false);
    expect(isProtectedAppPath('/progressive-learning')).toBe(false);
  });
});
