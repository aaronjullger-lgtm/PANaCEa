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

  it('uses anatomy-specific unauthenticated copy for the visualizer', () => {
    expect(getProtectedRouteIntent('/visualizer')).toMatchObject({
      isProtected: true,
      eyebrow: 'Anatomy visualizer',
      title: 'Sign in to open the anatomy visualizer.',
    });
  });

  it.each([
    ['/clinical-eye', 'Clinical image lab', 'Sign in to open clinical image training.'],
    ['/clinical-profile', 'Clinical performance profile', 'Sign in to view your clinical profile.'],
    ['/core-adaptive', 'Adaptive exam engine', 'Sign in to launch adaptive practice.'],
    ['/daily-challenges', 'Daily readiness drill', 'Sign in to open daily challenges.'],
    ['/explorer', 'Clinical knowledge map', 'Sign in to explore the clinical map.'],
    ['/gap-analysis', 'Weak-area analysis', 'Sign in to view weak-area analysis.'],
    [
      '/lecture-converter',
      'Lecture-to-study converter',
      'Sign in to convert lectures into study work.',
    ],
    ['/live-collaboration', 'Study collaboration', 'Sign in to open collaboration workspace.'],
    ['/medical-database', 'Clinical study database', 'Sign in to search the study database.'],
    ['/settings', 'Account settings', 'Sign in to manage your study settings.'],
    ['/technique-check', 'Technique check', 'Sign in to review your answering technique.'],
  ])('uses workspace-specific unauthenticated copy for %s', (path, eyebrow, title) => {
    expect(getProtectedRouteIntent(path)).toMatchObject({
      isProtected: true,
      eyebrow,
      title,
      primaryAction: 'sign-in',
    });
  });

  it('applies route-specific copy to protected child paths', () => {
    expect(getProtectedRouteIntent('/clinical-eye/case-review')).toMatchObject({
      eyebrow: 'Clinical image lab',
      title: 'Sign in to open clinical image training.',
    });
  });

  it('does not over-match similarly named public paths', () => {
    expect(isProtectedAppPath('/studypanacea')).toBe(false);
    expect(isProtectedAppPath('/progressive-learning')).toBe(false);
  });
});
