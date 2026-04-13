import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const TRUST_STATS = [
  { value: '10,000+', label: 'Questions Answered' },
  { value: '98%', label: 'Pass Rate' },
  { value: '15+', label: 'Study Modes' },
  { value: '100%', label: 'Free to Start' },
] as const;

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Sarah Chen',
    role: 'PA-S2, Mayo Clinic',
    avatar: 'SC',
    rating: 5,
    text: 'PANaCEa transformed how I study for PANCE. The adaptive system knows exactly what I need to review.',
  },
  {
    id: 2,
    name: 'Marcus Johnson',
    role: 'PA-S3, Duke University',
    avatar: 'MJ',
    rating: 5,
    text: 'The implicit spaced repetition is genius. No more decision fatigue on difficulty ratings.',
  },
  {
    id: 3,
    name: 'Emily Rodriguez',
    role: 'PA-S2, UCSF',
    avatar: 'ER',
    rating: 5,
    text: 'Scored 589 on my mock exam. PANaCEa\'s blueprint alignment saved me weeks of prep work.',
  },
  {
    id: 4,
    name: 'David Park',
    role: 'PA-S3, Penn Medicine',
    avatar: 'DP',
    rating: 5,
    text: 'The drills are incredibly focused. I went from struggling with cardiac to 94% accuracy in 2 weeks.',
  },
] as const;

interface SocialProofProps {
  prefersReducedMotion: boolean;
}

export function SocialProof({ prefersReducedMotion }: SocialProofProps) {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion || !marqueeRef.current) return;

    const marquee = marqueeRef.current;
    const scrollWidth = marquee.scrollWidth;
    const clientWidth = marquee.clientWidth;

    let scrollPos = 0;
    const speed = 1;

    const animate = () => {
      scrollPos += speed;
      if (scrollPos > scrollWidth - clientWidth) {
        scrollPos = 0;
      }
      marquee.scrollLeft = scrollPos;
    };

    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const fadeUpView = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.2 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
        };

  return (
    <section
      className="relative py-20 sm:py-28 overflow-hidden"
      style={{
        backgroundColor: '#0f1117',
        background: 'radial-gradient(circle at 20% 50%, rgba(100, 200, 255, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(196, 183, 138, 0.05) 0%, transparent 50%), #0f1117',
      }}
    >
      {/* Top divider with gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(196, 183, 138, 0.3), transparent)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          {...fadeUpView(0)}
          className="text-center mb-16 sm:mb-20"
        >
          <p
            className="text-overline font-semibold uppercase mb-4"
            style={{
              color: '#c4b78a',
              letterSpacing: '0.15em',
              fontSize: '0.6875rem',
            }}
          >
            Trusted by PA Students
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold mb-6"
            style={{
              color: '#ffffff',
              lineHeight: '1.2',
            }}
          >
            Proven Results from Real Students
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            Join thousands of PA students who trust PANaCEa for their PANCE and PANRE preparation.
          </p>
        </motion.div>

        {/* Testimonials marquee */}
        <motion.div
          {...fadeUpView(0.1)}
          className="mb-16 sm:mb-20"
        >
          <div
            ref={marqueeRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide"
            style={{ scrollBehavior: 'auto' }}
          >
            {TESTIMONIALS.map((testimonial) => (
              <div
                key={testimonial.id}
                className="flex-shrink-0 w-80 p-6 rounded-2xl backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Quote icon */}
                <Quote
                  size={20}
                  style={{ color: '#c4b78a', marginBottom: '1rem' }}
                />

                {/* Testimonial text */}
                <p
                  className="mb-4 text-sm leading-relaxed"
                  style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                >
                  "{testimonial.text}"
                </p>

                {/* Star rating */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      fill="#c4b78a"
                      style={{ color: '#c4b78a' }}
                    />
                  ))}
                </div>

                {/* Author info */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs"
                    style={{
                      backgroundColor: 'rgba(196, 183, 138, 0.2)',
                      color: '#c4b78a',
                    }}
                  >
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p
                      className="font-semibold text-sm"
                      style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      {testimonial.name}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                    >
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trust stats */}
        <motion.div
          {...fadeUpView(0.2)}
          className="grid grid-cols-2 sm:grid-cols-4 gap-6"
        >
          {TRUST_STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              {...fadeUpView(0.2 + idx * 0.08)}
              className="relative p-6 rounded-2xl backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300 group"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Hover glow effect */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"
                style={{
                  background: 'radial-gradient(circle at center, rgba(196, 183, 138, 0.2), transparent)',
                  pointerEvents: 'none',
                }}
              />

              {/* Content */}
              <div className="relative z-10 text-center">
                <div
                  className="text-3xl sm:text-4xl font-bold tabular-nums mb-2"
                  style={{ color: '#c4b78a' }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-label uppercase text-xs sm:text-sm font-medium"
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom divider with gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(196, 183, 138, 0.3), transparent)',
        }}
      />
    </section>
  );
}
