// src/components/ConditionDetailModal.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConditionMeta } from '@/src/types/conditions';
import {
  getConditionById,
  getConditionByIdSync,
  isMeaningfulContent,
  type ConditionContent,
  type ConditionEntry,
} from '@/lib/loadConditions';
import ConditionSidebar from '@/components/panels/ConditionSidebar';
import FormattedSection from '@/components/conditions/FormattedSection';
import { BuzzwordBanner } from '@/components/conditions/BuzzwordBanner';
import { ConditionFamilyView } from '@/components/library/ConditionFamilyView';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

/**
 * Build a standardized condition ID from metadata
 */
function buildConditionId(meta: ConditionMeta): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  return `${meta.system}__${norm(meta.subcategory)}__${norm(meta.condition)}`;
}

interface ConditionDetailModalProps {
  condition: ConditionMeta;
  onClose: () => void;
  onDrillCondition?: (meta: ConditionMeta) => void;
}

interface ContentSection {
  key: string;
  title: string;
  content?: ConditionContent;
  accent?: 'danger' | 'default';
}

const SCROLL_OFFSET = 96;

const SECTION_ORDER: { key: string; title: string; accent?: 'danger' | 'default' }[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'anatomy', title: 'Anatomy' },
  { key: 'keyPoints', title: 'Key Points' },
  { key: 'etiology', title: 'Etiology' },
  { key: 'pathophysiology', title: 'Pathophysiology' },
  { key: 'epidemiology', title: 'Epidemiology' },
  { key: 'riskFactors', title: 'Risk Factors' },
  { key: 'clinicalPresentation', title: 'Clinical Presentation' },
  { key: 'symptoms', title: 'Symptoms' },
  { key: 'physicalExam', title: 'Physical Exam' },
  { key: 'specialTests', title: 'Special Tests' },
  { key: 'examFindings', title: 'Exam Findings' },
  { key: 'diagnostics', title: 'Diagnostics' },
  { key: 'differentialDiagnosis', title: 'Differential Diagnosis' },
  { key: 'management', title: 'Management' },
  { key: 'treatment', title: 'Treatment' },
  { key: 'treatmentPearls', title: 'Treatment Pearls' },
  { key: 'complications', title: 'Complications' },
  { key: 'redFlags', title: 'Red Flags', accent: 'danger' },
  { key: 'prognosis', title: 'Prognosis' },
  { key: 'preventionEducation', title: 'Prevention & Education' },
];

const ConditionDetailModal: React.FC<ConditionDetailModalProps> = ({
  condition,
  onClose,
  onDrillCondition,
}) => {
  const { getToken } = useAuth();
  const [extendedData, setExtendedData] = useState<any>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const [content, setContent] = useState<ConditionEntry | undefined>(undefined);

  const conditionId = useMemo(() => buildConditionId(condition), [condition]);

  // Load condition content asynchronously
  useEffect(() => {
    let mounted = true;

    async function loadContent() {
      // Try to get it synchronously first (if already loaded)
      let entry = getConditionByIdSync(conditionId) ?? getConditionByIdSync(condition.condition);

      // If not loaded, fetch just this condition (fast path)
      if (!entry) {
        entry =
          (await getConditionById(conditionId)) ?? (await getConditionById(condition.condition));
      }

      if (mounted) {
        setContent(entry);
        // If we have content, we can stop loading (even if extended data isn't ready)
        setIsLoading(false);
      }
    }

    loadContent();

    return () => {
      mounted = false;
    };
  }, [condition.condition, conditionId]);

  // Load extended content (Anatomy, Special Tests)
  useEffect(() => {
    let mounted = true;

    async function loadExtendedData() {
      try {
        const token = await getToken();
        const response = await fetch(
          getApiEndpoint(`/api/conditions/${encodeURIComponent(condition.condition)}/extended`),
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType?.includes('application/json')) {
          const data = await response.json();
          if (mounted) {
            setExtendedData(data);
            setIsLoading(false); // Extended data includes core content now, so we can stop loading
          }
        } else {
          // Non-JSON response (likely HTML 404 page)
          if (!contentType?.includes('application/json')) {
            console.warn(`Extended data endpoint returned ${contentType} instead of JSON`);
            console.warn('This usually means the backend server is not running');
          } else {
            console.warn(`Extended data request failed with status ${response.status}`);
          }
          if (mounted) setIsLoading(false); // Stop loading even on error
        }
      } catch (e) {
        console.warn('Could not load extended data (anatomy, special tests) - this is optional', e);
        if (mounted) setIsLoading(false); // Stop loading even on error
      }
    }

    if (condition.condition) {
      loadExtendedData();
    }

    return () => {
      mounted = false;
    };
  }, [condition.condition, getToken]);

  const sections: ContentSection[] = useMemo(() => {
    const availableSections: ContentSection[] = [];

    // Use global content if available, otherwise fall back to core content from extended endpoint
    // This allows the modal to populate quickly even if the global content cache hasn't loaded yet
    const contentSource = content?.sections || extendedData?.coreContent;

    SECTION_ORDER.forEach((config) => {
      // Check standard content
      if (contentSource?.[config.key] && isMeaningfulContent(contentSource[config.key])) {
        availableSections.push({
          ...config,
          content: contentSource[config.key],
        });
        return;
      }

      // Check extended content
      if (config.key === 'anatomy' && extendedData?.anatomyStructures?.length > 0) {
        availableSections.push({ ...config });
        return;
      }

      if (config.key === 'specialTests' && extendedData?.specialTests?.length > 0) {
        availableSections.push({ ...config });
        return;
      }
    });

    return availableSections;
  }, [content?.sections, extendedData]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const containerRect = container.getBoundingClientRect();
        let closestKey = '';
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
        const firstSection = sections[0];
        if (firstSection) setActiveSection(firstSection.key);
        return;
      }

      const bottomGap = container.scrollHeight - (container.scrollTop + container.clientHeight);
      if (bottomGap <= 2) {
        const lastSection = sections[sections.length - 1];
        if (lastSection) setActiveSection(lastSection.key);
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      let closestKey = sections[0]?.key ?? '';
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

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [sections]);

  useEffect(() => {
    if (sections.length > 0) {
      const firstSection = sections[0];
      if (firstSection) setActiveSection(firstSection.key);
    }
  }, [sections]);

  const mediaIds: string[] = [];
  const hasAnyContent = sections.length > 0;

  const scrollToSection = (key: string) => {
    const container = contentRef.current;
    const target = sectionRefs.current[key];

    if (container && target) {
      const top = target.offsetTop - container.offsetTop - SCROLL_OFFSET;
      container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
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
            <div className="condition-scrollable condition-scrollable-padded" ref={contentRef}>
              {isLoading && sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <div className="w-12 h-12 border-4 border-[var(--color-category-practice)] border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-[var(--color-text-muted)] font-medium">
                    Loading condition details...
                  </p>
                </div>
              ) : (
                <>
                  <BuzzwordBanner conditionName={condition.condition} />

                  {condition.canonicalName && (
                    <div className="mb-6">
                      <ConditionFamilyView canonicalName={condition.canonicalName} />
                    </div>
                  )}

                  {mediaIds.length > 0 && (
                    <section className="condition-media">
                      <div className="condition-media-frame">
                        {(() => {
                          const currentMedia = mediaIds[mediaIndex];
                          if (!currentMedia) return null;
                          return (
                            <img
                              src={`/media/${
                                currentMedia.includes('.') ? currentMedia : `${currentMedia}.png`
                              }`}
                              alt={`${condition.condition} media ${mediaIndex + 1}`}
                            />
                          );
                        })()}
                        {mediaIds.length > 1 && (
                          <div className="condition-media-controls">
                            <button
                              className="media-button"
                              onClick={() =>
                                setMediaIndex((mediaIndex - 1 + mediaIds.length) % mediaIds.length)
                              }
                              aria-label="Previous media"
                            >
                              ‹
                            </button>
                            <button
                              className="media-button"
                              onClick={() => setMediaIndex((mediaIndex + 1) % mediaIds.length)}
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
                              className={`dot ${idx === mediaIndex ? 'active' : ''}`}
                              aria-label={`View media ${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  <div className="condition-sections">
                    {sections.length === 0 && !isLoading ? (
                      <div className="text-center py-12 text-[var(--color-text-muted)]">
                        <p>No detailed content available for this condition yet.</p>
                      </div>
                    ) : (
                      sections.map((section) => (
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
                              section.accent === 'danger' ? 'condition-content-danger' : ''
                            }`}
                          >
                            {section.key === 'anatomy' && extendedData?.anatomyStructures ? (
                              <div className="space-y-4">
                                {extendedData.anatomyStructures.map((item: any) => (
                                  <div
                                    key={item.id}
                                    className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]"
                                  >
                                    <h4 className="font-bold text-lg text-[var(--color-text-primary)]">
                                      {item.name}
                                    </h4>
                                    <p className="text-sm text-[var(--color-text-muted)] mb-2">
                                      {item.region} • {item.system}
                                    </p>
                                    <p className="text-[var(--color-text-secondary)]">
                                      {item.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : section.key === 'specialTests' && extendedData?.specialTests ? (
                              <div className="space-y-4">
                                {extendedData.specialTests.map((test: any) => (
                                  <div
                                    key={test.id}
                                    className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]"
                                  >
                                    <h4 className="font-bold text-lg text-[var(--color-text-primary)]">
                                      {test.name}
                                    </h4>
                                    <div className="flex gap-4 text-sm text-[var(--color-text-muted)] mt-1 mb-2">
                                      {test.sensitivity && (
                                        <span className="bg-data-pass text-data-pass px-2 py-0.5 rounded text-xs">
                                          Sensitivity: {test.sensitivity}%
                                        </span>
                                      )}
                                      {test.specificity && (
                                        <span className="bg-[var(--color-category-practice)] text-[var(--color-category-practice)] px-2 py-0.5 rounded text-xs">
                                          Specificity: {test.specificity}%
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[var(--color-text-secondary)] mb-3">
                                      {test.description}
                                    </p>
                                    {test.technique && (
                                      <div className="mt-2 p-3 bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border)]">
                                        <span className="font-semibold text-xs uppercase text-[var(--color-text-muted)] block mb-1">
                                          Technique
                                        </span>
                                        <p className="text-sm text-[var(--color-text-primary)]">
                                          {test.technique}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <FormattedSection content={section.content} />
                            )}
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <footer className="condition-footer">
          <button
            type="button"
            onClick={onClose}
            className="condition-close"
            aria-label="Close condition details"
          >
            Close
          </button>
          {onDrillCondition && (
            <button
              type="button"
              onClick={() => onDrillCondition(condition)}
              className="condition-drill"
              aria-label="Start drill for this condition"
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
