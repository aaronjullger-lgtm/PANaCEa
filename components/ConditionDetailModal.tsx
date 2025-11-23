// src/components/ConditionDetailModal.tsx

import React, { useEffect, useMemo, useState } from "react";
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

const MarkdownBlock = ({ value }: { value: string }) => {
  const formatted = value ? preprocessMarkdown(value) : "";

  return (
    <ReactMarkdown
      className="condition-content text-sm text-slate-800 leading-relaxed space-y-3"
      remarkPlugins={[remarkGfm, normalizeMarkdown]}
      rehypePlugins={[rehypeRaw]}
    >
      {formatted}
    </ReactMarkdown>
  );
};

const InlineMarkdown = ({ value }: { value: string }) => {
  const formatted = value ? preprocessMarkdown(value) : "";

  return (
    <ReactMarkdown
      className="condition-content text-sm text-slate-800 leading-relaxed"
      remarkPlugins={[remarkGfm, normalizeMarkdown]}
      rehypePlugins={[rehypeRaw]}
      components={{ p: ({ children }) => <>{children}</> }}
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

  const mediaIds = content.mediaIds ?? [];

  const hasAnyContent = sections.length > 0;

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div
        className="bg-[#FCF9F6] border border-[#D0C7BF] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-8"
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
                id={section.key}
                className="rounded-2xl bg-white shadow-md border border-[#E6DFD8] my-5 overflow-hidden"
              >
              <div className="flex items-center justify-between px-5 py-4 bg-[#F6F0E8] border-b border-[#E6DFD8]">
                <h3 className="text-lg font-semibold text-[#2D1B12] tracking-tight">
                  {section.title}
                </h3>
                <button
                  onClick={() => toggleSection(section.key)}
                  className="flex items-center justify-center h-9 w-9 rounded-full bg-white shadow-sm border border-[#E6DFD8] text-sm text-slate-700 transition-transform duration-300"
                  aria-expanded={!isCollapsed}
                  aria-controls={`${section.key}-content`}
                >
                  <span
                    className={`transition-transform duration-300 ${
                      isCollapsed ? "rotate-180" : "rotate-0"
                    }`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
              </div>

              <div
                id={`${section.key}-content`}
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isCollapsed
                    ? "max-h-0 opacity-0 -translate-y-1"
                    : "max-h-[2400px] opacity-100 translate-y-0"
                }`}
              >
                <div className="px-5 pb-6 pt-5 space-y-3 text-[#333333]">
                  {section.type === "markdown" && section.value && (
                    <MarkdownBlock value={section.value} />
                  )}

                  {section.type === "list" && section.items && (
                    <ul
                      className={`condition-content text-sm space-y-2 leading-relaxed ${
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
              </div>
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
