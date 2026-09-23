import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HeroCanvas } from './HeroCanvas';

let resize: () => void;
let intersect: IntersectionObserverCallback;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    })
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id))
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy(
    { createRadialGradient: () => gradient, createLinearGradient: () => gradient },
    {
      get(target, key) {
        return key in target ? target[key as keyof typeof target] : vi.fn();
      },
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
});

describe('scanner animation lifecycle', () => {
  it('owns only one animation chain across resizes and cancels it on unmount', () => {
    const { unmount } = render(<HeroCanvas />);
    expect(frames.size).toBe(1);
    resize();
    resize();
    resize();
    expect(frames.size).toBe(1);
    const [id, callback] = [...frames.entries()][0]!;
    frames.delete(id);
    callback(100);
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });

  it('pauses outside the viewport and while the document is hidden', () => {
    render(<HeroCanvas />);
    intersect([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(frames.size).toBe(0);
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(frames.size).toBe(1);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
  });

  it('draws without scheduling motion when reduced motion is requested', () => {
    render(<HeroCanvas reducedMotion />);
    resize();
    expect(frames.size).toBe(0);
  });
});
