/**
 * SiteFooter – Professional multi-column footer.
 * 4-column layout: Product, Resources, Company, Legal.
 * Dark background with subtle divider.
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
        backgroundColor: '#0a0e1a',
        borderTop: '1px solid rgba(148, 163, 184, 0.06)',
      }}
    >
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl font-bold" style={{ color: '#c4b78a' }}>PANaCEa</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#64748b' }}>
              The cognitive prosthetic for PA students. Adaptive, evidence-based, built for clinical-year realities.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h4
                className="text-label font-semibold uppercase mb-4"
                style={{ color: '#94a3b8', letterSpacing: '0.06em', fontSize: '0.6875rem' }}
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
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9'; }}
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

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: '#475569' }}>
            © {year} PANaCEa. All rights reserved.
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
