import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { TRAINING_MODES } from './content';

export function TrainingModesDock({ onStartStudying }: { onStartStudying?: () => void }) {
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
    const tab = tabRefs.current[next];
    tab?.focus({ preventScroll: true });
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
      className="landing-modes landing-section"
    >
      <div className="landing-container">
        <div className="landing-modes-heading">
          <h2 id="training-modes-title">
            One learning engine.
            <br />
            Different ways to practice.
          </h2>
          <p>
            Build recall, reason through a clinical case, or prepare for a timed exam. Choose the
            practice that fits this moment.
          </p>
        </div>
        <div className="landing-mode-layout">
          <div
            role="tablist"
            aria-label="Study modes"
            aria-orientation={vertical ? 'vertical' : 'horizontal'}
            className="landing-mode-tabs"
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
                  className="landing-mode-tab"
                >
                  <ModeIcon size={19} aria-hidden="true" />
                  <span>{mode.label}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div
            id="training-mode-preview"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`training-mode-${activeMode.id}`}
            className="landing-mode-panel"
          >
            <Icon size={32} strokeWidth={1.5} aria-hidden="true" />
            <h3>{activeMode.title}</h3>
            <p>{activeMode.description}</p>
            <dl>
              <dt>When to use it</dt>
              <dd>{activeMode.bestFor}</dd>
            </dl>
            <ul>
              {activeMode.previewPoints.map((item) => (
                <li key={item}>
                  <Check size={17} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {onStartStudying && (
              <button type="button" className="landing-text-link" onClick={onStartStudying}>
                Build my study plan <ArrowRight size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
