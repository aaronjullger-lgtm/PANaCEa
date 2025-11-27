import React, { useMemo } from "react";
import FormattedSection from "../../components/conditions/FormattedSection";
import {
  getConditionById,
  isMeaningfulContent,
  type ConditionContent,
  type ConditionEntry,
} from "../../lib/loadConditions";

const getConditionIdFromPath = (): string => {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? "");
};

/**
 * Canonical ordering for condition page sections.
 * Includes all fields from ConditionContent interface.
 * Sections without content are automatically filtered out by isMeaningfulContent().
 */
const SECTION_ORDER: { key: string; title: string }[] = [
  { key: "overview", title: "Overview" },
  { key: "keyPoints", title: "Key Points" },
  { key: "etiology", title: "Etiology" },
  { key: "etiologyPathophysiology", title: "Etiology & Pathophysiology" },
  { key: "epidemiology", title: "Epidemiology" },
  { key: "riskFactors", title: "Risk Factors" },
  { key: "clinicalPresentation", title: "Clinical Presentation" },
  { key: "symptoms", title: "Symptoms" },
  { key: "physicalExam", title: "Physical Exam" },
  { key: "examFindings", title: "Exam Findings" },
  { key: "diagnostics", title: "Diagnostics" },
  { key: "differentialDiagnosis", title: "Differential Diagnosis" },
  { key: "management", title: "Management" },
  { key: "treatment", title: "Treatment" },
  { key: "treatmentPearls", title: "Treatment Pearls" },
  { key: "complications", title: "Complications" },
  { key: "redFlags", title: "Red Flags" },
  { key: "prognosis", title: "Prognosis" },
  { key: "preventionEducation", title: "Prevention & Education" },
];

interface ContentSection {
  key: string;
  title: string;
  content?: ConditionContent;
}

const ConditionPage: React.FC = () => {
  const conditionId = useMemo(() => getConditionIdFromPath(), []);
  const conditionContent: ConditionEntry | undefined = useMemo(
    () => (conditionId ? getConditionById(conditionId) : undefined),
    [conditionId]
  );

  const sections: ContentSection[] = useMemo(() => {
    if (!conditionContent?.sections) return [];

    return SECTION_ORDER.map((config) => ({
      ...config,
      content: conditionContent.sections?.[config.key],
    })).filter((section) => isMeaningfulContent(section.content));
  }, [conditionContent?.sections]);

  return (
    <main className="condition-page">
      <header className="condition-modal-header">
        <div>
          <h2 className="condition-title">
            {conditionContent?.condition ?? "Condition not found"}
          </h2>
        </div>
      </header>

      <div className="condition-sections">
        {sections.length === 0 && (
          <p className="condition-empty">
            Condition content isn&apos;t available for this entry.
          </p>
        )}

        {sections.map((section) => (
          <section key={section.key} className="condition-card">
            <h3 className="condition-section-title">{section.title}</h3>
            <div className="condition-content">
              <FormattedSection content={section.content} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
};

export default ConditionPage;
