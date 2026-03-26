/**
 * Landing Page Component
 * First page users see before signing in
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  BookOpen,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Activity as ActivityIcon,
  Target,
} from 'lucide-react';
import ThemeToggleButton from '../components/ui/ThemeToggleButton';
import { AppBrand } from '../components/layout/AppBrand';
import { PageContainer } from '../components/layout/PageContainer';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SkipNavigation } from '../components/shared/SkipNavigation';

const FEATURE_PILLS = [
  'Performance Analytics',
  '15+ Training Modes',
  'Medical Database',
  '1000+ Conditions',
] as const;

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const prefersReducedMotion = useReducedMotion();

  // Disable body scroll when modal is open
  useEffect(() => {
    if (showAuth) {
      document.body.style.overflow = 'hidden';

      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowAuth(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }

    document.body.style.overflow = 'unset';
    return undefined;
  }, [showAuth]);

  const features = [
    {
      icon: TrendingUp,
      title: 'Performance Tracking & Stats',
      description:
        'Detailed analytics and insights into your progress, identifying weak areas and tracking improvement over time',
    },
    {
      icon: ActivityIcon,
      title: 'Clinical Image Training',
      description:
        'Practice with ECGs, dermatology images, and radiology cases to build diagnostic skills',
    },
    {
      icon: BookOpen,
      title: 'Comprehensive Medical Database',
      description:
        'Complete medical reference with 1000+ conditions, treatments, labs, and clinical guidelines built right in',
    },
    {
      icon: Target,
      title: '15+ Training Modes',
      description:
        'Pharmacology, differential diagnosis, first-line treatments, and more specialized practice modes',
    },
  ];

  const benefits = [
    '1000+ conditions aligned with NCCPA content blueprint',
    'Performance tracking to identify weak areas',
    'Rapid recall drills for time-sensitive practice',
    'First-line treatment and antibiotic selection training',
    'Detailed explanations with clinical pearls and mnemonics',
    'Cloud sync across devices',
  ];

  return (
    // MotionConfig reducedMotion="user" automatically respects the OS-level
    // "prefers-reduced-motion: reduce" setting, disabling all framer-motion
    // animations for users who have requested reduced motion.
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      <SkipNavigation mainContentId="landing-main" />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)] transition-all duration-300 shadow-sm">
        <PageContainer maxWidth="7xl" className="py-4 flex items-center justify-between">
          <AppBrand size="lg" animate>
            <ThemeToggleButton />
            <motion.button
              type="button"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => {
                setAuthMode('sign-in');
                setShowAuth(true);
              }}
              className="px-6 py-2.5 bg-transparent border-2 border-[var(--color-navy,#0F172A)] dark:border-[var(--color-text-secondary)] text-[var(--color-navy,#0F172A)] dark:text-[var(--color-text-primary)] rounded-lg font-semibold transition-all duration-200 hover:bg-[var(--color-bg-secondary)] min-h-[44px] min-w-[44px]"
              style={{ padding: '0.625rem 1.5rem', border: '2px solid var(--color-text-primary, #e2e8f0)', color: 'var(--color-text-primary, #e2e8f0)', borderRadius: '0.5rem', minHeight: '44px', whiteSpace: 'nowrap' }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              aria-label="Sign in to your account"
            >
              Sign In
            </motion.button>
          </AppBrand>
        </PageContainer>
      </header>

      {/* Main content — required for WCAG landmark navigation */}
      <main id="landing-main">

      {/* Hero Section */}
      <PageContainer
        as="section"
        maxWidth="7xl"
        className="pt-20 pb-16"
        aria-label="Introduction"
      >
        <div className="text-center space-y-8">
          {/*
           * LCP optimisation: the h1 is the Largest Contentful Paint element.
           * Animating opacity from 0 → 1 delays the LCP measurement until the
           * transition completes (~600ms after JS execution).  Using only a
           * transform (y) keeps the entrance effect while letting the browser
           * paint — and measure LCP — as soon as React renders the element.
           */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="text-[var(--color-text-primary)]">Your Complete </span>
              <span className="bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-accent-border)] to-[var(--color-text-secondary)] bg-clip-text text-transparent">
                PA School Resource
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-[var(--color-text-secondary)] max-w-3xl mx-auto leading-relaxed">
              Comprehensive study platform for PA students—medical database, performance tracking,
              clinical image training, and 15+ specialized modes. Aligned with the PANCE &amp; PANRE
              blueprint.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.button
              type="button"
              onClick={() => {
                setAuthMode('sign-up');
                setShowAuth(true);
              }}
              className="group px-8 py-4 bg-[var(--color-accent-button)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-inverse)] rounded-xl font-bold text-lg shadow-[0_10px_40px_-10px_var(--color-shadow-soft)] hover:shadow-lg transition-all duration-300 flex items-center gap-2 min-h-[48px]"
              style={{ backgroundColor: 'var(--color-accent-button, #7a6f52)', color: 'var(--color-text-inverse, #f8fafc)', borderRadius: '0.75rem', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              aria-label="Get started with a free account"
            >
              Get Started
              <ArrowRight
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                aria-hidden
              />
            </motion.button>
            <p className="text-sm text-[var(--color-text-muted)]">
              Free to start • No credit card required
            </p>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-3 justify-center mt-12"
          >
            {FEATURE_PILLS.map((pill, idx) => (
              <React.Fragment key={pill}>
                {idx > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-[var(--color-text-muted)] self-center select-none"
                  >
                    ·
                  </span>
                )}
                <span className="px-4 py-2 bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '9999px', border: '1px solid var(--color-border)', padding: '0.5rem 1rem' }}>
                  {pill}
                </span>
              </React.Fragment>
            ))}
          </motion.div>
        </div>
      </PageContainer>

      {/* Features Grid */}
      <PageContainer as="section" maxWidth="7xl" className="py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-[var(--color-text-primary)] mb-4">Key Features</h2>
          <p className="text-xl text-[var(--color-text-secondary)]">
            Essential tools for PA school success and exam preparation
          </p>
        </motion.div>

        {/* Inline style is belt-and-suspenders: the CSS utility class may be
            purged or not apply if the bundle is partially stale. */}
        <div
          className="grid md:grid-cols-2 gap-8"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2rem' }}
        >
          {features.map((feature, idx) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="group p-8 bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-2xl border border-[var(--color-border)] hover:shadow-[0_18px_42px_var(--color-shadow-soft)] hover:scale-[1.02] transition-all duration-300"
              style={{ padding: '2rem', borderRadius: '1rem', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="w-14 h-14 bg-[var(--color-bg-tertiary)] rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-lg border border-[var(--color-border)]"
                style={{ width: '3.5rem', height: '3.5rem', flexShrink: 0 }}
                aria-hidden
              >
                <feature.icon className="w-7 h-7 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                {feature.title}
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {feature.description}
              </p>
            </motion.article>
          ))}
        </div>
      </PageContainer>

      {/* Benefits Section */}
      <PageContainer as="section" maxWidth="7xl" className="py-20">
        <div className="bg-[var(--color-bg-secondary)] rounded-3xl p-12 text-[var(--color-text-primary)] shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '1.5rem', padding: '3rem', border: '1px solid var(--color-border)' }}>
          <div
            className="grid lg:grid-cols-2 gap-12 items-center"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '3rem', alignItems: 'center' }}
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-4xl font-bold mb-6">Comprehensive Study Tools</h2>
              <p className="text-xl text-[var(--color-text-secondary)] mb-8">
                Track your performance, identify knowledge gaps, and focus your study time
                effectively.
              </p>
              <motion.button
                type="button"
                onClick={() => {
                  setAuthMode('sign-up');
                  setShowAuth(true);
                }}
                className="px-8 py-4 bg-transparent border-2 border-[var(--color-accent)] text-[var(--color-accent)] rounded-xl font-bold text-lg hover:bg-[var(--color-accent)]/10 transition-all duration-300 min-h-[48px]"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                aria-label="Start studying with a free account"
              >
                Start Studying
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              {benefits.map((benefit, idx) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.35, delay: idx * 0.04 }}
                  className="flex items-start gap-3 bg-[var(--color-bg-tertiary)]/60 backdrop-blur-sm rounded-xl p-4"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', borderRadius: '0.75rem', padding: '1rem', backgroundColor: 'var(--color-bg-tertiary)' }}
                >
                  <CheckCircle2
                    className="w-6 h-6 text-[var(--color-accent)] flex-shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <span className="text-lg font-medium leading-relaxed text-[var(--color-text-secondary)]">
                    {benefit}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </PageContainer>

      {/* CTA Section */}
      <PageContainer as="section" maxWidth="7xl" className="py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-[var(--color-text-primary)]">
            Ready to Start?
          </h2>
          <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Access all study modes and features with a free account.
          </p>
          <motion.button
            type="button"
            onClick={() => {
              setAuthMode('sign-up');
              setShowAuth(true);
            }}
            className="px-10 py-5 bg-transparent border-2 border-[var(--color-accent)] text-[var(--color-accent)] rounded-xl font-bold text-xl hover:bg-[var(--color-accent)]/10 transition-all duration-300 flex items-center gap-3 mx-auto min-h-[48px]"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            aria-label="Sign up for free"
          >
            Sign Up Free
            <ArrowRight className="w-6 h-6" aria-hidden />
          </motion.button>
        </motion.div>
      </PageContainer>

      </main>{/* end #landing-main */}

      {/* Footer */}
      <SiteFooter />

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setShowAuth(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md my-8"
            >
              <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] overflow-hidden border border-[var(--color-border)]">
                {/* Modal Header */}
                <div className="bg-[var(--color-bg-tertiary)] px-6 py-5 text-[var(--color-text-primary)]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 id="auth-modal-title" className="text-2xl font-bold">
                      {authMode === 'sign-up' ? 'Join PANaCEa' : 'Welcome Back'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAuth(false)}
                      className="p-2 hover:bg-[var(--color-bg-secondary)]/60 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Close sign in"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-base">
                    {authMode === 'sign-up'
                      ? 'Create your free account to start studying'
                      : 'Sign in to access your personalized study dashboard'}
                  </p>
                </div>

                {/* Clerk Component – theme-aware via AuthProvider variables + index.css .dark overrides */}
                <div className="p-6 [color-scheme:inherit]">
                  {authMode === 'sign-up' ? (
                    <SignUp
                      appearance={{
                        elements: {
                          rootBox: 'mx-auto',
                          card: 'bg-transparent shadow-none',
                          headerTitle: 'hidden',
                          headerSubtitle: 'hidden',
                          socialButtonsBlockButton:
                            'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] hover:scale-[1.02] transition-transform',
                          formButtonPrimary:
                            'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 hover:shadow-lg text-[var(--color-text-inverse)]',
                          formFieldLabel: 'text-[var(--color-text-primary)]',
                          formFieldInput:
                            'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
                          footerActionLink:
                            'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]',
                        },
                      }}
                      fallbackRedirectUrl="/"
                    />
                  ) : (
                    <SignIn
                      appearance={{
                        elements: {
                          rootBox: 'mx-auto',
                          card: 'bg-transparent shadow-none',
                          headerTitle: 'hidden',
                          headerSubtitle: 'hidden',
                          socialButtonsBlockButton:
                            'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] hover:scale-[1.02] transition-transform',
                          formButtonPrimary:
                            'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 hover:shadow-lg text-[var(--color-text-inverse)]',
                          formFieldLabel: 'text-[var(--color-text-primary)]',
                          formFieldInput:
                            'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
                          footerActionLink:
                            'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]',
                        },
                      }}
                      fallbackRedirectUrl="/"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
