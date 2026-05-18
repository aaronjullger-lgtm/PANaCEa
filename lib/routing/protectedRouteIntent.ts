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

type ProtectedRouteIntentConfig = ProtectedRouteIntent & {
  prefix: string;
};

const PROTECTED_ROUTE_INTENTS: ProtectedRouteIntentConfig[] = [
  {
    prefix: '/admin',
    isProtected: true,
    eyebrow: 'Admin access',
    title: 'Sign in with an authorized admin account.',
    description:
      'Production admin tools are only available after authentication and role verification.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/study',
    isProtected: true,
    eyebrow: 'Study command center',
    title: 'Sign in to open your adaptive study plan.',
    description:
      'Your dashboard, Today session, review coverage, and study-plan launches require your learner profile.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/practice',
    isProtected: true,
    eyebrow: 'Practice workspace',
    title: 'Sign in to start personalized practice.',
    description:
      'Practice modes use your saved misses, due reviews, and current plan so drills stay clinically relevant.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/clinical-eye',
    isProtected: true,
    eyebrow: 'Clinical image lab',
    title: 'Sign in to open clinical image training.',
    description:
      'Synthetic image-pattern drills, annotations, and saved review status require your learner profile.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/clinical-profile',
    isProtected: true,
    eyebrow: 'Clinical performance profile',
    title: 'Sign in to view your clinical profile.',
    description:
      'Calibration, confidence trends, and readiness signals are private learner analytics.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/core-adaptive',
    isProtected: true,
    eyebrow: 'Adaptive exam engine',
    title: 'Sign in to launch adaptive practice.',
    description:
      'Adaptive sessions use saved misses, due reviews, and current readiness signals to shape the next block.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/daily-challenges',
    isProtected: true,
    eyebrow: 'Daily readiness drill',
    title: 'Sign in to open daily challenges.',
    description:
      'Challenge streaks, weak-area prompts, and completion history are tied to your learner profile.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/explorer',
    isProtected: true,
    eyebrow: 'Clinical knowledge map',
    title: 'Sign in to explore the clinical map.',
    description:
      'Concept relationships, saved paths, and weak-area context require authenticated study data.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/gap-analysis',
    isProtected: true,
    eyebrow: 'Weak-area analysis',
    title: 'Sign in to view weak-area analysis.',
    description:
      'Blueprint gaps and remediation priorities depend on your practice history and review timing.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/lecture-converter',
    isProtected: true,
    eyebrow: 'Lecture-to-study converter',
    title: 'Sign in to convert lectures into study work.',
    description:
      'Generated drills, saved source notes, and review queues require your private workspace.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/live-collaboration',
    isProtected: true,
    eyebrow: 'Study collaboration',
    title: 'Sign in to open collaboration workspace.',
    description: 'Shared study boards, notes, and review context require authenticated access.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/medical-database',
    isProtected: true,
    eyebrow: 'Clinical study database',
    title: 'Sign in to search the study database.',
    description:
      'Saved references, concept links, and learner context stay inside your authenticated workspace.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/progress',
    isProtected: true,
    eyebrow: 'Progress analytics',
    title: 'Sign in to view your progress.',
    description:
      'Readiness, review timing, and weakness trends are private learner data and require authentication.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/settings',
    isProtected: true,
    eyebrow: 'Account settings',
    title: 'Sign in to manage your study settings.',
    description: 'Preferences, data exports, and account controls require authenticated access.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/technique-check',
    isProtected: true,
    eyebrow: 'Technique check',
    title: 'Sign in to review your answering technique.',
    description:
      'Technique feedback uses your response patterns, confidence signals, and timing history.',
    primaryAction: 'sign-in',
  },
  {
    prefix: '/visualizer',
    isProtected: true,
    eyebrow: 'Anatomy visualizer',
    title: 'Sign in to open the anatomy visualizer.',
    description:
      'Atlas scenes, generated study visuals, and saved spatial-recall work require your learner profile.',
    primaryAction: 'sign-in',
  },
];

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

  const configuredIntent = PROTECTED_ROUTE_INTENTS.find(({ prefix }) =>
    pathMatchesPrefix(normalizedPath, prefix)
  );
  if (configuredIntent) return toProtectedRouteIntent(configuredIntent);

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

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function toProtectedRouteIntent({
  prefix: _prefix,
  ...intent
}: ProtectedRouteIntentConfig): ProtectedRouteIntent {
  return intent;
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] || '/';
  const withSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}
