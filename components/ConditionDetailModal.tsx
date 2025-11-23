// src/components/ConditionDetailModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import rehypeFormat from "rehype-format";
import {
  CONDITION_CONTENT,
  type ConditionContent,
} from "../src/conditionContent.generated";
import {
  buildConditionDefinition,
  type ConditionMeta,
} from "../conditionRegistry";

interface ConditionDetailModalProps {
  condition: ConditionMeta;
  onClose: () => void;
  onDrillCondition?: (meta: ConditionMeta) => void;
}

interface ContentSection {
  key: string;
  title: string;
  type: "markdown" | "list";
  value?: string;
  items?: string[];
  accent?: "danger" | "default";
}

const markdownComponents = {
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="list-disc ml-6 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="list-decimal ml-6 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
};

const ConditionDetailModal: React.FC<ConditionDetailModalProps> = ({
  condition,
  onClose,
  onDrillCondition,
}) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const conditionId = useMemo(
    () => buildConditionDefinition(condition).id,
    [condition]
  );

  const content: ConditionContent = useMemo(() => {
    return (
      CONDITION_CONTENT[conditionId] ||
      CONDITION_CONTENT[condition.condition] ||
      {}
    );
  }, [condition.condition, conditionId]);

  const sections: ContentSection[] = useMemo(() => {
    return [
      {
        key: "overview",
        title: "Overview",
        type: "markdown",
        value: content.overview,
      },
      {
        key: "etiologyPathophysiology",
        title: "Etiology & Pathophysiology",
        type: "markdown",
        value: content.etiologyPathophysiology,
      },
      {
        key: "epidemiology",
        title: "Epidemiology",
        type: "markdown",
        value: content.epidemiology,
      },
      {
        key: "clinicalPresentation",
        title: "Clinical Presentation",
        type: "markdown",
        value: content.clinicalPresentation,
      },
      {
        key: "diagnostics",
        title: "Diagnostics",
        type: "markdown",
        value: content.diagnostics?.notes,
      },
      {
        key: "riskFactors",
        title: "Risk Factors",
        type: "list",
        items: Array.isArray(content.riskFactors)
          ? content.riskFactors
          : undefined,
      },
      {
        key: "symptoms",
        title: "Symptoms",
        type: "list",
        items: Array.isArray(content.symptoms) ? content.symptoms : undefined,
      },
      {
        key: "examFindings",
        title: "Exam Findings",
        type: "list",
        items: Array.isArray(content.examFindings)
          ? content.examFindings
          : undefined,
      },
      {
        key: "keyPoints",
        title: "Key Points",
        type: "list",
        items: Array.isArray(content.keyPoints) ? content.keyPoints : undefined,
      },
      {
        key: "redFlags",
        title: "Red Flags",
        type: "list",
        items: Array.isArray(content.redFlags) ? content.redFlags : undefined,
        accent: "danger",
      },
      {
        key: "treatmentPearls",
        title: "Treatment Pearls",
        type: "list",
        items: Array.isArray(content.treatmentPearls)
          ? content.treatmentPearls
          : undefined,
      },
      {
        key: "treatment",
        title: "Treatment",
        type: "list",
        items: Array.isArray(content.treatment) ? content.treatment : undefined,
      },
      {
        key: "management",
        title: "Management",
        type: "list",
        items: Array.isArray(content.management) ? content.management : undefined,
      },
      {
        key: "complications",
        title: "Complications",
        type: "list",
        items: Array.isArray(content.complications)
          ? content.complications
          : undefined,
      },
      {
        key: "prognosis",
        title: "Prognosis",
        type: "markdown",
        value: content.prognosis,
      },
    ].filter((section) => {
      if (section.type === "markdown") {
        return !!section.value;
      }

      return (section.items?.length ?? 0) > 0;
    });
  }, [content]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        root: container,
        threshold: [0.25, 0.5, 0.75],
        rootMargin: "0px 0px -20% 0px",
      }
    );

    sections.forEach((section) => {
      const el = sectionRefs.current[section.key];
      if (el) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const mediaIds = content.mediaIds ?? [];
  const hasAnyContent = sections.length > 0;

  const scrollToSection = (key: string) => {
    const el = sectionRefs.current[key];

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const renderMarkdownContent = (
    input?: string | string[],
    accent?: "danger" | "default"
  ) => {
    if (!input || (Array.isArray(input) && input.length === 0)) return null;

    const markdownText = Array.isArray(input)
      ? input.map((item) => `- ${item}`).join("\n")
      : input;

    if (!markdownText) return null;

    return (
      <ReactMarkdown
        className={`condition-content ${accent === "danger" ? "condition-content-danger" : ""}`}
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeFormat]}
        components={markdownComponents}
      >
        {markdownText}
      </ReactMarkdown>
    );
  };

  return (
    <div className="condition-modal-overlay">
      <div className="condition-modal">
        <header className="condition-modal-header">
          <div>
            <h2 className="condition-title">{condition.condition}</h2>
            <p className="condition-meta">
              {condition.system} • {condition.subcategory}
            </p>
          </div>
          <button onClick={onClose} className="condition-close">
            Close
          </button>
        </header>

        <div className="condition-layout">
          <aside className="section-nav condition-sidebar">
            <div className="section-nav-header">
              <p className="section-nav-label">Sections</p>
              <h4 className="section-nav-title">{condition.condition}</h4>
            </div>
            <div className="section-nav-list">
              {sections.map((section) => {
                const isActive = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => scrollToSection(section.key)}
                    className={`section-nav-button ${isActive ? "active" : ""}`}
                    type="button"
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="condition-content-panel">
            <div className="condition-scrollable" ref={contentRef}>
              {mediaIds.length > 0 && (
                <section className="condition-media">
                  <div className="condition-media-frame">
                    <img
                      src={`/media/${
                        mediaIds[mediaIndex].includes(".")
                          ? mediaIds[mediaIndex]
                          : `${mediaIds[mediaIndex]}.png`
                      }`}
                      alt={`${condition.condition} media ${mediaIndex + 1}`}
                    />
                    {mediaIds.length > 1 && (
                      <div className="condition-media-controls">
                        <button
                          className="media-button"
                          onClick={() =>
                            setMediaIndex(
                              (mediaIndex - 1 + mediaIds.length) % mediaIds.length
                            )
                          }
                          aria-label="Previous media"
                        >
                          ‹
                        </button>
                        <button
                          className="media-button"
                          onClick={() =>
                            setMediaIndex((mediaIndex + 1) % mediaIds.length)
                          }
                          aria-label="Next media"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>
                  {mediaIds.length > 1 && (
                    <div className="condition-media-dots">
                      {mediaIds.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setMediaIndex(idx)}
                          className={`dot ${idx === mediaIndex ? "active" : ""}`}
                          aria-label={`View media ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              <div className="condition-sections">
                {sections.map((section) => {
                  const contentValue =
                    section.type === "markdown" ? section.value : section.items;

                  return (
                    <section
                      key={section.key}
                      id={section.key}
                      ref={(el) => (sectionRefs.current[section.key] = el)}
                      className="condition-card scroll-mt-24"
                    >
                      <h3 className="condition-section-title">{section.title}</h3>
                      {renderMarkdownContent(contentValue, section.accent)}
                    </section>
                  );
                })}
              </div>

              {!hasAnyContent && (
                <p className="condition-empty">
                  Detailed notes for this condition haven&apos;t been added yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="condition-footer">
          <button onClick={onClose} className="condition-close">
            Close
          </button>
          {onDrillCondition && (
            <button
              onClick={() => onDrillCondition(condition)}
              className="condition-drill"
            >
              Drill this condition
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ConditionDetailModal;
