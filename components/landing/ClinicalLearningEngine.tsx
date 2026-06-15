'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { ENGINE_STAGES, type EngineStage, type EngineStageId } from './content';

/**
 * The Clinical Learning Engine — PANaCEa's signature visual.
 *
 * It renders the adaptive loop as a single comprehensible scene rather than an
 * unexplained particle field:
 *   behavior signal -> reasoning over clinical systems -> blueprint risk ->
 *   one prescribed action -> learning update.
 *
 * The canvas is decorative (aria-hidden); the meaning lives in the visible,
 * screen-reader-available legend below it. Motion respects prefers-reduced-motion
 * (frozen on the "prescription" beat), pauses when offscreen, and degrades to a
 * static composition on low-power devices via the same code path.
 */

type EngineColors = {
  cyan: string;
  blue: string;
  violet: string;
  pulse: string;
  success: string;
  gold: string;
  white: string;
  muted: string;
};

const TONE_VAR: Record<EngineStage['tone'], string> = {
  cyan: '--atlas-accent-cyan',
  blue: '--atlas-accent-blue',
  violet: '--atlas-accent-violet',
  pulse: '--atlas-accent-pulse-pink',
  success: '--atlas-success-green',
  gold: '--atlas-accent-gold',
};

// Six clinical-system nodes arranged on an arc around the core. The fragile one
// (cardiology) escalates during the "risk" beat and becomes the prescribed focus.
const NODES = [
  { label: 'Cardio', angle: -1.45, fragile: true },
  { label: 'Pulm', angle: -0.78, fragile: false },
  { label: 'GI', angle: -0.1, fragile: false },
  { label: 'Endo', angle: 0.58, fragile: false },
  { label: 'Renal', angle: 1.3, fragile: false },
  { label: 'Neuro', angle: 2.4, fragile: false },
] as const;

const STAGE_ORDER: EngineStageId[] = ENGINE_STAGES.map((stage) => stage.id);
const STAGE_DURATION_MS = 3600;
const FIRST_STAGE: EngineStage = ENGINE_STAGES[0] as EngineStage;

function stageIdAt(index: number): EngineStageId {
  return STAGE_ORDER[index] ?? FIRST_STAGE.id;
}

function stageAt(index: number): EngineStage {
  return ENGINE_STAGES[index] ?? FIRST_STAGE;
}

function readVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readColors(): EngineColors {
  return {
    cyan: readVar('--atlas-accent-cyan', '#67e8f9'),
    blue: readVar('--atlas-accent-blue', '#60a5fa'),
    violet: readVar('--atlas-accent-violet', '#a78bfa'),
    pulse: readVar('--atlas-accent-pulse-pink', '#fb7185'),
    success: readVar('--atlas-success-green', '#34d399'),
    gold: readVar('--atlas-accent-gold', '#d8b25a'),
    white: readVar('--atlas-clinical-white', '#f8fbff'),
    muted: readVar('--atlas-text-muted', '#a9bad0'),
  };
}

function rgba(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const norm =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    const v = Number.parseInt(norm, 16);
    return `rgb(${(v >> 16) & 255} ${(v >> 8) & 255} ${v & 255} / ${alpha})`;
  }
  return color;
}

// Smoothly approach a target — frame-rate independent enough for a hero loop.
function approach(current: number, target: number, rate: number) {
  return current + (target - current) * rate;
}

type StageEnergy = {
  signal: number;
  reasoning: number;
  risk: number;
  prescription: number;
  update: number;
};

function targetEnergy(stage: EngineStageId): StageEnergy {
  // Each beat foregrounds one element while neighbors linger, so the loop reads
  // as a continuous system rather than discrete slides.
  switch (stage) {
    case 'signal':
      return { signal: 1, reasoning: 0.25, risk: 0.1, prescription: 0.05, update: 0.2 };
    case 'reasoning':
      return { signal: 0.5, reasoning: 1, risk: 0.3, prescription: 0.08, update: 0.15 };
    case 'risk':
      return { signal: 0.3, reasoning: 0.7, risk: 1, prescription: 0.25, update: 0.12 };
    case 'prescription':
      return { signal: 0.18, reasoning: 0.4, risk: 0.55, prescription: 1, update: 0.2 };
    case 'update':
      return { signal: 0.35, reasoning: 0.5, risk: 0.3, prescription: 0.45, update: 1 };
    default:
      return { signal: 0.4, reasoning: 0.4, risk: 0.4, prescription: 0.4, update: 0.4 };
  }
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: EngineColors,
  energy: StageEnergy,
  elapsed: number,
  reducedMotion: boolean,
  showLabels: boolean,
) {
  ctx.clearRect(0, 0, width, height);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const size = Math.min(width, height);
  const scale = size / 460;
  const t = reducedMotion ? 0 : elapsed;
  const coreR = 46 * scale;

  // Ambient depth glow behind the core.
  const ambient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.6);
  ambient.addColorStop(0, rgba(colors.cyan, 0.12));
  ambient.addColorStop(0.55, rgba(colors.blue, 0.05));
  ambient.addColorStop(1, rgba(colors.violet, 0));
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);

  // --- Beat 01: incoming behavior signal (waveform from the left edge) ---
  if (energy.signal > 0.02) {
    const baseY = cy;
    const amp = 16 * scale * energy.signal;
    ctx.strokeStyle = rgba(colors.cyan, 0.16 + 0.5 * energy.signal);
    ctx.lineWidth = 1.6 * scale;
    ctx.shadowColor = rgba(colors.cyan, 0.4 * energy.signal);
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    const startX = width * 0.04;
    const endX = cx - coreR * 0.9;
    for (let x = startX; x <= endX; x += 3) {
      const p = (x - startX) / Math.max(1, endX - startX);
      // ECG-like cadence: mostly flat with a periodic spike, travelling inward.
      const phase = p * 9 - t * 2.2;
      const beat = Math.exp(-Math.pow(((phase % 6) + 6) % 6 - 3, 2) * 1.6);
      const wobble = Math.sin(phase * 1.3) * 0.18;
      const y = baseY - (beat * 2.2 + wobble) * amp * (0.4 + 0.6 * p);
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // --- Beat 03: blueprint rings (orbital bands = exam-domain weighting) ---
  const ringEnergy = Math.max(energy.reasoning * 0.5, energy.risk);
  const rings = [
    { r: 92, tilt: 0.0, color: colors.cyan, a: 0.34 },
    { r: 120, tilt: 0.7, color: colors.blue, a: 0.26 },
    { r: 150, tilt: -0.6, color: colors.violet, a: 0.2 },
  ];
  rings.forEach((ring, i) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ring.tilt + t * 0.08 * (i % 2 === 0 ? 1 : -1));
    ctx.strokeStyle = rgba(ring.color, ring.a * (0.4 + 0.6 * ringEnergy));
    ctx.lineWidth = 1.1 * scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, ring.r * scale, ring.r * scale * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // --- Beat 02: reasoning nodes + pathways to the core ---
  const nodeRadius = 132 * scale;
  const positions = NODES.map((n) => ({
    ...n,
    x: cx + Math.cos(n.angle) * nodeRadius,
    y: cy + Math.sin(n.angle) * nodeRadius * 0.74,
  }));

  // pathways
  positions.forEach((n) => {
    const pathEnergy = n.fragile
      ? Math.max(energy.reasoning, energy.risk, energy.prescription)
      : energy.reasoning;
    if (pathEnergy < 0.04) return;
    const grad = ctx.createLinearGradient(n.x, n.y, cx, cy);
    const c = n.fragile && energy.risk > 0.3 ? colors.pulse : colors.cyan;
    grad.addColorStop(0, rgba(c, 0.05));
    grad.addColorStop(1, rgba(c, 0.32 * pathEnergy));
    ctx.strokeStyle = grad;
    ctx.lineWidth = (n.fragile ? 1.6 : 1) * scale;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.quadraticCurveTo((n.x + cx) / 2, (n.y + cy) / 2 - 10 * scale, cx, cy);
    ctx.stroke();

    // travelling signal pulse along fragile path during reasoning/risk
    if (!reducedMotion && n.fragile && pathEnergy > 0.3) {
      const tp = (t * 0.5) % 1;
      const px = n.x + (cx - n.x) * tp;
      const py = n.y + (cy - n.y) * tp - Math.sin(tp * Math.PI) * 10 * scale;
      ctx.fillStyle = rgba(colors.pulse, 0.8 * pathEnergy);
      ctx.beginPath();
      ctx.arc(px, py, 2.6 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // nodes
  positions.forEach((n) => {
    const fragileHeat = n.fragile ? energy.risk : 0;
    const baseAlpha = 0.4 + 0.5 * energy.reasoning;
    const c = fragileHeat > 0.35 ? colors.pulse : colors.cyan;
    const pulse = n.fragile && !reducedMotion ? 1 + Math.sin(t * 3) * 0.12 * fragileHeat : 1;
    const r = (n.fragile ? 7 : 5) * scale * pulse;
    ctx.shadowColor = rgba(c, 0.5 * (baseAlpha + fragileHeat));
    ctx.shadowBlur = 14 * scale;
    ctx.fillStyle = rgba(c, baseAlpha + fragileHeat * 0.5);
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (showLabels) {
      ctx.font = `${10 * scale}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = rgba(colors.muted, 0.55 + 0.4 * energy.reasoning);
      ctx.textAlign = n.x < cx ? 'end' : 'start';
      ctx.textBaseline = 'middle';
      const lx = n.x + (n.x < cx ? -10 : 10) * scale;
      ctx.fillText(n.label, lx, n.y);
    }
  });

  // --- Core: the unified learner model ---
  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.1);
  const coreColor =
    energy.prescription > 0.55 ? colors.gold : energy.update > 0.55 ? colors.success : colors.cyan;
  coreGlow.addColorStop(0, rgba(colors.white, 0.22));
  coreGlow.addColorStop(0.4, rgba(coreColor, 0.34));
  coreGlow.addColorStop(1, rgba(coreColor, 0));
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(coreColor, 0.6);
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(coreColor, 0.1);
  ctx.fill();

  // --- Beat 04: clinical focus frame collapses onto the prescription ---
  if (energy.prescription > 0.04) {
    const e = energy.prescription;
    const frame = (coreR + 26 * scale) * (1.8 - 0.8 * e); // contracts as it locks
    ctx.strokeStyle = rgba(colors.gold, 0.85 * e);
    ctx.lineWidth = 1.6 * scale;
    const len = 14 * scale;
    const corners: Array<[number, number]> = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    corners.forEach(([sx, sy]) => {
      const x = cx + sx * frame;
      const y = cy + sy * frame;
      ctx.beginPath();
      ctx.moveTo(x, y + sy * -len);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * -len, y);
      ctx.stroke();
    });
    // crosshair ticks
    ctx.strokeStyle = rgba(colors.gold, 0.5 * e);
    ctx.beginPath();
    ctx.moveTo(cx - frame, cy);
    ctx.lineTo(cx - frame + len, cy);
    ctx.moveTo(cx + frame, cy);
    ctx.lineTo(cx + frame - len, cy);
    ctx.stroke();
  }

  // --- Beat 05: memory-trace arcs fade outward (retention update) ---
  if (energy.update > 0.04) {
    const e = energy.update;
    for (let i = 0; i < 3; i += 1) {
      const prog = reducedMotion ? 0.5 : ((t * 0.4 + i / 3) % 1);
      const r = coreR + prog * 120 * scale;
      ctx.strokeStyle = rgba(colors.success, (1 - prog) * 0.5 * e);
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.42, 0, -0.9, 0.9);
      ctx.stroke();
    }
  }
}

export interface ClinicalLearningEngineProps {
  className?: string;
}

export function ClinicalLearningEngine({ className }: ClinicalLearningEngineProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageIndex, setStageIndex] = useState(prefersReducedMotion ? 3 : 0);
  const stageRef = useRef(stageIndex);
  stageRef.current = stageIndex;

  const activeStage: EngineStage = useMemo(() => stageAt(stageIndex), [stageIndex]);

  // Advance the loop on a timer; pause when offscreen or reduced-motion.
  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const el = containerRef.current;
    let interval: number | undefined;
    let visible = true;

    const tick = () => setStageIndex((i) => (i + 1) % STAGE_ORDER.length);
    const start = () => {
      if (interval == null) interval = window.setInterval(tick, STAGE_DURATION_MS);
    };
    const stop = () => {
      if (interval != null) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };

    const observer = el
      ? new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;
            visible = entry.isIntersecting;
            if (visible) start();
            else stop();
          },
          { threshold: 0.15 },
        )
      : undefined;
    observer?.observe(el as Element);
    if (!observer) start();

    return () => {
      stop();
      observer?.disconnect();
    };
  }, [prefersReducedMotion]);

  // Canvas render loop with smooth energy interpolation.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    const colors = readColors();
    let raf = 0;
    let started = performance.now();
    let visible = true;
    const energy: StageEnergy = targetEnergy(stageIdAt(stageRef.current));

    const frame = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = targetEnergy(stageIdAt(stageRef.current));
      const rate = prefersReducedMotion ? 1 : 0.06;
      energy.signal = approach(energy.signal, target.signal, rate);
      energy.reasoning = approach(energy.reasoning, target.reasoning, rate);
      energy.risk = approach(energy.risk, target.risk, rate);
      energy.prescription = approach(energy.prescription, target.prescription, rate);
      energy.update = approach(energy.update, target.update, rate);

      drawScene(ctx, w, h, colors, energy, (now - started) / 1000, prefersReducedMotion, w > 360);

      if (!prefersReducedMotion && visible) raf = window.requestAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const wasVisible = visible;
        visible = entry.isIntersecting;
        if (visible && !wasVisible && !prefersReducedMotion) {
          started = performance.now();
          raf = window.requestAnimationFrame(frame);
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(canvas);

    const resize = new ResizeObserver(() => {
      if (prefersReducedMotion) frame(performance.now());
    });
    resize.observe(canvas);

    frame(performance.now());

    return () => {
      observer.disconnect();
      resize.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className={cn('relative flex h-full flex-col', className)}>
      <div className="relative min-h-[20rem] flex-1 overflow-hidden sm:min-h-[26rem]">
        <div className="absolute inset-0 atlas-medical-grid opacity-20" aria-hidden="true" />
        {/* Optional cinematic depth plate (AI-generated, Higgsfield). Purely decorative:
            the live canvas and legend carry all meaning, so this never blocks comprehension. */}
        <img
          src="/landing/hero-engine-plate.webp"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen motion-reduce:opacity-15"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="presentation"
          aria-hidden="true"
        />
      </div>

      {/* Accessible, always-rendered meaning of the visual */}
      <div
        className="relative z-10 border-t border-atlas-border bg-atlas-background/70 p-4 backdrop-blur-sm"
        aria-live="polite"
      >
        <div className="flex items-center gap-2" aria-hidden="true">
          {ENGINE_STAGES.map((stage, i) => (
            <span
              key={stage.id}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-500',
                i === stageIndex ? 'bg-atlas-cyan' : 'bg-atlas-border',
              )}
            />
          ))}
        </div>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-xs text-atlas-cyan">{activeStage.index}</span>
          <span className="font-poppins text-sm font-semibold text-atlas-white">
            {activeStage.label}
          </span>
          <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-[0.12em] text-atlas-subtle">
            {activeStage.motif}
          </span>
        </p>
        <p className="mt-1.5 text-xs leading-5 text-atlas-muted">{activeStage.caption}</p>
      </div>
    </div>
  );
}
