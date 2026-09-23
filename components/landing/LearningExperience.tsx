import React from 'react';
import { ArrowRight, Check, Laptop, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import { LEARNING_STEPS, PRACTICE_FEATURES, STUDY_CHALLENGES } from './referenceContent';

export function StudyChallenges() {
  return (
    <section className="landing-challenges landing-dark" aria-labelledby="study-challenges-title">
      <div className="landing-container landing-challenges-grid">
        <div>
          <h2 id="study-challenges-title">
            You don’t need more content.
            <br />
            You need the <em>right focus.</em>
          </h2>
          <p>
            When everything feels high yield, deciding what to study can become its own distraction.
          </p>
        </div>
        <ul className="landing-challenge-list">
          {STUDY_CHALLENGES.map(({ title, detail, icon: Icon }) => (
            <li key={title}>
              <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LearningEngine() {
  return (
    <section
      id="diagnostic-story"
      className="landing-engine landing-section"
      aria-labelledby="learning-engine-title"
    >
      <div className="landing-container">
        <div className="landing-section-heading">
          <div>
            <p className="landing-intro">Built different.</p>
            <h2 id="learning-engine-title">
              An adaptive clinical
              <br />
              learning engine.
            </h2>
            <p>
              Spaced repetition at the concept level. Your answers shape the memory model; the model
              decides when the concept should return.
            </p>
          </div>
          <div className="learning-loop-note">
            <RefreshCw className="learning-loop-symbol" size={36} aria-hidden="true" />
            <p>
              <strong>You learn. PANaCEa schedules.</strong>
              <br />
              No “How well did you know that?” required.
            </p>
          </div>
        </div>
        <ol className="learning-engine-steps">
          {LEARNING_STEPS.map(({ title, description, icon: Icon }, index) => (
            <li key={title}>
              <span className="learning-step-orb">
                <Icon size={40} strokeWidth={1.35} aria-hidden="true" />
              </span>
              <span className="learning-step-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
        <a href="#training-modes" className="landing-text-link">
          Find your way to practice <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export function BuiltForStudents({ onStartStudying }: { onStartStudying: () => void }) {
  return (
    <section
      id="image-lab"
      className="landing-students landing-dark landing-section"
      aria-labelledby="built-for-students-title"
    >
      <div className="landing-container landing-students-grid">
        <div className="landing-students-copy">
          <h2 id="built-for-students-title">
            Designed for PA students.
            <br />
            Built for real study days.
          </h2>
          <ul className="landing-check-list">
            <li>
              <Check size={17} aria-hidden="true" /> Practice organized around clinical systems
            </li>
            <li>
              <Check size={17} aria-hidden="true" /> New questions revisit the concepts you’re
              learning
            </li>
            <li>
              <Check size={17} aria-hidden="true" /> Less scheduling. More attention for learning.
            </li>
          </ul>
          <div className="landing-devices">
            <span>At your desk. Between rotations.</span>
            <Laptop aria-label="Desktop" size={22} />
            <Tablet aria-label="Tablet" size={20} />
            <Smartphone aria-label="Phone" size={18} />
          </div>
        </div>
        <div className="landing-practice-cards">
          {PRACTICE_FEATURES.map(({ title, description, icon: Icon, tag }) => (
            <article className="landing-practice-card" key={title}>
              <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
              <span>{tag}</span>
            </article>
          ))}
        </div>
        <button
          type="button"
          onClick={onStartStudying}
          className="landing-text-link landing-students-action"
        >
          Make a plan for your next session <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
