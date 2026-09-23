import React from 'react';

/** Landing identity follows the owner's crosshair reference; app icons stay unchanged. */
export function LandingMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="21 6"
        transform="rotate(-36 24 24)"
      />
      <path
        d="M24 2v13M24 33v13M2 24h13M33 24h13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="5" fill="var(--landing-accent-soft)" />
      <circle cx="24" cy="24" r="2.5" fill="var(--landing-accent)" />
    </svg>
  );
}

export function LandingBrand() {
  return (
    <span className="landing-brand">
      <LandingMark />
      <span>
        <span className="landing-wordmark">PANaCEa</span>
        <span className="landing-brand-caption">Clinical learning engine</span>
      </span>
    </span>
  );
}
