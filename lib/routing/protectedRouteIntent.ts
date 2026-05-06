const PUBLIC_MARKETING_PATHS = new Set(['/', '/index.html']);

const PROTECTED_PREFIXES = [
  '/admin',
  '/clinical-eye',
  '/clinical-profile',
  '/core-adaptive',
  '/daily-challenges',
  '/explorer',
  '/gap-analysis',
  '/lecture-converter',
  '/live-collaboration',
  '/medical-database',
  '/practice',
  '/progress',
  '/settings',
  '/study',
  '/technique-check',
  '/visualizer',
];

export type ProtectedRouteIntent = {
  isProtected: boolean;
  title: string;
  description: string;
  eyebrow: string;
  primaryAction: 'sign-in' | 'sign-up';
};

export function getProtectedRouteIntent(pathname: string): ProtectedRouteIntent {
  const normalizedPath = normalizePath(pathname);
  const isProtected = isProtectedAppPath(normalizedPath);

  if (!isProtected) {
    return {
      isProtected: false,
      eyebrow: 'PANaCEa',
      title: 'Clinical study intelligence for PA students',
      description: 'Create an account to turn study signals into one focused daily plan.',
      primaryAction: 'sign-up',
    };
  }

  if (normalizedPath.startsWith('/admin')) {
    return {
      isProtected: true,
      eyebrow: 'Admin access',
      title: 'Sign in with an authorized admin account.',
      description:
        'Production admin tools are only available after authentication and role verification.',
      primaryAction: 'sign-in',
    };
  }

  if (normalizedPath.startsWith('/study')) {
    return {
      isProtected: true,
      eyebrow: 'Study command center',
      title: 'Sign in to open your adaptive study plan.',
      description:
        'Your dashboard, Today session, review coverage, and study-plan launches require your learner profile.',
      primaryAction: 'sign-in',
    };
  }

  if (normalizedPath.startsWith('/practice')) {
    return {
      isProtected: true,
      eyebrow: 'Practice workspace',
      title: 'Sign in to start personalized practice.',
      description:
        'Practice modes use your saved misses, due reviews, and current plan so drills stay clinically relevant.',
      primaryAction: 'sign-in',
    };
  }

  if (normalizedPath.startsWith('/progress')) {
    return {
      isProtected: true,
      eyebrow: 'Progress analytics',
      title: 'Sign in to view your progress.',
      description:
        'Readiness, review timing, and weakness trends are private learner data and require authentication.',
      primaryAction: 'sign-in',
    };
  }

  return {
    isProtected: true,
    eyebrow: 'Protected workspace',
    title: 'Sign in to continue.',
    description: 'This PANaCEa workspace uses your private study data and requires authentication.',
    primaryAction: 'sign-in',
  };
}

export function isProtectedAppPath(pathname: string): boolean {
  const normalizedPath = normalizePath(pathname);
  if (PUBLIC_MARKETING_PATHS.has(normalizedPath)) return false;

  return PROTECTED_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] || '/';
  const withSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}
