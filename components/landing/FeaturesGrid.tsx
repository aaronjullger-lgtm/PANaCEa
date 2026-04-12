import React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  TrendingUp,
  Brain,
  Stethoscope,
  BarChart3,
  Zap,
  Shield,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Brain,
    title: 'Adaptive Spaced Repetition',
    desc: 'FSRS v6 algorithm with implicit behavioral rating — no manual "Easy/Hard" buttons. The system learns how well you know each card from your response patterns.',
    accent: 'var(--color-accent)',
    accentBg: 'rgba(122, 111, 82, 0.08)',
    accentBorder: 'rgba(122, 111, 82, 0.12)',
  },
  {
    icon: Stethoscope,
    title: 'Clinical Drill Modes',
    desc: 'DDx, pharmacology, first-line treatment, ECG, imaging, anatomy, and more. 15+ specialized modes that go beyond basic Q&A.',
    accent: '#0ea5e9',
    accentBg: 'rgba(14, 165, 233, 0.08)',
    accentBorder: 'rgba(14, 165, 233, 0.12)',
  },
  {
    icon: BookOpen,
    title: 'Medical Database',
    desc: '1,000+ conditions with treatments, labs, clinical guidelines, and differential diagnoses — all searchable and cross-referenced.',
    accent: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.08)',
    accentBorder: 'rgba(16, 185, 129, 0.12)',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    desc: 'Track accuracy by system, identify weak areas, monitor your study streaks, and see predicted retention curves.',
    accent: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.08)',
    accentBorder: 'rgba(245, 158, 11, 0.12)',
  },
  {
    icon: Zap,
    title: 'AI-Powered Content',
    desc: 'Questions generated and graded by AI, with structured rationales, clinical pearls, and mnemonic aids built in.',
    accent: '#ef4444',
    accentBg: 'rgba(239, 68, 68, 0.08)',
    accentBorder: 'rgba(239, 68, 68, 0.12)',
  },
  {
    icon: Shield,
    title: 'Exam-Aligned Blueprint',
    desc: 'Strict NCCPA blueprint weighting for PANCE simulation. Every session mirrors the real exam distribution.',
    accent: '#8b5cf6',
    accentBg: 'rgba(139, 92, 246, 0.08)',
    accentBorder: 'rgba(139, 92, 246, 0.12)',
  },
] as const;

interface FeaturesGridProps {
  prefersReducedMotion: boolean;
}

export function FeaturesGrid({ prefersReducedMotion }: FeaturesGridProps) {
  const fadeUpView = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.15 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
        };

  return (
    <section className="py-24 sm:py-32" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div {...fadeUpView(0)} className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-overline font-semibold uppercase mb-5"
            style={{
              backgroundColor: 'rgba(196, 183, 138, 0.08)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(196, 183, 138, 0.15)',
              letterSpacing: '0.1em',
              fontSize: '0.6875rem',
            }}
          >
            Features
          </span>
          <h2
            className="text-display-sm sm:text-display font-bold text-[var(--color-text-primary)] mb-4"
            style={{ letterSpacing: '-0.025em' }}
          >
            Everything You Need to Pass
          </h2>
          <p className="text-body-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Purpose-built for PA students. Every feature mapped to the NCCPA content blueprint.
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, idx) => (
            <motion.article
              key={feature.title}
              {...fadeUpView(idx * 0.06)}
              whileHover={prefersReducedMotion ? undefined : { y: -3, transition: { duration: 0.2 } }}
              className="group relative p-7 rounded-2xl transition-all duration-300 cursor-default"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.04), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 1px ${feature.accentBorder}, 0 12px 32px -8px rgba(0, 0, 0, 0.08)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.04), 0 2px 8px -2px rgba(0, 0, 0, 0.04)';
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: feature.accentBg, border: `1px solid ${feature.accentBorder}` }}
              >
                <feature.icon className="w-5 h-5" style={{ color: feature.accent }} />
              </div>
              <h3 className="text-h3 font-semibold text-[var(--color-text-primary)] mb-2">
                {feature.title}
              </h3>
              <p className="text-body-sm text-[var(--color-text-secondary)] leading-relaxed">
                {feature.desc}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
