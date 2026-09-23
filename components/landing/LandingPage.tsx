import React, { useEffect, useRef, useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { ArrowRight, Check, Menu, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Hero } from './Hero';
import { ConceptLearning } from './ConceptLearning';
import { LandingBrand, LandingMark } from './LandingBrand';
import { BuiltForStudents, LearningEngine, StudyChallenges } from './LearningExperience';
import { TrainingModesDock } from './TrainingModesDock';
import { NAV_LINKS } from './content';
import './landing.css';

type AuthMode = 'sign-in' | 'sign-up';

const clerkAppearance = {
  elements: {
    rootBox: 'mx-auto w-full',
    card: 'bg-transparent shadow-none border-0',
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',
    socialButtonsBlockButton: 'landing-auth-social',
    formButtonPrimary: 'landing-auth-submit',
    formFieldLabel: 'landing-auth-label',
    formFieldInput: 'landing-auth-input',
    footerActionLink: 'landing-auth-link',
  },
};

function LandingHeader({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    // A resized desktop should never leave a hidden menu waiting to reopen.
    const desktop = window.matchMedia('(min-width: 1100px)');
    const closeAtDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    desktop.addEventListener('change', closeAtDesktop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      desktop.removeEventListener('change', closeAtDesktop);
    };
  }, [mobileOpen]);

  return (
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <a href="#hero" aria-label="PANaCEa home">
          <LandingBrand />
        </a>
        <nav className="landing-desktop-nav" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="landing-header-actions">
          <button type="button" className="landing-login" onClick={onSignIn}>
            Log in
          </button>
          <button type="button" className="landing-button landing-button-small" onClick={onSignUp}>
            Get started <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          ref={menuButtonRef}
          className="landing-menu-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-menu"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        >
          {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>
      {mobileOpen && (
        <div id="landing-mobile-menu" className="landing-mobile-menu">
          <nav aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            ))}
          </nav>
          <div>
            <button
              type="button"
              className="landing-button"
              onClick={() => {
                setMobileOpen(false);
                onSignUp();
              }}
            >
              Build my study plan <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="landing-login"
              onClick={() => {
                setMobileOpen(false);
                onSignIn();
              }}
            >
              Log in
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function AuthDialog({
  authMode,
  onClose,
  onRestoreFocus,
}: {
  authMode: AuthMode;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="landing-auth"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <DialogHeader className="landing-auth-heading">
          <LandingMark className="landing-auth-mark" />
          <DialogTitle>
            {authMode === 'sign-up' ? 'Your next chapter starts here.' : 'Welcome back.'}
          </DialogTitle>
          <DialogDescription>
            {authMode === 'sign-up'
              ? 'Create your PANaCEa account to start building your personal study plan.'
              : 'Pick up your study plan where you left off.'}
          </DialogDescription>
        </DialogHeader>
        <div className="landing-auth-form">
          {authMode === 'sign-up' ? (
            <SignUp appearance={clerkAppearance} fallbackRedirectUrl="/" />
          ) : (
            <SignIn appearance={clerkAppearance} fallbackRedirectUrl="/" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LandingFooter({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <footer className="landing-footer landing-dark">
      <div className="landing-container landing-footer-grid">
        <div className="landing-footer-brand">
          <a href="#hero" aria-label="PANaCEa home">
            <LandingBrand />
          </a>
          <p>
            Adaptive clinical learning.
            <br />A clearer next step, every study day.
          </p>
        </div>
        <nav aria-label="Explore PANaCEa">
          <h2>Explore</h2>
          <a href="#diagnostic-story">How it works</a>
          <a href="#training-modes">Study modes</a>
          <a href="#analytics-preview">Example study plan</a>
        </nav>
        <nav aria-label="Your account">
          <h2>Your account</h2>
          <button type="button" onClick={onSignUp}>
            Get started
          </button>
          <button type="button" onClick={onSignIn}>
            Log in
          </button>
          <a href="#image-lab">Built for PA students</a>
        </nav>
        <div className="landing-footer-note">
          <p>
            Built for learning.
            <br />
            Not for clinical decision-making.
          </p>
          <p>© {new Date().getFullYear()} PANaCEa.</p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('sign-up');
  const [showAuth, setShowAuth] = useState(false);
  const authTriggerRef = useRef<HTMLElement | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const openAuth = (mode: AuthMode) => {
    authTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAuthMode(mode);
    setShowAuth(true);
  };
  const openSignUp = () => openAuth('sign-up');
  const openSignIn = () => openAuth('sign-in');

  useEffect(() => {
    if (!showAuth) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showAuth]);

  const restoreAuthFocus = () => {
    // Mobile menu entry points are unmounted before the dialog opens.
    const trigger = authTriggerRef.current;
    if (trigger?.isConnected) trigger.focus();
    else document.querySelector<HTMLButtonElement>('.landing-menu-toggle')?.focus();
  };

  return (
    <div className="landing-page">
      <a
        className="landing-skip-link"
        href="#landing-main"
        onClick={() => mainRef.current?.focus()}
      >
        Skip to main content
      </a>
      <LandingHeader onSignIn={openSignIn} onSignUp={openSignUp} />
      <main id="landing-main" ref={mainRef} tabIndex={-1}>
        <Hero onStartStudying={openSignUp} />
        <StudyChallenges />
        <LearningEngine />
        <ConceptLearning />
        <TrainingModesDock onStartStudying={openSignUp} />
        <BuiltForStudents onStartStudying={openSignUp} />
        <section id="start" className="landing-final" aria-labelledby="final-cta-title">
          <div className="landing-container landing-final-inner">
            <div className="landing-app-mark">
              <LandingMark />
            </div>
            <div>
              <p className="landing-intro">Your next best action starts now.</p>
              <h2 id="final-cta-title">
                Stop studying harder.
                <br />
                Start studying <em>smarter.</em>
              </h2>
              <p className="landing-final-assurances">
                <span>
                  <Check size={16} aria-hidden="true" /> Your goals
                </span>
                <span>
                  <Check size={16} aria-hidden="true" /> Your pace
                </span>
                <span>
                  <Check size={16} aria-hidden="true" /> Your next step
                </span>
              </p>
            </div>
            <div className="landing-final-actions">
              <button type="button" className="landing-button" onClick={openSignUp}>
                Build my study plan <ArrowRight size={19} aria-hidden="true" />
              </button>
              <button type="button" className="landing-login" onClick={openSignIn}>
                Already have an account? Log in
              </button>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter onSignIn={openSignIn} onSignUp={openSignUp} />
      {showAuth && (
        <AuthDialog
          authMode={authMode}
          onClose={() => setShowAuth(false)}
          onRestoreFocus={restoreAuthFocus}
        />
      )}
    </div>
  );
}
