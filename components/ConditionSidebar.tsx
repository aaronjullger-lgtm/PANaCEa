import React from 'react';

interface ConditionSidebarProps {
  sections: { key: string; title: string }[];
  activeSection: string;
  onSelect: (key: string) => void;
}

const ConditionSidebar: React.FC<ConditionSidebarProps> = ({
  sections,
  activeSection,
  onSelect,
}) => {
  return (
    <aside className="section-nav condition-sidebar">
      <p className="section-nav-label">Sections</p>
      <div className="section-nav-list">
        {sections.map((section) => {
          const isActive = activeSection === section.key;
          return (
            <button
              key={section.key}
              onClick={() => onSelect(section.key)}
              className={`section-nav-button ${isActive ? 'active' : ''}`}
              type="button"
            >
              {section.title}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default ConditionSidebar;
