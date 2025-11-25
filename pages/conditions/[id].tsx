import React, { useMemo } from "react";
import FormattedSection from "../../components/conditions/FormattedSection";
import {
  getConditionById,
  isMeaningfulContent,
  type ConditionEntry,
} from "../../lib/loadConditions";

const getConditionIdFromPath = (): string => {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? "");
};

const formatSectionTitle = (key: string): string => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

const ConditionPage: React.FC = () => {
  const conditionId = useMemo(() => getConditionIdFromPath(), []);
  const conditionContent: ConditionEntry | undefined = useMemo(
    () => (conditionId ? getConditionById(conditionId) : undefined),
    [conditionId]
  );

  const sections = useMemo(() => {
    const entries = conditionContent?.sections ?? {};
    return Object.entries(entries)
      .filter(([, value]) => isMeaningfulContent(value))
      .map(([key, value]) => ({ key, value, title: formatSectionTitle(key) }));
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
              <FormattedSection content={section.value} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
};

export default ConditionPage;
