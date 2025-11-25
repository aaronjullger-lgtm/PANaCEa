// src/components/ConditionDetailModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildConditionDefinition,
  type ConditionMeta,
} from "../conditionRegistry";
import {
  getConditionById,
  isMeaningfulContent,
  type ConditionEntry,
} from "../lib/loadConditions";
import ConditionSidebar from "./ConditionSidebar";
import FormattedSection from "./conditions/FormattedSection";

interface ConditionDetailModalProps {
  condition: ConditionMeta;
  onClose: () => void;
  onDrillCondition?: (meta: ConditionMeta) => void;
}

interface ContentSection {
  key: string;
  title: string;
  content?: string;
  accent?: "danger" | "default";
}

const SECTION_ORDER: { key: string; title: string; accent?: "danger" | "default" }[] = [
  { key: "overview", title: "Overview" },
  { key: "etiology", title: "Etiology" },
  { key: "epidemiology", title: "Epidemiology" },
  { key: "riskFactors", title: "Risk Factors" },
  { key: "clinicalPresentation", title: "Clinical Presentation" },
  { key: "physicalExam", title: "Physical Exam" },
  { key: "diagnostics", title: "Diagnostics" },
  { key: "differentialDiagnosis", title: "Differential Diagnosis" },
  { key: "management", title: "Management" },
  { key: "treatment", title: "Treatment" },
  { key: "complications", title: "Complications" },
  { key: "prognosis", title: "Prognosis" },
  { key: "preventionEducation", title: "Prevention & Education" },
];

const ConditionDetailModal: React.FC<ConditionDetailModalProps> = ({
  condition,
  onClose,
  onDrillCondition,
}) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const conditionId = useMemo(
    () => buildConditionDefinition(condition).id,
    [condition]
  );

  const content: ConditionEntry | undefined = useMemo(() => {
    return getConditionById(conditionId) ?? getConditionById(condition.condition);
  }, [condition.condition, conditionId]);

  const sections: ContentSection[] = useMemo(() => {
    if (!content?.sections) return [];

    return SECTION_ORDER.map((config) => ({
      ...config,
      content: content.sections?.[config.key],
    })).filter((section) => isMeaningfulContent(section.content));
  }, [content?.sections]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { root: container, threshold: [0.2, 0.45, 0.65], rootMargin: "0px 0px -25% 0px" }
    );

    sections.forEach((section) => {
      const target = sectionRefs.current[section.key];
      if (target) observer.observe(target);
    });

    const handleEdges = () => {
      const scrollTop = container.scrollTop;
      const bottomGap =
        container.scrollHeight - (scrollTop + container.clientHeight);

      if (scrollTop <= 5 && sections.length > 0) {
        setActiveSection(sections[0].key);
      } else if (bottomGap <= 5 && sections.length > 0) {
        setActiveSection(sections[sections.length - 1].key);
      }
    };

    container.addEventListener("scroll", handleEdges, { passive: true });
    handleEdges();

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", handleEdges);
    };
  }, [sections]);

  useEffect(() => {
    if (sections.length > 0) {
      setActiveSection(sections[0].key);
    }
  }, [sections]);

  const mediaIds: string[] = [];
  const hasAnyContent = sections.length > 0;

  const scrollToSection = (key: string) => {
    const container = contentRef.current;
    const target = sectionRefs.current[key];

    if (container && target) {
      const offset = 80;
      const top = target.offsetTop - container.offsetTop - offset;
      container.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }
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
          <ConditionSidebar
            sections={sections.map((section) => ({
              key: section.key,
              title: section.title,
            }))}
            activeSection={activeSection}
            onSelect={scrollToSection}
          />

          <div className="condition-content-panel">
            <div
              className="condition-scrollable condition-scrollable-padded"
              ref={contentRef}
            >
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
                {sections.map((section) => (
                  <section
                    key={section.key}
                    id={section.key}
                    ref={(el) => {
                      sectionRefs.current[section.key] = el;
                    }}
                    className="condition-card scroll-mt-24"
                  >
                    <h3 className="condition-section-title">{section.title}</h3>
                    <div
                      className={`condition-content ${
                        section.accent === "danger" ? "condition-content-danger" : ""
                      }`}
                    >
                      <FormattedSection content={section.content} />
                    </div>
                  </section>
                ))}
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
