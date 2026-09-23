import React from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { StudyPlanPreview } from './StudyPlanPreview';

export interface HeroProps {
  onStartStudying: () => void;
}

export function Hero({ onStartStudying }: HeroProps) {
  return (
    <section id="hero" aria-labelledby="landing-hero-title" className="landing-hero">
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="landing-intro">Adaptive. Clinical. Personal.</p>
          <h1 id="landing-hero-title">
            Study with
            <br /> purpose.
            <br />
            Remember with
            <br /> <em>confidence.</em>
          </h1>
          <p className="landing-hero-description">
            PANaCEa learns from how you answer, estimates how well each concept will stick, and
            schedules your next review automatically. Review the concept through fresh questions.
          </p>
          <div className="landing-hero-actions">
            <button type="button" className="landing-button" onClick={onStartStudying}>
              Build my study plan <ArrowRight size={18} aria-hidden="true" />
            </button>
            <a className="landing-play-link" href="#diagnostic-story">
              <span>
                <Play size={14} aria-hidden="true" />
              </span>{' '}
              See how it works
            </a>
          </div>
          <p className="landing-hero-note">
            For PA students. No confidence ratings. No scheduling to manage.
          </p>
        </div>
        <StudyPlanPreview />
        <img
          className="landing-hero-sculpture"
          src="/images/landing/learning-sculpture.webp"
          srcSet="/images/landing/learning-sculpture-small.webp 800w, /images/landing/learning-sculpture.webp 1600w"
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 70vw, 1000px"
          width="1600"
          height="667"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
        />
      </div>
    </section>
  );
}
