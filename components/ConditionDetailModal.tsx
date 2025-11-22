// src/components/ConditionDetailModal.tsx

import React, { useMemo, useState } from "react";
import {
  CONDITION_CONTENT,
  type ConditionContent,
} from "../src/conditionContent.generated";
import {
  buildConditionDefinition,
  type ConditionMeta,
} from "../conditionRegistry";
import { inlineFormat, renderMarkdownHtml } from "../src/lib/markdown";

interface ConditionDetailModalProps {
  condition: ConditionMeta;
  onClose: () => void;
  onDrillCondition?: (meta: ConditionMeta) => void;
}
const MarkdownBlock = ({ value }: { value: string }) => (
  <div
    className="condition-content text-sm text-slate-700"
    dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(value) }}
  />
);

const MarkdownBlock = ({ value }: { value: string }) => (
  <div
    className="condition-content text-sm text-slate-700"
    dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(value) }}
  />
);

const ConditionDetailModal: React.FC<ConditionDetailModalProps> = ({
  condition,
  onClose,
  onDrillCondition,
}) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const content: ConditionContent = useMemo(() => {
    const id = buildConditionDefinition(condition).id;
    return (
      CONDITION_CONTENT[id] ||
      CONDITION_CONTENT[condition.condition] ||
      {}
    );
  }, [condition]);

  const mediaIds = content.mediaIds ?? [];

  const hasAnyContent = useMemo(() => {
    return (
      !!content.overview ||
      !!content.etiologyPathophysiology ||
      !!content.epidemiology ||
      !!content.clinicalPresentation ||
      !!content.prognosis ||
      !!content.diagnostics?.notes ||
      (content.keyPoints?.length ?? 0) > 0 ||
      (content.redFlags?.length ?? 0) > 0 ||
      (content.treatmentPearls?.length ?? 0) > 0 ||
      (content.riskFactors?.length ?? 0) > 0 ||
      (content.symptoms?.length ?? 0) > 0 ||
      (content.examFindings?.length ?? 0) > 0 ||
      (content.treatment?.length ?? 0) > 0 ||
      (content.management?.length ?? 0) > 0 ||
      (content.complications?.length ?? 0) > 0
    );
  }, [content]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-[#3D1B0E]">
              {condition.condition}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {condition.system} • {condition.subcategory}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Close
          </button>
        </div>

        {mediaIds.length > 0 && (
          <section className="mb-4">
            <div className="relative rounded-lg overflow-hidden border border-slate-200">
              <img
                src={`/media/${
                  mediaIds[mediaIndex].includes(".")
                    ? mediaIds[mediaIndex]
                    : `${mediaIds[mediaIndex]}.png`
                }`}
                alt={`${condition.condition} media ${mediaIndex + 1}`}
                className="w-full h-56 object-cover bg-slate-50"
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
              <div className="flex justify-center gap-2 mt-2">
                {mediaIds.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMediaIndex(idx)}
                    className={`h-2 w-2 rounded-full ${
                      idx === mediaIndex ? "bg-[#3D1B0E]" : "bg-slate-300"
                    }`}
                    aria-label={`View media ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Overview */}
        {content.overview && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Overview
            </h3>
            <MarkdownBlock value={content.overview} />
          </section>
        )}

        {/* Diagnostics */}
        {content.diagnostics?.notes && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Diagnostics
            </h3>
            <MarkdownBlock value={content.diagnostics.notes} />
          </section>
        )}

        {/* Etiology / Pathophysiology */}
        {content.etiologyPathophysiology && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Etiology &amp; Pathophysiology
            </h3>
            <MarkdownBlock value={content.etiologyPathophysiology} />
          </section>
        )}

        {/* Epidemiology */}
        {content.epidemiology && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Epidemiology
            </h3>
            <MarkdownBlock value={content.epidemiology} />
          </section>
        )}

        {/* Risk factors */}
        {Array.isArray(content.riskFactors) && content.riskFactors.length > 0 && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Risk Factors
            </h3>
            <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
              {content.riskFactors.map((pt: string) => (
                <li
                  key={pt}
                  dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Clinical presentation */}
        {content.clinicalPresentation && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Clinical Presentation
            </h3>
            <MarkdownBlock value={content.clinicalPresentation} />
          </section>
        )}

        {/* Symptoms */}
        {Array.isArray(content.symptoms) && content.symptoms.length > 0 && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Symptoms
            </h3>
            <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
              {content.symptoms.map((pt: string) => (
                <li
                  key={pt}
                  dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Exam findings */}
        {Array.isArray(content.examFindings) &&
          content.examFindings.length > 0 && (
            <section className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">
                Exam Findings
              </h3>
              <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
                {content.examFindings.map((pt: string) => (
                  <li
                    key={pt}
                    dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Exam findings */}
        {Array.isArray(content.examFindings) &&
          content.examFindings.length > 0 && (
            <section className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">
                Exam Findings
              </h3>
              <ul className="list-disc ml-5 text-sm text-slate-600 space-y-1">
                {content.examFindings.map((pt: string) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </section>
          )}

        {/* Key points */}
        {Array.isArray(content.keyPoints) && content.keyPoints.length > 0 && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Key Points
            </h3>
            <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
              {content.keyPoints.map((pt: string) => (
                <li
                  key={pt}
                  dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Red flags */}
        {Array.isArray(content.redFlags) && content.redFlags.length > 0 && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Red Flags
            </h3>
            <ul className="condition-content list-disc ml-5 text-sm text-red-700 space-y-1">
              {content.redFlags.map((pt: string) => (
                <li
                  key={pt}
                  dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Treatment pearls */}
        {Array.isArray(content.treatmentPearls) &&
          content.treatmentPearls.length > 0 && (
            <section className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">
                Treatment Pearls
              </h3>
              <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
                {content.treatmentPearls.map((pt: string) => (
                  <li
                    key={pt}
                    dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Treatment */}
        {Array.isArray(content.treatment) && content.treatment.length > 0 && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Treatment
            </h3>
            <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
              {content.treatment.map((pt: string) => (
                <li
                  key={pt}
                  dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Management */}
        {Array.isArray(content.management) && content.management.length > 0 && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Management
            </h3>
            <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
              {content.management.map((pt: string) => (
                <li
                  key={pt}
                  dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Complications */}
        {Array.isArray(content.complications) &&
          content.complications.length > 0 && (
            <section className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">
                Complications
              </h3>
              <ul className="condition-content list-disc ml-5 text-sm text-slate-600 space-y-1">
                {content.complications.map((pt: string) => (
                  <li
                    key={pt}
                    dangerouslySetInnerHTML={{ __html: inlineFormat(pt) }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Prognosis */}
        {content.prognosis && (
          <section className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Prognosis
            </h3>
            <MarkdownBlock value={content.prognosis} />
          </section>
        )}

        {/* Fallback if no content yet */}
        {!hasAnyContent && (
          <p className="text-sm text-slate-500 mb-4">
            Detailed notes for this condition haven&apos;t been added yet.
          </p>
        )}

        {/* Footer buttons */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700"
          >
            Close
          </button>
          {onDrillCondition && (
            <button
              onClick={() => onDrillCondition(condition)}
              className="px-3 py-2 text-sm rounded-md bg-[#3D1B0E] text-white hover:bg-[#2A130A]"
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
