import React from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/config/appViews';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface CardGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CardGrid — dashboard widget grid with staggered entrance.
 *
 * Each direct child is wrapped in a motion.div that participates in the
 * parent's staggerChildren timeline (0.06s offset). Respects reduced-motion.
 */
const CardGrid: React.FC<CardGridProps> = ({ children, className }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className ?? ''}`}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="animate"
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className ?? ''}`}
    >
      {React.Children.map(children, (child, i) => (
        <motion.div key={i} variants={staggerItem}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default CardGrid;
