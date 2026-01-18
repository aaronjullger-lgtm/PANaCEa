/**
 * MobileMenuToggle - Hamburger menu button for mobile sidebar
 *
 * Only visible on small screens (< 768px)
 */

import React from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileMenuToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const MobileMenuToggle: React.FC<MobileMenuToggleProps> = ({ isOpen, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <X className="w-5 h-5 text-[var(--color-text-primary)]" />
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Menu className="w-5 h-5 text-[var(--color-text-primary)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

export default MobileMenuToggle;
