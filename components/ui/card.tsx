import React from 'react';

/**
 * Card — Unified card primitive for PANaCEa
 *
 * Uses the ring-shadow elevation system (box-shadow: 0 0 0 1px border, 0 1px 2px ambient)
 * instead of Tailwind `shadow-sm` + `border` combos. This ensures consistent depth
 * language across all surfaces.
 *
 * Compound components: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
 */

/* ---------- Ring-shadow value (single source of truth) ---------- */
const RING_SHADOW = '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Pass-through click handler for interactive cards */
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      className={`bg-[var(--color-bg-secondary)] rounded-xl ${className}`}
      style={{ boxShadow: RING_SHADOW }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`px-5 py-3.5 ${className}`}
      style={{ boxShadow: 'inset 0 -1px 0 0 var(--color-border)' }}
    >
      {children}
    </div>
  );
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'h4';
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '', as: Tag = 'h3' }) => {
  return (
    <Tag className={`text-base font-semibold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </Tag>
  );
};

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const CardDescription: React.FC<CardDescriptionProps> = ({ children, className = '' }) => {
  return (
    <p className={`text-sm text-[var(--color-text-muted)] mt-0.5 ${className}`}>
      {children}
    </p>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`px-5 py-3 ${className}`}
      style={{ boxShadow: 'inset 0 1px 0 0 var(--color-border)' }}
    >
      {children}
    </div>
  );
};

/** Re-export the ring-shadow value for components that need it inline */
export const CARD_RING_SHADOW = RING_SHADOW;
