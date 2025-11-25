import React, { useEffect, useMemo, useRef, useState } from "react";

import ConditionSidebar from "../../../components/ConditionSidebar";
import FormattedSection from "../../../components/conditions/FormattedSection";
import { isMeaningfulContent } from "../../../lib/loadConditions";
import { findPharmacologyEntryById } from "../../services/pharmacologyRegistry";
import type { PharmacologyEntry } from "../../types/pharmacology";

interface DrugModalProps {
  drugId: string;
  onClose: () => void;
}

interface ContentSection {
  key:
    | "overview"
    | "MOA"
    | "ADEs"
    | "contraindications"
    | "interactions"
    | "pharmacokinetics"
    | "antidote"
    | "clinicalNotes";
  title: string;
  content?: string;
}

const SECTION_ORDER: ContentSection[] = [
  { key: "overview", title: "Overview" },
  { key: "MOA", title: "Mechanism of Action (MOA)" },
  { key: "ADEs", title: "Adverse Drug Effects (ADEs)" },
  { key: "contraindications", title: "Contraindications" },
  { key: "interactions", title: "Interactions" },
  { key: "pharmacokinetics", title: "Pharmacokinetics" },
  { key: "antidote", title: "Antidote" },
  { key: "clinicalNotes", title: "Clinical Notes" },
];

const SCROLL_OFFSET = 96;

const DrugModal: React.FC<DrugModalProps> = ({ drugId, onClose }) => {
  const [activeSection, setActiveSection] = useState<string>("");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const drug: PharmacologyEntry | undefined = useMemo(
    () => findPharmacologyEntryById(drugId),
    [drugId]
  );

  useEffect(() => {
    if (!drug) {
      onClose();
    }
  }, [drug, onClose]);

  const sections: ContentSection[] = useMemo(() => {
    if (!drug) return [];

    return SECTION_ORDER.map((config) => ({
      ...config,
      content: drug[config.key],
    })).filter((section) => isMeaningfulContent(section.content));
  }, [drug]);

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
        const containerRect = container.getBoundingClientRect();
        let closestKey = "";
        let smallestDistance = Number.POSITIVE_INFINITY;

        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const target = entry.target as HTMLElement;
          const distance = Math.abs(
            target.getBoundingClientRect().top - containerRect.top - SCROLL_OFFSET
          );

          if (distance < smallestDistance) {
            smallestDistance = distance;
            closestKey = target.id;
          }
        });

        if (closestKey) {
          setActiveSection(closestKey);
        }
      },
      {
        root: container,
        rootMargin: `-${SCROLL_OFFSET}px 0px -60% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const handleScroll = () => {
      if (container.scrollTop <= 5) {
        setActiveSection(sections[0].key);
        return;
      }

      const bottomGap =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      if (bottomGap <= 2) {
        setActiveSection(sections[sections.length - 1].key);
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      let closestKey = sections[0].key;
      let smallestDistance = Number.POSITIVE_INFINITY;

      sections.forEach((section) => {
        const el = sectionRefs.current[section.key];
        if (!el) return;

        const offsetTop = el.getBoundingClientRect().top - containerTop;
        const distance = Math.abs(offsetTop - SCROLL_OFFSET);

        if (distance < smallestDistance) {
          smallestDistance = distance;
          closestKey = section.key;
        }
      });

      setActiveSection(closestKey);
    };

    sections.forEach((section) => {
      const target = sectionRefs.current[section.key];
      if (target) {
        observer.observe(target);
      }
    });

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [sections]);

  useEffect(() => {
    if (sections.length > 0) {
      setActiveSection(sections[0].key);
    }
  }, [sections]);

  const hasAnyContent = sections.length > 0;

  const scrollToSection = (key: string) => {
    const container = contentRef.current;
    const target = sectionRefs.current[key];

    if (container && target) {
      const top = target.offsetTop - container.offsetTop - SCROLL_OFFSET;
      container.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }
  };

  if (!drug) return null;

  return (
    <div className="condition-modal-overlay">
      <div className="condition-modal">
        <header className="condition-modal-header">
          <div>
            <h2 className="condition-title">{drug.term}</h2>
            <p className="condition-meta">
              {drug.class}
              {drug.subclass ? ` • ${drug.subclass}` : ""}
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
                    <div className="condition-content">
                      <FormattedSection content={section.content} />
                    </div>
                  </section>
                ))}
              </div>

              {!hasAnyContent && (
                <p className="condition-empty">
                  Detailed notes for this drug haven&apos;t been added yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="condition-footer">
          <button onClick={onClose} className="condition-close">
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DrugModal;
