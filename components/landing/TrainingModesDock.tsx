import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { SectionHeader } from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import { TRAINING_MODES } from './content';

/** Stable tabs: selection never moves the target under a pointer or keyboard. */
export function TrainingModesDock() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [vertical, setVertical] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeMode = TRAINING_MODES[activeIndex] ?? TRAINING_MODES[0]!;
  const Icon = activeMode.icon;

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setVertical(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const moveTo = (index: number) => {
    const next = (index + TRAINING_MODES.length) % TRAINING_MODES.length;
    setActiveIndex(next);
    tabRefs.current[next]?.focus({ preventScroll: true });
    // Reveal the selected tab within the horizontal mobile strip, without
    // scrolling the whole page away from its preview.
    const tab = tabRefs.current[next];
    const strip = tab?.parentElement;
    if (!vertical && tab && strip) {
      if (tab.offsetLeft < strip.scrollLeft) strip.scrollLeft = tab.offsetLeft;
      else if (tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
        strip.scrollLeft = tab.offsetLeft + tab.offsetWidth - strip.clientWidth;
      }
    }
  };

  return (
    <section
      id="training-modes"
      aria-labelledby="training-modes-title"
      className="relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          title="The right practice for your next step."
          description="Build recall, work through a weak system, or rehearse under exam conditions. Explore what each study mode is for."
          titleId="training-modes-title"
        />
        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
          <div
            role="tablist"
            aria-label="Study modes"
            aria-orientation={vertical ? 'vertical' : 'horizontal'}
            className="relative flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain rounded-xl p-1 pb-3 lg:grid lg:gap-1 lg:overflow-visible lg:pb-1"
          >
            {TRAINING_MODES.map((mode, index) => {
              const ModeIcon = mode.icon;
              const active = index === activeIndex;
              return (
                <button
                  key={mode.id}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  id={`training-mode-${mode.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="training-mode-preview"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onKeyDown={(event) => {
                    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
                    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
                    if (![forward, back, 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    moveTo(
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? TRAINING_MODES.length - 1
                          : index + (event.key === forward ? 1 : -1)
                    );
                  }}
                  className={cn(
                    'atlas-focus-ring flex min-h-14 shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors lg:w-full',
                    active
                      ? 'border-atlas-border-glow bg-atlas-background-soft text-atlas-white'
                      : 'border-transparent text-atlas-muted hover:bg-atlas-glass hover:text-atlas-white'
                  )}
                >
                  <ModeIcon
                    className={cn('size-5 shrink-0', active && 'text-atlas-cyan')}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{mode.label}</span>
                  <ChevronRight
                    className={cn('hidden size-4 shrink-0 lg:block', !active && 'invisible')}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          <div
            id="training-mode-preview"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`training-mode-${activeMode.id}`}
            className="atlas-focus-ring min-w-0 rounded-2xl border border-atlas-border bg-atlas-background-soft p-6 sm:p-8"
          >
            <Icon className="size-8 text-atlas-cyan" aria-hidden="true" />
            <h3 className="mt-6 font-poppins text-2xl font-semibold leading-tight text-atlas-white sm:text-3xl">
              {activeMode.title}
            </h3>
            <p className="mt-4 max-w-xl text-base leading-7 text-atlas-muted">
              {activeMode.description}
            </p>
            <dl className="mt-7 grid gap-6 border-t border-atlas-border pt-6">
              <div>
                <dt className="text-sm font-semibold text-atlas-white">When to use it</dt>
                <dd className="mt-2 text-sm leading-6 text-atlas-muted">{activeMode.bestFor}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-atlas-white">What you’ll practice</dt>
                <dd className="mt-2 text-sm leading-6 text-atlas-muted">{activeMode.protocol}</dd>
              </div>
            </dl>
            <ul className="mt-7 grid gap-3 border-t border-atlas-border pt-6">
              {activeMode.previewPoints.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-6 text-atlas-muted"
                >
                  <Check className="mt-1 size-4 shrink-0 text-atlas-cyan" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
