// src/components/ConditionDetailModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  CONDITION_CONTENT,
  type ConditionContent,
} from "../src/conditionContent.generated";
import {
  buildConditionDefinition,
  type ConditionMeta,
} from "../conditionRegistry";
import normalizeMarkdown from "../src/utils/normalizeMarkdown";
import preprocessMarkdown from "../src/utils/preprocessMarkdown";

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

const renderList = (level = 0) => (props: any) => {
  const style =
    level === 0
      ? "list-disc pl-5"
      : level === 1
        ? "list-[circle] pl-7"
        : "list-[square] pl-9";

  return (
    <ul className={`${style} text-sm text-slate-700 space-y-1 leading-relaxed`}>
      {React.Children.toArray(props.children).map((child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { level: level + 1 })
          : child
      )}
    </ul>
  );
};

const renderListItem = (props: any) => <li>{props.children}</li>;

const MarkdownBlock = ({ value }: { value: string }) => {
  const formatted = value ? preprocessMarkdown(value) : "";

  return (
    <ReactMarkdown
      className="condition-content text-sm text-slate-700 leading-relaxed"
      remarkPlugins={[remarkGfm, normalizeMarkdown]}
      rehypePlugins={[rehypeRaw]}
      components={{ ul: renderList(0), li: renderListItem }}
    >
      {formatted}
    </ReactMarkdown>
  );
};

const InlineMarkdown = ({ value }: { value: string }) => {
  const formatted = value ? preprocessMarkdown(value) : "";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, normalizeMarkdown]}
      rehypePlugins={[rehypeRaw]}
      components={{
        p: ({ children }) => <>{children}</>,
        ul: renderList(0),
        li: renderListItem,
      }}
    >
      {formatted}
    </ReactMarkdown>
  );
};

const ConditionDetailModal: React.FC<ConditionDetailModalProps> = ({
  condition,
  onClose,
  onDrillCondition,
}) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
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

  useEffect(() => {
    const stored = localStorage.getItem(`condition:${conditionId}:collapsed`);
    if (stored) {
      try {
        setCollapsedSections(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse collapsed state", e);
        setCollapsedSections({});
      }
    } else {
      setCollapsedSections({});
    }
  }, [conditionId]);

  useEffect(() => {
    localStorage.setItem(
      `condition:${conditionId}:collapsed`,
      JSON.stringify(collapsedSections)
    );
  }, [collapsedSections, conditionId]);

  const mediaIds = content.mediaIds ?? [];

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
        items: Array.isArray(content.examFindings) ? content.examFindings : undefined,
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

  const tocItems = useMemo(
    () =>
      [
        { key: "overview", label: "Overview" },
        { key: "epidemiology", label: "Epidemiology" },
        { key: "examFindings", label: "Exam" },
        { key: "management", label: "Management" },
        { key: "complications", label: "Complications" },
        { key: "prognosis", label: "Prognosis" },
      ].filter((item) => sections.some((section) => section.key === item.key)),
    [sections]
  );

  const hasAnyContent = sections.length > 0;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.getAttribute("data-section-key"));
        }
      },
      { root: container, threshold: [0.15, 0.35, 0.6] }
    );

    sections.forEach((section) => {
      const el = sectionRefs.current[section.key];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = (key: string) => {
    const container = scrollContainerRef.current;
    const target = sectionRefs.current[key];

    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = targetRect.top - containerRect.top + container.scrollTop - 8;

    container.scrollTo({ top, behavior: "smooth" });
  };

  const registerSectionRef = (key: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[key] = el;
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div
        ref={scrollContainerRef}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-[#3D1B0E] leading-tight">
              {condition.condition}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {condition.system} • {condition.subcategory}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Close
          </button>
        </div>

        {tocItems.length > 0 && (
          <div className="sticky top-0 z-10 bg-white pt-4 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap gap-2 text-sm font-medium text-slate-600">
              {tocItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => scrollToSection(item.key)}
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    activeSection === item.key
                      ? "bg-[#3D1B0E] text-white border-[#3D1B0E]"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mediaIds.length > 0 && (
          <section className="py-5 border-b border-slate-100">
            <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img
                src={`/media/${
                  mediaIds[mediaIndex].includes(".")
                    ? mediaIds[mediaIndex]
                    : `${mediaIds[mediaIndex]}.png`
                }`}
                alt={`${condition.condition} media ${mediaIndex + 1}`}
                className="w-full h-64 object-cover bg-slate-50"
              />
              {mediaIds.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <button
                    className="bg-white/80 rounded-full p-2 text-xs shadow"
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
                    className="bg-white/80 rounded-full p-2 text-xs shadow"
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
              <div className="flex justify-center gap-2 mt-3">
                {mediaIds.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMediaIndex(idx)}
                    className={`h-2.5 w-2.5 rounded-full ${
                      idx === mediaIndex ? "bg-[#3D1B0E]" : "bg-slate-300"
                    }`}
                    aria-label={`View media ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {sections.map((section) => {
          const isCollapsed = collapsedSections[section.key] ?? false;

          return (
            <section
              key={section.key}
              ref={registerSectionRef(section.key)}
              data-section-key={section.key}
              id={section.key}
              className="py-5 border-b border-slate-100"
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="text-base font-semibold text-slate-800">
                  {section.title}
                </h3>
                <button
                  onClick={() => toggleSection(section.key)}
                  className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                  aria-expanded={!isCollapsed}
                  aria-controls={`${section.key}-content`}
                >
                  {isCollapsed ? "Show" : "Hide"}
                </button>
              </div>

              {!isCollapsed && (
                <div id={`${section.key}-content`}>
                  {section.type === "markdown" && section.value && (
                    <MarkdownBlock value={section.value} />
                  )}

                  {section.type === "list" && section.items && (
                    <ul
                      className={`condition-content list-disc pl-5 text-sm space-y-2 leading-relaxed ${
                        section.accent === "danger"
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {section.items.map((pt: string) => (
                        <li key={pt}>
                          <InlineMarkdown value={pt} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* Fallback if no content yet */}
        {!hasAnyContent && (
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            Detailed notes for this condition haven&apos;t been added yet.
          </p>
        )}

        {/* Footer buttons */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Close
          </button>
          {onDrillCondition && (
            <button
              onClick={() => onDrillCondition(condition)}
              className="px-4 py-2 text-sm rounded-md bg-[#3D1B0E] text-white hover:bg-[#2A130A] shadow"
            >
              Drill this condition
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConditionDetailModal;
