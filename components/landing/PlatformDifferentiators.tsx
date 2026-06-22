import { motion, useReducedMotion } from 'motion/react';
import { MedicalGlassCard, SectionHeader } from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import { PANCE_REASONING_STAT, PLATFORM_DIFFERENTIATORS } from './content';

function ReasoningStatCallout() {
  return (
    <div className="rounded-3xl border border-atlas-border-glow bg-atlas-cyan/10 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
            NCCPA blueprint, 2025
          </p>
          <p className="mt-3 font-mono text-6xl font-semibold tabular-nums text-atlas-white">
            {PANCE_REASONING_STAT.value}
          </p>
          <p className="mt-2 max-w-md text-sm font-semibold text-atlas-white">
            {PANCE_REASONING_STAT.label}
          </p>
        </div>
        <p className="max-w-sm text-xs leading-6 text-atlas-muted sm:text-sm">
          {PANCE_REASONING_STAT.detail}
        </p>
      </div>
    </div>
  );
}

function DifferentiatorCard({
  item,
  index,
  reducedMotion,
}: {
  item: (typeof PLATFORM_DIFFERENTIATORS)[number];
  index: number;
  reducedMotion: boolean;
}) {
  const Icon = item.icon;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.3, delay: reducedMotion ? 0 : index * 0.06 }}
    >
      <MedicalGlassCard className="h-full p-5 sm:p-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-atlas-border-glow bg-atlas-cyan/10 text-atlas-cyan">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-poppins text-lg font-semibold leading-snug text-atlas-white">
          {item.claim}
        </h3>
        <p className="mt-3 text-sm leading-6 text-atlas-muted">{item.mechanism}</p>
      </MedicalGlassCard>
    </motion.div>
  );
}

export function PlatformDifferentiators() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section
      id="why-panacea"
      aria-labelledby="why-panacea-title"
      className="relative scroll-mt-24 overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage: "url('/assets/differentiators-network.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-atlas-background via-transparent to-atlas-background" />
      <div className="relative mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Why this is different"
          title="No other PANCE platform can say this."
          description="These are mechanisms, not marketing claims — each one names the actual technique behind it."
          titleAs="h2"
          titleId="why-panacea-title"
        />

        <div className="mt-8">
          <ReasoningStatCallout />
        </div>

        <div className={cn('mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3')}>
          {PLATFORM_DIFFERENTIATORS.map((item, index) => (
            <DifferentiatorCard
              key={item.id}
              item={item}
              index={index}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
