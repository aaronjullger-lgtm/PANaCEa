/**
 * BottomSheet - Mobile-native modal alternative
 *
 * Provides thumb-friendly, swipe-to-dismiss bottom sheet for mobile devices.
 * Auto-switches to center modal on desktop for optimal UX on all screen sizes.
 *
 * Features:
 * - Drag handle with visual affordance
 * - Swipe down to dismiss
 * - Snap points for height levels
 * - Backdrop blur + tap-to-dismiss
 * - Full keyboard accessibility
 * - Focus trap
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { X } from 'lucide-react';
import { useFocusTrap, useKeyboardNavigation } from '@/lib/utils/accessibilityUtils';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Snap points as % of screen height (e.g., [0.5, 0.9]) */
  snapPoints?: number[];
  /** Enable swipe down to dismiss */
  enableSwipeDown?: boolean;
  /** Force mobile sheet even on desktop (for testing) */
  forceMobile?: boolean;
  /** Additional className for content */
  className?: string;
}

const DRAG_THRESHOLD = 100; // Pixels to drag before dismissing
const MOBILE_BREAKPOINT = 768;

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.6, 0.9],
  enableSwipeDown = true,
  forceMobile = false,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(
    forceMobile || (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)
  );
  const controls = useAnimation();
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Accessibility
  useFocusTrap(sheetRef as React.RefObject<HTMLElement>, isOpen);
  useKeyboardNavigation(onClose);

  // Detect mobile on resize
  useEffect(() => {
    if (forceMobile) return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [forceMobile]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen]);

  // Handle drag end - snap to nearest point or dismiss
  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);

      // Swipe down to dismiss
      if (enableSwipeDown && info.offset.y > DRAG_THRESHOLD) {
        onClose();
        return;
      }

      // Snap to nearest snap point based on velocity and position
      const screenHeight = window.innerHeight;
      const currentY = info.point.y;
      const currentPercent = currentY / screenHeight;

      // Find nearest snap point
      let nearestIndex = 0;
      let minDiff = Math.abs((snapPoints[0] ?? 0.6) - currentPercent);

      snapPoints.forEach((snap, index) => {
        const diff = Math.abs(snap - currentPercent);
        if (diff < minDiff) {
          minDiff = diff;
          nearestIndex = index;
        }
      });

      setCurrentSnapIndex(nearestIndex);
      const targetSnap = snapPoints[nearestIndex] ?? 0.6;
      controls.start({ y: `${(1 - targetSnap) * 100}%` });
    },
    [enableSwipeDown, onClose, snapPoints, controls]
  );

  const currentHeight = (snapPoints[currentSnapIndex] ?? 0.6) * 100;

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
             
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-[35]"
            />

            {/* Sheet */}
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'bottom-sheet-title' : undefined}
              initial={{ y: '100%' }}
              animate={controls}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              style={{ y: `${100 - currentHeight}%` }}
              className={`
                fixed bottom-0 left-0 right-0 z-[101]
                bg-[var(--color-bg-primary)] 
                rounded-t-3xl 
                shadow-[0_-10px_40px_-10px_var(--color-shadow-soft)]
                border-t border-[var(--color-border)]
                max-h-[95vh]
                overflow-hidden
                flex flex-col
              `}
            >
              {/* Drag Handle */}
              <div className="flex items-center justify-center py-3 px-4 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-[var(--color-bg-secondary)]/30 rounded-full" />
              </div>

              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
                  <h2
                    id="bottom-sheet-title"
                    className="text-lg font-bold text-[var(--color-text-primary)]"
                  >
                    {title}
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div tabIndex={0} className={`flex-1 overflow-y-auto ${className}`}>{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: center modal (fallback to existing pattern)
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
           
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-[35] flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`
                bg-[var(--color-bg-primary)] 
                rounded-2xl 
                shadow-2xl 
                border border-[var(--color-border)]
                max-w-2xl w-full max-h-[90vh]
                overflow-hidden
                flex flex-col
              `}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                  <h2
                    id="modal-title"
                    className="text-xl font-bold text-[var(--color-text-primary)]"
                  >
                    {title}
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div tabIndex={0} className={`flex-1 overflow-y-auto ${className}`}>{children}</div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
