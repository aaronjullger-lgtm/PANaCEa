import React, { useState } from 'react';
import { ArrowRight, Check, ChevronDown, RefreshCw } from 'lucide-react';

const examples = [
  {
    label: 'First encounter',
    text: 'Which detail in this patient’s history raises their risk of pulmonary embolism?',
    signal: 'Your answer and response pattern inform the concept’s memory state.',
  },
  {
    label: 'Later review',
    text: 'A different patient presents with sudden shortness of breath. Which recent exposure most increases the likelihood of venous thromboembolism?',
    signal: 'A new context tests the same concept when it returns for review.',
  },
] as const;

export function ConceptLearning() {
  const [exampleIndex, setExampleIndex] = useState(0);
  const example = examples[exampleIndex]!;

  return (
    <section
      id="learning-science"
      className="landing-science landing-section"
      aria-labelledby="learning-science-title"
    >
      <div className="landing-container">
        <div className="landing-science-grid">
          <div className="landing-science-copy">
            <h2 id="learning-science-title">
              Remember the concept.
              <br />
              <em>Meet a new question.</em>
            </h2>
            <p>
              Recognizing a familiar question can feel like knowing the material. PANaCEa connects
              different questions to the same concept, so each review asks you to retrieve and apply
              what you know.
            </p>
            <ul className="landing-science-points">
              <li>
                <Check size={18} aria-hidden="true" />
                <span>
                  <strong>Confidence inferred from behavior.</strong> Accuracy, timing, and answer
                  revisions inform the model—no self-rating required.
                </span>
              </li>
              <li>
                <Check size={18} aria-hidden="true" />
                <span>
                  <strong>Timing that follows your memory.</strong> A personalized forgetting model
                  guides when to revisit a concept.
                </span>
              </li>
              <li>
                <Check size={18} aria-hidden="true" />
                <span>
                  <strong>A fresh route to the same knowledge.</strong> Different wording and
                  clinical contexts help exercise the underlying concept.
                </span>
              </li>
            </ul>
          </div>
          <div className="concept-demo" aria-label="Example of concept-level review">
            <div className="concept-demo-top">
              <span>One concept</span>
              <span>Two example questions</span>
            </div>
            <h3>
              Pulmonary embolism: <br />
              thromboembolic risk
            </h3>
            <div className="concept-example" aria-live="polite" aria-atomic="true">
              <p className="concept-example-label">{example.label}</p>
              <p className="concept-example-question">{example.text}</p>
              <p className="concept-example-signal">{example.signal}</p>
            </div>
            <button
              type="button"
              className="landing-text-link"
              onClick={() => setExampleIndex((index) => (index === 0 ? 1 : 0))}
            >
              <RefreshCw size={17} aria-hidden="true" />
              {exampleIndex === 0 ? 'See the later review' : 'Compare the first encounter'}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <p className="concept-demo-note">Illustrative prompts, not a clinical assessment.</p>
          </div>
        </div>
        <details className="landing-science-details">
          <summary>
            The learning science behind the approach <ChevronDown size={19} aria-hidden="true" />
          </summary>
          <div>
            <article>
              <h3>Spacing & forgetting</h3>
              <p>
                Ebbinghaus’s forgetting curve is the starting idea: memory changes with time. Modern
                models personalize that estimate; there is no single ideal review interval for
                everyone.
              </p>
              <a
                href="https://aclanthology.org/P16-1174/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read Settles & Meeder, 2016 <span className="sr-only">(opens in a new tab)</span>
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </article>
            <article>
              <h3>Retrieval & transfer</h3>
              <p>
                Actively retrieving knowledge can strengthen learning. Research on varied examples
                supports practicing a concept across contexts, rather than relying on one familiar
                prompt.
              </p>
              <a
                href="https://scholars.duke.edu/publication/1292911"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read Butler et al., 2017 <span className="sr-only">(opens in a new tab)</span>
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </article>
            <article>
              <h3>Evidence & limits</h3>
              <p>
                These findings inform PANaCEa’s design. Whether its behavioral scheduling improves
                PA-student retention or saves study time needs direct, prospective validation.
              </p>
              <a
                href="https://link.springer.com/article/10.1186/s12909-023-04457-0"
                target="_blank"
                rel="noopener noreferrer"
              >
                Why question difficulty matters{' '}
                <span className="sr-only">(opens in a new tab)</span>
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </article>
          </div>
        </details>
      </div>
    </section>
  );
}
