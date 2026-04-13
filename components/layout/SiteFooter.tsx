/**
 * SiteFooter – Cinematic multi-column footer.
 * Glassmorphism treatment with gold accents, gradient fade-in from content.
 */

import React from 'react';

const LINKS = {
  Product: [
    { label: 'Study Modes', href: '#' },
    { label: 'Medical Database', href: '#' },
    { label: 'Performance Analytics', href: '#' },
    { label: 'PANCE Simulator', href: '#' },
  ],
  Resources: [
    { label: 'Study Tips', href: '#' },
    { label: 'PANCE Blueprint', href: '#' },
    { label: 'Study Groups', href: '#' },
    { label: 'FAQ', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Careers', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'HIPAA', href: '#' },
    { label: 'Accessibility', href: '#' },
  ],
} as const;

export const SiteFooter: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: 'linear-gradient(180deg, rgba(10, 14, 26, 0) 0%, rgba(10, 14, 26, 1) 12%)',
      }}
    >
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #c4b78a 0%, #e6d9b5 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                PANaCEa
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#64748b' }}>
              The cognitive prosthetic for PA students. Adaptive, evidence-based, built for clinical-year realities.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h4
                className="font-semibold uppercase mb-4"
                style={{
                  color: '#c4b78a',
                  letterSpacing: '0.08em',
                  fontSize: '0.6875rem',
                  opacity: 0.7,
                }}
              >
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm transition-colors duration-200"
                      style={{ color: '#64748b' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#c4b78a'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar with glass divider */}
      <div
        style={{
          borderTop: '1px solid rgba(196, 183, 138, 0.08)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: '#475569' }}>
            &copy; {year} PANaCEa. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: '#475569' }}>
            Not affiliated with NCCPA. Study smarter, not harder.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
