'use client';

import React, { useEffect, useRef } from 'react';

export interface HeroCanvasProps {
  reducedMotion?: boolean;
}

type ScannerColors = {
  cyan: string;
  blue: string;
  violet: string;
  pulse: string;
  success: string;
  white: string;
};

type ScannerPoint = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
};

function createScannerPoints(count: number): ScannerPoint[] {
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const spread = 0.18 + random() * 0.82;
    return {
      x: Math.cos(angle) * spread,
      y: Math.sin(angle) * spread * 0.86,
      radius: 0.9 + random() * 1.8,
      alpha: 0.18 + random() * 0.42,
    };
  });
}

const SCANNER_POINTS = createScannerPoints(86);

function readAtlasColor(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readScannerColors(): ScannerColors {
  return {
    cyan: readAtlasColor('--atlas-accent-cyan', 'cyan'),
    blue: readAtlasColor('--atlas-accent-blue', 'dodgerblue'),
    violet: readAtlasColor('--atlas-accent-violet', 'mediumslateblue'),
    pulse: readAtlasColor('--atlas-accent-pulse-pink', 'hotpink'),
    success: readAtlasColor('--atlas-success-green', 'mediumspringgreen'),
    white: readAtlasColor('--atlas-clinical-white', 'white'),
  };
}

function colorWithAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const normalized =
      hex.length === 3
        ? hex
            .split('')
            .map((character) => `${character}${character}`)
            .join('')
        : hex;
    const value = Number.parseInt(normalized, 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    const colorFunction = 'rgb';
    return `${colorFunction}(${red} ${green} ${blue} / ${alpha})`;
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const [red, green, blue] = rgbMatch[1]
      .split(',')
      .slice(0, 3)
      .map((channel) => channel.trim());
    const colorFunction = 'rgb';
    return `${colorFunction}(${red} ${green} ${blue} / ${alpha})`;
  }

  return color;
}

function drawEllipse(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  alpha: number
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.shadowColor = colorWithAlpha(color, 0.38);
  context.shadowBlur = 28;

  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, Math.max(radiusX, radiusY));
  gradient.addColorStop(0, colorWithAlpha(color, alpha));
  gradient.addColorStop(0.66, colorWithAlpha(color, alpha * 0.45));
  gradient.addColorStop(1, colorWithAlpha(color, 0.02));

  context.fillStyle = gradient;
  context.strokeStyle = colorWithAlpha(color, alpha + 0.14);
  context.lineWidth = 1.25;
  context.beginPath();
  context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawScannerScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: ScannerColors,
  elapsed: number,
  reducedMotion: boolean
) {
  context.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height * 0.48;
  const size = Math.min(width, height);
  const scale = size / 420;
  const motionPhase = reducedMotion ? 0 : elapsed;
  const floatY = Math.sin(motionPhase * 0.55) * 5 * scale;
  const rotation = Math.sin(motionPhase * 0.22) * 0.08;

  const backgroundGlow = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    size * 0.58
  );
  backgroundGlow.addColorStop(0, colorWithAlpha(colors.cyan, 0.13));
  backgroundGlow.addColorStop(0.52, colorWithAlpha(colors.blue, 0.05));
  backgroundGlow.addColorStop(1, colorWithAlpha(colors.violet, 0));
  context.fillStyle = backgroundGlow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(centerX, centerY + floatY);
  context.rotate(rotation);

  const ringRotation = motionPhase * 0.12;
  const rings = [
    { rx: 176, ry: 72, color: colors.cyan, alpha: 0.5, rotation: ringRotation },
    { rx: 144, ry: 104, color: colors.blue, alpha: 0.34, rotation: -0.72 - ringRotation * 0.58 },
    { rx: 128, ry: 46, color: colors.violet, alpha: 0.3, rotation: 0.56 + ringRotation * 0.42 },
  ];

  for (const ring of rings) {
    context.save();
    context.rotate(ring.rotation);
    context.strokeStyle = colorWithAlpha(ring.color, ring.alpha);
    context.lineWidth = 1.25 * scale;
    context.shadowColor = colorWithAlpha(ring.color, 0.32);
    context.shadowBlur = 16 * scale;
    context.beginPath();
    context.ellipse(0, 0, ring.rx * scale, ring.ry * scale, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  drawEllipse(context, colors.cyan, -44 * scale, -20 * scale, 36 * scale, 92 * scale, -0.18, 0.22);
  drawEllipse(context, colors.blue, 44 * scale, -20 * scale, 36 * scale, 92 * scale, 0.18, 0.2);
  drawEllipse(context, colors.pulse, 0, 38 * scale, 36 * scale, 46 * scale, 0.28, 0.27);
  drawEllipse(context, colors.violet, 0, -132 * scale, 24 * scale, 30 * scale, 0, 0.16);

  context.strokeStyle = colorWithAlpha(colors.cyan, 0.16);
  context.lineWidth = 1 * scale;
  context.beginPath();
  context.moveTo(-18 * scale, -104 * scale);
  context.bezierCurveTo(-54 * scale, -32 * scale, -46 * scale, 32 * scale, -8 * scale, 76 * scale);
  context.moveTo(18 * scale, -104 * scale);
  context.bezierCurveTo(54 * scale, -32 * scale, 46 * scale, 32 * scale, 8 * scale, 76 * scale);
  context.stroke();

  const scanY = Math.sin(motionPhase * 0.8) * 112 * scale;
  const scanGradient = context.createLinearGradient(-176 * scale, scanY, 176 * scale, scanY);
  scanGradient.addColorStop(0, colorWithAlpha(colors.success, 0));
  scanGradient.addColorStop(0.5, colorWithAlpha(colors.success, 0.46));
  scanGradient.addColorStop(1, colorWithAlpha(colors.success, 0));
  context.strokeStyle = scanGradient;
  context.lineWidth = 2 * scale;
  context.beginPath();
  context.moveTo(-178 * scale, scanY);
  context.lineTo(178 * scale, scanY);
  context.stroke();

  context.restore();

  for (const point of SCANNER_POINTS) {
    const orbit = reducedMotion ? 0 : elapsed * 0.08;
    const x = centerX + (point.x * Math.cos(orbit) - point.y * Math.sin(orbit)) * size * 0.33;
    const y = centerY + (point.x * Math.sin(orbit) + point.y * Math.cos(orbit)) * size * 0.22;
    context.fillStyle = colorWithAlpha(colors.white, point.alpha);
    context.beginPath();
    context.arc(x, y, point.radius * scale, 0, Math.PI * 2);
    context.fill();
  }
}

export function HeroCanvas({ reducedMotion = false }: HeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return undefined;

    let animationFrame = 0;
    let startedAt = performance.now();
    const colors = readScannerColors();

    const render = (timestamp: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScannerScene(
        context,
        width,
        height,
        colors,
        (timestamp - startedAt) / 1000,
        reducedMotion
      );

      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const observer = new ResizeObserver(() => {
      startedAt = performance.now();
      render(startedAt);
    });

    observer.observe(canvas);
    render(startedAt);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [reducedMotion]);

  return (
    <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" role="presentation" />
  );
}
