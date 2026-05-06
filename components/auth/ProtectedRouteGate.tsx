import React, { useEffect, useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProtectedRouteIntent } from '@/lib/routing/protectedRouteIntent';

type ProtectedRouteGateProps = {
  pathname: string;
  authLoading?: boolean;
};

export function ProtectedRouteGate({ pathname, authLoading = false }: ProtectedRouteGateProps) {
  const intent = getProtectedRouteIntent(pathname);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>(intent.primaryAction);

  useEffect(() => {
    setAuthMode(intent.primaryAction);
  }, [intent.primaryAction, pathname]);

  const AuthComponent = authMode === 'sign-in' ? SignIn : SignUp;

  return (
    <main className="min-h-screen bg-[var(--color-canvas,#F8FAFC)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          PANaCEa home
        </Link>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,440px)]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
              {intent.eyebrow}
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-normal text-[var(--color-text-primary)] sm:text-4xl">
              {intent.title}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
              {intent.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setAuthMode('sign-in')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                  authMode === 'sign-in'
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('sign-up')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                  authMode === 'sign-up'
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                Create account
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
            {authLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-xl bg-[var(--color-bg-secondary)] px-6 text-center"
              >
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Checking access...
                </p>
                <p className="max-w-xs text-xs leading-5 text-[var(--color-text-secondary)]">
                  PANaCEa is confirming whether to open your workspace or show sign-in.
                </p>
              </div>
            ) : (
              <AuthComponent routing="hash" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default ProtectedRouteGate;
