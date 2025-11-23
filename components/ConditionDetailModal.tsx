// src/components/ConditionDetailModal.tsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import ChevronDownIcon from "./icons/ChevronDownIcon";
import ChevronUpIcon from "./icons/ChevronUpIcon";

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
  p: ({ children }: { children: React.ReactNode }) => (
    <p className="mb-3 last:mb-0 text-slate-800">{children}</p>
  ),
  ul: ({ children, ...props }: { children: React.ReactNode }) => (
    <ul className="space-y-2" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }: { children: React.ReactNode }) => (
    <li className="leading-relaxed ml-1" {...props}>
      {children}
    </li>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="text-slate-900">{children}</strong>
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

  const defaultCollapsed = useMemo(() => {
    return sections.reduce((acc, section) => {
      acc[section.key] = section.key !== "overview";
      return acc;
    }, {} as Record<string, boolean>);
  }, [sections]);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
    () => defaultCollapsed
  );

  useEffect(() => {
    const stored = localStorage.getItem(`condition:${conditionId}:collapsed`);
    if (stored) {
      try {
        setCollapsedSections(JSON.parse(stored));
        return;
      } catch (e) {
        console.error("Failed to parse collapsed state", e);
      }
    }

    setCollapsedSections(defaultCollapsed);
  }, [conditionId, defaultCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      `condition:${conditionId}:collapsed`,
      JSON.stringify(collapsedSections)
    );
  }, [collapsedSections, conditionId]);

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
      { root: container, threshold: [0.25, 0.5, 0.75], rootMargin: "0px 0px -20% 0px" }
    );

    sections.forEach((section) => {
      const el = sectionRefs.current[section.key];
      if (el) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [sections]);

  const mediaIds = content.mediaIds ?? [];
  const hasAnyContent = sections.length > 0;

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  };

  const scrollToSection = (key: string) => {
    const container = contentRef.current;
    const el = sectionRefs.current[key];

    if (container && el) {
      const top = el.offsetTop - 16;
      container.scrollTo({ top, behavior: "smooth" });
    }
  };

  const renderMarkdownContent = (
    input?: string | string[],
    accent?: "danger" | "default"
  ) => {
    if (!input || (Array.isArray(input) && input.length === 0)) return null;

    const normalized = normalizeMarkdown(input);

    if (!normalized) return null;

    const tone =
      accent === "danger"
        ? "text-red-800 [&_*]:text-red-800"
        : "text-slate-800";

    return (
      <ReactMarkdown
        className={`condition-content prose prose-slate max-w-none leading-7 text-[17px] ${tone}`}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {normalized}
      </ReactMarkdown>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="bg-[#FCF9F6] border border-[#D0C7BF] rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex h-full">
          <aside className="hidden md:flex w-64 shrink-0 flex-col bg-[#F6F1EA] border-r border-[#E6DFD8] px-5 py-6 sticky top-0 self-start h-full">
            <div className="flex items-center justify-between text-slate-800">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                  Sections
                </p>
                <h4 className="text-lg font-semibold leading-tight text-[#2D1B12]">
                  {condition.condition}
                </h4>
              </div>
              <button
                onClick={onClose}
                className="h-9 w-9 flex items-center justify-center rounded-full border border-[#D0C7BF] bg-white shadow-sm hover:bg-slate-50"
                aria-label="Close condition details"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-2 pr-1 overflow-y-auto">
              {sections.map((section) => {
                const isActive = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => scrollToSection(section.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-sm font-semibold ${
                      isActive
                        ? "bg-[#3D1B0E] text-white border-[#3D1B0E] shadow-sm"
                        : "bg-white text-slate-700 border-[#E6DFD8] hover:border-[#CBB7A4]"
                    }`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          </aside>

          <div ref={contentRef} className="flex-1 overflow-y-auto">
            <div className="px-5 py-6 sm:px-8">
              <div className="max-w-3xl mx-auto">
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

                  const contentValue =
                    section.type === "markdown" ? section.value : section.items;

                  return (
                    <section
                      key={section.key}
                      id={section.key}
                      ref={(el) => (sectionRefs.current[section.key] = el)}
                      className="rounded-2xl bg-white shadow-sm border border-[#E6DFD8] my-5 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection(section.key)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-[#F6F0E8] hover:bg-[#EFE6DC] transition-colors"
                        aria-expanded={!isCollapsed}
                        aria-controls={`${section.key}-content`}
                      >
                        <h3 className="text-lg font-semibold text-[#2D1B12] tracking-tight">
                          {section.title}
                        </h3>
                        {isCollapsed ? (
                          <ChevronDownIcon className="h-5 w-5 text-slate-700" />
                        ) : (
                          <ChevronUpIcon className="h-5 w-5 text-slate-700" />
                        )}
                      </button>

                      <div
                        id={`${section.key}-content`}
                        className={`transition-[max-height,opacity,transform] duration-300 ease-in-out overflow-hidden ${
                          isCollapsed
                            ? "max-h-0 opacity-0 -translate-y-1"
                            : "max-h-[2400px] opacity-100 translate-y-0"
                        }`}
                      >
                        <div className="px-5 pb-6 pt-5">
                          {renderMarkdownContent(contentValue, section.accent)}
                        </div>
                      </div>
                    </section>
                  );
                })}

                {!hasAnyContent && (
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                    Detailed notes for this condition haven&apos;t been added yet.
                  </p>
                )}

                <div className="mt-8 flex justify-end gap-3 pb-2">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionDetailModal;
