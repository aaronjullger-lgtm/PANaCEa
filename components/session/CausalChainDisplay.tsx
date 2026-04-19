/**
 * CausalChainDisplay — Post-answer mechanistic causal chain visualization
 *
 * Renders a causal reasoning chain as an expandable horizontal flow:
 * Entity → [mechanism] → Consequence → Entity → ...
 *
 * Supports four display levels (aligned with expertise-adaptive scaffolding):
 * - full:      All mechanisms visible by default (NOVICE)
 * - collapsed: Click to expand mechanism brackets (DEVELOPING)
 * - skeleton:  Entity → Consequence only, no mechanisms (COMPETENT)
 * - pearl:     One-line clinical correlation (EXPERT)
 *
 * Research basis (tier1.md Item 4):
 * - Woods, Brooks & Norman (2005): Causal mechanism knowledge helps most on
 *   difficult cases with irrelevant findings — precisely the transfer scenario
 *   medical students face
 * - Chi et al. (1994): Self-explanation via causal chains d = 0.63–0.95
 * - Renkl, Atkinson & Große (2004): Fading triggers productive self-explanation
 *
 * @module components/session/CausalChainDisplay
 * Sprint: Tier 1 Research Implementation — Item 4
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, GitBranch, Lightbulb, Zap } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getChainSummary } from '@/lib/services/causalChainService';
import type {
  CausalChain,
  CausalLink,
  BranchPoint,
  CausalChainDisplayLevel,
} from '@/types/causalChain';

// ─── Props ──────────────────────────────────────────────────────────

interface CausalChainDisplayProps {
  /** The causal chain to render */
  chain: CausalChain;
  /** Display level driven by expertise-adaptive scaffolding */
  displayLevel?: CausalChainDisplayLevel;
  /** Font size adjustment from user preferences */
  fontSizeAdjustment?: number;
}

// ─── Typography Tokens ──────────────────────────────────────────────

const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', monospace";

// ─── Link Arrow Component ───────────────────────────────────────────

const ChainArrow: React.FC<{ linkType: string }> = ({ linkType }) => {
  const label = linkType.replace(/_/g, ' ');
  return (
    <div className="flex flex-col items-center mx-1 shrink-0" aria-hidden="true">
      <span
        style={{
          fontSize: 9,
          fontFamily: FONT_MONO,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <ChevronRight size={14} className="text-[var(--color-accent)]" />
    </div>
  );
};

// ─── Single Chain Link ──────────────────────────────────────────────

interface ChainLinkNodeProps {
  link: CausalLink;
  isExpanded: boolean;
  onToggle: () => void;
  displayLevel: CausalChainDisplayLevel;
  isLast: boolean;
  fontSizeAdjustment: number;
}

const ChainLinkNode: React.FC<ChainLinkNodeProps> = ({
  link,
  isExpanded,
  onToggle,
  displayLevel,
  isLast,
  fontSizeAdjustment,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const showMechanism = displayLevel === 'full' || (displayLevel === 'collapsed' && isExpanded);
  const isClickable = displayLevel === 'collapsed';

  return (
    <div className="flex items-start gap-1">
      {/* Link node */}
      <div
        className={`rounded-lg border transition-all duration-200 ${
          isClickable ? 'cursor-pointer hover:border-[var(--color-accent)]/50' : ''
        }`}
        style={{
          padding: '8px 12px',
          borderColor: 'var(--color-border)',
          background: 'var(--color-bg-secondary)',
          maxWidth: 280,
          minWidth: 140,
        }}
        onClick={isClickable ? onToggle : undefined}
        role={isClickable ? 'button' : undefined}
        aria-expanded={isClickable ? isExpanded : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }
            : undefined
        }
      >
        {/* Entity name */}
        <div className="flex items-center gap-1.5">
          {isClickable && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
            >
              <ChevronRight size={12} className="text-[var(--color-text-muted)] shrink-0" />
            </motion.div>
          )}
          <span
            style={{
              fontSize: 13 + fontSizeAdjustment,
              fontWeight: 600,
              fontFamily: FONT_BODY,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {link.entity}
          </span>
        </div>

        {/* Mechanism bracket — expandable */}
        <AnimatePresence>
          {showMechanism && (
            <motion.div
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  marginTop: 6,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'color-mix(in srgb, var(--color-bg-tertiary) 60%, var(--color-accent) 5%)',
                  borderLeft: '2px solid var(--color-accent)',
                  fontSize: 12 + fontSizeAdjustment,
                  fontFamily: FONT_BODY,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                {link.mechanism}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Consequence (for skeleton mode, show inline) */}
        {displayLevel === 'skeleton' && (
          <div
            style={{
              marginTop: 4,
              fontSize: 11 + fontSizeAdjustment,
              fontFamily: FONT_BODY,
              color: 'var(--color-text-muted)',
              lineHeight: 1.4,
            }}
          >
            → {link.consequence}
          </div>
        )}
      </div>

      {/* Arrow to next link */}
      {!isLast && <ChainArrow linkType={link.linkType} />}
    </div>
  );
};

// ─── Branch Point Display ───────────────────────────────────────────

interface BranchPointDisplayProps {
  branchPoint: BranchPoint;
  fontSizeAdjustment: number;
}

const BranchPointDisplay: React.FC<BranchPointDisplayProps> = ({
  branchPoint,
  fontSizeAdjustment,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px dashed var(--color-border)',
        background: 'color-mix(in srgb, var(--color-bg-secondary) 90%, #fbbf24 10%)',
      }}
    >
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`Differential diagnosis: ${branchPoint.differentialDiagnosis}`}
      >
        <GitBranch size={14} className="text-[var(--color-data-provisional)] shrink-0" />
        <span
          style={{
            fontSize: 12 + fontSizeAdjustment,
            fontWeight: 600,
            fontFamily: FONT_BODY,
            color: 'var(--color-text-primary)',
          }}
        >
          Differential: {branchPoint.differentialDiagnosis}
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
          className="ml-auto"
        >
          <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <p
              style={{
                marginTop: 8,
                fontSize: 12 + fontSizeAdjustment,
                fontFamily: FONT_BODY,
                color: 'var(--color-text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}
            >
              {branchPoint.condition}
            </p>

            {/* Alternative path links */}
            <div className="mt-2 pl-4 border-l-2 border-[var(--color-data-provisional)]/40 space-y-2">
              {branchPoint.alternativePath.map((link, i) => (
                <div key={`branch-${i}`} className="flex items-start gap-2">
                  <Zap size={10} className="text-[var(--color-data-provisional)] mt-1 shrink-0" />
                  <div>
                    <span
                      style={{
                        fontSize: 12 + fontSizeAdjustment,
                        fontWeight: 600,
                        fontFamily: FONT_BODY,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {link.entity}
                    </span>
                    <span
                      style={{
                        fontSize: 11 + fontSizeAdjustment,
                        fontFamily: FONT_BODY,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {' '}— {link.mechanism}
                    </span>
                    <span
                      style={{
                        fontSize: 11 + fontSizeAdjustment,
                        fontFamily: FONT_BODY,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {' → '}{link.consequence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────

export const CausalChainDisplay: React.FC<CausalChainDisplayProps> = ({
  chain,
  displayLevel = 'collapsed',
  fontSizeAdjustment = 0,
}) => {
  // Track which links are expanded (for 'collapsed' display level)
  const [expandedLinks, setExpandedLinks] = useState<Set<number>>(new Set());

  const toggleLink = useCallback((index: number) => {
    setExpandedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedLinks(new Set(chain.links.map((_, i) => i)));
  }, [chain.links]);

  const collapseAll = useCallback(() => {
    setExpandedLinks(new Set());
  }, []);

  return (
    <div
      className="mt-4 pt-4 border-t border-[var(--color-border)]/60"
      aria-label="Causal reasoning chain"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-[var(--color-accent)]" />
          <h3
            style={{
              fontSize: 13 + fontSizeAdjustment,
              fontWeight: 700,
              fontFamily: FONT_BODY,
              color: 'var(--color-text-primary)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Why This Happens
          </h3>
        </div>

        {/* Controls for collapsed mode */}
        {displayLevel === 'collapsed' && (
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              style={{ fontFamily: FONT_BODY }}
            >
              Expand all
            </button>
            <span className="text-xs text-[var(--color-border)]">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              style={{ fontFamily: FONT_BODY }}
            >
              Collapse
            </button>
          </div>
        )}
      </div>

      {/* Pearl mode — one-line summary */}
      {displayLevel === 'pearl' && (
        <p
          style={{
            fontSize: 13 + fontSizeAdjustment,
            fontFamily: FONT_BODY,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--color-bg-secondary)',
            borderLeft: '3px solid var(--color-accent)',
          }}
        >
          {chain.clinicalCorrelation}
        </p>
      )}

      {/* Skeleton mode — compact entity flow */}
      {displayLevel === 'skeleton' && (
        <div
          style={{
            fontSize: 13 + fontSizeAdjustment,
            fontFamily: FONT_MONO,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--color-bg-secondary)',
          }}
        >
          {getChainSummary(chain)}
        </div>
      )}

      {/* Full and Collapsed modes — interactive chain */}
      {(displayLevel === 'full' || displayLevel === 'collapsed') && (
        <>
          {/* Chain links — horizontal scroll on mobile, wrap on desktop */}
          <div
            className="flex flex-wrap items-start gap-y-2"
            role="list"
            aria-label="Causal chain links"
          >
            {chain.links.map((link, index) => (
              <div key={`link-${index}`} role="listitem" className="flex items-start">
                <ChainLinkNode
                  link={link}
                  isExpanded={displayLevel === 'full' || expandedLinks.has(index)}
                  onToggle={() => toggleLink(index)}
                  displayLevel={displayLevel}
                  isLast={index === chain.links.length - 1}
                  fontSizeAdjustment={fontSizeAdjustment}
                />
              </div>
            ))}
          </div>

          {/* Branch points */}
          {(chain.branchPoints ?? []).map((bp, index) => (
            <BranchPointDisplay
              key={`bp-${index}`}
              branchPoint={bp}
              fontSizeAdjustment={fontSizeAdjustment}
            />
          ))}

          {/* Clinical correlation footer */}
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--color-bg-secondary) 90%, var(--color-accent) 10%)',
              border: '1px solid var(--color-border)',
            }}
          >
            <p
              style={{
                fontSize: 12 + fontSizeAdjustment,
                fontFamily: FONT_BODY,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                fontStyle: 'italic',
              }}
            >
              <strong style={{ color: 'var(--color-text-primary)', fontStyle: 'normal' }}>
                Clinical Correlation:
              </strong>{' '}
              {chain.clinicalCorrelation}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default CausalChainDisplay;
