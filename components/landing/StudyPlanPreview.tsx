import React from 'react';
import { ArrowRight, BookOpen, Check, Target } from 'lucide-react';
import { LandingMark } from './LandingBrand';
import { STUDY_PREVIEW } from './referenceContent';

export function StudyPlanPreview() {
  return (
    <figure
      className="study-preview"
      id="analytics-preview"
      aria-labelledby="study-preview-caption"
    >
      <div className="study-tablet">
        <div className="study-tablet-top">
          <span>
            <LandingMark />
            Your next concept
          </span>
          <span className="study-demo-label">Example plan</span>
        </div>
        <div className="study-tablet-grid">
          <div className="study-priority">
            <p className="study-panel-label">
              <Target size={14} aria-hidden="true" /> Your focus today
            </p>
            <h2>{STUDY_PREVIEW.priority}</h2>
            <p>
              Strengthen your recall of
              <br />
              {STUDY_PREVIEW.focus.toLowerCase()}.
            </p>
            <a href="#training-modes" className="study-focus-action">
              <BookOpen size={17} aria-hidden="true" />
              <span>Explore focused review</span>
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="study-readiness">
            <p className="study-panel-label">Recall estimate</p>
            <div className="study-readiness-content">
              <div
                className="study-readiness-ring"
                role="img"
                aria-label={`Illustrative concept recall estimate: ${STUDY_PREVIEW.recallEstimate} percent`}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="42" className="study-ring-track" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    pathLength="100"
                    strokeDasharray={`${STUDY_PREVIEW.recallEstimate} 100`}
                    className="study-ring-value"
                  />
                </svg>
                <strong aria-hidden="true">
                  {STUDY_PREVIEW.recallEstimate}
                  <small>%</small>
                </strong>
              </div>
              <span>
                Keep building
                <br />
                <b>your confidence.</b>
              </span>
            </div>
            <p className="study-estimate-note">Inferred from practice, not a self-rating.</p>
          </div>
          <div className="study-today">
            <p className="study-panel-label">Today’s plan</p>
            <ul>
              {STUDY_PREVIEW.plan.map(({ title, topic, duration, icon: Icon }) => (
                <li key={title}>
                  <Icon size={20} aria-hidden="true" />
                  <span>
                    <strong>{title}</strong>
                    <small>{topic}</small>
                  </span>
                  <span className="study-duration">{duration}</span>
                </li>
              ))}
            </ul>
            <span className="study-plan-note">
              <Check size={13} aria-hidden="true" /> A little focus. A useful next step.
            </span>
          </div>
          <div className="study-blueprint">
            <p className="study-panel-label">Concept recall by system</p>
            <ul>
              {STUDY_PREVIEW.systems.map(({ name, value }) => (
                <li key={name}>
                  <span>
                    {name}
                    <b>{value}%</b>
                  </span>
                  <span className="study-system-track" aria-hidden="true">
                    <span style={{ width: `${value}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption id="study-preview-caption">
        Illustrative learner data · Sample values, not a learner’s results.
      </figcaption>
    </figure>
  );
}
