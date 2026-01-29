import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTooltip } from '@/contexts/TooltipContext';
import { Info } from 'lucide-react';

/**
 * DefinitionTooltip Component
 * Displays floating tooltip with medical term definitions
 */
const DefinitionTooltip: React.FC = () => {
  const { tooltipState, hideTooltip } = useTooltip();
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Adjust position to keep tooltip in viewport
  useEffect(() => {
    if (tooltipState.isVisible && tooltipRef.current) {
      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = tooltipState.position.x;
      let adjustedY = tooltipState.position.y;

      // Prevent overflow on right edge
      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      // Prevent overflow on bottom edge
      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      // Prevent overflow on left edge
      if (adjustedX < 0) {
        adjustedX = 10;
      }

      // Prevent overflow on top edge
      if (adjustedY < 0) {
        adjustedY = 10;
      }

      tooltip.style.left = `${adjustedX}px`;
      tooltip.style.top = `${adjustedY}px`;
    }
  }, [tooltipState.isVisible, tooltipState.position]);

  return (
    <AnimatePresence>
      {tooltipState.isVisible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: tooltipState.position.x,
            top: tooltipState.position.y + 20, // Offset below cursor
          }}
        >
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg shadow-2xl p-4 max-w-xs pointer-events-auto">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-cyan-300 mb-1">{tooltipState.term}</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{tooltipState.definition}</p>
              </div>
            </div>
            {/* Pointer arrow */}
            <div className="absolute -top-2 left-4 w-4 h-4 bg-slate-800 border-l border-t border-cyan-500/30 transform rotate-45" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DefinitionTooltip;

/**
 * HighlightableTerm Component
 * Wraps text that should show tooltip on hover
 */
interface HighlightableTermProps {
  children: string;
  term?: string; // Optional: specify term if different from children
}

export const HighlightableTerm: React.FC<HighlightableTermProps> = ({ children, term }) => {
  const { showTooltip, hideTooltip } = useTooltip();

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    const termToShow = term || children;
    const rect = e.currentTarget.getBoundingClientRect();
    showTooltip(termToShow, rect.left + rect.width / 2, rect.bottom);
  };

  return (
    <span
      onMouseEnter={handleMouseEnter}
      onMouseLeave={hideTooltip}
      className="border-b border-dotted border-cyan-500/50 cursor-help hover:text-cyan-400 transition-colors"
    >
      {children}
    </span>
  );
};
