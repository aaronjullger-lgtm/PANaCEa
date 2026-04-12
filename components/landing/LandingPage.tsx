import React, { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { SignIn, SignUp } from '@clerk/clerk-react';
import ThemeToggleButton from '../ui/ThemeToggleButton';
import { AppBrand } from '../layout/AppBrand';
import { SiteFooter } from '../layout/SiteFooter';
import { SkipNavigation } from '../shared/SkipNavigation';
import { HeroSection } from './HeroSection';
import { FeaturesGrid } from './FeaturesGrid';
import { HowItWorks } from './HowItWorks';
import { FinalCTA } from './FinalCTA';

/**
 * Landing Page — Cinematic Rebuild
 *
 * Modular landing with Apple-grade hero, Stripe-grade features,
 * and Linear-grade polish. Auth modal shared across sections.
 */
export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (showAuth) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowAuth(false);
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

  const openSignUp = () => { setAuthMode('sign-up'); setShowAuth(true); };
  const openSignIn = () => { setAuthMode('sign-in'); setShowAuth(true); };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      <SkipNavigation mainContentId="landing-main" />

      {/* ═══ Glass Header ═══ */}
      <header
        className="sticky top-0 z-40 transition-all duration-300"
        style={{
          backgroundColor: 'rgba(10, 14, 26, 0.85)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <AppBrand size="lg" animate>
            <div className="flex items-center gap-3">
              <ThemeToggleButton />
              <button
                type="button"
                onClick={openSignIn}
                className="hidden sm:block px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                style={{
                  color: '#94a3b8',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
              >
                Sign In
              </button>
              <motion.button
                type="button"
                onClick={openSignUp}
                className="px-5 py-2 text-sm font-semibold rounded-lg min-h-[40px] transition-all duration-200"
                style={{
                  backgroundColor: '#c4b78a',
                  color: '#0a0e1a',
                }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              >
                Get Started
              </motion.button>
            </div>
          </AppBrand>
        </div>
      </header>

      <main id="landing-main">
        <HeroSection onSignUp={openSignUp} onSignIn={openSignIn} prefersReducedMotion={prefersReducedMotion} />
        <FeaturesGrid prefersReducedMotion={prefersReducedMotion} />
        <HowItWorks onSignUp={openSignUp} prefersReducedMotion={prefersReducedMotion} />
        <FinalCTA onSignUp={openSignUp} onSignIn={openSignIn} prefersReducedMotion={prefersReducedMotion} />
      </main>

      <SiteFooter />

      {/* ═══ Auth Modal ═══ */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            style={{
              backgroundColor: 'rgba(10, 14, 26, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
            onClick={() => setShowAuth(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '28rem', margin: '2rem 0' }}
            >
              <div
                className="overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                }}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div>
                    <h3 id="auth-modal-title" className="text-xl font-bold text-[var(--color-text-primary)]">
                      {authMode === 'sign-up' ? 'Join PANaCEa' : 'Welcome Back'}
                    </h3>
                    <p className="text-sm mt-1 text-[var(--color-text-secondary)]">
                      {authMode === 'sign-up'
                        ? 'Create your free account to start studying'
                        : 'Sign in to your personalized dashboard'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuth(false)}
                    className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

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
  );
}
